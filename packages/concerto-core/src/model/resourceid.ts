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

import ModelUtils from '../modelutil';

const RESOURCE_SCHEME = 'resource';

/**
 * Parse a URI into its component parts. Implements the subset of the
 * generic URI parsing algorithm (RFC 3986) that ResourceId relies on:
 * fragment, query, scheme, and authority (userinfo/host/port), leaving
 * the remainder as the path.
 * @param {String} uri - The URI to parse.
 * @returns {Object} An object with protocol, username, password, port,
 * query, fragment and path properties.
 * @throws {Error} If the authority contains a non-numeric port.
 * @private
 */
function parseUri(uri: string) {
    let s = uri;
    let fragment: string | null = null;
    let query: string | null = null;
    let protocol: string | null = null;
    let username: string | null = null;
    let password: string | null = null;
    let port: string | null = null;

    // fragment: split on the first '#'
    const hashPos = s.indexOf('#');
    if (hashPos > -1) {
        fragment = s.substring(hashPos + 1) || null;
        s = s.substring(0, hashPos);
    }

    // query: split on the first '?'
    const qPos = s.indexOf('?');
    if (qPos > -1) {
        query = s.substring(qPos + 1);
        s = s.substring(0, qPos);
    }

    // scheme: only recognised if the remainder does not start with '//'
    if (s.substring(0, 2) !== '//') {
        const colonPos = s.indexOf(':');
        if (colonPos > -1) {
            const candidate = s.substring(0, colonPos);
            if (/^[a-z][a-z0-9.+-]*$/i.test(candidate)) {
                protocol = candidate.toLowerCase();
                s = s.substring(colonPos + 1);
            }
        }
    }

    // authority: only present if the remainder starts with '//'
    if (s.substring(0, 2) === '//') {
        s = s.substring(2);
        const slashPos = s.indexOf('/');
        const authority = slashPos > -1 ? s.substring(0, slashPos) : s;
        s = slashPos > -1 ? s.substring(slashPos) : '';
        let hostport = authority;
        const atPos = authority.indexOf('@');
        if (atPos > -1) {
            const userinfo = authority.substring(0, atPos);
            hostport = authority.substring(atPos + 1);
            const uColon = userinfo.indexOf(':');
            if (uColon > -1) {
                username = userinfo.substring(0, uColon);
                password = userinfo.substring(uColon + 1);
            } else {
                username = userinfo;
            }
        }
        const pColon = hostport.lastIndexOf(':');
        if (pColon > -1) {
            const maybePort = hostport.substring(pColon + 1);
            if (maybePort !== '') {
                if (!/^[0-9]+$/.test(maybePort)) {
                    throw new Error('Invalid port');
                }
                port = maybePort;
            }
        }
    }

    const path = s;
    return { protocol, username, password, port, query, fragment, path };
}

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
        let uriComponents;
        try {
            uriComponents = parseUri(uri);
        } catch (err){
            throw new Error('Invalid URI: ' + uri);
        }

        const scheme = uriComponents.protocol;
        // Accept legacy identifiers with missing URI scheme as valid
        if (scheme && scheme !== RESOURCE_SCHEME) {
            throw new Error('Invalid URI scheme: ' + uri);
        }
        if (uriComponents.username || uriComponents.password || uriComponents.port || uriComponents.query) {
            throw new Error('Invalid resource URI format: ' + uri);
        }

        let namespace, type;
        let id = uriComponents.fragment;
        if (!id) {
            // Legacy format where the whole path is the ID
            namespace = legacyNamespace;
            type = legacyType;
            id = uriComponents.path;
        } else {
            const qualifiedType = uriComponents.path;
            namespace = ModelUtils.getNamespace(qualifiedType);
            type = ModelUtils.getShortName(qualifiedType);
        }

        return new ResourceId(namespace, type, decodeURIComponent(id));
    }

    /**
     * URI representation of this identifier.
     * @return {String} A URI.
     */
    toURI() {
        const qualifiedType = ModelUtils.getFullyQualifiedName(this.namespace, this.type);
        return RESOURCE_SCHEME + ':' +  qualifiedType + '#' + encodeURI(this.id);
    }

}

export { ResourceId };
export default ResourceId;
