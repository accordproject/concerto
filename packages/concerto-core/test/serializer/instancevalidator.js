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

const ModelManager = require('../../src/modelmanager');
const Resource = require('../../src/model/resource');

const chai = require('chai');
const expect = chai.expect;
chai.should();

const MODEL = `namespace org.acme@1.0.0

concept Address {
  o String street
  o String city
  o String postcode regex=/^[A-Z0-9 ]{3,10}$/
}

participant Person identified by id {
  o String id
  o String email regex=/^.+@.+$/
  o Integer age range=[0,150]
  o Address address optional
  o String[] tags
}

participant Customer extends Person {
  o String segment
}

asset Account identified by accountId {
  o String accountId
  --> Person owner
}

@editor
abstract concept AbstractThing {
  o String label
}

enum Colour {
  o RED
  o GREEN
  o BLUE
}

concept Coloured {
  o Colour colour
}
`;

describe('Ergonomic validation API', () => {
    let modelManager;
    let personDecl;
    let accountDecl;
    let abstractDecl;
    let colouredDecl;

    beforeEach(() => {
        modelManager = new ModelManager();
        modelManager.addCTOModel(MODEL, 'acme.cto');
        personDecl = modelManager.getType('org.acme@1.0.0.Person');
        accountDecl = modelManager.getType('org.acme@1.0.0.Account');
        abstractDecl = modelManager.getType('org.acme@1.0.0.AbstractThing');
        colouredDecl = modelManager.getType('org.acme@1.0.0.Coloured');
    });

    describe('ClassDeclaration#validateInstance', () => {
        it('returns valid for a conforming instance and hydrates a Resource', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'alice@example.com',
                age: 30,
                tags: ['a', 'b'],
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(true);
            result.resource.should.be.an.instanceOf(Resource);
            result.resource.getIdentifier().should.equal('alice');
            result.errors === undefined || result.errors.length.should.equal(0);
        });

        it('accepts a subtype instance when validating against the supertype', () => {
            const json = {
                $class: 'org.acme@1.0.0.Customer',
                id: 'bob',
                email: 'bob@example.com',
                age: 40,
                tags: [],
                segment: 'gold',
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(true);
        });

        it('rejects a TYPE_MISMATCH when $class is unrelated', () => {
            const json = {
                $class: 'org.acme@1.0.0.Address',
                street: 'x',
                city: 'y',
                postcode: 'ABC123',
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(false);
            result.errors.should.have.length.greaterThan(0);
            result.errors[0].code.should.equal('TYPE_MISMATCH');
            result.errors[0].path.should.equal('/');
            result.errors[0].expected.should.equal('org.acme@1.0.0.Person');
        });

        it('flags MISSING_CLASS when $class is absent', () => {
            const result = personDecl.validateInstance({ id: 'x' });
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('MISSING_CLASS');
        });

        it('rejects an abstract type', () => {
            const result = abstractDecl.validateInstance({
                $class: 'org.acme@1.0.0.AbstractThing',
                label: 'x',
            });
            result.valid.should.equal(false);
            // The factory rejects abstract types up front, so the diagnostic
            // surfaces as a DESERIALIZATION_ERROR rather than ABSTRACT_CLASS.
            // Either is acceptable; what matters is that it's flagged.
            const codes = result.errors.map(e => e.code);
            (codes.includes('ABSTRACT_CLASS') || codes.includes('DESERIALIZATION_ERROR'))
                .should.equal(true);
        });

        it('aggregates every post-deserialization violation by default', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                // missing email → MISSING_REQUIRED_FIELD
                age: 999, // out of range → VALIDATOR_VIOLATION (NumberValidator)
                tags: [],
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(false);
            const codes = result.errors.map(e => e.code);
            codes.should.include('MISSING_REQUIRED_FIELD');
            codes.should.include('VALIDATOR_VIOLATION');
            // diagnostics carry a JSON-pointer path
            result.errors.forEach(e => {
                e.path.should.be.a('string');
                e.path.startsWith('/').should.equal(true);
            });
        });

        it('respects collectAll:false and stops at the first error', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                age: 999,
                tags: [],
            };
            const result = personDecl.validateInstance(json, { collectAll: false });
            result.valid.should.equal(false);
            result.errors.length.should.equal(1);
        });

        it('reports MISSING_REQUIRED_FIELD with path to the field', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                age: 30,
                tags: [],
                // missing email
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(false);
            const missing = result.errors.find(e => e.code === 'MISSING_REQUIRED_FIELD');
            expect(missing).to.exist;
            missing.path.should.equal('/email');
        });

        it('reports nested field paths with JSON-pointer style', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'alice@example.com',
                age: 30,
                tags: [],
                address: {
                    $class: 'org.acme@1.0.0.Address',
                    street: 's',
                    city: 'c',
                    postcode: 'not-valid!',
                },
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(false);
            const violation = result.errors.find(e => e.code === 'VALIDATOR_VIOLATION');
            expect(violation).to.exist;
            violation.path.should.equal('/address/postcode');
        });

        it('returns an empty resource on success, not the input', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'a@b.co',
                age: 1,
                tags: [],
            };
            const result = personDecl.validateInstance(json);
            result.valid.should.equal(true);
            // populated Resource carries the same identity but is not the input object
            result.resource.getFullyQualifiedIdentifier().should.equal('org.acme@1.0.0.Person#alice');
            (result.resource === json).should.equal(false);
        });

        it('rejects an invalid enum value', () => {
            const result = colouredDecl.validateInstance({
                $class: 'org.acme@1.0.0.Coloured',
                colour: 'PURPLE',
            });
            result.valid.should.equal(false);
            result.errors.some(e => e.code === 'INVALID_ENUM_VALUE').should.equal(true);
        });
    });

    describe('ClassDeclaration#validateInstanceOrThrow', () => {
        it('returns the Resource on success', () => {
            const resource = personDecl.validateInstanceOrThrow({
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'a@b.co',
                age: 1,
                tags: [],
            });
            resource.should.be.an.instanceOf(Resource);
        });

        it('throws ValidationException with diagnostics on failure', () => {
            try {
                personDecl.validateInstanceOrThrow({
                    $class: 'org.acme@1.0.0.Person',
                    id: 'alice',
                    age: 1,
                    tags: [],
                });
                throw new Error('expected throw');
            } catch (err) {
                err.name.should.equal('ValidationException');
                Array.isArray(err.diagnostics).should.equal(true);
                err.diagnostics.some(d => d.code === 'MISSING_REQUIRED_FIELD').should.equal(true);
            }
        });
    });

    describe('ClassDeclaration#isValidInstance', () => {
        it('returns true for a valid instance', () => {
            personDecl.isValidInstance({
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'a@b.co',
                age: 1,
                tags: [],
            }).should.equal(true);
        });

        it('returns false for an invalid instance', () => {
            personDecl.isValidInstance({
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
            }).should.equal(false);
        });
    });

    describe('ClassDeclaration#generateSample', () => {
        it('produces a JSON instance that round-trips through validateInstance', () => {
            const sample = personDecl.generateSample();
            sample.$class.should.equal('org.acme@1.0.0.Person');
            const result = personDecl.validateInstance(sample);
            result.valid.should.equal(true);
        });

        it('honours includeOptionalFields', () => {
            const sample = personDecl.generateSample({ includeOptionalFields: true });
            // address is the only optional field on Person
            expect(sample.address).to.exist;
        });
    });

    describe('ModelManager#validateInstance', () => {
        it('resolves the type from $class and validates', () => {
            const result = modelManager.validateInstance({
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'a@b.co',
                age: 1,
                tags: [],
            });
            result.valid.should.equal(true);
        });

        it('flags MISSING_CLASS', () => {
            const result = modelManager.validateInstance({ id: 'x' });
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('MISSING_CLASS');
        });

        it('flags UNKNOWN_TYPE for an unresolvable $class', () => {
            const result = modelManager.validateInstance({
                $class: 'org.unknown@1.0.0.Mystery',
                id: 'x',
            });
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('UNKNOWN_TYPE');
            result.errors[0].actual.should.equal('org.unknown@1.0.0.Mystery');
        });

        it('rejects non-object input', () => {
            const result = modelManager.validateInstance(42);
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('TYPE_MISMATCH');
        });
    });

    describe('ModelManager#validateInstanceOrThrow', () => {
        it('returns Resource on success', () => {
            const r = modelManager.validateInstanceOrThrow({
                $class: 'org.acme@1.0.0.Person',
                id: 'a',
                email: 'a@b.co',
                age: 1,
                tags: [],
            });
            r.should.be.an.instanceOf(Resource);
        });

        it('throws for MISSING_CLASS without contacting the validator', () => {
            try {
                modelManager.validateInstanceOrThrow({});
                throw new Error('expected throw');
            } catch (err) {
                err.name.should.equal('ValidationException');
                err.diagnostics[0].code.should.equal('MISSING_CLASS');
            }
        });
    });

    describe('ModelManager#isValidInstance', () => {
        it('boolean shortcut', () => {
            modelManager.isValidInstance({
                $class: 'org.acme@1.0.0.Person',
                id: 'a',
                email: 'a@b.co',
                age: 1,
                tags: [],
            }).should.equal(true);
            modelManager.isValidInstance({ $class: 'org.acme@1.0.0.Person' }).should.equal(false);
        });
    });

    describe('edge cases', () => {
        it('ClassDeclaration#validateInstance rejects null input', () => {
            const result = personDecl.validateInstance(null);
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('TYPE_MISMATCH');
            result.errors[0].actual.should.equal('null');
        });

        it('ClassDeclaration#validateInstance rejects non-string $class', () => {
            const result = personDecl.validateInstance({ $class: 42 });
            result.valid.should.equal(false);
            result.errors[0].code.should.equal('MISSING_CLASS');
        });

        it('aggregated message lists every diagnostic in the thrown error', () => {
            const json = {
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                // missing email
                age: 999, // out of range
                tags: [],
            };
            try {
                personDecl.validateInstanceOrThrow(json);
                throw new Error('expected throw');
            } catch (err) {
                err.diagnostics.length.should.be.greaterThan(1);
                err.message.should.contain('validation errors');
                err.message.should.contain('MISSING_REQUIRED_FIELD');
                err.message.should.contain('VALIDATOR_VIOLATION');
            }
        });

        it('returns the resource when collectAll:false succeeds', () => {
            const result = personDecl.validateInstance({
                $class: 'org.acme@1.0.0.Person',
                id: 'alice',
                email: 'a@b.co',
                age: 1,
                tags: [],
            }, { collectAll: false });
            result.valid.should.equal(true);
        });

        it('ModelManager#validateInstanceOrThrow propagates aggregated errors', () => {
            try {
                modelManager.validateInstanceOrThrow({
                    $class: 'org.acme@1.0.0.Person',
                    id: 'alice',
                    age: 999,
                    tags: [],
                });
                throw new Error('expected throw');
            } catch (err) {
                err.diagnostics.length.should.be.greaterThan(1);
            }
        });
    });

    describe('relationships', () => {
        it('accepts a well-formed relationship to the correct type', () => {
            const result = accountDecl.validateInstance({
                $class: 'org.acme@1.0.0.Account',
                accountId: 'x',
                owner: 'resource:org.acme@1.0.0.Person#alice',
            });
            result.valid.should.equal(true);
        });

        it('rejects a relationship pointing to an unknown type', () => {
            const result = accountDecl.validateInstance({
                $class: 'org.acme@1.0.0.Account',
                accountId: 'x',
                owner: 'resource:org.nope@1.0.0.Ghost#1',
            });
            result.valid.should.equal(false);
            result.errors.length.should.be.greaterThan(0);
        });
    });
});
