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

// Builds the worker recipe with esbuild: `node build.mjs [outDir]` (default
// ./dist), then serve outDir over HTTP and open index.html.
//
//   outDir/worker.mjs          worker.mjs bundled: concerto-core, the engine's
//                              browser loader and the engine host below
//   outDir/concerto_wasm.wasm  the engine, fetched by `init()` in the worker
//   outDir/main.mjs            the page side: posts to the worker
//   outDir/index.html          a demo page
//
// The engine host. concerto-core's browser build loads its engine modules
// through a synchronous `require` that the bundler or host supplies
// (`globalThis.module.require`); a stock bundler does not, because the
// specifiers are not literal. This script generates that `require` as a
// virtual module, `./engine-host.generated.mjs`, which worker.mjs imports
// first: a registry of the engine's browser modules
// (dist/esm-browser/engine/*.mjs), the engine's browser loader, and the
// public modules the engine requires back, each imported statically so the
// bundle holds them once, in the order their top-level code needs them.
//
// The .wasm. The engine's browser loader names its module with
// `new URL('./concerto_wasm.wasm', import.meta.url)`. Vite and webpack 5
// emit such a file as an asset by themselves; esbuild leaves the expression
// as it is, relative to the bundle, so this script copies the .wasm next to
// it. To host it elsewhere, pass `init({ module_or_path })`.

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * The installed concerto-core's browser engine modules, and the public
 * modules they require back (esbuild writes each as `__require("...")`).
 *
 * @return {{engineDir: string, modules: string[], requires: string[]}} the
 * engine directory, its entry modules (`index` and `views` first), and the
 * required specifiers, relative to the engine directory
 */
function engineGraph() {
    const coreDir = path.dirname(require.resolve('@accordproject/concerto-core/package.json'));
    const engineDir = path.join(coreDir, 'dist', 'esm-browser', 'engine');
    const files = fs.readdirSync(engineDir).filter((file) => file.endsWith('.mjs'));
    const names = files.filter((file) => !file.startsWith('chunk-')).map((file) => file.slice(0, -'.mjs'.length));
    const first = ['index', 'views'];
    const modules = [...first, ...names.filter((name) => !first.includes(name)).sort()];
    const requires = new Set();
    for (const file of files) {
        for (const match of fs.readFileSync(path.join(engineDir, file), 'utf8').matchAll(/__require\("([^"]+)"\)/g)) {
            requires.add(match[1]);
        }
    }
    return { engineDir, modules, requires: [...requires].sort() };
}

/**
 * The esbuild plugin that serves `./engine-host.generated.mjs`: one virtual
 * module per registry step, imported in order (ESM evaluates a module's
 * imports before its body, so each step is its own module).
 *
 * @return {object} the plugin
 */
function engineHostPlugin() {
    const { engineDir, modules, requires } = engineGraph();
    const posix = (file) => file.split(path.sep).join('/');
    const steps = [
        // The synchronous `require`, reading from the registry.
        `const registry = new Map();
globalThis.__concertoEngineRegistry = registry;
const engineRequire = (specifier) => {
    const engine = /^\\.\\.?\\/engine(\\/.*)?$/.exec(specifier);
    const key = engine ? 'engine/' + (engine[1] ? engine[1].slice(1) : 'index') : specifier;
    if (!registry.has(key)) {
        throw new Error('concerto engine host: "' + specifier + '" is not in the bundle');
    }
    return registry.get(key);
};
globalThis.module = { require: engineRequire };
globalThis.require = engineRequire;`,
        // The engine's browser loader: the same module the app imports.
        `import * as engine from '@accordproject/concerto-engine';
globalThis.__concertoEngineRegistry.set('@accordproject/concerto-engine', engine);`,
        ...modules.map((name) => `import * as m from '${posix(path.join(engineDir, `${name}.mjs`))}';
globalThis.__concertoEngineRegistry.set('engine/${name}', m);`),
        ...requires.map((specifier) => `import * as m from '${posix(path.join(engineDir, specifier))}';
globalThis.__concertoEngineRegistry.set(${JSON.stringify(specifier)}, m);`),
    ];
    return {
        name: 'concerto-engine-host',
        setup(build) {
            build.onResolve({ filter: /^\.\/engine-host\.generated\.mjs$|^engine-host-step:/ }, (args) => ({
                path: args.path.startsWith('engine-host-step:') ? args.path : 'engine-host',
                namespace: 'concerto-engine-host',
            }));
            build.onLoad({ filter: /.*/, namespace: 'concerto-engine-host' }, (args) => ({
                contents: args.path === 'engine-host'
                    ? steps.map((_, i) => `import 'engine-host-step:${i}';`).join('\n')
                    : steps[Number(args.path.slice('engine-host-step:'.length))],
                resolveDir: HERE,
                loader: 'js',
            }));
        },
    };
}

/**
 * Builds the example into `outDir`.
 *
 * @param {object} [options] - options
 * @param {string} [options.outDir] - the output directory (default ./dist)
 * @param {boolean} [options.minify] - minify the worker bundle
 * @return {Promise<string>} outDir
 */
export async function build({ outDir = path.join(HERE, 'dist'), minify = false } = {}) {
    fs.mkdirSync(outDir, { recursive: true });
    const result = await esbuild.build({
        entryPoints: [path.join(HERE, 'worker.mjs')],
        outfile: path.join(outDir, 'worker.mjs'),
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        minify,
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [engineHostPlugin()],
        metafile: true,
        // Errors only: concerto-core's `sideEffects` list makes esbuild warn about
        // its chunk imports, which is expected.
        logLevel: 'error',
    });
    // The .wasm next to the engine's browser loader, copied next to the bundle.
    const loader = Object.keys(result.metafile.inputs).find((input) => input.endsWith('/concerto-engine.mjs'));
    if (!loader) {
        throw new Error('the bundle has no concerto-engine.mjs: is @accordproject/concerto-engine built?');
    }
    fs.copyFileSync(path.resolve(path.dirname(loader), 'concerto_wasm.wasm'), path.join(outDir, 'concerto_wasm.wasm'));
    for (const file of ['main.mjs', 'index.html']) {
        fs.copyFileSync(path.join(HERE, file), path.join(outDir, file));
    }
    return outDir;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    build({ outDir: process.argv[2] ? path.resolve(process.argv[2]) : undefined })
        .then((outDir) => console.log(`Built the worker example into ${outDir}`))
        .catch((err) => {
            console.error(err);
            process.exitCode = 1;
        });
}
