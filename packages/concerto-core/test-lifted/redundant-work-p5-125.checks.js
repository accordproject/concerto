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
 * P5-125 lifted checks (accordproject/concerto-rust#502): the redundant
 * TS-side work removed (a second encode, checks the engine already made,
 * uncached crossings, JSON round trips, eager work) leaves every result,
 * throw scenario and exception class as it was. Each check drives one of
 * the paths changed through the public API:
 *
 * - `Field.isTypeScalar` resolving only when `getType` is null, and the
 *   memoised `ModelFile.getFullyQualifiedTypeName` (survey item 3);
 * - `addMetamodel` registering a staged copy, and `DecoratorManager.validate`
 *   parsing the DCS model once (item 4);
 * - a lazily built file's `concertoVersion` taken from the engine's check
 *   (item 5);
 * - a `ModelFile.filter` result taken from the engine's stage (item 6);
 * - `ClassDeclaration`'s super type getters as TS bodies (item 9);
 * - `ModelUtil.getFullyQualifiedName` joined in TS (item 10);
 * - `Serializer.toJSON` skipping the decode walk of untagged text (item 11);
 * - `updateModelFile` validating and writing a staged file in one call
 *   (item 12);
 * - `getAst(true)` reading the prior models once (item 13);
 * - a fork's views built on first read (item 14);
 * - an eagerly built file (decorator factories) staged once (item 15);
 * - `validateMetaModel` sending compact bytes (item 16);
 * - `getModelFileByFileName` scanning TS's names (item 17).
 *
 * Where the workspace differs from v5.0.0 by an earlier intended change
 * (a BREAKING-CHANGES-PLAN.md row, or an API v5.0.0 does not have), the
 * check's `reference` gives v5.0.0's outcome. Run by fallbacks.spec.js.
 */

const NS = 'org.acme.p5125@1.0.0';
const OTHER = 'org.acme.p5125.other@1.0.0';

const OTHER_MODEL = `namespace ${OTHER}
concept Thing { o String name }
scalar Code extends String regex=/^[A-Z]+$/
`;

const MODEL = `concerto version "^3.0.0"
namespace ${NS}
import ${OTHER}.{Thing, Code}
scalar Age extends Integer range=[0,]
enum Colour { o RED o GREEN }
concept Base { o String id }
concept Middle extends Base { o Age age optional }
concept Leaf extends Middle {
  o Colour colour optional
  o Thing thing optional
  o Code code optional
  o String note optional
  o Double[] values optional
}
asset Car identified by vin { o String vin }
`;

/**
 * A ModelManager holding OTHER_MODEL and MODEL.
 * @param {object} core the core
 * @param {object} [options] the manager's options
 * @returns {object} the manager
 */
function manager(core, options) {
    const mm = new core.ModelManager(options);
    mm.addCTOModel(OTHER_MODEL, 'other.cto');
    mm.addCTOModel(MODEL, 'model.cto');
    return mm;
}

/**
 * The outcome of `fn`: its value, or the thrown error's class name.
 * @param {Function} fn the body
 * @returns {*} the value, or `{ throws: name }`
 */
function attempt(fn) {
    try {
        return fn();
    } catch (e) {
        return { throws: e && e.constructor ? e.constructor.name : typeof e };
    }
}

/**
 * Each field of `decl` with its `isTypeScalar()` answer and its
 * fully-qualified type name.
 * @param {object} decl a class declaration
 * @returns {Array} `[name, isTypeScalar, fqtn]` triples
 */
function fieldAnswers(decl) {
    return decl.getOwnProperties().map((p) => [
        p.getName(),
        attempt(() => (typeof p.isTypeScalar === 'function' ? !!p.isTypeScalar() : 'n/a')),
        attempt(() => p.getFullyQualifiedTypeName()),
    ]);
}

/**
 * The ModelFile class of `core`.
 * @param {object} core the core
 * @returns {Function} ModelFile
 */
function ModelFileOf(core) {
    return core.modelFileModule.ModelFile || core.modelFileModule.default || core.modelFileModule;
}

module.exports = [
    {
        id: 'P5125-001',
        covers: 'Field.isTypeScalar and Property.getFullyQualifiedTypeName: scalar, enum, imported and primitive fields, asked twice (the second answer memoised)',
        run: (core) => {
            const mm = manager(core);
            const leaf = mm.getType(`${NS}.Leaf`);
            const middle = mm.getType(`${NS}.Middle`);
            return { first: fieldAnswers(leaf), again: fieldAnswers(leaf), middle: fieldAnswers(middle) };
        },
        expect: {'ok':{'first':[['colour',false,'org.acme.p5125@1.0.0.Colour'],['thing',false,'org.acme.p5125.other@1.0.0.Thing'],['code',true,'org.acme.p5125.other@1.0.0.Code'],['note',false,'String'],['values',false,'Double']],'again':[['colour',false,'org.acme.p5125@1.0.0.Colour'],['thing',false,'org.acme.p5125.other@1.0.0.Thing'],['code',true,'org.acme.p5125.other@1.0.0.Code'],['note',false,'String'],['values',false,'Double']],'middle':[['age',true,'org.acme.p5125@1.0.0.Age']]}},
    },
    {
        id: 'P5125-002',
        covers: 'Field.isTypeScalar on a field of an undeclared type (validation disabled) throws the resolve error; getFullyQualifiedTypeName throws for it',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace ${NS}
concept C { o Missing m o String s }`, 'c.cto', true);
            const decl = mm.getType(`${NS}.C`);
            return fieldAnswers(decl);
        },
        expect: {'ok':[['m',{'throws':'IllegalModelException'},{'throws':'Error'}],['s',false,'String']]},
    },
    {
        id: 'P5125-003',
        covers: 'getFullyQualifiedTypeName after updateModelFile moves an import: the memo is per model version',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace a@1.0.0
concept T { o String s }`, 'a.cto');
            mm.addCTOModel(`namespace b@1.0.0
concept T { o String s }`, 'b.cto');
            mm.addCTOModel(`namespace c@1.0.0
import a@1.0.0.{T}
concept C { o T t }`, 'c.cto');
            const before = mm.getType('c@1.0.0.C').getProperty('t').getFullyQualifiedTypeName();
            const file = mm.getModelFile('c@1.0.0');
            const fileBefore = file.getFullyQualifiedTypeName('T');
            mm.updateModelFile(`namespace c@1.0.0
import b@1.0.0.{T}
concept C { o T t }`, 'c.cto');
            const after = mm.getType('c@1.0.0.C').getProperty('t').getFullyQualifiedTypeName();
            return { before, fileBefore, after, fileAfter: mm.getModelFile('c@1.0.0').getFullyQualifiedTypeName('T'), stale: file.getFullyQualifiedTypeName('T') };
        },
        expect: {'ok':{'before':'a@1.0.0.T','fileBefore':'a@1.0.0.T','after':'b@1.0.0.T','fileAfter':'b@1.0.0.T','stale':'a@1.0.0.T'}},
    },
    {
        id: 'P5125-004',
        covers: 'new ModelManager({ addMetamodel: true }), with and without metamodelValidation: the metamodel is registered and a model is checked against it',
        run: (core) => {
            const results = [];
            for (const metamodelValidation of [true, false, undefined]) {
                const mm = new core.ModelManager({ addMetamodel: true, metamodelValidation });
                const mf = mm.getModelFile('concerto.metamodel@1.0.0');
                results.push({
                    namespaces: mm.getNamespaces().slice().sort(),
                    registered: mf === mm.metamodelModelFile,
                    declarations: mf.getAllDeclarations().length,
                    concertoVersion: mf.concertoVersion === undefined ? '<none>' : mf.concertoVersion,
                    type: mm.getType('concerto.metamodel@1.0.0.Model').getFullyQualifiedName(),
                    add: attempt(() => mm.addCTOModel(MODEL.replace(`import ${OTHER}.{Thing, Code}\n`, '').replace(/ {2}o Thing thing optional\n {2}o Code code optional\n/, ''), 'm.cto').getNamespace()),
                    again: attempt(() => mm.addModelFile(mm.metamodelModelFile)),
                });
            }
            return results;
        },
        expect: {'ok':[{'namespaces':['concerto.decorator@1.0.0','concerto.metamodel@1.0.0','concerto@1.0.0'],'registered':true,'declarations':62,'concertoVersion':null,'type':'concerto.metamodel@1.0.0.Model','add':'org.acme.p5125@1.0.0','again':{'throws':'Error'}},{'namespaces':['concerto.decorator@1.0.0','concerto.metamodel@1.0.0','concerto@1.0.0'],'registered':true,'declarations':62,'concertoVersion':null,'type':'concerto.metamodel@1.0.0.Model','add':'org.acme.p5125@1.0.0','again':{'throws':'Error'}},{'namespaces':['concerto.decorator@1.0.0','concerto.metamodel@1.0.0','concerto@1.0.0'],'registered':true,'declarations':62,'concertoVersion':null,'type':'concerto.metamodel@1.0.0.Model','add':'org.acme.p5125@1.0.0','again':{'throws':'Error'}}]},
    },
    {
        id: 'P5125-005',
        covers: 'DecoratorManager.validate with the DCS model parsed once: valid and invalid command sets, twice each, and the manager it returns',
        run: (core) => {
            const DCS = 'org.accordproject.decoratorcommands@0.4.0';
            const valid = {
                $class: `${DCS}.DecoratorCommandSet`, name: 'x', version: '1.0.0',
                commands: [{
                    $class: `${DCS}.Command`, type: 'UPSERT',
                    target: { $class: `${DCS}.CommandTarget`, namespace: NS },
                    decorator: { $class: 'concerto.metamodel@1.0.0.Decorator', name: 'Term', arguments: [] },
                }],
            };
            const invalid = Object.assign({}, valid, { commands: [{ $class: `${DCS}.Command`, type: 'NOPE' }] });
            const run = () => {
                const out = {};
                const mm = core.DecoratorManager.validate(valid);
                out.models = mm.getModels().map((m) => m.name);
                const dcsFile = mm.getModelFile(DCS);
                out.dcs = [dcsFile.getName(), typeof dcsFile.getDefinitions(), dcsFile.getAst() === mm.getModelFile(DCS).getAst()];
                out.invalid = attempt(() => core.DecoratorManager.validate(invalid));
                return out;
            };
            const first = run();
            const second = run();
            const a = core.DecoratorManager.validate(valid);
            const b = core.DecoratorManager.validate(valid);
            return { first, second, ownAst: a.getModelFile(DCS).getAst() !== b.getModelFile(DCS).getAst() };
        },
        expect: {'ok':{'first':{'models':['concerto.metamodel@1.0.0','decoratorcommands@0.3.0.cto'],'dcs':['decoratorcommands@0.3.0.cto','string',true],'invalid':{'throws':'ValidationException'}},'second':{'models':['concerto.metamodel@1.0.0','decoratorcommands@0.3.0.cto'],'dcs':['decoratorcommands@0.3.0.cto','string',true],'invalid':{'throws':'ValidationException'}},'ownAst':true}},
    },
    {
        id: 'P5125-006',
        covers: 'concertoVersion of a lazily built file: accepted ranges kept verbatim, an incompatible one throws, with the shape check on or off',
        run: (core) => {
            const out = [];
            for (const metamodelValidation of [undefined, false]) {
                for (const range of ['^3.0.0', '>=3.0.0', '^2.0.0', '']) {
                    const mm = new core.ModelManager({ metamodelValidation });
                    const cto = `concerto version "${range}"\nnamespace ${NS}\nconcept C { o String s }`;
                    out.push([String(metamodelValidation), range, attempt(() => {
                        const mf = mm.addCTOModel(cto, 'c.cto');
                        return mf.concertoVersion;
                    })]);
                }
            }
            return out;
        },
        expect: {'ok':[['undefined','^3.0.0','^3.0.0'],['undefined','>=3.0.0','>=3.0.0'],['undefined','^2.0.0',{'throws':'Error'}],['undefined','',null],['false','^3.0.0','^3.0.0'],['false','>=3.0.0','>=3.0.0'],['false','^2.0.0',{'throws':'Error'}],['false','',null]]},
    },
    {
        id: 'P5125-007',
        covers: 'ModelFile.filter dropping declarations: the filtered file the engine staged, its AST, name and definitions, added to its manager; a pruned reference fails validation there',
        run: (core) => {
            const mm = manager(core);
            const file = mm.getModelFile(NS);
            const target = new core.ModelManager();
            target.addModelFile(mm.getModelFile(OTHER).filter(() => true, target));
            const kept = file.filter((d) => d.getName() !== 'Car', target);
            const out = {
                names: kept.getAllDeclarations().map((d) => d.getName()),
                ast: kept.getAst().declarations.map((d) => d.name),
                imports: kept.getImports(),
                name: kept.getName(),
                definitions: kept.getDefinitions() === undefined ? '<undefined>' : kept.getDefinitions(),
                concertoVersion: kept.concertoVersion === undefined ? '<undefined>' : kept.concertoVersion,
                superType: kept.getType('Leaf').getSuperType(),
            };
            target.addModelFile(kept);
            out.added = target.getType(`${NS}.Leaf`).getAllSuperTypeDeclarations().map((d) => d.getName());
            const broken = new core.ModelManager();
            broken.addModelFile(mm.getModelFile(OTHER).filter(() => true, broken));
            const pruned = file.filter((d) => d.getName() !== 'Middle', broken);
            out.pruned = pruned.getAllDeclarations().map((d) => d.getName());
            out.prunedAdd = attempt(() => broken.addModelFile(pruned));
            out.none = file.filter(() => false, new core.ModelManager());
            return out;
        },
        expect: {'ok':{'names':['Age','Colour','Base','Middle','Leaf'],'ast':['Age','Colour','Base','Middle','Leaf'],'imports':['org.acme.p5125.other@1.0.0.Thing','org.acme.p5125.other@1.0.0.Code','concerto@1.0.0.Concept','concerto@1.0.0.Asset','concerto@1.0.0.Transaction','concerto@1.0.0.Participant','concerto@1.0.0.Event'],'name':'model.cto','definitions':'<undefined>','concertoVersion':'^3.0.0','superType':'org.acme.p5125@1.0.0.Middle','added':['Middle','Base','Concept'],'pruned':['Age','Colour','Base','Leaf','Car'],'prunedAdd':{'throws':'IllegalModelException'},'none':null}},
    },
    {
        id: 'P5125-008',
        covers: 'ClassDeclaration.getSuperType, getSuperTypeDeclaration and getAllSuperTypeDeclarations over a chain, a system super type and none',
        run: (core) => {
            const mm = manager(core);
            const walk = (fqn) => {
                const decl = mm.getType(fqn);
                const superDecl = decl.getSuperTypeDeclaration();
                return [decl.getSuperType(), superDecl ? superDecl.getFullyQualifiedName() : null,
                    decl.getAllSuperTypeDeclarations().map((d) => d.getFullyQualifiedName()), decl.getSuperTypeDeclaration() === superDecl];
            };
            return [`${NS}.Leaf`, `${NS}.Middle`, `${NS}.Base`, `${NS}.Car`].map(walk);
        },
        expect: {'ok':[['org.acme.p5125@1.0.0.Middle','org.acme.p5125@1.0.0.Middle',['org.acme.p5125@1.0.0.Middle','org.acme.p5125@1.0.0.Base','concerto@1.0.0.Concept'],true],['org.acme.p5125@1.0.0.Base','org.acme.p5125@1.0.0.Base',['org.acme.p5125@1.0.0.Base','concerto@1.0.0.Concept'],true],['concerto@1.0.0.Concept','concerto@1.0.0.Concept',['concerto@1.0.0.Concept'],true],['concerto@1.0.0.Asset','concerto@1.0.0.Asset',['concerto@1.0.0.Asset','concerto@1.0.0.Concept'],true]]},
    },
    {
        id: 'P5125-009',
        covers: 'getAllSuperTypeDeclarations on a cyclic chain loaded without validation is BC-11\'s IllegalModelException (v5.0.0 runs out of memory, so not run there)',
        run: (core) => {
            const mm = new core.ModelManager();
            if (!mm.rustHandle) {
                return 'no BC-11';
            }
            mm.addCTOModel(`namespace ${NS}
concept A extends C {}
concept B extends A {}
concept C extends B {}`, 'cycle.cto', true);
            const a = mm.getType(`${NS}.A`);
            return { superType: a.getSuperType(), all: attempt(() => a.getAllSuperTypeDeclarations()) };
        },
        expect: {'ok':{'superType':'org.acme.p5125@1.0.0.C','all':{'throws':'IllegalModelException'}}},
        reference: { ok: 'no BC-11' },
    },
    {
        id: 'P5125-010',
        covers: 'ModelUtil.getFullyQualifiedName for strings (empty namespace included) and other arguments; isValidIdentifier, asked twice',
        run: (core) => {
            const f = (ns, t) => attempt(() => core.ModelUtil.getFullyQualifiedName(ns, t));
            const valid = ['Abc', 'Abc', '1abc', '', 'a b'].map((n) => core.ModelUtil.isValidIdentifier(n));
            return [f(NS, 'A'), f('', 'A'), f('a', ''), f(null, 'A'), f(undefined, 'A'), f('ns', undefined), valid];
        },
        expect: {'ok':['org.acme.p5125@1.0.0.A','A','a.','A','A','ns.undefined',[true,true,false,false,false]]},
    },
    {
        id: 'P5125-011',
        covers: 'Serializer.toJSON of resources with and without values the wire tags (an undefined field), and with the tag text in a string',
        run: (core) => {
            const mm = manager(core);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const leaf = factory.newConcept(NS, 'Leaf');
            leaf.id = 'x';
            leaf.note = '"@@oracle" is not a tag here';
            leaf.values = [1.5, 2];
            const plainJson = serializer.toJSON(leaf);
            const tagged = factory.newConcept(NS, 'Leaf');
            tagged.id = 'y';
            tagged.note = undefined;
            const taggedJson = serializer.toJSON(tagged, { validate: false });
            return { plainJson, taggedJson, keys: Object.keys(taggedJson) };
        },
        expect: {'ok':{'plainJson':{'$class':'org.acme.p5125@1.0.0.Leaf','note':'"@@oracle" is not a tag here','values':[1.5,2],'id':'x'},'taggedJson':{'$class':'org.acme.p5125@1.0.0.Leaf','id':'y'},'keys':['$class','id']}},
    },
    {
        id: 'P5125-012',
        covers: 'updateModelFile of a valid and an invalid file (staged and validated in one call): the manager unchanged by the failure',
        run: (core) => {
            const mm = manager(core);
            const ok = mm.updateModelFile(MODEL.replace('concept Base { o String id }', 'concept Base { o String id o String extra optional }'), 'model.cto');
            const after = mm.getType(`${NS}.Base`).getProperties().map((p) => p.getName());
            const bad = attempt(() => mm.updateModelFile(MODEL.replace('o Colour colour optional', 'o Missing colour optional'), 'model.cto'));
            const still = mm.getType(`${NS}.Leaf`).getProperty('colour').getFullyQualifiedTypeName();
            const unversioned = attempt(() => mm.updateModelFile('namespace unversioned\nconcept X {}'));
            const absent = attempt(() => mm.updateModelFile('namespace absent@1.0.0\nconcept X {}'));
            const skipped = mm.updateModelFile(MODEL.replace('o Colour colour optional', 'o Missing colour optional'), 'model.cto', true).getNamespace();
            return { ok: ok.getNamespace(), after, bad, still, unversioned, absent, skipped, same: mm.getModelFile(NS).getAllDeclarations().length };
        },
        expect: {'ok':{'ok':'org.acme.p5125@1.0.0','after':['id','extra'],'bad':{'throws':'IllegalModelException'},'still':'org.acme.p5125@1.0.0.Colour','unversioned':{'throws':'Error'},'absent':{'throws':'Error'},'skipped':'org.acme.p5125@1.0.0','same':6}},
    },
    {
        id: 'P5125-013',
        covers: 'getAst(true) resolves every file\'s names against the same prior models, with and without the system namespaces',
        run: (core) => {
            const mm = manager(core);
            const resolved = mm.getAst(true);
            const withSystem = mm.getAst(true, true);
            const pick = (models) => models.models.map((m) => [m.namespace, JSON.stringify(m.declarations.map((d) => [d.name, d.superType, (d.properties || []).map((p) => p.type)]))]);
            return { resolved: pick(resolved), withSystem: pick(withSystem).map((m) => m[0]) };
        },
        expect: {'ok':{'resolved':[['org.acme.p5125.other@1.0.0','[["Thing",null,[null]],["Code",null,[]]]'],['org.acme.p5125@1.0.0','[["Age",null,[]],["Colour",null,[null,null]],["Base",null,[null]],["Middle",{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Base","namespace":"org.acme.p5125@1.0.0"},[{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Age","namespace":"org.acme.p5125@1.0.0"}]],["Leaf",{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Middle","namespace":"org.acme.p5125@1.0.0"},[{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Colour","namespace":"org.acme.p5125@1.0.0"},{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Thing","namespace":"org.acme.p5125.other@1.0.0"},{"$class":"concerto.metamodel@1.0.0.TypeIdentifier","name":"Code","namespace":"org.acme.p5125.other@1.0.0"},null,null]],["Car",null,[null]]]']],'withSystem':['concerto.decorator@1.0.0','concerto@1.0.0','org.acme.p5125.other@1.0.0','org.acme.p5125@1.0.0']}},
    },
    {
        id: 'P5125-014',
        covers: 'a fork\'s model files, built on first read: the same view on each read, its names and types, and changes on either side kept apart',
        run: (core) => {
            const mm = manager(core);
            if (typeof mm.fork !== 'function') {
                return 'no fork';
            }
            const fork = mm.fork();
            const first = fork.getModelFile(NS);
            const out = {
                same: first === fork.getModelFile(NS),
                own: first !== mm.getModelFile(NS),
                namespaces: fork.getNamespaces(),
                files: fork.getModelFiles().map((f) => [f.getNamespace(), f.getName()]),
                type: fork.getType(`${NS}.Leaf`).getAllSuperTypeDeclarations().map((d) => d.getName()),
                byName: fork.getModelFileByFileName('other.cto').getNamespace(),
            };
            fork.deleteModelFile(NS);
            out.afterDelete = [fork.getNamespaces().includes(NS), mm.getNamespaces().includes(NS)];
            fork.addCTOModel(`namespace ${NS}\nconcept Only {}`, 'only.cto');
            out.afterAdd = [fork.getModelFile(NS).getAllDeclarations().map((d) => d.getName()), mm.getModelFile(NS).getAllDeclarations().length];
            const second = mm.fork();
            second.updateModelFile(`namespace ${OTHER}\nconcept Thing { o String name }\nscalar Code extends String`, 'other.cto');
            out.updated = [second.getType(`${OTHER}.Code`).getValidator() === null, mm.getType(`${OTHER}.Code`).getValidator() === null];
            return out;
        },
        expect: {'ok':{'same':true,'own':true,'namespaces':['concerto.decorator@1.0.0','concerto@1.0.0','org.acme.p5125.other@1.0.0','org.acme.p5125@1.0.0'],'files':[['org.acme.p5125.other@1.0.0','other.cto'],['org.acme.p5125@1.0.0','model.cto']],'type':['Middle','Base','Concept'],'byName':'org.acme.p5125.other@1.0.0','afterDelete':[false,true],'afterAdd':[['Only'],6],'updated':[true,false]}},
        reference: { ok: 'no fork' },
    },
    {
        id: 'P5125-015',
        covers: 'a model added to a manager with a decorator factory (built eagerly, BC-24): its decorators, its validation, and a malformed AST\'s error',
        run: (core) => {
            const mm = new core.ModelManager();
            const factory = {
                newDecorator: (parent, ast) => (ast.name === 'Tag' ? new core.Decorator(parent, Object.assign({}, ast, { name: 'Tag' })) : null),
            };
            mm.addDecoratorFactory(factory);
            mm.addCTOModel(OTHER_MODEL, 'other.cto');
            const mf = mm.addCTOModel(`namespace ${NS}
import ${OTHER}.{Thing}
@Tag("x")
concept C { @Tag o Thing t }`, 'c.cto');
            const c = mm.getType(`${NS}.C`);
            return {
                decorators: c.getDecorators().map((d) => [d.getName(), d.getArguments()]),
                field: c.getProperty('t').getDecorators().map((d) => d.getName()),
                fqtn: c.getProperty('t').getFullyQualifiedTypeName(),
                invalid: attempt(() => mm.addCTOModel(`namespace bad@1.0.0
concept D { o Missing m }`, 'd.cto')),
                malformed: attempt(() => mm.addModelFile(new ModelFileOf(core)(mm, { $class: 'concerto.metamodel@1.0.0.Model', namespace: 'm@1.0.0', imports: [], declarations: [{ $class: 'concerto.metamodel@1.0.0.ConceptDeclaration', name: 7, isAbstract: false, properties: [] }] }))),
                namespaces: mm.getNamespaces().filter((n) => n !== 'concerto@1.0.0' && n !== 'concerto.decorator@1.0.0'),
                file: mf.getNamespace(),
            };
        },
        expect: {'ok':{'decorators':[['Tag',['x']]],'field':['Tag'],'fqtn':'org.acme.p5125.other@1.0.0.Thing','invalid':{'throws':'IllegalModelException'},'malformed':{'throws':'TypeError'},'namespaces':['org.acme.p5125.other@1.0.0','org.acme.p5125@1.0.0'],'file':'org.acme.p5125@1.0.0'}},
    },
    {
        id: 'P5125-016',
        covers: 'MetaModel.validateMetaModel (via modelManagerFromMetaModel) of a valid metamodel, an invalid one, and one with a value the binary layout leaves to text',
        run: (core) => {
            const metaModel = core.metaModelModule.default || core.metaModelModule;
            const mm = manager(core);
            const ast = mm.getAst();
            const ok = attempt(() => metaModel.modelManagerFromMetaModel(ast).getNamespaces().length);
            const valid = attempt(() => metaModel.validateMetaModel(ast).models.length);
            const bad = attempt(() => metaModel.validateMetaModel({ $class: 'concerto.metamodel@1.0.0.Models', models: [{ $class: 'concerto.metamodel@1.0.0.Model', namespace: 7 }] }));
            const special = attempt(() => metaModel.validateMetaModel({ $class: 'concerto.metamodel@1.0.0.Models', models: [{ $class: 'concerto.metamodel@1.0.0.Model', namespace: 'n@1.0.0', imports: [], declarations: [], decorators: [{ $class: 'concerto.metamodel@1.0.0.Decorator', name: 'D', arguments: [{ $class: 'concerto.metamodel@1.0.0.DecoratorNumber', value: NaN }] }] }] }).models.length);
            const missing = attempt(() => metaModel.validateMetaModel({ $class: 'concerto.metamodel@1.0.0.Models' }));
            return { ok, valid, bad, special, missing };
        },
        expect: {'ok':{'ok':4,'valid':2,'bad':{'throws':'ValidationException'},'special':{'throws':'ValidationException'},'missing':{'throws':'ValidationException'}}},
    },
    {
        id: 'P5125-017',
        covers: 'getModelFileByFileName for a name held, one not held, undefined and null',
        run: (core) => {
            const mm = manager(core);
            const name = (mf) => (mf ? mf.getNamespace() : String(mf));
            const unnamed = new core.ModelManager();
            unnamed.addCTOModel('namespace u@1.0.0\nconcept U {}');
            return [name(mm.getModelFileByFileName('model.cto')), name(mm.getModelFileByFileName('other.cto')),
                name(mm.getModelFileByFileName('none.cto')), name(mm.getModelFileByFileName(undefined)),
                name(mm.getModelFileByFileName(null)), name(unnamed.getModelFileByFileName(undefined)),
                name(unnamed.getModelFileByFileName('UNKNOWN'))];
        },
        expect: {'ok':['org.acme.p5125@1.0.0','org.acme.p5125.other@1.0.0','undefined','undefined','undefined','u@1.0.0','undefined']},
    },
    {
        id: 'P5125-018',
        covers: 'ModelFile.filter dropping declarations into a manager with a decorator factory (an eager build): the filtered file, its decorators, and its add',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace ${NS}
@Tag("a")
concept A { o String s }
@Tag("b")
concept B { o A a optional }
concept C {}`, 'tags.cto');
            const target = new core.ModelManager();
            target.addDecoratorFactory({
                newDecorator: (parent, ast) => (ast.name === 'Tag' ? new core.Decorator(parent, ast) : null),
            });
            const kept = mm.getModelFile(NS).filter((d) => d.getName() !== 'C', target);
            const out = {
                names: kept.getAllDeclarations().map((d) => [d.getName(), d.getDecorators().map((x) => x.getArguments())]),
                name: kept.getName(),
            };
            target.addModelFile(kept);
            out.added = target.getType(`${NS}.B`).getProperty('a').getFullyQualifiedTypeName();
            const dropped = mm.getModelFile(NS).filter((d) => d.getName() === 'B', target === null ? null : new core.ModelManager());
            out.dropped = dropped.getAllDeclarations().map((d) => d.getName());
            return out;
        },
        expect: {'ok':{'names':[['A',[['a']]],['B',[['b']]]],'name':'tags.cto','added':'org.acme.p5125@1.0.0.A','dropped':['B']}},
    },
    {
        id: 'P5125-019',
        covers: 'addModelFiles and updateModelFile with model files built for another manager (no stage in this one): registered and validated as before',
        run: (core) => {
            const ModelFile = ModelFileOf(core);
            const other = new core.ModelManager();
            const parse = (cto) => new core.ModelManager().addCTOModel(cto, undefined, true).getAst();
            const a = new ModelFile(other, parse(`namespace fa@1.0.0
concept A { o String s }`), undefined, 'fa.cto');
            const b = new ModelFile(other, parse(`namespace fb@1.0.0
concept B { o String a }`), undefined, 'fb.cto');
            const mm = new core.ModelManager();
            const added = mm.addModelFiles([a, b]).map((f) => f.getNamespace());
            const type = mm.getType('fb@1.0.0.B').getProperty('a').getFullyQualifiedTypeName();
            const failedAdd = attempt(() => mm.addModelFiles([new ModelFile(other, parse(`namespace fc@1.0.0
concept C { o Missing m }`)), new ModelFile(other, parse(`namespace fd@1.0.0
concept D {}`))]));
            const after = mm.getNamespaces().filter((n) => n.startsWith('f'));
            const next = new ModelFile(other, parse(`namespace fa@1.0.0
concept A { o String s o Integer n optional }`), undefined, 'fa.cto');
            const updated = mm.updateModelFile(next).getNamespace();
            const props = mm.getType('fa@1.0.0.A').getProperties().map((p) => p.getName());
            const bad = new ModelFile(other, parse(`namespace fa@1.0.0
concept A { o Missing s }`), undefined, 'fa.cto');
            const failed = attempt(() => mm.updateModelFile(bad));
            const skipped = mm.updateModelFile(next, undefined, true).getNamespace();
            return { added, type, failedAdd, after, updated, props, failed, skipped };
        },
        expect: {'ok':{'added':['fa@1.0.0','fb@1.0.0'],'type':'String','failedAdd':{'throws':'IllegalModelException'},'after':['fa@1.0.0','fb@1.0.0'],'updated':'fa@1.0.0','props':['s','n'],'failed':{'throws':'IllegalModelException'},'skipped':'fa@1.0.0'}},
    },
    {
        id: 'P5125-020',
        covers: 'validateInstance and validateInstanceOrThrow: a JSON text the binary layout leaves to text (nested past its depth), a subtype read through fromJSON, and a document whose getter throws',
        run: (core) => {
            const mm = new core.ModelManager();
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            mm.addCTOModel(`namespace deep@1.0.0
concept Node { o Node child optional o String tag optional }
concept Person { o String name o DateTime born optional }
concept Employee extends Person { o String team optional }`, 'deep.cto');
            let doc = { $class: 'deep@1.0.0.Node', tag: 'leaf' };
            for (let i = 0; i < 110; i++) {
                doc = { $class: 'deep@1.0.0.Node', child: doc };
            }
            const text = JSON.stringify(doc);
            const result = mm.validateInstance(text);
            let depth = 0;
            for (let node = result.resource; node; node = node.child) {
                depth++;
            }
            const sub = mm.validateInstanceOrThrow({ $class: 'deep@1.0.0.Employee', name: 'lone \uD800' }, {}, 'deep@1.0.0.Person');
            const throwing = { $class: 'deep@1.0.0.Person' };
            Object.defineProperty(throwing, 'name', { enumerable: true, get() { throw new RangeError('getter'); } });
            const thrown = attempt(() => mm.validateInstanceOrThrow(throwing));
            return { valid: result.valid, depth, sub: sub === null ? null : sub.getFullyQualifiedType(), thrown };
        },
        expect: {'ok':{'valid':true,'depth':111,'sub':'deep@1.0.0.Employee','thrown':{'throws':'RangeError'}}},
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5125-021',
        covers: 'ModelUtil.isValidIdentifier over more distinct names than its memo keeps',
        run: (core) => {
            let valid = 0;
            for (let i = 0; i < 4200; i++) {
                if (core.ModelUtil.isValidIdentifier(i % 3 === 0 ? `${i}x` : `x${i}`)) {
                    valid++;
                }
            }
            return [valid, core.ModelUtil.isValidIdentifier('x1'), core.ModelUtil.isValidIdentifier('0x')];
        },
        expect: {'ok':[2800,true,false]},
    },
];
