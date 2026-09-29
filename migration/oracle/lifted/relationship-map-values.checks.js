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
 * P5-58 lifted checks (accordproject/concerto-rust#379): BC-05 (R1; DV-007),
 * relationship-typed map values (`map M { o String --> T }`) behave like
 * relationship properties (`--> T field`).
 *
 * v5.0.0 read, wrote and validated such a value as an embedded object,
 * whatever the options: a relationship URI was rejected and an embedded
 * resource was required. Now a value is a relationship reference by
 * default, and an embedded resource is allowed exactly when the options
 * allow one for a property: `acceptResourcesForRelationships` (fromJSON),
 * `permitResourcesForRelationships` and `convertResourcesToRelationships`
 * (toJSON and validation).
 *
 * Each scenario runs twice: through the engine (`RM-E-*`, a plain model
 * manager), where a throw is reduced to its class (error parity is by class,
 * maintainer decision 2026-09-27, P5-09), and through the TS visitors
 * (`RM-V-*`), which a model manager with a custom `regExp` engine forces for
 * `fromJSON`, `toJSON` and `validate()` alike (serializer.ts and
 * validate-resource.ts fall back on `EngineFastPathUnsupported`).
 *
 * `expect` is the workspace outcome and `reference` what v5.0.0 gives
 * (fallbacks.spec.js).
 */

const NS = 'org.acme.lifted.p558.relmap@1.0.0';

/** A custom RegExp engine: plain ECMAScript semantics, but a distinct constructor. */
class CustomRegExp extends RegExp {}

const MODEL = `namespace ${NS}
participant P identified by pid { o String pid o String n optional }
asset A identified by aid { o String aid }
map PM { o String --> P }
concept C {
  o String s optional
  o PM pm optional
}
`;

/**
 * A model manager, factory and serializer over MODEL; the model manager has
 * a custom `regExp` engine when `visitor` is set.
 * @param {object} core the core under test
 * @param {boolean} visitor whether to force the TS visitors
 * @returns {object} `{ mm, factory, ser }`
 */
function setup(core, visitor) {
    const mm = visitor ? new core.ModelManager({ regExp: CustomRegExp }) : new core.ModelManager();
    mm.addCTOModel(MODEL, 'relmap.cto');
    const factory = new core.Factory(mm);
    return { mm, factory, ser: new core.Serializer(factory, mm) };
}

/**
 * Runs `body` and, for the engine variant, reduces a throw to its class.
 * @param {boolean} visitor whether this is the visitor variant
 * @param {Function} body the check body
 * @returns {*} the body's value, or `{ threw: <class> }`
 */
function classOnly(visitor, body) {
    if (visitor) {
        return body();
    }
    try {
        return body();
    } catch (e) {
        return { threw: e && e.constructor ? e.constructor.name : typeof e };
    }
}

/**
 * A map value as plain data: a relationship or resource as its kind and
 * URI, anything else as it is.
 * @param {*} v the value
 * @returns {*} the plain description
 */
function describeValue(v) {
    if (v && typeof v === 'object' && typeof v.isRelationship === 'function') {
        return { kind: v.isRelationship() ? 'relationship' : 'resource', uri: v.toURI() };
    }
    return v;
}

/**
 * `fromJSON` of a `C` whose `pm` map is `pm`, as the populated map's
 * entries.
 * @param {boolean} visitor whether to force the TS visitors
 * @param {object} pm the map's JSON
 * @param {object} [options] fromJSON options
 * @returns {Function} the check body
 */
function populate(visitor, pm, options = {}) {
    return (core) => classOnly(visitor, () => {
        const { ser } = setup(core, visitor);
        const r = ser.fromJSON({ $class: `${NS}.C`, pm }, options);
        return [...r.pm.entries()].map(([k, v]) => [k, describeValue(v)]);
    });
}

/**
 * `toJSON` of a `C` whose `pm` map holds `entries(core, factory)`.
 * @param {boolean} visitor whether to force the TS visitors
 * @param {Function} entries builds the map's entries
 * @param {object} [options] toJSON options
 * @returns {Function} the check body
 */
function generate(visitor, entries, options = {}) {
    return (core) => classOnly(visitor, () => {
        const { factory, ser } = setup(core, visitor);
        const r = factory.newConcept(NS, 'C');
        r.pm = new Map(entries(core, factory));
        return ser.toJSON(r, options).pm;
    });
}

/**
 * `validate()` of a `C` whose `pm` map holds `entries(core, factory)`.
 * @param {boolean} visitor whether to force the TS visitors
 * @param {Function} entries builds the map's entries
 * @returns {Function} the check body
 */
function validate(visitor, entries) {
    return (core) => classOnly(visitor, () => {
        const { factory } = setup(core, visitor);
        const r = factory.newConcept(NS, 'C');
        r.pm = new Map(entries(core, factory));
        r.validate();
        return 'valid';
    });
}

const bob = (core, factory) => [['a', factory.newRelationship(NS, 'P', 'bob')]];
const bobResource = (core, factory) => [['a', factory.newResource(NS, 'P', 'bob')]];
const anAsset = (core, factory) => [['a', factory.newRelationship(NS, 'A', 'a1')]];

const URIS = { a: `resource:${NS}.P#bob`, b: 'carol' };
const EMBEDDED = { a: { $class: `${NS}.P`, pid: 'bob' } };

/**
 * The scenarios, for the engine (`visitor` false) or the TS visitors.
 * @param {boolean} visitor whether to force the TS visitors
 * @returns {object[]} the checks
 */
function scenarios(visitor) {
    const id = (n) => `RM-${visitor ? 'V' : 'E'}-${n}`;
    const path = visitor ? 'TS visitor' : 'engine';
    const threw = (name, message) => (visitor ? { throws: { name, message } } : { ok: { threw: name } });
    return [
        {
            id: id('001'),
            covers: `${path}, fromJSON: URIs and bare identifiers populate relationships (BC-05)`,
            run: populate(visitor, URIS),
            expect: {
                ok: [
                    ['a', { kind: 'relationship', uri: `resource:${NS}.P#bob` }],
                    ['b', { kind: 'relationship', uri: `resource:${NS}.P#carol` }],
                ],
            },
            reference: visitor
                ? { throws: { name: 'ValidationException', message: `Unexpected properties for type ${NS}.P: ${[...Array(48).keys()].join(', ')}` } }
                : { ok: { threw: 'ValidationException' } },
        },
        {
            id: id('002'),
            covers: `${path}, fromJSON: an embedded resource needs acceptResourcesForRelationships (BC-05)`,
            run: populate(visitor, EMBEDDED),
            expect: threw('Error', `Invalid JSON data. Found a value that is not a string: [object Object] for relationship RelationshipMapValueType {map=${NS}.PM, type=${NS}.P}`),
            reference: { ok: [['a', { kind: 'resource', uri: `resource:${NS}.P#bob` }]] },
        },
        {
            id: id('003'),
            covers: `${path}, fromJSON: acceptResourcesForRelationships reads an embedded resource (validation off) (BC-05)`,
            run: populate(visitor, EMBEDDED, { acceptResourcesForRelationships: true, validate: false }),
            expect: { ok: [['a', { kind: 'resource', uri: `resource:${NS}.P#bob` }]] },
            reference: { ok: [['a', { kind: 'resource', uri: `resource:${NS}.P#bob` }]] },
        },
        {
            id: id('004'),
            covers: `${path}, fromJSON: the resource's own validator rejects an embedded resource, as for a property (BC-05)`,
            run: populate(visitor, EMBEDDED, { acceptResourcesForRelationships: true }),
            expect: threw('ValidationException', `Model violation in the "${NS}.C" instance. Class "${NS}.P" has a value of "Resource {id=${NS}.P#bob}". Expected a "Relationship".`),
            reference: { ok: [['a', { kind: 'resource', uri: `resource:${NS}.P#bob` }]] },
        },
        {
            id: id('005'),
            covers: `${path}, toJSON: a relationship is written as its URI (BC-05)`,
            run: generate(visitor, bob),
            expect: { ok: { a: `resource:${NS}.P#bob` } },
            reference: visitor
                ? { throws: { name: 'ValidationException', message: `Model violation in the "${NS}.C" instance. Class "${NS}.P" has the value of "Relationship {id=${NS}.P#bob}". Expected a "Resource" or a "Concept".` } }
                : { ok: { threw: 'ValidationException' } },
        },
        {
            id: id('006'),
            covers: `${path}, toJSON: an embedded resource is rejected without an option (BC-05)`,
            run: generate(visitor, bobResource),
            expect: threw('ValidationException', `Model violation in the "${NS}.C" instance. Class "${NS}.P" has a value of "Resource {id=${NS}.P#bob}". Expected a "Relationship".`),
            reference: { ok: { a: { $class: `${NS}.P`, $identifier: 'bob', pid: 'bob' } } },
        },
        {
            id: id('007'),
            covers: `${path}, toJSON: an embedded resource with validation off still needs an option (BC-05)`,
            run: generate(visitor, bobResource, { validate: false }),
            expect: threw('Error', `Did not find a relationship for ${NS}.P found Resource {id=${NS}.P#bob}`),
            reference: { ok: { a: { $class: `${NS}.P`, $identifier: 'bob', pid: 'bob' } } },
        },
        {
            id: id('008'),
            covers: `${path}, toJSON: convertResourcesToRelationships writes an embedded resource as its URI (BC-05)`,
            run: generate(visitor, bobResource, { convertResourcesToRelationships: true }),
            expect: { ok: { a: `resource:${NS}.P#bob` } },
            reference: { ok: { a: { $class: `${NS}.P`, $identifier: 'bob', pid: 'bob' } } },
        },
        {
            id: id('009'),
            covers: `${path}, toJSON: permitResourcesForRelationships writes an embedded resource in full`,
            run: generate(visitor, bobResource, { permitResourcesForRelationships: true }),
            expect: { ok: { a: { $class: `${NS}.P`, $identifier: 'bob', pid: 'bob' } } },
        },
        {
            id: id('010'),
            covers: `${path}, toJSON: convertResourcesToId writes a relationship as its identifier (BC-05)`,
            run: generate(visitor, bob, { convertResourcesToId: true }),
            expect: { ok: { a: 'bob' } },
            reference: visitor
                ? { throws: { name: 'ValidationException', message: `Model violation in the "${NS}.C" instance. Class "${NS}.P" has the value of "Relationship {id=${NS}.P#bob}". Expected a "Resource" or a "Concept".` } }
                : { ok: { threw: 'ValidationException' } },
        },
        {
            id: id('011'),
            covers: `${path}, validate(): a relationship is valid (BC-05)`,
            run: validate(visitor, bob),
            expect: { ok: 'valid' },
            reference: visitor
                ? { throws: { name: 'ValidationException', message: `Model violation in the "${NS}.C" instance. Class "${NS}.P" has the value of "Relationship {id=${NS}.P#bob}". Expected a "Resource" or a "Concept".` } }
                : { ok: { threw: 'ValidationException' } },
        },
        {
            id: id('012'),
            covers: `${path}, validate(): an embedded resource is rejected (BC-05)`,
            run: validate(visitor, bobResource),
            expect: threw('ValidationException', `Model violation in the "${NS}.C" instance. Class "${NS}.P" has a value of "Resource {id=${NS}.P#bob}". Expected a "Relationship".`),
            reference: { ok: 'valid' },
        },
        {
            id: id('013'),
            covers: `${path}, validate(): a relationship to a type that is not assignable is rejected`,
            run: validate(visitor, anAsset),
            expect: threw('ValidationException', `Instance "${NS}.C" has a property "PM" with type "${NS}.A" that is not derived from "${NS}.P".`),
            reference: visitor
                ? { throws: { name: 'ValidationException', message: `Model violation in the "${NS}.C" instance. Class "${NS}.P" has the value of "Relationship {id=${NS}.A#a1}". Expected a "Resource" or a "Concept".` } }
                : { ok: { threw: 'ValidationException' } },
        },
    ];
}

module.exports = [...scenarios(false), ...scenarios(true)];
