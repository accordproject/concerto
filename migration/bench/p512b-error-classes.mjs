#!/usr/bin/env node
// P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): error-class
// spot check for invalid resources. Prints one line per case: the class
// `resource.validate()` throws (or "ok"), and whether the P5-12 counters saw
// a fallback to the visitor.
//
//   node migration/bench/p512b-error-classes.mjs                  # this checkout's dist
//   BENCH_CORE_DIST=<5.0.0 dist> node migration/bench/p512b-error-classes.mjs
//
// With CONCERTO_P512_VARIANT=B and CONCERTO_P512B_TRANSPORT=<t> for the
// candidates. Compare the output lines between runs.

import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIST = process.env.BENCH_CORE_DIST || path.resolve(__dirname, '..', '..', 'packages', 'concerto-core', 'dist');
const load = (rel) => {
    const m = require(path.join(DIST, rel));
    return m.default ?? m;
};
const ModelManager = load('modelmanager.js');
const Factory = load('factory.js');

const NS = 'org.accordproject.bench.errors@1.0.0';
const cto = `
namespace ${NS}

concept Item identified by id {
  o String id
  o Integer sequence
  o Double weight optional
  o Boolean active
  o String[] labels optional
  o DateTime when optional
  --> Item other optional
  o Inner inner optional
}

concept Inner {
  o String name regex=/^[a-z]+$/
}
`;
const mm = new ModelManager();
mm.addCTOModel(cto, 'errors.cto', true);
mm.validateModelFiles();
const factory = new Factory(mm);

function base(id = 'x') {
    const r = factory.newResource(NS, 'Item', id);
    r.sequence = 1;
    r.active = true;
    return r;
}

const cases = {
    'valid': () => base(),
    'string in Integer': () => Object.assign(base(), { sequence: 'abc' }),
    'number in Boolean': () => Object.assign(base(), { active: 1 }),
    'Double in Integer (TS accepts)': () => Object.assign(base(), { sequence: 1.5 }),
    'NaN in Double': () => Object.assign(base(), { weight: NaN }),
    'undefined in required field': () => Object.assign(base(), { active: undefined }),
    'missing required field': () => {
        const r = base();
        delete r.active;
        return r;
    },
    'undeclared field': () => Object.assign(base(), { extra: 1 }),
    'number in String[]': () => Object.assign(base(), { labels: ['a', 2] }),
    'string in DateTime': () => Object.assign(base(), { when: '2024-01-01' }),
    'empty identifier': () => {
        const r = base();
        r.id = '';
        return r;
    },
    'resource in relationship field': () => Object.assign(base(), { other: base('y') }),
    'regex violation (nested concept)': () => {
        const inner = factory.newConcept(NS, 'Inner');
        inner.name = 'ABC';
        return Object.assign(base(), { inner });
    },
    'wrong concept type nested': () => Object.assign(base(), { inner: base('z') }),
};

for (const [name, make] of Object.entries(cases)) {
    let outcome;
    try {
        make().validate();
        outcome = 'ok';
    } catch (err) {
        outcome = (err && err.constructor && err.constructor.name) || String(err);
    }
    console.log(`${name}: ${outcome}`);
}
const c = globalThis.__p512;
if (c) {
    console.error(`counters: ${JSON.stringify(c)}`);
}
