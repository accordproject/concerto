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

const ModelManager = require('./modelmanager');
const Serializer = require('./serializer');
const Factory = require('./factory');
const ModelUtil = require('./modelutil');
const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');
const semver = require('semver');
const DecoratorExtractor = require('./decoratorextractor');
const { Warning, ErrorCodes } = require('@accordproject/concerto-util');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./introspect/modelfile');
}
/* eslint-enable no-unused-vars */

const DCS_VERSION = '0.3.0';

const DCS_MODEL = `namespace org.accordproject.decoratorcommands@0.3.0

import concerto.metamodel@1.0.0.Decorator

/**
 * A reference to an existing named & versioned DecoratorCommandSet
 */
concept DecoratorCommandSetReference {
    o String name
    o String version
}

/**
 * Whether to upsert or append the decorator
 */
enum CommandType {
    o UPSERT
    o APPEND
}

/**
 * Which models elements to add the decorator to. Any null
 * elements are 'wildcards'.
 */
concept CommandTarget {
    o String namespace optional
    o String declaration optional
    o String property optional
    o String[] properties optional // property and properties are mutually exclusive
    o String type optional
    o MapElement mapElement optional
}

/**
 * Map Declaration elements which might be used as a target
 */
enum MapElement {
    o KEY
    o VALUE
    o KEY_VALUE
}

/**
 * Applies a decorator to a given target
 */
concept Command {
    o CommandTarget target
    o Decorator decorator
    o CommandType type
}

/**
 * A named and versioned set of commands. Includes are supported for modularity/reuse.
 */
concept DecoratorCommandSet {
    o String name
    o String version
    o DecoratorCommandSetReference[] includes optional // not yet supported
    o Command[] commands
}
`;

/**
 * Intersection of two string arrays
 * @param {string[]} a the first array
 * @param {string[]} b the second array
 * @returns {string[]} returns the intersection of a and b (i.e. an
 * array of the elements they have in common)
 */
function intersect(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    return Array.from(intersection);
}

/**
 * Returns true if the unversioned namespace for a model
 * file is equal to a target
 * @param {ModelFile} modelFile the model file to test
 * @param {string} unversionedNamespace the unversioned namespace to test against
 * @returns {boolean} true is the unversioned namespace for the
 * model file equals unversionedNamespace
 */
function isUnversionedNamespaceEqual(modelFile, unversionedNamespace) {
    const { name } = ModelUtil.parseNamespace(modelFile.getNamespace());
    return name === unversionedNamespace;
}

/**
 * Helper class to wrap the decorator command and the index of the command
 * @private
 */
class DcsIndexWrapper {

    /**
     * Create the DcsIndexWrapper.
     * @constructor
     * @param {*} command - the decorator command
     * @param {number} index - the index of the command
     */
    constructor(command, index) {
        this.command = command;
        this.index = index;
    }

    /**
     * Get the decorator command.
     * @returns {*} The decorator command.
     */
    getCommand() {
        return this.command;
    }

    /**
     * Get the index of the command.
     * @returns {number} The index of the command.
     */
    getIndex() {
        return this.index;
    }
}

