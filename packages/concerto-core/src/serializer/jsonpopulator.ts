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

const { TypedStack } = require('@accordproject/concerto-util');
const Relationship = require('../model/relationship');
const Util = require('@accordproject/concerto-util').NullUtil;
const ModelUtil = require('../modelutil');
const ValidationException = require('./validationexception');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const quarterOfYear = require('dayjs/plugin/quarterOfYear');
dayjs.extend(quarterOfYear);
const minMax = require('dayjs/plugin/minMax');
dayjs.extend(minMax);
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

/**
 * Get all properties on a resource object that both have a value and are not system properties.
 * @param {Object} resourceData JSON object representation of a resource.
 * @param {ClassDeclaration} classDeclaration class declaration.
 * @return {Array} property names.
 * @private
 */
function getAssignableProperties(resourceData, classDeclaration) {
    const properties = Object.keys(resourceData);
    const privateProperties = properties.filter(ModelUtil.isPrivateSystemProperty);
    if (privateProperties.length > 0){
        const errorText = `Unexpected reserved properties for type ${classDeclaration.getFullyQualifiedName()}: ` +
            privateProperties.join(', ');
        throw new ValidationException(errorText);
    }

    if (properties.includes('$timestamp') &&
        !(classDeclaration.isTransaction?.() || classDeclaration.isEvent?.())
    ) {
        const errorText = `Unexpected property for type ${classDeclaration.getFullyQualifiedName()}: $timestamp`;
        throw new ValidationException(errorText);
    }

    return properties.filter((property) => {
        return !ModelUtil.isSystemProperty(property) && !Util.isNull(resourceData[property]);
    });
}

/**
 * Assert that all resource properties exist in a given class declaration.
 * @param {Array} properties Property names.
 * @param {ClassDeclaration} classDeclaration class declaration.
 * @throws {ValidationException} if any properties are not defined by the class declaration.
 * @private
 */
function validateProperties(properties, classDeclaration) {
    const expectedProperties = classDeclaration
        .getProperties()
        .map((property) => property.getName());

    const invalidProperties = properties.filter((property) => !expectedProperties.includes(property));
    if (invalidProperties.length > 0) {
        const errorText = `Unexpected properties for type ${classDeclaration.getFullyQualifiedName()}: ` +
            invalidProperties.join(', ');
        throw new ValidationException(errorText);
    }
}

/**
 * Populates a Resource with data from a JSON object graph. The JSON objects
 * should be the result of calling Serializer.toJSON and then JSON.parse.
 * The parameters object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with the root object from JSON.parse.
 * 'factory' - the Factory instance to use for creating objects.
 * 'modelManager' - the ModelManager instance to use to resolve classes
 * @private
 * @class
 * @memberof module:concerto-core
 */
