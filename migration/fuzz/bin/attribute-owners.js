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
 * Attribute an owner to each cluster in results/triage-clusters.json,
 * through migration/ledger/SEAM_LEDGER.tsv (task P5-05 stage-1 review fix:
 * the coordinator asked to "attribute an owner through the ledger", and to
 * flag clusters owned by open tasks P2-08b #129, P2-08c #144, P4-08 #67 —
 * accordproject/concerto-rust#76 comment 5835650999).
 *
 * The mapping from a fuzzed op to its ledger row(s) is read from the
 * ledger's own `member`/`planned_task` columns (see TRIAGE.md for the exact
 * rows), not guessed: every op this harness fuzzes has exactly one or two
 * ledger rows naming its entry point (`Serializer.fromJSON`,
 * `ModelUtil.getShortName`/`getNamespace` for T1; `BaseModelManager.fromAst`
 * /`addModelFile`, `ModelFile.fromAst` for T2). The planned_task -> GitHub
 * issue table below was resolved by hand against accordproject/concerto-rust
 * (search_issues by "P<n> ... in:title"), since the ledger itself only
 * records the task ID, not the issue number.
 *
 * This never edits the ledger or the corpus — it only reads them and writes
 * results/triage-clusters.json's own `owner` field.
 */

const fs = require('fs');
const path = require('path');

const CLUSTERS_FILE = path.join(__dirname, '..', 'results', 'triage-clusters.json');

// Resolved 2026-09-25 against accordproject/concerto-rust (see comment
// above); update this table, not the ledger, if a task's issue number
// changes or a new split lands.
const OWNERS = {
    // Serializer.fromJSON has two DIFFERENT ledger-unowned themes, not one —
    // see below. This entry is the fallback for a cluster this file's
    // per-cluster rules (below) don't specifically recognise.
    'Serializer.fromJSON': {
        theme: 'T1 (unclassified)',
        ledger: 'P2-01+P4-03 (src/modelutil.ts ModelUtil.getShortName/getNamespace), P3-01+P4-10 (src/serializer.ts Serializer.fromJSON fast path)',
        tasks: [
            { task: 'P2-01', issue: 'accordproject/concerto-rust#45', state: 'closed' },
            { task: 'P4-03', issue: 'accordproject/concerto-rust#62', state: 'closed' },
            { task: 'P3-01a', issue: 'accordproject/concerto-rust#56', state: 'closed' },
            { task: 'P4-10', issue: 'accordproject/concerto-rust#69', state: 'closed' },
        ],
        status: 'unowned: every ledger-attributed task is merged and closed, and this cluster does not match a known Serializer.fromJSON theme (the $class divergence, owned by #156, is excluded before clustering; the DateTime outlier is caught by clusterOverride) — needs its own look.',
    },
    'ModelManager.fromAst': {
        theme: 'T2',
        ledger: 'P2-08+P4-08 (src/basemodelmanager.ts BaseModelManager.fromAst/addModelFile, src/introspect/modelfile.ts ModelFile.fromAst)',
        tasks: [
            { task: 'P2-08', issue: 'accordproject/concerto-rust#52', state: 'closed' },
            {
                task: 'P2-08b', issue: 'accordproject/concerto-rust#129', state: 'closed',
                note: 'scope was validateModelFile/updateModelFile/deleteModelFile, getModels, filter, resolveType, derivesFrom — does not cover fromAst/addModelFile',
            },
            {
                task: 'P2-08c', issue: 'accordproject/concerto-rust#144', state: 'closed',
                note: 'root-cause fix for introspect/property.rs, scalar.rs, model_file.rs, validation.rs — the exact files this theme\'s stack traces name; not reverified against these fuzz-found clusters',
            },
            {
                task: 'P4-08', issue: 'accordproject/concerto-rust#67', state: 'open',
                note: 'view-layer wiring for addModel(s)/validate/validateAst; depends on P2-08c',
            },
        ],
        status: 'owned: #144 (closed, root-cause fix, unverified against these exact clusters) and #67 (open, view wiring) — see TRIAGE.md T2',
    },
};
OWNERS['ModelManager.addModelFile'] = OWNERS['ModelManager.fromAst'];

