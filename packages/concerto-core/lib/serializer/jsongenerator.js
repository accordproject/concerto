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

const ClassDeclaration = require('../introspect/classdeclaration');
const Field = require('../introspect/field');
const RelationshipDeclaration = require('../introspect/relationshipdeclaration');
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
     * are specified for relationship fields into their id, false by default.
     * @param {boolean} [ergo] target ergo.
     * @param {number} [utcOffset] UTC Offset for DateTime values.
     */
    constructor(convertResourcesToRelationships, permitResourcesForRelationships, deduplicateResources, convertResourcesToId, ergo, utcOffset) {
        this.convertResourcesToRelationships = convertResourcesToRelationships;
        this.permitResourcesForRelationships = permitResourcesForRelationships;
        this.deduplicateResources = deduplicateResources;
        this.convertResourcesToId = convertResourcesToId;
        this.ergo = ergo;
        this.utcOffset = utcOffset || 0; // Defaults to UTC
    }

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing instanceof ClassDeclaration) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing instanceof RelationshipDeclaration) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing instanceof Field) {
            return this.visitField(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing));
        }
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
            } else if (this.ergo) {
                result[property.getName()] = { '$right' : null };
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
            if (this.ergo) {
                // Boxes an enum value to the expected combination of sum types
                const enumDeclaration = field.getParent().getModelFile().getType(field.getType());
                const enumName = enumDeclaration.getFullyQualifiedName();
                const properties = enumDeclaration.getProperties();
                let either = { '$left' : obj };
                for(let n=0; n < properties.length; n++) {
                    const property = properties[n];
                    if(property.getName() === obj) {
                        break;
                    } else {
                        either = { '$right' : either };
                    }
                }
                result = { '$class' : [enumName], '$data': either };
            } else {
                result = this.convertToJSON(field, obj);
            }
        } else {
            parameters.stack.push(obj);
            const classDeclaration = parameters.modelManager.getType(obj.getFullyQualifiedType());
            result = classDeclaration.accept(this, parameters);
        }
        if (field.isOptional()) {
            if (this.ergo) {
                if (result) {
                    result = { '$left' : result };
                } else {
                    result = { '$right' : result };
                }
            }
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
            if (this.ergo) {
                return objWithOffset;
            } else {
                const inZ = objWithOffset.utcOffset() === 0;
                return objWithOffset.format(`YYYY-MM-DDTHH:mm:ss.SSS${inZ ? '[Z]': 'Z'}`);
            }
        }
        case 'Integer':
        case 'Long': {
            if (this.ergo) {
                return { $nat: obj };
            } else {
                return obj;
            }
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
