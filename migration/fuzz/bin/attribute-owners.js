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
const OWNERS_T2_LEDGER_NOTE = 'P2-08+P4-08 (src/basemodelmanager.ts BaseModelManager.fromAst/addModelFile, src/introspect/modelfile.ts ModelFile.fromAst)';

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
        status: 'unowned: every ledger-attributed task is merged and closed, and this cluster does not match a known Serializer.fromJSON theme (the $class divergence, owned by #156, is excluded before clustering; the DV-009 DateTime shape is caught by clusterOverride) — needs its own look.',
        issue: null,
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
        status: 'owned: #144 (closed, root-cause fix) and #67 (open; its exit condition is oracle-fixture parity under CONCERTO_ENGINE=rust for addModel(s)/validate/validateAst) — see TRIAGE.md T2',
        issue: 'accordproject/concerto-rust#67',
    },
};
OWNERS['ModelManager.addModelFile'] = OWNERS['ModelManager.fromAst'];

// accordproject/concerto-rust#156's decision (comment 5837231174) covers
// "a non-string $class" as a whole, and lib/expected-divergences.js matches
// on that basis (both the TypeError crash and the array's
// TypeNotFoundException — see that file's header). Every cluster whose
// divergence *is* a non-string $class is excluded before clustering ever
// sees it, and is owned by #156 (DV-015), not by this file.
//
// The one Serializer.fromJSON cluster that survives is unrelated to $class:
// ts=ok, rust=error(ValidationException) "Expected value at path `$.t` to be
// of type `DateTime`". Reproduced and characterised (P5-05 stage-1 review
// fix #4): the mutation appends U+0000 to a valid DateTime string
// ("1970-01-01T00:00:00.000+00:00\u0000"). TS's non-strict DateTime path
// (the Serializer default, strictQualifiedDateTimes !== true) is
// dayjs.utc(string) -> new Date(string), and V8's date tokenizer reads
// U+0000 as the end of its input, so the string parses as its prefix (so
// does "...\u0000junk"; "...\u0001" is NaN on both sides). The Rust port's
// date_parse (concerto-core/src/instance/dayjs.rs) deliberately covers only
// the ECMAScript format plus the V8 extensions the corpus reaches, and
// rejects everything else — which reads like DIVERGENCES.md DV-009 (category
// `engine`), whose row already names this general outcome ("a
// ValidationException (Expected value at path … to be of type DateTime) in
// rust mode where ts mode accepts it"), though DV-009's text does not name
// the embedded-NUL shape specifically. DV-009's own example, "Nov 28 2022",
// gives the identical signature on the same seed. Not a TS bug (V8
// behaviour); possibly inside DV-009's envelope, but widening an `engine`
// row needs the reviewer's sign-off (PORTING.md 7.3), not a worker's own
// call. Per the coordinator (#76 comment 5838054200) it gets its own issue,
// which asks the plan owner to confirm DV-009 covers it (or to port V8's NUL
// rule instead): accordproject/concerto-rust#169. DIVERGENCES.md is not
// touched here pending that decision.
const OWNER_DATETIME_DV009 = {
    theme: 'T1c (Serializer.fromJSON, ts=ok / rust=ValidationException DateTime: V8 Date.parse leniency)',
    ledger: 'P3-01+P4-10 (src/serializer.ts Serializer.fromJSON, src/serializer/jsonpopulator.ts JSONPopulator.convertToObject: "type checks, integer/strict-datetime rules and messages in Rust")',
    tasks: [
        { task: 'P4-10', issue: 'accordproject/concerto-rust#69', state: 'closed', note: 'added DV-009\'s rust-mode Serializer.fromJSON leg (concerto-rust 16ab0b1)' },
    ],
    dv: 'DV-009',
    status: 'owned: new issue accordproject/concerto-rust#169 (plan-owner decision: accept under DIVERGENCES.md DV-009, or port V8\'s rule). The input is a DateTime string with an embedded NUL; V8\'s Date parser stops at U+0000 and accepts the prefix, the Rust parser rejects the whole string. DV-009\'s own example "Nov 28 2022" gives the same signature on the same seed.',
    issue: 'accordproject/concerto-rust#169',
};

/**
 * @param {object} d a divergence-shaped record ({ts, rust, ...}, same shape
 *   as a cluster's `sample`)
 * @returns {boolean} true for the ts=ok/rust=ValidationException DateTime
 *   shape DV-009 describes, false otherwise
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
        return OWNER_DATETIME_DV009;
    }
    return null;
}

/**
 * The stage-1 exit condition's per-cluster half (coordinator comment
 * 5835650999 on accordproject/concerto-rust#76): "every cluster has an owner
 * or a new issue". An owner is an owning task/issue or a documented
 * DIVERGENCES.md row (owner.status 'owned: ...'); a cluster with no owner,
 * or with an 'unowned' status and no issue filed for it, fails the check.
 * @param {object|null} owner a cluster's owner
 * @returns {boolean} true if the cluster satisfies the condition
 */
