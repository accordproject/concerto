/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const esbuild = require('esbuild');

const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const srcDir = path.join(packageDir, 'src');
const nodeOutdir = path.join(packageDir, 'dist', 'esm');
const browserOutdir = path.join(packageDir, 'dist', 'esm-browser');
const isNodeOnlyPackage = packageJson.name === '@accordproject/concerto-linter';
// Only concerto-core ships src/engine/ (P4-11a, PORTING.md 1.5, OD-11); every
// other package that goes through this shared script gets the plain
// createRequire banner it always had, unchanged, and never touches `module`.
const isConcertoCore = packageJson.name === '@accordproject/concerto-core';

/**
 * Reads the `src/...` directories a tsconfig file lists under `key` (plain
 * paths, or a directory followed by the recursive glob; other globs are
 * skipped).
 *
 * @param {string} file - tsconfig file name, relative to the package
 * @param {string} key - `include` or `exclude`
 * @return {string[]} absolute paths of the directories
 */
function readSourceDirs(file, key) {
    const tsconfigPath = path.join(packageDir, file);
    if (!fs.existsSync(tsconfigPath)) {
        return [];
    }
    return (JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))[key] || [])
        .map(entry => entry.replace(/\/\*\*\/\*$/, ''))
        .filter(entry => entry.startsWith('src/') && !/[*?]/.test(entry))
        .map(entry => path.join(packageDir, entry));
}

/**
 * The src/ directories the package's tsconfig.build.json excludes, so that
 * the public ESM build compiles exactly the CJS build's public modules.
 *
 * A package can also ship internal modules as JavaScript only, with no .d.ts:
 * tsconfig.build.json excludes them, so they stay out of the declaration
 * build (and out of the API snapshot), and tsconfig.build.internal.json
 * compiles them into dist/ with `declaration: false`. concerto-core does this
 * for src/engine/, the CONCERTO_ENGINE=rust shim of the Rust migration
 * (PORTING.md 1.5, OD-11).
 *
 * The internal directories are left out of the public build too and get a
 * build of their own (buildInternalDir), so that adding them changes neither
 * the public modules nor the chunks they share: dist/esm and
 * dist/esm-browser outside engine/ are byte for byte what they were before
 * the engine shipped. In particular the engine's `require` calls must not
 * put esbuild's `__require` shim into a shared chunk, which every public
 * module imports and which webpack reports as a critical dependency.
 */
const excludedSourceDirs = new Set(readSourceDirs('tsconfig.build.json', 'exclude'));
const internalSourceDirs = readSourceDirs('tsconfig.build.internal.json', 'include')
    .filter(dir => excludedSourceDirs.has(dir) && fs.existsSync(dir));

/**
 * Every TypeScript module under src/ is an entry point.
 *
 * This is what makes the packages tree-shakeable. esbuild will happily bundle
 * src/index.ts into a single dist/esm/index.mjs, but a consumer's bundler then
 * has one enormous module to reason about: `sideEffects` no longer applies
 * (there is nothing left to drop at module granularity) and the only tool left
 * is statement-level dead-code elimination across the whole flattened file,
 * which cross-references defeat almost immediately. Emitting one output module
 * per source module — mirroring what tsc already does for the CJS build —
 * preserves the import graph, so a downstream bundler can drop whole modules
 * the consumer never reached.
 *
 * @param {string} dir - directory to scan
 * @param {string[]} found - accumulator
 * @return {string[]} absolute paths of the .ts modules under dir
 */
function collectEntryPoints(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!excludedSourceDirs.has(entryPath)) {
                collectEntryPoints(entryPath, found);
            }
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            found.push(entryPath);
        }
    }
    return found;
}

const workspacePackages = [
    '@accordproject/concerto-analysis',
    '@accordproject/concerto-core',
    '@accordproject/concerto-cto',
    '@accordproject/concerto-linter',
    '@accordproject/concerto-util',
    '@accordproject/concerto-vocabulary',
    '@accordproject/concertino',
].filter(name => name !== packageJson.name);

const expandExternal = name => name.includes('*') ? [name] : [name, `${name}/*`];

