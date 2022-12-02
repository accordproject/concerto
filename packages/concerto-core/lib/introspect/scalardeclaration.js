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

const Decorated = require('./decorated');
const IllegalModelException = require('./illegalmodelexception');
const ModelUtil = require('../modelutil');
const NumberValidator = require('./numbervalidator');
const StringValidator = require('./stringvalidator');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
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
class ScalarDeclaration extends Decorated {
    /**
     * Create a ScalarDeclaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        super(ast);
        this.modelFile = modelFile;
        this.process();
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.modelFile;
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        this.name = this.ast.name;
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
            if(this.ast.validator) {
                this.validator = new StringValidator(this, this.ast.validator);
            }
            break;
        }

        if(this.ast.defaultValue) {
            this.defaultValue = this.ast.defaultValue;
        } else {
            this.defaultValue = null;
        }

        this.fqn = ModelUtil.getFullyQualifiedName(this.modelFile.getNamespace(), this.name);
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

        const declarations = this.getModelFile().getAllDeclarations();
        for (let n = 0; n < declarations.length; n++) {
            let declaration = declarations[n];

            // check we don't have an asset with the same name
            for (let i = n + 1; i < declarations.length; i++) {
                let otherDeclaration = declarations[i];
                if (declaration.getFullyQualifiedName() === otherDeclaration.getFullyQualifiedName()) {
                    throw new IllegalModelException(`Duplicate class name ${declaration.getName()}`);
                }
            }
        }
    }

    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName() {
        return this.name;
    }

    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace() {
        return this.modelFile.getNamespace();
    }

    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName() {
        return this.fqn;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isIdentified() {
        return false;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isSystemIdentified() {
        return false;
    }

    /**
     * Returns null as scalars are never identified.
     * @return {null} null, as scalars are never identified
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
     * Throws an error as scalars do not have supertypes.
     */
    getSuperType() {
        throw new Error('Scalars do not have super types.');
    }

    /**
     * Get the super type class declaration for this class.
     * @return {ScalarDeclaration | null} the super type declaration, or null if there is no super type.
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
        return 'ScalarDeclaration {id=' + this.getFullyQualifiedName() + '}';
    }

    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract() {
        return true;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     */
    isParticipant() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     */
    isTransaction() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     */
    isEvent() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration() {
        return true;
    }
}

module.exports = ScalarDeclaration;
