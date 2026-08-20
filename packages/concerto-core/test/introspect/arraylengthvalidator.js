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

const chai = require('chai');
chai.should();

const ArrayLengthValidator = require('../../src/introspect/arraylengthvalidator');

describe('ArrayLengthValidator', () => {
    const property = (isArray = true) => ({
        isArray: () => isArray,
        getName: () => 'values',
        getFullyQualifiedName: () => 'org.example.Thing.values',
    });

    it('should reject invalid definitions', () => {
        (() => new ArrayLengthValidator(property(false), { minElements: 1 })).should.throw(/only be applied to array/);
        (() => new ArrayLengthValidator(property(), {})).should.throw(/must be specified/);
        (() => new ArrayLengthValidator(property(), { minElements: -1 })).should.throw(/non-negative integers/);
        (() => new ArrayLengthValidator(property(), { maxElements: 1.5 })).should.throw(/non-negative integers/);
        (() => new ArrayLengthValidator(property(), { minElements: 2, maxElements: 1 })).should.throw(/less than or equal/);
    });

    it('should enforce inclusive bounds and expose them', () => {
        const validator = new ArrayLengthValidator(property(), { minElements: 1, maxElements: 2 });
        validator.getMinElements().should.equal(1);
        validator.getMaxElements().should.equal(2);
        validator.validate('id', ['one']);
        validator.validate('id', ['one', 'two']);
        (() => validator.validate('id', [])).should.throw(/at least 1 elements/);
        (() => validator.validate('id', ['one', 'two', 'three'])).should.throw(/no more than 2 elements/);
    });

    it('should compare compatibility', () => {
        const validator = (bounds) => new ArrayLengthValidator(property(), bounds);
        validator({ minElements: 1 }).compatibleWith({}).should.equal(false);
        validator({ minElements: 1 }).compatibleWith(validator({ minElements: 2 })).should.equal(false);
        validator({ maxElements: 4 }).compatibleWith(validator({ maxElements: 3 })).should.equal(false);
        validator({ minElements: 1, maxElements: 4 }).compatibleWith(validator({ minElements: 0, maxElements: 5 })).should.equal(true);
        validator({ minElements: 1 }).compatibleWith(validator({ maxElements: 5 })).should.equal(false);
        validator({ maxElements: 4 }).compatibleWith(validator({ minElements: 0 })).should.equal(true);
    });
});
