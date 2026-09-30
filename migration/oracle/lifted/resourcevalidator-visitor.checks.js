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

/* global BigInt */
'use strict';

/**
 * P5-12c lifted checks (accordproject/concerto-rust#293): the
 * `ResourceValidator` visitor behind `EngineFastPathUnsupported`, and the
 * one-call engine path in front of it.
 *
 * Since P5-12c, `ValidatedResource.validate()`, `setPropertyValue` and
 * `addArrayValue` validate in one Rust engine call
 * (src/engine/validate-resource.ts), and the TS visitor runs only when the
 * engine cannot take the value. A resource whose `$validator` is not a
 * plain `ResourceValidator` (a subclass may override the visitor, which the
 * engine cannot run) is one such case, so every `VV-*` check here gives its
 * resource a subclass that overrides nothing (`forceVisitor`) to drive the
 * visitor through the public API, as the `RV-*` checks in
 * serializer-fallback.checks.js did before P5-12c. (Until P5-52 they used a
 * model manager with a custom `regExp` engine instead; BC-28, R1, made that
 * option ignored, so it no longer leaves the engine path.) The `VE-*` checks run the same scenarios in a plain model
 * manager, where the engine answers, and return only the class of what is
 * thrown: error parity is by class (maintainer decision 2026-09-27, P5-09).
 * `setPropertyValue` of a string, number or boolean on a plain primitive
 * field with no validator stays on the visitor even in a plain model
 * manager, where it is cheaper than an engine call (`visitorIsCheaper`,
 * SET-004 and SET-005).
 *
 * `expect` is the frozen v5.0.0 reference's outcome, except for the
 * P5-24 strict `DateTime` map checks (MAP-007 to MAP-009), whose v5.0.0
 * outcome is in REFERENCE. Run by fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p512c.validate@1.0.0';


const MODEL = `namespace ${NS}
scalar SS extends String length=[1,3]
enum En { o X o Y }
concept Sub { o String x optional }
map MSS { o String o SS }
map MSC { o String o Sub }
map MSD { o String o DateTime }
map MSB { o String o Boolean }
map MSSt { o String o String }
asset A identified by id { o String id }
concept C {
  o String s optional
  o Integer i optional
  o Double d optional
  o Boolean b optional
  o DateTime t optional
  o En e optional
  o SS ss optional
  o Sub sub optional
  o String[] strs optional
  o En[] ens optional
  o Integer[] ints optional
  o MSS mss optional
  o MSC msc optional
  o MSD msd optional
  o MSB msb optional
  o MSSt msst optional
  o MSSt msz size=[1,2] optional
  --> A ref optional
  --> A[] refs optional
}
concept R {
  o String s
  o String dflt default="d"
}
asset Box identified by bid {
  o String bid
  o Sub sub optional
  o Sub[] subs optional
  o String[] tags optional
  o Integer n optional
  o String code regex=/^[a-z]+$/ optional
}
`;

/**
 * A model manager over MODEL.
 * @param {object} core the core under test
 * @returns {object} `{ mm, factory }`
 */
function setup(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(MODEL, 'validate.cto');
    return { mm, factory: new core.Factory(mm) };
}

/**
 * When `visitor` is set, gives `r` a `ResourceValidator` subclass that
 * overrides nothing, which sends its validation to the TS visitor (the
 * engine takes only a plain `ResourceValidator`).
 * @param {object} core the core under test
 * @param {object} r the validated resource
 * @param {boolean} visitor whether to force the visitor path
 * @returns {object} r
 */
