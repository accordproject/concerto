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
            collectEntryPoints(entryPath, found);
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
            // Node keeps its builtins external, so they resolve to the real
            // modules at runtime.
            ...(isNode ? [...builtinModules, ...builtinModules.map(name => `node:${name}`)] : []),
        ],
        // Only the Node build needs the createRequire shim: bundling a CJS
        // dependency can emit a runtime require() call, which has no meaning in
        // an ES module. A browser-targeted build must not carry a Node-only
        // `import ... from "module"`, which would break downstream bundlers.
        ...(isNode
            ? { banner: { js: 'import { createRequire as __createRequire } from "module";\nconst require = __createRequire(import.meta.url);' } }
            : {
                plugins: [stubNodeBuiltinsPlugin],
                // The sources and their dependencies read `process.env` and
                // `process.emitWarning`. Left free, that identifier is every
                // downstream browser bundler's problem — and a webpack
                // consumer's ProvidePlugin answers it with an extensionless
                // `process/browser` request, which webpack rejects as not
                // fully specified once the importing module is a .mjs file.
                // Binding it here keeps the browser build self-contained.
                inject: [path.join(__dirname, 'browser-process-shim.js')],
            }),
    };
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
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
