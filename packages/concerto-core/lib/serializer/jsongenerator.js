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

'use strict';

const Resource = require('../model/resource');
const Typed = require('../model/typed');
const ModelUtil = require('../modelutil');
const Util = require('../util');

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
     * @param {boolean} [inferClass] Only include $class in JSON when it cannot be inferred from model
     */
    constructor(convertResourcesToRelationships, permitResourcesForRelationships, deduplicateResources, convertResourcesToId, ergo, utcOffset, inferClass) {
        this.convertResourcesToRelationships = convertResourcesToRelationships;
        this.permitResourcesForRelationships = permitResourcesForRelationships;
        this.deduplicateResources = deduplicateResources;
        this.convertResourcesToId = convertResourcesToId;
        this.utcOffset = utcOffset || 0;
        this.inferClass = inferClass;
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
            throw new Error('Unrecognised ' + JSON.stringify(thing));
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

        obj.forEach((value, key) => {

            // don't serialize System Properties, other than $class
            if(ModelUtil.isSystemProperty(key)) {
                return;
            }

            // Key is always a string, but value might be a ValidatedResource.
            if (typeof value === 'object') {
                let decl = mapDeclaration.getModelFile()
                    .getAllDeclarations()
                    .find(decl => decl.name === value.getType());

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

        let result = {};
        let id = null;

        if (obj.isIdentifiable() && this.deduplicateResources) {
            id = obj.toURI();
            if( parameters.dedupeResources.has(id)) {
                return id;
            }
            else {
                parameters.dedupeResources.add(id);
            }
        }

        // by default we set the $class on the result
        result.$class = classDeclaration.getFullyQualifiedName();

        // if we are in the inferClass mode and this is not the root instance
        // we attempt to remove the $class
        if(this.inferClass && !parameters.isRoot && parameters.field) {
            const fieldClassDecl = parameters.modelManager.getType(parameters.field.getFullyQualifiedTypeName());
            // if the $class cannot be unambigiously inferred from the type of the field in the model
            // we have to include it, but we attempt to shorten it, if the object and the field are in the same ns
            if(fieldClassDecl.getAssignableClassDeclarations().length > 2) {
                const objAndFieldSameNs = parameters.field ? ModelUtil.getNamespace(parameters.field.getFullyQualifiedTypeName()) === obj.getNamespace() : false;
                result.$class = (objAndFieldSameNs && !parameters.isRoot)  ? obj.getType() : obj.getFullyQualifiedType();
            }
            else {
                // we don't need the $class - we can recreate it from the model
                delete result.$class;
            }
        }

        if(this.deduplicateResources && id) {
            result.$id = id;
        }

        // no longer dealing with the root object...
        parameters.isRoot = false;

        // Walk each property of the class declaration
        const properties = classDeclaration.getProperties();
        for (let index in properties) {
            const property = properties[index];
            const value = obj[property.getName()];
            if (!Util.isNull(value)) {
                parameters.stack.push(value);
                parameters.field = property; // save the property to the stack!
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
            let array = [];
            // Walk the object
            for (let index in obj) {
                const item = obj[index];
                if (!field.isPrimitive() && !ModelUtil.isEnum(field)) {
                    parameters.stack.push(item, Typed);
                    parameters.field = field; // save the field to the stack!
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
            parameters.field = field; // save the field to the stack!
            result = mapDeclaration.accept(this, parameters);
        }
        else {
            parameters.stack.push(obj);
            const classDeclaration = parameters.modelManager.getType(obj.getFullyQualifiedType());
            parameters.field = field; // save the field to the stack!
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
            let array = [];
            // walk the object
            for (let index in obj) {
                const item = obj[index];
                if (this.permitResourcesForRelationships && item instanceof Resource) {
                    let fqi = item.getFullyQualifiedIdentifier();
                    if (parameters.seenResources.has(fqi)) {
                        let relationshipText = this.getRelationshipText(relationshipDeclaration, item);
                        array.push(relationshipText);
                    } else {
                        parameters.seenResources.add(fqi);
                        parameters.stack.push(item, Resource);
                        const classDecl = parameters.modelManager.getType(relationshipDeclaration.getFullyQualifiedTypeName());
                        parameters.field = relationshipDeclaration; // save the relationship to the stack!
                        array.push(classDecl.accept(this, parameters));
                        parameters.seenResources.delete(fqi);
                    }
                } else {
                    let relationshipText = this.getRelationshipText(relationshipDeclaration, item);
                    array.push(relationshipText);
                }
            }
            result = array;
        } else if (this.permitResourcesForRelationships && obj instanceof Resource) {
            let fqi = obj.getFullyQualifiedIdentifier();
            if (parameters.seenResources.has(fqi)) {
                let relationshipText = this.getRelationshipText(relationshipDeclaration, obj);
                result = relationshipText;
            } else {
                parameters.seenResources.add(fqi);
                parameters.stack.push(obj, Resource);
                const classDecl = parameters.modelManager.getType(relationshipDeclaration.getFullyQualifiedTypeName());
                parameters.field = relationshipDeclaration; // save the relationship to the stack!
                result = classDecl.accept(this, parameters);
                parameters.seenResources.delete(fqi);
            }
        } else {
            let relationshipText = this.getRelationshipText(relationshipDeclaration, obj);
            result = relationshipText;
        }
        return result;
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

module.exports = JSONGenerator;
