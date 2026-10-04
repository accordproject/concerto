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

// Prints the TRIAGE.md headline table row data from results/run-42.json, and
// regenerates every derived results file from the committed run outputs
// (results/divergences.jsonl, results/expected-divergences.jsonl):
// results/divergence-summary.json (bin/summarize.js) and
// results/triage-clusters.json (bin/triage.js, then bin/minimize-clusters.js
// for each cluster's reproducer and bin/attribute-owners.js for its owner).
// Re-running it over the committed inputs, with the same engine, reproduces
// the committed JSON exactly (`git diff --exit-code migration/fuzz/results`).
//
// The minimise step needs a built Rust/WASM engine and the canonical corpus
// (README.md "Reproducing a divergence"):
//   FIXTURES_DIR=<concerto checkout>/migration/oracle/fixtures \
//   CONCERTO_ENGINE_MODULE=<concerto-rust checkout>/concerto-wasm/pkg/concerto-engine.cjs \
//     node migration/fuzz/bin/finalize-triage.js

const fs = require('fs');
const path = require('path');

const runFile = path.join(__dirname, '..', 'results', 'run-42.json');
const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
console.log('| op | ran | agree | divergences | expected | harness errors (ts / rust) |');
console.log('|---|---|---|---|---|---|');
for (const [op, s] of Object.entries(run.byOp)) {
    console.log(`| ${op} | ${s.ran} | ${s.agree} | ${s.divergences} | ${s.expectedDivergences || 0} | ${s.harnessErrorsTs} / ${s.harnessErrorsRust} |`);
}
console.log('');
console.log(`total: ran=${run.ran} agree=${run.agree} divergences=${run.divergences} expectedDivergences=${run.expectedDivergences || 0} harnessErrorCases=${run.harnessErrorCases} harnessErrorsTs=${run.harnessErrorsTs} harnessErrorsRust=${run.harnessErrorsRust}`);

const { execSync } = require('child_process');
execSync(`node ${path.join(__dirname, 'summarize.js')}`, { stdio: 'inherit' });
execSync(`node ${path.join(__dirname, 'triage.js')} ${path.join(__dirname, '..', 'results', 'divergences.jsonl')} > ${path.join(__dirname, '..', 'results', 'triage-clusters.json')}`);
console.log('wrote results/triage-clusters.json');

if (process.env.FIXTURES_DIR && process.env.CONCERTO_ENGINE_MODULE) {
    execSync(`node ${path.join(__dirname, 'minimize-clusters.js')}`, { stdio: 'inherit' });
} else {
    console.log('skipped minimize-clusters.js: set FIXTURES_DIR and CONCERTO_ENGINE_MODULE to run it');
}
execSync(`node ${path.join(__dirname, 'attribute-owners.js')}`, { stdio: 'inherit' });