// Runtime dependencies, kept external in the Node build so they resolve through
// the consumer's node_modules — the same thing tsc already does for the CJS
// output, which emits `require("dayjs")` rather than inlining it.
//
// Bundling them instead gives every package its own private copy: `debug` was
// compiled into concerto-util, concerto-core and concerto-cto independently, so
// an application depending on all three shipped three copies and deduplicated
// none of them. It also hides those dependencies from `npm audit` and SBOM
// tooling, and makes a patch to any of them require republishing concerto
// rather than a lockfile bump.
//
// The browser build still bundles them: it is consumed as a self-contained
// graph, and its Node-builtin stubbing only holds if the dependencies that
// reach for builtins are resolved here rather than by the consumer.
//
// Three exceptions stay bundled. They are CommonJS with no ESM build, and
// Node's cjs-module-lexer cannot statically see their named exports, so
// externalising them emits `import { Spectral } from '...'` and Node throws
// "Named export 'Spectral' not found" at load time. Bundling is what
// esbuild's interop was already doing for them. Re-check whether an entry
// can be removed once upstream publishes a lexable build:
//
//   node -e "const {parse}=require('cjs-module-lexer');
//     console.log(parse(require('fs').readFileSync(require.resolve('<pkg>'),'utf8')).exports)"
const nonLexableDependencies = [
    '@stoplight/spectral-cli',
    '@stoplight/spectral-core',
    '@stoplight/spectral-parsers',
];

const runtimeDependencies = Object.keys(packageJson.dependencies || {})
    .filter(name => !nonLexableDependencies.includes(name));

const builtinSpecifiers = new Set([
    ...builtinModules,
    ...builtinModules.map(name => `node:${name}`),
]);

// Browser builds must not resolve — or carry bare imports of — Node builtins,
// since a downstream browser bundler without Node polyfills would fail to
// resolve `import "fs"`. Instead we stub them to empty modules, matching the
// parity the webpack UMD build achieves via resolve.fallback (fs/tls/net/
// child_process/os/path -> false). A dependency that remaps a builtin through
// its own `browser` field is resolved by esbuild before this plugin runs, so
// genuine browser shims (e.g. crypto-browserify) still win.
const stubNodeBuiltinsPlugin = {
    name: 'stub-node-builtins',
    setup(build) {
        build.onResolve({ filter: /^(node:|[a-z])/ }, args => {
            if (args.path.startsWith('node:') || builtinSpecifiers.has(args.path)) {
                return { path: args.path, namespace: 'node-builtin-stub' };
            }
            return undefined;
        });
        build.onLoad({ filter: /.*/, namespace: 'node-builtin-stub' }, () => ({
            // Empty CommonJS module: `import x from 'fs'` -> {}, named imports
            // resolve to undefined without a build-time error (parity with
            // webpack's `fs: false` fallback).
            contents: 'module.exports = {};',
            loader: 'js',
        }));
    },
};

/**
 * Build options for one ESM target.
 *
 * Two ESM builds are emitted, because stubbing Node builtins is right for a
 * browser bundle and wrong for Node. The `exports` map routes the `browser`
 * condition at dist/esm-browser and the `import` condition at dist/esm, so a
 * Node consumer gets real `fs`/`path` — stubbing them there silently breaks
 * anything that touches the filesystem (FileWriter, ModelWriter, ModelLoader)
 * at runtime rather than at build time.
 *
 * @param {'node'|'browser'} target - which runtime this build is for
 * @return {object} esbuild options shared by every entry point of that target
 */
