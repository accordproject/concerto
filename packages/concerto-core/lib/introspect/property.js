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

const ModelUtil = require('../modelutil');
const Decorated = require('./decorated');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ClassDeclaration = require('./classdeclaration');
    const ModelFile = require('./modelfile');
}
/* eslint-enable no-unused-vars */


const RESERVED_PROPERTY_NAMES = ['null', 'true', 'false'];

/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship.
 *
 * @class
 * @memberof module:concerto-core
 */
class Property extends Decorated {
    /**
     * Create a Property.
     * @param {ClassDeclaration} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        super(ast);
        this.parent = parent;
        this.process();
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.parent.getModelFile();
    }

    /**
     * Returns the owner of this property
     * @return {ClassDeclaration} the parent class declaration
     */
    getParent() {
        return this.parent;
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        if (RESERVED_PROPERTY_NAMES.includes(this.ast.name)){
            throw new Error(`Validator error for field 'name'. '${this.ast.name}' is a reserved name.`);
        }

        this.name = this.ast.name;
        this.decorator = null;

        if(!this.name) {
            throw new Error('No name for type ' + JSON.stringify(this.ast));
        }

        // if this object property references a scalar
        // then replace the scalar with an equivalent property
        // i.e. we unbox the scalar here.
        let ast = this.ast;
        if(
            ast?.type &&
          ast.$class === `${MetaModelNamespace}.ObjectProperty`
        ) {
            const type = this.getModelFile().getType(ast.type.name);
            if(type) {
                if(type?.isScalarDeclaration?.()) {
                    ast = type.ast;
                }
            }
        }

        if (ast.$class === `${MetaModelNamespace}.BooleanProperty`) {
            this.type = 'Boolean';
        } else if (ast.$class === `${MetaModelNamespace}.StringProperty`) {
            this.type = 'String';
        } else if (ast.$class === `${MetaModelNamespace}.IntegerProperty`) {
            this.type = 'Integer';
        } else if (ast.$class === `${MetaModelNamespace}.LongProperty`) {
            this.type = 'Long';
        } else if (ast.$class === `${MetaModelNamespace}.DoubleProperty`) {
            this.type = 'Double';
        } else if (ast.$class === `${MetaModelNamespace}.DateTimeProperty`) {
            this.type = 'DateTime';
        } else if (ast.$class === `${MetaModelNamespace}.ObjectProperty`) {
            this.type = ast.type ? ast.type.name : null;
        } else if (ast.$class === `${MetaModelNamespace}.RelationshipProperty`) {
            this.type = ast.type.name;
        } else {
            this.type = null;
        }
        this.array = false;

        if(ast.isArray) {
            this.array = true;
        }

        if(ast.isOptional) {
            this.optional = true;
        }
        else {
            this.optional = false;
        }
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
        }
    }

    /**
     * Returns the name of a property
     * @return {string} the name of this field
     */
    getName() {
        return this.name;
    }

    /**
     * Returns the type of a property
     * @return {string} the type of this field
     */
    getType() {
        return this.type;
    }

    /**
     * Returns true if the field is optional
     * @return {boolean} true if the field is optional
     */
    isOptional() {
        return this.optional;
    }

    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName() {
        if(this.isPrimitive()) {
            return this.type;
        }

        const parent = this.getParent();
        if(!parent) {
            throw new Error('Property ' + this.name + ' does not have a parent.');
        }
        const modelFile = parent.getModelFile();
        if(!modelFile) {
            throw new Error('Parent of property ' + this.name + ' does not have a ModelFile!');
        }

        const result = modelFile.getFullyQualifiedTypeName(this.type);
        if(!result) {
            throw new Error('Failed to find fully qualified type name for property ' + this.name + ' with type ' + this.type );
        }

        return result;
    }

    /**
     * Returns the fully name of a property (ns + class name + property name)
     * @return {string} the fully qualified name of this property
     */
    getFullyQualifiedName() {
        return this.getParent().getFullyQualifiedName() + '.' + this.getName();
    }

    /**
     * Returns the namespace of the parent of this property
     * @return {string} the namespace of the parent of this property
     */
    getNamespace() {
        return this.getParent().getNamespace();
    }

    /**
     * Returns true if the field is declared as an array type
     * @return {boolean} true if the property is an array type
     */
    isArray() {
        return this.array;
    }


    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum() {
        if(this.isPrimitive()) {
            return false;
        }
        else {
            const type = this.getParent().getModelFile().getType(this.getType());
            return type.isEnum();
        }
    }

    /**
     * Returns true if this property is a primitive type.
     * @return {boolean} true if the property is a primitive type.
     */
    isPrimitive() {
        return ModelUtil.isPrimitiveType(this.getType());
    }
}

module.exports = Property;
