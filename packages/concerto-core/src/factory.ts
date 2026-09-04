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

import { TypedStack } from '@accordproject/concerto-util';

import debugLib from 'debug';
const debug = debugLib('concerto:Factory');
import Globalize from './globalize';

import ModelUtil from './modelutil';

import InstanceGenerator from './serializer/instancegenerator';
import ValueGeneratorFactory from './serializer/valuegenerator';
import ResourceValidator from './serializer/resourcevalidator';

import Relationship from './model/relationship';
import Resource from './model/resource';
import ValidatedResource from './model/validatedresource';

import * as uuid from 'uuid';

import dayjs from './dayjs-setup';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from './basemodelmanager';
import type ClassDeclaration from './introspect/classdeclaration';
import type Typed from './model/typed';
import type { Dayjs } from 'dayjs';
import type { GenerateOptions, InstanceGeneratorParameters } from './types';
/* eslint-enable no-unused-vars */

/**
 * Use the Factory to create instances of Resource: transactions, participants
 * and assets.
 *
 * @class
 * @memberof module:concerto-core
 */
class Factory {
    modelManager: BaseModelManager;
    /**
     * Create a new ID for an object.
     * @returns {string} a new ID
     */
    static newId() {
        return uuid.v4();
    }

    /**
     * Create the factory.
     *
     * @param {ModelManager} modelManager - The ModelManager to use for this registry
     */
    constructor(modelManager: BaseModelManager) {
        this.modelManager = modelManager;
    }

    /**
     * Create a new Resource with a given namespace, type name and id
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Resource} instead of a {@link ValidatedResource}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newResource(ns, type, id?, options?) {
        const method = 'newResource';
        options = options || {};

        const qualifiedName = ModelUtil.getFullyQualifiedName(ns, type);
        const classDecl = this.modelManager.getType(qualifiedName);

        if(classDecl.isAbstract()) {
            let formatter = Globalize.messageFormatter('factory-newinstance-abstracttype');
            throw new Error(formatter({
                namespace: ns,
                type: type
            }));
        }

        let idField = classDecl.getIdentifierFieldName();
        if (classDecl.isSystemIdentified()) {
            id = id === null || id === undefined ? Factory.newId() : id;
        }
        if (idField) {
            if(typeof(id) !== 'string') {
                let formatter = Globalize.messageFormatter('factory-newinstance-invalididentifier');
                throw new Error(formatter({
                    namespace: ns,
                    type: type
                }));
            }

            if(id.trim().length === 0) {
                let formatter = Globalize.messageFormatter('factory-newinstance-missingidentifier');
                throw new Error(formatter({
                    namespace: ns,
                    type: type
                }));
            }

            if (id) {
                let idFullField = classDecl.getProperty(idField);
                if (idFullField?.isTypeScalar?.()){
                    idFullField = idFullField.getScalarField();
                }
                // if regex on identifier field & provided id does not match regex, throw error
                if(idFullField?.validator?.regex && (idFullField.validator?.matchesRegex(id) === false)) {
                    throw new Error('Provided id does not match regex: ' + idFullField?.validator?.regex);
                }
            }
        } else if(id) {
            throw new Error('Type is not identifiable ' + classDecl.getFullyQualifiedName());
        }

        let newObj: Resource;
        let timestamp: Dayjs | null = null;
        if (classDecl.isTransaction() || classDecl.isEvent()) {
            timestamp = dayjs.utc();
        }
        if(options.disableValidation) {
            newObj = new Resource(this.modelManager, classDecl, ns, type, id, timestamp);
        }
        else {
            newObj = new ValidatedResource(this.modelManager, classDecl, ns, type, id, timestamp, new ResourceValidator());
        }
        newObj.assignFieldDefaults();
        this.initializeNewObject(newObj, classDecl, options);

        if (idField) {
            // if we have an identifier, we set it now
            newObj[idField] = id;
        }

        debug(method, 'Factory.newResource created ', id || 'valid');
        return newObj;
    }

    /**
     * Create a new Concept with a given namespace and type name
     * @param {String} ns - the namespace of the Concept
     * @param {String} type - the type of the Concept
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Concept} instead of a {@link ValidatedConcept}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newConcept(ns, type, id?, options?) {
        return this.newResource(ns, type, id, options);
    }

    /**
     * Create a new Relationship with a given namespace, type and identifier.
     * A relationship is a typed pointer to an instance. I.e the relationship
     * with `namespace = 'org.example'`, `type = 'Vehicle'` and `id = 'ABC' creates`
     * a pointer that points at an instance of org.example.Vehicle with the id
     * ABC.
     *
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} id - the identifier
     * @return {Relationship} - the new relationship instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newRelationship(ns, type, id) {
        // Load the type declaration to force an error if it doesn't exist
        const fqn = ModelUtil.getFullyQualifiedName(ns, type);
        const classDecl = this.modelManager.getType(fqn);
        if(!classDecl.isIdentified()) {
            throw new Error(`Cannot create a relationship to ${fqn}, it is not identifiable.`);
        }
        return new Relationship(this.modelManager, classDecl, ns, type, id);
    }

    /**
     * Create a new transaction object. The identifier of the transaction is set to a UUID.
     * @param {String} ns - the namespace of the transaction.
     * @param {String} type - the type of the transaction.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new transaction.
     */
    newTransaction(ns, type, id?, options?) {
        if (!ns) {
            throw new Error('ns not specified');
        } else if (!type) {
            throw new Error('type not specified');
        }
        const transaction = this.newResource(ns, type, id, options);
        const classDeclaration = transaction.getClassDeclaration();

        if (!classDeclaration.isTransaction()) {
            throw new Error(transaction.getClassDeclaration().getFullyQualifiedName() + ' is not a transaction');
        }

        return transaction;
    }

