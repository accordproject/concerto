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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const Property = require('./property');
const NumberValidator = require('./numbervalidator');
const StringValidator = require('./stringvalidator');
const Util = require('@accordproject/concerto-util').NullUtil;

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
class Field extends Property {
    /**
     * Create a Field.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        super(parent, ast);
        this.scalarField = null; // cache scalar field
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        this.validator = null;

        switch (this.getType()) {
        case 'Integer':
        case 'Double':
        case 'Long':
            if (this.ast.validator) {
                this.validator = new NumberValidator(
                    this,
                    this.ast.validator
                );
            }
            break;
        case 'String':
            if (this.ast.validator || this.ast.lengthValidator) {
                this.validator = new StringValidator(
                    this,
                    this.ast.validator,
                    this.ast.lengthValidator
                );
            }
            break;
        }

        if (!Util.isNull(this.ast.defaultValue)) {
            this.defaultValue = this.ast.defaultValue;
        } else {
            this.defaultValue = null;
        }
    }

    /**
     * Returns the validator string for this field
     * @return {Validator} the validator for the field or null
     */
    getValidator() {
        return this.validator;
    }

    /**
     * Returns the default value for the field or null if there is no default value
     * @return {string | number} the default value for the field or null
     */
    getDefaultValue() {
        return this.defaultValue;
    }

    /**
     * Returns a string representation of this property§
     * @return {String} the string version of the property.
     */
    toString() {
        return (
            'Field {name=' +
            this.name +
            ', type=' +
            this.getFullyQualifiedTypeName() +
            ', array=' +
            this.array +
            ', optional=' +
            this.optional +
            '}'
        );
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
        if (this.isPrimitive()) {
            return false;
        } else {
            this.getParent()
                .getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.getType());
            const type = this.getParent()
                .getModelFile()
                .getType(this.getType());
            return type.isScalarDeclaration?.();
        }
    }

    /**
     * Unboxes a field that references a scalar type to an
     * underlying Field definition.
     * @throws {Error} throws an error if this field is not a scalar type.
     * @returns {Field} the primitive field for this scalar
     */
    getScalarField() {
        if(this.scalarField) {
            return this.scalarField;
        }
        if (!this.isTypeScalar()) {
            throw new Error(`Field ${this.name} is not a scalar property.`);
        }
        const type = this.getParent().getModelFile().getType(this.getType());
        const fieldAst = JSON.parse(JSON.stringify(type.ast));

        switch (type.ast.$class) {
        case `${MetaModelNamespace}.StringScalar`:
            fieldAst.$class = `${MetaModelNamespace}.StringProperty`;
            break;
        case `${MetaModelNamespace}.BooleanScalar`:
            fieldAst.$class = `${MetaModelNamespace}.BooleanProperty`;
            break;

        case `${MetaModelNamespace}.DateTimeScalar`:
            fieldAst.$class = `${MetaModelNamespace}.DateTimeProperty`;
            break;

        case `${MetaModelNamespace}.DoubleScalar`:
            fieldAst.$class = `${MetaModelNamespace}.DoubleProperty`;
            break;

        case `${MetaModelNamespace}.IntegerScalar`:
            fieldAst.$class = `${MetaModelNamespace}.IntegerProperty`;
            break;

        case `${MetaModelNamespace}.LongScalar`:
            fieldAst.$class = `${MetaModelNamespace}.LongProperty`;
            break;
        default:
            throw new Error(`Unrecognized scalar type ${type.ast.$class}`);
        }

        fieldAst.name = this.ast.name;
        this.scalarField = new Field(this.getParent(), fieldAst);
        this.scalarField.array = this.isArray();
        return this.scalarField;
    }
}

module.exports = Field;
