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
 * A case must match *narrowly* — same op, same TS error class and exact
 * message, same Rust error class and message prefix — to be treated as
 * expected. Anything else with a superficially similar shape (a different
 * message, a different op) still counts as an unresolved divergence and
 * needs its own decision before it can be added here.
 *
 * accordproject/concerto-rust#156 (task P5-05 stage 1, follow-up T1): keep
 * Rust's explicit "$class that is not a string" rejection instead of
 * reproducing TS's uncaught `TypeError` from `ModelUtil.getShortName`/
 * `getNamespace` calling `fqn.lastIndexOf` with no type check.
 *
 * This deliberately does NOT match the sibling case where `$class` is a
 * string but names no real type (TS raises `TypeNotFoundException:
 * Namespace is not defined for type "…"` instead of the `TypeError` above,
 * while Rust still raises the same `Error: a $class that is not a string:
 * <value>` for values like `true`/`""`/FQN-shaped strings that are likely
 * arrays). #156's own issue text says that case is "unaffected by this
 * issue" — the maintainer's DV-015 decision does not cover it, so it must
 * keep counting as an unresolved divergence (see TRIAGE.md T1) until there
 * is a decision for it too.
 */
const EXPECTED = [
    {
        dv: 'DV-015',
        issue: 'accordproject/concerto-rust#156',
        description: 'Serializer.fromJSON: a non-string $class (TS uncaught TypeError vs Rust\'s explicit rejection) — maintainer-accepted, not ported.',
        match(d) {
            if (d.op !== 'Serializer.fromJSON') { return false; }
            const t = d.ts && d.ts.error;
            const r = d.rust && d.rust.error;
            if (!t || !r) { return false; }
            if (t.class !== 'TypeError') { return false; }
            if (t.message !== 'fqn.lastIndexOf is not a function') { return false; }
            if (r.class !== 'Error') { return false; }
            return typeof r.message === 'string' && r.message.startsWith('a $class that is not a string:');
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
