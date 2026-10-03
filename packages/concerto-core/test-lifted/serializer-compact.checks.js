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
 * P5-16 lifted checks (accordproject/concerto-rust#310): `Serializer.fromJSON`'s
 * engine fast path reads the engine's compact result
 * (concerto-wasm `serializerFromJsonCompact`, or its binary-input form), and
 * must build the same resource the v5.0.0 reference does. P5-103
 * (accordproject/concerto-rust#457) removed the `"typed"` result an engine
 * built before P5-16 gave (`serializerFromJson`), and with it the checks of
 * that branch, which hid the compact binding.
 *
 * A check reports the resource's class, its own property names, its
 * identifiers, the class of each nested resource, and its `toJSON()`. No
 * document has a transaction or event, whose `$timestamp` is the clock.
 *
 * Run by fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p516.compact@1.0.0';

const MODEL = `namespace ${NS}
concept Address { o String street o Integer[] codes optional }
asset Car identified by vin {
  o String vin
  o Address addr
  o Address[] more optional
  o DateTime made optional
  o Double weight optional
  --> Person owner optional
}
participant Person identified by pid { o String pid }
concept Item identified by id {
  o String id
  o Integer sequence
  o String[] labels optional
}
concept Plain { o String s optional o Boolean b optional }
`;

/**
 * A plain description of a resource: see the module doc.
 * @param {object} r the resource
 * @returns {object} the description
 */
function describeResource(r) {
    const nested = {};
    for (const key of Object.keys(r)) {
        const v = r[key];
        const items = Array.isArray(v) ? v : [v];
        const ctors = items
            .filter((x) => x && typeof x === 'object' && typeof x.getFullyQualifiedType === 'function')
            .map((x) => `${x.constructor.name}:${x.getFullyQualifiedIdentifier()}:${Object.keys(x).join(',')}`);
        if (ctors.length) {
            nested[key] = ctors;
        }
    }
    return {
        ctor: r.constructor.name,
        keys: Object.keys(r),
        identifier: r.getIdentifier(),
        fqi: r.getFullyQualifiedIdentifier(),
        nested,
        json: r.toJSON(),
    };
}

/**
 * The check body: `fromJSON(doc, options)` over MODEL, described.
 * @param {object} doc the document
 * @param {object} [options] fromJSON options
 * @returns {Function} the check body
 */
function fromJson(doc, options) {
    return (core) => {
        const mm = new core.ModelManager();
        mm.addCTOModel(MODEL, 'compact.cto');
        const ser = new core.Serializer(new core.Factory(mm), mm);
        // Twice: the second instance of a class is built from the cached
        // class lookups, the first by the constructor.
        const first = describeResource(ser.fromJSON(doc, options));
        const second = describeResource(ser.fromJSON(doc, options));
        return { first, second };
    };
}

const CAR = {
    $class: `${NS}.Car`,
    vin: 'v1',
    addr: { $class: `${NS}.Address`, street: 's', codes: [1, 2] },
    more: [{ $class: `${NS}.Address`, street: 't' }],
    made: '2020-01-02T03:04:05.678Z',
    weight: 1.5,
    owner: `resource:${NS}.Person#p1`,
};
const ITEM = { $class: `${NS}.Item`, id: 'i1', sequence: 3, labels: ['a', 'b'] };
const PLAIN = { $class: `${NS}.Plain`, s: 'x', b: true };

/**
 * The expected outcome of `fromJson(doc)`: both calls describe alike.
 * @param {object} described one description
 * @returns {object} the expectation
 */
function twice(described) {
    return { ok: { first: described, second: described } };
}

// The v5.0.0 reference's descriptions, recorded from it.
const EXPECT = {
    CAR: twice({
        ctor: 'ValidatedResource',
        keys: [
            '$modelManager',
            '$classDeclaration',
            '$namespace',
            '$type',
            '$identifierFieldName',
            '$identifier',
            'vin',
            '$timestamp',
            '$validator',
            'addr',
            'more',
            'made',
            'weight',
            'owner'
        ],
        identifier: 'v1',
        fqi: 'org.acme.lifted.p516.compact@1.0.0.Car#v1',
        nested: {
            addr: [
                'ValidatedResource:org.acme.lifted.p516.compact@1.0.0.Address:$modelManager,$classDeclaration,$namespace,$type,$identifierFieldName,$identifier,$timestamp,$validator,street,codes'
            ],
            more: [
                'ValidatedResource:org.acme.lifted.p516.compact@1.0.0.Address:$modelManager,$classDeclaration,$namespace,$type,$identifierFieldName,$identifier,$timestamp,$validator,street'
            ],
            owner: [
                'Relationship:org.acme.lifted.p516.compact@1.0.0.Person#p1:$modelManager,$classDeclaration,$namespace,$type,$identifierFieldName,$identifier,pid,$timestamp,$class'
            ]
        },
        json: {
            '$class': 'org.acme.lifted.p516.compact@1.0.0.Car',
            vin: 'v1',
            addr: {
                '$class': 'org.acme.lifted.p516.compact@1.0.0.Address',
                street: 's',
                codes: [
                    1,
                    2
                ]
            },
            more: [
                {
                    '$class': 'org.acme.lifted.p516.compact@1.0.0.Address',
                    street: 't'
                }
            ],
            made: '2020-01-02T03:04:05.678Z',
            weight: 1.5,
            owner: 'resource:org.acme.lifted.p516.compact@1.0.0.Person#p1',
            '$identifier': 'v1'
        }
    }),
    ITEM: twice({
        ctor: 'ValidatedResource',
        keys: [
            '$modelManager',
            '$classDeclaration',
            '$namespace',
            '$type',
            '$identifierFieldName',
            '$identifier',
            'id',
            '$timestamp',
            '$validator',
            'sequence',
            'labels'
        ],
        identifier: 'i1',
        fqi: 'org.acme.lifted.p516.compact@1.0.0.Item#i1',
        nested: {},
        json: {
            '$class': 'org.acme.lifted.p516.compact@1.0.0.Item',
            id: 'i1',
            sequence: 3,
            labels: [
                'a',
                'b'
            ]
        }
    }),
    PLAIN: twice({
        ctor: 'ValidatedResource',
        keys: [
            '$modelManager',
            '$classDeclaration',
            '$namespace',
            '$type',
            '$identifierFieldName',
            '$identifier',
            '$timestamp',
            '$validator',
            's',
            'b'
        ],
        identifier: '<undefined>',
        fqi: 'org.acme.lifted.p516.compact@1.0.0.Plain',
        nested: {},
        json: {
            '$class': 'org.acme.lifted.p516.compact@1.0.0.Plain',
            s: 'x',
            b: true
        }
    }),
};

const DOCS = { CAR: [CAR, undefined], ITEM: [ITEM, { validate: false }], PLAIN: [PLAIN, undefined] };

module.exports = Object.keys(DOCS).map((name) => {
    const [doc, options] = DOCS[name];
    return {
        id: `P516-COMPACT-${name}-compact-result`,
        covers: 'Serializer.fromJSON fast path, the engine\'s compact result',
        run: fromJson(doc, options),
        expect: EXPECT[name],
    };
});