function buildOptionsFor(target) {
    const isNode = target === 'node';
    const packageExternal = isNodeOnlyPackage
        ? [...workspacePackages, 'fsevents', 'fsevents/*', '*.node']
        : workspacePackages;
    const externalDependencies = isNode ? runtimeDependencies : [];

    return {
        bundle: true,
        format: 'esm',
        platform: target,
        mainFields: isNode ? ['module', 'main'] : ['browser', 'module', 'main'],
        target: 'es2020',
        sourcemap: true,
        logLevel: 'info',
        external: [
            ...packageExternal.flatMap(expandExternal),
            ...externalDependencies.flatMap(expandExternal),
            // Node keeps its builtins external, so they resolve to the real
            // modules at runtime.
            ...(isNode ? [...builtinModules, ...builtinModules.map(name => `node:${name}`)] : []),
        ],
        // Only the Node build needs the createRequire shim: bundling a CJS
        // dependency can emit a runtime require() call, which has no meaning in
        // an ES module. A browser-targeted build must not carry a Node-only
        // `import ... from "module"`, which would break downstream bundlers.
        //
        // P4-11a (PORTING.md 1.5, OD-11) also makes rust mode's
        // `module.require(specifier)` work here: Node's native ESM has no
        // `module` global, so without help the property read throws. The
        // banner only *assigns* `globalThis.module` — inside a check for
        // `CONCERTO_ENGINE=rust`, so a ts-mode consumer's process is never
        // touched — and never *declares* a local `module` or a local alias of
        // the require it builds. That distinction is load-bearing: a bundler
        // consumer of this Node build (webpack --target node) must still see
        // the exact ts-mode errors and warnings it saw before rust mode
        // existed, and webpack's "Critical dependency" check traces any local
        // binding of a require-like value — a plain alias, a renamed const, a
        // closure over one, even one nested in an object literal — all the
        // way to wherever it is finally called with a non-literal argument;
        // it does not trace an assignment to a property of `globalThis`. Only
        // that global-property form leaves `module.require(specifier)` as
        // opaque to webpack as it already was when `module` was simply
        // undefined (checked by bundling the actual dist/esm output both ways
        // and diffing webpack's warning count against the pre-P4-11a build,
        // not just read from the source).
        //
        // The specifier (`./engine`, `../engine`, `../engine/views`) is
        // relative to wherever the *source* file sits, but splitting (below)
        // hoists a view shared by several entry points — every view here is —
        // into a chunk at the outdir root, one level shallower than a nested
        // source file such as introspect/*.ts, so `../engine` would resolve
        // one directory above the package's dist/ entirely (also checked by
        // requiring the actual built chunk, not just read from the source).
        // `globalThis.module.require` rewrites only that one pattern, to the
        // engine directory's real location, plus the extension a real
        // `require` call needs — `/index.mjs` with no subpath, `<subpath>.mjs`
        // with one — and defers to a second, ordinary `createRequire` for
        // every other specifier (a dependency, or a relative import a future
        // view adds that isn't chunked away from its own directory); nothing
        // else in the graph calls `module.require` with an `engine`
        // specifier.
        //
        // The engine directory is located at runtime, never baked in as this
        // build machine's absolute `nodeOutdir` path: the banner text is
        // identical in every output file, but each file's own `import.meta.url`
        // is real at runtime wherever the published package ends up (an npm
        // tarball, another checkout, CI), so the closure below walks upward
        // from *this file's own* directory — an entry file sits at the outdir
        // root or one level under it (e.g. `introspect/`), a shared chunk is
        // hoisted to the outdir root — until it finds the `engine/` directory
        // that sits next to the outdir root, and caches that answer per file
        // since every call from the same module resolves the same directory.
        // Requiring an `.mjs` file this way needs Node's synchronous ESM
        // require (stable since Node 22.12/23; this repo's `engines.node`
        // floor predates that, recorded as a limitation in PORTING.md 1.5
        // rather than worked around here).
        ...(isNode
            ? { banner: { js: [
                'import { createRequire as __createRequire } from "module";',
                'const require = __createRequire(import.meta.url);',
                ...(isConcertoCore ? [
                    'if (typeof globalThis.module === "undefined" && typeof process !== "undefined" && process.env?.CONCERTO_ENGINE === "rust") {',
                    '    globalThis.__concertoEngineRequire = __createRequire(import.meta.url);',
                    '    let __engineDir;',
                    '    globalThis.module = { require(specifier) {',
                    '        const m = /^\\.\\.?\\/engine(\\/.*)?$/.exec(specifier);',
                    '        if (!m) { return globalThis.__concertoEngineRequire(specifier); }',
                    '        if (!__engineDir) {',
                    '            const { fileURLToPath } = globalThis.__concertoEngineRequire("node:url");',
                    '            const path = globalThis.__concertoEngineRequire("node:path");',
                    '            const fs = globalThis.__concertoEngineRequire("node:fs");',
                    '            let dir = path.dirname(fileURLToPath(import.meta.url));',
                    '            while (!fs.existsSync(path.join(dir, "engine", "index.mjs"))) {',
                    '                const parent = path.dirname(dir);',
                    '                if (parent === dir) {',
                    '                    throw new Error(`Cannot locate the concerto-core engine directory from ${import.meta.url}`);',
                    '                }',
                    '                dir = parent;',
                    '            }',
                    '            __engineDir = path.join(dir, "engine");',
                    '        }',
                    '        return globalThis.__concertoEngineRequire(__engineDir + (m[1] ? `${m[1]}.mjs` : "/index.mjs"));',
                    '    } };',
                    '}',
                ] : []),
            ].join('\n') } }
            : {
                plugins: [stubNodeBuiltinsPlugin],
                // The sources and their dependencies read `process.env` and
                // `process.emitWarning`. Left free, that identifier is every
                // downstream browser bundler's problem — and a webpack
                // consumer's ProvidePlugin answers it with an extensionless
                // `process/browser` request, which webpack rejects as not
                // fully specified once the importing module is a .mjs file.
                // Binding it here keeps the browser build self-contained.
                //
                // browser-module-shim.js binds `module` the same way, only for
                // concerto-core (the one package with src/engine/): the
                // rust-mode views' `module.require(specifier)` calls (P4-11a).
                // A browser has neither Node's `module` nor a `require` to
                // build one from, so it defers to a `globalThis.module` a
                // consumer's bundler (or, in e2e/tests/wasm-engine.spec.ts, the
                // test harness) provides, exactly as it already must for
                // src/engine/rust.ts's own bare `require('@accordproject/concerto-engine')`.
                inject: [
                    path.join(__dirname, 'browser-process-shim.js'),
                    ...(isConcertoCore ? [path.join(__dirname, 'browser-module-shim.js')] : []),
                ],
            }),
    };
}

