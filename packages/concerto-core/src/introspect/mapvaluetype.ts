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

import Decorated from './decorated';
import { MetaModelNamespace } from '@accordproject/concerto-metamodel';
import IllegalModelException from './illegalmodelexception';
import ModelUtil from '../modelutil';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './modelfile';
import type MapDeclaration from './mapdeclaration';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */

/**
 * MapValueType defines a Value type of MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapValueType extends Decorated {
    parent: MapDeclaration;
    modelFile: ModelFile;
    // Populated by process(), which this class's constructor calls.
    type!: string;
    /**
     * Create an MapValueType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: MapDeclaration, ast: AstNode) {
        super(ast);
        this.parent = parent;
        this.modelFile = parent.getModelFile();
        this.process();
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();
        this.processType(this.ast);
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        if (!ModelUtil.isPrimitiveType(this.type)) {

            const decl = this.modelFile.getType(this.ast.type.name);

            if (!decl) {
                if (this.isRelationship()) {
                    const targetName = this.getFullyQualifiedTypeName() || `${this.getNamespace()}.${this.type}`;
                    throw new IllegalModelException(
                        `Relationship ${this.getName()} points to a missing type ${targetName}`,
                        this.modelFile,
                        this.ast.location
                    );
                } else {
                    this.modelFile.resolveType(
                        `map ${this.parent.getFullyQualifiedName()}`,
                        this.type,
                        this.ast.location
                    );
                }
            }

            // All declarations, with the exception of MapDeclarations, are valid Values.
            if(decl.isMapDeclaration?.()) {
                throw new IllegalModelException(
                    `MapDeclaration as Map Type Value is not supported: ${this.type}`
                );
            }

            if(this.isRelationship() && !decl.isIdentified?.()) {
                throw new IllegalModelException(
                    `Relationship ${this.getName()} must be to a class that has an identifier, but this is to ${this.getFullyQualifiedTypeName()}`,
                    this.modelFile,
                    this.ast.location
                );
            }
        }
    }

    /**
     * Sets the Type name for the Map Value
     *
     * @param {Object} ast - The AST created by the parser
     * @private
     */
    processType(ast: AstNode) {
        let decl;
        switch(this.ast.$class) {
        case `${MetaModelNamespace}.ObjectMapValueType`:
        case `${MetaModelNamespace}.RelationshipMapValueType`:

            // ObjectMapValueType must have TypeIdentifier.
            if (!('type' in ast)) {
                throw new IllegalModelException(`ObjectMapValueType must contain property 'type', for MapDeclaration named ${this.parent.name}`);
            }

            // ObjectMapValueType TypeIdentifier must be properly formed.
            if (!('$class' in ast.type) || !('name' in ast.type)) {
                throw new IllegalModelException(`ObjectMapValueType type must contain property '$class' and property 'name', for MapDeclaration named ${this.parent.name}`);
            }

            // And the $class must be valid.
            if (ast.type.$class !== 'concerto.metamodel@1.0.0.TypeIdentifier') {
                throw new IllegalModelException(`ObjectMapValueType type $class must be of TypeIdentifier for MapDeclaration named ${this.parent.name}`);
            }

            this.type = String(this.ast.type.name); // cast for correct type resolution in generated types.

            break;
        case `${MetaModelNamespace}.BooleanMapValueType`:
            this.type = 'Boolean';
            break;
        case `${MetaModelNamespace}.DateTimeMapValueType`:
            this.type = 'DateTime';
            break;
        case `${MetaModelNamespace}.StringMapValueType`:
            this.type = 'String';
            break;
        case `${MetaModelNamespace}.IntegerMapValueType`:
            this.type = 'Integer';
            break;
        case `${MetaModelNamespace}.LongMapValueType`:
            this.type = 'Long';
            break;
        case `${MetaModelNamespace}.DoubleMapValueType`:
            this.type = 'Double';
            break;
        }
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
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent(): MapDeclaration {
        return this.parent;
    }

    /**
     * Returns the Type of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType(): string {
        return this.type;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string {
        return 'MapValueType {id=' + this.getType() + '}';
    }

    /**
     * Returns true if this class is the definition of a Map Key.
     *
     * @return {boolean} true if the class is a Map Key
     */
    isKey(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a Map Value.
     *
     * @return {boolean} true if the class is a Map Value
     */
    isValue(): boolean {
        return true;
    }

    /**
     * Returns the name of the parent map.
     *
     * @return {string} the name of the parent map
     */
    getName(): string {
        return this.parent.getName();
    }

    /**
     * Returns the fully qualified type of this map value.
     * @return {string} the fully qualified type name
     */
    getFullyQualifiedTypeName(): string {
        if (ModelUtil.isPrimitiveType(this.type)) {
            return this.type;
        }

        return this.getModelFile().getFullyQualifiedTypeName(this.type);
    }

    /**
     * Returns true if this class is the definition of a relationship.
     *
     * @return {boolean} true if the class is a relationship
     */
    isRelationship(): boolean {
        return this.ast.$class === `${MetaModelNamespace}.RelationshipMapValueType`;
    }

    /**
     * Return the namespace of this map value.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string {
        return this.modelFile.getNamespace();
    }
}

export { MapValueType };
export default MapValueType;
