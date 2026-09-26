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

// Unit tests for the fuzz harness's outcome classification (task P5-05,
// accordproject/concerto-rust#76 worker note 5837364211). No engine needed:
//   node --test migration/fuzz/test/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { classifyThrow, classifyCase, emptyCounts, tally } = require('../lib/classify');
const { expectedDivergence } = require('../lib/expected-divergences');
const codec = require(path.join(__dirname, '..', '..', 'oracle', 'lib', 'codec'));

const OK = { ok: { '@@oracle': 'typed', fqn: 'org.test@1.0.0.C' } };
const err = (cls, message) => ({ error: { class: cls, message, location: null, component: null } });
const verdict = (canon) => ({ ok: true, canon });
const harness = (message) => ({ ok: false, error: message });
const CASE = { op: 'ModelManager.fromAst', seedFile: 'data/x.json', mutationSeed: 7 };

test('TS ok, Rust throws: a divergence carrying both outcomes', () => {
    const rust = err('IllegalModelException', 'bad model');
    const cls = classifyCase(CASE, verdict(OK), verdict(rust), expectedDivergence);
    assert.equal(cls.kind, 'divergence');
    assert.deepEqual(cls.record, { ...CASE, ts: OK, rust });
});

test('TS throws, Rust ok: a divergence', () => {
    const cls = classifyCase(CASE, verdict(err('TypeError', 'x is not a function')), verdict(OK), expectedDivergence);
    assert.equal(cls.kind, 'divergence');
    assert.equal(cls.tsHarness, false);
    assert.equal(cls.rustHarness, false);
});

test('both throw the same class and message: agreement', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad')), verdict(err('IllegalModelException', 'bad')), expectedDivergence);
    assert.equal(cls.kind, 'agree');
});

test('agreement ignores key order in the canonical outcome', () => {
    const a = { error: { class: 'E', message: 'm', location: null, component: null } };
    const b = { error: { component: null, location: null, message: 'm', class: 'E' } };
    assert.equal(classifyCase(CASE, verdict(a), verdict(b), expectedDivergence).kind, 'agree');
});

test('both throw, different class: a divergence', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad')), verdict(err('TypeError', 'bad')), expectedDivergence);
    assert.equal(cls.kind, 'divergence');
});

test('both throw, same class, different message: a divergence', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad a')), verdict(err('IllegalModelException', 'bad b')), expectedDivergence);
    assert.equal(cls.kind, 'divergence');
});

test('a maintainer-accepted signature (DV-015) is expected, not unresolved', () => {
    const c = { ...CASE, op: 'Serializer.fromJSON' };
    const cls = classifyCase(c,
        verdict(err('TypeError', 'fqn.lastIndexOf is not a function')),
        verdict(err('Error', 'a $class that is not a string: true')), expectedDivergence);
    assert.equal(cls.kind, 'expected');
    assert.equal(cls.expected.dv, 'DV-015');
});

test('a maintainer-accepted signature (DV-017) is expected, not unresolved', () => {
    for (const [op, value] of [['ModelManager.addModelFile', 'undefined'], ['ModelManager.fromAst', 'null']]) {
        const cls = classifyCase({ ...CASE, op },
            verdict(err('TypeError', `Cannot read properties of ${value} (reading 'name')`)),
            verdict(err('IllegalModelException', "Relationship dept must have a type File 'x.cto': line 5 column 3, to line 6 column 1. ")),
            expectedDivergence);
        assert.equal(cls.kind, 'expected', op);
        assert.equal(cls.expected.dv, 'DV-017');
    }
    // No file name: the IllegalModelException constructor still appends ' '.
    assert.equal(expectedDivergence({ op: 'ModelManager.fromAst',
        ts: err('TypeError', "Cannot read properties of undefined (reading 'name')"),
        rust: err('IllegalModelException', 'Relationship home must have a type ') }).dv, 'DV-017');
});

test('DV-017 needs both sides: a TS crash paired with Rust ok, another crash or another op is unresolved', () => {
    const crash = err('TypeError', "Cannot read properties of undefined (reading 'name')");
    const rejected = err('IllegalModelException', 'Relationship home must have a type ');
    const cases = [
        ['ModelManager.fromAst', crash, OK],
        ['ModelManager.fromAst', err('TypeError', "Cannot read properties of undefined (reading 'type')"), rejected],
        ['ModelManager.fromAst', crash, err('IllegalModelException', 'Relationship must have a type ')],
        ['Serializer.fromJSON', crash, rejected],
    ];
    for (const [op, ts, rust] of cases) {
        assert.equal(classifyCase({ ...CASE, op }, verdict(ts), verdict(rust), expectedDivergence).kind, 'divergence', `${op} ${JSON.stringify(rust)}`);
    }
});