/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DecoratorManager {

    /**
     * Structural validation of the decoratorCommandSet against the
     * Decorator Command Set model. Note that this only checks the
     * structural integrity of the command set, it cannot check
     * whether the commands are valid with respect to a model manager.
     * Use the options.validateCommands option with decorateModels
     * method to perform semantic validation.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {ModelFile[]} [modelFiles] an optional array of model
     * files that are added to the validation model manager returned
     * @returns {ModelManager} the model manager created for validation
     * @throws {Error} throws an error if the decoratorCommandSet is invalid
     */
    static validate(decoratorCommandSet, modelFiles) {
        const validationModelManager = new ModelManager({
            strict: true,
            metamodelValidation: true,
            addMetamodel: true,
        });
        if (modelFiles) {
            validationModelManager.addModelFiles(modelFiles);
        }
        validationModelManager.addCTOModel(
            DCS_MODEL,
            'decoratorcommands@0.3.0.cto'
        );
        const factory = new Factory(validationModelManager);
        const serializer = new Serializer(factory, validationModelManager);
        serializer.fromJSON(decoratorCommandSet);
        return validationModelManager;
    }

    /**
     * Rewrites the $class property on decoratorCommandSet classes.
     * @private
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {string} version the DCS version upgrade target
     * @returns {object} the migrated DecoratorCommandSet object
     */
    static migrateTo(decoratorCommandSet, version) {
        if (decoratorCommandSet instanceof Object) {
            for (let key in decoratorCommandSet) {
                if (key === '$class' && decoratorCommandSet[key].includes('org.accordproject.decoratorcommands')) {
                    const ns = ModelUtil.getNamespace(decoratorCommandSet.$class);
                    decoratorCommandSet[key] = decoratorCommandSet[key].replace(
                        ModelUtil.parseNamespace(ns).version,
                        DCS_VERSION);
                }
                if (decoratorCommandSet[key] instanceof Object || decoratorCommandSet[key] instanceof Array) {
                    this.migrateTo(decoratorCommandSet[key], version);
                }
            }
        }
        return decoratorCommandSet;
    }

    /**
     * Checks if the supplied decoratorCommandSet can be migrated.
     * Migrations should only take place across minor versions of the same major version.
     * @private
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {*} DCS_VERSION the DecoratorCommandSet version
     * @returns {boolean} returns true if major versions are equal
     */
    static canMigrate(decoratorCommandSet, DCS_VERSION) {
        const inputVersion = ModelUtil.parseNamespace(ModelUtil.getNamespace(decoratorCommandSet.$class)).version;
        return (semver.major(inputVersion) === semver.major(DCS_VERSION) && (semver.minor(inputVersion) < semver.minor(DCS_VERSION)));
    }

    /**
     * Add decorator commands set with index object to the coresponding target map
     * @param {*} targetMap the target map to add the command to
     * @param {targetKey} targetKey the target key to add the command to
     * @param {DcsIndexWrapper} dcsWithIndex the command to add
     * @private
     */
    static addDcsWithIndexToMap(targetMap, targetKey, dcsWithIndex) {
        const targetCommands = targetMap.get(targetKey);
        if (targetCommands) {
            targetCommands.push(dcsWithIndex);
        } else {
            targetMap.set(targetKey, [dcsWithIndex]);
        }
    }


    /**
     * Creates five different maps to index decorator command sets by target type and returns them
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @returns {Object} object with all the decorator command maps based on the target
     * @private
     */
    static getDecoratorMaps(decoratorCommandSet) {
        const namespaceCommandsMap = new Map();
        const declarationCommandsMap = new Map();
        const propertyCommandsMap = new Map();
        const mapElementCommandsMap = new Map();
        const typeCommandsMap = new Map();

        decoratorCommandSet.commands.map((decoratorCommand, index) => {
            const dcsWithIndex = new DcsIndexWrapper(decoratorCommand, index);
            switch (true) {
            case !!decoratorCommand?.target?.type:
                this.addDcsWithIndexToMap(typeCommandsMap, decoratorCommand.target.type, dcsWithIndex);
                break;
            case !!decoratorCommand?.target?.property:
                this.addDcsWithIndexToMap(propertyCommandsMap, decoratorCommand.target.property, dcsWithIndex);
                break;
            case !!decoratorCommand?.target?.properties:
                decoratorCommand.target.properties.forEach((property) => {
                    this.addDcsWithIndexToMap(propertyCommandsMap, property, dcsWithIndex);
                });
                break;
            case !!decoratorCommand?.target?.mapElement:
                this.addDcsWithIndexToMap(mapElementCommandsMap, decoratorCommand.target.mapElement, dcsWithIndex);
                break;
            case !!decoratorCommand?.target?.declaration:
                this.addDcsWithIndexToMap(declarationCommandsMap, decoratorCommand.target.declaration, dcsWithIndex);
                break;
            case !!decoratorCommand?.target?.namespace:
                this.addDcsWithIndexToMap(namespaceCommandsMap, decoratorCommand.target.namespace, dcsWithIndex);
                break;
            }
        });

        return {
            namespaceCommandsMap,
            declarationCommandsMap,
            propertyCommandsMap,
            mapElementCommandsMap,
            typeCommandsMap
        };
    }

    /**
     * Migrate or validate the DecoratorCommandSet object if the options are set as true
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {boolean} shouldMigrate migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} shouldValidate validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} shouldValidateCommands validate the decorator command set targets. Note that
     * the validate option must also be true
     * @private
     */
    static migrateAndValidate(modelManager, decoratorCommandSet, shouldMigrate, shouldValidate, shouldValidateCommands) {
        if (shouldMigrate && this.canMigrate(decoratorCommandSet, DCS_VERSION)) {
            decoratorCommandSet = this.migrateTo(decoratorCommandSet, DCS_VERSION);
        }

        if (shouldValidate) {
            const enableMapType = modelManager?.enableMapType ? true : false;
            const validationModelManager = new ModelManager({
                strict: true,
                metamodelValidation: true,
                addMetamodel: true,
                enableMapType
            });
            validationModelManager.addModelFiles(modelManager.getModelFiles());
            validationModelManager.addCTOModel(
                DCS_MODEL,
                'decoratorcommands@0.3.0.cto'
            );
            const factory = new Factory(validationModelManager);
            const serializer = new Serializer(factory, validationModelManager);
            serializer.fromJSON(decoratorCommandSet);
            if (shouldValidateCommands) {
                decoratorCommandSet.commands.forEach((command) => {
                    DecoratorManager.validateCommand(
                        validationModelManager,
                        command
                    );
                });
            }
        }
    }

    /**
     * Adds decorator commands with index to the array passed
     * @param {DcsIndexWrapper[]} array the array to add the command to
     * @param {*} map the target map to add the command to
     * @param {key} key the target key to add the command to
     * @private
     */
    static pushMapValues(array, map, key) {
        const targetCommands = map.get(key);
        if (targetCommands) {
            array.push(...targetCommands);
        }
    }

    /**
     * Applies all the decorator commands from the DecoratorCommandSet to the ModelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {object} [options] - decorator models options
     * @param {boolean} [options.validate] - validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} [options.validateCommands] - validate the decorator command set targets. Note that
     * the validate option must also be true
     * @param {boolean} [options.migrate] - migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} [options.enableDcsNamespaceTarget] - flag to control applying namespace targeted decorators on top of the namespace instead of all declarations in that namespace
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager, decoratorCommandSet, options) {

        this.migrateAndValidate(modelManager, decoratorCommandSet, options?.migrate, options?.validate, options?.validateCommands);

        const { namespaceCommandsMap, declarationCommandsMap, propertyCommandsMap, mapElementCommandsMap, typeCommandsMap }  = this.getDecoratorMaps(decoratorCommandSet);
        const ast = modelManager.getAst(true);
        const decoratedAst = JSON.parse(JSON.stringify(ast));
        decoratedAst.models.forEach((model) => {
            model.declarations.forEach((decl) => {
                const declarationDecoratorCommandSets = [];
                const { name: declarationName, $class: $classForDeclaration } = decl;
                this.pushMapValues(declarationDecoratorCommandSets, declarationCommandsMap, declarationName);
                this.pushMapValues(declarationDecoratorCommandSets, namespaceCommandsMap, model.namespace);
                const namespaceName = ModelUtil.parseNamespace(model.namespace).name;
                this.pushMapValues(declarationDecoratorCommandSets, namespaceCommandsMap, namespaceName);
                this.pushMapValues(declarationDecoratorCommandSets, typeCommandsMap, $classForDeclaration);
                const sortedDeclarationDecoratorCommandSets = declarationDecoratorCommandSets.sort((declDcs1, declDcs2) => declDcs1.getIndex() - declDcs2.getIndex());
                sortedDeclarationDecoratorCommandSets.forEach(dcsWithIndex => {
                    this.executeCommand(model.namespace, decl, dcsWithIndex.getCommand(), null, options);
                    if(this.isNamespaceTargetEnabled(options?.enableDcsNamespaceTarget)) {
                        this.executeNamespaceCommand(model, dcsWithIndex.getCommand());
                    }
                });

                if($classForDeclaration === `${MetaModelNamespace}.MapDeclaration`) {
                    const mapDecoratorCommandSets = [];
                    this.pushMapValues(mapDecoratorCommandSets, typeCommandsMap, decl.key.$class);
                    this.pushMapValues(mapDecoratorCommandSets, typeCommandsMap, decl.value.$class);
                    this.pushMapValues(mapDecoratorCommandSets, mapElementCommandsMap, 'KEY');
                    this.pushMapValues(mapDecoratorCommandSets, mapElementCommandsMap, 'VALUE');
                    this.pushMapValues(mapDecoratorCommandSets, mapElementCommandsMap, 'KEY_VALUE');
                    const sortedMapDecoratorCommandSets = mapDecoratorCommandSets.sort((mapDcs1, mapDcs2) => mapDcs1.getIndex() - mapDcs2.getIndex());
                    sortedMapDecoratorCommandSets.forEach(dcsWithIndex => {
                        this.executeCommand(model.namespace, decl, dcsWithIndex.getCommand());
                    });
                }

                // scalars are declarations but do not have properties
                if (decl.properties) {
                    decl.properties.forEach((property) => {
                        const propertyDecoratorCommandSets = [];
                        const { name: propertyName, $class: $classForProperty } = property;
                        this.pushMapValues(propertyDecoratorCommandSets, propertyCommandsMap, propertyName);
                        this.pushMapValues(propertyDecoratorCommandSets, typeCommandsMap, $classForProperty);
                        const sortedPropertyDecoratorCommandSets = propertyDecoratorCommandSets.sort((propertyDcs1, propertyDcs2) => propertyDcs1.getIndex() - propertyDcs2.getIndex());
                        sortedPropertyDecoratorCommandSets.forEach(dcsWithIndex => {
                            this.executeCommand(model.namespace, decl, dcsWithIndex.getCommand(), property);
                        });
                    });
                }

            });
        });
        const enableMapType = modelManager?.enableMapType ? true : false;
        const newModelManager = new ModelManager({ enableMapType });
        newModelManager.fromAst(decoratedAst);
        return newModelManager;
    }
    /**
     * @typedef ExtractDecoratorsResult
     * @type {object}
     * @property {ModelManager} modelManager - A model manager containing models stripped without decorators
     * @property {*} decoratorCommandSet - Stripped out decorators, formed into decorator command sets
     * @property {string[]} vocabularies - Stripped out vocabularies, formed into vocabulary files
    */
    /**
     * Extracts all the decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with the decorations removed and a list of extracted decorator jsons and vocab yamls
     */
    static extractDecorators(modelManager,options) {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        const sourceAst = modelManager.getAst(true);
        const decoratorExtrator = new DecoratorExtractor(options.removeDecoratorsFromModel, options.locale, DCS_VERSION, sourceAst, DecoratorExtractor.Action.EXTRACT_ALL);
        const collectionResp = decoratorExtrator.extract();
        return {
            modelManager: collectionResp.updatedModelManager,
            decoratorCommandSet: collectionResp.decoratorCommandSet,
            vocabularies: collectionResp.vocabularies
        };
    }
    /**
     * Extracts all the vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and vocab yamls
     */
    static extractVocabularies(modelManager,options) {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        const sourceAst = modelManager.getAst(true);
        const decoratorExtrator = new DecoratorExtractor(options.removeDecoratorsFromModel, options.locale, DCS_VERSION, sourceAst, DecoratorExtractor.Action.EXTRACT_VOCAB);
        const collectionResp = decoratorExtrator.extract();
        return {
            modelManager: collectionResp.updatedModelManager,
            vocabularies: collectionResp.vocabularies
        };
    }
    /**
     * Extracts all the non-vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out non-vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and a list of extracted decorator jsons
     */
    static extractNonVocabDecorators(modelManager,options) {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        const sourceAst = modelManager.getAst(true);
        const decoratorExtrator = new DecoratorExtractor(options.removeDecoratorsFromModel, options.locale, DCS_VERSION, sourceAst, DecoratorExtractor.Action.EXTRACT_NON_VOCAB);
        const collectionResp = decoratorExtrator.extract();
        return {
            modelManager: collectionResp.updatedModelManager,
            decoratorCommandSet: collectionResp.decoratorCommandSet
        };
    }
    /**
     * Throws an error if the decoractor command is invalid
     * @param {ModelManager} validationModelManager the validation model manager
     * @param {*} command the decorator command
     */
    static validateCommand(validationModelManager, command) {
        if (command.target.type) {
            validationModelManager.resolveType(
                'DecoratorCommand.type',
                command.target.type
            );
        }
        let modelFile = null;
        if (command.target.namespace) {
            modelFile = validationModelManager.getModelFile(
                command.target.namespace
            );
            if (!modelFile) {
                const { name, version } = ModelUtil.parseNamespace(
                    command.target.namespace
                );
                if (!version) {
                    // does the model file exist with any version?
                    modelFile = validationModelManager
                        .getModelFiles()
                        .find((m) => isUnversionedNamespaceEqual(m, name));
                }
            }
        }
        if (command.target.namespace && !modelFile) {
            throw new Error(
                `Decorator Command references namespace "${
                    command.target.namespace
                }" which does not exist: ${JSON.stringify(command, null, 2)}`
            );
        }

        if (command.target.namespace && command.target.declaration) {
            validationModelManager.resolveType(
                'DecoratorCommand.target.declaration',
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
        }
        if (command.target.properties && command.target.property) {
            throw new Error(
                'Decorator Command references both property and properties. You must either reference a single property or a list of properites.'
            );
        }
        if (
            command.target.namespace &&
            command.target.declaration &&
            command.target.property
        ) {
            const decl = validationModelManager.getType(
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
            const property = decl.getProperty(command.target.property);
            if (!property) {
                throw new Error(
                    `Decorator Command references property "${command.target.namespace}.${command.target.declaration}.${command.target.property}" which does not exist.`
                );
            }
        }
        if (
            command.target.namespace &&
            command.target.declaration &&
            command.target.properties
        ) {
            const decl = validationModelManager.getType(
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
            command.target.properties.forEach((commandProperty) => {
                const property = decl.getProperty(commandProperty);
                if (!property) {
                    throw new Error(
                        `Decorator Command references property "${command.target.namespace}.${command.target.declaration}.${commandProperty}" which does not exist.`
                    );
                }
            });
        }
    }


    /**
     * Applies a new decorator to the Map element
     * @private
     * @param {string} element the element to apply the decorator to
     * @param {string} target the command target
     * @param {*} declaration the map declaration
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecoratorForMapElement(element, target, declaration, type, newDecorator ) {
        const decl = element === 'KEY' ? declaration.key : declaration.value;
        if (target.type) {
            if (this.falsyOrEqual(target.type, decl.$class)) {
                this.applyDecorator(decl, type, newDecorator);
            }
        } else {
            this.applyDecorator(decl, type, newDecorator);
        }
    }

    /**
     * Compares two arrays. If the first argument is falsy
     * the function returns true.
     * @param {string | string[] | null} test the value to test
     * @param {string[]} values the values to compare
     * @returns {Boolean} true if the test is falsy or the intersection of
     * the test and values arrays is not empty (i.e. they have values in common)
     */
    static falsyOrEqual(test, values) {
        return Array.isArray(test)
            ? intersect(test, values).length > 0
            : test
                ? values.includes(test)
                : true;
    }

    /**
     * Applies a decorator to a decorated model element.
     * @param {*} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecorator(decorated, type, newDecorator) {
        if (type === 'UPSERT') {
            let updated = false;
            if (decorated.decorators) {
                for (let n = 0; n < decorated.decorators.length; n++) {
                    let decorator = decorated.decorators[n];
                    if (decorator.name === newDecorator.name) {
                        decorated.decorators[n] = newDecorator;
                        updated = true;
                    }
                }
            }

            if (!updated) {
                decorated.decorators
                    ? decorated.decorators.push(newDecorator)
                    : (decorated.decorators = [newDecorator]);
            }
        } else if (type === 'APPEND') {
            decorated.decorators
                ? decorated.decorators.push(newDecorator)
                : (decorated.decorators = [newDecorator]);
        } else {
            throw new Error(`Unknown command type ${type}`);
        }
    }

    /**
     * Executes a Command against a Model Namespace, adding
     * decorators to the Namespace.
     * @private
     * @param {*} model the model
     * @param {*} command the Command object from the dcs
     */
    static executeNamespaceCommand(model, command) {
        const { target, decorator, type } = command;
        if (Object.keys(target).length === 2 && target.namespace) {
            const { name } = ModelUtil.parseNamespace( model.namespace );
            if(this.falsyOrEqual(target.namespace, [model.namespace, name])) {
                this.applyDecorator(model, type, decorator);
            }
        }
    }

    /**
     * Executes a Command against a Declaration, adding
     * decorators to the Declaration, or its properties, as required.
     * @param {string} namespace the namespace for the declaration
     * @param {*} declaration the class declaration
     * @param {*} command the Command object from the dcs
     * @param {*} [property] the property of a declaration, optional, to be passed if the command is for a property
     * @param {object} [options] - execute command options
     * @param {boolean} [options.enableDcsNamespaceTarget] - flag to control applying namespace targeted decorators on top of the namespace instead of all declarations in that namespace
     * org.accordproject.decoratorcommands model
     */
    static executeCommand(namespace, declaration, command, property, options) {
        const { target, decorator, type } = command;
        const { name } = ModelUtil.parseNamespace( namespace );
        if (this.falsyOrEqual(target.namespace, [namespace,name]) &&
            this.falsyOrEqual(target.declaration, [declaration.name])) {

            if (declaration.$class === `${MetaModelNamespace}.MapDeclaration`) {
                if (target.mapElement) {
                    switch (target.mapElement) {
                    case 'KEY':
                    case 'VALUE':
                        this.applyDecoratorForMapElement(target.mapElement, target, declaration, type, decorator);
                        break;
                    case 'KEY_VALUE':
                        this.applyDecoratorForMapElement('KEY', target, declaration, type, decorator);
                        this.applyDecoratorForMapElement('VALUE', target, declaration, type, decorator);
                        break;
                    }
                } else if (target.type) {
                    if (this.falsyOrEqual(target.type, declaration.key.$class)) {
                        this.applyDecorator(declaration.key, type, decorator);
                    }
                    if (this.falsyOrEqual(target.type, declaration.value.$class)) {
                        this.applyDecorator(declaration.value, type, decorator);
                    }
                } else {
                    this.checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target, options?.enableDcsNamespaceTarget);
                }
            } else if (!(target.property || target.properties || target.type)) {
                this.checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target, options?.enableDcsNamespaceTarget);
            } else {
                if(property) {
                    this.executePropertyCommand(property, command);
                }
            }
        }
    }

    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property, command) {
        const { target, decorator, type } = command;
        if(target.properties || target.property || target.type) {
            if (
                this.falsyOrEqual(
                    target.property ? target.property : target.properties,
                    [property.name]
                ) &&
                this.falsyOrEqual(target.type, [property.$class])
            ) {
                this.applyDecorator(property, type, decorator);
            }
        }
    }

    /**
     * Checks if enableDcsNamespaceTarget or ENABLE_DCS_TARGET_NAMESPACE is enabled or not
     * if enabled, applies the decorator on top of the namespace or else on all declarations
     * within the namespace.
     * @private
     * @param {*} declaration the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} decorator the decorator to add
     * @param {*} target the target object for the decorator
     * @param {boolean} [enableDcsNamespaceTarget] - flag to control applying namespace targeted decorators on top of the namespace instead of all declarations in that namespace
     */
    static checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target, enableDcsNamespaceTarget) {
        if(this.isNamespaceTargetEnabled(enableDcsNamespaceTarget)) {
            if (target.declaration) {
                this.applyDecorator(declaration, type, decorator);
            }
        } else {
            this.applyDecorator(declaration, type, decorator);
        }
    }

    /**
     * Checks if enableDcsNamespaceTarget or ENABLE_DCS_TARGET_NAMESPACE is enabled or not
     * and print deprecation warning if not enabled and return boolean value as well
     *  @private
     *  @param {boolean} [enableDcsNamespaceTarget] - flag to control applying namespace targeted decorators on top of the namespace instead of all declarations in that namespace
     *  @returns {Boolean} true if either of the flags is enabled
     */
    static isNamespaceTargetEnabled(enableDcsNamespaceTarget) {
        if(enableDcsNamespaceTarget || process.env.ENABLE_DCS_NAMESPACE_TARGET === 'true') {
            return true;
        } else {
            Warning.printDeprecationWarning(
                'Functionality for namespace targeted Decorator Command Sets has beed changed. Using namespace targets to apply decorators on all declarations in a namespace will be deprecated soon.',
                ErrorCodes.DEPRECATION_WARNING,
                ErrorCodes.CONCERTO_DEPRECATION_001,
                'Please refer to https://concerto.accordproject.org/deprecation/001'
            );
            return false;
        }
    }
}

module.exports = DecoratorManager;
