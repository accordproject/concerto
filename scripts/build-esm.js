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

const external = [
    ...packageExternal.flatMap(expandExternal),
    ...builtinModules,
    ...builtinModules.map(name => `node:${name}`),
];

const commonBuildOptions = {
    bundle: true,
    format: 'esm',
    platform: isNodeOnlyPackage ? 'node' : 'browser',
    mainFields: isNodeOnlyPackage ? ['module', 'main'] : ['browser', 'module', 'main'],
    target: 'es2020',
    sourcemap: true,
    external,
    banner: {
        js: 'import { createRequire as __createRequire } from "module";\nconst require = __createRequire(import.meta.url);',
    },
    logLevel: 'info',
};

esbuild.buildSync({
    ...commonBuildOptions,
    entryPoints: [entryPoint],
    outfile,
});

// For packages with dayjs-setup, also emit it as a separate ESM file so the
// sideEffects field in package.json can reference it without marking the entire
// index.mjs as side-effectful.
if (hasDayjsSetup) {
    esbuild.buildSync({
        ...commonBuildOptions,
        entryPoints: [path.join(packageDir, 'src', 'dayjs-setup.ts')],
        outfile: path.join(packageDir, 'dist', 'esm', 'dayjs-setup.mjs'),
    });
}
