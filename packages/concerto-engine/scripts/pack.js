#!/usr/bin/env node
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

// Packs @accordproject/concerto-engine for publishing (accordproject/concerto-rust#259).
//
// In this repository the package links a concerto-rust checkout next to this
// one (index.js, index.mjs). The published package carries the built engine
// instead:
//
//   node scripts/pack.js stage     (prepack)  copies the engine's runtime files
//                                             into pkg/ and points index.js and
//                                             index.mjs at them;
//   node scripts/pack.js unstage   (postpack) restores the link and removes pkg/.
//
// The engine is read from CONCERTO_ENGINE_PKG when it is set, otherwise from
// ../concerto-rust/concerto-wasm/pkg next to this repository. Staging fails
// when it is not built, so nothing publishes without the engine.

const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const STAGED_DIR = path.join(PACKAGE_DIR, 'pkg');
const BACKUP_DIR = path.join(PACKAGE_DIR, '.workspace-link');
const ENTRY_POINTS = ['index.js', 'index.mjs'];

// The runtime closure of concerto-wasm's pkg/: the two loaders (each with the
// .wasm inlined) and the web glue the ESM loader imports.
const ENGINE_FILES = [
    'concerto-engine.cjs',
    'concerto-engine.mjs',
    'web/concerto_wasm.js',
    'web/package.json',
];

const HEADER = `/*
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
`;

const PUBLISHED = {
    'index.js': `${HEADER}
// @accordproject/concerto-engine: the concerto-core Rust engine, built by
// concerto-rust's concerto-wasm (see README.md).

module.exports = require('./pkg/concerto-engine.cjs');
`,
    'index.mjs': `${HEADER}
// @accordproject/concerto-engine: the concerto-core Rust engine, built by
// concerto-rust's concerto-wasm (see README.md).

export * from './pkg/concerto-engine.mjs';
`,
};

/**
 * Copies the built engine into pkg/ and points the entry points at it.
 */
function stage() {
    const source = process.env.CONCERTO_ENGINE_PKG
        ? path.resolve(process.env.CONCERTO_ENGINE_PKG)
        : path.resolve(PACKAGE_DIR, '../../../concerto-rust/concerto-wasm/pkg');
    const missing = ENGINE_FILES.filter((file) => !fs.existsSync(path.join(source, file)));
    if (missing.length > 0) {
        throw new Error(`@accordproject/concerto-engine: the engine is not built in ${source} (missing ${missing.join(', ')}). Build it with \`npm run build\` in concerto-rust's concerto-wasm, or set CONCERTO_ENGINE_PKG.`);
    }
    if (fs.existsSync(BACKUP_DIR)) {
        throw new Error(`@accordproject/concerto-engine: ${BACKUP_DIR} exists; run \`node scripts/pack.js unstage\` first.`);
    }

    fs.rmSync(STAGED_DIR, { recursive: true, force: true });
    for (const file of ENGINE_FILES) {
        fs.mkdirSync(path.dirname(path.join(STAGED_DIR, file)), { recursive: true });
        fs.copyFileSync(path.join(source, file), path.join(STAGED_DIR, file));
    }

    fs.mkdirSync(BACKUP_DIR);
    for (const file of ENTRY_POINTS) {
        fs.copyFileSync(path.join(PACKAGE_DIR, file), path.join(BACKUP_DIR, file));
        fs.writeFileSync(path.join(PACKAGE_DIR, file), PUBLISHED[file]);
    }
    console.log(`@accordproject/concerto-engine: staged the engine from ${source}`);
}

/**
 * Restores the workspace link and removes pkg/.
 */
function unstage() {
    if (fs.existsSync(BACKUP_DIR)) {
        for (const file of ENTRY_POINTS) {
            fs.copyFileSync(path.join(BACKUP_DIR, file), path.join(PACKAGE_DIR, file));
        }
        fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    }
    fs.rmSync(STAGED_DIR, { recursive: true, force: true });
}

const command = process.argv[2];
if (command === 'stage') {
    stage();
} else if (command === 'unstage') {
    unstage();
} else {
    console.error('usage: node scripts/pack.js stage|unstage');
    process.exit(1);
}
