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

import { MetaModelNamespace } from '@accordproject/concerto-metamodel';

import ModelUtil from '../modelutil';
import IllegalModelException from './illegalmodelexception';
import Decorated from './decorated';
import CollectionSizeValidator from './collectionsizevalidator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ClassDeclaration from './classdeclaration';
import type ModelFile from './modelfile';
import type Decorator from './decorator';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */


/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship.
 *
 * @class
 * @memberof module:concerto-core
 */
class Property extends Decorated {
    parent: ClassDeclaration;
    // Populated by process(), which this class's constructor calls, so these
    // carry definite assignment assertions rather than initialisers -- an
    // initialiser here would run before process() and be overwritten anyway.
    name!: string;
    /**
     * Vestigial: only ever set to null, never read. Retained for compatibility.
     */
    decorator!: Decorator | null;
    type!: string | null;
    array!: boolean;
    sizeValidator!: CollectionSizeValidator | null;
    optional!: boolean;
    /**
     * Create a Property.
     * @param {ClassDeclaration} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode) {
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
    getModelFile(): ModelFile {
        return this.parent.getModelFile();
    }

    /**
     * Returns the owner of this property
     * @return {ClassDeclaration} the parent class declaration
     */
    getParent(): ClassDeclaration {
        return this.parent;
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        if (!ModelUtil.isValidIdentifier(this.ast.name)){
            throw new IllegalModelException(`Invalid property name '${this.ast.name}'`, this.getModelFile(), this.ast.location);
        }

        this.name = this.ast.name;
        this.decorator = null;

        if(!this.name) {
            throw new Error('No name for type ' + JSON.stringify(this.ast));
        }

        switch (this.ast.$class) {
        case `${MetaModelNamespace}.EnumProperty`:
            break;
        case `${MetaModelNamespace}.BooleanProperty`:
            this.type = 'Boolean';
            break;
        case `${MetaModelNamespace}.DateTimeProperty`:
            this.type = 'DateTime';
            break;
        case `${MetaModelNamespace}.DoubleProperty`:
            this.type = 'Double';
            break;
        case `${MetaModelNamespace}.IntegerProperty`:
            this.type = 'Integer';
            break;
        case `${MetaModelNamespace}.LongProperty`:
            this.type = 'Long';
            break;
        case `${MetaModelNamespace}.StringProperty`:
            this.type = 'String';
            break;
        case `${MetaModelNamespace}.ObjectProperty`:
            this.type = this.ast.type ? this.ast.type.name : null;
            break;
        case `${MetaModelNamespace}.RelationshipProperty`:
            this.type = this.ast.type.name;
            break;
        }
        this.array = false;

        if(this.ast.isArray) {
            this.array = true;
        }

        this.sizeValidator = this.ast.sizeValidator
            ? new CollectionSizeValidator(this, this.ast.sizeValidator)
            : null;

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
    validate(classDecl: ClassDeclaration) {
        super.validate();

        if(this.type) {
            classDecl.getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.type);
        }

        if(this.sizeValidator && !this.array) {
            let isMapType = false;
            if(this.type && !this.isPrimitive()) {
                try {
                    const resolvedType = classDecl.getModelFile().getType(this.type);
                    isMapType = resolvedType.isMapDeclaration?.() === true;
                } catch(e) {
                    // type resolution failed — will be caught by other validation
                }
            }
            if(!isMapType) {
                throw new IllegalModelException(
                    `size validator can only be applied to array or map properties: ${this.getFullyQualifiedName()}`,
                    classDecl.getModelFile(),
                    this.ast.location
                );
            }
        }
    }

    /**
     * Returns the name of a property
     * @return {string} the name of this field
     */
    getName(): string {
        return this.name;
    }

    /**
     * Returns the type of a property
     * @return {string} the type of this field
     */
    getType(): string | null {
        return this.type;
    }

    /**
     * Returns true if the field is optional
     * @return {boolean} true if the field is optional
     */
    isOptional(): boolean {
        return this.optional;
    }

    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName(): string {
        if(this.isPrimitive()) {
            // isPrimitive() is only true when this.type is a primitive type name
            return this.type as string;
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
    getFullyQualifiedName(): string {
        return this.getParent().getFullyQualifiedName() + '.' + this.getName();
    }

    /**
     * Returns the namespace of the parent of this property
     * @return {string} the namespace of the parent of this property
     */
    getNamespace(): string {
        return this.getParent().getNamespace();
    }

    /**
     * Returns true if the field is declared as an array type
     * @return {boolean} true if the property is an array type
     */
    isArray(): boolean {
        return this.array;
    }

    /**
     * Returns the collection size validator for this property, if one exists.
     * @return {CollectionSizeValidator|null} the validator or null
     */
    getSizeValidator(): CollectionSizeValidator | null {
        return this.sizeValidator;
    }


    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum(): boolean {
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
    isPrimitive(): boolean {
        return ModelUtil.isPrimitiveType(this.getType());
    }
}

export { Property };
export default Property;
