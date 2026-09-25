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
const { expectedDivergence } = require('../lib/expected-divergences');

const CLUSTERS_FILE = path.join(__dirname, '..', 'results', 'triage-clusters.json');

// Resolved 2026-09-25 against accordproject/concerto-rust (see comment
// above); update this table, not the ledger, if a task's issue number
// changes or a new split lands.
const OWNERS = {
    'Serializer.fromJSON': {
        theme: 'T1',
        ledger: 'P2-01+P4-03 (src/modelutil.ts ModelUtil.getShortName/getNamespace), P3-01+P4-10 (src/serializer.ts Serializer.fromJSON fast path)',
        tasks: [
            { task: 'P2-01', issue: 'accordproject/concerto-rust#45', state: 'closed' },
            { task: 'P4-03', issue: 'accordproject/concerto-rust#62', state: 'closed' },
            { task: 'P3-01a', issue: 'accordproject/concerto-rust#56', state: 'closed' },
            { task: 'P4-10', issue: 'accordproject/concerto-rust#69', state: 'closed' },
        ],
        // Partially resolved (2026-09-25): accordproject/concerto-rust#156 (DV-015)
        // only covers the narrow TS `TypeError: fqn.lastIndexOf is not a function`
        // signature (a non-string `$class`, e.g. `true`) — 7 of T1's 98 clusters,
        // 1,694 of 2,754 divergences. #156's own issue text says the sibling case,
        // where `$class` *is* a string but names no real type (TS raises
        // `TypeNotFoundException: Namespace is not defined for type "…"` instead of
        // the `TypeError`), is "unaffected by this issue" — the maintainer's DV-015
        // decision does not extend to it. lib/expected-divergences.js matches only
        // the TypeError/lastIndexOf pair, so this file falls through to the
        // per-cluster check in main() below (via expectedDivergence()) rather than a
        // single status for every Serializer.fromJSON cluster: a cluster whose
        // sample matches DV-015 is marked resolved; every other Serializer.fromJSON
        // cluster (91 clusters, 1,060 divergences — 90 TypeNotFoundException
        // clusters plus 1 unrelated ValidationException cluster) keeps the status
        // below, since every ledger-attributed task above is merged and closed.
        status: 'unowned: every ledger-attributed task is merged and closed, and accordproject/concerto-rust#156 (DV-015) does not cover this signature (only the TS TypeError/lastIndexOf case is maintainer-accepted) — a new follow-up issue/decision is needed. See TRIAGE.md T1.',
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

// A cluster resolved by lib/expected-divergences.js (accordproject/
// concerto-rust#156, DV-015) gets this owner instead of OWNERS[c.op] — see
// the long comment on OWNERS['Serializer.fromJSON'] above for why the two
// are not the same thing for this op.
const DV015_OWNER = {
    theme: 'T1',
    status: 'resolved via accordproject/concerto-rust#156 (DV-015): maintainer-accepted, documented divergence — excluded by bin/fuzz.js/bin/triage.js as an expected divergence, not an unowned cluster.',
};

function main() {
    const data = JSON.parse(fs.readFileSync(CLUSTERS_FILE, 'utf8'));
    let unowned = 0;
    for (const c of data.clusters) {
        c.owner = expectedDivergence(c.sample) ? DV015_OWNER : (OWNERS[c.op] || null);
        if (!c.owner) { unowned++; }
    }
    fs.writeFileSync(CLUSTERS_FILE, JSON.stringify(data, null, 2));
    console.log(`attribute-owners: ${data.clusters.length} clusters, ${unowned} with no ledger mapping for their op`);
    if (unowned) { process.exitCode = 1; }
}

main();
