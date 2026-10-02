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
 * P5-89 lifted checks (accordproject/concerto-rust#435; BC-26, additive):
 * the accordproject/concerto#1239 validation API, `validateInstance` and
 * `validateInstanceOrThrow` on ModelManager and ClassDeclaration, with
 * #1325's value-free diagnostics (also attached to the exceptions as
 * `details`) and the instance side of #1273's options.
 *
 * The `VI-CODE-*` checks are the conformance cases: one per diagnostic code,
 * each showing the consistency rule for its input, that the first error
 * `validateInstance` reports is the one `validateInstanceOrThrow` and
 * `Serializer.fromJSON` (with `validate: true` and the same options) throw:
 * the same exception class, and `details[0]` equal to `errors[0]`. The rule
 * is also checked over every `Serializer.fromJSON` fixture of the oracle
 * corpus by concerto-rust's native harness (`diagnose_agrees`).
 *
 * The API is new, so v5.0.0 has none of it: every check's `reference` is
 * `'no validateInstance'`. `expect` is the workspace outcome. Run by
 * fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p589@1.0.0';

const MODEL = `namespace ${NS}
abstract concept Shape { o String name }
concept Address {
  o String city
  o String zip regex=/^[0-9]{5}$/ optional
}
enum Colour { o RED o GREEN }
participant Person identified by email {
  o String email
  o Address address
  o String[] tags optional
  o Integer age optional
  o Colour colour optional
  --> Person friend optional
  o Shape shape optional
}
participant Employee extends Person { o String team optional }
asset Car identified by vin { o String vin }
`;

const NO_API = 'no validateInstance';

/**
 * A model manager holding MODEL, or `null` when this core has no
 * `validateInstance` (v5.0.0).
 * @param {object} core the core
 * @returns {object|null} the model manager
 */
function manager(core) {
    const mm = new core.ModelManager();
    if (typeof mm.validateInstance !== 'function') {
        return null;
    }
    mm.addCTOModel(MODEL, 'p589.cto');
    return mm;
}

/**
 * A valid Person, with `extra` over it.
 * @param {object} [extra] properties to set over it
 * @returns {object} the instance
 */
function person(extra) {
    return Object.assign({
        $class: `${NS}.Person`,
        email: 'ada@example.com',
        address: { $class: `${NS}.Address`, city: 'Paris' },
    }, extra);
}

/**
 * What `run` throws: its class and the first of its `details` (code and
 * path), or `'ok'`.
 * @param {Function} run the call
 * @returns {Array|string} `[class, code, path]`, or `'ok'`
 */
function thrown(run) {
    try {
        run();
        return 'ok';
    } catch (e) {
        const first = Array.isArray(e.details) ? e.details[0] : undefined;
        return [e.constructor.name, first ? first.code : null, first ? first.path : null];
    }
}

/**
 * A diagnostic as `[code, path, expected]`.
 * @param {object} d the diagnostic
 * @returns {Array} the triple
 */
function triple(d) {
    return [d.code, d.path, d.expected === undefined ? null : d.expected];
}

/**
 * The conformance case for one input: `validateInstance`'s errors, what
 * `validateInstanceOrThrow` and `Serializer.fromJSON` throw, and whether
 * the three agree (the consistency rule).
 * @param {Function} input the instance, from the model manager
 * @param {string} [type] the ClassDeclaration to validate it as
 * @returns {Function} the check body
 */
function conformance(input, type) {
    return (core) => {
        const mm = manager(core);
        if (!mm) {
            return NO_API;
        }
        const json = input();
        const target = type ? mm.getType(`${NS}.${type}`) : mm;
        const result = target.validateInstance(json);
        const orThrow = thrown(() => target.validateInstanceOrThrow(json));
        const fromJson = type ? null : thrown(() => mm.getSerializer().fromJSON(json));
        const first = result.valid ? null : result.errors[0];
        const consistent = !result.valid &&
            orThrow[1] === first.code && orThrow[2] === first.path &&
            (fromJson === null || JSON.stringify(fromJson) === JSON.stringify(orThrow));
        return { valid: result.valid, errors: result.valid ? [] : result.errors.map(triple), orThrow, fromJson, consistent };
    };
}

