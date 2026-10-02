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
 * P5-13 lifted checks (accordproject/concerto-rust#297): a direct
 * `BaseModelManager.validateAst(modelFile)` call, checked through the public
 * API against the frozen v5.0.0 reference. Run by fallbacks.spec.js.
 *
 * - The error class for an AST the engine's own `ModelFile` constructor
 *   would reject (a missing `namespace`, `declarations` that is not an
 *   array): TS throws `MetamodelException` from the structural check. On
 *   the real `addModelFile` path the TS `ModelFile` is built first, so only
 *   a direct call reaches these.
 * - The metamodel TS leaves registered: none after a pass, and
 *   `concerto.metamodel@1.0.0` after a structural failure (its
 *   `deleteModelFile` is never reached), which a later passing call on the
 *   same manager keeps.
 *
 * Each probe reports the outcome as the thrown class's name (or `ok`) and
 * whether the manager then holds the metamodel, so that only the class,
 * not the message wording, is compared (error parity, P5-09).
 */

const METAMODEL_NS = 'concerto.metamodel@1.0.0';
const MODEL = `${METAMODEL_NS}.Model`;

/**
 * Calls `mm.validateAst` over a stand-in model file holding `ast`.
 * @param {object} mm the model manager
 * @param {object} ast the AST to check
 * @returns {Array} `[outcome, metamodel registered]`
 */
function probe(mm, ast) {
    let outcome = 'ok';
    try {
        mm.validateAst({ getAst: () => ast, getName: () => 'probe.cto' });
    } catch (e) {
        outcome = e.constructor.name;
    }
    return [outcome, !!mm.getModelFile(METAMODEL_NS)];
}

const VALID = { $class: MODEL, namespace: 'org.acme.lifted.p513@1.0.0', imports: [], declarations: [] };

module.exports = [
    {
        id: 'VA-001',
        covers: 'basemodelmanager.ts validateAst: a valid AST passes and leaves no metamodel registered',
        run: (core) => probe(new core.ModelManager(), VALID),
        expect: { ok: [ 'ok', false ] },
    },
    {
        id: 'VA-002',
        covers: 'basemodelmanager.ts validateAst: an AST with no namespace is a MetamodelException, and the metamodel stays registered',
        run: (core) => probe(new core.ModelManager(), { $class: MODEL, imports: [], declarations: [] }),
        expect: { ok: [ 'MetamodelException', true ] },
    },
    {
        id: 'VA-003',
        covers: 'basemodelmanager.ts validateAst: declarations that are not an array are a MetamodelException, and the metamodel stays registered',
        run: (core) => probe(new core.ModelManager(), { ...VALID, declarations: 'not an array' }),
        expect: { ok: [ 'MetamodelException', true ] },
    },
    {
        id: 'VA-004',
        covers: 'basemodelmanager.ts validateAst: after a failure leaves the metamodel registered, a passing call keeps it',
        run: (core) => {
            const mm = new core.ModelManager();
            return [
                probe(mm, { ...VALID, namespace: 5 }),
                probe(mm, VALID),
            ];
        },
        expect: { ok: [ [ 'MetamodelException', true ], [ 'ok', true ] ] },
    },
    {
        id: 'VA-005',
        covers: 'basemodelmanager.ts validateAst: a version mismatch fails before the metamodel is registered',
        run: (core) => probe(new core.ModelManager(), { ...VALID, $class: 'concerto.metamodel@0.4.0.Model' }),
        expect: { ok: [ 'MetamodelException', false ] },
    },
];
