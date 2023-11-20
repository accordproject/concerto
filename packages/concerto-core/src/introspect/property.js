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


/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship. Properties may be array or be optional.
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
        super(parent.getModelFile(), ast);
        this.parent = parent;
        this.process();
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

        this.decorator = null;
        this.propertyType = null;

        switch (this.getMetaType()) {
        case `${MetaModelNamespace}.EnumProperty`:
            break;
        case `${MetaModelNamespace}.BooleanProperty`:
            this.propertyType = 'Boolean';
            break;
        case `${MetaModelNamespace}.DateTimeProperty`:
            this.propertyType = 'DateTime';
            break;
        case `${MetaModelNamespace}.DoubleProperty`:
            this.propertyType = 'Double';
            break;
        case `${MetaModelNamespace}.IntegerProperty`:
            this.propertyType = 'Integer';
            break;
        case `${MetaModelNamespace}.LongProperty`:
            this.propertyType = 'Long';
            break;
        case `${MetaModelNamespace}.StringProperty`:
            this.propertyType = 'String';
            break;
        case `${MetaModelNamespace}.ObjectProperty`:
            this.propertyType = this.ast.type ? this.ast.type.name : null;
            break;
        case `${MetaModelNamespace}.RelationshipProperty`:
            this.propertyType = this.ast.type.name;
            break;
        }
        this.array = false;

        if(this.ast.isArray) {
            this.array = true;
        }

        if(this.ast.isOptional) {
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

        if(this.propertyType) {
            classDecl.getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.propertyType);
        }
    }

    /**
     * Returns the type of a property.
     * @deprecated replaced by getPropertyType()
     * @return {string} the type of this property
     */
    getType() {
        return this.getPropertyType();
    }

    /**
     * Returns the type of a property. This will return either: a primitive type
     * name (String, Boolean, Integer etc) or the name of a non-primitive type,
     * or will return null if this is an enum property.
     *
     * Note this is NOT the same as getMetaType() which returns the meta type for the property.
     * @return {string|null} the type of this property or null if this is an enum property
     */
    getPropertyType() {
        return this.propertyType;
    }

    /**
     * Returns true if the field is optional
     * @return {boolean} true if the property is optional
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
            return this.propertyType;
        }

        const parent = this.getParent();
        if(!parent) {
            throw new Error('Property ' + this.name + ' does not have a parent.');
        }
        const modelFile = parent.getModelFile();
        if(!modelFile) {
            throw new Error('Parent of property ' + this.name + ' does not have a ModelFile!');
        }
        const result = modelFile.getFullyQualifiedTypeName(this.propertyType);
        if(!result) {
            throw new Error('Failed to find fully qualified type name for property ' + this.name + ' with type ' + this.propertyType );
        }

        return result;
    }

    /**
     * Returns the fully name of a property (ns + class name + property name)
     * @return {string} the fully qualified name of this property
     */
    getFullyQualifiedName() {
        return `${this.getParent().getFullyQualifiedName()}.${this.getName()}`;
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
     * @deprecated replaced by isPropertyEnum()
     * @return {boolean} true if the property is an enumerated value
     */
    isEnum() {
        return this.isPropertyEnum();
    }

    /**
     * Returns true if the field is declared as an enumerated value
     * @deprecated replaced by isPropertyEnum()
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum() {
        return this.isPropertyEnum();
    }

    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isPropertyEnum() {
        if(this.isPrimitive()) {
            return false;
        }
        else {
            const type = this.getModelFile().getType(this.getPropertyType());
            return type.isEnum();
        }
    }

    /**
     * Returns true if this property is a primitive type.
     * @return {boolean} true if the property is a primitive type.
     */
    isPrimitive() {
        return ModelUtil.isPrimitiveType(this.getPropertyType());
    }
}

module.exports = Property;
