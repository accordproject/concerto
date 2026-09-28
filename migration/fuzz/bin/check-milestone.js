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
 * Milestone fuzz check (task P2, accordproject/concerto-rust#307; rescoped
 * from a nightly schedule to a coordinator-dispatched, milestone-end check
 * by the maintainer's 2026-09-28 comment on that issue): decide pass/fail
 * for one shard.
 *
 * bin/fuzz.js's own `divergences` count already excludes every
 * maintainer-accepted, permanent divergence in lib/expected-divergences.js
 * (the DV-* rows). That alone is not enough to gate this check on, though:
 * this migration's differential fuzzing has also found a long tail of
 * divergences that are real engine gaps, each already tracked by its own
 * issue (see migration/fuzz/results/stage2/triage-clusters.json's `owners`),
 * but not yet fixed and not a "permanent, accepted" divergence in the DV-*
 * sense — fixing them is other tasks' work, not this job's. Gating on
 * `divergences > 0` directly would make the job fail on every dispatch for
 * already-known reasons, which defeats its purpose as a safety net for
 * something NEW breaking between milestones.
 *
 * So this script clusters this run's unresolved divergences by signature
 * (lib/signature.js, the same function bin/triage.js uses) and fails only on
 * a cluster signature that is not already in the committed baseline
 * (results/milestone-baseline/known-clusters.json): a divergence *shape*
 * nobody has seen and attributed yet. A new *case* of an already-known
 * cluster (same signature, different seed/mutation) is not new and does not
 * fail the job.
 *
 * Usage:
 *   node migration/fuzz/bin/check-milestone.js \
 *     --divergences results/milestone/divergences.jsonl \
 *     --baseline results/milestone-baseline/known-clusters.json \
 *     --out results/milestone/triage-clusters.json
 *
 * Exits 0 and prints a one-line summary when every one of this run's
 * clusters is already known; exits 1 and lists the new cluster(s) otherwise.
 *
 * Run health (review fix, task P2 accordproject/concerto-rust#307): a
 * missing or broken input must never read as success. `loadDivergences()`
 * returning `[]` for a missing `divergences.jsonl` is fine on its own — an
 * empty `divergences.jsonl` is exactly what a real, healthy, zero-divergence
 * run produces (bin/fuzz.js's `fs.createWriteStream(..., {flags:'a'})`
 * creates the file unconditionally, even when nothing is ever written to
 * it) — but it is indistinguishable from a run that never meaningfully
 * exercised the engines at all: if the Rust engine fails to load, or throws
 * on every case, `bin/fuzz.js` still exits 0 (every case is classified
 * `'harness'` by `lib/classify.js`, not `'divergence'`), so `divergences`
 * stays empty for the wrong reason. `bin/fuzz.js` already records exactly
 * the counts needed to tell the two apart in its `--out` summary
 * (`run.json`'s `ran`/`planned`/`harnessErrorCases`), so `checkRunHealth()`
 * reads that file (the sibling of `--divergences`, where the milestone
 * workflow always writes it) and fails the check when it looks broken
 * rather than clean, before cluster comparison even runs. In the two
 * historical reference runs recorded under `results/` (run-42, run
 * `p5-10c`/`p5-10d`), `harnessErrorCases` was 0 of `ran`; the default
 * threshold below (5%) leaves comfortable headroom above that for
 * incidental harness noise while still catching a broken engine outright
 * (which fails at, or close to, 100%).
 *
 * When `run.json` is absent entirely, the check is skipped (not failed) so
 * the README's "verifying a real failure locally" walkthrough — which
 * copies just `divergences.jsonl`, not a matching `run.json` — keeps
 * working. In CI, `bin/fuzz.js` always writes `run.json` when it reaches
 * the end of its run (the one case where it does not — an uncaught
 * exception mid-run — already exits non-zero itself, which already fails
 * the "Run the fuzz shard" step and therefore the job, independent of this
 * script).
 *
 * Usage:
 *   node migration/fuzz/bin/check-milestone.js \
 *     --divergences results/milestone/divergences.jsonl \
 *     --baseline results/milestone-baseline/known-clusters.json \
 *     --out results/milestone/triage-clusters.json \
 *     [--max-harness-error-ratio 0.05]
 *
 * Exits 0 and prints a one-line summary when the run looks healthy and
 * every one of this run's clusters is already known; exits 1 and lists the
 * new cluster(s), or explains the run-health failure, otherwise.
 */

const fs = require('fs');
const path = require('path');
const { signatureOf } = require('../lib/signature');
const { expectedDivergence } = require('../lib/expected-divergences');

const DEFAULT_MAX_HARNESS_ERROR_RATIO = 0.05;

function parseArgs(argv) {
    const o = { divergences: null, baseline: null, out: null, maxHarnessErrorRatio: DEFAULT_MAX_HARNESS_ERROR_RATIO };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--divergences') { o.divergences = path.resolve(next()); }
        else if (a === '--baseline') { o.baseline = path.resolve(next()); }
        else if (a === '--out') { o.out = path.resolve(next()); }
        else if (a === '--max-harness-error-ratio') { o.maxHarnessErrorRatio = Number(next()); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.divergences || !o.baseline || !o.out) {
        throw new Error('--divergences, --baseline and --out are all required');
    }
    return o;
}

function loadDivergences(file) {
    if (!fs.existsSync(file)) { return []; }
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/**
 * @param {string} divergencesFile the --divergences path; run.json is its sibling
 * @param {number} maxHarnessErrorRatio fail when harnessErrorCases/ran exceeds this
 * @returns {object|null} null when run.json is absent (skip); otherwise
 *   {ok, reason, planned, ran, harnessErrorCases, harnessErrorRatio}
 */
function checkRunHealth(divergencesFile, maxHarnessErrorRatio) {
    const runFile = path.join(path.dirname(divergencesFile), 'run.json');
    if (!fs.existsSync(runFile)) { return null; }
    const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
    const { planned, ran, harnessErrorCases } = run;
    const stats = { planned, ran, harnessErrorCases, harnessErrorRatio: ran > 0 ? harnessErrorCases / ran : null };
    if (!(ran > 0)) {
        return { ok: false, reason: `0 of ${planned} planned case(s) ran (see ${path.relative(process.cwd(), runFile)})`, ...stats };
    }
    if (ran !== planned) {
        return { ok: false, reason: `only ${ran} of ${planned} planned case(s) ran — the shard did not finish`, ...stats };
    }
    if (stats.harnessErrorRatio > maxHarnessErrorRatio) {
        return {
            ok: false,
            reason: `${harnessErrorCases} of ${ran} case(s) (${(stats.harnessErrorRatio * 100).toFixed(1)}%) hit a harness `
                + `error — above the ${(maxHarnessErrorRatio * 100).toFixed(1)}% threshold, so this looks like a broken engine `
                + 'or harness (e.g. the Rust engine failed to load) rather than a clean run with nothing to report',
            ...stats,
        };
    }
    return { ok: true, reason: null, ...stats };
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const baseline = JSON.parse(fs.readFileSync(o.baseline, 'utf8'));
    const known = new Set(baseline.signatures);

    const runHealth = checkRunHealth(o.divergences, o.maxHarnessErrorRatio);

    // bin/fuzz.js already excluded expected-divergences.js matches from
    // divergences.jsonl; re-checking here is cheap insurance against a stale
    // file from an older harness version that did not.
    const divergences = loadDivergences(o.divergences).filter((d) => !expectedDivergence(d));

    const clusters = new Map();
    for (const d of divergences) {
        const sig = signatureOf(d);
        if (!clusters.has(sig)) {
            clusters.set(sig, { sig, op: d.op, count: 0, isNew: !known.has(sig), sample: d });
        }
        clusters.get(sig).count++;
    }
    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count);
    const newClusters = sorted.filter((c) => c.isNew);

    const report = {
        _generatedBy: 'migration/fuzz/bin/check-milestone.js; do not edit by hand',
        baselineFile: path.relative(process.cwd(), o.baseline),
        baselineClusterCount: known.size,
        totalDivergences: divergences.length,
        clusterCount: sorted.length,
        newClusterCount: newClusters.length,
        runHealth,
        clusters: sorted,
    };
    fs.mkdirSync(path.dirname(o.out), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(report, null, 2));

    console.log(`${divergences.length} unresolved divergence(s) in ${sorted.length} cluster(s); `
        + `${sorted.length - newClusters.length} already known (baseline: ${known.size} cluster signature(s)), `
        + `${newClusters.length} new.`);
    if (runHealth) {
        console.log(runHealth.ok
            ? `run health: ok (${runHealth.ran}/${runHealth.planned} ran, ${runHealth.harnessErrorCases} harness error(s))`
            : `run health: BROKEN — ${runHealth.reason}`);
    }
    if (newClusters.length > 0) {
        console.log('\nNew cluster(s):');
        for (const c of newClusters) {
            console.log(`  [${c.count}x] ${c.sig}`);
        }
    }
    if (runHealth && !runHealth.ok) {
        console.error(`\nrun looks broken, not clean — refusing to treat ${divergences.length} divergence(s) as a `
            + `meaningful result: ${runHealth.reason} — see ${o.out}`);
        process.exit(1);
    }
    if (newClusters.length > 0) {
        console.error(`\n${newClusters.length} new divergence cluster(s) not in the baseline — see ${o.out}`);
        process.exit(1);
    }
}

main();
