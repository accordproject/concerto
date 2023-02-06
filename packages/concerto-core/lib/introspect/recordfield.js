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

const Property = require('./property');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ClassDeclaration = require('./classdeclaration');
    const Validator = require('./validator');
}
/* eslint-enable no-unused-vars */

/**
 * Class representing the definition of a Field. A Field is owned
 * by a ClassDeclaration and has a name, type and additional metadata
 * (see below).
 * @private
 * @extends Property
 * @see See  {@link  Property}
 * @class
 * @memberof module:concerto-core
 */
class RecordField extends Property {
    /**
     * Create a Field.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        super(parent, ast);
        this.map = new Map();
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        this.validator = null;

        this.keyType = this.ast.keyType.name;
        this.valueType = this.ast.valueType.name;
    }

    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    validate(classDecl) {
        super.validate();

        if(this.type) {
            classDecl.getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.type);
            classDecl.getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.keyType);
            classDecl.getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.valueType);
        }
    }

    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName() {
        return `Record<${this.keyType}, ${this.valueType}>`;
    }

    /**
     * Returns the validator string for this field
     * @return {Validator} the validator for the field or null
     */
    getValidator() {
        return null;
    }

    /**
     * Returns the default value for the field or null
     * @return {string | number} the default value for the field or null
     */
    getDefaultValue() {
        return null;
    }

    /**
     * Returns true if this class is the definition of a field.
     *
     * @return {boolean} true if the class is a field
     */
    isField() {
        return true;
    }

    /**
     * Returns true if the field's type is a scalar
     * @returns {boolean} true if the field is a scalar type
     */
    isTypeScalar() {
        return false;
    }

    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum() {
        return false;
    }

    /**
     * Returns true if this property is an aggregate type.
     * @return {boolean} true if the property is an aggregate type.
     */
    isAggregate() {
        return true;
    }
}

module.exports = RecordField;