test('a maintainer-accepted signature (DV-018) is expected, not unresolved', () => {
    for (const [op, rustMessage] of [
        ['ModelManager.addModelFile', "Invalid decorator. Expected object. Found null File 'x.cto': "],
        ['ModelManager.fromAst', 'Invalid decorator. Expected object. Found null '],
        ['ModelFile.validate', 'Invalid decorator. Expected object. Found undefined'],
    ]) {
        const cls = classifyCase({ ...CASE, op },
            verdict(err('TypeError', "Cannot read properties of null (reading 'name')")),
            verdict(err('IllegalModelException', rustMessage)),
            expectedDivergence);
        assert.equal(cls.kind, 'expected', op);
        assert.equal(cls.expected.dv, 'DV-018');
    }
});

test('DV-018 needs both sides: the decorator message with another TS outcome, or the TS crash with another Rust outcome, is unresolved', () => {
    const crash = err('TypeError', "Cannot read properties of null (reading 'name')");
    const rejected = err('IllegalModelException', "Invalid decorator. Expected object. Found null File 'x.cto': ");
    const cases = [
        // the crash, but Rust accepted (the pre-fix shape)
        ['ModelManager.addModelFile', crash, OK],
        // another property read
        ['ModelManager.addModelFile', err('TypeError', "Cannot read properties of null (reading 'arguments')"), rejected],
        // TS rejected cleanly rather than crashing
        ['ModelManager.addModelFile', err('IllegalModelException', 'Duplicate decorator undefined '), rejected],
        // the crash paired with some other Rust rejection
        ['ModelManager.addModelFile', crash, err('IllegalModelException', "Decorator Foo has invalid decorator argument. Expected object. Found string, with value \"x\"")],
        // a different "Found" value, or the right text under another class
        ['ModelManager.addModelFile', crash, err('IllegalModelException', 'Invalid decorator. Expected object. Found 5 ')],
        ['ModelManager.addModelFile', crash, err('Error', 'Invalid decorator. Expected object. Found null ')],
        // not a model-loading op
        ['Serializer.fromJSON', crash, rejected],
    ];
    for (const [op, ts, rust] of cases) {
        assert.equal(classifyCase({ ...CASE, op }, verdict(ts), verdict(rust), expectedDivergence).kind, 'divergence', `${op} ${JSON.stringify(ts)} ${JSON.stringify(rust)}`);
    }
});

test('DV-017 and DV-018 do not claim each other\'s Rust message', () => {
    const crash = err('TypeError', "Cannot read properties of null (reading 'name')");
    assert.equal(expectedDivergence({ op: 'ModelManager.fromAst', ts: crash,
        rust: err('IllegalModelException', 'Invalid decorator. Expected object. Found null ') }).dv, 'DV-018');
    assert.equal(expectedDivergence({ op: 'ModelManager.fromAst', ts: crash,
        rust: err('IllegalModelException', 'Relationship home must have a type ') }).dv, 'DV-017');
});

test('a genuine harness error on the TS side is not skipped past the Rust side', () => {
    const rust = err('IllegalModelException', 'bad');
    const cls = classifyCase(CASE, harness('harness: unresolved blob'), verdict(rust), expectedDivergence);
    assert.equal(cls.kind, 'harness');
    assert.equal(cls.tsHarness, true);
    assert.equal(cls.rustHarness, false);
    // The side that produced a verdict keeps it in the reported record.
    assert.deepEqual(cls.record.rust, rust);
    assert.deepEqual(cls.record.ts, { harnessError: 'harness: unresolved blob' });
});

test('harness errors on both sides, and a missing worker result, are both per-side', () => {
    const both = classifyCase(CASE, harness('a'), harness('b'), expectedDivergence);
    assert.equal(both.kind, 'harness');
    assert.equal(both.tsHarness && both.rustHarness, true);
    const missing = classifyCase(CASE, verdict(OK), undefined, expectedDivergence);
    assert.equal(missing.kind, 'harness');
    assert.equal(missing.tsHarness, false);
    assert.equal(missing.rustHarness, true);
    assert.deepEqual(missing.record.rust, { harnessError: 'no result from worker' });
});