function hasOwnerOrIssue(owner) {
    if (!owner) { return false; }
    if (owner.issue) { return true; }
    return typeof owner.status === 'string' && owner.status.startsWith('owned:');
}

// Stage 2 (accordproject/concerto-rust#76 comment 5843986603): clusters in
// areas that in-flight work will change are not final — they are marked
// `pending-rerun` with that owner, and the shards are re-run once it lands.
// Keyed by owner.issue.
//
// P4-08 (#67) and P2-11b (#190), the two in-flight items the coordinator
// named, have both now landed (comment 5846093489), so this map is empty:
// nothing is pending-rerun any more in the re-run this file now attributes.
// T2's clusters (below, OWNER_T2_*) were pending-rerun on #67 in the first
// stage-2 run; the re-run (accordproject/concerto-rust#76 comment
// 5846093489, this file's `--stage2` pass against concerto-rust
// 80581e8) reproduces the same clusters at the same rate on top of #67, so
// they are new findings (#217/#218/#219), not a recurrence to re-attribute
// to the now-closed #67.
const PENDING_RERUN = {};

// Stage 2: a Serializer.fromJSON ts=ok / rust=ValidationException DateTime
// cluster whose minimised reproducer sets the DateTime field to a lone
// number (for example "-0": V8's legacy date parser reads a lone number as a
// year, so TS gets 2000-01-01; Rust's date_parse does not cover that form)
// is the case DIVERGENCES.md DV-009 (category `engine`) names explicitly —
// "a non-strict DateTime string in an uncovered legacy form (for example
// "1", which V8 reads as 2001-01-01) is a ValidationException (Expected value
// at path … to be of type DateTime) in rust mode where ts mode accepts it".
// It is documented, not unresolved, and needs no new issue. The check is on
// the actual reproducer, not the outcome alone, so any other DateTime shape
// still falls through to "unresolved".
const OWNER_DV009_LONE_NUMBER = {
    theme: 'T1d (Serializer.fromJSON, ts=ok / rust=ValidationException DateTime: a lone-number legacy date string, DIVERGENCES.md DV-009)',
    ledger: OWNER_DATETIME_DV009.ledger,
    tasks: OWNER_DATETIME_DV009.tasks,
    dv: 'DV-009',
    status: 'owned: documented divergence DIVERGENCES.md DV-009 (engine): V8\'s legacy parser reads a lone number as a year ("-0" -> 2000-01-01, the row\'s own example "1" -> 2001-01-01); the Rust port rejects any legacy form it does not cover. No new issue.',
    issue: null,
};

function isLoneNumberDateTime(cluster) {
    const m = cluster.minimized;
    if (!m || !Array.isArray(m.edits) || m.edits.length === 0) { return false; }
    return m.edits.every((e) => e.kind === 'set' && typeof e.value === 'string' && /^\s*[+-]?\d+\s*$/.test(e.value));
}

// Stage-2 re-run (accordproject/concerto-rust#76 comment 5846093489), after
// P4-08 (#67) and P2-11b (#190) both landed: every T2 cluster
// (ModelManager.fromAst/addModelFile) that was pending-rerun on #67 in the
// first stage-2 run still reproduces, at the same rate, on top of #67. That
// makes #67 the wrong owner (it's closed and didn't change this), so each
// cluster is re-attributed by outcome shape to one of three new issues filed
// from this re-run, mirroring the split the reviewer asked for on the first
// stage-2 report (comment 5844969173): "serde AST strictness", "validator-rule
// differences" and "Rust accepting inputs TS rejects" are all instances of
// the ts=ok/rust=reject and ts=reject/rust=ok split below; the third bucket
// (both reject, class/message differs) wasn't named there but is the
// remainder and gets its own issue rather than staying unattributed.
const OWNER_T2_TOO_STRICT = {
    theme: 'T2a (ModelManager.fromAst/addModelFile, ts=ok / rust=reject: Rust rejects a mutated AST TS accepts)',
    ledger: OWNERS_T2_LEDGER_NOTE,
    status: 'owned: new issue accordproject/concerto-rust#217 (not #67\'s: #67 merged and this still reproduces at the same rate). Unguarded field access in the AST/view glue, and serde AST deserialisation stricter than TS\'s untyped walk.',
    issue: 'accordproject/concerto-rust#217',
};
const OWNER_T2_TOO_PERMISSIVE = {
    theme: 'T2b (ModelManager.fromAst/addModelFile, ts=reject / rust=ok: Rust accepts a mutated AST TS rejects)',
    ledger: OWNERS_T2_LEDGER_NOTE,
    status: 'owned: new issue accordproject/concerto-rust#218 (not #67\'s: #67 merged and this still reproduces at the same rate). Rust is more permissive than TS on a handful of malformed ASTs; worth checking whether TS or Rust is at fault case by case.',
    issue: 'accordproject/concerto-rust#218',
};
const OWNER_T2_MESSAGE_MISMATCH = {
    theme: 'T2c (ModelManager.fromAst/addModelFile, both reject, class or message differs)',
    ledger: OWNERS_T2_LEDGER_NOTE,
    status: 'owned: new issue accordproject/concerto-rust#219 (not #67\'s: #67 merged and this still reproduces at the same rate). Both engines correctly refuse the model; only the exception class or message text differs.',
    issue: 'accordproject/concerto-rust#219',
};

