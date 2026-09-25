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
 * Signatures the maintainer has explicitly accepted as permanent, documented
 * divergences (never "fixed", never "harness bugs") — so the fuzz harness
 * (`bin/fuzz.js`) and the triage tooling (`bin/triage.js`) stop counting
 * matching cases as unresolved. Each entry cites the `DIVERGENCES.md` row
 * (in `accordproject/concerto-rust`) that records the maintainer's decision.
 *
 * accordproject/concerto-rust#156's decision (comment 5837231174) is scoped
 * to "a non-string `$class`" as a whole — its own issue body lists `true`,
 * a number, `null`, an array and an object as the in-scope values — and its
 * instruction to the harness is explicit: match the pair "so the 2,754 T1
 * cases stop counting as unresolved". Those 2,754 cases are not all the
 * same TS shape:
 *   - `true`/a number/`null` (and a bare object): TS's `fqn.lastIndexOf`
 *     call throws directly, an uncaught `TypeError: fqn.lastIndexOf is not
 *     a function` (7 clusters, 1,694 divergences);
 *   - an array: `Array.prototype.lastIndexOf` also exists, so TS doesn't
 *     crash — `getShortName` returns the array unsliced, it is later
 *     stringified, and TS instead raises a normal `TypeNotFoundException:
 *     Namespace is not defined for type "…"` (90 clusters, 1,059
 *     divergences).
 * Both are the same underlying bug (no type check on `$class` before
 * `ModelUtil.getShortName`/`getNamespace`), both are covered by the
 * decision's own "non-string $class" framing, and Rust gives the identical
 * `a $class that is not a string: <value>` rejection for both — so both
 * match here. What is genuinely NOT in scope, and deliberately still falls
 * through to an unresolved divergence, is anything that doesn't share
 * Rust's distinctive rejection message (for example the unrelated
 * `ts=ok`/`rust=error(ValidationException)` DateTime outlier folded into
 * the same op by the original triage) — that Rust error class/message
 * prefix is the narrow, reliable discriminator for "this is the $class type
 * check", regardless of which TS-side shape it paired with.
 */
const EXPECTED = [
    {
        dv: 'DV-015',
        issue: 'accordproject/concerto-rust#156',
        description: 'Serializer.fromJSON: a non-string $class — TS either throws an uncaught TypeError (fqn.lastIndexOf is not a function) or, for an array, resolves it to a TypeNotFoundException; Rust\'s explicit rejection is maintainer-accepted for both, and not ported.',
        match(d) {
            if (d.op !== 'Serializer.fromJSON') { return false; }
            const t = d.ts && d.ts.error;
            const r = d.rust && d.rust.error;
            if (!t || !r) { return false; }
            if (r.class !== 'Error') { return false; }
            if (typeof r.message !== 'string' || !r.message.startsWith('a $class that is not a string:')) { return false; }
            const crash = t.class === 'TypeError' && t.message === 'fqn.lastIndexOf is not a function';
            const arrayResolved = t.class === 'TypeNotFoundException' && typeof t.message === 'string' && t.message.startsWith('Namespace is not defined for type');
            return crash || arrayResolved;
        },
    },
];

/**
 * @param {{op: string, ts: object, rust: object}} d a divergence record
 *   (same shape as a line of results/divergences.jsonl, or the {op, ts,
 *   rust} fuzz.js builds before writing one).
 * @returns {object|null} the matching entry from EXPECTED, or null.
 */
function expectedDivergence(d) {
    for (const entry of EXPECTED) {
        if (entry.match(d)) { return entry; }
    }
    return null;
}

module.exports = { EXPECTED, expectedDivergence };
