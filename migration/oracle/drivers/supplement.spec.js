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
 * Corpus supplement driver (task P2-11b, plan §0.3): targeted black-box
 * inputs for the statements and functions of the frozen reference that the
 * pinned corpus (oracle-corpus-p107-06aa375) never reaches, mostly public
 * accessors and constructors. It is recorded on its own, with the source
 * `supplement`, and built by bin/build-supplement.js into
 * fixtures/supplement/, next to the pinned files, which it never changes.
 *
 * Every call goes through concerto-core's public API: an op of lib/ops.js
 * on an object a model manager, factory or serializer returns, or an
 * exported constructor. Visitors are the encodable `pair` kind
 * (lib/encodable.js). Like gaps.spec.js, this driver never asserts on an
 * outcome: the reference decides it on replay.
 *
 * What stays out of reach through the public API (abstract base methods
 * that every concrete subclass overrides, and the statements gap-reasons.json
 * already records as stub-only or internal-only) is listed in
 * migration/oracle/README.md, "Corpus supplement".
 */

const path = require('path');
const { SRC_ROOT } = require('../lib/core');
const encodable = require('../lib/encodable');

const S = (m) => require(path.join(SRC_ROOT, m));
const { ModelManager } = S('modelmanager');
const { Factory } = S('factory');
const { Serializer } = S('serializer');
const { Introspector } = S('introspect/introspector');
const { Relationship } = S('model/relationship');
const DecoratorManager = S('decoratormanager').default || S('decoratormanager').DecoratorManager;
const tnfeModule = S('typenotfoundexception');
const secModule = S('securityexception');

const attempt = (f) => {
    try {
        return f();
    } catch (e) {
        return undefined;
    }
};

// The exception an op throws, or undefined.
const thrown = (f) => {
    try {
        f();
    } catch (e) {
        return e;
    }
    return undefined;
};

const MM1 = 'concerto.metamodel@1.0.0';
const clone = (o) => JSON.parse(JSON.stringify(o));
const visitor = () => encodable.visitor({ kind: 'pair' });

const NS = 'supp.core@1.0.0';
const CTO = `
namespace ${NS}

@Term("A map")
map Dictionary {
  o String
  o Integer
}

map People {
  o String
  o Person
}

scalar Code extends String length=[1,4]
scalar Level extends Integer range=[0,10]

@Term("A person")
@Deprecated
concept Person identified by name {
  @Term("The name")
  o String name
  o Integer age range=[0,150]
  o Double score range=[0.5,]
  o String nick length=[2,10] optional
  o String motto regex=/^[a-z]+$/ optional
  o Code code optional
  o Level level optional
  o String[] tags optional
  --> Person friend optional
}

asset Thing identified by thingId {
  o String thingId
  o Dictionary dict optional
  o People people optional
}
`;

/**
 * A model manager with the driver's model.
 * @param {object} [options] model manager options
 * @returns {object} ModelManager
 */
function setup(options) {
    const mm = options ? new ModelManager(options) : new ModelManager();
    mm.addCTOModel(CTO, 'supp.cto');
    return mm;
}

