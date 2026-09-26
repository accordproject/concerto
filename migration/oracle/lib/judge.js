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
 * The judge: replays fixtures against an engine adapter and compares
 * canonical outcomes (plan §2.5, §2.6).
 *
 * Verdicts:
 *   pass           canonical outcome identical to the recorded one
 *   fail           outcome differs, the engine diverged while rebuilding the
 *                  inputs' state, or the engine does not support the op
 *   harness-error  the fixture or one of its inputs is missing, unreadable or
 *                  malformed; never counted as a pass
 *
 * An adapter's run() may return a promise (async ops, task
 * accordproject/concerto-rust#94); judgeFixture() then returns a promise of
 * the verdict, and replayCorpus() awaits each fixture in turn.
 */

const fs = require('fs');
const path = require('path');
const { canonicalise, sortedStringify } = require('./canon');
const { HarnessError } = require('./codec');
const { waitPastInputInstants } = require('./env');

/**
 * All fixture files below a directory (skips the blob store).
 * @param {string} dir fixtures root
 * @returns {string[]} absolute paths, sorted
 */
function listFixtures(dir) {
    const out = [];
    const walk = (d) => {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            const st = fs.statSync(p);
            if (st.isDirectory()) {
                if (f !== 'blobs') {
                    walk(p);
                }
            } else if (f.endsWith('.json') && f !== 'manifest.json') {
                out.push(p);
            }
        }
    };
    walk(dir);
    return out.sort();
}

/**
 * First differing path between two JSON values (for reports).
 * @param {*} a expected
 * @param {*} b actual
 * @param {string} [p] path so far
 * @returns {string|null} description
 */
function firstDiff(a, b, p = '$') {
    if (sortedStringify(a) === sortedStringify(b)) {
        return null;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of [...keys].sort()) {
            const d = firstDiff(a[k], b[k], `${p}.${k}`);
            if (d) {
                return d;
            }
        }
    }
    const show = (x) => {
        const s = JSON.stringify(x);
        return s === undefined ? 'undefined' : (s.length > 200 ? s.slice(0, 200) + '…' : s);
    };
    return `${p}: expected ${show(a)} got ${show(b)}`;
}

/**
 * Judge one fixture file.
 * @param {string} file fixture path
 * @param {object} adapter engine adapter
 * @param {object} store blob store
 * @returns {object|Promise<object>} verdict {status, op, source, detail?}
 */
function judgeFile(file, adapter, store) {
    let fx;
    try {
        fx = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return { status: 'harness-error', op: null, source: null, detail: 'unreadable fixture: ' + e.message };
    }
    return judgeFixture(fx, adapter, store);
}

/**
 * Judge one parsed fixture.
 * @param {object} fx fixture
 * @param {object} adapter engine adapter
 * @param {object} store blob store
 * @returns {object|Promise<object>} verdict (a promise when the op is async)
 */
function judgeFixture(fx, adapter, store) {
    const base = { op: fx && fx.op || null, source: fx && fx.source || null, id: fx && fx.id || null };
    if (!fx || typeof fx.op !== 'string' || !fx.inputs || typeof fx.inputs !== 'object' || !fx.outcome || typeof fx.outcome !== 'object') {
        return Object.assign(base, { status: 'harness-error', detail: 'malformed fixture' });
    }
    let inputs;
    let expected;
    let facts;
    try {
        inputs = store.unpack(fx.inputs);
        expected = store.unpack(fx.outcome);
        facts = store.facts(fx.inputs);
    } catch (e) {
        return Object.assign(base, { status: 'harness-error', detail: e.message });
    }
    if (!inputs || typeof inputs !== 'object' || !expected || typeof expected !== 'object' ||
        (!('ok' in expected) && !('error' in expected))) {
        return Object.assign(base, { status: 'harness-error', detail: 'malformed fixture (resolved)' });
    }
    waitPastInputInstants(facts);
    let res;
    const start = Date.now();
    const runFailed = (e) => {
        if (e instanceof HarnessError || (e && e.name === 'HarnessError')) {
            return Object.assign(base, { status: 'harness-error', detail: e.message });
        }
        if (e && e.divergence) {
            return Object.assign(base, { status: 'fail', detail: e.message });
        }
        if (e && e.unsupported) {
            return Object.assign(base, { status: 'fail', detail: 'unsupported op: ' + e.message });
        }
        return Object.assign(base, { status: 'fail', detail: 'input construction failed: ' + (e && e.constructor ? e.constructor.name : '') + ': ' + (e && e.message) });
    };
    try {
        res = adapter.run(fx.op, inputs);
    } catch (e) {
        return runFailed(e);
    }
    if (res && typeof res.then === 'function') {
        return Promise.resolve(res).then(
            (r) => verdictOf(base, r, start, Date.now(), expected, facts),
            runFailed);
    }
    return verdictOf(base, res, start, Date.now(), expected, facts);
}