class JSONPopulator {
    acceptResourcesForRelationships: any;
    utcOffset: any;
    strictQualifiedDateTimes: any;
    /**
     * Constructor.
     * @param {boolean} [acceptResourcesForRelationships] Permit resources in the
     * place of relationships, false by default.
     * @param {boolean} [ergo] - Deprecated - This is a dummy parameter to avoid breaking any consumers. It will be removed in a future release.
     * @param {number} [utcOffset] - UTC Offset for DateTime values.
     * @param {boolean} [strictQualifiedDateTimes=true] - Only allow fully-qualified date-times with offsets.

     */
    constructor(acceptResourcesForRelationships, ergo, utcOffset, strictQualifiedDateTimes) {
        this.acceptResourcesForRelationships = acceptResourcesForRelationships;
        this.utcOffset = utcOffset || 0; // Defaults to UTC
        this.strictQualifiedDateTimes = strictQualifiedDateTimes !== undefined ? strictQualifiedDateTimes : true;

        if (process.env.TZ){
            console.warn(`Environment variable 'TZ' is set to '${process.env.TZ}', this can cause unexpected behaviour when using unqualified date time formats.`);
        }
    }

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters: any = {}) {
        parameters.path ?? (parameters.path = new TypedStack('$'));

        if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isMapDeclaration?.()) {
            return this.visitMapDeclaration(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing) );
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
        const jsonObj = parameters.jsonStack.pop();
        const resourceObj = parameters.resourceStack.pop();
        parameters.path ?? (parameters.path = new TypedStack('$'));

        const properties = getAssignableProperties(jsonObj, classDeclaration);
        validateProperties(properties, classDeclaration);

        properties.forEach((property) => {
            let value = jsonObj[property];
            if (value !== null) {
                parameters.path.push(`.${property}`);
                parameters.jsonStack.push(value);
                const classProperty = classDeclaration.getProperty(property);
                resourceObj[property] = classProperty.accept(this,parameters);
                parameters.path.pop();
            }
        });
        return resourceObj;
    }

    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration, parameters) {
        let jsonObj = parameters.jsonStack.pop();
        parameters.path ?? (parameters.path = new TypedStack('$'));

        // Throws if Map contains reserved properties - a Map containing reserved Properties should not be serialized.
        getAssignableProperties(jsonObj, mapDeclaration);

        jsonObj = new Map(Object.entries(jsonObj));

        let map = new Map();

        jsonObj.forEach((value, key) => {

            if (key === '$class') {
                map.set(key, value);
                return;
            }

            if (!ModelUtil.isPrimitiveType(mapDeclaration.getKey().getType())) {
                key = this.processMapType(mapDeclaration, parameters, key, mapDeclaration.getKey().getType());
            }

            if (!ModelUtil.isPrimitiveType(mapDeclaration.getValue().getType())) {
                value = this.processMapType(mapDeclaration, parameters, value, mapDeclaration.getValue().getType());
            }

            map.set(key, value);
        });

        return map;
    }

    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} value - the key or value belonging to the Map Entry.
     * @param {Object} type - the Type associated with the Key or Value Map Entry.
     * @return {Object} value - the key or value belonging to the Map Entry.
     * @private
     */
    processMapType(mapDeclaration, parameters, value, type) {
        let decl;
        if (value && typeof value === 'object' && value.$class) {
            // Use the $class property to find the class declaration
            decl = mapDeclaration.getModelFile()
                .getAllDeclarations()
                .find(decl => decl.getFullyQualifiedName() === value.$class);
        } else {
            // Fallback to the original type lookup if value is not an object or doesn't have $class
            decl = mapDeclaration.getModelFile()
                .getAllDeclarations()
                .find(decl => decl.name === type);
        }

        // if its a ClassDeclaration, populate the Concept.
        if (decl?.isClassDeclaration()) {
            let subResource = parameters.factory.newConcept(decl.getNamespace(),
                decl.getName(), decl.getIdentifierFieldName() );

            parameters.jsonStack.push(value);
            parameters.resourceStack.push(subResource);
            return decl.accept(this, parameters);
        }
        // otherwise its a scalar value, we only need to return the primitive value of the scalar.
        return value;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        parameters.path ?? (parameters.path = new TypedStack('$'));
        let jsonObj = parameters.jsonStack.pop();
        let result: any = null;

        if(field.isArray()) {
            result = [];
            for(let n=0; n < jsonObj.length; n++) {
                parameters.path.push(`[${n}]`);
                const jsonItem = jsonObj[n];
                result.push(this.convertItem(field,jsonItem, parameters));
                parameters.path.pop();
            }
        } else {
            result = this.convertItem(field,jsonObj, parameters);
        }

        return result;
    }

    /**
     *
     * @param {Field} field - the field of the item being converted
     * @param {Object} jsonItem - the JSON object of the item being converted
     * @param {Object} parameters - the parameters
     * @return {Object} - the populated object.
     */
    convertItem(field, jsonItem, parameters) {
        let result = null;

        if(!field.isPrimitive?.() && !field.isTypeEnum?.()) {
            let typeName = jsonItem.$class;
            if(!typeName) {
                // If the type name is not specified in the data, then use the
                // type name from the model. This will only happen in the case of
                // a sub resource inside another resource.
                typeName = field.getFullyQualifiedTypeName();
            }

            // This throws if the type does not exist.
            const declaration = parameters.modelManager.getType(typeName);

            if (!declaration.isMapDeclaration?.()) {

                // create a new instance, using the identifier field name as the ID.
                let subResource = null;

                // if this is identifiable, then we create a resource
                if (declaration.isIdentified()) {
                    subResource = parameters.factory.newResource(declaration.getNamespace(),
                        declaration.getName(), jsonItem[declaration.getIdentifierFieldName()] );
                } else {
                    // otherwise we create a concept
                    subResource = parameters.factory.newConcept(declaration.getNamespace(),
                        declaration.getName());
                }
                parameters.resourceStack.push(subResource);
            }
            parameters.jsonStack.push(jsonItem);
            result = declaration.accept(this, parameters);
        }
        else {
            result = this.convertToObject(field, jsonItem, parameters);
        }

        return result;
    }

    /**
     * Converts a primtive object to JSON text.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} json - the JSON object to convert to a Concerto Object
     * @param {Object} parameters - the parameters
     * @return {string} the text representation
     */
    convertToObject(field, json, parameters: any = {}) {
        let result: any = null;
        parameters.path ?? (parameters.path = new TypedStack('$'));
        const path = parameters.path.stack.join('');

        switch(field.getType()) {
        case 'DateTime': {
            if (json && typeof json === 'object' && typeof json.isBefore === 'function') {
                result = json;
            } else if (typeof json !== 'string') {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            } else if (!this.strictQualifiedDateTimes){
                result = dayjs.utc(json).utcOffset(this.utcOffset);
            } else if (this.strictQualifiedDateTimes){
                if (json.match(/^((?:(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?))(Z|[+-]\d{2}:\d{2}))$/)){
                    result = dayjs.utc(json);
                } else {
                    throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\` with format YYYY-MM-DDTHH:mm:ss[Z]`);
                }
            }
            if (!result || !result.isValid()) {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            }
        }
            break;
        case 'Integer':
        case 'Long': {
            const num = json;
            if (typeof num === 'number') {
                if (Math.trunc(num) !== num) {
                    throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
                } else {
                    result = num;
                }
            } else {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            }
        }
            break;
        case 'Double': {
            if (typeof json === 'number') {
                result = result = json;
            } else {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            }
        }
            break;
        case 'Boolean': {
            if (typeof json === 'boolean') {
                result = json;
            } else {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            }
        }
            break;
        case 'String':
            if (typeof json === 'string') {
                result = json;
            } else {
                throw new ValidationException(`Expected value at path \`${path}\` to be of type \`${field.getType()}\``);
            }
            break;
        default: {
            // everything else should be an enumerated value...
            result = json;
        }
        }
        return result;
    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        parameters.path ?? (parameters.path = new TypedStack('$'));
        let jsonObj = parameters.jsonStack.pop();
        let result: any = null;

        let typeFQN = relationshipDeclaration.getFullyQualifiedTypeName();
        let defaultNamespace = ModelUtil.getNamespace(typeFQN);
        if(!defaultNamespace) {
            defaultNamespace = relationshipDeclaration.getNamespace();
        }
        let defaultType = ModelUtil.getShortName(typeFQN);

        if(relationshipDeclaration.isArray()) {
            result = [];
            for(let n=0; n < jsonObj.length; n++) {
                let jsonItem = jsonObj[n];
                if (typeof jsonItem === 'string') {
                    result.push(Relationship.fromURI(parameters.modelManager, jsonItem, defaultNamespace, defaultType ));
                } else {
                    if (!this.acceptResourcesForRelationships) {
                        throw new Error('Invalid JSON data. Found a value that is not a string: ' + jsonObj + ' for relationship ' + relationshipDeclaration);
                    }

                    // this isn't a relationship, but it might be an object!
                    if(!jsonItem.$class) {
                        throw new Error('Invalid JSON data. Does not contain a $class type identifier: ' + jsonItem + ' for relationship ' + relationshipDeclaration );
                    }

                    const classDeclaration = parameters.modelManager.getType(jsonItem.$class);

                    // create a new instance, using the identifier field name as the ID.
                    let subResource = parameters.factory.newResource(classDeclaration.getNamespace(),
                        classDeclaration.getName(), jsonItem[classDeclaration.getIdentifierFieldName()] );
                    parameters.jsonStack.push(jsonItem);
                    parameters.resourceStack.push(subResource);
                    classDeclaration.accept(this, parameters);
                    result.push(subResource);
                }
            }
        }
        else {
            if (typeof jsonObj === 'string') {
                result = Relationship.fromURI(parameters.modelManager, jsonObj, defaultNamespace, defaultType );
            } else {
                if (!this.acceptResourcesForRelationships) {
                    throw new Error('Invalid JSON data. Found a value that is not a string: ' + jsonObj + ' for relationship ' + relationshipDeclaration);
                }

                // this isn't a relationship, but it might be an object!
                if(!jsonObj.$class) {
                    throw new Error('Invalid JSON data. Does not contain a $class type identifier: ' + jsonObj + ' for relationship ' + relationshipDeclaration );
                }
                const classDeclaration = parameters.modelManager.getType(jsonObj.$class);

                // create a new instance, using the identifier field name as the ID.
                let subResource = parameters.factory.newResource(classDeclaration.getNamespace(),
                    classDeclaration.getName(), jsonObj[classDeclaration.getIdentifierFieldName()] );
                parameters.jsonStack.push(jsonObj);
                parameters.resourceStack.push(subResource);
                classDeclaration.accept(this, parameters);
                result = subResource;
            }
        }
        return result;
    }
}

module.exports = JSONPopulator;
