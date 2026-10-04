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
 * P5-103 lifted checks (accordproject/concerto-rust#457): the engine shim
 * (packages/concerto-core/src/engine/) counts towards the nyc gate since
 * P5-103 (maintainer decision on #457). Each check drives a path of the
 * shim the frozen unit suite does not reach, through the public API, and
 * compares the outcome with concerto-core@5.0.0's.
 *
 * - LAZY-*: the lazy views (P5-10a/b): a lazily built ModelFile's fields
 *   read or written in an unusual order, the prototype accessors, a model
 *   with no declarations.
 * - LOAD-*: the ModelFile load path: decorator factories with the shape
 *   check off, system models and the metamodel loaded again.
 * - PROPS-*: the property lookup cache (P5-14) after its view changes.
 * - SER-*: the Serializer fast path and its wire codec: values the binary
 *   layout leaves to the text path, invalid dates, non-finite numbers,
 *   `__proto__` keys, options objects reused and changed.
 * - VAL-*: ValidatedResource's one-call validation (P5-12c) and
 *   `validateInstance` (P5-89).
 * - DCS-*: the DecoratorManager views on a manager the source handle
 *   cannot serve.
 *
 * Only error classes are compared, never messages (error parity, P5-09).
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * The class of the error `fn` throws, or `'ok'`.
 * @param {Function} fn the body
 * @returns {string} the outcome
 */
function probe(fn) {
    try {
        fn();
        return 'ok';
    } catch (e) {
        return e && e.constructor ? e.constructor.name : typeof e;
    }
}

/**
 * What `fn` returns, or the class of the error it throws.
 * @param {Function} fn the body
 * @returns {*} the outcome
 */
function attempt(fn) {
    try {
        return fn();
    } catch (e) {
        return `threw ${e && e.constructor ? e.constructor.name : typeof e}`;
    }
}

const SHAPES = `namespace org.p5103.shapes@1.0.0
@Term("Shapes")
concept Base {
  o String name optional
}
@Term("A thing")
asset Thing identified by id {
  @Term("Id")
  o String id
  o String code regex=/^A/ optional
  o Integer count range=[0,10] optional
  o Double ratio optional
  o DateTime when optional
  o String[] tags length=[1,5] optional
  o Base base optional
  --> Thing other optional
  o Tags labels optional
}
map Tags {
  o String
  o String
}
scalar Small extends Integer range=[0,5]
scalar Code extends String regex=/^[A-Z]+$/
concept Uses extends Base {
  o Small small optional
  o Code code optional
}`;

/**
 * A ModelManager holding `cto`, built through `addCTOModel`.
 * @param {object} core the core under test
 * @param {string} cto the CTO text
 * @param {object} [options] the ModelManager options
 * @returns {object} the manager
 */
function managerOf(core, cto, options) {
    const mm = new core.ModelManager(options);
    mm.addCTOModel(cto, 'x.cto');
    return mm;
}

/**
 * The AST of `cto`, as a parser manager gives it.
 * @param {object} core the core under test
 * @param {string} cto the CTO text
 * @returns {object} the AST
 */
function astOf(core, cto) {
    return JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(cto, undefined, true).getAst()));
}

/**
 * A DecoratorFactory that makes no decorator, calling `onNew` with each
 * element first: a manager with one builds its model files eagerly.
 * @param {object} core the core under test
 * @param {Function} [onNew] called with each decorated element
 * @returns {object} the factory
 */
function nullFactory(core, onNew) {
    /** A DecoratorFactory that makes no decorator. */
    class NullFactory extends core.DecoratorFactory {
        /**
         * @param {object} parent the decorated element
         * @returns {null} no decorator
         */
        newDecorator(parent) {
            if (onNew) {
                onNew(parent);
            }
            return null;
        }
    }
    return new NullFactory();
}

