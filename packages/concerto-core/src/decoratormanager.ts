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
const IllegalModelException = require('./introspect/illegalmodelexception');
const rfdc = require('rfdc')({
    circles: true,
    proto: false,
});

const { jsonToYaml, yamlToJson } = require('./dcsconverter');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./introspect/modelfile');
}
/* eslint-enable no-unused-vars */

const DCS_VERSION = '0.4.0';

const DCS_MODEL = `concerto version ">3.0.0"
namespace org.accordproject.decoratorcommands@0.4.0

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
    o String decoratorNamespace optional
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
 * Returns true if any element in array `a` exists in array `b`.
 * Optimized for small arrays (1-5 elements) to avoid Set/Array allocations.
 * @param {string[]} a the first array
 * @param {string[]} b the second array
 * @returns {boolean} true if the arrays share at least one common element
 */
function hasIntersection(a, b) {
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            if (a[i] === b[j]) return true;
        }
    }
    return false;
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
    command: any;
    index: any;

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
    static validate(decoratorCommandSet, modelFiles?) {
        const validationModelManager = new ModelManager({
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
     * @param {*} decoratorCommandSet a DecoratorCommandSet object, or an array of DecoratorCommandSet objects
     * @param {boolean} shouldMigrate migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} shouldValidate validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} shouldValidateCommands validate the decorator command set targets. Note that
     * the validate option must also be true
     * @private
     */
    static migrateAndValidate(modelManager, decoratorCommandSet, shouldMigrate, shouldValidate, shouldValidateCommands) {
        const decoratorCommandSets = Array.isArray(decoratorCommandSet) ? decoratorCommandSet : [decoratorCommandSet];
        if (shouldMigrate) {
            decoratorCommandSets.forEach((commandSet, index) => {
                if (this.canMigrate(commandSet, DCS_VERSION)) {
                    decoratorCommandSets[index] = this.migrateTo(commandSet, DCS_VERSION);
                }
            });
        }

        if (shouldValidate) {
            const validationModelManager = new ModelManager({
                metamodelValidation: true,
                addMetamodel: true,
            });
            validationModelManager.addModelFiles(modelManager.getModelFiles());
            validationModelManager.addCTOModel(
                DCS_MODEL,
                'decoratorcommands@0.4.0.cto'
            );
            const factory = new Factory(validationModelManager);
            const serializer = new Serializer(factory, validationModelManager);
            decoratorCommandSets.forEach((commandSet) => {
                serializer.fromJSON(commandSet);
                if (shouldValidateCommands) {
                    commandSet.commands.forEach((command) => {
                        DecoratorManager.validateCommand(
                            validationModelManager,
                            command
                        );
                    });
                }
            });
        }
    }

    /**
     * Adds decorator commands with index to the array passed
     * @param {DcsIndexWrapper[]} array the array to add the command to
     * @param {*} map the target map to add the command to
     * @param {key} key the target key to add the command to
     * @private
     */
    /* istanbul ignore next */
    static pushMapValues(array, map, key) {
        for (const value of map.get(key) || []) {
            array.push(value);
        }
    }

    /**
     * Merges commands from multiple map buckets, sorts by index, and executes the callback for each.
     * @private
     */
    static applyMergedCommands(a, b, fn, ...rest) {
        const sources = [a, b, ...rest].filter(Boolean);
        if (sources.length === 0) return;
        if (sources.length === 1) {
            for (const dcs of sources[0]) { fn(dcs); }
        } else {
            const merged: any[] = [];
            for (const src of sources) { for (const v of src) merged.push(v); }
            merged.sort((x, y) => x.getIndex() - y.getIndex());
            for (const dcs of merged) { fn(dcs); }
        }
    }

    /**
     * Builds a deduplicated map of decorator imports grouped by source namespace.
     * @private
     */
    static buildImportMap(commands, defaultNamespace) {
        const map = new Map<string, any[]>();
        const seen = new Set<string>();
        const addImport = (ns, name) => {
            if (!ns) return;
            const key = `${ns}|${name}`;
            if (seen.has(key)) return;
            seen.add(key);
            let arr = map.get(ns);
            if (!arr) { arr = []; map.set(ns, arr); }
            arr.push({ $class: `${MetaModelNamespace}.ImportType`, name, namespace: ns });
        };
        for (const cmd of commands) {
            addImport(cmd.decorator.namespace || defaultNamespace, cmd.decorator.name);
            if (cmd.decorator.arguments) {
                for (const a of cmd.decorator.arguments) {
                    if (a.type) { addImport(a.type.namespace || defaultNamespace, a.type.name); }
                }
            }
        }
        return map;
    }

    /**
     * Adds decorator imports to a model AST, excluding imports from the model's own namespace.
     * @private
     */
    static addDecoratorImports(model, importsBySourceNs) {
        let neededImports: any[] | null = null;
        for (const [ns, imports] of importsBySourceNs) {
            if (ns !== model.namespace) {
                if (!neededImports) { neededImports = []; }
                for (const imp of imports) { neededImports.push(imp); }
            }
        }
        if (neededImports) {
            model.imports = model.imports ? model.imports.concat(neededImports) : neededImports;
        }
    }

    /**
     * Returns true if a model file contains any declaration or property matching the command maps.
     * @private
     */
    static modelFileMatchesCommands(mf, declarationCommandsMap, propertyCommandsMap, typeCommandsMap, mapElementCommandsMap) {
        for (const decl of mf.getAllDeclarations()) {
            const declAst = decl.ast || decl.getAst();
            if (declarationCommandsMap.has(decl.getName())) return true;
            if (typeCommandsMap.has(declAst.$class)) return true;
            if (mapElementCommandsMap.size > 0 && declAst.$class === `${MetaModelNamespace}.MapDeclaration`) return true;
            if (decl.getProperties) {
                for (const prop of decl.getProperties()) {
                    if (propertyCommandsMap.has(prop.getName())) return true;
                    const propAst = prop.ast || prop.getAst();
                    if (typeCommandsMap.has(propAst.$class)) return true;
                }
            }
        }
        return false;
    }

    /**
     * Applies all the decorator commands from the DecoratorCommandSet to the ModelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object, or an array of DecoratorCommandSet objects
     * @param {object} [options] - decorator models options
     * @param {boolean} [options.validate] - validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} [options.validateCommands] - validate the decorator command set targets. Note that
     * the validate option must also be true
     * @param {boolean} [options.migrate] - migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} [options.defaultNamespace] - the default namespace to use for decorator commands that include a decorator without a namespace
     * @param {boolean} [options.skipValidationAndResolution] - optional flag to disable both metamodel resolution and validation, only use if you are sure that the model manager has fully resolved models
     * @param {boolean} [options.disableMetamodelResolution] - flag to disable metamodel resolution, only use if you are sure that the model manager has fully resolved models
     * @param {boolean} [options.disableMetamodelValidation] - flag to disable metamodel validation, only use if you are sure that the models and decorators are already validated
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager, decoratorCommandSet, options?) {
        if (!decoratorCommandSet || decoratorCommandSet?.length === 0) {
            return modelManager;
        }
        const decoratorCommandSets = Array.isArray(decoratorCommandSet)
            ? decoratorCommandSet
            : [decoratorCommandSet];

        if (options?.skipValidationAndResolution) {
            if (options?.disableMetamodelResolution === false || options?.disableMetamodelValidation === false) {
                throw new Error('skipValidationAndResolution cannot be used with disableMetamodelResolution or disableMetamodelValidation options as false');
            }
            options.disableMetamodelResolution = true;
            options.disableMetamodelValidation = true;
        }

        this.migrateAndValidate(modelManager, decoratorCommandSets, options?.migrate, options?.validate, options?.validateCommands);

        const combinedCommands = decoratorCommandSets.flatMap(cs => cs.commands);
        const { namespaceCommandsMap, declarationCommandsMap, propertyCommandsMap, mapElementCommandsMap, typeCommandsMap } = this.getDecoratorMaps({ commands: combinedCommands });

        // Pre-group decorator imports by source namespace (deduplicated)
        const importsBySourceNs = this.buildImportMap(combinedCommands, options?.defaultNamespace);

        // Determine targeted namespaces — explicit from namespace commands
        const targetedNamespaces = new Set<string>(namespaceCommandsMap.keys());

        // Resolve wildcards to specific namespaces (only if wildcards exist)
        const hasWildcards = declarationCommandsMap.size > 0 || propertyCommandsMap.size > 0 ||
            typeCommandsMap.size > 0 || mapElementCommandsMap.size > 0;
        // Single pass: for each model file, either decorate it or pass it through
        const modelFiles = modelManager.getModelFiles(false);
        const resolveAst = !options?.disableMetamodelResolution;
        const ModelFile = require('./introspect/modelfile');
        const newModelManager = new ModelManager({ decoratorValidation: modelManager.getDecoratorValidation() });

        for (const mf of modelFiles) {
            const ns = mf.getNamespace();
            const nsName = ModelUtil.parseNamespace(ns).name;

            // Determine if this model is targeted
            const isTargeted = targetedNamespaces.has(ns) || targetedNamespaces.has(nsName) ||
                (hasWildcards && this.modelFileMatchesCommands(mf, declarationCommandsMap, propertyCommandsMap, typeCommandsMap, mapElementCommandsMap));

            if (!isTargeted) {
                mf.modelManager = newModelManager;
                newModelManager.addModelFile(mf, null, null, true);
                continue;
            }

            let modelAst = mf.getAst();
            if (resolveAst) { modelAst = modelManager.resolveMetaModel(modelAst); }
            const model = rfdc(modelAst);

            if (importsBySourceNs.size > 0) {
                this.addDecoratorImports(model, importsBySourceNs);
            }

            if (namespaceCommandsMap.size > 0) {
                this.applyMergedCommands(namespaceCommandsMap.get(ns), namespaceCommandsMap.get(nsName), (dcs) => {
                    const { target, decorator, type } = dcs.getCommand();
                    if (this.falsyOrEqual(target.namespace, [ns, nsName])) {
                        this.applyDecorator(model, type, decorator);
                    }
                });
            }

            if (model.declarations && (declarationCommandsMap.size > 0 || typeCommandsMap.size > 0 || mapElementCommandsMap.size > 0 || propertyCommandsMap.size > 0)) {
                for (const decl of model.declarations) {
                    if (declarationCommandsMap.size > 0 || typeCommandsMap.size > 0) {
                        this.applyMergedCommands(declarationCommandsMap.get(decl.name), typeCommandsMap.get(decl.$class), (dcs) => {
                            this.executeCommand(ns, decl, dcs.getCommand(), null, options);
                        });
                    }

                    if (mapElementCommandsMap.size > 0 && decl.$class === `${MetaModelNamespace}.MapDeclaration`) {
                        this.applyMergedCommands(
                            typeCommandsMap.get(decl.key.$class), typeCommandsMap.get(decl.value.$class), (dcs) => {
                                this.executeCommand(ns, decl, dcs.getCommand());
                            }, mapElementCommandsMap.get('KEY'), mapElementCommandsMap.get('VALUE'), mapElementCommandsMap.get('KEY_VALUE'));
                    }

                    if (decl.properties && (propertyCommandsMap.size > 0 || typeCommandsMap.size > 0)) {
                        for (const prop of decl.properties) {
                            this.applyMergedCommands(propertyCommandsMap.get(prop.name), typeCommandsMap.get(prop.$class), (dcs) => {
                                this.executeCommand(ns, decl, dcs.getCommand(), prop);
                            });
                        }
                    }
                }
            }

            newModelManager.addModelFile(new ModelFile(newModelManager, model), null, null, true);
        }

        if (!options?.disableMetamodelValidation) { newModelManager.validateModelFiles(); }
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
        const sourceAst = modelManager.getAst(true, true);
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
        const sourceAst = modelManager.getAst(true, true);
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
        let modelFile: any = null;
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
        if (!test) return true;
        if (Array.isArray(test)) {
            return Array.isArray(values) ? hasIntersection(test, values) : test.includes(values);
        }
        return Array.isArray(values) ? values.includes(test) : test === values;
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
            this.checkForDuplicateDecorators(decorated);
        } else {
            throw new Error(`Unknown command type ${type}`);
        }
    }

    /**
     * Checks for duplicate decorators added to a decorated model element.
     * @param {*} decoratedAst ast of the property or the declaration to apply the decorator to
     * @throws {IllegalModelException} if the decoratedAst has duplicate decorators
     * @private
     */
    static checkForDuplicateDecorators(decoratedAst) {
        const uniqueDecoratorNames = new Set();
        decoratedAst.decorators.forEach(d => {
            const decoratorName = d.name;
            if(!uniqueDecoratorNames.has(decoratorName)) {
                uniqueDecoratorNames.add(decoratorName);
            } else {
                throw new IllegalModelException(
                    `Duplicate decorator ${decoratorName}`,
                    decoratedAst.location,
                );
            }
        });
    }

    /**
     * Executes a Command against a Model Namespace, adding
     * decorators to the Namespace.
     * @private
     * @param {*} model the model
     * @param {*} command the Command object from the dcs
     */
    /* istanbul ignore next */
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
     */
    static executeCommand(namespace, declaration, command, property?, options?) {
        const { target, decorator, type } = command;
        // the namespace version is already validated in the decorateModels method
        const { name } = ModelUtil.parseNamespace( namespace, { disableVersionParsing: true } );
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
                    this.checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target);
                }
            } else if (!(target.property || target.properties || target.type)) {
                this.checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target);
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
     * Applies the decorator on top of the namespace or else on all declarations
     * within the namespace.
     * @private
     * @param {*} declaration the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} decorator the decorator to add
     * @param {*} target the target object for the decorator
     */
    static checkForNamespaceTargetAndApplyDecorator(declaration, type, decorator, target) {
        if (target.declaration) {
            this.applyDecorator(declaration, type, decorator);
        }
    }

    /**
     * Legacy method. Kept for compatibility. Returns true.
     *  @returns {Boolean} true
     */
    /* istanbul ignore next */
    static isNamespaceTargetEnabled() {
        return true;
    }

    /**
     * converts DCS JSON object into YAML string
     * validates the input DCS JSON against the DCS model
     * @param {object} jsonInput the DCS JSON as parsed object
     * @return {string} the corresponding YAML string
     */
    static jsonToYaml(jsonInput){
        this.validate(jsonInput);
        return jsonToYaml(jsonInput);
    }

    /**
     * converts DCS YAML string into JSON object
     * validates the output DCS JSON against the DCS model
     * @param {string} yamlInput the DCS JSON as parsed object
     * @return {object} the corresponding JSON object
     */
    static yamlToJson(yamlInput){
        const jsonOutput = yamlToJson(yamlInput);
        this.validate(jsonOutput);
        return jsonOutput;
    }

}

export = DecoratorManager;
