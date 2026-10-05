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

/**
 * The two name helpers the metamodel serializer used to take from
 * concerto-core's ModelUtil, inlined so that Concertino has no runtime
 * dependency on concerto-core (and so none on its engine). They give the
 * same results as ModelUtil.getShortName and ModelUtil.getNamespace.
 */

/**
 * The short name of a fully qualified type name (`a.b@1.0.0.Foo` gives `Foo`).
 * A name without a dot is returned unchanged.
 * @param {string} fqn - The fully qualified name.
 * @returns {string} The short name.
 */
export function getShortName(fqn: string): string {
    const i = fqn.lastIndexOf('.');
    return i < 0 ? fqn : fqn.substring(i + 1);
}

/**
 * The namespace of a fully qualified type name (`a.b@1.0.0.Foo` gives `a.b@1.0.0`).
 * A name without a dot has the empty namespace.
 * @param {string} fqn - The fully qualified name.
 * @returns {string} The namespace.
 */
export function getNamespace(fqn: string): string {
    if (!fqn) {
        throw new Error('Fully qualified name is null or undefined.');
    }
    const i = fqn.lastIndexOf('.');
    return i < 0 ? '' : fqn.substring(0, i);
}

const VERSIONED = /^([^@]+)@(.+)$/;

/**
 * Split a namespace into its name and version (`a.b@1.0.0` gives
 * `{ name: 'a.b', version: '1.0.0' }`).
 * @param {string} ns - The namespace.
 * @returns {object} The name and the version (`version` undefined when absent).
 */
export function parseNamespace(ns: string): { name: string; version?: string } {
    const m = VERSIONED.exec(ns);
    return m ? { name: m[1], version: m[2] } : { name: ns };
}

/** The Concerto primitive type names. */
export const PRIMITIVES = new Set(['String', 'Boolean', 'DateTime', 'Double', 'Integer', 'Long']);
