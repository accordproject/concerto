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
 * P5-10d lifted checks (accordproject/concerto-rust#285, BC-25): a property
 * `$class` that is not one of the full metamodel property classes is
 * rejected when the `ModelFile` is constructed, not when its declarations
 * are first read.
 *
 * TS `ClassDeclaration.process` matches each property's `$class` with `===`
 * against `concerto.metamodel@1.0.0.<Kind>Property` and throws
 * `IllegalModelException: Unrecognised model element` otherwise. With lazy
 * views (P5-10a/b) the declarations are built on first read only when the
 * Rust engine accepted the AST at staging, so Rust has to reject the same
 * `$class` values. It used to match the text after the last `.`, and so
 * accepted a bare short name (`StringProperty`), another namespace's
 * (`foo.StringProperty`) and the doubled class the P5-10c fuzz run found
 * (`concerto.metamodel@1.0.0.StringPropertyconcerto.metamodel@1.0.0.StringProperty`).
 *
 * The same holds for a `MapDeclaration`'s key and value `$class`: TS
 * `MapDeclaration.process` checks them with `ModelUtil.isValidMapKey`/
 * `isValidMapValue`, which also compare the full metamodel class with `===`
 * and throw `IllegalModelException: MapDeclaration must contain valid
 * MapKeyType`/`MapValueType` at construction (LAZY-STAGE-013 to 015).
 *
 * Checks 001 to 012 are the minimised cases of the 12 lazy-only clusters in
 * migration/fuzz/results/p5-10c/lazy-only-clusters.json (P5-10c, #271),
 * rebuilt on a small model. The `ModelFile` checks return 'constructed' if
 * construction does not throw, so an error deferred to the first read fails
 * them. `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 *
 * P5-49 (BC-19, R1): by default a `ModelFile`'s AST is checked against the
 * metamodel at construction, which rejects every malformed `$class` here
 * before staging, so BC-25's guarantee is structural on that path
 * (strict-ast.checks.js covers it). These checks build their managers with
 * the opt-out, `metamodelValidation: false`, where the lazy path still
 * relies on Rust's staging rejecting what TS construction rejects. v5.0.0
 * ignores a false `metamodelValidation`, so `expect` is unchanged.
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * The doubled `$class` the fuzz mutator produced for a property kind.
 * @param {string} kind the property kind, e.g. 'StringProperty'
 * @returns {string} the doubled class
 */
function doubled(kind) {
    return `${MM}.${kind}${MM}.${kind}`;
}

/**
 * A `Range` node.
 * @param {number} startLine the start line
 * @param {number} endLine the end line
 * @returns {object} the location
 */
function range(startLine, endLine) {
    return {
        $class: `${MM}.Range`,
        start: { $class: `${MM}.Position`, line: startLine, column: 1, offset: 0 },
        end: { $class: `${MM}.Position`, line: endLine, column: 2, offset: 10 },
    };
}

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

const TYPE_T = { type: { $class: `${MM}.TypeIdentifier`, name: 'C' } };

/**
 * Constructs a `ModelFile` from `ast` in a fresh `ModelManager` (with the
 * BC-19 opt-out).
 * @param {object} core the core under test
 * @param {object} ast the model AST
 * @param {string} [fileName] the file name
 * @returns {string} 'constructed' (construction that fails throws)
 */
function construct(core, ast, fileName) {
    const mm = new core.ModelManager({ metamodelValidation: false });
    new core.ModelFile(mm, ast, undefined, fileName);
    return 'constructed';
}

/**
 * `ModelManager.addModelFile` of a `ModelFile` built from `ast` (with the
 * BC-19 opt-out).
 * @param {object} core the core under test
 * @param {object} ast the model AST
 * @param {string} fileName the file name
 * @returns {string} 'added'
 */
function add(core, ast, fileName) {
    const mm = new core.ModelManager({ metamodelValidation: false });
    mm.addModelFile(new core.ModelFile(mm, ast, undefined, fileName), undefined, fileName);
    return 'added';
}

/**
 * `ModelManager.fromAst` of `models` (with the BC-19 opt-out).
 * @param {object} core the core under test
 * @param {object[]} models the model ASTs
 * @returns {string} 'loaded'
 */
function fromAst(core, models) {
    const mm = new core.ModelManager({ metamodelValidation: false });
    mm.fromAst({ $class: `${MM}.Models`, models });
    return 'loaded';
}

/**
 * The reference's error for an unrecognised property `$class` in a model
 * file with no file name and a class with no location.
 * @param {string} $class the `$class`
 * @returns {object} the expected outcome
 */
function unrecognised($class) {
    return { throws: { name: 'IllegalModelException', message: `Unrecognised model element "${$class}". ` } };
}

const GOOD = prop(`${MM}.StringProperty`, 'id');

/**
 * A model with a map `M` whose key and value nodes have the given `$class`.
 * @param {string} ns the namespace
 * @param {string} keyClass the key node's `$class`
 * @param {string} valueClass the value node's `$class`
 * @returns {object} the model AST
 */
function mapModel(ns, keyClass, valueClass) {
    return {
        $class: `${MM}.Model`,
        decorators: [],
        namespace: ns,
        imports: [],
        declarations: [{ $class: `${MM}.MapDeclaration`, name: 'M', key: { $class: keyClass }, value: { $class: valueClass } }],
    };
}

/**
 * Constructs a map model file named `models/map.json` for each
 * `[keyClass, valueClass]` pair.
 * @param {object} core the core under test
 * @param {string} ns the namespace
 * @param {Array<Array<string>>} pairs the key and value classes
 * @returns {string[]} 'constructed', or the error each construction threw
 */
function constructMaps(core, ns, pairs) {
    return pairs.map(([keyClass, valueClass]) => {
        try {
            return construct(core, mapModel(ns, keyClass, valueClass), 'models/map.json');
        } catch (e) {
            return `${e.constructor.name}: ${e.message}`;
        }
    });
}

const NOT_METAMODEL = (kind) => [kind, `foo.${kind}`, `${MM.replace('1.0.0', '1.0.1')}.${kind}`, doubled(kind)];

module.exports = [
    // ---- the doubled class, per property kind ------------------------
    {
        id: 'LAZY-STAGE-001',
        covers: 'cluster 1 (addModelFile, 121): a doubled IntegerProperty class, with the class location',
        run: (core) => add(core, model('org.acme.lazy.s1@1.0.0', [GOOD, prop(doubled('IntegerProperty'), 'age')], { location: range(3, 7) }), 'models/s1.json'),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: `Unrecognised model element "${doubled('IntegerProperty')}". File 'models/s1.json': line 3 column 1, to line 7 column 2. `,
            },
        },
    },
    {
        id: 'LAZY-STAGE-002',
        covers: 'cluster 2 (fromAst, 100): a doubled StringProperty class',
        run: (core) => fromAst(core, [model('org.acme.lazy.s2@1.0.0', [prop(doubled('StringProperty'), 's')])]),
        expect: unrecognised(doubled('StringProperty')),
    },
    {
        id: 'LAZY-STAGE-003',
        covers: 'cluster 3 (addModelFile, 3): a doubled EnumProperty class in a class with no location',
        run: (core) => add(core, model('org.acme.lazy.s3@1.0.0', [prop(doubled('EnumProperty'), 'e')]), 'models/s3.json'),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: `Unrecognised model element "${doubled('EnumProperty')}". File 'models/s3.json': `,
            },
        },
    },
    {
        id: 'LAZY-STAGE-004',
        covers: 'cluster 10 (addModelFile, 1): a doubled RelationshipProperty class',
        run: (core) => construct(core, model('org.acme.lazy.s4@1.0.0', [GOOD, prop(doubled('RelationshipProperty'), 'r', TYPE_T)])),
        expect: unrecognised(doubled('RelationshipProperty')),
    },
    {
        id: 'LAZY-STAGE-005',
        covers: 'a doubled class of each remaining property kind, at ModelFile construction',
        run: (core) => ['BooleanProperty', 'LongProperty', 'DoubleProperty', 'DateTimeProperty', 'ObjectProperty'].map((kind) => {
            try {
                return construct(core, model('org.acme.lazy.s5@1.0.0', [prop(doubled(kind), 'p', kind === 'ObjectProperty' ? TYPE_T : {})]));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: ['BooleanProperty', 'LongProperty', 'DoubleProperty', 'DateTimeProperty', 'ObjectProperty']
                .map((kind) => `IllegalModelException: Unrecognised model element "${doubled(kind)}". `),
        },
    },
    {
        id: 'LAZY-STAGE-006',
        covers: 'a bare short name and another namespace\'s property class are unrecognised too',
        run: (core) => ['StringProperty', 'foo.StringProperty', 'concerto.metamodel@1.0.1.StringProperty'].map(($class) => {
            try {
                return construct(core, model('org.acme.lazy.s6@1.0.0', [prop($class, 's')]));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: ['StringProperty', 'foo.StringProperty', 'concerto.metamodel@1.0.1.StringProperty']
                .map(($class) => `IllegalModelException: Unrecognised model element "${$class}". `),
        },
    },
    {
        id: 'LAZY-STAGE-007',
        covers: 'the unrecognised class is reported ahead of the property\'s own checks (no name, a null decorator)',
        run: (core) => [{ name: undefined }, { decorators: [null] }].map((extra) => {
            try {
                return construct(core, model('org.acme.lazy.s7@1.0.0', [prop(doubled('StringProperty'), 's', extra)]));
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [
                `IllegalModelException: Unrecognised model element "${doubled('StringProperty')}". `,
                `IllegalModelException: Unrecognised model element "${doubled('StringProperty')}". `,
            ],
        },
    },
    {
        id: 'LAZY-STAGE-008',
        covers: 'cluster 9 (addModelFile, 1): a doubled class with a negative location line',
        run: (core) => {
            const location = range(3, 7);
            location.end.line = -9007199254740985;
            return add(core, model('org.acme.lazy.s8@1.0.0', [prop(doubled('StringProperty'), 's')], { location }), 'models/s8.json');
        },
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: `Unrecognised model element "${doubled('StringProperty')}". File 'models/s8.json': line 3 column 1, to line -9007199254740985 column 2. `,
            },
        },
    },
    // ---- fromAst: the first model's error comes before the second's ---
    // The 14 lazy-only divergences where Rust threw too, but from a later
    // model: TS throws at the first model's construction, so the second
    // model's own error is never reached.
    {
        id: 'LAZY-STAGE-009',
        covers: 'clusters 4, 5, 8, 12 (fromAst, 7): a later model\'s malformed imports',
        run: (core) => [
            -9007199254740991,
            [{ $class: 1 }],
            [{ $class: [`${MM}.ImportType`] }],
        ].map((imports) => {
            try {
                return fromAst(core, [
                    model('org.acme.lazy.s9a@1.0.0', [prop(doubled('StringProperty'), 's')]),
                    Object.assign(model('org.acme.lazy.s9b@1.0.0', [GOOD]), { imports }),
                ]);
            } catch (e) {
                return `${e.constructor.name}: ${e.message}`;
            }
        }),
        expect: {
            ok: [0, 1, 2].map(() => `IllegalModelException: Unrecognised model element "${doubled('StringProperty')}". `),
        },
    },
    {
        id: 'LAZY-STAGE-010',
        covers: 'clusters 6, 7 (fromAst, 2): a later model that redeclares the namespace',
        run: (core) => fromAst(core, [
            model('org.acme.lazy.s10@1.0.0', [prop(doubled('DoubleProperty'), 'range')]),
            model('org.acme.lazy.s10@1.0.0', [GOOD]),
        ]),
        expect: unrecognised(doubled('DoubleProperty')),
    },
    {
        id: 'LAZY-STAGE-011',
        covers: 'cluster 11 (fromAst, 1): a later model that is not an AST',
        run: (core) => fromAst(core, [model('org.acme.lazy.s11@1.0.0', [prop(doubled('StringProperty'), 's')]), false]),
        expect: unrecognised(doubled('StringProperty')),
    },
    // ---- map key and value $class --------------------------------------
    {
        id: 'LAZY-STAGE-013',
        covers: 'a map key $class that is not the full metamodel class (short name, another namespace, another version, doubled)',
        run: (core) => constructMaps(core, 'org.acme.lazy.s13@1.0.0',
            NOT_METAMODEL('StringMapKeyType').map((keyClass) => [keyClass, `${MM}.StringMapValueType`])),
        expect: {
            ok: NOT_METAMODEL('StringMapKeyType')
                .map(() => 'IllegalModelException: MapDeclaration must contain valid MapKeyType  M File \'models/map.json\': '),
        },
    },
    {
        id: 'LAZY-STAGE-014',
        covers: 'a map value $class that is not the full metamodel class (short name, another namespace, another version, doubled)',
        run: (core) => constructMaps(core, 'org.acme.lazy.s14@1.0.0',
            NOT_METAMODEL('StringMapValueType').map((valueClass) => [`${MM}.StringMapKeyType`, valueClass])),
        expect: {
            ok: NOT_METAMODEL('StringMapValueType')
                .map(() => 'IllegalModelException: MapDeclaration must contain valid MapValueType, for MapDeclaration M File \'models/map.json\': '),
        },
    },
    {
        id: 'LAZY-STAGE-015',
        covers: 'the full metamodel classes of the primitive map key and value kinds still load',
        run: (core) => {
            const keys = ['StringMapKeyType', 'DateTimeMapKeyType'];
            const values = ['BooleanMapValueType', 'DateTimeMapValueType', 'StringMapValueType', 'IntegerMapValueType', 'LongMapValueType', 'DoubleMapValueType'];
            const out = [];
            keys.forEach((key, i) => values.forEach((value, j) => {
                const mm = new core.ModelManager();
                const ns = `org.acme.lazy.s15k${i}v${j}@1.0.0`;
                mm.fromAst({ $class: `${MM}.Models`, models: [mapModel(ns, `${MM}.${key}`, `${MM}.${value}`)] });
                const map = mm.getType(`${ns}.M`);
                out.push(`${map.getKey().getType()}:${map.getValue().getType()}`);
            }));
            return out;
        },
        expect: {
            ok: ['String', 'DateTime'].flatMap((k) => ['Boolean', 'DateTime', 'String', 'Integer', 'Long', 'Double'].map((v) => `${k}:${v}`)),
        },
    },
    // ---- the well-formed control -------------------------------------
    {
        id: 'LAZY-STAGE-012',
        covers: 'the full metamodel class of every property kind still loads',
        run: (core) => {
            const kinds = ['BooleanProperty', 'StringProperty', 'IntegerProperty', 'LongProperty', 'DoubleProperty', 'DateTimeProperty'];
            const properties = kinds.map((kind, i) => prop(`${MM}.${kind}`, `p${i}`))
                .concat([prop(`${MM}.ObjectProperty`, 'o', { isOptional: true, ...TYPE_T }), prop(`${MM}.RelationshipProperty`, 'r', TYPE_T)]);
            const mm = new core.ModelManager();
            const identified = { identified: { $class: `${MM}.IdentifiedBy`, name: 'p1' } };
            mm.fromAst({ $class: `${MM}.Models`, models: [model('org.acme.lazy.s12@1.0.0', properties, identified)] });
            return mm.getType('org.acme.lazy.s12@1.0.0.C').getProperties().map((p) => `${p.getName()}:${p.getType()}`);
        },
        expect: { ok: ['p0:Boolean', 'p1:String', 'p2:Integer', 'p3:Long', 'p4:Double', 'p5:DateTime', 'o:C', 'r:C'] },
    },
];
