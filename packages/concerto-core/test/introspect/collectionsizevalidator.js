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

    const mockField = {
        getName: () => 'testField',
        getFullyQualifiedName: () => 'org.example.Thing.testField',
    };

    describe('#constructor', () => {

        it('should create with both minSize and maxSize', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 1, maxSize: 10 });
            v.getMinSize().should.equal(1);
            v.getMaxSize().should.equal(10);
        });

        it('should create with minSize only', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 3 });
            v.getMinSize().should.equal(3);
            chai.expect(v.getMaxSize()).to.be.null;
        });

        it('should create with maxSize only', () => {
            const v = new CollectionSizeValidator(mockField, { maxSize: 5 });
            chai.expect(v.getMinSize()).to.be.null;
            v.getMaxSize().should.equal(5);
        });

        it('should throw when neither minSize nor maxSize specified', () => {
            (() => new CollectionSizeValidator(mockField, {}))
                .should.throw(/minSize and\/or maxSize must be specified/);
        });

        it('should throw when minSize is negative', () => {
            (() => new CollectionSizeValidator(mockField, { minSize: -1 }))
                .should.throw(/positive integers/);
        });

        it('should throw when maxSize is negative', () => {
            (() => new CollectionSizeValidator(mockField, { maxSize: -2 }))
                .should.throw(/positive integers/);
        });

        it('should throw when minSize > maxSize', () => {
            (() => new CollectionSizeValidator(mockField, { minSize: 5, maxSize: 2 }))
                .should.throw(/minSize must be less than or equal to maxSize/);
        });

        it('should allow minSize equal to maxSize', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 3, maxSize: 3 });
            v.getMinSize().should.equal(3);
            v.getMaxSize().should.equal(3);
        });

        it('should allow minSize of zero', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 0, maxSize: 5 });
            v.getMinSize().should.equal(0);
        });
    });

    describe('#validate', () => {

        it('should pass when value is within bounds', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 1, maxSize: 5 });
            v.validate('id', 1);
            v.validate('id', 3);
            v.validate('id', 5);
        });

        it('should throw when value is below minSize', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 2, maxSize: 5 });
            (() => v.validate('id', 1)).should.throw(/at least 2 elements/);
            (() => v.validate('id', 0)).should.throw(/at least 2 elements/);
        });

        it('should throw when value exceeds maxSize', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 1, maxSize: 3 });
            (() => v.validate('id', 4)).should.throw(/no more than 3 elements/);
        });

        it('should only enforce minSize when maxSize is null', () => {
            const v = new CollectionSizeValidator(mockField, { minSize: 2 });
            v.validate('id', 100);
            (() => v.validate('id', 1)).should.throw(/at least 2 elements/);
        });

        it('should only enforce maxSize when minSize is null', () => {
            const v = new CollectionSizeValidator(mockField, { maxSize: 3 });
            v.validate('id', 0);
            (() => v.validate('id', 4)).should.throw(/no more than 3 elements/);
        });
    });

    describe('#compatibleWith', () => {

        const validator = (opts) => new CollectionSizeValidator(mockField, opts);

        it('should return false for non-CollectionSizeValidator', () => {
            validator({ minSize: 1 }).compatibleWith({}).should.equal(false);
        });

        it('should be compatible when other is more permissive (loosened)', () => {
            validator({ minSize: 2, maxSize: 5 })
                .compatibleWith(validator({ minSize: 1, maxSize: 6 }))
                .should.equal(true);
        });

        it('should be incompatible when other tightens minSize', () => {
            validator({ minSize: 1, maxSize: 5 })
                .compatibleWith(validator({ minSize: 3, maxSize: 5 }))
                .should.equal(false);
        });

        it('should be incompatible when other tightens maxSize', () => {
            validator({ minSize: 1, maxSize: 5 })
                .compatibleWith(validator({ minSize: 1, maxSize: 3 }))
                .should.equal(false);
        });

        it('should be incompatible when this has no min and other adds one', () => {
            validator({ maxSize: 10 })
                .compatibleWith(validator({ minSize: 1, maxSize: 10 }))
                .should.equal(false);
        });

        it('should be incompatible when this has no max and other adds one', () => {
            validator({ minSize: 1 })
                .compatibleWith(validator({ minSize: 1, maxSize: 10 }))
                .should.equal(false);
        });

        it('should be compatible when other removes max', () => {
            validator({ minSize: 1, maxSize: 5 })
                .compatibleWith(validator({ minSize: 1 }))
                .should.equal(true);
        });

        it('should be compatible when other removes min', () => {
            validator({ minSize: 1, maxSize: 5 })
                .compatibleWith(validator({ maxSize: 5 }))
                .should.equal(true);
        });

        it('should be compatible with identical validator', () => {
            validator({ minSize: 2, maxSize: 8 })
                .compatibleWith(validator({ minSize: 2, maxSize: 8 }))
                .should.equal(true);
        });
    });
});