const checks = [
    {
        id: 'VI-CODE-001',
        covers: 'MISSING_REQUIRED_PROPERTY: a required nested property is missing; located at /address/city',
        expect: {ok: {valid: false, errors: [['MISSING_REQUIRED_PROPERTY', '/address/city', 'String']], orThrow: ['ValidationException', 'MISSING_REQUIRED_PROPERTY', '/address/city'], fromJson: ['ValidationException', 'MISSING_REQUIRED_PROPERTY', '/address/city'], consistent: true}},
        run: conformance(() => person({ address: { $class: `${NS}.Address` } })),
    },
    {
        id: 'VI-CODE-002',
        covers: 'UNDECLARED_FIELD: one diagnostic per undeclared key, at its own path',
        expect: {ok: {valid: false, errors: [['UNDECLARED_FIELD', '/nickname', null], ['UNDECLARED_FIELD', '/a~1b', null]], orThrow: ['ValidationException', 'UNDECLARED_FIELD', '/nickname'], fromJson: ['ValidationException', 'UNDECLARED_FIELD', '/nickname'], consistent: true}},
        run: conformance(() => person({ nickname: 'x', 'a/b': 1 })),
    },
    {
        id: 'VI-CODE-003',
        covers: 'TYPE_VIOLATION: a string for an Integer, with the expected type',
        expect: {ok: {valid: false, errors: [['TYPE_VIOLATION', '/age', 'Integer']], orThrow: ['ValidationException', 'TYPE_VIOLATION', '/age'], fromJson: ['ValidationException', 'TYPE_VIOLATION', '/age'], consistent: true}},
        run: conformance(() => person({ age: 'old' })),
    },
    {
        id: 'VI-CODE-004',
        covers: 'INVALID_ENUM_VALUE: a value that is not one of the enum\'s',
        expect: {ok: {valid: false, errors: [['INVALID_ENUM_VALUE', '/colour', 'org.acme.lifted.p589@1.0.0.Colour']], orThrow: ['ValidationException', 'INVALID_ENUM_VALUE', '/colour'], fromJson: ['ValidationException', 'INVALID_ENUM_VALUE', '/colour'], consistent: true}},
        run: conformance(() => person({ colour: 'BLUE' })),
    },
    {
        id: 'VI-CODE-005',
        covers: 'EMPTY_IDENTIFIER: an empty identifier (the Factory\'s plain Error)',
        expect: {ok: {valid: false, errors: [['EMPTY_IDENTIFIER', '', null]], orThrow: ['Error', 'EMPTY_IDENTIFIER', ''], fromJson: ['Error', 'EMPTY_IDENTIFIER', ''], consistent: true}},
        run: conformance(() => ({ $class: `${NS}.Car`, vin: '' })),
    },
    {
        id: 'VI-CODE-006',
        covers: 'ABSTRACT_CLASS: an instance of an abstract type, nested',
        expect: {ok: {valid: false, errors: [['ABSTRACT_CLASS', '/shape', null]], orThrow: ['Error', 'ABSTRACT_CLASS', '/shape'], fromJson: ['Error', 'ABSTRACT_CLASS', '/shape'], consistent: true}},
        run: conformance(() => person({ shape: { $class: `${NS}.Shape`, name: 'circle' } })),
    },
    {
        id: 'VI-CODE-007',
        covers: 'NOT_ASSIGNABLE: a nested object of a type that does not extend the declared one',
        expect: {ok: {valid: false, errors: [['NOT_ASSIGNABLE', '/address', 'org.acme.lifted.p589@1.0.0.Address']], orThrow: ['ValidationException', 'NOT_ASSIGNABLE', '/address'], fromJson: ['ValidationException', 'NOT_ASSIGNABLE', '/address'], consistent: true}},
        run: conformance(() => person({ address: { $class: `${NS}.Car`, vin: '1' } })),
    },
    {
        id: 'VI-CODE-008',
        covers: 'NOT_RESOURCE: no $class (the plain Error fromJSON throws)',
        expect: {ok: {valid: false, errors: [['NOT_RESOURCE', '', null]], orThrow: ['Error', 'NOT_RESOURCE', ''], fromJson: ['Error', 'NOT_RESOURCE', ''], consistent: true}},
        run: conformance(() => ({ email: 'ada@example.com' })),
    },
    {
        id: 'VI-CODE-009',
        covers: 'NOT_RELATIONSHIP: a number for a relationship',
        expect: {ok: {valid: false, errors: [['NOT_RELATIONSHIP', '/friend', '--> org.acme.lifted.p589@1.0.0.Person']], orThrow: ['Error', 'NOT_RELATIONSHIP', '/friend'], fromJson: ['Error', 'NOT_RELATIONSHIP', '/friend'], consistent: true}},
        run: conformance(() => person({ friend: 42 })),
    },
    {
        id: 'VI-CODE-010',
        covers: 'VALIDATOR_FAILURE: a string that fails its regex',
        expect: {ok: {valid: false, errors: [['VALIDATOR_FAILURE', '/address/zip', 'String']], orThrow: ['ValidationException', 'VALIDATOR_FAILURE', '/address/zip'], fromJson: ['ValidationException', 'VALIDATOR_FAILURE', '/address/zip'], consistent: true}},
        run: conformance(() => person({ address: { $class: `${NS}.Address`, city: 'Paris', zip: 'abc' } })),
    },
    {
        id: 'VI-CODE-011',
        covers: 'TYPE_NOT_FOUND: a nested $class that is not declared',
        expect: {ok: {valid: false, errors: [['TYPE_NOT_FOUND', '/address', null]], orThrow: ['TypeNotFoundException', 'TYPE_NOT_FOUND', '/address'], fromJson: ['TypeNotFoundException', 'TYPE_NOT_FOUND', '/address'], consistent: true}},
        run: conformance(() => person({ address: { $class: `${NS}.Nope` } })),
    },
    {
        id: 'VI-CODE-012',
        covers: 'NOT_ASSIGNABLE: ClassDeclaration.validateInstance of an instance of another type (the #1239 $class check)',
        expect: {ok: {valid: false, errors: [['NOT_ASSIGNABLE', '', 'org.acme.lifted.p589@1.0.0.Person']], orThrow: ['ValidationException', 'NOT_ASSIGNABLE', ''], fromJson: null, consistent: true}},
        run: conformance(() => ({ $class: `${NS}.Car`, vin: '1' }), 'Person'),
    },
    {
        id: 'VI-CODE-013',
        covers: 'TYPE_NOT_FOUND: ClassDeclaration.validateInstance of an instance of an undeclared type',
        expect: {ok: {valid: false, errors: [['TYPE_NOT_FOUND', '', null]], orThrow: ['TypeNotFoundException', 'TYPE_NOT_FOUND', ''], fromJson: null, consistent: true}},
        run: conformance(() => ({ $class: `${NS}.Nope` }), 'Person'),
    },
    {
        id: 'VI-COLLECT-001',
        covers: 'collectAll (the default) reports every violation, the thrown one first; collectAll: false only the first',
        expect: {ok: {all: [['MISSING_REQUIRED_PROPERTY', '/address/city', 'String'], ['INVALID_ENUM_VALUE', '/colour', 'org.acme.lifted.p589@1.0.0.Colour']], first: [['MISSING_REQUIRED_PROPERTY', '/address/city', 'String']], orThrow: ['ValidationException', 'MISSING_REQUIRED_PROPERTY', '/address/city']}},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const json = person({ address: { $class: `${NS}.Address` }, colour: 'BLUE' });
            return {
                all: mm.validateInstance(json).errors.map(triple),
                first: mm.validateInstance(json, { collectAll: false }).errors.map(triple),
                orThrow: thrown(() => mm.validateInstanceOrThrow(json)),
            };
        },
    },
    {
        id: 'VI-VALID-001',
        covers: 'a valid instance: the resource is built (by fromJSON) only when first read, once, and never with hydrate: false',
        expect: {ok: {lazy: [true, [], 0, 1, 'ada@example.com', true], dry: [true, null, null, 1], keys: ['valid', 'warnings', 'resource']}},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const serializer = mm.getSerializer();
            const original = serializer.fromJSON;
            let calls = 0;
            serializer.fromJSON = function (...args) {
                calls++;
                return original.apply(this, args);
            };
            try {
                const result = mm.validateInstance(person());
                const before = calls;
                const id = result.resource.getIdentifier();
                const again = result.resource === result.resource;
                const lazy = [result.valid, result.warnings, before, calls, id, again];
                const dry = mm.validateInstance(person(), { hydrate: false });
                const dryOrThrow = mm.validateInstanceOrThrow(person(), { hydrate: false });
                return { lazy, dry: [dry.valid, dry.resource, dryOrThrow, calls], keys: Object.keys(result) };
            } finally {
                serializer.fromJSON = original;
            }
        },
    },
    {
        id: 'VI-VALID-002',
        covers: 'validateInstanceOrThrow returns the Resource fromJSON builds; ClassDeclaration reads an instance with no $class as its own type, and accepts a subtype',
        expect: {ok: ['org.acme.lifted.p589@1.0.0.Person', true, 'org.acme.lifted.p589@1.0.0.Person', 'org.acme.lifted.p589@1.0.0.Person', true, 'org.acme.lifted.p589@1.0.0.Employee', null, ['ValidationException', 'NOT_ASSIGNABLE', '']]},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const decl = mm.getType(`${NS}.Person`);
            const bare = { email: 'b@example.com', address: { city: 'Rome' } };
            const employee = Object.assign({ $class: `${NS}.Employee`, team: 'x' }, bare);
            return [
                mm.validateInstanceOrThrow(person()).getFullyQualifiedType(),
                decl.validateInstance(bare).valid,
                decl.validateInstance(bare).resource.getFullyQualifiedType(),
                decl.validateInstanceOrThrow(bare).getFullyQualifiedType(),
                decl.validateInstance(employee).valid,
                decl.validateInstanceOrThrow(employee).getFullyQualifiedType(),
                decl.validateInstanceOrThrow(employee, { hydrate: false }),
                thrown(() => mm.getType(`${NS}.Car`).validateInstanceOrThrow(employee, { hydrate: false })),
            ];
        },
    },
    {
        id: 'VI-TEXT-001',
        covers: 'JSON text is accepted as well as an object, with the same result',
        expect: {ok: [true, 'ada@example.com', ['ValidationException', 'TYPE_VIOLATION', '/age'], 'ada@example.com', 'ada@example.com', ['SyntaxError', null, null]]},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const bad = person({ age: 'old' });
            const decl = mm.getType(`${NS}.Person`);
            return [
                JSON.stringify(mm.validateInstance(JSON.stringify(bad))) === JSON.stringify(mm.validateInstance(bad)),
                mm.validateInstance(JSON.stringify(person())).resource.getIdentifier(),
                thrown(() => mm.validateInstanceOrThrow(JSON.stringify(bad))),
                mm.validateInstanceOrThrow(JSON.stringify(person())).getIdentifier(),
                decl.validateInstanceOrThrow(JSON.stringify(person())).getIdentifier(),
                thrown(() => mm.validateInstance('{not json')),
            ];
        },
    },
    {
        id: 'VI-1273-001',
        covers: '#1273 rejectUnknownKeys and rejectRequiredNull: off by default (today\'s behaviour), and with the same outcome as fromJSON when on',
        expect: {ok: {unknownDefault: 'valid', unknownStrict: [['UNDECLARED_FIELD', '/extra', null]], unknownThrow: ['ValidationException', 'UNDECLARED_FIELD', '/extra'], unknownFromJson: ['ValidationException', 'UNDECLARED_FIELD', '/extra'], nullDefault: [['MISSING_REQUIRED_PROPERTY', '/address/city', 'String']], nullStrict: [['TYPE_VIOLATION', '/address/city', 'String']], nullThrow: ['ValidationException', 'TYPE_VIOLATION', '/address/city'], nullFromJson: ['ValidationException', 'TYPE_VIOLATION', '/address/city']}},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const nullable = person({ address: { $class: `${NS}.Address`, city: 'Paris', zip: null }, extra: null });
            const requiredNull = person({ address: { $class: `${NS}.Address`, city: null } });
            const strict = { rejectUnknownKeys: true, rejectRequiredNull: true };
            const summary = (r) => r.valid ? 'valid' : r.errors.map(triple);
            return {
                unknownDefault: summary(mm.validateInstance(nullable)),
                unknownStrict: summary(mm.validateInstance(nullable, strict)),
                unknownThrow: thrown(() => mm.validateInstanceOrThrow(nullable, strict)),
                unknownFromJson: thrown(() => mm.getSerializer().fromJSON(nullable, strict)),
                nullDefault: summary(mm.validateInstance(requiredNull)),
                nullStrict: summary(mm.validateInstance(requiredNull, strict)),
                nullThrow: thrown(() => mm.validateInstanceOrThrow(requiredNull, strict)),
                nullFromJson: thrown(() => mm.getSerializer().fromJSON(requiredNull, strict)),
            };
        },
    },
    {
        id: 'VI-1325-001',
        covers: '#1325: code, path and expected carry no instance value; actual only with includeActual; redactMessages builds the message from the value-free fields',
        expect: {ok: {plain: [['INVALID_ENUM_VALUE', '/colour', 'org.acme.lifted.p589@1.0.0.Colour'], 'error', false, true, false], actual: [['INVALID_ENUM_VALUE', '/colour', 'org.acme.lifted.p589@1.0.0.Colour'], 'S3CRET-VALUE'], redacted: [['INVALID_ENUM_VALUE at `/colour`: expected org.acme.lifted.p589@1.0.0.Colour', false]], root: [['EMPTY_IDENTIFIER at the instance', 'object']]}},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const secret = 'S3CRET-VALUE';
            const json = person({ colour: secret });
            const plain = mm.validateInstance(json, { collectAll: false }).errors[0];
            const actual = mm.validateInstance(json, { includeActual: true, collectAll: false }).errors[0];
            const redacted = mm.validateInstance(json, { redactMessages: true, includeActual: false }).errors;
            const leaks = (d) => JSON.stringify([d.code, d.path, d.expected, d.severity]).includes(secret);
            return {
                plain: [triple(plain), plain.severity, 'actual' in plain, plain.message.includes(secret), leaks(plain)],
                actual: [triple(actual), actual.actual],
                redacted: redacted.map((d) => [d.message, d.message.includes(secret)]),
                root: mm.validateInstance({ $class: `${NS}.Car`, vin: '' }, { includeActual: true, redactMessages: true }).errors.map((d) => [d.message, typeof d.actual]),
            };
        },
    },
    {
        id: 'VI-1325-002',
        covers: '#1325: the exceptions validateInstanceOrThrow and Serializer.fromJSON throw carry the diagnostics as details, not enumerable, without changing their message',
        expect: {ok: {message: 'Expected value at path `$.age` to be of type `Integer`', sameMessage: true, keys: ['component', 'name', 'errorType'], enumerable: false, details: [{code: 'TYPE_VIOLATION', path: '/age', expected: 'Integer', severity: 'error', message: 'Expected value at path `$.age` to be of type `Integer`'}], orThrowActual: ['old'], sameAsErrors: true}},
        run: (core) => {
            const mm = manager(core);
            if (!mm) {
                return NO_API;
            }
            const json = person({ age: 'old' });
            let fromJson;
            let orThrow;
            try {
                mm.getSerializer().fromJSON(json);
            } catch (e) {
                fromJson = e;
            }
            try {
                mm.validateInstanceOrThrow(json, { includeActual: true });
            } catch (e) {
                orThrow = e;
            }
            const errors = mm.validateInstance(json).errors;
            return {
                message: fromJson.message,
                sameMessage: fromJson.message === orThrow.message,
                keys: Object.keys(fromJson),
                enumerable: Object.prototype.propertyIsEnumerable.call(fromJson, 'details'),
                details: fromJson.details,
                orThrowActual: orThrow.details.map((d) => d.actual),
                sameAsErrors: JSON.stringify(fromJson.details) === JSON.stringify(errors.slice(0, fromJson.details.length)),
            };
        },
    },
];

for (const check of checks) {
    check.reference = { ok: NO_API };
}

module.exports = checks;
