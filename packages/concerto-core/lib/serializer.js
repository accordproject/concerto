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

const TypedStack = require('@accordproject/concerto-util').TypedStack;
const DateTimeUtil = require('./datetimeutil');
const Globalize = require('./globalize');
const JSONGenerator = require('./serializer/jsongenerator');
const JSONPopulator = require('./serializer/jsonpopulator');
const Typed = require('./model/typed');
const ResourceValidator = require('./serializer/resourcevalidator');

const { utcOffset: defaultUtcOffset } = DateTimeUtil.setCurrentTime();
const baseDefaultOptions = {
    validate: true,
    ergo: false,
    utcOffset: defaultUtcOffset,
};

/**
 * Serialize Resources instances to/from various formats for long-term storage
 * (e.g. on the blockchain).
 *
 * @class
 * @memberof module:concerto-core
 */
class Serializer {
    /**
     * Create a Serializer.
     * @param {Factory} factory - The Factory to use to create instances
     * @param {ModelManager} modelManager - The ModelManager to use for validation etc.
     * @param {object} [options] - Serializer options
     */
    constructor(factory, modelManager, options) {
        if(!factory) {
            throw new Error(Globalize.formatMessage('serializer-constructor-factorynull'));
        } else if(!modelManager) {
            throw new Error(Globalize.formatMessage('serializer-constructor-modelmanagernull'));
        }

        this.factory = factory;
        this.modelManager = modelManager;
        this.defaultOptions = Object.assign({}, baseDefaultOptions, options || {});
    }

    /**
     * Set the default options for the serializer.
     * @param {Object} newDefaultOptions The new default options for the serializer.
     */
    setDefaultOptions(newDefaultOptions) {
        // Combine the specified default options with the base default
        this.defaultOptions = Object.assign({}, baseDefaultOptions, newDefaultOptions);
    }

    /**
     * <p>
     * Convert a {@link Resource} to a JavaScript object suitable for long-term
     * peristent storage.
     * </p>
     * @param {Resource} resource - The instance to convert to JSON
     * @param {Object} [options] - the optional serialization options.
     * @param {boolean} [options.validate] - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {boolean} [options.convertResourcesToRelationships] - Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [options.permitResourcesForRelationships] - Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [options.deduplicateResources] - Generate $id for resources and
     * if a resources appears multiple times in the object graph only the first instance is
     * serialized in full, subsequent instances are replaced with a reference to the $id
     * @param {boolean} [options.convertResourcesToId] - Convert resources that
     * are specified for relationship fields into their id, false by default.
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @return {Object} - The Javascript Object that represents the resource
     * @throws {Error} - throws an exception if resource is not an instance of
     * Resource or fails validation.
     */
    toJSON(resource, options) {
        // correct instance type
        if(!(resource instanceof Typed)) {
            throw new Error(Globalize.formatMessage('serializer-tojson-notcobject'));
        }

        const parameters = {};
        parameters.stack = new TypedStack(resource);
        parameters.modelManager = this.modelManager;
        parameters.seenResources = new Set();
        parameters.dedupeResources = new Set();
        const classDeclaration = this.modelManager.getType( resource.getFullyQualifiedType() );

        // validate the resource against the model
        options = options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;
        if(options.validate) {
            const validator = new ResourceValidator(options);
            classDeclaration.accept(validator, parameters);
        }

        const generator = new JSONGenerator(
            options.convertResourcesToRelationships === true,
            options.permitResourcesForRelationships === true,
            options.deduplicateResources === true,
            options.convertResourcesToId === true,
            options.ergo === true,
            options.utcOffset,
        );

        parameters.stack.clear();
        parameters.stack.push(resource);

        // this performs the conversion of the resouce into a standard JSON object
        let result = classDeclaration.accept(generator, parameters);
        return result;
    }

    /**
     * Create a {@link Resource} from a JavaScript Object representation.
     * The JavaScript Object should have been created by calling the
     * {@link Serializer#toJSON toJSON} API.
     *
     * The Resource is populated based on the JavaScript object.
     *
     * @param {Object} jsonObject The JavaScript Object for a Resource
     * @param {Object} options - the optional serialization options
     * @param {boolean} options.acceptResourcesForRelationships - handle JSON objects
     * in the place of strings for relationships, defaults to false.
     * @param {boolean} options.validate - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @return {Resource} The new populated resource
     */
    fromJSON(jsonObject, options) {
        // set default options
        options = options ? Object.assign({}, this.defaultOptions, options) : this.defaultOptions;

        if (options && options.ergo === true) {
            const theClass = jsonObject.$class.$coll[0];
            jsonObject = jsonObject.$data;
            jsonObject.$class = theClass;
        }
        if(!jsonObject.$class) {
            throw new Error('Invalid JSON data. Does not contain a $class type identifier.');
        }

        const classDeclaration = this.modelManager.getType(jsonObject.$class);

        // create a new instance, using the identifier field name as the ID.
        let resource;
        if (classDeclaration.isTransaction()) {
            resource = this.factory.newTransaction(classDeclaration.getNamespace(),
                classDeclaration.getName(),
                jsonObject[classDeclaration.getIdentifierFieldName()] );
        } else if (classDeclaration.isEvent()) {
            resource = this.factory.newEvent(classDeclaration.getNamespace(),
                classDeclaration.getName(),
                jsonObject[classDeclaration.getIdentifierFieldName()] );
        } else if (classDeclaration.isConcept()) {
            resource = this.factory.newConcept(classDeclaration.getNamespace(),
                classDeclaration.getName(),
                jsonObject[classDeclaration.getIdentifierFieldName()] );
        } else if (classDeclaration.isEnum()) {
            throw new Error('Attempting to create an ENUM declaration is not supported.');
        } else {
            resource = this.factory.newResource( classDeclaration.getNamespace(),
                classDeclaration.getName(),
                jsonObject[classDeclaration.getIdentifierFieldName()] );
        }

        // populate the resource based on the jsonObject
        // by walking the classDeclaration
        const parameters = {};
        parameters.jsonStack = new TypedStack(jsonObject);
        parameters.resourceStack = new TypedStack(resource);
        parameters.modelManager = this.modelManager;
        parameters.factory = this.factory;
        const populator = new JSONPopulator(options.acceptResourcesForRelationships === true, options.ergo === true, options.utcOffset);
        classDeclaration.accept(populator, parameters);

        // validate the resource against the model
        if(options.validate) {
            resource.validate();
        }

        return resource;
    }
}

module.exports = Serializer;
