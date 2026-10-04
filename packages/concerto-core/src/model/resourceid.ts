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
import { rust } from '../engineloader';

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
    toURI(): string {
        return rust.resourceIdToURI(this.namespace, this.type, this.id);
    }

}

/**
 * `ResourceId.fromURI` over many URIs at once, in one engine call: a
 * relationship-typed map's values are read with one crossing per map
 * rather than one per value.
 * @param {String[]} uris - Resource URIs, all read with the same legacy arguments.
 * @param {String} [legacyNamespace] - Namespace to use for legacy resource identifiers.
 * @param {String} [legacyType] - Type to use for legacy resource identifiers.
 * @return {Array} one ResourceId per URI, or `undefined` where the URI does
 * not parse (or has an empty part): the caller reads that one with
 * `ResourceId.fromURI`, which throws its error at the same point.
 * @internal
 */
export function resourceIdsFromURIs(uris: string[], legacyNamespace?: string, legacyType?: string): (ResourceId | undefined)[] {
    const fields = rust.resourceIdsFromURIs(uris, legacyNamespace, legacyType);
    const result: (ResourceId | undefined)[] = new Array(uris.length);
    for (let i = 0, at = 0; i < uris.length; i++, at += 3) {
        const namespace = fields[at], type = fields[at + 1], id = fields[at + 2];
        // An empty part is left to `fromURI`, whose constructor throws for it.
        result[i] = namespace && type && id ? new ResourceId(namespace, type, id) : undefined;
    }
    return result;
}

/**
 * `ResourceId.prototype.toURI` over many identifiers at once, in one engine
 * call: a relationship-typed map's values are written with one crossing per
 * map rather than one per value.
 * @param {String[]} fields - Three slots per identifier: namespace, type and id.
 * @return {Array} one URI per identifier, or `undefined` where it is not
 * valid: the caller writes that one the usual way, which throws its error.
 * @internal
 */
export function resourceIdsToURIs(fields: unknown[]): (string | undefined)[] {
    return rust.resourceIdsToURIs(fields);
}

export { ResourceId };
export default ResourceId;
