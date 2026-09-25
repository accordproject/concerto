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
// writes results/triage-clusters.json from results/divergences.jsonl. Not
// itself part of the harness; a one-off helper for writing TRIAGE.md.

const fs = require('fs');
const path = require('path');

const runFile = path.join(__dirname, '..', 'results', 'run-42.json');
const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
console.log('| op | ran | agree | divergences |');
console.log('|---|---|---|---|');
for (const [op, s] of Object.entries(run.byOp)) {
    console.log(`| ${op} | ${s.ran} | ${s.agree} | ${s.divergences} |`);
}
console.log('');
console.log(`total: ran=${run.ran} agree=${run.agree} divergences=${run.divergences} harnessErrorsTs=${run.harnessErrorsTs} harnessErrorsRust=${run.harnessErrorsRust}`);

const { execSync } = require('child_process');
execSync(`node ${path.join(__dirname, 'triage.js')} ${path.join(__dirname, '..', 'results', 'divergences.jsonl')} > ${path.join(__dirname, '..', 'results', 'triage-clusters.json')}`);
console.log('wrote results/triage-clusters.json');
