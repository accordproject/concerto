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
 * P5-02b lifted checks: the serializer's visitor path behind
 * `EngineFastPathUnsupported` (PORTING.md 1.5 / D7).
 *
 * `Serializer.fromJSON`/`toJSON` make one engine call for the whole
 * document, and `JSONPopulator.convertToObject`, `JSONGenerator.convertToJSON`
 * and `ResourceValidator.checkItem` one per field. Each falls back to its TS
 * body when the wire codec (src/engine/serializer-codec.ts) cannot carry a
 * value: a lone surrogate, a function, a class instance that is not a
 * Resource or dayjs, a shared or cyclic reference, a `__proto__` key. These
 * checks send such values through the public API so the TS visitors run:
 *
 * - a lone surrogate (`L` below) anywhere in a document sends the whole
 *   `fromJSON`/`toJSON` call down the visitor path, while every other field
 *   still converts through the engine one field at a time;
 * - a boxed primitive (`new Number(1)`), a `Date`, a function or a
 *   duck-typed date cannot cross even one field, so that field takes the TS
 *   `switch` in `convertToObject`/`convertToJSON`/`checkItem`.
 *
 * `ValidatedResource.validate()` always runs `ResourceValidator`'s visitor
 * (only `checkItem`'s primitive test goes to the engine), so the
 * validator's own rules are checked through it too.
 *
 * `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p502b.serializer@1.0.0';

// A lone surrogate: JSON.stringify escapes it, and the engine's JSON reader
// rejects it, so the codec throws EngineFastPathUnsupported (checkString).
const L = '\uD800';

const MODEL = `namespace ${NS}
scalar SS extends String
scalar SK extends String
scalar SD extends DateTime
enum En { o X o Y }
concept Sub { o String x optional }
concept Sub2 extends Sub { o String y optional }
map MSS { o SK o SS }
map MSC { o String o Sub }
map MSD { o String o DateTime }
map MSB { o String o Boolean }
map MSSt { o String o String }
map MDK { o SD o String }
asset A identified by id { o String id o String n optional }
participant P identified by pid { o String pid o String n optional }
concept C {
  o String s optional
  o Integer i optional
  o Long l optional
  o Double d optional
  o Boolean b optional
  o DateTime t optional
  o En e optional
  o SS ss optional
  o Sub sub optional
  o Sub[] subs optional
  o String[] strs optional
  o Integer[] ints optional
  o En[] ens optional
  o MSS mss optional
  o MSC msc optional
  o MSD msd optional
  o MSB msb optional
  o MSSt msst optional
  o MDK mdk optional
  o MSSt msz size=[1,2] optional
  --> A ref optional
  --> A[] refs optional
}
concept R {
  o String s
  o String dflt default="d"
  o Integer i optional
}
transaction T { o String s optional }
event E { o String s optional }
`;

/**
 * A model manager, factory and serializer over MODEL.
 * @param {object} core the core under test
 * @returns {object} `{ mm, factory, ser }`
 */
function setup(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(MODEL, 'serializer.cto');
    const factory = new core.Factory(mm);
    return { mm, factory, ser: new core.Serializer(factory, mm) };
}

/**
 * `fromJSON` of `C` with a lone surrogate in `s` (the whole call takes the
 * visitor path), then `toJSON` of the result (which also contains it, so it
 * takes the visitor path too).
 * @param {object} fields the other fields of the document
 * @param {object} [options] fromJSON options (validate defaults to false)
 * @param {object} [toOptions] toJSON options (validate defaults to false)
 * @returns {Function} the check body
 */
function roundTrip(fields, options = {}, toOptions = {}) {
    return (core) => {
        const { ser } = setup(core);
        const r = ser.fromJSON(Object.assign({ $class: `${NS}.C`, s: L }, fields), Object.assign({ validate: false }, options));
        return ser.toJSON(r, Object.assign({ validate: false }, toOptions));
    };
}

/**
 * `fromJSON` only (the populator's visitor), returning the populated
 * resource's field names and the value of one field.
 * @param {object} fields the other fields of `C`
 * @param {string} field the field to read back
 * @param {object} [options] fromJSON options (validate defaults to false)
 * @returns {Function} the check body
 */
function populate(fields, field, options = {}) {
    return (core) => {
        const { ser } = setup(core);
        const r = ser.fromJSON(Object.assign({ $class: `${NS}.C`, s: L }, fields), Object.assign({ validate: false }, options));
        const v = r[field];
        return v && typeof v.format === 'function' ? v.format() : v;
    };
}

/**
 * `toJSON` of a `C` built with `disableValidation` and the given fields
 * assigned directly, so a value `fromJSON` would reject can reach the
 * generator.
 * @param {object} fields the fields to assign
 * @param {object} [toOptions] toJSON options
 * @returns {Function} the check body
 */
function generate(fields, toOptions = {}) {
    return (core) => {
        const { factory, ser } = setup(core);
        const r = factory.newConcept(NS, 'C', undefined, { disableValidation: true });
        Object.assign(r, typeof fields === 'function' ? fields(core, factory) : fields);
        return ser.toJSON(r, toOptions);
    };
}

/**
 * `validate()` of a validated (`Factory.newConcept`) `C` or `R` with the
 * given fields assigned: ResourceValidator's visitor.
 * @param {string} type the concept
 * @param {object|Function} fields the fields to assign
 * @returns {Function} the check body
 */
function validate(type, fields) {
    return (core) => {
        const { mm, factory } = setup(core);
        const r = factory.newConcept(NS, type);
        Object.assign(r, typeof fields === 'function' ? fields(core, factory, mm) : fields);
        r.validate();
        return 'valid';
    };
}

module.exports = [
    // ---- Serializer.fromJSON: the visitor path's own checks ------------
    {
        id: 'SF-FJ-001',
        covers: 'serializer.ts fromJSON fallback: no $class',
        run: (core) => setup(core).ser.fromJSON({ s: L }),
        expect: {
            throws: {
                name: 'Error',
                message: 'Invalid JSON data. Does not contain a $class type identifier.'
            }
        },
    },
    {
        id: 'SF-FJ-002',
        covers: 'serializer.ts fromJSON fallback: a transaction (and its $timestamp)',
        run: (core) => {
            const { ser } = setup(core);
            const r = ser.fromJSON({ $class: `${NS}.T`, s: L, $timestamp: '2020-01-01T00:00:00.000Z' });
            return { type: r.getFullyQualifiedType(), s: r.s, hasTimestamp: typeof r.$timestamp };
        },
        expect: {
            ok: { type: 'org.acme.lifted.p502b.serializer@1.0.0.T', s: '\ud800', hasTimestamp: 'object' }
        },
    },
    {
        id: 'SF-FJ-003',
        covers: 'serializer.ts fromJSON fallback: an event',
        run: (core) => {
            const { ser } = setup(core);
            const r = ser.fromJSON({ $class: `${NS}.E`, s: L, $timestamp: '2020-01-01T00:00:00.000Z' });
            return { type: r.getFullyQualifiedType(), s: r.s };
        },
        expect: { ok: { type: 'org.acme.lifted.p502b.serializer@1.0.0.E', s: '\ud800' } },
    },
    {
        id: 'SF-FJ-004',
        covers: 'serializer.ts fromJSON fallback: an asset, then toJSON with validation',
        run: (core) => {
            const { ser } = setup(core);
            return ser.toJSON(ser.fromJSON({ $class: `${NS}.A`, id: 'a1', n: L }));
        },
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.A',
                id: 'a1',
                n: '\ud800',
                '$identifier': 'a1'
            }
        },
    },
    {
        id: 'SF-FJ-005',
        covers: 'serializer.ts fromJSON fallback: a participant',
        run: (core) => {
            const { ser } = setup(core);
            return ser.toJSON(ser.fromJSON({ $class: `${NS}.P`, pid: 'p1', n: L }));
        },
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.P',
                pid: 'p1',
                n: '\ud800',
                '$identifier': 'p1'
            }
        },
    },
    {
        id: 'SF-FJ-006',
        covers: 'serializer.ts fromJSON fallback: an enum declaration',
        run: (core) => setup(core).ser.fromJSON({ $class: `${NS}.En`, s: L }),
        expect: {
            throws: { name: 'Error', message: 'Attempting to create an ENUM declaration is not supported.' }
        },
    },
    {
        id: 'SF-FJ-007',
        covers: 'serializer.ts fromJSON fallback: a map declaration',
        run: (core) => setup(core).ser.fromJSON({ $class: `${NS}.MSS`, s: L }),
        expect: {
            throws: { name: 'Error', message: 'Attempting to create a Map declaration is not supported.' }
        },
    },
    {
        id: 'SF-FJ-008',
        covers: 'serializer.ts fromJSON fallback, validate: true (the default)',
        run: (core) => {
            const { ser } = setup(core);
            return ser.toJSON(ser.fromJSON({ $class: `${NS}.R`, s: L }));
        },
        expect: { ok: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.R', s: '\ud800', dflt: 'd' } },
    },
    {
        id: 'SF-FJ-009',
        covers: 'serializer.ts fromJSON fallback, validate: true, failing',
        run: (core) => setup(core).ser.fromJSON({ $class: `${NS}.R`, i: 1, dflt: L }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'The instance "org.acme.lifted.p502b.serializer@1.0.0.R" is missing the required field "s".'
            }
        },
    },
    // ---- JSONPopulator: property checks --------------------------------
    {
        id: 'SF-JP-001',
        covers: 'jsonpopulator.ts getAssignableProperties: a reserved (private) system property',
        run: roundTrip({ $namespace: 'x' }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Unexpected reserved properties for type org.acme.lifted.p502b.serializer@1.0.0.C: $namespace'
            }
        },
    },
    {
        id: 'SF-JP-002',
        covers: 'jsonpopulator.ts getAssignableProperties: $timestamp on a concept',
        run: roundTrip({ $timestamp: '2020-01-01T00:00:00.000Z' }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Unexpected property for type org.acme.lifted.p502b.serializer@1.0.0.C: $timestamp'
            }
        },
    },
    {
        id: 'SF-JP-003',
        covers: 'jsonpopulator.ts validateProperties: an undeclared property',
        run: roundTrip({ nope: 1 }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Unexpected properties for type org.acme.lifted.p502b.serializer@1.0.0.C: nope'
            }
        },
    },
    {
        id: 'SF-JP-004',
        covers: 'jsonpopulator.ts: a __proto__ own key also takes the visitor path',
        run: (core) => {
            const { ser } = setup(core);
            const doc = JSON.parse(`{"$class":"${NS}.C","s":"ok","__proto__":{"x":1}}`);
            return ser.fromJSON(doc, { validate: false });
        },
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Unexpected properties for type org.acme.lifted.p502b.serializer@1.0.0.C: __proto__'
            }
        },
    },
    // ---- JSONPopulator: nested values ------------------------------------
    {
        id: 'SF-JP-010',
        covers: 'jsonpopulator.ts visit: a scalar-typed field',
        run: roundTrip({ ss: 'scalar' }),
        expect: { ok: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C', s: '\ud800', ss: 'scalar' } },
    },
    {
        id: 'SF-JP-011',
        covers: 'jsonpopulator.ts convertItem: a concept field without and with $class, arrays',
        run: roundTrip({ sub: { x: 'q' }, subs: [{ x: 'q' }, { $class: `${NS}.Sub2`, y: 'z' }], strs: ['a', L], ints: [1, 2], ens: ['X', 'Y'] }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                sub: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'q' },
                subs: [
                    { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'q' },
                    { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub2', y: 'z' }
                ],
                strs: [ 'a', '\ud800' ],
                ints: [ 1, 2 ],
                ens: [ 'X', 'Y' ]
            }
        },
    },
    {
        id: 'SF-JP-012',
        covers: 'jsonpopulator.ts visitField: an array field given a non-array',
        run: roundTrip({ strs: 'nope' }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.strs` to be an array of type `String`'
            }
        },
    },
    {
        id: 'SF-JP-013',
        covers: 'jsonpopulator.ts visitRelationshipDeclaration: single and array relationships',
        run: roundTrip({ ref: `resource:${NS}.A#a1`, refs: [`resource:${NS}.A#a2`] }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                ref: 'resource:org.acme.lifted.p502b.serializer@1.0.0.A#a1',
                refs: [ 'resource:org.acme.lifted.p502b.serializer@1.0.0.A#a2' ]
            }
        },
    },
    // ---- JSONPopulator: maps ---------------------------------------------
    {
        id: 'SF-JP-020',
        covers: 'jsonpopulator.ts visitMapDeclaration/processMapType: scalar key and value, $class entry',
        run: roundTrip({ mss: { $class: `${NS}.MSS`, k1: 'v1', k2: L } }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                mss: { k1: 'v1', k2: '\ud800' }
            }
        },
    },
    {
        id: 'SF-JP-021',
        covers: 'jsonpopulator.ts processMapType: concept values, declared type, own $class and an unknown $class',
        run: (core) => {
            const { ser } = setup(core);
            const r = ser.fromJSON({
                $class: `${NS}.C`,
                s: L,
                msc: { a: { x: '1' }, b: { $class: `${NS}.Sub2`, y: '2' }, c: { $class: `${NS}.Nope`, z: 3 } },
            }, { validate: false });
            const out = {};
            r.msc.forEach((v, k) => {
                out[k] = v && typeof v.getFullyQualifiedType === 'function' ? { type: v.getFullyQualifiedType(), x: v.x, y: v.y } : v;
            });
            return out;
        },
        expect: {
            ok: {
                a: { type: 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: '1', y: '<undefined>' },
                b: { type: 'org.acme.lifted.p502b.serializer@1.0.0.Sub2', x: '<undefined>', y: '2' },
                c: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Nope', z: 3 }
            }
        },
    },
    {
        id: 'SF-JP-022',
        covers: 'jsonpopulator.ts visitMapDeclaration: primitive keys and values, round trip',
        run: roundTrip({ msd: { a: '2020-01-01T00:00:00.000Z' }, msb: { a: true }, msst: { a: 'b' } }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                msd: { a: '2020-01-01T00:00:00.000Z' },
                msb: { a: true },
                msst: { a: 'b' }
            }
        },
    },
    {
        id: 'SF-JP-023',
        covers: 'jsonpopulator.ts visitMapDeclaration: a reserved property inside a map',
        run: roundTrip({ msst: { $namespace: 'x' } }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Unexpected reserved properties for type org.acme.lifted.p502b.serializer@1.0.0.MSSt: $namespace'
            }
        },
    },
    // ---- JSONPopulator.convertToObject: the TS switch ---------------------
    {
        id: 'SF-CO-001',
        covers: 'convertToObject TS switch, String: a lone surrogate is kept',
        run: populate({}, 's'),
        expect: { ok: '\ud800' },
    },
    {
        id: 'SF-CO-002',
        covers: 'convertToObject TS switch, String: a function is rejected',
        run: populate({ s: () => 1 }, 's'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.s` to be of type `String`'
            }
        },
    },
    {
        id: 'SF-CO-003',
        covers: 'convertToObject TS switch, Integer: a boxed number is rejected',
        run: populate({ i: new Number(1) }, 'i'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.i` to be of type `Integer`'
            }
        },
    },
    {
        id: 'SF-CO-004',
        covers: 'convertToObject TS switch, Long: a boxed number is rejected',
        run: populate({ l: new Number(1) }, 'l'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.l` to be of type `Long`'
            }
        },
    },
    {
        id: 'SF-CO-005',
        covers: 'convertToObject TS switch, Double: a boxed number is rejected',
        run: populate({ d: new Number(1.5) }, 'd'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.d` to be of type `Double`'
            }
        },
    },
    {
        id: 'SF-CO-006',
        covers: 'convertToObject TS switch, Boolean: a boxed boolean is rejected',
        run: populate({ b: new Boolean(true) }, 'b'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.b` to be of type `Boolean`'
            }
        },
    },
    {
        id: 'SF-CO-007',
        covers: 'convertToObject TS switch, DateTime: a Date is rejected',
        run: populate({ t: new Date(0) }, 't'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
    },
    {
        id: 'SF-CO-008',
        covers: 'convertToObject TS switch, DateTime: a lone surrogate, strict',
        run: populate({ t: L }, 't', { strictQualifiedDateTimes: true }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime` with format YYYY-MM-DDTHH:mm:ss[Z]'
            }
        },
    },
    {
        id: 'SF-CO-009',
        covers: 'convertToObject TS switch, DateTime: a lone surrogate, not strict',
        run: populate({ t: L }, 't', { strictQualifiedDateTimes: false }),
        // P5-24 (BC-07, R1): the strict format check runs whatever the flag
        // says, so the format message; the same class as v5.0.0.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime` with format YYYY-MM-DDTHH:mm:ss[Z]'
            }
        },
        reference: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
    },
    {
        id: 'SF-CO-010',
        covers: 'convertToObject TS switch, DateTime: a duck-typed valid date is kept',
        run: (core) => {
            const { ser } = setup(core);
            const fake = { isBefore: () => false, isValid: () => true, tag: 'fake' };
            const r = ser.fromJSON({ $class: `${NS}.C`, s: L, t: fake }, { validate: false });
            return r.t === fake;
        },
        expect: { ok: true },
    },
    {
        id: 'SF-CO-011',
        covers: 'convertToObject TS switch, DateTime: a duck-typed invalid date is rejected',
        run: populate({ t: { isBefore: () => false, isValid: () => false } }, 't'),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
    },
    {
        id: 'SF-CO-012',
        covers: 'convertToObject TS switch, enum: a lone surrogate is kept as is',
        run: populate({ e: L }, 'e'),
        expect: { ok: '\ud800' },
    },
    {
        id: 'SF-CO-013',
        covers: 'convertToObject: non-finite numbers through the per-field engine call',
        run: roundTrip({ i: Infinity, l: -Infinity, d: NaN }),
        // P5-51 (BC-10, R1; DV-012): the populator rejects a non-finite
        // Integer or Long even with validation off; v5.0.0 let it through.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.i` to be of type `Integer`'
            }
        },
        reference: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                i: null,
                l: null,
                d: null
            }
        },
    },
    {
        id: 'SF-CO-014',
        covers: 'convertToObject: NaN for an Integer',
        run: roundTrip({ i: NaN }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.i` to be of type `Integer`'
            }
        },
    },
    {
        id: 'SF-CO-015',
        covers: 'convertToObject: DateTime strings with utcOffset, not strict',
        // P5-24 (BC-07, R1): a strict string; the unqualified
        // `2020-01-01T10:00:00` this used is rejected now (SF-CO-019).
        run: roundTrip({ t: '2020-01-01T10:00:00Z' }, { strictQualifiedDateTimes: false, utcOffset: 60 }, { utcOffset: 60 }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                t: '2020-01-01T11:00:00.000+01:00'
            }
        },
    },
    // A boxed `utcOffset` (`new Number(0)`) is a fromJSON option the codec
    // cannot carry, so every primitive field takes convertToObject's TS
    // switch even for plain, valid values.
    {
        id: 'SF-CO-016',
        covers: 'convertToObject TS switch, Integer/Long/Double/Boolean: valid values (boxed utcOffset)',
        run: (core) => {
            const { ser } = setup(core);
            const r = ser.fromJSON({ $class: `${NS}.C`, i: 3, l: 7, d: 2.5, b: true }, { validate: false, utcOffset: new Number(0) });
            return [r.i, r.l, r.d, r.b];
        },
        expect: { ok: [3, 7, 2.5, true] },
    },
    {
        id: 'SF-CO-017',
        covers: 'convertToObject TS switch, Integer: a fractional number is rejected (boxed utcOffset)',
        run: populate({ i: 1.5 }, 'i', { utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.i` to be of type `Integer`'
            }
        },
    },
    {
        id: 'SF-CO-018',
        covers: 'convertToObject TS switch, DateTime: a qualified string, strict (boxed utcOffset)',
        run: populate({ t: '2020-01-01T10:00:00Z' }, 't', { strictQualifiedDateTimes: true, utcOffset: new Number(0) }),
        expect: { ok: '2020-01-01T10:00:00Z' },
    },
    // P5-24 (accordproject/concerto-rust#328): strict `DateTime` in R1 on the
    // TS switch too. `expect` is the workspace outcome and `reference` what
    // v5.0.0 gives (fallbacks.spec.js).
    {
        id: 'SF-CO-019',
        covers: 'convertToObject TS switch, DateTime: a date-only string is rejected, not strict (boxed utcOffset; BC-07)',
        run: populate({ t: '2020-01-01' }, 't', { utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime` with format YYYY-MM-DDTHH:mm:ss[Z]'
            }
        },
        reference: { ok: '2020-01-01T00:00:00+00:00' },
    },
    {
        id: 'SF-CO-020',
        covers: 'convertToObject TS switch, DateTime: an impossible date is rejected, strict (boxed utcOffset; BC-42)',
        run: populate({ t: '2024-02-30T00:00:00Z' }, 't', { strictQualifiedDateTimes: true, utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
        reference: { ok: '2024-03-01T00:00:00Z' },
    },
    {
        id: 'SF-CO-021',
        covers: 'convertToObject TS switch, DateTime: 24:00 is rejected, not strict (boxed utcOffset; BC-42)',
        run: populate({ t: '2024-01-02T24:00:00Z' }, 't', { utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
        reference: { ok: '2024-01-03T00:00:00+00:00' },
    },
    {
        id: 'SF-CO-022',
        covers: 'convertToObject TS switch, DateTime: a qualified string, not strict (boxed utcOffset)',
        run: populate({ t: '2020-01-01T10:00:00+01:00' }, 't', { utcOffset: new Number(0) }),
        expect: { ok: '2020-01-01T09:00:00+00:00' },
    },
    {
        id: 'SF-CO-023',
        covers: 'convertToObject TS switch, DateTime: an out-of-range offset is rejected (boxed utcOffset)',
        run: populate({ t: '2020-01-01T10:00:00+24:00' }, 't', { strictQualifiedDateTimes: true, utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.t` to be of type `DateTime`'
            }
        },
    },
    // P5-51 (accordproject/concerto-rust#372): BC-10 (R1; DV-012) on the TS
    // switch. `expect` is the workspace outcome and `reference` what v5.0.0
    // gives (fallbacks.spec.js).
    {
        id: 'SF-CO-024',
        covers: 'convertToObject TS switch, Integer: Infinity is rejected (boxed utcOffset; BC-10)',
        run: populate({ i: Infinity }, 'i', { utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.i` to be of type `Integer`'
            }
        },
        // `plain` (fallbacks.spec.js) writes a non-finite number as null.
        reference: { ok: null },
    },
    {
        id: 'SF-CO-025',
        covers: 'convertToObject TS switch, Long: -Infinity is rejected (boxed utcOffset; BC-10)',
        run: populate({ l: -Infinity }, 'l', { utcOffset: new Number(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Expected value at path `$.l` to be of type `Long`'
            }
        },
        reference: { ok: null },
    },
    // ---- JSONGenerator ---------------------------------------------------
    {
        id: 'SF-JG-001',
        covers: 'jsongenerator.ts visitor: every field kind, maps and relationships',
        run: roundTrip({
            i: 1, l: 2, d: 1.5, b: true, t: '2020-01-01T00:00:00.000Z', e: 'X', ss: 'sc',
            sub: { x: 'q' }, subs: [{ $class: `${NS}.Sub2`, x: 'a', y: 'b' }],
            mss: { k: 'v' }, msc: { a: { x: '1' }, b: { $class: `${NS}.Sub2`, y: '2' } },
            ref: `resource:${NS}.A#a1`, refs: [`resource:${NS}.A#a2`],
        }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                i: 1,
                l: 2,
                d: 1.5,
                b: true,
                t: '2020-01-01T00:00:00.000Z',
                e: 'X',
                ss: 'sc',
                sub: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'q' },
                subs: [ { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub2', y: 'b', x: 'a' } ],
                mss: { k: 'v' },
                msc: {
                    a: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: '1' },
                    b: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub2', y: '2' }
                },
                ref: 'resource:org.acme.lifted.p502b.serializer@1.0.0.A#a1',
                refs: [ 'resource:org.acme.lifted.p502b.serializer@1.0.0.A#a2' ]
            }
        },
    },
    {
        id: 'SF-JG-002',
        covers: 'jsongenerator.ts getRelationshipText: convertResourcesToId',
        run: roundTrip({ ref: `resource:${NS}.A#a1`, refs: [`resource:${NS}.A#a2`] }, {}, { convertResourcesToId: true }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                ref: 'a1',
                refs: [ 'a2' ]
            }
        },
    },
    {
        id: 'SF-JG-003',
        covers: 'jsongenerator.ts visitMapDeclaration: a map value without getFullyQualifiedType',
        run: generate((core, factory) => {
            const m = new Map();
            m.set('$class', `${NS}.MSC`);
            m.set('a', { x: L });
            return { msc: m };
        }, { validate: false }),
        expect: { throws: { name: 'Error', message: 'Expected a Resource, but found [object Object]' } },
    },
    {
        id: 'SF-JG-010',
        covers: 'convertToJSON TS switch, Integer/Long: boxed numbers',
        run: generate({ i: new Number(1), l: new Number(2) }, { validate: false }),
        expect: { ok: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C', i: 1, l: 2 } },
    },
    {
        id: 'SF-JG-011',
        covers: 'convertToJSON TS switch, Double/Boolean/String: values the codec cannot carry',
        run: generate({ d: new Number(1.5), b: new Boolean(false), s: L }, { validate: false }),
        expect: {
            ok: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C', s: '\ud800', d: 1.5, b: false }
        },
    },
    {
        id: 'SF-JG-012',
        covers: 'convertToJSON TS switch, DateTime: a duck-typed date with utc()',
        run: generate((core) => ({ t: { utc: () => core.dayjs.utc('2020-01-02T03:04:05.006Z') } }), { validate: false, utcOffset: 0 }),
        expect: {
            ok: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C', t: '2020-01-02T03:04:05.006Z' }
        },
    },
    {
        id: 'SF-JG-013',
        covers: 'convertToJSON TS switch, DateTime: a non-zero utcOffset',
        run: generate((core) => ({ t: { utc: () => core.dayjs.utc('2020-01-02T03:04:05.006Z') } }), { validate: false, utcOffset: 90 }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                t: '2020-01-02T04:34:05.006+01:30'
            }
        },
    },
    {
        id: 'SF-JG-014',
        covers: 'jsongenerator.ts: a shared sub-resource (deduplicateResources off)',
        run: generate((core, factory) => {
            const sub = factory.newConcept(NS, 'Sub', undefined, { disableValidation: true });
            sub.x = 'shared';
            return { sub, subs: [sub, sub] };
        }, { validate: false }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                sub: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'shared' },
                subs: [
                    { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'shared' },
                    { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'shared' }
                ]
            }
        },
    },
    {
        id: 'SF-JG-015',
        covers: 'convertToJSON: an engine error (not EngineFastPathUnsupported) is rethrown',
        run: generate({ s: L, t: '2020-01-01T00:00:00.000Z' }, { validate: false }),
        expect: { throws: { name: 'TypeError', message: 'obj.utc is not a function' } },
    },
    {
        id: 'RV-CI-011',
        covers: 'checkItem: a relationship in a primitive field',
        run: validate('C', (core, factory) => ({ i: factory.newRelationship(NS, 'A', 'a1') })),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "i" has a value of "org.acme.lifted.p502b.serializer@1.0.0.A#a1" (type of value: "org.acme.lifted.p502b.serializer@1.0.0.A"). Expected type of value: "Integer".'
            }
        },
    },
    // ---- ResourceValidator (Serializer.toJSON with validation) ------------
    {
        id: 'SF-RV-001',
        covers: 'resourcevalidator.ts via toJSON fallback: a valid document',
        run: roundTrip({ i: 1, t: '2020-01-01T00:00:00.000Z', e: 'X', sub: { x: 'q' }, msd: { a: '2020-01-01T00:00:00.000Z' }, mss: { k: 'v' }, msc: { a: { x: '1' } }, ref: `resource:${NS}.A#a1` }, {}, { validate: true }),
        expect: {
            ok: {
                '$class': 'org.acme.lifted.p502b.serializer@1.0.0.C',
                s: '\ud800',
                i: 1,
                t: '2020-01-01T00:00:00.000Z',
                e: 'X',
                sub: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: 'q' },
                mss: { k: 'v' },
                msc: { a: { '$class': 'org.acme.lifted.p502b.serializer@1.0.0.Sub', x: '1' } },
                msd: { a: '2020-01-01T00:00:00.000Z' },
                ref: 'resource:org.acme.lifted.p502b.serializer@1.0.0.A#a1'
            }
        },
    },
    {
        id: 'SF-RV-002',
        covers: 'resourcevalidator.ts via toJSON fallback: an invalid enum value',
        run: roundTrip({ e: 'Z' }, {}, { validate: true }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. Invalid enum value of "Z" for the field "En".'
            }
        },
    },
    // ---- ResourceValidator (ValidatedResource.validate) --------------------
    {
        id: 'RV-CI-001',
        covers: 'checkItem TS switch, Integer: a boxed number',
        run: validate('C', { i: new Number(1) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "i" has a value of "1" (type of value: "object"). Expected type of value: "Integer".'
            }
        },
    },
    {
        id: 'RV-CI-002',
        covers: 'checkItem TS switch, Double: a boxed non-finite number',
        run: validate('C', { d: new Number(Infinity) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "d" has a value of "null" (type of value: "object"). Expected type of value: "Double".'
            }
        },
    },
    {
        id: 'RV-CI-003',
        covers: 'checkItem TS switch, Boolean: a boxed boolean',
        run: validate('C', { b: new Boolean(true) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "b" has a value of "true" (type of value: "object"). Expected type of value: "Boolean".'
            }
        },
    },
    {
        id: 'RV-CI-004',
        covers: 'checkItem TS switch, String: a function',
        run: validate('C', { s: () => 1 }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "s" has a value of "undefined" (type of value: "function"). Expected type of value: "String".'
            }
        },
    },
    {
        id: 'RV-CI-005',
        covers: 'checkItem TS switch, String: a lone surrogate is valid',
        run: validate('C', { s: L }),
        expect: { ok: 'valid' },
    },
    {
        id: 'RV-CI-006',
        covers: 'checkItem TS switch, DateTime: a Date',
        run: validate('C', { t: new Date(0) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "t" has a value of ""1970-01-01T00:00:00.000Z"" (type of value: "object"). Expected type of value: "DateTime".'
            }
        },
    },
    {
        id: 'RV-CI-007',
        covers: 'checkItem TS switch, DateTime: a duck-typed date is valid',
        run: validate('C', { t: { isBefore: () => false } }),
        expect: { ok: 'valid' },
    },
    {
        id: 'RV-CI-008',
        covers: 'checkItem TS switch, Integer/Long: boxed and non-finite values',
        run: validate('C', { l: new Number(Infinity) }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "l" has a value of "null" (type of value: "object"). Expected type of value: "Long".'
            }
        },
    },
    {
        id: 'RV-CI-009',
        covers: 'reportFieldTypeViolation: a non-finite number',
        run: validate('C', { i: Infinity }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "i" has a value of "Infinity" (type of value: "number"). Expected type of value: "Integer".'
            }
        },
    },
    {
        id: 'RV-CI-010',
        covers: 'reportFieldTypeViolation: NaN',
        run: validate('C', { d: NaN }),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Model violation in the "org.acme.lifted.p502b.serializer@1.0.0.C" instance. The field "d" has a value of "NaN" (type of value: "number"). Expected type of value: "Double".'
            }
        },
    },
    {
        id: 'RV-CD-001',
        covers: 'visitClassDeclaration: a missing required property',
        run: validate('R', {}),
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'The instance "org.acme.lifted.p502b.serializer@1.0.0.R" is missing the required field "s".'
            }
        },
    },
    {
        id: 'RV-CD-002',
        covers: 'visitClassDeclaration: a required property with a default value may be missing',
        run: validate('R', { s: 'x', dflt: null }),
        expect: { ok: 'valid' },
    },
    {
        id: 'RV-MAP-001',
        covers: 'visitMapDeclaration/checkMapType: valid maps of every kind',
        run: validate('C', (core, factory) => {
            const sub = factory.newConcept(NS, 'Sub');
            sub.x = 'v';
            return {
                mss: new Map([['k', 'v']]),
                msc: new Map([['a', sub]]),
                msd: new Map([['a', '2020-01-01T00:00:00.000Z']]),
                msb: new Map([['a', true]]),
                msst: new Map([['$class', `${NS}.MSSt`], ['a', 'b']]),
                mdk: new Map([['2020-01-01T00:00:00.000Z', 'v']]),
            };
        }),
        expect: { ok: 'valid' },
    },
    {
        id: 'RV-MAP-002',
        covers: 'checkMapType: an invalid DateTime value',
        run: validate('C', { msd: new Map([['a', 'not a date']]) }),
        expect: {
            throws: {
                name: 'Error',
                message: 'Model violation in org.acme.lifted.p502b.serializer@1.0.0.MSD. Expected Type of DateTime but found \'not a date\' instead.'
            }
        },
    },
    {
        id: 'RV-MAP-003',
        covers: 'checkMapType: an invalid Boolean value',
        run: validate('C', { msb: new Map([['a', 'yes']]) }),
        expect: {
            throws: {
                name: 'Error',
                message: 'Model violation in org.acme.lifted.p502b.serializer@1.0.0.MSB. Expected Type of Boolean but found string instead, for value \'yes\'.'
            }
        },
    },
    {
        id: 'RV-MAP-004',
        covers: 'checkMapType: an invalid String value',
        run: validate('C', { msst: new Map([['a', 1]]) }),
        expect: {
            throws: {
                name: 'Error',
                message: 'Model violation in org.acme.lifted.p502b.serializer@1.0.0.MSSt. Expected Type of String but found \'1\' instead.'
            }
        },
    },
    {
        id: 'RV-MAP-005',
        covers: 'visitMapDeclaration: a plain object instead of a Map',
        run: validate('C', { msst: { a: 'b' } }),
        expect: { throws: { name: 'Error', message: 'Expected a Map, but found {"a":"b"}' } },
    },
    {
        id: 'RV-MAP-006',
        covers: 'checkMapType: an invalid scalar key',
        run: validate('C', { mss: new Map([[1, 'v']]) }),
        expect: {
            throws: {
                name: 'Error',
                message: 'Model violation in org.acme.lifted.p502b.serializer@1.0.0.MSS. Expected Type of String but found \'1\' instead.'
            }
        },
    },
    {
        id: 'RV-MAP-007',
        covers: 'visitField: a map field with a size validator, too many entries',
        run: validate('C', { msz: new Map([['a', 'b'], ['c', 'd'], ['e', 'f']]) }),
        expect: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `org.acme.lifted.p502b.serializer@1.0.0.C`. org.acme.lifted.p502b.serializer@1.0.0.C.msz: Collection must contain no more than 2 elements.'
            }
        },
    },
    {
        id: 'RV-MAP-008',
        covers: 'visitField: a map field with a size validator, within bounds',
        run: validate('C', { msz: new Map([['a', 'b']]) }),
        expect: { ok: 'valid' },
    },
    {
        id: 'RV-REL-001',
        covers: 'checkRelationship: a relationship whose target type is not identified',
        run: validate('C', (core, factory, mm) => ({ ref: core.Relationship.fromURI(mm, `resource:${NS}.Sub#x`) })),
        expect: {
            throws: {
                name: 'Error',
                message: 'Cannot have a relationship to a field that is not identifiable.'
            }
        },
    },
];