// accordproject/concerto-rust#156's decision (comment 5837231174) covers
// "a non-string $class" as a whole, and lib/expected-divergences.js now
// matches on that basis (both the TypeError crash and the array's
// TypeNotFoundException — see that file's header). So every T1 cluster
// whose divergence *is* a non-string $class — crash or not — is excluded
// before clustering ever sees it, and is owned by #156, not by this file.
//
// accordproject/concerto-rust#160 was filed for what looked, before that
// widening, like a second theme, but turned out to be two different
// things folded together by the original per-op triage: (a) the
// array/object $class cases, which the widened #156 match now covers, and
// (b) one genuinely unrelated cluster — ts=ok on TS, `rust=error
// (ValidationException)` on a DateTime field — that has nothing to do with
// `$class` at all. That cluster must NOT be attributed to #160 (an issue
// about the $class decision) just because it happens to share the
// `Serializer.fromJSON` op; #160's own body already flags it as needing
// "its own look", not as resolved by #160's ask. It is a real Rust
// correctness gap (Rust rejects a document TS accepts) and stays unowned
// here until it gets its own issue.
const OWNER_DATETIME_OUTLIER = {
    theme: 'T1c (Serializer.fromJSON, ts=ok / rust=ValidationException DateTime outlier)',
    ledger: 'unrelated to $class; not covered by #156 or #160',
    tasks: [],
    status: 'unowned: a genuine Rust correctness gap (Rust rejects a document TS accepts), mistakenly folded into the $class theme by the original per-op triage. Noted, not resolved, in accordproject/concerto-rust#160\'s body. Needs its own issue — do not attribute to #156 or #160.',
    issue: null,
};

/**
 * @param {object} d a divergence-shaped record ({ts, rust, ...}, same shape
 *   as a cluster's `sample`)
 * @returns {boolean} true for the one known ts=ok/rust=ValidationException
 *   DateTime outlier shape, false otherwise
 */
function isDateTimeOutlier(d) {
    const t = d && d.ts;
    const r = d && d.rust && d.rust.error;
    if (!t || !('ok' in t)) { return false; }
    if (!r || r.class !== 'ValidationException') { return false; }
    return typeof r.message === 'string' && r.message.includes('DateTime');
}

/**
 * Per-cluster override, so a single per-op OWNERS entry can't silently
 * conflate two different bugs that happen to share an op
 * (accordproject/concerto-rust#76 review: "assign owners per cluster
 * rather than per op where they differ"). Clusters whose divergence is a
 * non-string $class (crash or array/object) never reach this file at all —
 * bin/fuzz.js / bin/triage.js exclude them via lib/expected-divergences.js
 * before clustering, and they are owned by #156. This only recognises the
 * one cluster shape that is NOT a $class divergence; every other cluster
 * falls back to OWNERS[op].
 * @param {object} cluster a results/triage-clusters.json cluster
 * @returns {object|null} an owner override, or null to fall back to OWNERS[op]
 */
function clusterOverride(cluster) {
    if (cluster.op === 'Serializer.fromJSON' && isDateTimeOutlier(cluster.sample)) {
        return OWNER_DATETIME_OUTLIER;
    }
    return null;
}

function main() {
    const data = JSON.parse(fs.readFileSync(CLUSTERS_FILE, 'utf8'));
    let unowned = 0;
    for (const c of data.clusters) {
        c.owner = clusterOverride(c) || OWNERS[c.op] || null;
        if (!c.owner) { unowned++; }
    }
    fs.writeFileSync(CLUSTERS_FILE, JSON.stringify(data, null, 2));
    console.log(`attribute-owners: ${data.clusters.length} clusters, ${unowned} with no ledger mapping for their op`);
    if (unowned) { process.exitCode = 1; }
}

main();
