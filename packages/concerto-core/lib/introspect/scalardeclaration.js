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
const Util = require('../util');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Validator = require('./validator');
    const ClassDeclaration = require('./classdeclaration');
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

        this.superType = null;
        this.superTypeDeclaration = null;
        this.idField = null;
        this.timestamped = false;
        this.abstract = false;
        this.validator = null;

        if (this.ast.$class === `${MetaModelNamespace}.BooleanScalar`) {
            this.type = 'Boolean';
        } else if (this.ast.$class === `${MetaModelNamespace}.IntegerScalar`) {
            this.type = 'Integer';
        } else if (this.ast.$class === `${MetaModelNamespace}.LongScalar`) {
            this.type = 'Long';
        } else if (this.ast.$class === `${MetaModelNamespace}.DoubleScalar`) {
            this.type = 'Double';
        } else if (this.ast.$class === `${MetaModelNamespace}.StringScalar`) {
            this.type = 'String';
        } else if (this.ast.$class === `${MetaModelNamespace}.DateTimeScalar`) {
            this.type = 'DateTime';
        } else {
            this.type = null;
        }

        switch(this.getType()) {
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

        if(!Util.isNull(this.ast.defaultValue)) {
            this.defaultValue = this.ast.defaultValue;
        } else {
            this.defaultValue = null;
        }
    }

    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        super.validate();
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isIdentified() {
        return false;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isSystemIdentified() {
        return false;
    }

    /**
     * Returns null as scalars are never identified.
     * @return {string} as scalars are never identified
     * @deprecated
     */
    getIdentifierFieldName() {
        return null;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType() {
        return this.type;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     * @deprecated
     */
    getSuperType() {
        return null;
    }

    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     * @deprecated
     */
    getSuperTypeDeclaration() {
        return null;
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
        if(!Util.isNull(this.ast.defaultValue)) {
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
        return 'ScalarDeclaration {id=' + this.getFullyQualifiedName() + '}';
    }

    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     * @deprecated
     */
    isAbstract() {
        return true;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration() {
        return true;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     * @deprecated
     */
    isAsset() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     * @deprecated
     */
    isParticipant() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     * @deprecated
     */
    isTransaction() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     * @deprecated
     */
    isEvent() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     * @deprecated
     */
    isConcept() {
        return false;
    }

}

module.exports = ScalarDeclaration;