describe('oracle supplement driver', function () {
    this.timeout(60000);

    describe('basemodelmanager.ts: public accessors', () => {
        it('isModelManager, isAliasedTypeEnabled, getFactory', () => {
            for (const options of [undefined, { enableAliasedType: false }, { strict: true }]) {
                const mm = setup(options);
                attempt(() => mm.isModelManager());
                attempt(() => mm.isAliasedTypeEnabled());
                attempt(() => mm.getFactory());
            }
        });

        it('getModelFileByFileName: a known name, an unknown one, and none', () => {
            const mm = setup();
            attempt(() => mm.addCTOModel('namespace supp.other@1.0.0\nconcept Other {}\n', 'other.cto'));
            attempt(() => mm.getModelFileByFileName('supp.cto'));
            attempt(() => mm.getModelFileByFileName('other.cto'));
            attempt(() => mm.getModelFileByFileName('missing.cto'));
            attempt(() => mm.getModelFileByFileName(undefined));
            attempt(() => new ModelManager().getModelFileByFileName('supp.cto'));
        });
    });

    describe('accept: visitor dispatch on every public visitable', () => {
        it('ModelManager, ModelFile, Introspector', () => {
            const mm = setup();
            attempt(() => mm.accept(visitor(), { depth: 1 }));
            attempt(() => mm.accept(visitor()));
            const mf = mm.getModelFile(NS);
            attempt(() => mf.accept(visitor(), { tag: 'mf' }));
            const introspector = new Introspector(mm);
            attempt(() => introspector.accept(visitor(), { tag: 'introspector' }));
        });

        it('declarations, properties, map key and value types', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            attempt(() => person.accept(visitor(), { tag: 'class' }));
            attempt(() => person.getProperty('age').accept(visitor(), { tag: 'field' }));
            attempt(() => person.getProperty('friend').accept(visitor(), { tag: 'relationship' }));
            const dict = mm.getType(`${NS}.Dictionary`);
            attempt(() => dict.accept(visitor(), { tag: 'map' }));
            attempt(() => dict.getKey().accept(visitor(), { tag: 'key' }));
            attempt(() => dict.getValue().accept(visitor(), { tag: 'value' }));
            attempt(() => mm.getType(`${NS}.Code`).accept(visitor(), { tag: 'scalar' }));
        });

        it('decorators and validators', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            attempt(() => person.getDecorator('Term').accept(visitor(), { tag: 'decorator' }));
            attempt(() => person.getProperty('age').getValidator().accept(visitor(), { tag: 'number' }));
            attempt(() => person.getProperty('nick').getValidator().accept(visitor(), { tag: 'string' }));
        });

        it('resources, concepts and relationships', () => {
            const mm = setup();
            const factory = new Factory(mm);
            const p = attempt(() => factory.newResource(NS, 'Person', 'alice'));
            if (p) {
                attempt(() => p.accept(visitor(), { tag: 'resource' }));
            }
            const r = attempt(() => factory.newRelationship(NS, 'Person', 'bob'));
            if (r) {
                attempt(() => r.accept(visitor(), { tag: 'relationship' }));
            }
        });
    });

    describe('declaration.ts: Declaration accessors that a map declaration inherits', () => {
        it('isIdentified, isSystemIdentified, getIdentifierFieldName, isAsset, isParticipant', () => {
            const mm = setup();
            for (const name of ['Dictionary', 'People']) {
                const d = mm.getType(`${NS}.${name}`);
                attempt(() => d.isIdentified());
                attempt(() => d.isSystemIdentified());
                attempt(() => d.getIdentifierFieldName());
                attempt(() => d.isAsset());
                attempt(() => d.isParticipant());
                attempt(() => d.isTransaction());
                attempt(() => d.isEvent());
                attempt(() => d.isConcept());
            }
        });
    });

    describe('mapkeytype.ts, mapvaluetype.ts: isKey and isValue', () => {
        it('on the key and the value of both maps', () => {
            const mm = setup();
            for (const name of ['Dictionary', 'People']) {
                const d = mm.getType(`${NS}.${name}`);
                for (const part of [d.getKey(), d.getValue()]) {
                    attempt(() => part.isKey());
                    attempt(() => part.isValue());
                }
            }
        });
    });

    describe('field.ts, validators: toString and matchesRegex', () => {
        it('Field.toString on plain, optional, array and scalar fields', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            for (const name of ['name', 'age', 'nick', 'tags', 'code', 'level']) {
                attempt(() => person.getProperty(name).toString());
            }
        });

        it('NumberValidator.toString with both bounds and one', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            attempt(() => person.getProperty('age').getValidator().toString());
            attempt(() => person.getProperty('score').getValidator().toString());
            attempt(() => mm.getType(`${NS}.Level`).getValidator().toString());
        });

        it('StringValidator.matchesRegex with and without a regex', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            const nick = person.getProperty('nick').getValidator();
            attempt(() => nick.matchesRegex('anything'));
            const motto = person.getProperty('motto').getValidator();
            attempt(() => motto.matchesRegex('abc'));
            attempt(() => motto.matchesRegex('ABC'));
        });
    });

    describe('decorator.ts, modelfile.ts: isDecorator and getExternalImports', () => {
        it('Decorator.isDecorator', () => {
            const mm = setup();
            const person = mm.getType(`${NS}.Person`);
            for (const d of person.getDecorators()) {
                attempt(() => d.isDecorator());
            }
            attempt(() => person.getProperty('name').getDecorator('Term').isDecorator());
        });

        it('ModelFile.getExternalImports with no import, a local import and an external one', () => {
            const mm = setup();
            attempt(() => mm.getModelFile(NS).getExternalImports());
            attempt(() => mm.addCTOModel(`namespace supp.imp@1.0.0\nimport ${NS}.{Person}\nconcept Imp { o Person p }\n`, 'imp.cto'));
            attempt(() => mm.getModelFile('supp.imp@1.0.0').getExternalImports());
            const ext = new ModelManager();
            attempt(() => ext.addCTOModel('namespace supp.ext@1.0.0\nimport org.example@1.0.0.{Remote} from https://example.org/remote.cto\nconcept E {}\n', 'ext.cto', true));
            const mf = attempt(() => ext.getModelFile('supp.ext@1.0.0'));
            if (mf) {
                attempt(() => mf.getExternalImports());
            }
        });
    });

    describe('decoratormanager.ts: isNamespaceTargetEnabled', () => {
        it('the static', () => {
            attempt(() => DecoratorManager.isNamespaceTargetEnabled());
        });
    });

    describe('serializer.ts: setDefaultOptions', () => {
        it('then toJSON and fromJSON with the new defaults', () => {
            const mm = setup();
            const factory = new Factory(mm);
            const serializer = new Serializer(factory, mm);
            attempt(() => serializer.setDefaultOptions({ validate: false }));
            attempt(() => serializer.setDefaultOptions({ convertResourcesToRelationships: true, permitResourcesForRelationships: true }));
            attempt(() => serializer.setDefaultOptions({}));
            const p = attempt(() => factory.newResource(NS, 'Person', 'carol'));
            if (p) {
                attempt(() => serializer.toJSON(p));
            }
            attempt(() => serializer.fromJSON({ $class: `${NS}.Person`, name: 'dave', age: 3, score: 1 }));
        });
    });

    describe('exceptions: the exported constructors and TypeNotFoundException.getTypeName', () => {
        it('SecurityException', () => {
            const SecurityException = secModule.SecurityException || secModule.default;
            attempt(() => new SecurityException('denied'));
            attempt(() => new SecurityException(''));
        });

        it('TypeNotFoundException.getTypeName: built directly, and thrown by getType', () => {
            const TypeNotFoundException = tnfeModule.TypeNotFoundException || tnfeModule.default;
            const e1 = attempt(() => new TypeNotFoundException('supp.Missing'));
            if (e1) {
                attempt(() => e1.getTypeName());
            }
            const e2 = attempt(() => new TypeNotFoundException('supp.Missing', 'custom message', 'component'));
            if (e2) {
                attempt(() => e2.getTypeName());
            }
            const mm = setup();
            const e3 = thrown(() => mm.getType(`${NS}.Missing`));
            if (e3 && typeof e3.getTypeName === 'function') {
                attempt(() => e3.getTypeName());
            }
        });
    });

    describe('scalardeclaration.ts: validate() with a duplicate declaration name', () => {
        it('a model file added without validation', () => {
            const mm = new ModelManager();
            attempt(() => mm.addCTOModel('namespace supp.dup@1.0.0\nscalar A extends String\nscalar A extends String\nconcept C {}\n', 'dup.cto', true));
            const mf = attempt(() => mm.getModelFile('supp.dup@1.0.0'));
            if (mf) {
                for (const d of mf.getAllDeclarations()) {
                    attempt(() => d.validate());
                }
            }
        });
    });

    describe('resourceid.ts: Relationship.fromURI with a query and with user info', () => {
        it('rejected URIs', () => {
            const mm = setup();
            for (const uri of [
                `resource:${NS}.Person?x=1#alice`,
                `${NS}.Person?q#alice`,
                `resource://user@host/${NS}.Person#alice`,
                `resource://user:pw@host/${NS}.Person#alice`,
                `//user@host:8080/${NS}.Person#alice`,
            ]) {
                attempt(() => Relationship.fromURI(mm, uri));
            }
        });
    });

    describe('resourcevalidator.ts, jsonpopulator.ts, instancegenerator.ts: instance edge cases', () => {
        const RNS = 'supp.inst@1.0.0';
        const RCTO = `
namespace ${RNS}

asset Base identified by baseId {
  o String baseId
}
asset Derived extends Base {
  o String extra optional
}
concept WithDefault {
  o String s default="q"
  o Integer n optional
}
scalar Short extends String length=[1,4]
concept Scalars {
  o Short code
}
concept Item {
  o String label
}
map Items {
  o String
  o Item
}
concept Holder {
  o Items items
}
`;
        const setupInst = () => {
            const mm = new ModelManager();
            mm.addCTOModel(RCTO, 'inst.cto');
            return mm;
        };

        it('validate a derived asset, and a field with a default value left unset', () => {
            const mm = setupInst();
            const factory = new Factory(mm);
            const d = attempt(() => factory.newResource(RNS, 'Derived', 'd1'));
            if (d) {
                attempt(() => d.validate());
            }
            const w = attempt(() => factory.newConcept(RNS, 'WithDefault'));
            if (w) {
                attempt(() => w.setPropertyValue('s', undefined));
                attempt(() => w.validate());
            }
            const w2 = attempt(() => factory.newConcept(RNS, 'WithDefault'));
            if (w2) {
                attempt(() => w2.setPropertyValue('s', null));
                attempt(() => w2.validate());
            }
            const w3 = attempt(() => factory.newConcept(RNS, 'WithDefault'));
            if (w3) {
                attempt(() => w3.setPropertyValue('s', 10n));
                attempt(() => w3.validate());
            }
            const serializer = new Serializer(factory, mm);
            attempt(() => serializer.fromJSON({ $class: `${RNS}.WithDefault` }));
            attempt(() => serializer.fromJSON({ $class: `${RNS}.Derived`, baseId: 'd2' }));
        });

        it('a map value whose $class is not a known type', () => {
            const mm = setupInst();
            const serializer = new Serializer(new Factory(mm), mm);
            attempt(() => serializer.fromJSON({ $class: `${RNS}.Holder`, items: { a: { $class: `${RNS}.Missing`, label: 'x' } } }));
            attempt(() => serializer.fromJSON({ $class: `${RNS}.Holder`, items: { a: { $class: 'supp.nowhere@1.0.0.Item', label: 'x' } } }));
            attempt(() => serializer.fromJSON({ $class: `${RNS}.Holder`, items: { a: { label: 'x' } } }));
        });

        it('sample and empty instances of a concept with a scalar field', () => {
            const mm = setupInst();
            const factory = new Factory(mm);
            attempt(() => factory.newConcept(RNS, 'Scalars', undefined, { generate: 'sample' }));
            attempt(() => factory.newConcept(RNS, 'Scalars', undefined, { generate: 'empty' }));
        });
    });

    describe('classdeclaration.ts, modelfile.ts: rejected ASTs through fromAst', () => {
        const base = () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace supp.ast@1.0.0\nconcept A {\n  o String s\n}\nconcept B {}\n', 'ast.cto');
            return clone(mm.getAst(false));
        };

        it('a class declaration whose properties are not an array', () => {
            const ast = base();
            delete ast.models[0].declarations[0].properties;
            attempt(() => new ModelManager().fromAst(ast));
            const ast2 = base();
            ast2.models[0].declarations[1].properties = 'none';
            attempt(() => new ModelManager().fromAst(ast2));
        });

        it('a class declaration that extends itself', () => {
            const ast = base();
            ast.models[0].declarations[0].superType = { $class: `${MM1}.TypeIdentifier`, name: 'A' };
            attempt(() => new ModelManager().fromAst(ast));
        });

        it('an import that aliases a type to a primitive type name', () => {
            for (const aliasedName of ['String', 'Integer']) {
                const ast = base();
                ast.models.push({
                    $class: `${MM1}.Model`,
                    namespace: 'supp.alias@1.0.0',
                    imports: [{
                        $class: `${MM1}.ImportTypes`,
                        namespace: 'supp.ast@1.0.0',
                        types: ['A'],
                        aliasedTypes: [{ $class: `${MM1}.AliasedType`, name: 'A', aliasedName }],
                    }],
                    declarations: [],
                });
                attempt(() => new ModelManager({ enableAliasedType: true }).fromAst(ast));
            }
        });
    });
});
