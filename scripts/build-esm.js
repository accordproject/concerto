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
const entryPoint = path.join(packageDir, 'src', 'index.ts');
const outfile = path.join(packageDir, 'dist', 'esm', 'index.mjs');
const isNodeOnlyPackage = packageJson.name === '@accordproject/concerto-linter';
const hasDayjsSetup = fs.existsSync(path.join(packageDir, 'src', 'dayjs-setup.ts'));

const workspacePackages = [
    '@accordproject/concerto-analysis',
    '@accordproject/concerto-core',
    '@accordproject/concerto-cto',
    '@accordproject/concerto-linter',
    '@accordproject/concerto-util',
    '@accordproject/concerto-vocabulary',
    '@accordproject/concertino',
].filter(name => name !== packageJson.name);

const packageExternal = isNodeOnlyPackage ? [...workspacePackages, 'fsevents', 'fsevents/*', '*.node'] : workspacePackages;
const expandExternal = name => name.includes('*') ? [name] : [name, `${name}/*`];

const builtinSpecifiers = new Set([
    ...builtinModules,
    ...builtinModules.map(name => `node:${name}`),
]);

// The Node-only build keeps builtins external (emitted as runtime require()
// calls). Browser builds must not resolve — or carry bare imports of — Node
// builtins, since a downstream browser bundler without Node polyfills would
// fail to resolve `import "fs"`. Instead we stub them to empty modules, matching
// the parity the existing webpack UMD build achieves via resolve.fallback
// (fs/tls/net/child_process/os/path -> false). A dependency that remaps a
// builtin through its own `browser` field is resolved by esbuild before this
// plugin runs, so genuine browser shims (e.g. crypto-browserify) still win.
const external = [
    ...packageExternal.flatMap(expandExternal),
    ...(isNodeOnlyPackage
        ? [...builtinModules, ...builtinModules.map(name => `node:${name}`)]
        : []),
];

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

const commonBuildOptions = {
    bundle: true,
    format: 'esm',
    platform: isNodeOnlyPackage ? 'node' : 'browser',
    mainFields: isNodeOnlyPackage ? ['module', 'main'] : ['browser', 'module', 'main'],
    target: 'es2020',
    sourcemap: true,
    external,
    logLevel: 'info',
    // Only the Node-only build needs the createRequire shim: its externalised
    // Node builtins are emitted as runtime require() calls. Browser-targeted
    // builds must not carry a Node-only `import ... from "module"`, which would
    // break downstream browser bundlers, so the banner is gated accordingly.
    ...(isNodeOnlyPackage ? {
        banner: {
            js: 'import { createRequire as __createRequire } from "module";\nconst require = __createRequire(import.meta.url);',
        },
    } : {
        // Browser builds stub Node builtins to empty modules instead of leaving
        // bare `import "fs"` in the output.
        plugins: [stubNodeBuiltinsPlugin],
    }),
};

// The async build API is required because browser builds register an esbuild
// plugin (buildSync cannot use plugins).
async function main() {
    await esbuild.build({
        ...commonBuildOptions,
        entryPoints: [entryPoint],
        outfile,
    });

    // For packages with dayjs-setup, also emit it as a separate ESM file so the
    // sideEffects field in package.json can reference it without marking the
    // entire index.mjs as side-effectful.
    if (hasDayjsSetup) {
        await esbuild.build({
            ...commonBuildOptions,
            entryPoints: [path.join(packageDir, 'src', 'dayjs-setup.ts')],
            outfile: path.join(packageDir, 'dist', 'esm', 'dayjs-setup.mjs'),
        });
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