module.exports = [
    {
        id: 'P5103-LAZY-001',
        covers: 'views-staging.ts installLazyField: the lazy accessors read on the class prototypes give undefined, as the class fields (never on a prototype) did',
        run: (core) => [
            core.Field.prototype.validator,
            core.ScalarDeclaration.prototype.validator,
            core.MapDeclaration.prototype.key,
            core.MapDeclaration.prototype.value,
            core.Property.prototype.sizeValidator,
            core.Decorated.prototype.decorators,
            core.ModelFile.prototype.declarations,
            core.ModelFile.prototype.localTypes,
        ],
        expect: { ok: ['<undefined>', '<undefined>', '<undefined>', '<undefined>', '<undefined>', '<undefined>', '<undefined>', '<undefined>'] },
    },
    {
        id: 'P5103-LAZY-002',
        covers: 'views-staging.ts installLazyField: a lazy field of an object that never ran its constructor reads undefined',
        run: (core) => [
            Object.create(core.Field.prototype).validator,
            Object.create(core.ScalarDeclaration.prototype).validator,
            Object.create(core.MapDeclaration.prototype).key,
            Object.create(core.Property.prototype).sizeValidator,
        ],
        expect: { ok: ['<undefined>', '<undefined>', '<undefined>', '<undefined>'] },
    },
    {
        id: 'P5103-LAZY-003',
        covers: 'views-staging.ts buildModelFileLocalTypes, materialise: a lazily built file\'s localTypes read before its declarations, and its declarations written before they are read',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const first = mm.getModelFile('org.p5103.shapes@1.0.0');
            const byLocal = [...first.localTypes.keys()];
            const second = managerOf(core, SHAPES).getModelFile('org.p5103.shapes@1.0.0');
            const declarations = second.declarations;
            second.localTypes = new Map();
            const third = managerOf(core, SHAPES).getModelFile('org.p5103.shapes@1.0.0');
            third.declarations = [];
            return [byLocal, declarations.length, second.getAllDeclarations().length, third.localTypes.size, third.getAllDeclarations().length];
        },
        expect: {'ok': [['org.p5103.shapes@1.0.0.Base', 'org.p5103.shapes@1.0.0.Thing', 'org.p5103.shapes@1.0.0.Tags', 'org.p5103.shapes@1.0.0.Small', 'org.p5103.shapes@1.0.0.Code', 'org.p5103.shapes@1.0.0.Uses'], 6, 6, 6, 0]},
    },
    {
        id: 'P5103-LAZY-004',
        covers: 'views-staging.ts declarationIndex: a model with no declarations key, read by type name',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.fromAst({ $class: `${MM}.Models`, models: [{ $class: `${MM}.Model`, namespace: 'org.p5103.empty@1.0.0', imports: [] }] });
            return [probe(() => mm.getType('org.p5103.empty@1.0.0.Nope')), mm.getModelFile('org.p5103.empty@1.0.0').getLocalType('Nope'),
                mm.getModelFile('org.p5103.empty@1.0.0').getAllDeclarations().length];
        },
        expect: {'ok': ['TypeNotFoundException', null, 0]},
    },
    {
        id: 'P5103-LOAD-001',
        covers: 'views-staging.ts readUnchecked: a manager with decorator factories and the shape check off loads a valid model, and rejects an unreadable one',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: false });
            mm.addDecoratorFactory(nullFactory(core));
            const ok = probe(() => mm.addCTOModel(SHAPES, 'x.cto'));
            const ast = astOf(core, SHAPES);
            ast.namespace = 'org.p5103.bad@1.0.0';
            ast.declarations[0].name = 7;
            const bad = probe(() => new core.ModelFile(mm, ast));
            return [ok, mm.getType('org.p5103.shapes@1.0.0.Thing').getProperties().length, bad];
        },
        expect: {'ok': ['ok', 10, 'IllegalModelException']},
    },
    {
        id: 'P5103-LOAD-002',
        covers: 'views-staging.ts stableAstText, systemModelVerdict: many managers built in a row, with and without the metamodel, reuse the system models\' verdicts',
        run: (core) => {
            const out = [];
            for (let i = 0; i < 3; i++) {
                const mm = new core.ModelManager({ addMetamodel: i % 2 === 0 });
                out.push(mm.getNamespaces().length);
                mm.clearModelFiles();
                out.push(mm.getNamespaces().length);
            }
            return out;
        },
        expect: {'ok': [3, 2, 2, 2, 3, 2]},
    },
    {
        id: 'P5103-PROPS-001',
        covers: 'views-lookups.ts lookupValid, newLookup: getProperties after the own properties array changes, and after the super type\'s',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const uses = mm.getType('org.p5103.shapes@1.0.0.Uses');
            const base = mm.getType('org.p5103.shapes@1.0.0.Base');
            const before = uses.getProperties().map((p) => p.getName());
            const extra = base.getOwnProperties()[0];
            uses.getOwnProperties().push(extra);
            const afterOwn = uses.getProperties().map((p) => p.getName());
            base.getOwnProperties().pop();
            const afterSuper = uses.getProperties().map((p) => p.getName());
            return [before, afterOwn, afterSuper, attempt(() => uses.getProperty('name') && uses.getProperty('name').getName())];
        },
        expect: {'ok': [['small', 'code', 'name'], ['small', 'code', 'name', 'name'], ['small', 'code', 'name'], 'name']},
    },
    {
        id: 'P5103-SER-001',
        covers: 'serializer-codec.ts, serializer.ts: toJSON and fromJSON of values the binary layout leaves to the text path (non-finite numbers, an invalid date), and fromJSON with __proto__ keys',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const thing = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
            thing.ratio = NaN;
            const nan = attempt(() => serializer.toJSON(thing, { validate: false }));
            thing.ratio = Infinity;
            const inf = attempt(() => serializer.toJSON(thing, { validate: false }));
            thing.ratio = -Infinity;
            const ninf = attempt(() => serializer.toJSON(thing, { validate: false }));
            thing.ratio = 1.5;
            thing.when = core.dayjs.utc('not a date');
            const invalid = attempt(() => serializer.toJSON(thing, { validate: false }));
            const proto = attempt(() => serializer.fromJSON(JSON.parse('{"$class":"org.p5103.shapes@1.0.0.Thing","id":"t2","labels":{"__proto__":"x","a":"b"}}')).labels);
            return [nan, inf, ninf, invalid, proto];
        },
        expect: {'ok': [{'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'ratio': null, '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'ratio': null, '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'ratio': null, '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'ratio': 1.5, 'when': 'Invalid Date', '$identifier': 't1'}, {}]},
    },
    {
        id: 'P5103-SER-002',
        covers: 'serializer.ts optionsText: one options object used again unchanged, then changed, then with an object value',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const json = { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', when: '2024-01-02T03:04:05.000Z' };
            const options = { validate: true };
            const out = [];
            out.push(serializer.toJSON(serializer.fromJSON(json, options), options));
            out.push(serializer.toJSON(serializer.fromJSON(json, options), options));
            options.utcOffset = 60;
            out.push(serializer.toJSON(serializer.fromJSON(json, options), options));
            options.extra = { nested: true };
            out.push(serializer.toJSON(serializer.fromJSON(json, options), options));
            delete options.extra;
            out.push(serializer.toJSON(serializer.fromJSON(json, options), options));
            return out;
        },
        expect: {'ok': [{'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'when': '2024-01-02T03:04:05.000Z', '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'when': '2024-01-02T03:04:05.000Z', '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'when': '2024-01-02T04:04:05.000+01:00', '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'when': '2024-01-02T04:04:05.000+01:00', '$identifier': 't1'}, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'when': '2024-01-02T04:04:05.000+01:00', '$identifier': 't1'}]},
    },
    {
        id: 'P5103-VAL-001',
        covers: 'validate-resource.ts: setPropertyValue and addArrayValue on a ValidatedResource after its manager changes, and with an invalid date',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const thing = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
            const out = [probe(() => thing.setPropertyValue('count', 3))];
            mm.addCTOModel('namespace org.p5103.other@1.0.0\nconcept Other {}', 'o.cto');
            out.push(probe(() => thing.setPropertyValue('count', 4)));
            out.push(probe(() => thing.setPropertyValue('when', core.dayjs.utc('nope'))));
            out.push(probe(() => thing.addArrayValue('tags', 'x')));
            out.push(probe(() => thing.setPropertyValue('labels', new Map([['__proto__', 'x']]))));
            return out;
        },
        expect: {'ok': ['ok', 'ok', 'ok', 'ok', 'ok']},
    },
    {
        id: 'P5103-VAL-002',
        covers: 'validate-instance.ts: validateInstance with permitResourcesForRelationships, collectAll false, and a $class other than the fqn asked for',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            if (typeof mm.validateInstance !== 'function') {
                // New in P5-89 (accordproject/concerto#1239): not in 5.0.0.
                return 'no validateInstance';
            }
            const doc = { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', count: 'x', ratio: 'y' };
            return [
                mm.validateInstance(doc, { collectAll: false }).errors.length,
                mm.validateInstance(doc).errors.length,
                mm.validateInstance(doc, { permitResourcesForRelationships: true }).valid,
                mm.validateInstance({ $class: 'org.p5103.shapes@1.0.0.Base' }, {}, 'org.p5103.shapes@1.0.0.Thing').valid,
            ];
        },
        expect: { ok: [1, 1, false, true] },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5103-LOAD-003',
        covers: 'views-staging.ts stageLoadedModelFile: an AST of a namespace the manager never writes, loaded first without the shape check, then with it',
        run: (core) => {
            const root = JSON.parse(JSON.stringify(new core.ModelManager().getModelFile('concerto@1.0.0').getAst()));
            const unchecked = new core.ModelManager({ metamodelValidation: false });
            const checked = new core.ModelManager();
            const a = probe(() => new core.ModelFile(unchecked, root));
            const b = probe(() => new core.ModelFile(checked, root));
            const c = probe(() => new core.ModelFile(checked, root));
            return [a, b, c, new core.ModelFile(checked, root).getNamespace()];
        },
        expect: {'ok': ['ok', 'ok', 'ok', 'concerto@1.0.0']},
    },
    {
        id: 'P5103-STAGE-001',
        covers: 'views-staging.ts commitStaged, commitStagedAll, validateAndCommitStaged, updateStaged, validateAstStaged: files whose stage the engine evicted (more files built than its staging slot keeps) are added, in a batch, updated and checked from their ASTs instead',
        run: (core) => {
            const out = [];
            for (const options of [{}, { metamodelValidation: true }]) {
                const mm = new core.ModelManager(options);
                const files = [];
                for (let i = 0; i < 300; i++) {
                    const ast = astOf(core, `namespace org.p5103.evict${i}@1.0.0\nconcept C${i} { o String s optional }`);
                    files.push(new core.ModelFile(mm, ast, undefined, `e${i}.cto`));
                }
                out.push(probe(() => mm.addModelFile(files[0])));
                out.push(probe(() => mm.addModelFiles([files[1], files[2]])));
                const update = new core.ModelFile(mm, astOf(core, 'namespace org.p5103.evict0@1.0.0\nconcept C0 { o Integer n optional }'), undefined, 'e0.cto');
                for (let i = 0; i < 300; i++) {
                    new core.ModelFile(mm, astOf(core, `namespace org.p5103.filler${i}@1.0.0\nconcept F${i} {}`));
                }
                out.push(probe(() => mm.updateModelFile(update)));
                out.push(mm.getType('org.p5103.evict0@1.0.0.C0').getProperties().map((p) => p.getName()));
                out.push(probe(() => files[299].validate()));
                out.push(probe(() => mm.addModelFiles(files.slice(290, 299))));
                out.push(mm.getNamespaces().length);
            }
            return out;
        },
        expect: {'ok': ['ok', 'ok', 'ok', ['n'], 'ok', 'ok', 14, 'ok', 'ok', 'ok', ['n'], 'ok', 'ok', 14]},
    },
    {
        id: 'P5103-STAGE-002',
        covers: 'views-staging.ts commitStagedAll: a batch larger than its id buffer, and a batch built by a manager with decorator factories (built eagerly, not staged)',
        run: (core) => {
            const big = new core.ModelManager();
            const files = [];
            for (let i = 0; i < 150; i++) {
                files.push(new core.ModelFile(big, astOf(core, `namespace org.p5103.big${i}@1.0.0\nconcept B${i} {}`)));
            }
            big.addModelFiles(files);
            const eager = new core.ModelManager();
            eager.addDecoratorFactory(nullFactory(core));
            const pair = [0, 1].map((i) => new core.ModelFile(eager, astOf(core, `namespace org.p5103.eager${i}@1.0.0\nconcept E${i} {}`)));
            eager.addModelFiles(pair);
            return [big.getNamespaces().length, eager.getNamespaces().length, eager.getType('org.p5103.eager1@1.0.0.E1').getName()];
        },
        expect: {'ok': [152, 4, 'E1']},
    },
    {
        id: 'P5103-STAGE-003',
        covers: 'views-staging.ts commitStagedAll: a batch whose registration fails part way (a namespace already registered) keeps what the engine registered',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace org.p5103.dup@1.0.0\nconcept D {}', 'd.cto');
            const files = [
                new core.ModelFile(mm, astOf(core, 'namespace org.p5103.fresh@1.0.0\nconcept F {}')),
                new core.ModelFile(mm, astOf(core, 'namespace org.p5103.dup@1.0.0\nconcept D2 {}')),
            ];
            return [probe(() => mm.addModelFiles(files)), mm.getNamespaces().sort()];
        },
        expect: {'ok': ['Error', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5103.dup@1.0.0']]},
    },
    {
        id: 'P5103-SER-003',
        covers: 'serializer-codec.ts, serializer.ts asUnsupported, errors.ts makeError: values the wire codec cannot carry (a BigInt, a class instance, an object with no constructor, a Resource subclass, a key the engine reads as a wire tag) fall back to the visitor path',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const thing = () => {
                const t = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
                t.code = 'A1';
                return t;
            };
            const out = [];
            const show = (v) => (typeof v === 'object' && v !== null ? Object.keys(v).map((k) => `${k}:${typeof v[k]}`) : v);
            const big = thing();
            big.count = 10n;
            out.push(attempt(() => show(serializer.toJSON(big, { validate: false }))));
            const instance = thing();
            instance.code = new (class Custom {})();
            out.push(attempt(() => show(serializer.toJSON(instance, { validate: false }))));
            const anonymous = thing();
            anonymous.code = new (class {})();
            out.push(attempt(() => show(serializer.toJSON(anonymous, { validate: false }))));
            const bare = thing();
            bare.code = Object.create(Object.create(null));
            out.push(attempt(() => show(serializer.toJSON(bare, { validate: false }))));
            /** A Resource subclass, which the wire codec does not carry. */
            class Sub extends core.Resource {}
            const sub = thing();
            sub.base = new Sub(mm, mm.getType('org.p5103.shapes@1.0.0.Base'), 'org.p5103.shapes@1.0.0', 'Base');
            out.push(attempt(() => show(serializer.toJSON(sub, { validate: false }))));
            const tagged = thing();
            tagged.code = { '@@oracle': 'nope' };
            out.push(attempt(() => show(serializer.toJSON(tagged, { validate: false }))));
            out.push(attempt(() => show(serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: { '@@oracle': 'nope' } }))));
            out.push(attempt(() => serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', ratio: NaN }, { validate: false }).ratio).toString());
            out.push(attempt(() => serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', ratio: Infinity }).ratio).toString());
            return out;
        },
        expect: {'ok': [['$class:string', 'id:string', 'code:string', 'count:bigint', '$identifier:string'], ['$class:string', 'id:string', 'code:object', '$identifier:string'], ['$class:string', 'id:string', 'code:object', '$identifier:string'], ['$class:string', 'id:string', 'code:object', '$identifier:string'], ['$class:string', 'id:string', 'code:string', 'base:object', '$identifier:string'], ['$class:string', 'id:string', 'code:object', '$identifier:string'], 'threw ValidationException', 'NaN', 'threw ValidationException']},
    },
    {
        id: 'P5103-SER-004',
        covers: 'serializer.ts cachedHandleFor: a Serializer over a model manager that is not a BaseModelManager (no engine mirror) serves toJSON and fromJSON through the visitor path',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const duck = {
                getType: (fqn) => mm.getType(fqn),
                getModelFile: (ns) => mm.getModelFile(ns),
                getSerializer: () => mm.getSerializer(),
                getFactory: () => mm.getFactory(),
            };
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, duck);
            const thing = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: 'A1', count: 2 });
            return [thing.getIdentifier(), thing.count, serializer.toJSON(thing)];
        },
        expect: {'ok': ['t1', 2, {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't1', 'code': 'A1', 'count': 2, '$identifier': 't1'}]},
    },
    {
        id: 'P5103-SER-005',
        covers: 'serializer-codec.ts: fromJSON of relationships (as strings and, with acceptResourcesForRelationships, as resources), an invalid date with validation off, and a __proto__ field',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const out = [];
            const rel = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', other: 'resource:org.p5103.shapes@1.0.0.Thing#t2' });
            out.push([rel.other.constructor.name, rel.other.toURI()]);
            out.push(attempt(() => {
                const nested = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', other: { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't2' } },
                    { acceptResourcesForRelationships: true, validate: false });
                return [nested.other.constructor.name, nested.other.getIdentifier()];
            }));
            out.push(attempt(() => {
                const bad = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', when: 'not a date' }, { validate: false });
                return [bad.when && bad.when.isValid && bad.when.isValid(), serializer.toJSON(bad, { validate: false })];
            }));
            out.push(attempt(() => Object.keys(serializer.fromJSON(JSON.parse('{"$class":"org.p5103.shapes@1.0.0.Thing","id":"t1","__proto__":{"x":1}}'), { validate: false }))));
            const withRel = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't3');
            withRel.other = factory.newRelationship('org.p5103.shapes@1.0.0', 'Thing', 't4');
            out.push(serializer.toJSON(withRel));
            return out;
        },
        expect: {'ok': [['Relationship', 'resource:org.p5103.shapes@1.0.0.Thing#t2'], ['ValidatedResource', 't2'], 'threw ValidationException', 'threw ValidationException', {'$class': 'org.p5103.shapes@1.0.0.Thing', 'id': 't3', 'other': 'resource:org.p5103.shapes@1.0.0.Thing#t4', '$identifier': 't3'}]},
    },
    {
        id: 'P5103-HANDLE-001',
        covers: 'handles.ts releaseHandle, withEngineCallbacks: a ModelFile.filter predicate that runs filter itself (a handle released while an engine call with callbacks is running)',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const file = mm.getModelFile('org.p5103.shapes@1.0.0');
            const inner = [];
            const outer = file.filter((declaration) => {
                const nested = file.filter((d) => d.getName() !== declaration.getName(), mm);
                inner.push(nested ? nested.getAllDeclarations().length : null);
                return declaration.getName() !== 'Uses';
            }, mm);
            return [outer.getAllDeclarations().map((d) => d.getName()), inner];
        },
        expect: {'ok': [['Base', 'Thing', 'Tags', 'Small', 'Code'], [5, 5, 5, 5, 5, 5]]},
    },
    {
        id: 'P5103-VI-001',
        covers: 'validate-instance.ts: validateInstance and validateInstanceOrThrow (new in P5-89) for documents the engine cannot read (a class instance, a key it reads as a wire tag), options it cannot encode, a subtype and a mismatched $class, includeActual on a missing value, redactMessages',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            const summary = (r) => [r.valid, (r.errors || []).map((e) => [e.code, e.path, 'actual' in e ? typeof e.actual : 'none']), r.resource === null ? null : typeof r.resource];
            const thrown = (fn) => {
                try {
                    const r = fn();
                    return ['ok', r === null ? null : typeof r];
                } catch (e) {
                    return [e.constructor.name, Array.isArray(e.details) ? e.details.map((d) => d.code) : 'no details'];
                }
            };
            const thing = mm.getType('org.p5103.shapes@1.0.0.Thing');
            const base = mm.getType('org.p5103.shapes@1.0.0.Base');
            const valid = { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: 'A1' };
            const withClass = { ...valid, code: new (class Custom {})() };
            const tagged = { ...valid, code: { '@@oracle': 'nope' } };
            const noClass = { id: 't1', code: 'A1' };
            const missing = { $class: 'org.p5103.shapes@1.0.0.Thing', code: 'A1' };
            const uses = { $class: 'org.p5103.shapes@1.0.0.Uses', small: 3 };
            const unknownType = { $class: 'org.p5103.shapes@1.0.0.Nope', id: 'x' };
            return [
                summary(mm.validateInstance(withClass)),
                summary(mm.validateInstance(withClass, { collectAll: false })),
                summary(mm.validateInstance(tagged, { includeActual: true })),
                summary(mm.validateInstance(valid, { utcOffset: new (class Offset {})() })),
                summary(mm.validateInstance(missing, { includeActual: true, redactMessages: true })),
                summary(mm.validateInstance(unknownType)),
                summary(thing.validateInstance(noClass)),
                summary(thing.validateInstance(withClass, { hydrate: false })),
                summary(base.validateInstance({ ...uses, code: new (class Custom {})() })),
                summary(thing.validateInstance({ ...uses, code: new (class Custom {})() })),
                summary(thing.validateInstance({ ...unknownType, code: new (class Custom {})() })),
                thrown(() => mm.validateInstanceOrThrow(withClass)),
                thrown(() => mm.validateInstanceOrThrow(tagged)),
                thrown(() => mm.validateInstanceOrThrow(tagged, { hydrate: false })),
                thrown(() => base.validateInstanceOrThrow(uses)),
                thrown(() => thing.validateInstanceOrThrow(uses)),
                thrown(() => thing.validateInstanceOrThrow({ ...uses, code: new (class Custom {})() })),
                thrown(() => thing.validateInstanceOrThrow(missing, { includeActual: true })),
                thrown(() => mm.validateInstanceOrThrow(missing, { hydrate: false })),
            ];
        },
        expect: { ok: [[false,[['TYPE_VIOLATION','/code','none']],null],[false,[['TYPE_VIOLATION','/code','none']],null],[false,[['TYPE_VIOLATION','/code','object']],null],[true,[],'object'],[false,[['TYPE_VIOLATION','','object']],null],[false,[['TYPE_NOT_FOUND','','none']],null],[true,[],'object'],[false,[['TYPE_VIOLATION','/code','none']],null],[false,[['TYPE_VIOLATION','/code','none']],null],[false,[['NOT_ASSIGNABLE','','none']],null],[false,[['TYPE_NOT_FOUND','','none']],null],['ValidationException',['TYPE_VIOLATION']],['ValidationException','no details'],['ValidationException',['TYPE_VIOLATION']],['ok','object'],['ValidationException',['NOT_ASSIGNABLE']],['ValidationException',['NOT_ASSIGNABLE']],['Error',['TYPE_VIOLATION']],['Error',['TYPE_VIOLATION']]] },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5103-VR-001',
        covers: 'validate-resource.ts: ValidatedResource.validate and setPropertyValue with values the binary writer leaves to the visitor (a class instance, a __proto__ key, an own $class, a getter that throws) and through the property slots',
        run: (core) => {
            const mm = managerOf(core, `${SHAPES}
transaction Tx {
  o String note optional
}
event Ev {
  o String note optional
}`);
            const factory = new core.Factory(mm);
            const fresh = () => {
                const t = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
                t.code = 'A1';
                return t;
            };
            const out = [];
            const anon = fresh();
            anon.base = new (class {})();
            out.push(probe(() => anon.validate()));
            const proto = fresh();
            proto.labels = JSON.parse('{"__proto__":"x"}');
            out.push(probe(() => proto.validate()));
            const ownProto = fresh();
            Object.defineProperty(ownProto, '__proto__', { value: 1, enumerable: true, configurable: true, writable: true });
            out.push(probe(() => ownProto.validate()));
            const ownClass = fresh();
            ownClass.$class = 'org.p5103.shapes@1.0.0.Thing';
            out.push(probe(() => ownClass.validate()));
            const getter = fresh();
            Object.defineProperty(getter, 'ratio', { get() { throw new TypeError('no'); }, enumerable: true, configurable: true });
            out.push(probe(() => getter.validate()));
            const rel = fresh();
            rel.other = factory.newRelationship('org.p5103.shapes@1.0.0', 'Thing', 't9');
            out.push(probe(() => rel.validate()));
            const target = fresh();
            out.push(probe(() => target.setPropertyValue('labels', new Map([['a', new (class {})()]]))));
            out.push(probe(() => target.setPropertyValue('when', core.dayjs.utc(8.64e15))));
            const tx = factory.newTransaction('org.p5103.shapes@1.0.0', 'Tx');
            out.push(probe(() => tx.setPropertyValue('note', 'n')));
            out.push(probe(() => tx.setPropertyValue('$timestamp', core.dayjs.utc())));
            out.push(probe(() => tx.validate()));
            const ev = factory.newEvent('org.p5103.shapes@1.0.0', 'Ev');
            out.push(probe(() => ev.setPropertyValue('note', 3)));
            return out;
        },
        expect: {'ok': ['ValidationException', 'Error', 'ValidationException', 'ok', 'TypeError', 'ok', 'Error', 'ok', 'ok', 'ok', 'ok', 'ValidationException']},
    },
    {
        id: 'P5103-DECL-001',
        covers: 'views-lookups.ts propertiesOf, identifierLevel: a ClassDeclaration built directly from an AST node (not by a ModelFile) reads its properties and identifier through the engine on every call',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const file = mm.getModelFile('org.p5103.shapes@1.0.0');
            const ast = mm.getType('org.p5103.shapes@1.0.0.Uses').ast;
            const direct = new core.ConceptDeclaration(file, JSON.parse(JSON.stringify(ast)));
            const thingAst = mm.getType('org.p5103.shapes@1.0.0.Thing').ast;
            const asset = new core.AssetDeclaration(file, JSON.parse(JSON.stringify(thingAst)));
            return [
                direct.getProperties().map((p) => p.getName()),
                direct.getProperty('name') && direct.getProperty('name').getName(),
                direct.getIdentifierFieldName(),
                asset.getIdentifierFieldName(),
                asset.getProperties().length,
                asset.getProperty('nope'),
            ];
        },
        expect: {'ok': [['small', 'code', 'name'], 'name', null, 'id', 10, null]},
    },
    {
        id: 'P5103-VALIDATE-001',
        covers: 'views-staging.ts validateLoaded: ModelFile.validate() on a file registered from its stage, and after its manager validated it',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const file = mm.getModelFile('org.p5103.shapes@1.0.0');
            const out = [probe(() => file.validate())];
            mm.validateModelFiles();
            out.push(probe(() => file.validate()));
            out.push(probe(() => mm.getModelFile('concerto@1.0.0').validate()));
            return out;
        },
        expect: {'ok': ['ok', 'ok', 'ok']},
    },
    {
        id: 'P5103-BIG-001',
        covers: 'wire.ts WireWriter: a model whose AST is larger than the writer keeps (it grows several times, then goes back to its initial size), and a resource with a large string',
        run: (core) => {
            const big = 'x'.repeat(4 * 1024 * 1024 + 1024);
            const ast = astOf(core, 'namespace org.p5103.big@1.0.0\n@Doc("x")\nconcept Big {\n  o String text optional\n}');
            ast.declarations[0].decorators[0].arguments[0].value = big;
            const mm = new core.ModelManager();
            mm.addModelFile(new core.ModelFile(mm, ast, undefined, 'big.cto'));
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const r = factory.newConcept('org.p5103.big@1.0.0', 'Big');
            r.text = big;
            const json = serializer.toJSON(r);
            const back = serializer.fromJSON(json);
            const small = new core.ModelManager();
            small.addCTOModel('namespace org.p5103.small@1.0.0\nconcept Small {}', 's.cto');
            return [mm.getType('org.p5103.big@1.0.0.Big').getDecorator('Doc').getArguments()[0].length, json.text.length, back.text.length,
                small.getType('org.p5103.small@1.0.0.Small').getName()];
        },
        expect: {'ok': [4195328, 4195328, 4195328, 'Small']},
    },
    {
        id: 'P5103-SER-006',
        covers: 'serializer.ts fromJsonEnv: fromJSON of a transaction, an event and a system-identified concept with no identifier (the engine has the caller generate the last)',
        run: (core) => {
            const mm = managerOf(core, `${SHAPES}
transaction Tx {
  o String note optional
}
event Ev {
  o String note optional
}
concept Sys identified {
  o String x optional
}`);
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            const tx = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Tx', note: 'n' });
            const ev = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Ev' });
            const sys = serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Sys', x: 'y' });
            return [typeof tx.getIdentifier(), typeof ev.getIdentifier(), !!tx.$timestamp, typeof sys.getIdentifier(), String(sys.getIdentifier()).length];
        },
        expect: {'ok': ['undefined', 'undefined', true, 'string', 36]},
    },
    {
        id: 'P5103-LOAD-004',
        covers: 'views-staging.ts localType, ModelFile.getLocalType: a decorator factory that looks a local type up while the file is being built gets the error TS gives before the local types exist',
        run: (core) => {
            const seen = [];
            const mm = new core.ModelManager();
            mm.addDecoratorFactory(nullFactory(core, (parent) => {
                try {
                    parent.getModelFile().getLocalType('Base');
                    seen.push('found');
                } catch (e) {
                    seen.push(e.constructor.name);
                }
            }));
            mm.addCTOModel(SHAPES, 'x.cto');
            return [seen.length > 0, [...new Set(seen)]];
        },
        expect: {'ok': [true, ['Error']]},
    },
    {
        id: 'P5103-MM-001',
        covers: 'basemodelmanager.ts: getType of a name that is not a string, a ModelFile subclass that overrides validate() or getVersion() added, added in a batch and updated, and writeModelsToFileSystem for a model with no definitions',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const out = [probe(() => mm.getType(5)), probe(() => mm.getType(null)), probe(() => mm.getType({ toString: () => 'org.p5103.shapes@1.0.0.Thing' }))];
            const calls = [];
            /** A ModelFile that records its validate() calls. */
            class Validating extends core.ModelFile {
                /**
                 * Records the call, then validates.
                 * @returns {*} what ModelFile.validate returns
                 */
                validate() {
                    calls.push(this.getNamespace());
                    return super.validate();
                }
            }
            /** A ModelFile that reports no version. */
            class Unversioned extends core.ModelFile {
                /**
                 * No version.
                 * @returns {null} none
                 */
                getVersion() {
                    return null;
                }
            }
            const ast = (ns) => astOf(core, `namespace ${ns}\nconcept C {}`);
            out.push(probe(() => mm.addModelFile(new Validating(mm, ast('org.p5103.v1@1.0.0')))));
            out.push(calls.length > 0);
            out.push(probe(() => mm.addModelFile(new Unversioned(mm, ast('org.p5103.u1@1.0.0')))));
            out.push(probe(() => mm.addModelFiles([new Unversioned(mm, ast('org.p5103.u2@1.0.0'))])));
            out.push(probe(() => mm.updateModelFile(new Unversioned(mm, ast('org.p5103.shapes@1.0.0')))));
            out.push(probe(() => mm.addModelFile(new Unversioned(mm, ast('org.p5103.v1@1.0.0')))));
            const fromAst = new core.ModelManager();
            fromAst.fromAst({ $class: `${MM}.Models`, models: [ast('org.p5103.nodefs@1.0.0')] });
            const fs = require('fs');
            const os = require('os');
            const path = require('path');
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p5103-'));
            try {
                out.push(probe(() => fromAst.writeModelsToFileSystem(dir)));
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
            return out;
        },
        expect: {'ok': ['TypeError', 'Error', 'TypeError', 'ok', true, 'Error', 'Error', 'Error', 'Error', 'Error']},
    },
    {
        id: 'P5103-FILTER-001',
        covers: 'modelfile.ts filter: a file that is not registered (built but not added) is filtered by its TS body, with its imports pruned (an ImportType, an ImportTypes with an alias)',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const importer = astOf(core, `namespace org.p5103.imp@1.0.0
import org.p5103.shapes@1.0.0.Base
import org.p5103.shapes@1.0.0.{Thing as T, Tags}
concept Uses1 extends Base {
  o T thing optional
}
concept Plain {
  o String s optional
}`);
            const detached = new core.ModelFile(mm, importer);
            const keepAll = detached.filter(() => true, mm);
            const plainOnly = detached.filter((d) => d.getName() === 'Plain', mm);
            const none = detached.filter(() => false, mm);
            return [
                keepAll && keepAll.getAllDeclarations().map((d) => d.getName()),
                keepAll && keepAll.getImports().length,
                plainOnly && plainOnly.getAllDeclarations().map((d) => d.getName()),
                plainOnly && plainOnly.getAst().imports.length,
                none,
            ];
        },
        expect: {'ok': [['Uses1', 'Plain'], 8, ['Plain'], 0, null]},
    },
    {
        id: 'P5103-EXT-001',
        async: true,
        covers: 'views-staging.ts updateExternalStaged, basemodelmanager.ts updateExternalModels: downloaded files registered from their stages, and (a manager with decorator factories builds them eagerly, unstaged) from their ASTs',
        run: async (core) => {
            const out = [];
            for (const factories of [false, true]) {
                const mm = new core.ModelManager();
                if (factories) {
                    mm.addDecoratorFactory(nullFactory(core));
                }
                mm.addCTOModel('namespace org.p5103.local@1.0.0\nconcept L {}', 'l.cto');
                const downloaded = [
                    { ast: astOf(core, 'namespace org.p5103.ext@1.0.0\nconcept E {\n  o String s optional\n}'), definitions: undefined, fileName: '@ext.cto' },
                    { ast: astOf(core, 'namespace org.p5103.local@1.0.0\nconcept L {\n  o Integer n optional\n}'), definitions: undefined, fileName: '@l.cto' },
                ];
                await mm.updateExternalModels({}, { downloadExternalDependencies: async () => downloaded.map((d) => ({ ...d, ast: JSON.parse(JSON.stringify(d.ast)) })) });
                out.push([mm.getNamespaces().sort(), mm.getType('org.p5103.local@1.0.0.L').getProperties().map((p) => p.getName())]);
                try {
                    await mm.updateExternalModels({}, { downloadExternalDependencies: async () => [{ ast: astOf(core, 'namespace org.p5103.bad@1.0.0\nconcept B extends Missing {}'), fileName: '@b.cto' }] });
                    out.push('ok');
                } catch (e) {
                    out.push(e.constructor.name);
                }
                out.push(mm.getNamespaces().sort());
            }
            return out;
        },
        expect: {'ok': [[['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5103.ext@1.0.0', 'org.p5103.local@1.0.0'], ['n']], 'IllegalModelException', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5103.ext@1.0.0', 'org.p5103.local@1.0.0'], [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5103.ext@1.0.0', 'org.p5103.local@1.0.0'], ['n']], 'IllegalModelException', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5103.ext@1.0.0', 'org.p5103.local@1.0.0']]},
    },
    {
        id: 'P5103-UPDATE-001',
        covers: 'views-staging.ts updateStaged: updateModelFile in a manager with decorator factories (an eagerly built file, never staged)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addDecoratorFactory(nullFactory(core));
            mm.addCTOModel(SHAPES, 'x.cto');
            const updated = SHAPES.replace('o String name optional', 'o String name optional\n  o Integer age optional');
            mm.updateModelFile(updated, 'x.cto');
            return [mm.getType('org.p5103.shapes@1.0.0.Base').getProperties().map((p) => p.getName())];
        },
        expect: {'ok': [['name', 'age']]},
    },
    {
        id: 'P5103-VR-002',
        covers: 'validate-resource.ts validateProperty: a property slot the engine no longer accepts (BaseModelManager.validateAst registers the metamodel, which moves the engine\'s epoch but not the model version) is dropped, and the value checked by name',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const thing = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
            const out = [probe(() => thing.setPropertyValue('code', 'A1'))];
            out.push(probe(() => mm.validateAst(mm.getModelFile('org.p5103.shapes@1.0.0'))));
            out.push(probe(() => thing.setPropertyValue('code', 'A2')));
            out.push(probe(() => thing.setPropertyValue('code', 5)));
            out.push(probe(() => thing.setPropertyValue('code', 'A3')));
            return out;
        },
        expect: {'ok': ['ok', 'ok', 'ok', 'ValidationException', 'ok']},
    },
    {
        id: 'P5103-SER-007',
        covers: 'serializer-codec.ts encodeBytes: an error a getter throws while a document is written in the binary layout is the caller\'s, from fromJSON and toJSON',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const json = { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1' };
            Object.defineProperty(json, 'code', { get() { throw new RangeError('no'); }, enumerable: true });
            const thing = factory.newResource('org.p5103.shapes@1.0.0', 'Thing', 't1');
            Object.defineProperty(thing, 'code', { get() { throw new RangeError('no'); }, enumerable: true, configurable: true });
            return [probe(() => serializer.fromJSON(json)), probe(() => serializer.toJSON(thing))];
        },
        expect: {'ok': ['RangeError', 'RangeError']},
    },
    {
        id: 'P5103-VI-002',
        covers: 'validate-instance.ts documentOf, mergedText: an error a getter throws while the document or the options are encoded is the caller\'s',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            const json = { $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1' };
            Object.defineProperty(json, 'code', { get() { throw new RangeError('no'); }, enumerable: true });
            const options = {};
            Object.defineProperty(options, 'utcOffset', { get() { throw new SyntaxError('no'); }, enumerable: true });
            return [probe(() => mm.validateInstance(json)), probe(() => mm.validateInstance({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1' }, options))];
        },
        expect: { ok: ['RangeError', 'SyntaxError'] },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5103-UTIL-001',
        covers: 'modelutil.ts memoisedEngineCall: more distinct arguments than the memo keeps',
        run: (core) => {
            let last;
            for (let i = 0; i < 4200; i++) {
                last = core.ModelUtil.capitalizeFirstLetter(`p5103name${i}`);
            }
            return [last, core.ModelUtil.capitalizeFirstLetter('p5103name0')];
        },
        expect: {'ok': ['P5103name4199', 'P5103name0']},
    },
    {
        id: 'P5103-DCS-002',
        covers: 'views-staging.ts adoptStagedModels: a DecoratorManager result with more model files than the new manager\'s staging slot keeps (some stages evicted, those files added from their ASTs, and the result validated)',
        run: (core) => {
            const mm = new core.ModelManager();
            for (let i = 0; i < 270; i++) {
                mm.addCTOModel(`namespace org.p5103.many${i}@1.0.0\nconcept M${i} {\n  o String s optional\n}`, `m${i}.cto`);
            }
            const commands = {
                $class: 'org.accordproject.decoratorcommands@0.3.0.DecoratorCommandSet',
                name: 'p5103', version: '1.0.0',
                commands: [{
                    $class: 'org.accordproject.decoratorcommands@0.3.0.Command', type: 'UPSERT',
                    target: { $class: 'org.accordproject.decoratorcommands@0.3.0.CommandTarget', namespace: 'org.p5103.many269@1.0.0', declaration: 'M269' },
                    decorator: { $class: `${MM}.Decorator`, name: 'Tag', arguments: [] },
                }],
            };
            const decorated = core.DecoratorManager.decorateModels(mm, commands);
            const extracted = core.DecoratorManager.extractDecorators(decorated, { removeDecoratorsFromModel: true });
            return [decorated.getNamespaces().length, decorated.getType('org.p5103.many269@1.0.0.M269').getDecorator('Tag').getName(),
                extracted.modelManager.getNamespaces().length];
        },
        expect: {'ok': [272, 'Tag', 272]},
    },
    {
        id: 'P5103-VI-003',
        covers: 'validate-instance.ts valueAt, mergedText: includeActual for a diagnostic at a path the document does not have, and an option whose value has a getter that throws',
        run: (core) => {
            const mm = managerOf(core, 'namespace org.p5103.vi@1.0.0\nconcept Inner {\n  o String req\n}\nconcept Outer {\n  o Inner inner\n}');
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            const result = mm.validateInstance({ $class: 'org.p5103.vi@1.0.0.Outer', inner: { $class: 'org.p5103.vi@1.0.0.Inner' } }, { includeActual: true });
            const nested = {};
            Object.defineProperty(nested, 'x', { get() { throw new SyntaxError('no'); }, enumerable: true });
            return [result.errors.map((e) => [e.code, e.path, 'actual' in e]),
                probe(() => mm.validateInstance({ $class: 'org.p5103.vi@1.0.0.Inner', req: 'r' }, { extra: nested }))];
        },
        expect: { ok: [[['MISSING_REQUIRED_PROPERTY', '/inner/req', false]], 'SyntaxError'] },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5103-EXT-002',
        async: true,
        covers: 'views-staging.ts updateExternalStaged, dropStaged: more downloaded files than the staging slot keeps (stages the engine evicted), added from their ASTs, the others\' stages dropped',
        run: async (core) => {
            const mm = new core.ModelManager();
            const asts = [];
            for (let i = 0; i < 270; i++) {
                asts.push(astOf(core, `namespace org.p5103.dl${i}@1.0.0\nconcept D${i} {}`));
            }
            await mm.updateExternalModels({}, { downloadExternalDependencies: async () => asts.map((ast, i) => ({ ast: JSON.parse(JSON.stringify(ast)), fileName: `@d${i}.cto` })) });
            return [mm.getNamespaces().length, mm.getType('org.p5103.dl0@1.0.0.D0').getName(), mm.getType('org.p5103.dl269@1.0.0.D269').getName()];
        },
        expect: {'ok': [272, 'D0', 'D269']},
    },
    {
        id: 'P5103-LOAD-005',
        covers: 'views-staging.ts stableAstText, sameBytes: a new manager whose metamodel AST (the shared constant) changed since the last one was built',
        run: (core) => {
            const metamodel = require(require.resolve('@accordproject/concerto-metamodel', { paths: [core.root] }));
            const ast = metamodel.MetaModelUtil.metaModelAst;
            const flag = ast.declarations.map((d) => d.properties || []).flat().find((p) => p.isOptional === true);
            const before = new core.ModelManager({ addMetamodel: true }).getNamespaces().length;
            flag.isOptional = false;
            try {
                const changed = new core.ModelManager({ addMetamodel: true });
                return [before, changed.getNamespaces().length];
            } finally {
                flag.isOptional = true;
                new core.ModelManager({ addMetamodel: true });
            }
        },
        expect: {'ok': [3, 3]},
    },
    {
        id: 'P5103-BATCH-001',
        covers: 'serializer.ts cachedHandleFor, BaseModelManager.fork: while addModelFiles adds a batch (a decorator factory runs as each CTO file is built), the Serializer uses its visitor path, and fork() refuses',
        run: (core) => {
            const mm = managerOf(core, SHAPES);
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            const seen = [];
            mm.addDecoratorFactory(nullFactory(core, (parent) => {
                const manager = parent.getModelFile().getModelManager();
                const thing = attempt(() => serializer.toJSON(serializer.fromJSON({ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: 'A1' })));
                seen.push([thing, typeof manager.fork === 'function' ? probe(() => manager.fork()) : 'no fork']);
            }));
            mm.addModelFiles(['namespace org.p5103.batch@1.0.0\n@Term("B")\nconcept B {}'], ['b.cto']);
            return [seen.length > 0, seen[0], mm.getType('org.p5103.batch@1.0.0.B').getName()];
        },
        // fork() is new (P5-97): not in 5.0.0.
        expect: { ok: [true, [{ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: 'A1', $identifier: 't1' }, 'Error'], 'B'] },
        reference: { ok: [true, [{ $class: 'org.p5103.shapes@1.0.0.Thing', id: 't1', code: 'A1', $identifier: 't1' }, 'no fork'], 'B'] },
    },
    {
        id: 'P5103-SER-008',
        covers: 'serializer-codec.ts encodeBytes: a toJSON or fromJSON that runs while another one is writing its document (a getter that serializes) takes the text path',
        run: (core) => {
            const mm = managerOf(core, 'namespace org.p5103.re@1.0.0\nconcept Inner {\n  o String s optional\n}\nconcept Outer {\n  o String note optional\n  o Inner inner optional\n}');
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const inner = factory.newConcept('org.p5103.re@1.0.0', 'Inner');
            inner.s = 'x';
            const outer = factory.newConcept('org.p5103.re@1.0.0', 'Outer');
            Object.defineProperty(outer, 'note', { get() { return JSON.stringify(serializer.toJSON(inner)); }, enumerable: true, configurable: true });
            const doc = { $class: 'org.p5103.re@1.0.0.Outer' };
            Object.defineProperty(doc, 'note', { get() { return serializer.fromJSON({ $class: 'org.p5103.re@1.0.0.Inner', s: 'y' }).s; }, enumerable: true });
            return [serializer.toJSON(outer), serializer.toJSON(serializer.fromJSON(doc))];
        },
        expect: {'ok': [{'$class': 'org.p5103.re@1.0.0.Outer', 'note': '{"$class":"org.p5103.re@1.0.0.Inner","s":"x"}'}, {'$class': 'org.p5103.re@1.0.0.Outer', 'note': 'y'}]},
    },
];
