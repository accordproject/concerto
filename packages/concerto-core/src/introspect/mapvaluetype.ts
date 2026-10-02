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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './modelfile';
import type MapDeclaration from './mapdeclaration';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). See property.ts's own
// copy of this comment for the bundler/webpack reasoning this loader relies
// on.
import { createRequire } from 'module';
import type { EngineBindings } from '../engine/bindings';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: EngineBindings = loadEngine('../engine').rust;

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
        // P5-10b: from the file's view snapshot when it has it.
        this.type = loadEngine('../engine/views').mapValueTypeProcess(this);
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        rust.mapValueTypeValidate(this);
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
     * Return the namespace of this map value.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string {
        return this.modelFile.getNamespace();
    }
}

export { MapValueType };
export default MapValueType;
