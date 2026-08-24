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

const CollectionSizeValidator = require('../../src/introspect/collectionsizevalidator');

describe('CollectionSizeValidator', () => {
    const property = {
        getName: () => 'values',
        getFullyQualifiedName: () => 'org.example.Thing.values',
    };

    it('should reject invalid definitions', () => {
        (() => new CollectionSizeValidator(property, {})).should.throw(/must be specified/);
        (() => new CollectionSizeValidator(property, { minSize: -1 })).should.throw(/non-negative integers/);
        (() => new CollectionSizeValidator(property, { maxSize: 1.5 })).should.throw(/non-negative integers/);
        (() => new CollectionSizeValidator(property, { minSize: 2, maxSize: 1 })).should.throw(/less than or equal/);
    });

    it('should enforce inclusive array and map bounds', () => {
        const validator = new CollectionSizeValidator(property, { minSize: 1, maxSize: 2 });
        validator.getMinSize().should.equal(1);
        validator.getMaxSize().should.equal(2);
        validator.validate('id', ['one']);
        validator.validate('id', new Map([['one', 1], ['two', 2]]));
        validator.validate('id', 'not a collection');
        (() => validator.validate('id', [])).should.throw(/at least 1 elements/);
        (() => validator.validate('id', new Map([['one', 1], ['two', 2], ['three', 3]]))).should.throw(/no more than 2 elements/);
    });

    it('should compare compatibility', () => {
        const validator = (bounds) => new CollectionSizeValidator(property, bounds);
        validator({ minSize: 1 }).compatibleWith({}).should.equal(false);
        validator({ minSize: 1 }).compatibleWith(validator({ minSize: 2 })).should.equal(false);
        validator({ maxSize: 4 }).compatibleWith(validator({ maxSize: 3 })).should.equal(false);
        validator({ minSize: 1, maxSize: 4 }).compatibleWith(validator({ minSize: 0, maxSize: 5 })).should.equal(true);
        validator({ minSize: 1 }).compatibleWith(validator({ maxSize: 5 })).should.equal(false);
        validator({ maxSize: 4 }).compatibleWith(validator({ minSize: 0 })).should.equal(true);
    });
});
