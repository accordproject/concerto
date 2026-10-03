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
 * P5-106 lifted checks (accordproject/concerto-rust#460, BC-52): the
 * members the retired JsContext callback bindings served answer from the
 * engine's arena.
 *
 * `ModelUtil.isAssignableTo`, `isEnum`, `isMap`, `isScalar` and
 * `isValidMapKeyScalar`, `ScalarDeclaration.validate`, decorator validation
 * and `ClassDeclaration.getAssignableClassDeclarations`/`getDirectSubclasses`
 * no longer call replaced `getType`, `getSuperType`, `getModelFiles` (or
 * `getAllDeclarations`, `getAllSuperTypeDeclarations`) methods: BC52-001 to
 * BC52-004 replace them on real objects and get the model's own answers,
 * where v5.0.0 (`reference`) followed the replacements. BC52-005 and
 * BC52-006 pin what a model element outside the arena (a ModelFile that is
 * not registered in its manager) gets. BC52-007 and BC52-008 check the
 * engine's cached subclass map against model changes and a cyclic chain.
 * A throw is reduced to its class (error parity, maintainer decision
 * 2026-09-27).
 *
 * Run by fallbacks.spec.js.
 */

const NS = 'org.acme.bc52@1.0.0';

const MODEL = `namespace ${NS}
concept Dec { o String v }
concept Base {}
concept Sub extends Base {}
@Dec("x")
concept Leaf extends Sub {}
enum Color { o RED }
scalar S extends String
map M { o String o String }
concept Holder {
  o Base b
  o Color c
  o S s
  o M m
}
`;

/**
 * Runs `fn`, reducing a throw to its class.
 * @param {Function} fn the call
 * @returns {Array} `['ok', value]` or `['throws', class]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.constructor ? e.constructor.name : typeof e];
    }
}

/**
 * A manager holding MODEL, with decorator validation on when asked.
 * @param {object} core the core under test
 * @param {boolean} [decorators] turn decorator validation on (`error`)
 * @returns {object} `{ mm, mf, holder }`
 */
function setup(core, decorators) {
    const mm = decorators
        ? new core.ModelManager({ decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } })
        : new core.ModelManager();
    mm.addCTOModel(MODEL, 'bc52.cto');
    const mf = mm.getModelFile(NS);
    return { mm, mf, holder: mm.getType(`${NS}.Holder`) };
}

/**
 * Names of declarations.
 * @param {object[]} decls the declarations
 * @returns {string[]} their fully qualified names
 */
function names(decls) {
    return decls.map((d) => d.getFullyQualifiedName());
}

