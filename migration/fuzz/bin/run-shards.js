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
 * P5-05 stage 2 shard supervisor (accordproject/concerto-rust#76): runs the
 * 1,000,000-case differential fuzz run as fixed, recorded shards of
 * bin/fuzz.js, at most `--parallel` at a time, and keeps a resumable state
 * file. Re-running it skips shards already marked `done` and restarts any
 * other shard from scratch (a shard's raw outputs are truncated first, so a
 * restarted shard never double-counts).
 *
 * The state file (committed) records the run-seeds, per-shard counts, the
 * engine module and corpus used; the raw per-case outputs (divergences,
 * expected divergences, harness errors) stay in --raw-dir, outside the repo,
 * and only their aggregate (bin/aggregate-shards.js) is committed.
 *
 *   FIXTURES_DIR=<corpus> CONCERTO_ENGINE_MODULE=<concerto-engine.cjs> \
 *     node migration/fuzz/bin/run-shards.js --state results/stage2/state.json \
 *       --raw-dir <dir outside the repo> [--parallel 2]
 *
 * A new state file is created with shards run-seed 1001..1010 x 100,000
 * cases, batch size 1000, 25 seeds per op (overridable with --shards,
 * --first-seed, --count, --batch-size only when the state file doesn't exist
 * yet; an existing state file's plan is never changed).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
    const o = { state: null, rawDir: null, parallel: 2, shards: 10, firstSeed: 1001, count: 100000, batchSize: 1000, seedsPerOp: 25 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--state') { o.state = path.resolve(next()); }
        else if (a === '--raw-dir') { o.rawDir = path.resolve(next()); }
        else if (a === '--parallel') { o.parallel = Number(next()); }
        else if (a === '--shards') { o.shards = Number(next()); }
        else if (a === '--first-seed') { o.firstSeed = Number(next()); }
        else if (a === '--count') { o.count = Number(next()); }
        else if (a === '--batch-size') { o.batchSize = Number(next()); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.state || !o.rawDir) { throw new Error('--state and --raw-dir are required'); }
    if (!process.env.FIXTURES_DIR || !process.env.CONCERTO_ENGINE_MODULE) {
        throw new Error('FIXTURES_DIR and CONCERTO_ENGINE_MODULE are required');
    }
    return o;
}

function loadState(o) {
    if (fs.existsSync(o.state)) {
        return JSON.parse(fs.readFileSync(o.state, 'utf8'));
    }
    const shards = [];
    for (let i = 0; i < o.shards; i++) {
        shards.push({ shard: i + 1, runSeed: o.firstSeed + i, count: o.count, status: 'pending' });
    }
    return {
        _about: 'P5-05 stage 2 (accordproject/concerto-rust#76): resumable shard state, written by bin/run-shards.js',
        fixturesDir: process.env.FIXTURES_DIR,
        engineModule: process.env.CONCERTO_ENGINE_MODULE,
        batchSize: o.batchSize,
        seedsPerOp: o.seedsPerOp,
        shards,
    };
}

function saveState(o, state) {
    fs.mkdirSync(path.dirname(o.state), { recursive: true });
    const tmp = o.state + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(tmp, o.state);
}

function shardDir(o, s) {
    return path.join(o.rawDir, `shard-${String(s.shard).padStart(2, '0')}`);
}

function runShard(o, state, s) {
    const dir = shardDir(o, s);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['divergences.jsonl', 'expected-divergences.jsonl', 'harness-errors.jsonl', 'run.json']) {
        fs.rmSync(path.join(dir, f), { force: true });
    }
    s.status = 'running';
    s.started = new Date().toISOString();
    delete s.finished; delete s.exitCode; delete s.counts;
    saveState(o, state);
    const log = fs.openSync(path.join(dir, 'fuzz.log'), 'w');
    const child = spawn(process.execPath, [
        path.join(__dirname, 'fuzz.js'),
        '--count', String(s.count),
        '--batch-size', String(state.batchSize),
        '--seeds-per-op', String(state.seedsPerOp),
        '--run-seed', String(s.runSeed),
        '--fixtures-dir', state.fixturesDir,
        '--engine-module', state.engineModule,
        '--out', path.join(dir, 'run.json'),
        '--divergences', path.join(dir, 'divergences.jsonl'),
        '--expected', path.join(dir, 'expected-divergences.jsonl'),
        '--harness-errors', path.join(dir, 'harness-errors.jsonl'),
    ], { stdio: ['ignore', log, log] });
    s.pid = child.pid;
    saveState(o, state);
    return new Promise((resolve) => {
        child.on('close', (code) => {
            fs.closeSync(log);
            s.exitCode = code;
            s.finished = new Date().toISOString();
            delete s.pid;
            const runFile = path.join(dir, 'run.json');
            if (code === 0 && fs.existsSync(runFile)) {
                const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
                s.status = 'done';
                s.counts = {
                    ran: run.ran, agree: run.agree, divergences: run.divergences,
                    expectedDivergences: run.expectedDivergences || 0,
                    harnessErrorCases: run.harnessErrorCases,
                    harnessErrorsTs: run.harnessErrorsTs, harnessErrorsRust: run.harnessErrorsRust,
                };
            } else {
                s.status = 'failed';
            }
            saveState(o, state);
            resolve();
        });
    });
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    const state = loadState(o);
    if (state.fixturesDir !== process.env.FIXTURES_DIR || state.engineModule !== process.env.CONCERTO_ENGINE_MODULE) {
        throw new Error('FIXTURES_DIR/CONCERTO_ENGINE_MODULE differ from the state file\'s; refusing to mix engines or corpora in one run');
    }
    // A shard left `running` by a supervisor that died is restarted.
    const todo = state.shards.filter((s) => s.status !== 'done');
    saveState(o, state);
    let idx = 0;
    const lane = async () => {
        while (idx < todo.length) {
            const s = todo[idx++];
            // eslint-disable-next-line no-await-in-loop
            await runShard(o, state, s);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, o.parallel) }, lane));
    const done = state.shards.filter((s) => s.status === 'done').length;
    console.log(`run-shards: ${done}/${state.shards.length} shards done`);
    if (done !== state.shards.length) { process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exit(1); });
