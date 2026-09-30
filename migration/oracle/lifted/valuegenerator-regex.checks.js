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
 * P5-59 lifted checks (accordproject/concerto-rust#390): the length
 * reshaping of a generated regex value (serializer/valuegenerator.ts
 * `getRegexString` and `isLengthInRange`), made deterministic.
 *
 * The unit suite reaches the reshaping only when RandExp happens to
 * generate a value outside the field's length bounds, so its coverage
 * varied from run to run. Here the regex has exactly one match, so RandExp
 * always generates the same value, and the length bounds pin the generated
 * length: a value shorter than `length=[n,n]` is padded with further
 * matches, one longer is truncated. Driven through the public
 * `Factory.newConcept` with `generate: 'empty'` and `generate: 'sample'`.
 *
 * `expect` is the frozen v5.0.0 reference's outcome, which src matches.
 * Run by fallbacks.spec.js.
 */

/**
 * The generated value of `C.s` in `cto`.
 * @param {string} cto the model, with a concept `C` and a field `s`
 * @param {string} generate the `generate` option: 'empty' or 'sample'
 * @returns {Function} the check body
 */
function generated(cto, generate) {
    return (core) => {
        const mm = new core.ModelManager();
        mm.addCTOModel(`namespace org.acme.p559.vg@1.0.0\n${cto}`, 'vg.cto');
        const factory = new core.Factory(mm);
        return factory.newConcept('org.acme.p559.vg@1.0.0', 'C', undefined, { generate }).s;
    };
}

const SHORT = 'concept C { o String s regex=/^a$/ length=[3,3] }';
const LONG = 'concept C { o String s regex=/^abcdef$/ length=[2,2] }';
const SCALAR = 'scalar S extends String regex=/^a$/ length=[4,4]\nconcept C { o S s }';

const checks = [
    { id: 'VG-RX-001', covers: 'empty generator: a regex value shorter than the minimum is padded', run: generated(SHORT, 'empty'), expect: { ok: 'aaa' } },
    { id: 'VG-RX-002', covers: 'sample generator: a regex value shorter than the minimum is padded', run: generated(SHORT, 'sample'), expect: { ok: 'aaa' } },
    { id: 'VG-RX-003', covers: 'empty generator: a regex value longer than the maximum is truncated', run: generated(LONG, 'empty'), expect: { ok: 'ab' } },
    { id: 'VG-RX-004', covers: 'sample generator: a regex value longer than the maximum is truncated', run: generated(LONG, 'sample'), expect: { ok: 'ab' } },
    { id: 'VG-RX-005', covers: 'sample generator: a String scalar\'s regex and length bounds', run: generated(SCALAR, 'sample'), expect: { ok: 'aaaa' } },
];

module.exports = checks;