    /**
     * Create a new event object. The identifier of the event is
     * set to a UUID.
     * @param {String} ns - the namespace of the event.
     * @param {String} type - the type of the event.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new event.
     */
    newEvent(ns, type, id?, options?) {
        if (!ns) {
            throw new Error('ns not specified');
        } else if (!type) {
            throw new Error('type not specified');
        }
        const event = this.newResource(ns, type, id, options);
        const classDeclaration = event.getClassDeclaration();

        if (!classDeclaration.isEvent()) {
            throw new Error(event.getClassDeclaration().getFullyQualifiedName() + ' is not an event');
        }

        return event;
    }

    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Initialize the state of a newly created resource
     * @private
     * @param {Typed} newObject - resource to initialize.
     * @param {ClassDeclaration} classDeclaration - class declaration for the resource.
     * @param {Object} clientOptions - field generation options supplied by the caller.
     */
    initializeNewObject(newObject: Typed, classDeclaration: ClassDeclaration, clientOptions: GenerateOptions) {
        const generateParams = this.parseGenerateOptions(clientOptions);
        if (generateParams) {
            generateParams.stack = new TypedStack(newObject);
            generateParams.seen = [newObject.getFullyQualifiedType()];
            const visitor = new InstanceGenerator();
            classDeclaration.accept(visitor, generateParams);
        }
    }

    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Parse the client-supplied field generation options and return a corresponding set of InstanceGenerator
     * options that can be used to initialize a resource.
     * @private
     * @param {Object} clientOptions - field generation options supplied by the caller.
     * @return {Object} InstanceGenerator options.
     */
    parseGenerateOptions(clientOptions: GenerateOptions): InstanceGeneratorParameters | null {
        if (!clientOptions.generate) {
            return null;
        }

        const valueGenerator = (/^empty$/i).test(clientOptions.generate)
            ? ValueGeneratorFactory.empty()
            // Allow any other value for backwards compatibility with previous (truthy) behavior
            : ValueGeneratorFactory.sample();

        const generateParams: InstanceGeneratorParameters = {
            modelManager: this.modelManager,
            factory: this,
            valueGenerator,
            includeOptionalFields: clientOptions.includeOptionalFields ? true : false,
        };

        return generateParams;
    }
}

export { Factory };
export default Factory;
