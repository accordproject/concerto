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

import Declaration from './declaration';
import MapValueType from './mapvaluetype';
import MapKeyType from './mapkeytype';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './modelfile';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */
import { engineViews } from '../engineloader';

/**
 * MapDeclaration defines a Map data structure, which allows storage of a collection
 * of values, where each value is associated and indexed with a unique key.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapDeclaration extends Declaration {
    // Populated by process(), which the Declaration constructor calls, so these
    // carry definite assignment assertions rather than initialisers.
    key!: MapKeyType;
    value!: MapValueType;
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: AstNode) {
        super(modelFile, ast);
        this.modelFile = modelFile;
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

        // P5-10b: the `mapDeclarationProcess` check, then the key and value
        // types, which a lazily built file builds on first read
        // (engine/views.ts `mapDeclarationProcess`).
        const key = this.ast.key;
        const value = this.ast.value;
        engineViews().mapDeclarationProcess(
            this,
            () => new MapKeyType(this, key),
            () => new MapValueType(this, value),
        );
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        super.validate();
        this.key.validate();
        this.value.validate();
    }

    /**
     * Returns the type of the Map key property.
     *
     * @return {MapKeyType} the Map key property
     */
    getKey(): MapKeyType {
        return this.key;
    }

    /**
     * Returns the type of the Map Value property.
     *
     * @return {MapValueType} the Map Value property
     */
    getValue(): MapValueType {
        return this.value;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string {
        return 'MapDeclaration {id=' + this.getFullyQualifiedName() + '}';
    }

    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string {
        return 'MapDeclaration';
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isMapDeclaration(): boolean {
        return true;
    }
}

// P5-10b: built on first read in a lazily built file (engine/views.ts).
engineViews().installLazyField(MapDeclaration.prototype, 'key');
engineViews().installLazyField(MapDeclaration.prototype, 'value');

export { MapDeclaration };
export default MapDeclaration;
