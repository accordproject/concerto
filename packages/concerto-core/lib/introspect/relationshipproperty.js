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
const IllegalModelException = require('./illegalmodelexception');
const ModelUtil = require('../modelutil');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ClassDeclaration = require('./classdeclaration');
}
/* eslint-enable no-unused-vars */

/**
 * Class representing a relationship between model elements
 * @extends Property
 * @see See  {@link Property}
 *
 * @class
 * @memberof module:concerto-core
 */
class RelationshipProperty extends Property {
    /**
     * Create a Relationship.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        super(parent, ast);
    }

    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    validate(classDecl) {
        super.validate(classDecl);
        // relationship cannot point to primitive types
        if(!this.getPropertyType()) {
            throw new IllegalModelException('Relationship must have a type', classDecl.getModelFile(), this.ast.location);
        }

        let classDeclaration = null;

        // you can't have a relationship with a primitive...
        if(ModelUtil.isPrimitiveType(this.getPropertyType())) {
            throw new IllegalModelException('Relationship ' + this.getName() + ' cannot be to the primitive type ' + this.getType(), classDecl.getModelFile(), this.ast.location );
        } else {
            let namespace = this.getParent().getNamespace();

            // we first try to get the type from our own model file
            // because during validate we have not yet been added to the model manager
            if(namespace === ModelUtil.getNamespace(this.getFullyQualifiedTypeName())) {
                classDeclaration = this.getParent().getModelFile().getType(this.getType());
            }
            else {
                // otherwise we have to use the modelmanager to try to load
                try {
                    classDeclaration = this.getParent().getModelFile().getModelManager().getType(this.getFullyQualifiedTypeName());
                } catch (err) {
                    // Let classDeclaration remain null and get handled below
                }
            }

            if(classDeclaration === null) {
                throw new IllegalModelException('Relationship ' + this.getName() + ' points to a missing type ' + this.getFullyQualifiedTypeName(), classDecl.getModelFile(), this.ast.location);
            }

            if (classDeclaration.isIdentified()) {
                // Relationship to a class with an identifier continue
            } else {
                throw new IllegalModelException('Relationship ' + this.getName() + ' must be to a class that has an identifier, but this is to ' + this.getFullyQualifiedTypeName(), classDecl.getModelFile(), this.ast.location);
            }
        }
    }

    /**
     * Returns a string representation of this property
     * @return {String} the string version of the property.
     */
    toString() {
        return 'RelationshipProperty {name=' + this.name + ', type=' + this.getFullyQualifiedTypeName() + ', array=' + this.array + ', optional=' + this.optional +'}';
    }
}

module.exports = RelationshipProperty;