/**
 * Compare an adapter's result with the recorded outcome.
 * @param {object} base verdict fields {op, source, id}
 * @param {object} res adapter result {outcome, window?} or a bare outcome
 * @param {number} start ms before run()
 * @param {number} end ms after run() (or after its promise settled)
 * @param {object} expected recorded outcome (blobs resolved)
 * @param {object} facts facts of the fixture inputs
 * @returns {object} verdict
 */
function verdictOf(base, res, start, end, expected, facts) {
    const outcome = res && res.outcome ? res.outcome : res;
    const window = res && res.window ? res.window : { start, end };
    let actual;
    try {
        actual = canonicalise(JSON.parse(JSON.stringify(outcome)), facts, window);
    } catch (e) {
        return Object.assign(base, { status: 'fail', detail: 'outcome not canonicalisable: ' + e.message });
    }
    const expectedCanon = canonicalise(expected, facts, null);
    if (sortedStringify(actual) === sortedStringify(expectedCanon)) {
        return Object.assign(base, { status: 'pass' });
    }
    return Object.assign(base, { status: 'fail', detail: firstDiff(expectedCanon, actual) });
}

/**
 * Replay a whole corpus.
 * @param {string} fixturesDir corpus root
 * @param {object} adapter engine adapter
 * @param {object} store blob store
 * @param {object} [opts] {filter: fn(file) -> bool, onVerdict}
 * @returns {Promise<object>} summary
 */
async function replayCorpus(fixturesDir, adapter, store, opts = {}) {
    const files = listFixtures(fixturesDir).filter(opts.filter || (() => true));
    const summary = { engine: adapter.name, total: 0, pass: 0, fail: 0, harness_error: 0, by_source: {}, by_op: {}, failures: [] };
    for (const f of files) {
        let v = judgeFile(f, adapter, store);
        if (v && typeof v.then === 'function') {
            v = await v;
        }
        summary.total++;
        const key = v.status === 'harness-error' ? 'harness_error' : v.status;
        summary[key]++;
        const src = v.source || path.relative(fixturesDir, f).split(path.sep)[0];
        for (const [bucket, k] of [[summary.by_source, src], [summary.by_op, v.op || '?']]) {
            bucket[k] = bucket[k] || { total: 0, pass: 0, fail: 0, harness_error: 0 };
            bucket[k].total++;
            bucket[k][key]++;
        }
        if (v.status !== 'pass') {
            summary.failures.push({ file: path.relative(fixturesDir, f), status: v.status, op: v.op, detail: v.detail });
        }
        if (opts.onVerdict) {
            opts.onVerdict(v, f);
        }
    }
    summary.agreement_pct = summary.total === 0 ? 0 : Math.round((summary.pass / summary.total) * 1e6) / 1e4;
    return summary;
}

module.exports = { listFixtures, judgeFile, judgeFixture, replayCorpus, firstDiff };
