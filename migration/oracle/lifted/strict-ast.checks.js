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
 * P5-49 lifted checks (accordproject/concerto-rust#370): the strict AST
 * shape check at model load, BREAKING-CHANGES-PLAN.md BC-19 with BC-17,
 * BC-18 and BC-20 folded in, on by default in R1.
 *
 * Unless the manager was built with `metamodelValidation: false`, the
 * `ModelFile` constructor checks the AST against the Concerto metamodel
 * (concerto-rust `instance::metamodel::check_ast_shape`) before any part of
 * it is walked, and throws an `IllegalModelException` for an AST that does
 * not have the metamodel's shape. v5.0.0 loads many such ASTs, iterates a
 * string `decorators` value, coerces a non-string name or crashes with a
 * `TypeError`. Every check here covers that intended breaking change, so
 * `expect` is the workspace outcome and `reference` is v5.0.0's
 * (fallbacks.spec.js). Run by fallbacks.spec.js.
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * A model with a concept `C` whose properties are `properties`.
 * @param {string} ns the namespace
 * @param {object[]} properties the property nodes
 * @param {object} [extra] fields to set on the concept
 * @returns {object} the model AST
 */
function model(ns, properties, extra = {}) {
    return {
        $class: `${MM}.Model`,
        decorators: [],
        namespace: ns,
        imports: [],
        declarations: [Object.assign({
            $class: `${MM}.ConceptDeclaration`,
            name: 'C',
            isAbstract: false,
            properties,
        }, extra)],
    };
}

/**
 * A property node.
 * @param {string} $class the `$class`
 * @param {string} name the name
 * @param {object} [extra] more fields
 * @returns {object} the property AST
 */
function prop($class, name, extra = {}) {
    return Object.assign({ $class, name, isArray: false, isOptional: false }, extra);
}

const GOOD = prop(`${MM}.StringProperty`, 'id');

/**
 * `ModelManager.addModelFile` of a `ModelFile` built from `ast`, in a
 * manager built with `options`.
 * @param {object} core the core under test
 * @param {object} ast the model AST
 * @param {object} [options] the model manager options
 * @returns {string[]} the namespaces the manager holds
 */
function add(core, ast, options) {
    const mm = new core.ModelManager(options);
    mm.addModelFile(new core.ModelFile(mm, ast, undefined, 'x.json'), undefined, 'x.json');
    return mm.getNamespaces();
}

/**
 * `ModelManager.fromAst` of `models`, in a manager built with `options`.
 * @param {object} core the core under test
 * @param {object[]} models the model ASTs
 * @param {object} [options] the model manager options
 * @returns {string[]} the namespaces the manager holds
 */
function fromAst(core, models, options) {
    const mm = new core.ModelManager(options);
    mm.fromAst({ $class: `${MM}.Models`, models });
    return mm.getNamespaces();
}

/**
 * An `IllegalModelException` outcome.
 * @param {string} message the message
 * @returns {object} the expected outcome
 */
function rejected(message) {
    return { throws: { name: 'IllegalModelException', message } };
}

/**
 * The shape check's metamodel error (`modelfile-load-astshape`), which has
 * no model file or location.
 * @param {string} message the metamodel check's own message
 * @returns {object} the expected outcome
 */
function shape(message) {
    return rejected(`Model AST does not conform to the metamodel: ${message} `);
}

/**
 * P5-61: what running `fn` did: `'loaded'` when it returned, `'error'` when
 * it threw an error, or `'trap'` when the error is a WebAssembly trap
 * (`WebAssembly.RuntimeError`, such as `unreachable`). With the shape check
 * off, the class and message of the error are unspecified
 * (`metamodelValidation`'s docs), so only this is compared.
 * @param {object} core the core under test
 * @param {Function} fn the load
 * @returns {string} `'loaded'`, `'error'` or `'trap'`
 */
function noTrap(core, fn) {
    try {
        fn();
        return 'loaded';
    } catch (e) {
        return e instanceof WebAssembly.RuntimeError ? 'trap' : 'error';
    }
}

/**
 * Malformed model ASTs, each one the engine's typed read cannot read
 * (P5-61), for the opt-out checks.
 * @param {string} ns the namespace
 * @returns {object[]} the ASTs
 */
function unreadable(ns) {
    const decl = (extra) => model(ns, [GOOD], extra);
    return [
        Object.assign(model(ns, [GOOD]), { decorators: 5 }),
        Object.assign(model(ns, [GOOD]), { decorators: 'x' }),
        model(ns, [prop(`${MM}.StringProperty`, 'id', { decorators: [null] })]),
        decl({ name: 7 }),
        decl({ properties: 'x' }),
        decl({ superType: { $class: `${MM}.TypeIdentifier`, name: null } }),
        model(ns, [prop(`${MM}.RelationshipProperty`, 'r')]),
        model(ns, [prop(`${MM}.IntegerProperty`, 'n', { validator: { $class: `${MM}.IntegerDomainValidator`, lower: '0' } })]),
        Object.assign(model(ns, []), {
            declarations: [{ $class: `${MM}.MapDeclaration`, name: 'M', key: 5, value: null }],
        }),
        Object.assign(model(ns, []), { declarations: 'x' }),
        // Since P5-61's review: an unknown key, a keyless `identified` and a
        // validator with no `$class`, which the loader used to read.
        decl({ undeclared: 1 }),
        decl({ identified: true }),
        model(ns, [prop(`${MM}.StringProperty`, 'id', { validator: { pattern: 'a', flags: '' } })]),
    ];
}

/**
 * The namespaces a manager holds after loading `ns` (the system
 * namespaces are not listed).
 * @param {string} ns the namespace
 * @returns {object} the expected outcome
 */
function loaded(ns) {
    return { ok: ['concerto.decorator@1.0.0', 'concerto@1.0.0', ns] };
}

module.exports = [
    // ---- BC-19: ASTs v5.0.0 loads ------------------------------------
    {
        id: 'BC19-001',
        covers: 'BC-19: a wrong-typed validator bound (T2a) is rejected at load',
        run: (core) => add(core, model('org.acme.bc19.a@1.0.0', [GOOD, prop(`${MM}.IntegerProperty`, 'age', {
            validator: { $class: `${MM}.IntegerDomainValidator`, lower: '0' },
        })])),
        expect: shape('Expected value at path `$.declarations[0].properties[1].validator.lower` to be of type `Integer`'),
        reference: loaded('org.acme.bc19.a@1.0.0'),
    },
    {
        id: 'BC19-002',
        covers: 'BC-19: an `identified` of the wrong shape (T2a) is rejected at load',
        run: (core) => add(core, model('org.acme.bc19.b@1.0.0', [GOOD], { identified: 'yes' })),
        expect: rejected('Invalid identified. Expected an object with a $class. Found "yes" '),
        reference: loaded('org.acme.bc19.b@1.0.0'),
    },
    {
        id: 'BC19-005',
        covers: 'BC-19 (P5-61): a keyless `identified` or validator value, or a validator with no `$class`, which the metamodel check alone accepts, is rejected at load',
        run: (core) => [
            [{ identified: true }, []],
            [{ identified: {} }, []],
            [{}, [prop(`${MM}.StringProperty`, 'p', { validator: { pattern: 'a', flags: '' } })]],
            [{}, [prop(`${MM}.StringProperty`, 'p', { lengthValidator: 0 })]],
            [{}, [prop(`${MM}.StringProperty`, 'p', { isArray: true, sizeValidator: [] })]],
        ].map(([extra, properties], i) => {
            try {
                return add(core, model(`org.acme.bc19.e${i}@1.0.0`, [GOOD, ...properties], extra));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [
                'IllegalModelException: Invalid identified. Expected an object with a $class. Found true ',
                'IllegalModelException: Invalid identified. Expected an object with a $class. Found {} ',
                'IllegalModelException: Invalid validator. Expected an object with a $class. Found {"pattern":"a","flags":""} ',
                'IllegalModelException: Invalid lengthValidator. Expected an object with a $class. Found 0 ',
                'IllegalModelException: Invalid sizeValidator. Expected an object with a $class. Found [] ',
            ],
        },
        reference: {
            ok: [
                loaded('org.acme.bc19.e0@1.0.0').ok,
                loaded('org.acme.bc19.e1@1.0.0').ok,
                loaded('org.acme.bc19.e2@1.0.0').ok,
                loaded('org.acme.bc19.e3@1.0.0').ok,
                'BaseException: Validator error for field `p`. org.acme.bc19.e4@1.0.0.C.p: Invalid collection size, minSize and/or maxSize must be specified.',
            ],
        },
    },
    {
        id: 'BC19-003',
        covers: 'BC-19: a property the metamodel does not declare is rejected by fromAst',
        run: (core) => fromAst(core, [Object.assign(model('org.acme.bc19.c@1.0.0', [GOOD]), { undeclared: [] })]),
        expect: shape('Unexpected properties for type concerto.metamodel@1.0.0.Model: undeclared'),
        reference: loaded('org.acme.bc19.c@1.0.0'),
    },
    {
        id: 'BC19-004',
        covers: 'BC-19 and BC-25: a property $class that is not a metamodel class is rejected at construction (the P5-10c lazy-only cluster shape)',
        run: (core) => {
            const mm = new core.ModelManager();
            new core.ModelFile(mm, model('org.acme.bc19.d@1.0.0', [GOOD, prop('StringProperty', 'name')]), undefined, 'x.json');
            return 'constructed';
        },
        expect: shape('Namespace is not defined for type "StringProperty".'),
        reference: rejected('Unrecognised model element "StringProperty". File \'x.json\': '),
    },
    // ---- BC-17: a decorators value that is not an array --------------
    {
        id: 'BC17-001',
        covers: 'BC-17: a string decorators value (T2b) is rejected, not iterated by code unit',
        run: (core) => ['x', '💥emoji'].map((decorators) => {
            try {
                return add(core, model(`org.acme.bc17.a${decorators.length}@1.0.0`, [Object.assign({}, GOOD, { decorators })]));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [
                'IllegalModelException: Invalid decorators. Expected array. Found "x" ',
                'IllegalModelException: Invalid decorators. Expected array. Found "💥emoji" ',
            ],
        },
        reference: {
            ok: [
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.bc17.a1@1.0.0'],
                'IllegalModelException: Duplicate decorator undefined File \'x.json\': ',
            ],
        },
    },
    {
        id: 'BC17-002',
        covers: 'BC-17: a number or boolean decorators value is rejected, not ignored',
        run: (core) => [5, true].map((decorators) => {
            try {
                return add(core, Object.assign(model(`org.acme.bc17.b${decorators}@1.0.0`, [GOOD]), { decorators }));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [
                'IllegalModelException: Invalid decorators. Expected array. Found 5 ',
                'IllegalModelException: Invalid decorators. Expected array. Found true ',
            ],
        },
        reference: {
            ok: [
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.bc17.b5@1.0.0'],
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.bc17.btrue@1.0.0'],
            ],
        },
    },
    // ---- BC-20: non-string names --------------------------------------
    {
        id: 'BC20-001',
        covers: 'BC-20: a numeric declaration name (T2c) is rejected, not coerced',
        run: (core) => add(core, model('org.acme.bc20.a@1.0.0', [GOOD], { name: 1e308 })),
        expect: rejected('Invalid name. Expected a string. Found 1e+308 '),
        reference: rejected('Invalid class name \'1e+308\' File \'x.json\': '),
    },
    {
        id: 'BC20-002',
        covers: 'BC-20: an empty, numeric or boolean super type name is rejected, not coerced',
        run: (core) => ['', 0, false].map((name) => {
            try {
                return add(core, model(`org.acme.bc20.b${String(name).length}@1.0.0`, [GOOD], {
                    superType: { $class: `${MM}.TypeIdentifier`, name },
                }));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [
                'IllegalModelException: Invalid super type name. Expected a non-empty string. Found "" ',
                'IllegalModelException: Invalid super type name. Expected a non-empty string. Found 0 ',
                'IllegalModelException: Invalid super type name. Expected a non-empty string. Found false ',
            ],
        },
        reference: {
            ok: [
                'IllegalModelException: Could not find super type  File \'x.json\': ',
                'IllegalModelException: Could not find super type 0 File \'x.json\': ',
                'IllegalModelException: Could not find super type false File \'x.json\': ',
            ],
        },
    },
    // ---- BC-18: TypeErrors become IllegalModelExceptions -------------
    {
        id: 'BC18-001',
        covers: 'BC-18: an ImportTypes node whose types is not an array is an IllegalModelException, not a TypeError',
        run: (core) => add(core, Object.assign(model('org.acme.bc18.a@1.0.0', [GOOD]), {
            imports: [{ $class: `${MM}.ImportTypes`, namespace: 'concerto@1.0.0', types: 5 }],
        })),
        expect: shape('Expected value at path `$.imports[0].types` to be an array of type `String`'),
        reference: { throws: { name: 'TypeError', message: 'imp.types.forEach is not a function' } },
    },
    // ---- the option ---------------------------------------------------
    {
        id: 'BC19-OPT-001',
        covers: 'BC-19 opt-out (P5-61): with metamodelValidation false, a number decorators value is still an error at load, not a trap (v5.0.0 loaded it)',
        run: (core) => noTrap(core, () => add(core, Object.assign(model('org.acme.bc19.opt@1.0.0', [GOOD]), { decorators: 5 }), { metamodelValidation: false })),
        expect: { ok: 'error' },
        reference: { ok: 'loaded' },
    },
    {
        id: 'BC19-OPT-002',
        covers: 'BC-19 with metamodelValidation true: the construction check throws an IllegalModelException before addModelFile\'s validateAst (v5.0.0: MetamodelException)',
        run: (core) => {
            const mm = new core.BaseModelManager({ metamodelValidation: true });
            mm.addModel(Object.assign(model('org.acme.bc19.true@1.0.0', [GOOD]), { undeclared: [] }), undefined, 'x.json');
            return mm.getNamespaces();
        },
        expect: shape('Unexpected properties for type concerto.metamodel@1.0.0.Model: undeclared'),
        reference: { throws: { name: 'MetamodelException', message: 'Unexpected properties for type concerto.metamodel@1.0.0.Model: undeclared' } },
    },
    {
        id: 'BC19-OPT-003',
        covers: 'BC-19 opt-out: the TS walk still rejects an unrecognised declaration $class (ModelFile._fromAstDeclarations\' eager path)',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: false });
            new core.ModelFile(mm, { namespace: 'org.acme.bc19.opt3@1.0.0', declarations: [{ $class: 'concerto.metamodel.UnknownThing', name: 'Foo' }] });
            return 'constructed';
        },
        expect: rejected('Unrecognised model element "concerto.metamodel.UnknownThing". '),
    },
    {
        id: 'BC19-OPT-004',
        covers: 'ModelFile.getType of a type imported from a namespace the manager does not hold is null (the walk after the shape check passes)',
        run: (core) => {
            const mm = new core.ModelManager();
            const mf = new core.ModelFile(mm, Object.assign(model('org.acme.bc19.opt4@1.0.0', [GOOD]), {
                imports: [{ $class: `${MM}.ImportType`, namespace: 'org.acme.missing@1.0.0', name: 'Bar' }],
            }), undefined, 'x.cto');
            return [mf.getType('Bar'), mf.getType('String')];
        },
        expect: { ok: [null, 'String'] },
    },
    // ---- P5-61: the opt-out never traps ----------------------------
    {
        id: 'P561-OPT-001',
        covers: 'P5-61: with metamodelValidation false, new ModelFile of an AST the engine cannot read throws an error, never a WASM trap',
        run: (core) => unreadable('org.acme.p561.a@1.0.0').map((ast) => noTrap(core, () => {
            const mm = new core.ModelManager({ metamodelValidation: false });
            new core.ModelFile(mm, ast, undefined, 'x.json');
        })),
        expect: { ok: Array(13).fill('error') },
        reference: { ok: ['loaded', 'loaded', 'error', 'error', 'error', 'loaded', 'error', 'loaded', 'error', 'error', 'loaded', 'loaded', 'loaded'] },
    },
    {
        id: 'P561-OPT-002',
        covers: 'P5-61: with metamodelValidation false, addModel and fromAst of an AST the engine cannot read throw an error, never a WASM trap, and the manager still loads a well-formed model afterwards',
        run: (core) => {
            const mm = new core.BaseModelManager({ metamodelValidation: false });
            const results = unreadable('org.acme.p561.b@1.0.0').map((ast) => [
                noTrap(core, () => mm.addModel(ast, undefined, 'x.json')),
                noTrap(core, () => mm.fromAst({ $class: `${MM}.Models`, models: [ast] })),
            ]);
            mm.addModel(model('org.acme.p561.good@1.0.0', [GOOD]), undefined, 'good.json');
            return [results, mm.getNamespaces()];
        },
        expect: { ok: [
            Array(13).fill(['error', 'error']),
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p561.good@1.0.0'],
        ] },
        reference: { ok: [
            [['loaded', 'loaded'], ['error', 'loaded'], ['error', 'error'], ['error', 'error'], ['error', 'error'],
                ['loaded', 'loaded'], ['error', 'error'], ['loaded', 'loaded'], ['error', 'error'], ['error', 'error'],
                ['loaded', 'loaded'], ['error', 'loaded'], ['error', 'loaded']],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p561.b@1.0.0', 'org.acme.p561.good@1.0.0'],
        ] },
    },
    {
        id: 'P561-OPT-003',
        covers: 'P5-61: with metamodelValidation false and a decorator factory (the eager walk), new ModelFile of an AST the engine cannot read still throws an error, never a WASM trap',
        run: (core) => unreadable('org.acme.p561.c@1.0.0').map((ast) => noTrap(core, () => {
            const mm = new core.ModelManager({ metamodelValidation: false });
            mm.addDecoratorFactory({ newDecorator: () => null });
            new core.ModelFile(mm, ast, undefined, 'x.json');
        })),
        expect: { ok: Array(13).fill('error') },
        reference: { ok: ['loaded', 'loaded', 'error', 'error', 'error', 'loaded', 'error', 'loaded', 'error', 'error', 'loaded', 'loaded', 'loaded'] },
    },
    {
        id: 'BC19-CTO-001',
        covers: 'BC-19: a CTO model with a DateTime default (the parser writes a defaultValue the metamodel does not declare) still loads, and so does its AST',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel('namespace org.acme.bc19.cto@1.0.0\nconcept C { o DateTime d default="2020-01-01T00:00:00Z" }', 'x.cto');
            const copy = new core.ModelManager();
            copy.fromAst(mm.getAst());
            return copy.getType('org.acme.bc19.cto@1.0.0.C').getProperty('d').getDefaultValue();
        },
        expect: { ok: '2020-01-01T00:00:00Z' },
    },
];
