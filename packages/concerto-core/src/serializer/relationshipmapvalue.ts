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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type MapDeclaration from '../introspect/mapdeclaration';
/* eslint-enable no-unused-vars */

/**
 * The relationship a map holds when its value type is a relationship (`map
 * M { o String --> T }`), with the members of a RelationshipDeclaration
 * that the serializer's relationship code reads (BC-05; DV-007).
 * JSONPopulator, JSONGenerator and ResourceValidator hand it to their
 * relationship-property code, so a map value is read, written and validated
 * as a `--> T` property is, under the same
 * `acceptResourcesForRelationships`, `convertResourcesToRelationships` and
 * `permitResourcesForRelationships` options.
 * @private
 */
export interface RelationshipMapValue {
    getName(): string;
    getNamespace(): string;
    getFullyQualifiedTypeName(): string;
    isArray(): boolean;
    toString(): string;
}

/**
 * The relationship a map's values hold, or `null` when the map's value type
 * is not a relationship.
 * @param {MapDeclaration} mapDeclaration - the map declaration
 * @return {RelationshipMapValue|null} the relationship, or null
 * @private
 */
export function getRelationshipMapValue(mapDeclaration: MapDeclaration): RelationshipMapValue | null {
    const value = mapDeclaration.getValue();
    // The value node's metamodel `$class`, by its short name.
    if (String(value.ast.$class).split('.').pop() !== 'RelationshipMapValueType') {
        return null;
    }
    // Resolved on first use, in the map's own model file (honouring its
    // imports), as a relationship property's type is.
    let typeName: string | undefined;
    const getFullyQualifiedTypeName = (): string =>
        typeName ?? (typeName = mapDeclaration.getModelFile().getFullyQualifiedTypeName(value.getType()) as string);
    return {
        getName: () => mapDeclaration.getName(),
        getNamespace: mapDeclaration.getNamespace.bind(mapDeclaration),
        getFullyQualifiedTypeName,
        isArray: () => false,
        toString: () => `RelationshipMapValueType {map=${mapDeclaration.getFullyQualifiedName()}, type=${getFullyQualifiedTypeName()}}`,
    };
}
