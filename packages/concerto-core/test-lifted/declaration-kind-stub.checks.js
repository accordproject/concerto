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
 * P5-112 lifted checks (accordproject/concerto-rust#479): the declaration
 * kind predicates on a ClassDeclaration built from a stub AST with no
 * `$class`, as concerto-analysis's compare-utils tests build one. On
 * v5.0.0 `isAsset()` and its siblings are string comparisons on the
 * missing type and return false; src must not throw a TypeError there.
 *
 * `expect` is the frozen v5.0.0 reference's outcome, which src matches.
 * Run by fallbacks.spec.js.
 */

/**
 * The kind predicates of a `$class`-less ClassDeclaration.
 * @param {object} core the concerto-core module under test
 * @returns {object} each predicate's result
 */
function stubKinds(core) {
    // The stub is not a valid metamodel AST, so skip BC-19's shape check (trusted input).
    const mm = new core.ModelManager({ metamodelValidation: false });
    const mf = new core.ModelFile(mm, { namespace: 'org.acme.p5112@1.0.0' }, null, 'stub.cto');
    const decl = new core.ClassDeclaration(mf, { name: 'Stub', properties: [] });
    return {
        isAsset: decl.isAsset(),
        isParticipant: decl.isParticipant(),
        isTransaction: decl.isTransaction(),
        isEvent: decl.isEvent(),
        isConcept: decl.isConcept(),
        isEnum: decl.isEnum(),
        isMapDeclaration: decl.isMapDeclaration(),
    };
}

const ALL_FALSE = {
    isAsset: false,
    isParticipant: false,
    isTransaction: false,
    isEvent: false,
    isConcept: false,
    isEnum: false,
    isMapDeclaration: false,
};

const checks = [
    { id: 'CD-KIND-001', covers: 'a ClassDeclaration with no $class matches no declaration kind', run: stubKinds, expect: { ok: ALL_FALSE } },
];

module.exports = checks;