/**
 * An esbuild plugin for the build of an internal directory: every relative
 * import that leaves the directory is kept external and pointed at the public
 * build's output module (`../introspect/numbervalidator` becomes
 * `../introspect/numbervalidator.mjs`), so the internal modules share the
 * public modules' instances (and classes, for `instanceof`) instead of
 * bundling copies, and the public build's output is left alone.
 *
 * The internal build writes its chunks into the directory itself, so these
 * relative paths hold for the chunks as well; that is why an import leaving
 * the directory from one of its subdirectories is refused. So is one that
 * does not name a `<path>.ts` or `<path>/index.ts` module (a `.js` or `.json`
 * file, say), which would otherwise be bundled into the directory silently.
 *
 * @param {string} dir - absolute path of the internal source directory
 * @return {object} the plugin
 */
function externalizePublicModulesPlugin(dir) {
    const inside = file => file === dir || file.startsWith(dir + path.sep);
    return {
        name: 'externalize-public-modules',
        setup(build) {
            build.onResolve({ filter: /^\.\.?(\/|$)/ }, args => {
                const target = path.resolve(args.resolveDir, args.path);
                if (inside(target) || !inside(args.resolveDir)) {
                    return undefined;
                }
                if (args.resolveDir !== dir) {
                    return { errors: [{ text: `${args.path}: build-esm.js does not support a public import from a subdirectory of ${dir}` }] };
                }
                const module = [`${target}.ts`, path.join(target, 'index.ts')].find(file => fs.existsSync(file));
                if (!module) {
                    return { errors: [{ text: `${args.path}: build-esm.js only supports a public import of a <path>.ts or <path>/index.ts module from ${dir}; anything else would be bundled into it` }] };
                }
                const output = path.relative(args.resolveDir, module).replace(/\.ts$/, '.mjs').split(path.sep).join('/');
                return { path: output.startsWith('.') ? output : `./${output}`, external: true };
            });
        },
    };
}

/**
 * Builds one internal directory (see internalSourceDirs) for one target, in
 * its own esbuild pass: its modules are the entry points, the chunks they
 * share go into the directory's own output, and the public modules they
 * import stay external, so nothing of the internal build reaches the public
 * modules or their chunks.
 *
 * @param {'node'|'browser'} target - which runtime this build is for
 * @param {string} outdir - the target's output directory
 * @param {string} dir - absolute path of the internal source directory
 * @return {Promise<object>} the esbuild result
 */
function buildInternalDir(target, outdir, dir) {
    const options = buildOptionsFor(target);
    return esbuild.build({
        ...options,
        plugins: [externalizePublicModulesPlugin(dir), ...(options.plugins || [])],
        entryPoints: collectEntryPoints(dir),
        outdir,
        outbase: srcDir,
        splitting: true,
        chunkNames: `${path.relative(srcDir, dir).split(path.sep).join('/')}/chunk-[hash]`,
        outExtension: { '.js': '.mjs' },
    });
}

// The async build API is required because browser builds register an esbuild
// plugin (buildSync cannot use plugins).
async function main() {
    const entryPoints = collectEntryPoints(srcDir);

    // A node-only package has no browser consumers, so it gets one build.
    const targets = isNodeOnlyPackage
        ? [{ target: 'node', outdir: nodeOutdir }]
        : [{ target: 'node', outdir: nodeOutdir }, { target: 'browser', outdir: browserOutdir }];

    for (const { target, outdir } of targets) {
        await esbuild.build({
            ...buildOptionsFor(target),
            entryPoints,
            outdir,
            outbase: srcDir,
            // Code shared between entry points is hoisted into chunk files
            // rather than duplicated into each one. Splitting is only supported
            // for the esm format, which is what we emit.
            splitting: true,
            // dist/esm sits inside a package without "type": "module", so the
            // output has to carry the .mjs extension to be treated as ESM.
            // esbuild rewrites the emitted relative specifiers to match, which
            // also keeps them resolvable by Node, where extensionless imports
            // do not work.
            outExtension: { '.js': '.mjs' },
        });
        for (const dir of internalSourceDirs) {
            await buildInternalDir(target, outdir, dir);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
