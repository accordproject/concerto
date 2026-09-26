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

/**
 * CTO -> AST cache for the native (Rust) oracle harness (PORTING.md OD-9).
 *
 *   node bin/cto-cache.js --out <file> [--fixtures <dir>] [--op <prefix>]...
 *
 * ORACLE_REFERENCE_DIR overrides the reference directory (default
 * migration/oracle/reference, which must have been installed with npm ci).
 *
 * CTO parsing stays in JS, so a native harness cannot rebuild a model manager
 * whose recipe has an `addCTOModel` step. This script walks the fixtures
 * (every one, or those whose op starts with one of the --op prefixes),
 * resolves their blobs, collects every CTO text an `addCTOModel` step parses,
 * and parses it with the frozen reference concerto-cto 5.0.0, exactly as
 * `ModelManager`'s processFile does:
 * `Parser.parse(cto, fileName ?? 'UNKNOWN', { skipLocationNodes })`.
 *
 * The output is a JSON array of
 *   { cto, fileName, skipLocationNodes, ast } or { ..., error: { class, message } },
 * where fileName is the step's argument (null when absent). The native harness
 * looks entries up by (cto, fileName, skipLocationNodes); a CTO text with no
 * entry is a harness error there.
 *
 * P0-04b trial scaffolding: P1-07 owns the generator, its keying and where the
 * cache lives.
 */

const fs = require('fs');
const path = require('path');
const { blobStore } = require('../lib/store');

const ORACLE_DIR = path.resolve(__dirname, '..');

const opts = { out: null, fixtures: path.join(ORACLE_DIR, 'fixtures'), ops: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') {
        opts.out = path.resolve(argv[++i]);
    } else if (a === '--fixtures') {
        opts.fixtures = path.resolve(argv[++i]);
    } else if (a === '--op') {
        opts.ops.push(argv[++i]);
    } else {
        throw new Error('unknown argument ' + a);
    }
}
if (!opts.out) {
    throw new Error('--out is required');
}

// ORACLE_REFERENCE_DIR points at another checkout's installed reference.
const refRoot = process.env.ORACLE_REFERENCE_DIR || path.join(ORACLE_DIR, 'reference');
const refDir = path.join(refRoot, 'node_modules', '@accordproject', 'concerto-cto');
const { Parser } = require(refDir);
const store = blobStore(path.join(opts.fixtures, 'blobs'));

const entries = new Map();

/**
 * Record every addCTOModel step of every model manager recipe in a value.
 * @param {*} v resolved fixture value
 * @param {object} options the recipe's options
 */
function walk(v, options) {
    if (v === null || typeof v !== 'object') {
        return;
    }
    if (Array.isArray(v)) {
        v.forEach((x) => walk(x, options));
        return;
    }
    if (v['@@oracle'] === 'mm') {
        const mmOptions = v.options || {};
        (Array.isArray(v.steps) ? v.steps : []).forEach((step) => {
            if (step.method === 'addCTOModel' && typeof step.args[0] === 'string') {
                const fileName = typeof step.args[1] === 'string' ? step.args[1] : null;
                const skip = mmOptions.skipLocationNodes === undefined ? null : mmOptions.skipLocationNodes;
                const key = JSON.stringify([step.args[0], fileName, skip]);
                if (!entries.has(key)) {
                    const entry = { cto: step.args[0], fileName, skipLocationNodes: skip };
                    try {
                        entry.ast = Parser.parse(step.args[0], fileName ?? 'UNKNOWN', { skipLocationNodes: mmOptions.skipLocationNodes });
                    } catch (e) {
                        entry.error = { class: e.constructor.name, message: e.message };
                    }
                    entries.set(key, entry);
                }
            }
            walk(step.args, mmOptions);
        });
        if (v.derived) {
            walk(v.derived, mmOptions);
        }
        return;
    }
    Object.values(v).forEach((x) => walk(x, options));
}

for (const source of fs.readdirSync(opts.fixtures)) {
    const sourceDir = path.join(opts.fixtures, source);
    if (source === 'blobs' || !fs.statSync(sourceDir).isDirectory()) {
        continue;
    }
    for (const op of fs.readdirSync(sourceDir)) {
        if (opts.ops.length > 0 && !opts.ops.some((p) => op.startsWith(p))) {
            continue;
        }
        for (const f of fs.readdirSync(path.join(sourceDir, op))) {
            const fixture = JSON.parse(fs.readFileSync(path.join(sourceDir, op, f), 'utf8'));
            walk(store.unpack(fixture.inputs), {});
        }
    }
}

fs.mkdirSync(path.dirname(opts.out), { recursive: true });
fs.writeFileSync(opts.out, JSON.stringify([...entries.values()]));
console.log(`cto-cache: ${entries.size} CTO texts -> ${opts.out}`);
