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
 * Differential fuzzing driver (task P5-05, plan §2.5).
 *
 * Draws models and instances from the oracle corpus, mutates them
 * deterministically (fast-check chooses which seed fixture and which
 * mutation seed; migration/fuzz/lib/mutate.js applies it), runs each
 * mutated case through the TS reference-mode engine and the Rust/WASM
 * engine, and diffs the canonical outcome (verdict, error class, message,
 * location — everything the judge's canonicalisation covers).
 *
 * This never edits migration/oracle/, the canonical corpus or baseline.tsv,
 * and never edits packages/concerto-core/test/**. A divergence is reported
 * here (results/divergences.jsonl) with its minimised seed; fixing it, or
 * turning it into a permanent oracle fixture, is out of this task's scope
 * (coordinator comment on accordproject/concerto-rust#76).
 *
 * Usage:
 *   CONCERTO_ENGINE_MODULE=<concerto-rust>/concerto-wasm/pkg/concerto-engine.cjs \
 *   FIXTURES_DIR=<concerto>/migration/oracle/fixtures \
 *     node migration/fuzz/bin/fuzz.js --count 1000000 [--batch-size 300] [--run-seed 1]
 *         [--out results/run.json] [--divergences results/divergences.jsonl]
 */

const fs = require('fs');
const path = require('path');
const fc = require(path.join(__dirname, '..', 'node_modules', 'fast-check'));

const ORACLE_LIB = path.join(__dirname, '..', '..', 'oracle', 'lib');
const { sortedStringify } = require(path.join(ORACLE_LIB, 'canon'));
const { mutate } = require('../lib/mutate');
const { loadSeeds, withMutatedDoc, getAt } = require('../lib/seeds');
const { runBatch } = require('../lib/run-batch');

function parseArgs(argv) {
    const o = {
        count: 1000,
        batchSize: 200,
        runSeed: 1,
        out: path.join(__dirname, '..', 'results', 'run.json'),
        divergences: path.join(__dirname, '..', 'results', 'divergences.jsonl'),
        fixturesDir: process.env.FIXTURES_DIR,
        engineModule: process.env.CONCERTO_ENGINE_MODULE,
        seedsPerOp: 25,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--count') { o.count = Number(next()); }
        else if (a === '--batch-size') { o.batchSize = Number(next()); }
        else if (a === '--run-seed') { o.runSeed = Number(next()); }
        else if (a === '--out') { o.out = path.resolve(next()); }
        else if (a === '--divergences') { o.divergences = path.resolve(next()); }
        else if (a === '--fixtures-dir') { o.fixturesDir = path.resolve(next()); }
        else if (a === '--engine-module') { o.engineModule = path.resolve(next()); }
        else if (a === '--seeds-per-op') { o.seedsPerOp = Number(next()); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.fixturesDir) { throw new Error('--fixtures-dir or FIXTURES_DIR is required (the canonical corpus)'); }
    if (!o.engineModule) { throw new Error('--engine-module or CONCERTO_ENGINE_MODULE is required (built concerto-engine.cjs)'); }
    return o;
}

/**
 * Build fast-check's plan for one run: `count` (seedIndex, mutationSeed)
 * pairs, deterministic from `runSeed` (so a whole run, not just one case, is
 * reproducible).
 * @param {number} nSeeds number of loaded seeds
 * @param {number} count how many cases
 * @param {number} runSeed fast-check seed
 * @returns {Array<{seedIndex:number, mutationSeed:number}>} plan
 */
function buildPlan(nSeeds, count, runSeed) {
    const arb = fc.record({
        seedIndex: fc.nat({ max: nSeeds - 1 }),
        mutationSeed: fc.integer({ min: 0, max: 0xFFFFFFFF }),
    });
    return fc.sample(arb, { numRuns: count, seed: runSeed });
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    const seeds = loadSeeds(o.fixturesDir, o.seedsPerOp);
    if (seeds.length === 0) {
        throw new Error('no usable seed fixtures found under ' + o.fixturesDir);
    }
    console.log(`P5-05 fuzz: ${seeds.length} seed fixtures, ${o.count} cases planned, batch size ${o.batchSize}, run-seed ${o.runSeed}`);

    const plan = buildPlan(seeds.length, o.count, o.runSeed);

    fs.mkdirSync(path.dirname(o.out), { recursive: true });
    const divStream = fs.createWriteStream(o.divergences, { flags: 'a' });

    const summary = {
        started: new Date().toISOString(),
        fixturesDir: o.fixturesDir,
        engineModule: o.engineModule,
        runSeed: o.runSeed,
        planned: o.count,
        ran: 0,
        agree: 0,
        divergences: 0,
        harnessErrorsTs: 0,
        harnessErrorsRust: 0,
        byOp: {},
    };

    const env = { FIXTURES_DIR: o.fixturesDir, CONCERTO_ENGINE_MODULE: o.engineModule };

    for (let start = 0; start < plan.length; start += o.batchSize) {
        const slice = plan.slice(start, start + o.batchSize);
        const cases = slice.map((p, i) => {
            const seed = seeds[p.seedIndex];
            const doc = getAt(seed.raw.inputs, seed.path);
            const mutatedDoc = mutate(doc, p.mutationSeed);
            const inputs = withMutatedDoc(seed, mutatedDoc);
            return {
                id: `${start + i}`,
                op: seed.op,
                inputs,
                _seed: { seedFile: path.relative(o.fixturesDir, seed.file), mutationSeed: p.mutationSeed },
            };
        });
        const wireCases = cases.map(({ id, op, inputs }) => ({ id, op, inputs }));

        const [tsResults, rustResults] = await Promise.all([
            runBatch('ts', wireCases, env),
            runBatch('rust', wireCases, env),
        ]);

        for (const c of cases) {
            const t = tsResults.get(c.id);
            const r = rustResults.get(c.id);
            summary.ran++;
            const byOp = summary.byOp[c.op] || (summary.byOp[c.op] = { ran: 0, agree: 0, divergences: 0 });
            byOp.ran++;
            if (!t || !t.ok) { summary.harnessErrorsTs++; continue; }
            if (!r || !r.ok) { summary.harnessErrorsRust++; continue; }
            const same = sortedStringify(t.canon) === sortedStringify(r.canon);
            if (same) {
                summary.agree++;
                byOp.agree++;
            } else {
                summary.divergences++;
                byOp.divergences++;
                divStream.write(JSON.stringify({
                    op: c.op,
                    seedFile: c._seed.seedFile,
                    mutationSeed: c._seed.mutationSeed,
                    ts: t.canon,
                    rust: r.canon,
                }) + '\n');
            }
        }
        if ((start / o.batchSize) % 10 === 0) {
            console.log(`  ${summary.ran}/${o.count} ran, ${summary.divergences} divergence(s), ${summary.harnessErrorsTs} ts-harness-errors, ${summary.harnessErrorsRust} rust-harness-errors`);
        }
    }

    divStream.end();
    summary.finished = new Date().toISOString();
    fs.writeFileSync(o.out, JSON.stringify(summary, null, 2));
    console.log('done:', JSON.stringify(summary, null, 2));
    if (summary.divergences > 0) {
        console.log(`\n${summary.divergences} unresolved divergence(s) — see ${o.divergences}`);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