test('tally counts harness errors per side and per op, and every case exactly once', () => {
    const summary = { ...emptyCounts(), byOp: {} };
    tally(summary, 'A', classifyCase(CASE, verdict(OK), verdict(OK), expectedDivergence));
    tally(summary, 'A', classifyCase(CASE, verdict(OK), verdict(err('E', 'm')), expectedDivergence));
    tally(summary, 'A', classifyCase(CASE, harness('x'), verdict(OK), expectedDivergence));
    tally(summary, 'B', classifyCase(CASE, verdict(OK), harness('y'), expectedDivergence));
    tally(summary, 'B', classifyCase(CASE, harness('x'), harness('y'), expectedDivergence));
    assert.deepEqual(summary.byOp.A, { ran: 3, agree: 1, divergences: 1, expectedDivergences: 0, harnessErrorCases: 1, harnessErrorsTs: 1, harnessErrorsRust: 0 });
    assert.deepEqual(summary.byOp.B, { ran: 2, agree: 0, divergences: 0, expectedDivergences: 0, harnessErrorCases: 2, harnessErrorsTs: 1, harnessErrorsRust: 2 });
    assert.equal(summary.ran, 5);
    assert.equal(summary.agree + summary.divergences + summary.expectedDivergences + summary.harnessErrorCases, summary.ran);
    assert.equal(summary.harnessErrorsTs, 2);
    assert.equal(summary.harnessErrorsRust, 2);
});

test('classifyThrow: only an engine error tagged by the decoder is a verdict', () => {
    const tagged = new Error('engine said no');
    tagged.decodeConstruct = true;
    assert.equal(classifyThrow(tagged), 'engine');
    assert.equal(classifyThrow(new codec.HarnessError('unknown op')), 'harness');
    const divergence = new Error('state divergence: step addModelFile recorded ok, replayed error');
    divergence.divergence = true;
    assert.equal(classifyThrow(divergence), 'harness');
    assert.equal(classifyThrow(new TypeError('harness bug')), 'harness');
    assert.equal(classifyThrow(undefined), 'harness');
});

// A fake engine core, just enough for codec.makeDecoder: each constructor
// rejects its input the way a real engine rejects a malformed document.
class Rejection extends Error {}
function fakeCore() {
    class ModelManager {
        constructor(options) {
            if (options && options.reject) { throw new Rejection('bad model manager options'); }
        }
        isModelManager() { return true; }
        addModelFile() { throw new Rejection('step failed'); }
        getModelFile() { throw new Rejection('getModelFile failed'); }
    }
    return {
        ModelManager,
        ModelFile: class { constructor() { throw new Rejection('bad model file AST'); } },
        Factory: class { constructor() { throw new Rejection('bad factory'); } },
        Serializer: class { constructor() { throw new Rejection('bad serializer options'); } },
        Introspector: class { constructor() { throw new Rejection('bad introspector'); } },
    };
}
const decoder = () => codec.makeDecoder(fakeCore(), () => { throw new Error('no derived'); });
const mm = (extra) => Object.assign({ '@@oracle': 'mm', id: 0, kind: 'ModelManager', steps: [] }, extra);
const thrown = (f) => {
    try {
        f();
    } catch (e) {
        return e;
    }
    assert.fail('expected a throw');
};

test('decoding: engine errors beyond the ModelFile constructor are tagged as engine verdicts', () => {
    const decode = decoder();
    const cases = {
        'ModelFile constructor': { '@@oracle': 'mfnew', mm: mm(), ast: {}, definitions: null, fileName: null },
        'ModelManager constructor': mm({ options: { reject: true } }),
        'ModelManager.getModelFile': { '@@oracle': 'mfref', mm: mm(), ns: 'org.test@1.0.0' },
        'Factory constructor': { '@@oracle': 'factory', mm: mm() },
        'Serializer constructor': { '@@oracle': 'serializer', mm: mm(), factory: { '@@oracle': 'mmref', id: 0 }, defaultOptions: {} },
        'Introspector constructor': { '@@oracle': 'introspector', mm: mm() },
    };
    for (const [name, node] of Object.entries(cases)) {
        const e = thrown(() => decode(node, { mms: new Map() }));
        assert.ok(e instanceof Rejection, name + ': the engine error itself is rethrown unchanged');
        assert.equal(e.decodeConstruct, true, name + ': tagged');
        assert.equal(classifyThrow(e), 'engine', name);
    }
});

test('decoding: harness failures are never tagged', () => {
    const decode = decoder();
    const unknown = thrown(() => decode({ '@@oracle': 'no-such-kind' }, { mms: new Map() }));
    assert.ok(unknown instanceof codec.HarnessError);
    assert.equal(classifyThrow(unknown), 'harness');
    // A recorded setup step that replays differently is a state divergence
    // of the recipe, not the op's verdict.
    const step = { method: 'addModelFile', args: [], status: 'ok', errorClass: null };
    const replay = thrown(() => decode(mm({ steps: [step] }), { mms: new Map() }));
    assert.equal(replay.divergence, true);
    assert.equal(classifyThrow(replay), 'harness');
});
