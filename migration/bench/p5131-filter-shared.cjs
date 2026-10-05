#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): what one `filter(() => true)` of
// each set's base manager does with each file, as p597-server.mjs's
// approach (b) runs it. Measure only.
//
//   node migration/bench/p5131-filter-shared.cjs <concerto-core dist> [--json]
//
// The engine's `modelFileFilterStaged` answers, per file, with one of:
//   `stage`   the unchanged file, shared into the new manager (no AST);
//   `staged`  a filtered file the engine staged in the new manager
//             (P5-125's item 6; not on heads before it);
//   `ast`     the file's AST, which TS re-stages through `new ModelFile`.
// The binding is wrapped on the base manager's handle and the answers are
// counted. Run it with CONCERTO_ENGINE_MODULE set to the dist's engine.

'use strict';

const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2]);
const asJson = process.argv.includes('--json');
const { ModelManager, ModelFile } = require(path.join(dist, 'index.js'));
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const out = [];
for (const set of SETS) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
    const mm = new ModelManager();
    for (const { name, ast } of data.models) {
        // P5-56's enum isAbstract drop, as p515-sweep.mjs and p597-server.mjs.
        for (const d of ast.declarations || []) {
            if (d.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                delete d.isAbstract;
            }
        }
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    const counts = { files: 0, stage: 0, staged: 0, ast: 0, none: 0 };
    const reStaged = [];
    const h = mm.rustHandle;
    const orig = h.modelFileFilterStaged;
    h.modelFileFilterStaged = function (...a) {
        const r = orig.apply(this, a);
        counts.files++;
        if (typeof r !== 'string') {
            counts.none++;
            return r;
        }
        const x = JSON.parse(r);
        if (x.stage !== undefined) {
            counts.stage++;
        } else if (x.staged !== undefined) {
            counts.staged++;
        } else {
            counts.ast++;
            reStaged.push(x.ast && x.ast.namespace);
        }
        return r;
    };
    mm.filter(() => true);
    out.push({ set, ...counts, reStaged });
    if (!asJson) {
        console.log(`${set}: ${counts.files} files: ${counts.stage} shared, ${counts.staged} staged by the engine, ${counts.ast} re-staged from the AST, ${counts.none} with nothing kept${reStaged.length ? ` (${reStaged.join(', ')})` : ''}`);
    }
}
if (asJson) {
    console.log(JSON.stringify({ dist, results: out }, null, 2));
}
