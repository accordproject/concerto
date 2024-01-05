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

const Declaration = require('./declaration');
const NumberValidator = require('./numbervalidator');
const StringValidator = require('./stringvalidator');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Validator = require('./validator');
}
/* eslint-enable no-unused-vars */

/**
 * ScalarDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ScalarDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class ScalarDeclaration extends Declaration {
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        this.validator = null;
        this.scalarType = null;

        if (this.ast.$class === `${MetaModelNamespace}.BooleanScalar`) {
            this.scalarType = 'Boolean';
        } else if (this.ast.$class === `${MetaModelNamespace}.IntegerScalar`) {
            this.scalarType = 'Integer';
        } else if (this.ast.$class === `${MetaModelNamespace}.LongScalar`) {
            this.scalarType = 'Long';
        } else if (this.ast.$class === `${MetaModelNamespace}.DoubleScalar`) {
            this.scalarType = 'Double';
        } else if (this.ast.$class === `${MetaModelNamespace}.StringScalar`) {
            this.scalarType = 'String';
        } else if (this.ast.$class === `${MetaModelNamespace}.DateTimeScalar`) {
            this.scalarType = 'DateTime';
        }

        switch(this.scalarType) {
        case 'Integer':
        case 'Double':
        case 'Long':
            if(this.ast.validator) {
                this.validator = new NumberValidator(this, this.ast.validator);
            }
            break;
        case 'String':
            if(this.ast.validator || this.ast.lengthValidator) {
                this.validator = new StringValidator(this, this.ast.validator, this.ast.lengthValidator);
            }
            break;
        }

        if(this.ast.defaultValue) {
            this.defaultValue = this.ast.defaultValue;
        } else {
            this.defaultValue = null;
        }
    }

    /**
     * Returns the underlying primitive type of this scalar
     *
     * @return {string} the type of the scalar (String, Integer, Long etc.)
     */
    getScalarType() {
        return this.scalarType;
    }

    /**
     * Returns the validator string for this scalar definition
     * @return {Validator} the validator for the field or null
     */
    getValidator() {
        return this.validator;
    }

    /**
     * Returns the default value for the field or null
     * @return {string | number | null} the default value for the field or null
     */
    getDefaultValue() {
        if(this.defaultValue) {
            return this.defaultValue;
        }
        else {
            return null;
        }
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        return 'ScalarDeclaration {id=' + this.getFullyQualifiedName() +
        ' scalarType=' + this.scalarType + '}';
    }
}

module.exports = ScalarDeclaration;
