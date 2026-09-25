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
 * Outcome classification for the differential fuzz harness (task P5-05),
 * kept free of engines and I/O so it can be unit-tested
 * (migration/fuzz/test/classify.test.js).
 *
 * Two levels:
 *
 * - classifyThrow(): inside one engine's worker, is an error thrown at the
 *   adapter boundary the engine's verdict on the input (so it is compared
 *   against the other engine), or a genuine harness failure?
 * - classifyCase(): in the driver, given both engines' worker results for
 *   one case, is it an agreement, an unresolved divergence, an expected
 *   (maintainer-accepted, documented) divergence, or a harness error — and
 *   on which side(s)?
 *
 * tally() folds a classified case into a run summary, per side and per op.
 */

const path = require('path');
const { sortedStringify } = require(path.join(__dirname, '..', '..', 'oracle', 'lib', 'canon'));

/**
 * Is an error thrown out of `adapter.run()` an engine verdict?
 *
 * `adapter.run()` decodes the fixture inputs before running the op, and
 * decoding calls into the engine (constructing the ModelFile, ModelManager,
 * Serializer, Factory, ... the recipe describes). migration/oracle/lib/
 * codec.js tags any error one of those engine calls throws with
 * `decodeConstruct = true`: for a mutated document that reaches one of them,
 * the rejection is the engine's own behaviour and is compared like any other
 * thrown op result. Everything else — codec.HarnessError (the fixture could
 * not be set up), a replay "state divergence", or an untagged throw from
 * harness code — is a harness error.
 * @param {*} e the thrown value
 * @returns {'engine'|'harness'} classification
 */
function classifyThrow(e) {
    return e && e.decodeConstruct === true ? 'engine' : 'harness';
}

/**
 * Classify one fuzzed case from the two workers' results.
 * @param {{op: string, seedFile?: string, mutationSeed?: number}} c the case
 * @param {object|undefined} t TS worker result: {ok: true, canon} | {ok: false, error}; undefined if the worker returned nothing
 * @param {object|undefined} r Rust worker result, same shape
 * @param {function(object): (object|null)} expectedDivergence lib/expected-divergences.js's matcher
 * @returns {{kind: string, tsHarness: boolean, rustHarness: boolean, record?: object, expected?: object}}
 *   kind is one of 'agree', 'divergence', 'expected', 'harness'. For
 *   'harness', tsHarness/rustHarness say which side(s) failed and `record`
 *   keeps both sides (a side that did produce a verdict keeps it), so the
 *   case is reported, never silently dropped.
 */
function classifyCase(c, t, r, expectedDivergence) {
    const tsHarness = !t || t.ok !== true;
    const rustHarness = !r || r.ok !== true;
    const side = (x) => (x && x.ok === true ? x.canon : { harnessError: x ? String(x.error) : 'no result from worker' });
    const record = {
        op: c.op,
        seedFile: c.seedFile,
        mutationSeed: c.mutationSeed,
        ts: side(t),
        rust: side(r),
    };
    if (tsHarness || rustHarness) {
        return { kind: 'harness', tsHarness, rustHarness, record };
    }
    if (sortedStringify(t.canon) === sortedStringify(r.canon)) {
        return { kind: 'agree', tsHarness, rustHarness };
    }
    const expected = expectedDivergence ? expectedDivergence(record) : null;
    if (expected) {
        return { kind: 'expected', tsHarness, rustHarness, record, expected };
    }
    return { kind: 'divergence', tsHarness, rustHarness, record };
}

/**
 * @returns {object} an empty per-op (or whole-run) counter set
 */
function emptyCounts() {
    return {
        ran: 0,
        agree: 0,
        divergences: 0,
        expectedDivergences: 0,
        // Cases with a harness error on at least one side (ran = agree +
        // divergences + expectedDivergences + harnessErrorCases).
        harnessErrorCases: 0,
        // Per side: a case that fails on both sides counts once in each.
        harnessErrorsTs: 0,
        harnessErrorsRust: 0,
    };
}

/**
 * Fold one classified case into a run summary (summary.byOp[op] too).
 * @param {object} summary run summary: emptyCounts() fields plus byOp
 * @param {string} op the case's op
 * @param {object} cls classifyCase()'s result
 */
function tally(summary, op, cls) {
    const byOp = summary.byOp[op] || (summary.byOp[op] = emptyCounts());
    for (const s of [summary, byOp]) {
        s.ran++;
        switch (cls.kind) {
        case 'agree': s.agree++; break;
        case 'divergence': s.divergences++; break;
        case 'expected': s.expectedDivergences++; break;
        case 'harness':
            s.harnessErrorCases++;
            if (cls.tsHarness) { s.harnessErrorsTs++; }
            if (cls.rustHarness) { s.harnessErrorsRust++; }
            break;
        default: throw new Error('unknown case kind ' + cls.kind);
        }
    }
}

module.exports = { classifyThrow, classifyCase, emptyCounts, tally };
