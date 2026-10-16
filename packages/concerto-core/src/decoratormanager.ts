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

import ModelManager from './modelmanager';
import Serializer from './serializer';
import Factory from './factory';
import ModelUtil from './modelutil';
import { MetaModelNamespace } from '@accordproject/concerto-metamodel';
import semver from 'semver';
import DecoratorExtractor from './decoratorextractor';
import IllegalModelException from './introspect/illegalmodelexception';
import { jsonToYaml, yamlToJson } from './dcsconverter';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './introspect/modelfile';
import type { DecoratorCommand, DecoratorCommandTarget } from './types';
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

interface IndexedCommand {
    command: DecoratorCommand;
    index: number;
}

interface NamespaceBucket {
    modelCommands: IndexedCommand[];
    byDeclaration: Map<string, IndexedCommand[]>;
    wildcardCommands: IndexedCommand[];
}

interface CommandIndex {
    byNamespace: Map<string, NamespaceBucket>;
    wildcardNs: NamespaceBucket;
    hasWildcardNamespace: boolean;
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
        return (semver.major(inputVersion!) === semver.major(DCS_VERSION) && (semver.minor(inputVersion!) < semver.minor(DCS_VERSION)));
    }

    /**
     * @private
     */
    private static buildCommandIndex(commands: DecoratorCommand[]): CommandIndex {
        const index: CommandIndex = {
            byNamespace: new Map(),
            wildcardNs: { modelCommands: [], byDeclaration: new Map(), wildcardCommands: [] },
            hasWildcardNamespace: false,
        };

        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            const target: DecoratorCommandTarget = command.target;
            const entry: IndexedCommand = { command, index: i };

            let ns: NamespaceBucket;
            if (target.namespace) {
                let b = index.byNamespace.get(target.namespace);
                if (!b) {
                    b = { modelCommands: [], byDeclaration: new Map(), wildcardCommands: [] };
                    index.byNamespace.set(target.namespace, b);
                }
                ns = b;
            } else {
                index.hasWildcardNamespace = true;
                ns = index.wildcardNs;
            }

            const hasTarget = target.namespace || target.declaration || target.property
                || target.properties || target.type || target.mapElement;
            if (!hasTarget) {
                continue;
            } else if (target.namespace && !target.declaration && !target.property
                && !target.properties && !target.type && !target.mapElement) {
                ns.modelCommands.push(entry);
            } else if (target.declaration) {
                let list = ns.byDeclaration.get(target.declaration);
                if (!list) { list = []; ns.byDeclaration.set(target.declaration, list); }
                list.push(entry);
            } else {
                ns.wildcardCommands.push(entry);
            }
        }

        return index;
    }

    /**
     * @private
     */
    private static applyCommandsToDeclaration(decl, commands: IndexedCommand[]) {
        const isMap = decl.$class === `${MetaModelNamespace}.MapDeclaration`;
        const hasProperties = decl.properties && decl.properties.length > 0;
        let propertyCommands: IndexedCommand[] | null = null;

        for (const ic of commands) {
            const { target, type, decorator } = ic.command;
            if (target.mapElement) {
                if (isMap) {
                    const elements = target.mapElement === 'KEY_VALUE' ? ['KEY', 'VALUE'] : [target.mapElement];
                    for (const el of elements) {
                        const mapPart = el === 'KEY' ? decl.key : decl.value;
                        if (!target.type || mapPart.$class.includes(target.type)) {
                            this.applyDecorator(mapPart, type, decorator);
                        }
                    }
                }
            } else if (target.type && !target.property && !target.properties) {
                if (isMap) {
                    if (decl.key.$class.includes(target.type)) {
                        this.applyDecorator(decl.key, type, decorator);
                    }
                    if (decl.value.$class.includes(target.type)) {
                        this.applyDecorator(decl.value, type, decorator);
                    }
                }
                if (hasProperties) { (propertyCommands ??= []).push(ic); }
            } else if (target.property || target.properties || target.type) {
                if (hasProperties) { (propertyCommands ??= []).push(ic); }
            } else {
                this.applyDecorator(decl, type, decorator);
            }
        }

        if (propertyCommands) {
            const byName = new Map<string, IndexedCommand[]>();
            const byType = new Map<string, IndexedCommand[]>();

            for (const ic of propertyCommands) {
                const { target } = ic.command;
                if (target.property) {
                    let list = byName.get(target.property);
                    if (!list) { list = []; byName.set(target.property, list); }
                    list.push(ic);
                } else if (target.properties) {
                    for (const p of target.properties) {
                        let list = byName.get(p);
                        if (!list) { list = []; byName.set(p, list); }
                        list.push(ic);
                    }
                } else if (target.type) {
                    let list = byType.get(target.type);
                    if (!list) { list = []; byType.set(target.type, list); }
                    list.push(ic);
                }
            }

            for (let i = 0; i < decl.properties.length; i++) {
                let property = decl.properties[i];
                const matched: IndexedCommand[] = [];
                const nameMatched = byName.get(property.name);
                if (nameMatched) { matched.push(...nameMatched); }
                const typeMatched = byType.get(property.$class);
                if (typeMatched) { matched.push(...typeMatched); }
                if (matched.length === 0) { continue; }
                if (matched.length > 1) { matched.sort((a, b) => a.index - b.index); }

                let cloned = false;
                for (const ic of matched) {
                    const { target, type, decorator } = ic.command;
                    if (!target.type || target.type === property.$class) {
                        if (!cloned) {
                            property = { ...property, decorators: property.decorators ? [...property.decorators] : undefined };
                            decl.properties[i] = property;
                            cloned = true;
                        }
                        this.applyDecorator(property, type, decorator);
                    }
                }
            }
        }
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
     * Applies all the decorator commands from the DecoratorCommandSet to the ModelManager.
     * Uses a hierarchical command index to skip models and declarations with no matching commands,
     * and selective cloning instead of deep-cloning the entire AST.
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

        const combinedCommands: DecoratorCommand[] = decoratorCommandSets.flatMap(cs => cs.commands);

        const decoratorImports = combinedCommands.flatMap((command: any) => {
            return [{
                $class: `${MetaModelNamespace}.ImportType`,
                name: command.decorator.name,
                namespace: command.decorator.namespace ? command.decorator.namespace : options?.defaultNamespace
            }].concat(command.decorator.arguments ? command.decorator.arguments?.filter(a => a.type)
                .map(a => {
                    return {
                        $class: `${MetaModelNamespace}.ImportType`,
                        name: a.type.name,
                        namespace: a.type.namespace ? a.type.namespace : options?.defaultNamespace
                    };
                })
                : []);
        }).filter(i => i.namespace);

        const commandIndex = this.buildCommandIndex(combinedCommands);
        const ast = options?.disableMetamodelResolution ? modelManager.getAst(false, true) : modelManager.getAst(true, true);
        const decoratedAst = { ...ast, models: [...ast.models] };

        decoratedAst.models.forEach((model, modelIndex) => {
            const namespaceName = ModelUtil.parseNamespace(model.namespace).name;

            const nsBuckets: NamespaceBucket[] = [];
            const b1 = commandIndex.byNamespace.get(model.namespace);
            const b2 = commandIndex.byNamespace.get(namespaceName);
            if (b1) nsBuckets.push(b1);
            if (b2 && b2 !== b1) nsBuckets.push(b2);
            if (commandIndex.hasWildcardNamespace) nsBuckets.push(commandIndex.wildcardNs);

            if (nsBuckets.length === 0) { return; } // No applicable decorators for this model's namespace

            const clonedModel = { ...model };
            decoratedAst.models[modelIndex] = clonedModel;

            const neededImports = decoratorImports.filter(i => i.namespace !== clonedModel.namespace);
            clonedModel.imports = clonedModel.imports ? clonedModel.imports.concat(neededImports) : neededImports;

            const modelCmds: IndexedCommand[] = [];
            for (const nsB of nsBuckets) {
                for (const cmd of nsB.modelCommands) { modelCmds.push(cmd); }
            }
            if (modelCmds.length > 0) {
                if (model.decorators) { clonedModel.decorators = [...model.decorators]; }
                modelCmds.sort((a, b) => a.index - b.index);
                for (const ic of modelCmds) {
                    this.applyDecorator(clonedModel, ic.command.type, ic.command.decorator);
                }
            }

            if (!clonedModel.declarations) { return; }
            clonedModel.declarations = [...model.declarations];

            clonedModel.declarations.forEach((decl, declIndex) => {
                const commands: IndexedCommand[] = [];
                let sources = 0;
                for (const nsB of nsBuckets) {
                    const specific = nsB.byDeclaration.get(decl.name);
                    if (specific) { commands.push(...specific); sources++; }
                    if (nsB.wildcardCommands.length > 0) { commands.push(...nsB.wildcardCommands); sources++; }
                }
                if (commands.length === 0) { return; }
                if (sources > 1) { commands.sort((a, b) => a.index - b.index); }

                const clonedDecl = { ...decl };
                if (decl.decorators) { clonedDecl.decorators = [...decl.decorators]; }
                if (decl.properties) { clonedDecl.properties = [...decl.properties]; }
                if (decl.key) { clonedDecl.key = { ...decl.key }; if (decl.key.decorators) { clonedDecl.key.decorators = [...decl.key.decorators]; } }
                if (decl.value) { clonedDecl.value = { ...decl.value }; if (decl.value.decorators) { clonedDecl.value.decorators = [...decl.value.decorators]; } }
                clonedModel.declarations[declIndex] = clonedDecl;

                this.applyCommandsToDeclaration(clonedDecl, commands);
            });
        });

        const newModelManager = new ModelManager({
            ...modelManager.options,
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        newModelManager.fromAst(decoratedAst, { disableValidation: options?.disableMetamodelValidation });
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
        let modelFile: ModelFile | null = null;
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

        // the guard above throws unless modelFile was resolved for the namespace
        if (command.target.namespace && command.target.declaration) {
            validationModelManager.resolveType(
                'DecoratorCommand.target.declaration',
                `${modelFile!.getNamespace()}.${command.target.declaration}`
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
                `${modelFile!.getNamespace()}.${command.target.declaration}`
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
                `${modelFile!.getNamespace()}.${command.target.declaration}`
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

export { DecoratorManager };
export default DecoratorManager;
