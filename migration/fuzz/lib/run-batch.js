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

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

/**
 * Run one batch of {id, op, inputs} cases through one engine worker.
 * @param {string} engine "ts" | "rust"
 * @param {Array<object>} cases batch
 * @param {object} env {FIXTURES_DIR, CONCERTO_ENGINE_MODULE?}
 * @returns {Promise<Map<string,object>>} id -> {ok, canon|error}
 */
function runBatch(engine, cases, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, 'worker.js')], {
            env: Object.assign({}, process.env, env, { ENGINE: engine }),
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const results = new Map();
        let stderr = '';
        const rl = readline.createInterface({ input: child.stdout, terminal: false });
        rl.on('line', (line) => {
            if (!line.trim()) { return; }
            try {
                const r = JSON.parse(line);
                results.set(r.id, r);
            } catch (e) {
                // ignore a malformed output line; the missing id will show
                // up as "no result" for its case
            }
        });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (results.size < cases.length && code !== 0) {
                return reject(new Error(`${engine} worker exited ${code} after ${results.size}/${cases.length} results: ${stderr.slice(-2000)}`));
            }
            resolve(results);
        });
        for (const c of cases) {
            child.stdin.write(JSON.stringify(c) + '\n');
        }
        child.stdin.end();
    });
}

module.exports = { runBatch };