/**
 * @param {object} cluster a results/triage-clusters.json cluster
 * @returns {object|null} the T2 stage-2 owner for this cluster's ts=ok/rust=ok
 *   outcome shape, or null if `cluster` isn't a T2 op
 */
function t2Override(cluster) {
    if (cluster.op !== 'ModelManager.fromAst' && cluster.op !== 'ModelManager.addModelFile') { return null; }
    const s = cluster.sample;
    const tsOk = s && s.ts && 'ok' in s.ts;
    const rustOk = s && s.rust && 'ok' in s.rust;
    if (tsOk && !rustOk) { return OWNER_T2_TOO_STRICT; }
    if (!tsOk && rustOk) { return OWNER_T2_TOO_PERMISSIVE; }
    return OWNER_T2_MESSAGE_MISMATCH;
}

function main() {
    const argv = process.argv.slice(2);
    const stage2 = argv.includes('--stage2');
    const file = argv.filter((a) => a !== '--stage2')[0];
    const clustersFile = file ? path.resolve(file) : CLUSTERS_FILE;
    const data = JSON.parse(fs.readFileSync(clustersFile, 'utf8'));
    let failing = 0;
    let pending = 0;
    for (const c of data.clusters) {
        // In stage 2, #169's DateTime-with-NUL case is fixed on the Rust side
        // (concerto-rust 531fdc5), so a recurrence is a new finding, not
        // #169's: don't attribute it there.
        let override = stage2 && c.op === 'Serializer.fromJSON' ? null : clusterOverride(c);
        if (stage2 && c.op === 'Serializer.fromJSON' && isDateTimeOutlier(c.sample) && isLoneNumberDateTime(c)) {
            override = OWNER_DV009_LONE_NUMBER;
        }
        if (stage2 && override === null) {
            // T2's owner in stage 2 is never the OWNERS[op] fallback (which
            // still says #67, open) — #67 has merged, so every T2 cluster is
            // re-attributed by outcome shape (see t2Override).
            override = t2Override(c);
        }
        c.owner = override || OWNERS[c.op] || null;
        if (stage2) {
            const p = c.owner && PENDING_RERUN[c.owner.issue];
            // 'documented' - a DIVERGENCES.md row covers it, no issue needed.
            // 'pending-rerun' - blocked on in-flight work named in PENDING_RERUN.
            // 'owned' - has its own issue (new or pre-existing) and isn't
            //   blocked on anything else; still an open bug, just not
            //   'unresolved' (which means no owner/issue was found at all).
            // 'unresolved' - no owner/issue: attribute-owners fails the run.
            c.status = p ? 'pending-rerun'
                : (c.owner && c.owner.dv && !c.owner.issue) ? 'documented'
                    : (c.owner && c.owner.issue) ? 'owned'
                        : 'unresolved';
            if (p) { c.pendingRerun = p; pending++; } else { delete c.pendingRerun; }
        }
        if (!hasOwnerOrIssue(c.owner)) {
            failing++;
            console.error(`attribute-owners: no owner or issue for cluster ${c.sig}`);
        }
    }
    fs.writeFileSync(clustersFile, JSON.stringify(data, null, 2));
    console.log(`attribute-owners: ${data.clusters.length} clusters, ${failing} without an owner or a new issue${stage2 ? `, ${pending} pending-rerun, ${data.clusters.filter((c) => c.status === 'documented').length} documented, ${data.clusters.filter((c) => c.status === 'owned').length} owned (new issue), ${data.clusters.filter((c) => c.status === 'unresolved').length} unresolved` : ''}`);
    if (failing) { process.exitCode = 1; }
}

main();
