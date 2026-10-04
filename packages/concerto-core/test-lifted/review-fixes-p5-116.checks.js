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
 * P5-116 lifted checks (accordproject/concerto-rust#486): the TS 5.0.0
 * parity fixes from the second end-to-end review.
 *
 * - R2E-1: `DecoratorManager.falsyOrEqual` is 5.0.0's own body again.
 * - R2A-1: a type written as its own namespace's fully-qualified name
 *   resolves (super type and property type).
 * - R2A-2, R2A-3: `derivesFrom` walks the super types only up to the
 *   target; `isAssignableTo` catches only `getType`'s failure.
 * - R2A-5: of two aliases of one imported name, the last wins.
 * - R2A-6: `getImportURI` answers the last import of a name.
 * - R2A-7: an imported super type that names no declaration fails
 *   `getDirectSubclasses`.
 * - R2B-1, R2B-2, R2B-4: an enum, scalar or unknown `$class` nested in an
 *   instance throws the class TS throws.
 * - DV-023 (maintainer-accepted, R2B-3): an imported map value type is
 *   validated; `reference` holds 5.0.0's outcome, which skips it.
 * - R2A-4, R2E-9: `ModelFile.filter` builds the filtered AST from the
 *   declarations' ASTs (an asset's default super type included), as its
 *   own copy, and the filtered file reloads.
 * - R2F-5: a metamodel version mismatch is a `MetamodelException`.
 * - R2E-12: `ClassDeclaration.toString`.
 *
 * Only public members are used. A throw is reduced to its class (error
 * parity: messages may differ). `expect` is the frozen v5.0.0 reference's
 * outcome, which src matches, except where a check has its own
 * `reference`. Run by fallbacks.spec.js.
 */

/**
 * The outcome of `fn`: its value, or the class of the error it threw.
 * @param {Function} fn the body
 * @returns {Array} `['ok', value]` or `['throws', name]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.constructor ? e.constructor.name : typeof e];
    }
}

const MM = 'concerto.metamodel@1.0.0';

/**
 * A concept declaration AST.
 * @param {string} name the concept's name
 * @param {string} [superType] its super type's name, as written
 * @param {object[]} [properties] its properties
 * @returns {object} the AST
 */
function concept(name, superType, properties = []) {
    const decl = { $class: `${MM}.ConceptDeclaration`, name, isAbstract: false, properties };
    if (superType) {
        decl.superType = { $class: `${MM}.TypeIdentifier`, name: superType };
    }
    return decl;
}

/**
 * An object property AST.
 * @param {string} name the property's name
 * @param {string} type its type's name, as written
 * @returns {object} the AST
 */
function objectProperty(name, type) {
    return { $class: `${MM}.ObjectProperty`, name, isArray: false, isOptional: false,
        type: { $class: `${MM}.TypeIdentifier`, name: type } };
}

/**
 * A model AST.
 * @param {string} namespace the namespace
 * @param {object[]} declarations the declarations
 * @param {object[]} [imports] the imports
 * @returns {object} the AST
 */
function model(namespace, declarations, imports = []) {
    return { $class: `${MM}.Model`, namespace, imports, declarations };
}

/**
 * Adds the model AST `ast` to `mm` as a ModelFile, as v5.0.0's
 * `addModelFile` takes it.
 * @param {object} core the core under test
 * @param {object} mm the model manager
 * @param {object} ast the model AST
 * @param {boolean} [disableValidation] whether to skip validation
 */
function addAst(core, mm, ast, disableValidation) {
    mm.addModelFile(new core.ModelFile(mm, ast), undefined, undefined, disableValidation);
}

const ENUM_MODEL = `namespace org.acme@1.0.0
enum Color {
  o RED
}
scalar SSN extends String
concept Addr {
  o String s
}
map M {
  o String
  o Addr
}
participant Person identified by id {
  o String id
}
concept C {
  o M m optional
  --> Person p optional
  o Concept c optional
}
`;

