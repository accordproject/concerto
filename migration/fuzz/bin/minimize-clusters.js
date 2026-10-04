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
 * Minimise each cluster's sample divergence to the smallest edit-set that
 * still reproduces the same cluster signature (task P5-05 stage-1 review
 * fix: the coordinator asked for "one minimised seed per cluster",
 * accordproject/concerto-rust#76 comment 5835650999).
 *
 * A cluster's `sample` in results/triage-clusters.json is just the first
 * divergence bin/triage.js happened to see for that signature, replayed
 * from {seedFile, mutationSeed} — that seed applies 1-4 generic JSON edits
 * (lib/mutate.js), and none of them were ever checked for necessity.
 *
 * This tool re-derives the edit trace mutateTraced() recorded for that
 * (seedFile, mutationSeed) pair, then runs ddmin over it: repeatedly try
 * dropping one edit, replay the remainder through both engines, and keep
 * the drop only if the resulting divergence still canonicalises to the
 * *same* cluster signature (lib/signature.js — the same function
 * bin/triage.js clusters with). The result is a `minimized` field per
 * cluster: the smallest edit list found (almost always 1 edit, since most
 * clusters' sample already needed only one), expressed as engine-agnostic
 * {kind, path, value?, index?} operations (lib/mutate.js's applyEdits()),
 * so it replays without needing fast-check, a run-seed or the PRNG at all.
 *
 * Usage:
 *   CONCERTO_ENGINE_MODULE=<concerto-rust>/concerto-wasm/pkg/concerto-engine.cjs \
 *   FIXTURES_DIR=<concerto>/migration/oracle/fixtures \
 *     node migration/fuzz/bin/minimize-clusters.js \
 *       [results/triage-clusters.json] [--out results/triage-clusters.json]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const { mutateTraced, applyEdits } = require('../lib/mutate');
const { getAt, withMutatedDoc, TARGETS } = require('../lib/seeds');
const { signatureOf } = require('../lib/signature');

function parseArgs(argv) {
    const o = {
        clustersFile: path.join(__dirname, '..', 'results', 'triage-clusters.json'),
        out: null,
        fixturesDir: process.env.FIXTURES_DIR,
        engineModule: process.env.CONCERTO_ENGINE_MODULE,
    };
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--out') { o.out = path.resolve(argv[++i]); }
        else { rest.push(argv[i]); }
    }
    if (rest[0]) { o.clustersFile = path.resolve(rest[0]); }
    if (!o.out) { o.out = o.clustersFile; }
    if (!o.fixturesDir) { throw new Error('--fixtures-dir via FIXTURES_DIR is required (the canonical corpus)'); }
    if (!o.engineModule) { throw new Error('CONCERTO_ENGINE_MODULE is required (built concerto-engine.cjs)'); }
    return o;
}

/**
 * A persistent lib/worker.js child, so many verifications reuse the same
 * loaded engine instead of paying WASM/ts-node start-up per case.
 * @param {string} engine "ts" | "rust"
 * @param {object} env {FIXTURES_DIR, CONCERTO_ENGINE_MODULE?}
 * @returns {{run: Function, close: Function}} handle
 */
function startWorker(engine, env) {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'lib', 'worker.js')], {
        env: Object.assign({}, process.env, env, { ENGINE: engine }),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    const pending = new Map();
    let nextId = 0;
    const rl = readline.createInterface({ input: child.stdout, terminal: false });
    rl.on('line', (line) => {
        if (!line.trim()) { return; }
        let r;
        try { r = JSON.parse(line); } catch (e) { return; }
        const p = pending.get(r.id);
        if (p) { pending.delete(r.id); p.resolve(r); }
    });
    child.on('exit', (code) => {
        for (const p of pending.values()) { p.reject(new Error(`${engine} worker exited ${code}: ${stderr.slice(-2000)}`)); }
        pending.clear();
    });
    return {
        run(op, inputs) {
            const id = String(nextId++);
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                child.stdin.write(JSON.stringify({ id, op, inputs }) + '\n');
            });
        },
        close() { child.stdin.end(); },
    };
}

/**
 * @param {object} worker ts or rust worker handle
 * @param {string} op op name
 * @param {*} inputs raw @@oracle-encoded inputs
 * @returns {Promise<object>} canonical outcome shaped like a divergence's ts/rust field, or null on a harness error
 */
