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

const { ModelFile } = require('../src/introspect/modelfile');
const { Property } = require('../src/introspect/property');
const { ModelManager } = require('../src/modelmanager');
const { ModelUtil } = require('../src/modelutil');

require('chai').should();
const sinon = require('sinon');

describe('ModelUtil', function () {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#isPrimitiveType', function() {
        it('check isPrimitiveType', function() {
            ModelUtil.isPrimitiveType('org.acme.baz@1.0.0.Foo').should.equal(false);
            ModelUtil.isPrimitiveType('Boolean').should.equal(true);
            ModelUtil.isPrimitiveType('Integer').should.equal(true);
            ModelUtil.isPrimitiveType('Long').should.equal(true);
            ModelUtil.isPrimitiveType('DateTime').should.equal(true);
            ModelUtil.isPrimitiveType('String').should.equal(true);
        });
    });

    describe('#isValidIdentifier', function() {

        it('should return false for undefined', function() {
            ModelUtil.isValidIdentifier(undefined).should.equal(false);
        });

        it('should return false for null', function() {
            ModelUtil.isValidIdentifier(null).should.equal(false);
        });

        it('should preserve valid identifier strings "undefined" and "null"', function() {
            ModelUtil.isValidIdentifier('undefined').should.equal(true);
            ModelUtil.isValidIdentifier('null').should.equal(true);
        });

    });

    describe('#isScalar', function() {
        it('should return true for scalar field and falsy for primitive field', function() {
            const mm = new ModelManager();
            mm.addCTOModel(`namespace org.test@1.0.0
            scalar MyString extends String
            concept Foo {
                o MyString scalarField
                o String primitiveField
            }`, 'test.cto');
            const decl = mm.getType('org.test@1.0.0.Foo');
            Boolean(ModelUtil.isScalar(decl.getProperty('scalarField'))).should.be.true;
            Boolean(ModelUtil.isScalar(decl.getProperty('primitiveField'))).should.be.false;
        });
    });

    describe('#getShortName', function() {

        it('should handle a name with a namespace', function() {
            ModelUtil.getShortName('org.acme.baz@1.0.0.Foo').should.equal('Foo');
        });

        it('should handle a name without a namespace', function() {
            ModelUtil.getShortName('Foo').should.equal('Foo');
        });

    });

    describe('#getNamespace', function() {
        it('check getNamespace', function() {
            ModelUtil.getNamespace('org.acme.baz@1.0.0.Foo').should.equal('org.acme.baz@1.0.0');
            ModelUtil.getNamespace('Foo').should.equal('');
        });
    });

    describe('#capitalizeFirstLetter', () => {

        it('should handle a single lower case letter', () => {
            ModelUtil.capitalizeFirstLetter('a').should.equal('A');
        });

        it('should handle a single upper case letter', () => {
            ModelUtil.capitalizeFirstLetter('A').should.equal('A');
        });

        it('should handle a string of lower case letters', () => {
            ModelUtil.capitalizeFirstLetter('abcdef').should.equal('Abcdef');
        });

        it('should handle a string of mixed case letters', () => {
            ModelUtil.capitalizeFirstLetter('aBcDeF').should.equal('ABcDeF');
        });

    });

    describe('#isAssignableTo', function() {
        let mockModelFile;
        let mockProperty;

        beforeEach(function() {
            mockModelFile = sinon.createStubInstance(ModelFile);
            mockProperty = sinon.createStubInstance(Property);
        });

        it('returns true for matching primitive types', function() {
            mockProperty.getFullyQualifiedTypeName.returns('String');
            const result = ModelUtil.isAssignableTo(mockModelFile, 'String', mockProperty);
            result.should.equal(true);
        });

        it('returns false for non-matching primitive types', function() {
            mockProperty.getFullyQualifiedTypeName.returns('DateTime');
            const result = ModelUtil.isAssignableTo(mockModelFile, 'Boolean', mockProperty);
            result.should.equal(false);
        });

        it('returns false for assignment of primitive to non-primitive property', function() {
            mockProperty.getFullyQualifiedTypeName.returns('org.doge.Doge');
            const result = ModelUtil.isAssignableTo(mockModelFile, 'String', mockProperty);
            result.should.equal(false);
        });

        it('returns false for assignment of non-primitive to primitive property', function() {
            mockProperty.getFullyQualifiedTypeName.returns('String');
            const result = ModelUtil.isAssignableTo(mockModelFile, 'org.doge.Doge', mockProperty);
            result.should.equal(false);
        });

        it('returns true if property type and required type are identical', function() {
            mockProperty.getFullyQualifiedTypeName.returns('org.doge.Doge');
            const result = ModelUtil.isAssignableTo(mockModelFile, 'org.doge.Doge', mockProperty);
            result.should.equal(true);
        });

        it('throws error when type cannot be found', function() {
            mockProperty.getName.returns('theDoge');
            mockProperty.getFullyQualifiedTypeName.returns('org.doge.BaseDoge');
            const mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.getType.returns(null);
            mockModelFile.getModelManager.returns(mockModelManager);
            (() => {
                ModelUtil.isAssignableTo(mockModelFile, 'org.doge.Doge', mockProperty);
            }).should.throw(/Cannot find type/);
        });

    });

    describe('#getFullyQualifiedName', function() {
        it('valid inputs', function() {
            const result = ModelUtil.getFullyQualifiedName('a.namespace', 'type');
            result.should.equal('a.namespace.type');
        });

        it('empty namespace should return the type with no leading dot', function() {
            const result = ModelUtil.getFullyQualifiedName('', 'type');
            result.should.equal('type');
        });

    });

    describe('#removeNamespaceVersionFromFullyQualifiedName', function() {
        it('valid inputs', function() {
            const result = ModelUtil.removeNamespaceVersionFromFullyQualifiedName('org.acme@1.0.0.Person');
            result.should.equal('org.acme.Person');
        });

        it('primtive type', function() {
            const result = ModelUtil.removeNamespaceVersionFromFullyQualifiedName('String');
            result.should.equal('String');
        });

    });

    describe('#parseNamespace', function() {
        it('valid, with version', function() {
            const nsInfo = ModelUtil.parseNamespace('org.acme@1.0.0');
            nsInfo.name.should.equal('org.acme');
            nsInfo.escapedNamespace.should.equal('org.acme_1.0.0');
            nsInfo.version.should.equal('1.0.0');
            nsInfo.versionParsed.major.should.equal(1);
        });

        it('valid, with version validation disabled', function() {
            const nsInfo = ModelUtil.parseNamespace('org.acme@1.0.x', { disableVersionParsing: true });
            nsInfo.name.should.equal('org.acme');
            nsInfo.should.not.have.property('escapedNamespace');
            nsInfo.should.not.have.property('version');
            nsInfo.should.not.have.property('versionParsed');
        });

        it('invalid', function() {
            (() => {
                ModelUtil.parseNamespace(null);
            }).should.throw(/Namespace is null/);
        });

        it('invalid', function() {
            (() => {
                ModelUtil.parseNamespace('org.acme@1.0.0@2.3');
            }).should.throw(/Invalid namespace/);
        });

        it('invalid version', function() {
            (() => {
                ModelUtil.parseNamespace('org.acme@1.1.2+.123');
            }).should.throw(/Invalid namespace/);
        });
    });

    describe('#isValidMapKey', function() {
        it('should return false for undefined or null', function() {
            ModelUtil.isValidMapKey(undefined).should.equal(false);
            ModelUtil.isValidMapKey(null).should.equal(false);
        });

        it('should return false for invalid objects or primitives', function() {
            ModelUtil.isValidMapKey({}).should.equal(false);
            ModelUtil.isValidMapKey('string').should.equal(false);
            ModelUtil.isValidMapKey(123).should.equal(false);
        });

        it('should return true for valid map key types', function() {
            ModelUtil.isValidMapKey({ $class: 'concerto.metamodel@1.0.0.StringMapKeyType' }).should.equal(true);
            ModelUtil.isValidMapKey({ $class: 'concerto.metamodel@1.0.0.DateTimeMapKeyType' }).should.equal(true);
            ModelUtil.isValidMapKey({ $class: 'concerto.metamodel@1.0.0.ObjectMapKeyType' }).should.equal(true);
        });
    });

    describe('#isValidMapKeyScalar', function() {
        it('should return false for undefined, null, or empty object', function() {
            ModelUtil.isValidMapKeyScalar(undefined).should.equal(false);
            ModelUtil.isValidMapKeyScalar(null).should.equal(false);
            ModelUtil.isValidMapKeyScalar({}).should.equal(false);
            ModelUtil.isValidMapKeyScalar({ isScalarDeclaration: () => false }).should.equal(false);
        });

        it('should return true for valid StringScalar or DateTimeScalar declaration', function() {
            const validStringScalar = {
                isScalarDeclaration: () => true,
                ast: { $class: 'concerto.metamodel@1.0.0.StringScalar' }
            };
            const validDateTimeScalar = {
                isScalarDeclaration: () => true,
                ast: { $class: 'concerto.metamodel@1.0.0.DateTimeScalar' }
            };
            const invalidScalar = {
                isScalarDeclaration: () => true,
                ast: { $class: 'concerto.metamodel@1.0.0.DoubleScalar' }
            };
            ModelUtil.isValidMapKeyScalar(validStringScalar).should.equal(true);
            ModelUtil.isValidMapKeyScalar(validDateTimeScalar).should.equal(true);
            ModelUtil.isValidMapKeyScalar(invalidScalar).should.equal(false);
        });
    });

    describe('#isValidMapValue', function() {
        it('should return false for undefined or null', function() {
            ModelUtil.isValidMapValue(undefined).should.equal(false);
            ModelUtil.isValidMapValue(null).should.equal(false);
        });

        it('should return false for invalid objects or primitives', function() {
            ModelUtil.isValidMapValue({}).should.equal(false);
            ModelUtil.isValidMapValue('string').should.equal(false);
            ModelUtil.isValidMapValue(123).should.equal(false);
        });

        it('should return true for valid map value types', function() {
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.BooleanMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.DateTimeMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.StringMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.IntegerMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.LongMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.DoubleMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.ObjectMapValueType' }).should.equal(true);
            ModelUtil.isValidMapValue({ $class: 'concerto.metamodel@1.0.0.RelationshipMapValueType' }).should.equal(true);
        });
    });
});
