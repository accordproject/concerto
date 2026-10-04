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
 * Replay the corpus against an engine and judge it.
 *
 *   TZ=UTC node bin/replay.js [--engine reference|src|<path to adapter module>]
 *       [--fixtures <dir>] [--source unit|data|conformance] [--op <op>]
 *       [--report <file.json>] [--max-failures N]
 *
 * An adapter module exports `createAdapter()` returning {name, run(op, inputs)}.
 * Exit status: 0 only when every fixture passes (no fail, no harness error).
 * A fixture whose exception message alone differs passes (task P5-09); it is
 * counted as message_only and listed under message_diffs in the report.
 */

process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const { replayCorpus } = require('../lib/judge');
const { blobStore } = require('../lib/store');

const ORACLE_DIR = path.resolve(__dirname, '..');

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { engine: 'reference', fixtures: path.join(ORACLE_DIR, 'fixtures'), source: null, op: null, report: null, maxFailures: 50 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--engine') {
            o.engine = next();
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(next());
        } else if (a === '--source') {
            o.source = next();
        } else if (a === '--op') {
            o.op = next();
        } else if (a === '--report') {
            o.report = path.resolve(next());
        } else if (a === '--max-failures') {
            o.maxFailures = Number(next());
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    return o;
}

/**
 * @param {string} engine engine name or module path
 * @returns {object} adapter
 */
function makeAdapter(engine) {
    const adapters = require('../lib/adapter');
    if (engine === 'reference') {
        return adapters.referenceAdapter();
    }
    if (engine === 'src') {
        return adapters.srcAdapter();
    }
    const mod = require(path.resolve(engine));
    return mod.createAdapter();
}

// Engines log (e.g. decorator validation warnings); keep the report readable.
const out = console.log.bind(console);
if (!process.env.ORACLE_VERBOSE) {
    for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
        console[k] = () => {};
    }
}

const opts = parseArgs(process.argv.slice(2));
const adapter = makeAdapter(opts.engine);
const store = blobStore(path.join(opts.fixtures, 'blobs'));
const filter = (f) => {
    const rel = path.relative(opts.fixtures, f).split(path.sep);
    if (opts.source && rel[0] !== opts.source) {
        return false;
    }
    if (opts.op && rel[1] !== opts.op.replace(/[^A-Za-z0-9._-]/g, '_')) {
        return false;
    }
    return true;
};
(async () => {
    const t0 = Date.now();
    const summary = await replayCorpus(opts.fixtures, adapter, store, { filter });
    summary.seconds = Math.round((Date.now() - t0) / 100) / 10;
    const allFailures = summary.failures;
    const allMessageDiffs = summary.message_diffs;
    summary.failures = allFailures.slice(0, opts.maxFailures);
    summary.failures_truncated = allFailures.length > opts.maxFailures;
    summary.message_diffs = allMessageDiffs.slice(0, opts.maxFailures);
    if (opts.report) {
        fs.mkdirSync(path.dirname(opts.report), { recursive: true });
        fs.writeFileSync(opts.report, JSON.stringify(Object.assign({}, summary, { failures: allFailures, message_diffs: allMessageDiffs }), null, 1) + '\n');
    }
    // message_only: passes whose exception message differs (P5-09: the
    // verdict compares throw/no-throw and class, not message text).
    out(`engine=${summary.engine} total=${summary.total} pass=${summary.pass} fail=${summary.fail} harness_error=${summary.harness_error} message_only=${summary.message_only} agreement=${summary.agreement_pct}% (${summary.seconds}s)`);
    for (const f of summary.failures.slice(0, 10)) {
        out(`ERROR ${f.status} ${f.op} ${f.file}: ${f.detail}`);
    }
    for (const f of summary.message_diffs.slice(0, 5)) {
        out(`info message differs (pass) ${f.op} ${f.file}: ${f.detail}`);
    }
    process.exitCode = summary.pass === summary.total && summary.total > 0 ? 0 : 1;
})().catch((e) => {
    out('ERROR replay: ' + (e && e.stack || e));
    process.exitCode = 1;
});
