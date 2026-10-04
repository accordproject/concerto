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

import Resource from '../model/resource';
import Identifiable from '../model/identifiable';
import { resourceIdsToURIs } from '../model/resourceid';
import Typed from '../model/typed';
import ModelUtil from '../modelutil';
import { NullUtil as Util } from '@accordproject/concerto-util';
import { getRelationshipMapValue } from './relationshipmapvalue';

/**
 * Converts the contents of a Resource to JSON. The parameters
 * object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with a Resource.
 * 'modelManager' - the ModelManager to use.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class JSONGenerator {
    convertResourcesToRelationships: boolean | undefined;
    permitResourcesForRelationships: boolean | undefined;
    deduplicateResources: boolean | undefined;
    convertResourcesToId: boolean | undefined;
    utcOffset: number;

    /**
     * Constructor.
     * @param {boolean} [convertResourcesToRelationships] Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [permitResourcesForRelationships] Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [deduplicateResources] If resources appear several times
     * in the object graph only the first instance is serialized, with only the $id
     * written for subsequent instances, false by default.
     * @param {boolean} [convertResourcesToId] Convert resources that
     * @param {boolean} [ergo] - Deprecated - This is a dummy parameter to avoid breaking any consumers. It will be removed in a future release.
     * are specified for relationship fields into their id, false by default.
     * @param {number} [utcOffset] UTC Offset for DateTime values.
     */
    constructor(convertResourcesToRelationships?: boolean, permitResourcesForRelationships?: boolean, deduplicateResources?: boolean, convertResourcesToId?: boolean, ergo?: boolean, utcOffset?: number) {
        this.convertResourcesToRelationships = convertResourcesToRelationships;
        this.permitResourcesForRelationships = permitResourcesForRelationships;
        this.deduplicateResources = deduplicateResources;
        this.convertResourcesToId = convertResourcesToId;
        this.utcOffset = utcOffset || 0;
    }

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        }else if (thing.isMapDeclaration?.()) {
            return this.visitMapDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else {
            // BC-08: name the element; JSON.stringify of an introspection
            // object can throw a circular-structure TypeError (DV-010).
            const name = typeof thing?.getFullyQualifiedName === 'function' ? thing.getFullyQualifiedName() : JSON.stringify(thing);
            throw new Error(`Unrecognised element "${name}"`);
        }
    }

    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration, parameters) {
        const obj = parameters.stack.pop();

        // initialise Map with $class property
        let map = new Map();

        // BC-05, DV-007: written as a relationship property, not a concept.
        const relationship = getRelationshipMapValue(mapDeclaration);
        let uris: (string | undefined)[] | undefined;
        let index = -1;

        obj.forEach((value, key) => {
            index++;

            // don't serialize System Properties, other than $class
            if(ModelUtil.isSystemProperty(key)) {
                return;
            }

            if (relationship) {
                const uri = (uris ?? (uris = relationshipMapURIs(this, obj)))[index];
                value = uri ?? this.convertRelationship(relationship, value, parameters);
            } else if (typeof value === 'object') {
                // Key is always a string, but value might be a ValidatedResource.
                // Resolve the declaration for the map value. Prefer the instance's
                // own fully-qualified type so that polymorphic values (subclasses of
                // the map's declared value type) are serialized using their actual
                // declaration. Fall back to the map's declared value type - honouring
                // imports - for instances that do not expose a fully-qualified type
                // (e.g. those created by the populator). Either way the value concept
                // may live in another namespace, so resolve it via the model manager
                // rather than the map's own model file.
                const modelFile = mapDeclaration.getModelFile();
                const valueType = typeof value.getFullyQualifiedType === 'function'
                    ? value.getFullyQualifiedType()
                    : modelFile.getFullyQualifiedTypeName(mapDeclaration.getValue().getType());
                const decl = modelFile.getModelManager().getType(valueType);

                // convert declaration to JSON representation
                parameters.stack.push(value);
                const jsonValue = decl.accept(this, parameters);

                value = jsonValue;
            }

            map.set(key, value);
        });

        return Object.fromEntries(map);
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {

        const obj = parameters.stack.pop();
        if (!((obj instanceof Resource))) {
            throw new Error('Expected a Resource, but found ' + obj);
        }

        let result: Record<string, unknown> = {};
        let id: string | null = null;

        if (obj.isIdentifiable() && this.deduplicateResources) {
            id = obj.toURI();
            if( parameters.dedupeResources.has(id)) {
                return id;
            }
            else {
                parameters.dedupeResources.add(id);
            }
        }

        result.$class = classDeclaration.getFullyQualifiedName();
        if(this.deduplicateResources && id) {
            result.$id = id;
        }

        // Walk each property of the class declaration
        const properties = classDeclaration.getProperties();
        for (let index in properties) {
            const property = properties[index];
            const value = obj[property.getName()];
            if (!Util.isNull(value)) {
                parameters.stack.push(value);
                result[property.getName()] = property.accept(this, parameters);
            }
        }

        return result;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        const obj = parameters.stack.pop();
        let result;
        if (field.isArray()) {
            let array: unknown[] = [];
            // Walk the object
            for (let index in obj) {
                const item = obj[index];
                if (!field.isPrimitive() && !ModelUtil.isEnum(field)) {
                    parameters.stack.push(item, Typed);
                    const classDeclaration = parameters.modelManager.getType(item.getFullyQualifiedType());
                    array.push(classDeclaration.accept(this, parameters));
                } else {
                    array.push(this.convertToJSON(field, item));
                }
            }
            result = array;
        } else if (field.isPrimitive()) {
            result = this.convertToJSON(field, obj);
        } else if (ModelUtil.isEnum(field)) {
            result = this.convertToJSON(field, obj);
        } else if (ModelUtil.isMap(field)) {
            parameters.stack.push(obj);
            const mapDeclaration = parameters.modelManager.getType(field.getFullyQualifiedTypeName());
            result = mapDeclaration.accept(this, parameters);
        }
        else {
            parameters.stack.push(obj);
            const classDeclaration = parameters.modelManager.getType(obj.getFullyQualifiedType());
            result = classDeclaration.accept(this, parameters);
        }

        return result;
    }

    /**
     * Converts to JSON safe format.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} obj - the object to convert to text
     * @return {Object} the text JSON safe representation
     */
    convertToJSON(field, obj) {
        switch (field.getType()) {
        case 'DateTime':
        {
            const objWithOffset = obj.utc().utcOffset(this.utcOffset);
            const inZ = objWithOffset.utcOffset() === 0;
            return objWithOffset.format(`YYYY-MM-DDTHH:mm:ss.SSS${inZ ? '[Z]': 'Z'}`);
        }
        case 'Integer':
        case 'Long': {
            return obj;
        }
        case 'Double':
        case 'Boolean':
        default:
        {
            return obj;
        }
        }
    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        const obj = parameters.stack.pop();
        let result;

        if (relationshipDeclaration.isArray()) {
            let array: unknown[] = [];
            // walk the object
            for (let index in obj) {
                const item = obj[index];
                array.push(this.convertRelationship(relationshipDeclaration, item, parameters));
            }
            result = array;
        } else {
            result = this.convertRelationship(relationshipDeclaration, obj, parameters);
        }
        return result;
    }

    /**
     * One relationship value, or a relationship-typed map value (BC-05).
     * @param {RelationshipDeclaration|RelationshipMapValue} relationshipDeclaration - the relationship property, or the map's relationship value
     * @param {Identifiable} obj - the relationship or the resource
     * @param {Object} parameters  - the parameter
     * @return {Object} the relationship text, or the resource as JSON
     * @private
     */
    convertRelationship(relationshipDeclaration, obj, parameters) {
        if (this.permitResourcesForRelationships && obj instanceof Resource) {
            let fqi = obj.getFullyQualifiedIdentifier();
            if (parameters.seenResources.has(fqi)) {
                return this.getRelationshipText(relationshipDeclaration, obj);
            }
            parameters.seenResources.add(fqi);
            parameters.stack.push(obj, Resource);
            const classDecl = parameters.modelManager.getType(relationshipDeclaration.getFullyQualifiedTypeName());
            const result = classDecl.accept(this, parameters);
            parameters.seenResources.delete(fqi);
            return result;
        }
        return this.getRelationshipText(relationshipDeclaration, obj);
    }

    /**
     * Returns the persistent format for a relationship.
     * @param {RelationshipDeclaration} relationshipDeclaration - the relationship being persisted
     * @param {Identifiable} relationshipOrResource - the relationship or the resource
     * @returns {string} the text to use to persist the relationship
     */
    getRelationshipText(relationshipDeclaration, relationshipOrResource) {
        if (relationshipOrResource instanceof Resource) {
            const allowRelationships =
                this.convertResourcesToRelationships || this.permitResourcesForRelationships;
            if (!allowRelationships) {
                throw new Error('Did not find a relationship for ' + relationshipDeclaration.getFullyQualifiedTypeName() + ' found ' + relationshipOrResource);
            }
        }
        if (this.convertResourcesToId) {
            return relationshipOrResource.getIdentifier();
        } else {
            return relationshipOrResource.toURI();
        }
    }
}

/**
 * A relationship-typed map's URIs, made in one engine call.
 * @param {JSONGenerator} generator - the generator and its options
 * @param {Map} obj - the map
 * @return {Array} per entry, its URI, or `undefined` to write it the usual way
 * @private
 */
function relationshipMapURIs(generator: JSONGenerator, obj: Map<string, unknown>): (string | undefined)[] {
    const fields: unknown[] = [];
    const at: number[] = [];
    let index = 0;
    if (!generator.convertResourcesToId) {
        const resourcesAsText = generator.convertResourcesToRelationships && !generator.permitResourcesForRelationships;
        obj.forEach((value, key) => {
            if (value instanceof Identifiable && !ModelUtil.isSystemProperty(key) &&
                (!(value instanceof Resource) || resourcesAsText)) {
                fields.push(value.getNamespace(), value.getType(), value.getIdentifier());
                at.push(index);
            }
            index++;
        });
    }
    const result: (string | undefined)[] = new Array(index);
    if (at.length > 0) {
        const uris = resourceIdsToURIs(fields);
        for (let i = 0; i < at.length; i++) {
            result[at[i]] = uris[i];
        }
    }
    return result;
}

export { JSONGenerator };
export default JSONGenerator;
