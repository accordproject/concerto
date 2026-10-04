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
 * P5-14 lifted checks (accordproject/concerto-rust#308): the property
 * lookup cache on ClassDeclaration views (`getProperties()`,
 * `getProperty()`; packages/concerto-core/src/engine/views-lookups.ts) is dropped
 * at every point where TS 5.0.0 could answer differently: a model file
 * added, updated (replaced) or deleted, the model files cleared, and a
 * failed `addModelFiles` batch rolled back.
 *
 * Each check first reads the lookups of a declaration view (which fills the
 * cache), then changes the models through the ModelManager API, then reads
 * the same view again. TS 5.0.0 resolves the super type again on every
 * call, so a stale cache fails the check. The last checks pin the returned
 * array semantics (BC-23): a new array on every call, holding the same
 * Property objects, which a caller can mutate without changing the next
 * answer. `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 */

const BASE = 'org.acme.cache.base@1.0.0';
const SUB = 'org.acme.cache.sub@1.0.0';

/**
 * The base model, with concept `Base` holding `properties`.
 * @param {string} properties the CTO property lines
 * @returns {string} the CTO
 */
function baseCto(properties) {
    return `namespace ${BASE}\nconcept Base {\n${properties}\n}\n`;
}

const SUB_CTO = `namespace ${SUB}\nimport ${BASE}.{Base}\nconcept Sub extends Base {\n  o String own\n}\n`;

/**
 * A ModelManager with the base model (properties `properties`) and the sub
 * model, whose `Sub` extends `Base` across namespaces.
 * @param {object} core the core under test
 * @param {string} properties the base's CTO property lines
 * @returns {object} the ModelManager
 */
function manager(core, properties) {
    const mm = new core.ModelManager();
    mm.addCTOModel(baseCto(properties), 'base.cto');
    mm.addCTOModel(SUB_CTO, 'sub.cto');
    return mm;
}

/**
 * The lookups of `decl`: its property names, and what `getProperty` finds
 * for each of `names` (the name, or null), or the error each throws.
 * @param {object} decl the class declaration view
 * @param {string[]} names the names to look up
 * @returns {object} `{ properties, lookups }`
 */
function lookups(decl, names) {
    const attempt = (fn) => {
        try {
            return fn();
        } catch (e) {
            return `${e.constructor.name}: ${e.message}`;
        }
    };
    return {
        properties: attempt(() => decl.getProperties().map((p) => p.getName())),
        lookups: names.map((name) => attempt(() => {
            const p = decl.getProperty(name);
            return p === null ? null : `${p.getParent().getName()}.${p.getName()}`;
        })),
    };
}

const NAMES = ['own', 'a', 'b', 'c'];

/** What TS 5.0.0 throws for `Base` once its namespace is gone. */
const NOT_FOUND = `TypeNotFoundException: Namespace is not defined for type "${BASE}.Base".`;

module.exports = [
    {
        id: 'PROP-CACHE-001',
        covers: 'updateModelFile (a file replaced): a sub type sees its super type\'s new properties',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            mm.updateModelFile(baseCto('  o String b\n  o String c'), 'base.cto');
            return { before, after: lookups(sub, NAMES), fresh: lookups(mm.getType(`${SUB}.Sub`), NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                after: { properties: ['own', 'b', 'c'], lookups: ['Sub.own', null, 'Base.b', 'Base.c'] },
                fresh: { properties: ['own', 'b', 'c'], lookups: ['Sub.own', null, 'Base.b', 'Base.c'] },
            },
        },
    },
    {
        id: 'PROP-CACHE-002',
        covers: 'deleteModelFile: a sub type whose super type\'s file is gone throws, as TS 5.0.0 does',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            mm.deleteModelFile(BASE);
            return { before, after: lookups(sub, NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                after: {
                    properties: NOT_FOUND,
                    lookups: [
                        'Sub.own',
                        NOT_FOUND,
                        NOT_FOUND,
                        NOT_FOUND,
                    ],
                },
            },
        },
    },
    {
        id: 'PROP-CACHE-003',
        covers: 'deleteModelFile then addCTOModel (addModelFile, add): a sub type sees the newly added super type',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            mm.deleteModelFile(BASE);
            mm.addCTOModel(baseCto('  o String c'), 'base2.cto');
            return { before, after: lookups(sub, NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                after: { properties: ['own', 'c'], lookups: ['Sub.own', null, null, 'Base.c'] },
            },
        },
    },
    {
        id: 'PROP-CACHE-004',
        covers: 'deleteModelFile then addModelFiles (add, batch): a sub type sees the newly added super type',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            mm.deleteModelFile(BASE);
            mm.addModelFiles([baseCto('  o String b')], ['base3.cto']);
            return { before, after: lookups(sub, NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                after: { properties: ['own', 'b'], lookups: ['Sub.own', null, 'Base.b', null] },
            },
        },
    },
    {
        id: 'PROP-CACHE-005',
        covers: 'clearModelFiles then addCTOModel (the models replaced): a sub type sees the new super type',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            mm.clearModelFiles();
            const cleared = lookups(sub, NAMES);
            mm.addCTOModel(baseCto('  o String b'), 'base.cto');
            return { before, cleared, after: lookups(sub, NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                cleared: {
                    properties: NOT_FOUND,
                    lookups: [
                        'Sub.own',
                        NOT_FOUND,
                        NOT_FOUND,
                        NOT_FOUND,
                    ],
                },
                after: { properties: ['own', 'b'], lookups: ['Sub.own', null, 'Base.b', null] },
            },
        },
    },
    {
        id: 'PROP-CACHE-006',
        covers: 'a failed addModelFiles batch rolled back: lookups after the roll-back answer as before the batch (the batch validates in the engine, so this pins the outcome rather than isolating the roll-back invalidation)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(SUB_CTO, 'sub.cto', true);
            const sub = mm.getType(`${SUB}.Sub`);
            const before = lookups(sub, NAMES);
            let batch;
            try {
                // The base file is valid; the second file is not, so the
                // whole batch is rolled back after validation has read Sub's
                // lookups with the base file present.
                mm.addModelFiles([baseCto('  o String a'), 'namespace org.acme.cache.bad@1.0.0\nconcept Bad extends Missing {}\n'],
                    ['base.cto', 'bad.cto']);
                batch = 'added';
            } catch (e) {
                batch = e.constructor.name;
            }
            return { before, batch, after: lookups(sub, NAMES) };
        },
        expect: {
            ok: {
                before: {
                    properties: NOT_FOUND,
                    lookups: [
                        'Sub.own',
                        NOT_FOUND,
                        NOT_FOUND,
                        NOT_FOUND,
                    ],
                },
                batch: 'IllegalModelException',
                after: {
                    properties: NOT_FOUND,
                    lookups: [
                        'Sub.own',
                        NOT_FOUND,
                        NOT_FOUND,
                        NOT_FOUND,
                    ],
                },
            },
        },
    },
    {
        id: 'PROP-CACHE-007',
        covers: 'updateModelFile of the file declaring both types: the old views keep their own file\'s super type',
        run: (core) => {
            const mm = new core.ModelManager();
            const cto = (p) => `namespace ${BASE}\nconcept Base {\n${p}\n}\nconcept Sub extends Base {\n  o String own\n}\n`;
            mm.addCTOModel(cto('  o String a'), 'local.cto');
            const sub = mm.getType(`${BASE}.Sub`);
            const before = lookups(sub, NAMES);
            mm.updateModelFile(cto('  o String b'), 'local.cto');
            return { before, old: lookups(sub, NAMES), fresh: lookups(mm.getType(`${BASE}.Sub`), NAMES) };
        },
        expect: {
            ok: {
                before: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                old: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                fresh: { properties: ['own', 'b'], lookups: ['Sub.own', null, 'Base.b', null] },
            },
        },
    },
    {
        id: 'PROP-CACHE-008',
        covers: 'getProperties returns a new array each call, with the same Property objects; mutating it changes nothing',
        run: (core) => {
            const mm = manager(core, '  o String a');
            const sub = mm.getType(`${SUB}.Sub`);
            const base = mm.getType(`${BASE}.Base`);
            const first = sub.getProperties();
            const second = sub.getProperties();
            const result = {
                newArray: first !== second,
                sameObjects: first.length === second.length && first.every((p, i) => p === second[i]),
                inheritedIsBase: second[1] === base.getProperty('a') && second[1] === base.getProperties()[0],
                ownIsOwn: second[0] === sub.getOwnProperties()[0] && second[0] === sub.getProperty('own'),
            };
            first.length = 0;
            second.push(second[0]);
            base.getProperties().length = 0;
            result.afterMutation = lookups(sub, NAMES);
            result.base = lookups(base, NAMES);
            return result;
        },
        expect: {
            ok: {
                newArray: true,
                sameObjects: true,
                inheritedIsBase: true,
                ownIsOwn: true,
                afterMutation: { properties: ['own', 'a'], lookups: ['Sub.own', 'Base.a', null, null] },
                base: { properties: ['a'], lookups: [null, 'Base.a', null, null] },
            },
        },
    },
];