function forceVisitor(core, r, visitor) {
    if (visitor) {
        const VisitorOnly = class extends core.ResourceValidator {};
        r.$validator = new VisitorOnly(r.$validator.options);
    }
    return r;
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
 * `validate()` of a validated (`Factory.newConcept`) concept with `fields`
 * assigned directly.
 * @param {string} type the concept
 * @param {object|Function} fields the fields, or `(core, factory, mm) => fields`
 * @param {boolean} visitor whether to force the visitor path
 * @returns {Function} the check body
 */
function validate(type, fields, visitor) {
    return (core) => {
        const { mm, factory } = setup(core);
        const r = forceVisitor(core, factory.newConcept(NS, type), visitor);
        Object.assign(r, typeof fields === 'function' ? fields(core, factory, mm) : fields);
        return classOnly(visitor, () => {
            r.validate();
            return 'valid';
        });
    };
}

/**
 * `validate()` of a validated (`Factory.newResource`) `Box` with `fields`
 * assigned directly.
 * @param {object} fields the fields
 * @param {boolean} visitor whether to force the visitor path
 * @returns {Function} the check body
 */
function validateBox(fields, visitor) {
    return (core) => {
        const { factory } = setup(core);
        const r = forceVisitor(core, factory.newResource(NS, 'Box', 'b1'), visitor);
        Object.assign(r, fields);
        return classOnly(visitor, () => {
            r.validate();
            return { valid: true, $identifier: r.$identifier };
        });
    };
}

/**
 * `setPropertyValue` or `addArrayValue` on a validated `Box`, returning the
 * property afterwards.
 * @param {string} method `setPropertyValue` or `addArrayValue`
 * @param {string} prop the property
 * @param {*|Function} value the value, or `(core, factory) => value`
 * @param {boolean} visitor whether to force the visitor path
 * @returns {Function} the check body
 */
function assign(method, prop, value, visitor) {
    return (core) => {
        const { factory } = setup(core);
        const r = forceVisitor(core, factory.newResource(NS, 'Box', 'b1'), visitor);
        return classOnly(visitor, () => {
            r[method](prop, typeof value === 'function' ? value(core, factory) : value);
            const v = r[prop];
            return Array.isArray(v) ? v.map((x) => (x && typeof x.getFullyQualifiedType === 'function' ? x.toString() : x)) : v;
        });
    };
}

/**
 * The scenarios, each run once through the visitor (`VV-`) and once
 * through the engine (`VE-`).
 */
const SCENARIOS = [
    { id: 'CD-001', covers: 'visitClassDeclaration: a valid concept (a Resource on the stack)', run: (v) => validate('C', { s: 'x', i: 1, ss: 'ab', strs: ['a'], ens: ['X'] }, v) },
    { id: 'CD-002', covers: 'visitClassDeclaration: a missing required property', run: (v) => validate('R', {}, v) },
    { id: 'CD-003', covers: 'visitClassDeclaration: a required property with a default value may be missing', run: (v) => validate('R', { s: 'x', dflt: null }, v) },
    { id: 'CD-004', covers: 'visitClassDeclaration: an undeclared property', run: (v) => validate('C', { nope: 1 }, v) },
    { id: 'CD-005', covers: 'visitClassDeclaration: a nested concept that is not a Resource', run: (v) => validate('C', { sub: { x: 'a' } }, v) },
    { id: 'SC-001', covers: 'visit: a scalar-typed field (isTypeScalar -> visitField(getScalarField()))', run: (v) => validate('C', { ss: 'abcd' }, v) },
    { id: 'EN-001', covers: 'checkEnum: an enum array field holding a single value', run: (v) => validate('C', { ens: 'X' }, v) },
    { id: 'EN-002', covers: 'visitEnumDeclaration: an unknown enum value', run: (v) => validate('C', { e: 'Z' }, v) },
    { id: 'AR-001', covers: 'checkArray: an array field holding a single value', run: (v) => validate('C', { strs: 'x' }, v) },
    { id: 'AR-002', covers: 'checkArray: a wrong item type', run: (v) => validate('C', { ints: [1, 'two'] }, v) },
    { id: 'CI-001', covers: 'reportFieldTypeViolation: a BigInt JSON.stringify cannot print', run: (v) => validate('C', { s: BigInt(10) }, v) },
    { id: 'CI-002', covers: 'reportFieldTypeViolation: a non-finite number', run: (v) => validate('C', { i: Infinity }, v) },
    { id: 'MAP-001', covers: 'visitMapDeclaration/checkMapType: valid maps of every kind', run: (v) => validate('C', (core, factory) => {
        const sub = factory.newConcept(NS, 'Sub');
        sub.x = 'v';
        return {
            mss: new Map([['k', 'v']]),
            msc: new Map([['a', sub]]),
            msd: new Map([['a', '2020-01-01T00:00:00.000Z']]),
            msb: new Map([['a', true]]),
            msst: new Map([['a', 'b']]),
        };
    }, v) },
    { id: 'MAP-002', covers: 'checkMapType: an invalid DateTime value', run: (v) => validate('C', { msd: new Map([['a', 'not a date']]) }, v) },
    { id: 'MAP-003', covers: 'checkMapType: an invalid Boolean value', run: (v) => validate('C', { msb: new Map([['a', 'yes']]) }, v) },
    { id: 'MAP-004', covers: 'visitMapDeclaration: a plain object instead of a Map', run: (v) => validate('C', { msst: { a: 'b' } }, v) },
    { id: 'MAP-005', covers: 'visitField: a map field with a size validator, too many entries', run: (v) => validate('C', { msz: new Map([['a', 'b'], ['c', 'd'], ['e', 'f']]) }, v) },
    { id: 'MAP-006', covers: 'visitField: a map field with a size validator, within bounds', run: (v) => validate('C', { msz: new Map([['a', 'b']]) }, v) },
    // P5-24 (accordproject/concerto-rust#328; BC-42, BC-43, R1): a map's
    // `DateTime` values follow the strict field rule. REFERENCE below holds
    // what v5.0.0 gives where that differs.
    { id: 'MAP-007', covers: 'checkMapType: a date-only DateTime value (BC-43)', run: (v) => validate('C', { msd: new Map([['a', '2020-01-01']]) }, v) },
    { id: 'MAP-008', covers: 'checkMapType: an impossible DateTime value (BC-42, BC-43)', run: (v) => validate('C', { msd: new Map([['a', '2024-02-30T00:00:00Z']]) }, v) },
    { id: 'MAP-009', covers: 'checkMapType: a number as a DateTime value (BC-43)', run: (v) => validate('C', { msd: new Map([['a', 1]]) }, v) },
    { id: 'MAP-010', covers: 'checkMapType: a DateTime value with an out-of-range offset', run: (v) => validate('C', { msd: new Map([['a', '2020-01-01T00:00:00+24:00']]) }, v) },
    { id: 'MAP-011', covers: 'checkMapType: an undefined DateTime value', run: (v) => validate('C', { msd: new Map([['a', undefined]]) }, v) },
    { id: 'REL-001', covers: 'checkRelationship: a relationship whose target type is not identified', run: (v) => validate('C', (core, factory, mm) => ({ ref: core.Relationship.fromURI(mm, `resource:${NS}.Sub#x`) }), v) },
    { id: 'REL-002', covers: 'checkRelationship: a Resource where a relationship is expected', run: (v) => validate('C', (core, factory) => ({ ref: factory.newResource(NS, 'A', 'a1') }), v) },
    { id: 'REL-003', covers: 'visitRelationshipDeclaration: a valid relationship array', run: (v) => validate('C', (core, factory) => ({ refs: [factory.newRelationship(NS, 'A', 'a1')] }), v) },
    { id: 'ID-001', covers: 'visitClassDeclaration: a valid identified resource, and the $identifier write-back', run: (v) => validateBox({ bid: 'b2' }, v) },
    { id: 'ID-002', covers: 'visitClassDeclaration: an identifier that is not a string (id.trim)', run: (v) => validateBox({ bid: 5 }, v) },
    { id: 'ID-003', covers: 'visitClassDeclaration: an empty identifier', run: (v) => validateBox({ bid: ' ' }, v) },
    { id: 'ID-004', covers: 'visitClassDeclaration: an instance $identifierFieldName that is not the model\'s', run: (v) => validateBox({ $identifierFieldName: 'nope' }, v) },
    { id: 'SET-001', covers: 'setPropertyValue: a valid value', run: (v) => assign('setPropertyValue', 'tags', ['a'], v) },
    { id: 'SET-002', covers: 'setPropertyValue: an invalid value', run: (v) => assign('setPropertyValue', 'tags', [1], v) },
    { id: 'SET-003', covers: 'setPropertyValue: a valid nested concept', run: (v) => assign('setPropertyValue', 'sub', (core, factory) => factory.newConcept(NS, 'Sub'), v) },
    { id: 'SET-004', covers: 'setPropertyValue: a valid number on a plain primitive field (visitorIsCheaper)', run: (v) => assign('setPropertyValue', 'n', 5, v) },
    { id: 'SET-005', covers: 'setPropertyValue: a string on a plain Integer field (visitorIsCheaper)', run: (v) => assign('setPropertyValue', 'n', 'five', v) },
    { id: 'SET-006', covers: 'setPropertyValue: a string that fails a regex validator (engine, not visitorIsCheaper)', run: (v) => assign('setPropertyValue', 'code', 'A1', v) },
    { id: 'SET-007', covers: 'setPropertyValue: a string that passes a regex validator (engine, not visitorIsCheaper)', run: (v) => assign('setPropertyValue', 'code', 'ab', v) },
    { id: 'ADD-001', covers: 'addArrayValue: a valid item', run: (v) => assign('addArrayValue', 'tags', 'a', v) },
    { id: 'ADD-002', covers: 'addArrayValue: an invalid item', run: (v) => assign('addArrayValue', 'tags', 2, v) },
    { id: 'ADD-003', covers: 'addArrayValue: an invalid concept item', run: (v) => assign('addArrayValue', 'subs', { x: 'a' }, v) },
];

// The v5.0.0 reference's outcome of each check, by id.
const EXPECT = {
    'VV-CD-001': {'ok': 'valid'},
    'VE-CD-001': {'ok': 'valid'},
    'VV-CD-002': {'throws': {'name': 'ValidationException', 'message': 'The instance "org.acme.lifted.p512c.validate@1.0.0.R" is missing the required field "s".'}},
    'VE-CD-002': {'ok': {'threw': 'ValidationException'}},
    'VV-CD-003': {'ok': 'valid'},
    'VE-CD-003': {'ok': 'valid'},
    'VV-CD-004': {'throws': {'name': 'ValidationException', 'message': 'Instance "undefined" has a property named "nope", which is not declared in "org.acme.lifted.p512c.validate@1.0.0.C".'}},
    'VE-CD-004': {'ok': {'threw': 'ValidationException'}},
    'VV-CD-005': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. Class "org.acme.lifted.p512c.validate@1.0.0.Sub" has the value of "[object Object]". Expected a "Resource" or a "Concept".'}},
    'VE-CD-005': {'ok': {'threw': 'ValidationException'}},
    'VV-SC-001': {'throws': {'name': 'BaseException', 'message': 'Validator error for field `undefined`. org.acme.lifted.p512c.validate@1.0.0.C.ss: The string length of \'abcd\' should not exceed 3 characters.'}},
    'VE-SC-001': {'ok': {'threw': 'BaseException'}},
    'VV-EN-001': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. The field "ens" has a value of ""X"" (type of value: "string"). Expected type of value: "En[]".'}},
    'VE-EN-001': {'ok': {'threw': 'ValidationException'}},
    'VV-EN-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. Invalid enum value of "Z" for the field "En".'}},
    'VE-EN-002': {'ok': {'threw': 'ValidationException'}},
    'VV-AR-001': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. The field "strs" has a value of ""x"" (type of value: "string"). Expected type of value: "String[]".'}},
    'VE-AR-001': {'ok': {'threw': 'ValidationException'}},
    'VV-AR-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. The field "ints" has a value of ""two"" (type of value: "string"). Expected type of value: "Integer[]".'}},
    'VE-AR-002': {'ok': {'threw': 'ValidationException'}},
    'VV-CI-001': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. The field "s" has a value of "10" (type of value: "bigint"). Expected type of value: "String".'}},
    'VE-CI-001': {'ok': {'threw': 'ValidationException'}},
    'VV-CI-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. The field "i" has a value of "Infinity" (type of value: "number"). Expected type of value: "Integer".'}},
    'VE-CI-002': {'ok': {'threw': 'ValidationException'}},
    'VV-MAP-001': {'ok': 'valid'},
    'VE-MAP-001': {'ok': 'valid'},
    'VV-MAP-002': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSD. Expected Type of DateTime but found \'not a date\' instead.'}},
    'VE-MAP-002': {'ok': {'threw': 'Error'}},
    'VV-MAP-003': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSB. Expected Type of Boolean but found string instead, for value \'yes\'.'}},
    'VE-MAP-003': {'ok': {'threw': 'Error'}},
    'VV-MAP-004': {'throws': {'name': 'Error', 'message': 'Expected a Map, but found {"a":"b"}'}},
    'VE-MAP-004': {'ok': {'threw': 'Error'}},
    'VV-MAP-005': {'throws': {'name': 'BaseException', 'message': 'Validator error for field `org.acme.lifted.p512c.validate@1.0.0.C`. org.acme.lifted.p512c.validate@1.0.0.C.msz: Collection must contain no more than 2 elements.'}},
    'VE-MAP-005': {'ok': {'threw': 'BaseException'}},
    'VV-MAP-006': {'ok': 'valid'},
    'VE-MAP-006': {'ok': 'valid'},
    'VV-MAP-007': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSD. Expected Type of DateTime but found \'2020-01-01\' instead.'}},
    'VE-MAP-007': {'ok': {'threw': 'Error'}},
    'VV-MAP-008': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSD. Expected Type of DateTime but found \'2024-02-30T00:00:00Z\' instead.'}},
    'VE-MAP-008': {'ok': {'threw': 'Error'}},
    'VV-MAP-009': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSD. Expected Type of DateTime but found \'1\' instead.'}},
    'VE-MAP-009': {'ok': {'threw': 'Error'}},
    'VV-MAP-010': {'throws': {'name': 'Error', 'message': 'Model violation in org.acme.lifted.p512c.validate@1.0.0.MSD. Expected Type of DateTime but found \'2020-01-01T00:00:00+24:00\' instead.'}},
    'VE-MAP-010': {'ok': {'threw': 'Error'}},
    'VV-MAP-011': {'ok': 'valid'},
    'VE-MAP-011': {'ok': 'valid'},
    'VV-REL-001': {'throws': {'name': 'Error', 'message': 'Cannot have a relationship to a field that is not identifiable.'}},
    'VE-REL-001': {'ok': {'threw': 'Error'}},
    'VV-REL-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.C" instance. Class "org.acme.lifted.p512c.validate@1.0.0.A" has a value of "Resource {id=org.acme.lifted.p512c.validate@1.0.0.A#a1}". Expected a "Relationship".'}},
    'VE-REL-002': {'ok': {'threw': 'ValidationException'}},
    'VV-REL-003': {'ok': 'valid'},
    'VE-REL-003': {'ok': 'valid'},
    'VV-ID-001': {'ok': {'valid': true, '$identifier': 'b2'}},
    'VE-ID-001': {'ok': {'valid': true, '$identifier': 'b2'}},
    'VV-ID-002': {'throws': {'name': 'TypeError', 'message': 'id.trim is not a function'}},
    'VE-ID-002': {'ok': {'threw': 'TypeError'}},
    'VV-ID-003': {'throws': {'name': 'ValidationException', 'message': 'Instance "org.acme.lifted.p512c.validate@1.0.0.Box# " has an empty identifier.'}},
    'VE-ID-003': {'ok': {'threw': 'ValidationException'}},
    'VV-ID-004': {'throws': {'name': 'ValidationException', 'message': 'Instance "org.acme.lifted.p512c.validate@1.0.0.Box" has an empty identifier.'}},
    'VE-ID-004': {'ok': {'threw': 'ValidationException'}},
    'VV-SET-001': {'ok': ['a']},
    'VE-SET-001': {'ok': ['a']},
    'VV-SET-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.Box#b1" instance. The field "tags" has a value of "1" (type of value: "number"). Expected type of value: "String[]".'}},
    'VE-SET-002': {'ok': {'threw': 'ValidationException'}},
    'VV-SET-003': {'ok': {'$class': 'org.acme.lifted.p512c.validate@1.0.0.Sub'}},
    'VE-SET-003': {'ok': {'$class': 'org.acme.lifted.p512c.validate@1.0.0.Sub'}},
    'VV-SET-004': {'ok': 5},
    'VE-SET-004': {'ok': 5},
    'VV-SET-005': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.Box#b1" instance. The field "n" has a value of ""five"" (type of value: "string"). Expected type of value: "Integer".'}},
    'VE-SET-005': {'ok': {'threw': 'ValidationException'}},
    'VV-SET-006': {'throws': {'name': 'BaseException', 'message': 'Validator error for field `undefined`. org.acme.lifted.p512c.validate@1.0.0.Box.code: Value \'A1\' failed to match validation regex: /^[a-z]+$/'}},
    'VE-SET-006': {'ok': {'threw': 'BaseException'}},
    'VV-SET-007': {'ok': 'ab'},
    'VE-SET-007': {'ok': 'ab'},
    'VV-ADD-001': {'ok': ['a']},
    'VE-ADD-001': {'ok': ['a']},
    'VV-ADD-002': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.Box#b1" instance. The field "tags" has a value of "2" (type of value: "number"). Expected type of value: "String[]".'}},
    'VE-ADD-002': {'ok': {'threw': 'ValidationException'}},
    'VV-ADD-003': {'throws': {'name': 'ValidationException', 'message': 'Model violation in the "org.acme.lifted.p512c.validate@1.0.0.Box#b1" instance. Class "org.acme.lifted.p512c.validate@1.0.0.Sub" has the value of "[object Object]". Expected a "Resource" or a "Concept".'}},
    'VE-ADD-003': {'ok': {'threw': 'ValidationException'}},
};

// P5-24: v5.0.0's outcome where it differs from EXPECT's (an intended
// breaking change; fallbacks.spec.js `reference`).
const REFERENCE = {
    'VV-MAP-007': {'ok': 'valid'},
    'VE-MAP-007': {'ok': 'valid'},
    'VV-MAP-008': {'ok': 'valid'},
    'VE-MAP-008': {'ok': 'valid'},
    'VV-MAP-009': {'ok': 'valid'},
    'VE-MAP-009': {'ok': 'valid'},
};

module.exports = [];
for (const s of SCENARIOS) {
    for (const [prefix, visitor] of [['VV', true], ['VE', false]]) {
        const id = `${prefix}-${s.id}`;
        module.exports.push({
            id,
            covers: `${visitor ? 'the visitor fallback' : 'the one-call engine path'}: ${s.covers}`,
            run: s.run(visitor),
            expect: EXPECT[id],
            ...(id in REFERENCE ? { reference: REFERENCE[id] } : {}),
        });
    }
}