/**
 * `Serializer.fromJSON` of `json` over ENUM_MODEL, validated.
 * @param {object} core the core under test
 * @param {object} json the instance
 * @returns {Array} the probe
 */
function fromEnumModel(core, json) {
    const mm = new core.ModelManager();
    mm.addCTOModel(ENUM_MODEL, 'acme.cto');
    const serializer = new core.Serializer(new core.Factory(mm), mm);
    return probe(() => serializer.toJSON(serializer.fromJSON(json, { validate: true })));
}

const ASSETS = 'namespace a@1.0.0\nasset A identified by id {\n  o String id\n}\nparticipant P identified by id {\n  o String id\n}\nconcept C {\n  o String s\n}\n';

/**
 * The super types of a model file AST's declarations, by name.
 * @param {object} ast the model file AST
 * @returns {Array} `[name, superType]` pairs
 */
function superTypes(ast) {
    return ast.declarations.map((d) => [d.name, d.superType ? `${d.superType.$class}:${d.superType.name}` : null]);
}

module.exports = [
    {
        id: 'P5116-E1-001',
        covers: 'R2E-1: DecoratorManager.falsyOrEqual is 5.0.0\'s body: substring, array intersection, and the TypeError for undefined values',
        run: (core) => ({
            substring: probe(() => core.DecoratorManager.falsyOrEqual('MapDeclaration', `${MM}.MapDeclaration`)),
            arrayInString: probe(() => core.DecoratorManager.falsyOrEqual(['a'], 'abc')),
            numbers: probe(() => core.DecoratorManager.falsyOrEqual([1], [1])),
            undefinedValues: probe(() => core.DecoratorManager.falsyOrEqual('x', undefined)),
            falsy: probe(() => core.DecoratorManager.falsyOrEqual(null, ['one'])),
            miss: probe(() => core.DecoratorManager.falsyOrEqual('one', ['two'])),
        }),
        expect: { ok: {
            substring: ['ok', true],
            arrayInString: ['ok', true],
            numbers: ['ok', true],
            undefinedValues: ['throws', 'TypeError'],
            falsy: ['ok', true],
            miss: ['ok', false],
        } },
    },
    {
        id: 'P5116-A1-001',
        covers: 'R2A-1: a super type and a property type written as their own namespace\'s fully-qualified name resolve, with validation',
        run: (core) => {
            const mm = new core.ModelManager();
            const loaded = probe(() => {
                addAst(core, mm, model('d@1.0.0', [
                    concept('A', 'd@1.0.0.B'),
                    concept('B'),
                    concept('C', undefined, [objectProperty('b', 'd@1.0.0.B')]),
                ]));
                return true;
            });
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            return {
                loaded,
                derivesFrom: probe(() => mm.derivesFrom('d@1.0.0.A', 'd@1.0.0.B')),
                fieldType: probe(() => mm.getType('d@1.0.0.C').getProperty('b').getFullyQualifiedTypeName()),
                roundTrip: probe(() => serializer.toJSON(serializer.fromJSON(
                    { $class: 'd@1.0.0.C', b: { $class: 'd@1.0.0.A' } }))),
            };
        },
        expect: { ok: {
            loaded: ['ok', true],
            derivesFrom: ['ok', true],
            fieldType: ['ok', 'd@1.0.0.B'],
            roundTrip: ['ok', { $class: 'd@1.0.0.C', b: { $class: 'd@1.0.0.A' } }],
        } },
    },
    {
        id: 'P5116-A2-001',
        covers: 'R2A-2, R2A-3: with A extends B extends Missing (validation off), derivesFrom(A, B) is true, and the walk past B throws from derivesFrom and isAssignableTo alike',
        run: (core) => {
            const mm = new core.ModelManager();
            addAst(core, mm, model('d@1.0.0', [concept('A', 'B'), concept('B', 'Missing')]), true);
            return {
                derivesFromB: probe(() => mm.derivesFrom('d@1.0.0.A', 'd@1.0.0.B')),
                derivesFromConcept: probe(() => mm.derivesFrom('d@1.0.0.A', 'concerto@1.0.0.Concept')),
                assignableToB: probe(() => mm.isAssignableTo('d@1.0.0.A', 'd@1.0.0.B')),
                assignableToConcept: probe(() => mm.isAssignableTo('d@1.0.0.A', 'concerto@1.0.0.Concept')),
                assignableToNonString: probe(() => mm.isAssignableTo('d@1.0.0.A', 42)),
                unknownAssignable: probe(() => mm.isAssignableTo('d@1.0.0.Nope', 'd@1.0.0.B')),
            };
        },
        expect: { ok: {
            derivesFromB: ['ok', true],
            derivesFromConcept: ['throws', 'IllegalModelException'],
            assignableToB: ['ok', true],
            assignableToConcept: ['throws', 'IllegalModelException'],
            assignableToNonString: ['throws', 'IllegalModelException'],
            unknownAssignable: ['ok', false],
        } },
    },
    {
        id: 'P5116-A5-001',
        covers: 'R2A-5: of two aliases of one imported name in one ImportTypes, the last wins',
        run: (core) => {
            const mm = new core.ModelManager();
            addAst(core, mm, model('b@1.0.0', [concept('Foo')]));
            const loaded = probe(() => {
                addAst(core, mm, model('c@1.0.0', [concept('Bar1', undefined, [objectProperty('f', 'Baz')])], [{
                    $class: `${MM}.ImportTypes`, namespace: 'b@1.0.0', types: ['Foo', 'Foo'],
                    aliasedTypes: [
                        { $class: `${MM}.AliasedType`, name: 'Foo', aliasedName: 'Bar' },
                        { $class: `${MM}.AliasedType`, name: 'Foo', aliasedName: 'Baz' },
                    ],
                }]));
                return true;
            });
            const mf = mm.getModelFile('c@1.0.0');
            return {
                loaded,
                baz: probe(() => mf.getFullyQualifiedTypeName('Baz')),
                bar: probe(() => mf.getFullyQualifiedTypeName('Bar')),
                field: probe(() => mm.getType('c@1.0.0.Bar1').getProperty('f').getFullyQualifiedTypeName()),
            };
        },
        expect: { ok: {
            loaded: ['ok', true],
            baz: ['ok', 'b@1.0.0.Foo'],
            bar: ['ok', null],
            field: ['ok', 'b@1.0.0.Foo'],
        } },
    },
    {
        id: 'P5116-A6-001',
        covers: 'R2A-6: getImportURI answers the last import of a name, as getExternalImports does',
        run: (core) => {
            const mm = new core.ModelManager();
            addAst(core, mm, model('c@1.0.0', [concept('X')], [
                { $class: `${MM}.ImportType`, namespace: 'a@1.0.0', name: 'Foo', uri: 'u1' },
                { $class: `${MM}.ImportTypes`, namespace: 'a@1.0.0', types: ['Foo', 'Bar'], uri: 'u2' },
            ]), true);
            const mf = mm.getModelFile('c@1.0.0');
            return {
                uri: mf.getImportURI('a@1.0.0.Foo'),
                external: mf.getExternalImports()['a@1.0.0.Foo'],
            };
        },
        expect: { ok: { uri: 'u2', external: 'u2' } },
    },
    {
        id: 'P5116-A7-001',
        covers: 'R2A-7: an imported super type naming a declaration its loaded namespace lacks (validation off) fails getDirectSubclasses and getAssignableClassDeclarations',
        run: (core) => {
            const mm = new core.ModelManager();
            addAst(core, mm, model('b@1.0.0', [concept('Other')]));
            addAst(core, mm, model('a@1.0.0', [concept('A', 'Missing')],
                [{ $class: `${MM}.ImportTypes`, namespace: 'b@1.0.0', types: ['Missing'] }]), true);
            const other = mm.getType('b@1.0.0.Other');
            return {
                direct: probe(() => other.getDirectSubclasses().map((d) => d.getFullyQualifiedName())),
                assignable: probe(() => other.getAssignableClassDeclarations().map((d) => d.getFullyQualifiedName())),
            };
        },
        expect: { ok: {
            direct: ['throws', 'TypeNotFoundException'],
            assignable: ['throws', 'TypeNotFoundException'],
        } },
    },
    {
        id: 'P5116-B1-001',
        covers: 'R2B-1: a map value of a concept type whose $class names a scalar or an enum is a ValidationException',
        run: (core) => ({
            scalar: fromEnumModel(core, { $class: 'org.acme@1.0.0.C', m: { k: { $class: 'org.acme@1.0.0.SSN' } } }),
            enum: fromEnumModel(core, { $class: 'org.acme@1.0.0.C', m: { k: { $class: 'org.acme@1.0.0.Color' } } }),
        }),
        expect: { ok: {
            scalar: ['throws', 'ValidationException'],
            enum: ['throws', 'ValidationException'],
        } },
    },
    {
        id: 'P5116-B2-001',
        covers: 'R2B-2: a relationship to an enum is the plain Error "not identifiable"; an enum on a Concept field is walked as a resource (ValidationException)',
        run: (core) => ({
            relationship: fromEnumModel(core, { $class: 'org.acme@1.0.0.C', p: 'resource:org.acme@1.0.0.Color#RED' }),
            conceptField: fromEnumModel(core, { $class: 'org.acme@1.0.0.C', c: { $class: 'org.acme@1.0.0.Color' } }),
        }),
        expect: { ok: {
            relationship: ['throws', 'Error'],
            conceptField: ['throws', 'ValidationException'],
        } },
    },
    {
        id: 'P5116-B4-001',
        covers: 'R2B-4: a nested resource whose own $class is no longer declared is a field type violation (ValidationException)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace a@1.0.0\nconcept Addr {\n  o String s\n}\nconcept Holder {\n  o Addr addr\n}\n', 'a.cto');
            mm.addCTOModel('namespace b@1.0.0\nimport a@1.0.0.{Addr}\nconcept SubAddr extends Addr {\n}\n', 'b.cto');
            const factory = new core.Factory(mm);
            const holder = factory.newConcept('a@1.0.0', 'Holder');
            const sub = factory.newConcept('b@1.0.0', 'SubAddr');
            sub.s = 'x';
            holder.addr = sub;
            mm.deleteModelFile('b@1.0.0');
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            return probe(() => serializer.toJSON(holder));
        },
        expect: { ok: ['throws', 'ValidationException'] },
    },
    {
        id: 'P5116-B3-001',
        covers: 'DV-023 (maintainer-accepted, R2B-3): a map value whose concept type is imported is validated; v5.0.0 found only the map file\'s own declarations and skipped it',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace a@1.0.0\nconcept Addr {\n  o String s\n}\n', 'a.cto');
            mm.addCTOModel('namespace b@1.0.0\nimport a@1.0.0.{Addr}\nmap M {\n  o String\n  o Addr\n}\nconcept C {\n  o M m\n}\n', 'b.cto');
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            return {
                invalid: probe(() => serializer.toJSON(serializer.fromJSON(
                    { $class: 'b@1.0.0.C', m: { k: { $class: 'a@1.0.0.Addr' } } }))),
                valid: probe(() => serializer.toJSON(serializer.fromJSON(
                    { $class: 'b@1.0.0.C', m: { k: { $class: 'a@1.0.0.Addr', s: 'x' } } }))),
            };
        },
        expect: { ok: {
            invalid: ['throws', 'ValidationException'],
            valid: ['ok', { $class: 'b@1.0.0.C', m: { k: { $class: 'a@1.0.0.Addr', s: 'x' } } }],
        } },
        reference: { ok: {
            invalid: ['ok', { $class: 'b@1.0.0.C', m: { k: { $class: 'a@1.0.0.Addr' } } }],
            valid: ['ok', { $class: 'b@1.0.0.C', m: { k: { $class: 'a@1.0.0.Addr', s: 'x' } } }],
        } },
    },
    {
        id: 'P5116-A4-001',
        covers: 'R2A-4, R2E-9: ModelFile.filter builds the filtered AST from the declarations\' ASTs (an asset\'s and a participant\'s default super type included), as its own copy, and it reloads',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(ASSETS, 'a.cto');
            const source = mm.getModelFile('a@1.0.0');
            const target = new core.ModelManager();
            const all = source.filter(() => true, target);
            const some = source.filter((d) => d.getName() !== 'C', new core.ModelManager());
            return {
                source: superTypes(source.getAst()),
                all: superTypes(all.getAst()),
                some: superTypes(some.getAst()),
                ownAst: all.getAst() !== source.getAst(),
                ownDeclarations: all.getAst().declarations !== source.getAst().declarations,
                reload: probe(() => {
                    target.addModelFile(all);
                    return target.getType('a@1.0.0.A').getSuperType();
                }),
            };
        },
        expect: { ok: {
            source: [['A', null], ['P', null], ['C', null]],
            all: [['A', `${MM}.TypeIdentified:Asset`], ['P', `${MM}.TypeIdentified:Participant`], ['C', null]],
            some: [['A', `${MM}.TypeIdentified:Asset`], ['P', `${MM}.TypeIdentified:Participant`]],
            ownAst: true,
            ownDeclarations: true,
            reload: ['ok', 'concerto@1.0.0.Asset'],
        } },
    },
    {
        id: 'P5116-A4-002',
        covers: 'R2A-4, R2E-9: ModelManager.filter\'s files carry the default super types and are not the source\'s AST objects; the result validates (BC-19\'s shape check accepts them). v5.0.0\'s filter re-adds the decorator model and throws (BC-53)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(ASSETS, 'a.cto');
            const filtered = mm.filter(() => true);
            const mf = filtered.getModelFile('a@1.0.0');
            filtered.validateModelFiles();
            return {
                all: superTypes(mf.getAst()),
                ownAst: mf.getAst() !== mm.getModelFile('a@1.0.0').getAst(),
            };
        },
        expect: { ok: {
            all: [['A', `${MM}.TypeIdentified:Asset`], ['P', `${MM}.TypeIdentified:Participant`], ['C', null]],
            ownAst: true,
        } },
        reference: { throws: { name: 'Error', message: 'Namespace concerto.decorator@1.0.0 specified in file concerto_decorator_1.0.0.cto is already declared in file concerto_decorator_1.0.0.cto' } },
    },
    {
        id: 'P5116-F5-001',
        covers: 'R2F-5: a metamodel version mismatch is a MetamodelException with metamodelValidation: true',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: true });
            return probe(() => addAst(core, mm, { $class: 'concerto.metamodel@99.0.0.Model', decorators: [],
                namespace: 'org.mm002@1.0.0', imports: [], declarations: [] }));
        },
        expect: { ok: ['throws', 'MetamodelException'] },
    },
    {
        id: 'P5116-E12-001',
        covers: 'R2E-12: ClassDeclaration.toString reads isEnum() and isAbstract(), and a truthy super type',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`${ASSETS}abstract concept D extends C {\n}\n`, 'a.cto');
            return ['a@1.0.0.A', 'a@1.0.0.C', 'a@1.0.0.D'].map((fqn) => mm.getType(fqn).toString());
        },
        expect: { ok: [
            'ClassDeclaration {id=a@1.0.0.A super=Asset enum=false abstract=false}',
            'ClassDeclaration {id=a@1.0.0.C super=Concept enum=false abstract=false}',
            'ClassDeclaration {id=a@1.0.0.D super=C enum=false abstract=true}',
        ] },
    },
];
