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
 * P5-98 lifted checks (accordproject/concerto-rust#452): the review fixes
 * that are visible from JS.
 *
 * - A-1: an enum derives from, and is assignable to, its implicit
 *   `concerto@1.0.0.Concept` super type (`derivesFrom`, `isAssignableTo`);
 *   a scalar does not.
 * - A-2: when two imports give the same local name, the last one wins for
 *   `extends` and for a field's type alike (TS `importShortNames`'
 *   `Map.set`), for two user imports and for a user import of a system
 *   type name, which the built-in import appended last overrides.
 * - C-11: the DCS converter (`jsonToYaml`) and the vocabulary extractor
 *   (`extractDecorators`) write a number as JS `String(value)` does
 *   (`0.000001`, `1e+21`).
 * - E-12: an engine-thrown `IllegalModelException` has the same enumerable
 *   own keys as v5.0.0's: the engine's internal flags are not enumerable.
 * - F-1: after a super type's model file is updated, a subclass in another
 *   file still validates on the engine path (`ValidatedResource.validate()`
 *   reaches `validateResourceBinary`); the reference, with no engine, only
 *   checks the verdicts.
 *
 * Only public members are used, except F-1's count of the engine binding
 * calls (on the manager's `rustHandle`, absent on the reference). `expect`
 * is the frozen v5.0.0 reference's outcome, which src matches, so no check
 * needs a `reference`. Run by fallbacks.spec.js.
 */

/**
 * The outcome of `fn`: its value, or the class and message of the error it
 * threw.
 * @param {Function} fn the body
 * @returns {Array} `['ok', value]` or `['throws', name, message]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.constructor ? e.constructor.name : typeof e, e && e.message];
    }
}

/**
 * How `c@1.0.0.Bar extends <short> { o <short> f }` resolves `short`: its
 * super type, its properties, its field's type, and the model file's own
 * resolution of the name.
 * @param {object} mm the model manager
 * @param {string} short the name both the super type and the field use
 * @returns {object} the resolutions
 */
function barResolution(mm, short) {
    const bar = mm.getType('c@1.0.0.Bar');
    return {
        superType: bar.getSuperTypeDeclaration().getFullyQualifiedName(),
        properties: bar.getProperties().map((p) => p.getName()),
        field: bar.getProperty('f').getFullyQualifiedTypeName(),
        modelFile: bar.getModelFile().getFullyQualifiedTypeName(short),
        resolveImport: bar.getModelFile().resolveImport(short),
    };
}

/**
 * A DecoratorCommandSet with one command, whose decorator has the number
 * arguments `values`.
 * @param {number[]} values the `DecoratorNumber` values
 * @returns {object} the DCS JSON
 */
function numberDcs(values) {
    return {
        $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
        name: 'numbers',
        version: '1.0.0',
        commands: [{
            $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
            type: 'APPEND',
            target: { $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget', namespace: 'test@1.0.0' },
            decorator: {
                $class: 'concerto.metamodel@1.0.0.Decorator',
                name: 'd',
                arguments: values.map((value) => ({ $class: 'concerto.metamodel@1.0.0.DecoratorNumber', value })),
            },
        }],
    };
}

/**
 * Counts the calls of the engine binding `name` on `mm`'s `rustHandle`,
 * when it has one.
 * @param {object} mm the model manager
 * @param {string} name the binding
 * @returns {object} `{ calls }`, updated as the binding is called
 */
function countCalls(mm, name) {
    const counter = { calls: 0 };
    const handle = mm.rustHandle;
    if (handle && typeof handle[name] === 'function') {
        const original = handle[name];
        handle[name] = function (...args) {
            counter.calls++;
            return original.apply(this, args);
        };
    }
    return counter;
}

const BASE_ID = 'namespace a@1.0.0\nabstract concept Base identified by id {\n  o String id\n}\n';
const BASE_VIN = 'namespace a@1.0.0\nabstract concept Base identified by vin {\n  o String vin\n}\n';
const CAR = 'namespace b@1.0.0\nimport a@1.0.0.{Base}\nconcept Car extends Base {\n  o String colour\n}\n';

/**
 * F-1: three validations of a `b@1.0.0.Car` before and after the update of
 * its super type's file `a` (its identifying field `id` becomes `vin`),
 * and how many of each reached the engine.
 * @param {object} core the core under test
 * @returns {object} the verdicts, and whether every validation of a
 * manager with an engine ran on the engine path
 */
function validateAcrossSuperTypeUpdate(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(BASE_ID, 'a.cto');
    mm.addCTOModel(CAR, 'b.cto');
    const engine = Boolean(mm.rustHandle);
    const counter = countCalls(mm, 'validateResourceBinary');
    const validateThrice = (field) => {
        const factory = new core.Factory(mm);
        const verdicts = [];
        for (let i = 0; i < 3; i++) {
            const car = factory.newResource('b@1.0.0', 'Car', `car${i}`);
            car.colour = 'red';
            verdicts.push(probe(() => {
                car.validate();
                return [car.getIdentifierFieldName ? car.getIdentifierFieldName() : car.$identifierFieldName, car.getIdentifier()];
            }));
        }
        return { field, verdicts };
    };
    const before = validateThrice('id');
    const callsBefore = counter.calls;
    mm.updateModelFile(BASE_VIN, 'a.cto');
    const after = validateThrice('vin');
    const callsAfter = counter.calls - callsBefore;
    return {
        before,
        after,
        enginePath: !engine || (callsBefore === 3 && callsAfter === 3),
    };
}

module.exports = [
    {
        id: 'P598-A1-001',
        covers: 'A-1: derivesFrom and isAssignableTo walk an enum\'s implicit Concept super type; a scalar has none',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace test@1.0.0\nenum Color {\n  o RED\n}\nscalar SSN extends String\nconcept Person {\n  o String name\n}\n', 'test.cto');
            return {
                enumDerivesFromConcept: mm.derivesFrom('test@1.0.0.Color', 'concerto@1.0.0.Concept'),
                enumAssignableToConcept: mm.isAssignableTo('test@1.0.0.Color', 'concerto@1.0.0.Concept'),
                enumDerivesFromPerson: mm.derivesFrom('test@1.0.0.Color', 'test@1.0.0.Person'),
                scalarDerivesFromConcept: mm.derivesFrom('test@1.0.0.SSN', 'concerto@1.0.0.Concept'),
            };
        },
        expect: { ok: {
            enumDerivesFromConcept: true,
            enumAssignableToConcept: true,
            enumDerivesFromPerson: false,
            scalarDerivesFromConcept: false,
        } },
    },
    {
        id: 'P598-A2-001',
        covers: 'A-2: of two imports of the same name, the last wins for extends and for a field type',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace a@1.0.0\nconcept Foo {\n  o String a\n}\n', 'a.cto');
            mm.addCTOModel('namespace b@1.0.0\nconcept Foo {\n  o String b\n}\n', 'b.cto');
            mm.addCTOModel('namespace c@1.0.0\nimport a@1.0.0.Foo\nimport b@1.0.0.Foo\nconcept Bar extends Foo {\n  o Foo f\n}\n', 'c.cto');
            return Object.assign(barResolution(mm, 'Foo'), {
                derivesFromB: mm.derivesFrom('c@1.0.0.Bar', 'b@1.0.0.Foo'),
                derivesFromA: mm.derivesFrom('c@1.0.0.Bar', 'a@1.0.0.Foo'),
            });
        },
        expect: { ok: {
            superType: 'b@1.0.0.Foo',
            properties: ['f', 'b'],
            field: 'b@1.0.0.Foo',
            modelFile: 'b@1.0.0.Foo',
            resolveImport: 'b@1.0.0.Foo',
            derivesFromB: true,
            derivesFromA: false,
        } },
    },
    {
        id: 'P598-A2-002',
        covers: 'A-2: the built-in import, appended last, wins over a user import of a system type name, for extends and for a field type',
        run: (core) => {
            const mm = new core.ModelManager({ dangerouslyAllowReservedSystemTypeNamesInUserModels: true });
            mm.addCTOModel('namespace x@1.0.0\nconcept Concept {\n  o String x\n}\n', 'x.cto');
            mm.addCTOModel('namespace c@1.0.0\nimport x@1.0.0.Concept\nconcept Bar extends Concept {\n  o Concept f\n}\n', 'c.cto');
            return barResolution(mm, 'Concept');
        },
        expect: { ok: {
            superType: 'concerto@1.0.0.Concept',
            properties: ['f'],
            field: 'concerto@1.0.0.Concept',
            modelFile: 'concerto@1.0.0.Concept',
            resolveImport: 'concerto@1.0.0.Concept',
        } },
    },
    {
        id: 'P598-C11-001',
        covers: 'C-11: jsonToYaml writes a DecoratorNumber value as JS String(value)',
        run: (core) => {
            const { jsonToYaml } = core.dcsConverterModule.default || core.dcsConverterModule;
            return jsonToYaml(numberDcs([0.000001, 1e21, 2.5]));
        },
        expect: { ok: 'decoratorCommandsVersion: 0.4.0\nname: numbers\nversion: 1.0.0\ncommands:\n' +
            '  - action: APPEND\n    target:\n      namespace: test@1.0.0\n    decorator:\n      name: d\n      arguments:\n' +
            '        - type: Number\n          value: 0.000001\n' +
            '        - type: Number\n          value: 1e+21\n' +
            '        - type: Number\n          value: 2.5\n' },
    },
    {
        id: 'P598-C11-002',
        covers: 'C-11: extractDecorators writes a vocabulary decorator\'s number argument as JS String(value)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace test@1.0.0\nconcept P {\n  @Term_unit(0.000001)\n  @Term_max(1e21)\n  o Integer age\n}\n', 'test.cto');
            return core.DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel: false, locale: 'en' }).vocabularies;
        },
        expect: { ok: ['locale: en\nnamespace: test@1.0.0\ndeclarations:\n  - P: P\n    properties:\n      - age: age\n        unit: 0.000001\n        max: 1e+21\n'] },
    },
    {
        id: 'P598-E12-001',
        covers: 'E-12: an engine-thrown IllegalModelException has v5.0.0\'s enumerable own keys',
        run: (core) => {
            const mm = new core.ModelManager();
            try {
                mm.addCTOModel('namespace test@1.0.0\nconcept P identified by id {\n  o String id optional\n}\n', 'test.cto');
            } catch (e) {
                return { name: e.constructor.name, message: e.message, keys: Object.keys(e).sort() };
            }
            return 'no error';
        },
        expect: { ok: {
            name: 'IllegalModelException',
            message: 'Identifying fields cannot be optional. File \'test.cto\': ',
            keys: ['component', 'errorType', 'fileLocation', 'fileName', 'name', 'shortMessage'],
        } },
    },
    {
        id: 'P598-F1-001',
        covers: 'F-1: a super type update in another file keeps the subclass\'s validation on the engine path',
        run: (core) => validateAcrossSuperTypeUpdate(core),
        expect: { ok: {
            before: { field: 'id', verdicts: [['ok', ['id', 'car0']], ['ok', ['id', 'car1']], ['ok', ['id', 'car2']]] },
            after: { field: 'vin', verdicts: [['ok', ['vin', 'car0']], ['ok', ['vin', 'car1']], ['ok', ['vin', 'car2']]] },
            enginePath: true,
        } },
    },
];
