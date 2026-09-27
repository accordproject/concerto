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

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). Same non-literal
// loadEngine as src/modelutil.ts: a bundler must never see a specifier it
// would resolve (PORTING.md 1.5).
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('../engine').rust;

/**
 * All the identifying properties of a resource.
 * @private
 * @class
 * @memberof module:concerto-core
 * @property {String} namespace
 * @property {String} type
 * @property {String} id
 */
class ResourceId {
    namespace: string;
    type: string;
    id: string;
    /**
     * <strong>Note: only for use by internal framework code.</strong>
     * @param {String} namespace - Namespace containing the type.
     * @param {String} type - Short type name.
     * @param {String} id - Instance identifier.
     * @private
     */
    constructor(namespace, type, id) {
        if (!namespace) {
            throw new Error('Missing namespace');
        }
        if (!type) {
            throw new Error('Missing type');
        }
        if (!id) {
            throw new Error('Missing id');
        }

        this.namespace = namespace;
        this.type = type;
        this.id = id;
    }

    /**
     * Parse a URI into an identifier.
     * <p>
     * Three formats are allowable:
     * <ol>
     *   <li>Valid resource URI argument: <em>resource:qualifiedTypeName#ID</em></li>
     *   <li>Valid resource URI argument with missing URI scheme: <em>qualifiedTypeName#ID</em></li>
     *   <li>URI argument containing only an ID, with legacy namespace and type arguments supplied.</li>
     * </ol>
     * @param {String} uri - Resource URI.
     * @param {String} [legacyNamespace] - Namespace to use for legacy resource identifiers.
     * @param {String} [legacyType] - Type to use for legacy resource identifiers.
     * @return {Identifier} - An identifier.
     * @throws {Error} - On an invalid resource URI.
     */
    static fromURI(uri, legacyNamespace?, legacyType?) {
        const result: { namespace: string, type: string, id: string } = rust.resourceIdFromURI(uri, legacyNamespace, legacyType) as any;
        return new ResourceId(result.namespace, result.type, result.id);
    }

    /**
     * URI representation of this identifier.
     * @return {String} A URI.
     */
    toURI() {
        return rust.resourceIdToURI(this.namespace, this.type, this.id);
    }

}

export { ResourceId };
export default ResourceId;