module.exports = [
    {
        id: 'BC52-001',
        covers: 'BC-52: ModelUtil.isEnum/isMap/isScalar/isAssignableTo ignore a replaced ModelFile.getType on a registered file',
        run: (core) => {
            const { mf, holder } = setup(core);
            mf.getType = () => null;
            return {
                isEnum: probe(() => core.ModelUtil.isEnum(holder.getProperty('c'))),
                isMap: probe(() => core.ModelUtil.isMap(holder.getProperty('m'))),
                isScalar: probe(() => core.ModelUtil.isScalar(holder.getProperty('s'))),
                isAssignableTo: probe(() => core.ModelUtil.isAssignableTo(mf, `${NS}.Leaf`, holder.getProperty('b'))),
                notAssignable: probe(() => core.ModelUtil.isAssignableTo(mf, `${NS}.Holder`, holder.getProperty('b'))),
            };
        },
        expect: { ok: {
            isEnum: ['ok', true],
            isMap: ['ok', true],
            isScalar: ['ok', true],
            isAssignableTo: ['ok', true],
            notAssignable: ['ok', false],
        } },
        reference: { ok: {
            isEnum: ['ok', '<undefined>'],
            isMap: ['ok', '<undefined>'],
            isScalar: ['ok', '<undefined>'],
            isAssignableTo: ['throws', 'Error'],
            notAssignable: ['throws', 'Error'],
        } },
    },
    {
        id: 'BC52-002',
        covers: 'BC-52: getAssignableClassDeclarations/getDirectSubclasses ignore a replaced getSuperType (prototype) and getModelFiles (manager)',
        run: (core) => {
            const { mm } = setup(core);
            const base = mm.getType(`${NS}.Base`);
            const proto = Object.getPrototypeOf(base);
            const owner = Object.prototype.hasOwnProperty.call(proto, 'getSuperType') ? proto : Object.getPrototypeOf(proto);
            const original = owner.getSuperType;
            owner.getSuperType = () => null;
            mm.getModelFiles = () => [];
            try {
                return {
                    assignable: probe(() => names(base.getAssignableClassDeclarations())),
                    direct: probe(() => names(base.getDirectSubclasses())),
                };
            } finally {
                owner.getSuperType = original;
            }
        },
        expect: { ok: {
            assignable: ['ok', [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`]],
            direct: ['ok', [`${NS}.Sub`]],
        } },
        reference: { ok: {
            assignable: ['ok', [`${NS}.Base`]],
            direct: ['ok', []],
        } },
    },
    {
        id: 'BC52-003',
        covers: 'BC-52: ScalarDeclaration.validate ignores a replaced ModelFile.getAllDeclarations',
        run: (core) => {
            const { mm, mf } = setup(core);
            const scalar = mm.getType(`${NS}.S`);
            mf.getAllDeclarations = () => [scalar, scalar];
            return probe(() => scalar.validate());
        },
        expect: { ok: ['ok', '<undefined>'] },
        reference: { ok: ['throws', 'IllegalModelException'] },
    },
    {
        id: 'BC52-004',
        covers: 'BC-52: decorator validation ignores a replaced ModelFile.getType',
        run: (core) => {
            const { mm, mf } = setup(core, true);
            const leaf = mm.getType(`${NS}.Leaf`);
            mf.getType = () => null;
            return probe(() => leaf.getDecorator('Dec').validate());
        },
        expect: { ok: ['ok', '<undefined>'] },
        reference: { ok: ['throws', 'IllegalModelException'] },
    },
    {
        id: 'BC52-005',
        covers: 'BC-52: a ModelFile not registered in its manager resolves no type (isEnum/isMap/isScalar undefined, isAssignableTo cannot find the type); a primitive or direct match still answers',
        run: (core) => {
            const { mm, mf } = setup(core);
            const detached = new core.ModelFile(mm, mf.getAst(), undefined, 'detached.cto');
            const holder = detached.getLocalType('Holder');
            return {
                isEnum: probe(() => core.ModelUtil.isEnum(holder.getProperty('c'))),
                isMap: probe(() => core.ModelUtil.isMap(holder.getProperty('m'))),
                isScalar: probe(() => core.ModelUtil.isScalar(holder.getProperty('s'))),
                isAssignableTo: probe(() => core.ModelUtil.isAssignableTo(detached, `${NS}.Leaf`, holder.getProperty('b'))),
                directMatch: probe(() => core.ModelUtil.isAssignableTo(detached, `${NS}.Base`, holder.getProperty('b'))),
                primitive: probe(() => core.ModelUtil.isAssignableTo(detached, 'String', holder.getProperty('b'))),
            };
        },
        expect: { ok: {
            isEnum: ['ok', '<undefined>'],
            isMap: ['ok', '<undefined>'],
            isScalar: ['ok', '<undefined>'],
            isAssignableTo: ['throws', 'Error'],
            directMatch: ['ok', true],
            primitive: ['ok', false],
        } },
        reference: { ok: {
            isEnum: ['ok', true],
            isMap: ['ok', true],
            isScalar: ['ok', true],
            isAssignableTo: ['ok', true],
            directMatch: ['ok', true],
            primitive: ['ok', false],
        } },
    },
    {
        id: 'BC52-006',
        covers: 'BC-52: a declaration of a ModelFile not registered in its manager has no arena answer: a TypeError',
        run: (core) => {
            const { mm, mf } = setup(core, true);
            const detached = new core.ModelFile(mm, mf.getAst(), undefined, 'detached.cto');
            return {
                assignable: probe(() => names(detached.getLocalType('Base').getAssignableClassDeclarations())),
                direct: probe(() => names(detached.getLocalType('Base').getDirectSubclasses())),
                isValidMapKeyScalar: probe(() => core.ModelUtil.isValidMapKeyScalar(detached.getLocalType('S'))),
                scalarValidate: probe(() => detached.getLocalType('S').validate()),
                decoratorValidate: probe(() => detached.getLocalType('Leaf').getDecorator('Dec').validate()),
                nullish: probe(() => core.ModelUtil.isValidMapKeyScalar(null)),
            };
        },
        expect: { ok: {
            assignable: ['throws', 'TypeError'],
            direct: ['throws', 'TypeError'],
            isValidMapKeyScalar: ['throws', 'TypeError'],
            scalarValidate: ['throws', 'TypeError'],
            decoratorValidate: ['throws', 'TypeError'],
            nullish: ['ok', '<undefined>'],
        } },
        reference: { ok: {
            assignable: ['ok', [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`]],
            direct: ['ok', [`${NS}.Sub`]],
            isValidMapKeyScalar: ['ok', true],
            scalarValidate: ['ok', '<undefined>'],
            decoratorValidate: ['ok', '<undefined>'],
            nullish: ['ok', '<undefined>'],
        } },
    },
    {
        id: 'BC52-007',
        covers: 'P5-106: the subclass queries follow model changes (a file added, updated and deleted) and an imported super type',
        run: (core) => {
            const { mm } = setup(core);
            const base = () => mm.getType(`${NS}.Base`);
            const query = () => ({
                assignable: names(base().getAssignableClassDeclarations()),
                direct: names(base().getDirectSubclasses()),
            });
            const before = query();
            mm.addCTOModel(`namespace org.acme.bc52.ext@1.0.0\nimport ${NS}.{Base, Sub}\nconcept Ext extends Base {}\nconcept Deep extends Sub {}\n`, 'ext.cto');
            const added = query();
            mm.updateModelFile(`namespace org.acme.bc52.ext@1.0.0\nimport ${NS}.{Base}\nconcept Ext2 extends Base {}\n`, 'ext.cto');
            const updated = query();
            mm.deleteModelFile('org.acme.bc52.ext@1.0.0');
            const deleted = query();
            return { before, added, updated, deleted };
        },
        expect: { ok: {
            before: { assignable: [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`], direct: [`${NS}.Sub`] },
            added: {
                assignable: [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`, 'org.acme.bc52.ext@1.0.0.Deep', 'org.acme.bc52.ext@1.0.0.Ext'],
                direct: [`${NS}.Sub`, 'org.acme.bc52.ext@1.0.0.Ext'],
            },
            updated: {
                assignable: [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`, 'org.acme.bc52.ext@1.0.0.Ext2'],
                direct: [`${NS}.Sub`, 'org.acme.bc52.ext@1.0.0.Ext2'],
            },
            deleted: { assignable: [`${NS}.Base`, `${NS}.Sub`, `${NS}.Leaf`], direct: [`${NS}.Sub`] },
        } },
    },
    {
        id: 'BC52-008',
        covers: 'P5-106: getAssignableClassDeclarations below a cyclic chain (validation disabled) is the BC-11 IllegalModelException; getDirectSubclasses answers',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace org.acme.bc52.cycle@1.0.0\nconcept A extends C {}\nconcept B extends A {}\nconcept C extends B {}\n', 'cycle.cto', true);
            const a = mm.getModelFile('org.acme.bc52.cycle@1.0.0').getLocalType('A');
            return {
                assignable: probe(() => names(a.getAssignableClassDeclarations())),
                direct: probe(() => names(a.getDirectSubclasses())),
            };
        },
        expect: { ok: {
            assignable: ['throws', 'IllegalModelException'],
            direct: ['ok', ['org.acme.bc52.cycle@1.0.0.B']],
        } },
        reference: { ok: {
            assignable: ['throws', 'RangeError'],
            direct: ['ok', ['org.acme.bc52.cycle@1.0.0.B']],
        } },
    },
];