async function canonOutcome(worker, op, inputs) {
    const r = await worker.run(op, inputs);
    if (!r.ok) { return null; }
    return r.canon;
}

/**
 * @param {object} cluster one results/triage-clusters.json cluster
 * @param {Map<string,object>} fixtureCache seedFile -> parsed fixture JSON
 * @param {string} fixturesDir corpus root
 * @param {object} tsWorker
 * @param {object} rustWorker
 * @returns {Promise<object|null>} {edits, doc} for the smallest reproducing subset, or null if the sample itself no longer reproduces (stale run)
 */
async function minimizeCluster(cluster, fixtureCache, fixturesDir, tsWorker, rustWorker) {
    const sample = cluster.sample;
    const target = TARGETS.find((t) => t.op === sample.op);
    if (!target) { return null; }
    let fixture = fixtureCache.get(sample.seedFile);
    if (!fixture) {
        fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, sample.seedFile), 'utf8'));
        fixtureCache.set(sample.seedFile, fixture);
    }
    const baseDoc = getAt(fixture.inputs, target.path);
    if (baseDoc == null || typeof baseDoc !== 'object') { return null; }
    const seedLike = { raw: fixture, path: target.path };
    const { edits: fullEdits } = mutateTraced(baseDoc, sample.mutationSeed);

    const test = async (edits) => {
        const mutatedDoc = applyEdits(baseDoc, edits);
        const inputs = withMutatedDoc(seedLike, mutatedDoc);
        const [ts, rust] = await Promise.all([
            canonOutcome(tsWorker, sample.op, inputs),
            canonOutcome(rustWorker, sample.op, inputs),
        ]);
        if (ts == null || rust == null) { return false; } // harness error, not a comparable divergence
        const div = { op: sample.op, ts, rust };
        return signatureOf(div) === cluster.sig;
    };

    if (!(await test(fullEdits))) {
        return null; // the recorded sample no longer reproduces (stale corpus/engine state) — leave the cluster unminimised, flagged below
    }

    let current = fullEdits.slice();
    let changedInRound = true;
    while (changedInRound && current.length > 1) {
        changedInRound = false;
        for (let i = current.length - 1; i >= 0; i--) {
            const candidate = current.slice(0, i).concat(current.slice(i + 1));
            // eslint-disable-next-line no-await-in-loop
            if (await test(candidate)) {
                current = candidate;
                changedInRound = true;
            }
        }
    }
    return { edits: current, doc: applyEdits(baseDoc, current) };
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    const data = JSON.parse(fs.readFileSync(o.clustersFile, 'utf8'));
    const env = { FIXTURES_DIR: o.fixturesDir, CONCERTO_ENGINE_MODULE: o.engineModule };
    const tsWorker = startWorker('ts', env);
    const rustWorker = startWorker('rust', env);
    const fixtureCache = new Map();

    const loadFixture = (seedFile) => {
        let f = fixtureCache.get(seedFile);
        if (!f) {
            f = JSON.parse(fs.readFileSync(path.join(o.fixturesDir, seedFile), 'utf8'));
            fixtureCache.set(seedFile, f);
        }
        return f;
    };

    let minimized = 0;
    let staleCount = 0;
    let reducedCount = 0;
    for (const cluster of data.clusters) {
        const target = TARGETS.find((t) => t.op === cluster.sample.op);
        const originalCount = target
            ? mutateTraced(getAt(loadFixture(cluster.sample.seedFile).inputs, target.path), cluster.sample.mutationSeed).edits.length
            : 0;
        // eslint-disable-next-line no-await-in-loop
        const result = await minimizeCluster(cluster, fixtureCache, o.fixturesDir, tsWorker, rustWorker);
        if (!result) {
            cluster.minimized = { stale: true, originalEditCount: originalCount };
            staleCount++;
            continue;
        }
        cluster.minimized = {
            editCount: result.edits.length,
            originalEditCount: originalCount,
            edits: result.edits,
            seedFile: cluster.sample.seedFile,
            doc: result.doc,
        };
        minimized++;
        if (result.edits.length < originalCount) { reducedCount++; }
    }
    tsWorker.close();
    rustWorker.close();

    fs.writeFileSync(o.out, JSON.stringify(data, null, 2));
    console.log(`minimize-clusters: ${minimized}/${data.clusters.length} clusters minimised (${reducedCount} shrunk below their sample's original edit count), ${staleCount} stale (sample no longer reproduces the cluster's signature)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
