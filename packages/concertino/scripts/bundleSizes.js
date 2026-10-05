/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
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

// Measures the browser bundle of each subpath of the package: every export
// of the subpath's browser build (dist/esm-browser), bundled with esbuild
// (ESM, browser, minified, es2022), raw and gzip bytes, and whether the
// bundle contains `new Function` (it must not: strict-CSP safe). It also
// measures the browser CTO pipeline (concerto-cto, `./resolve`, the converter).
//
//   npm run build && node scripts/bundleSizes.js [--json]

const path = require('path');
const zlib = require('zlib');
const esbuild = require('esbuild');

const packageDir = path.resolve(__dirname, '..');
const packageJson = require(path.join(packageDir, 'package.json'));

/**
 * The subpaths of the package that have a browser build.
 * @returns {string[]} the subpaths
 */
function subpaths() {
    return Object.keys(packageJson.exports).filter((subpath) => packageJson.exports[subpath].browser);
}

/**
 * The browser build of a subpath.
 * @param {string} subpath - the subpath, e.g. `./validate`
 * @returns {string} the file, as a JSON string literal
 */
const browserFile = (subpath) => JSON.stringify(path.join(packageDir, packageJson.exports[subpath].browser));

/**
 * Bundles an entry module for the browser and measures it.
 * @param {string} label - the row's label
 * @param {string} contents - the entry module
 * @returns {Promise<object>} the row
 */
async function measureEntry(label, contents) {
    const result = await esbuild.build({
        stdin: { contents, resolveDir: packageDir, loader: 'js' },
        bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, logLevel: 'silent',
    });
    const code = result.outputFiles[0].contents;
    return {
        subpath: label,
        raw: code.length,
        gzip: zlib.gzipSync(code, { level: 9 }).length,
        newFunction: /new Function/.test(Buffer.from(code).toString('utf8')),
    };
}

/**
 * Bundles every export of one subpath's browser build (and, optionally, more).
 * @param {string} subpath - the subpath, e.g. `./validate`
 * @param {string} [extra] - more of the entry module, e.g. another subpath's export
 * @returns {Promise<object>} the row
 */
async function measure(subpath, extra = '') {
    const label = extra ? `${subpath} + ${extra.replace(/ from .*/, '').replace(/^\s*export /, '')}` : subpath;
    return measureEntry(label, `export * from ${browserFile(subpath)};${extra}`);
}

/**
 * The browser CTO pipeline (decision A1 of accordproject/concerto-rust#420):
 * concerto-cto's parser, then `./resolve`, then the converter, with no
 * concerto-core or engine; and the same with `load` and `validate`, so CTO
 * text in, a validated instance out.
 * @returns {Promise<object[]>} the rows
 */
async function measurePipeline() {
    const toConcertino = [
        'import { Parser } from \'@accordproject/concerto-cto\';',
        `import { resolveModels } from ${browserFile('./resolve')};`,
        `import { convertToConcertino } from ${browserFile('.')};`,
        'export const toConcertino = (ctos) => convertToConcertino(resolveModels(ctos.map((c) => Parser.parse(c)), { failFast: true }).models);',
    ].join('\n');
    const toInstance = [
        toConcertino,
        `import { load } from ${browserFile('./runtime')};`,
        `import { validate } from ${browserFile('./validate')};`,
        'export const validateInstance = (ctos, json) => validate(load(toConcertino(ctos)), json);',
    ].join('\n');
    return [
        await measureEntry('CTO pipeline: concerto-cto Parser + ./resolve + convertToConcertino', toConcertino),
        await measureEntry('CTO pipeline + load + validate (CTO and JSON in, validated instance out)', toInstance),
    ];
}

/**
 * Measures every subpath, and prints a table (or JSON with --json).
 * @returns {Promise<object[]>} the rows
 */
async function main() {
    const rows = [];
    for (const subpath of subpaths()) {
        rows.push(await measure(subpath));
    }
    // What a validating app imports: the validator, and `load` to read the document.
    rows.push(await measure('./validate', ` export { load } from ${browserFile('./runtime')};`));
    rows.push(...await measurePipeline());
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 2));
    } else {
        const kb = (n) => (n / 1024).toFixed(1);
        console.log('| subpath | raw (KiB) | gzip (KiB) | `new Function` |');
        console.log('|---|---:|---:|---|');
        for (const row of rows) {
            console.log(`| \`${row.subpath}\` | ${kb(row.raw)} | ${kb(row.gzip)} | ${row.newFunction ? 'yes' : 'no'} |`);
        }
    }
    if (rows.some((row) => row.newFunction)) {
        process.exitCode = 1;
    }
    return rows;
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { measure, measureEntry, measurePipeline, subpaths };
