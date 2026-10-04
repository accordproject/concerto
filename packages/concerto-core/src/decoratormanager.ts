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
import ModelUtil from './modelutil';
import semver from 'semver';

import { jsonToYaml, yamlToJson } from './dcsconverter';
import IllegalModelException from './introspect/illegalmodelexception';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './introspect/modelfile';
/* eslint-enable no-unused-vars */
import { rust, engineViews } from './engineloader';

// The engine bindings (`rust`) and views are typed by
// src/engine/bindings.d.ts.

const DCS_VERSION = '0.4.0';

/**
 * TS 5.0.0's `DecoratorManager.applyDecorator`: applies a decorator to a
 * decorated model element's AST, in place.
 * @param {*} decorated the AST to apply the decorator to
 * @param {string} type the command type
 * @param {*} newDecorator the decorator to add
 */
function applyDecorator(decorated, type, newDecorator) {
    if (type === 'UPSERT') {
        let updated = false;
        if (decorated.decorators) {
            for (let n = 0; n < decorated.decorators.length; n++) {
                const decorator = decorated.decorators[n];
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
        checkForDuplicateDecorators(decorated);
    } else {
        throw new Error(`Unknown command type ${type}`);
    }
}

/**
 * TS 5.0.0's `DecoratorManager.checkForDuplicateDecorators`.
 * @param {*} decoratedAst the AST of the decorated element
 * @throws {IllegalModelException} if it has two decorators of one name
 */
function checkForDuplicateDecorators(decoratedAst) {
    const uniqueDecoratorNames = new Set();
    decoratedAst.decorators.forEach(d => {
        const decoratorName = d.name;
        if (!uniqueDecoratorNames.has(decoratorName)) {
            uniqueDecoratorNames.add(decoratorName);
        } else {
            throw new IllegalModelException(`Duplicate decorator ${decoratorName}`, undefined, decoratedAst.location);
        }
    });
}

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
 * Copies every own field of `source` onto `target`, recursing into matching
 * nested objects and arrays so nested references already held by a caller
 * (for example a DecoratorCommandSet an outer scope kept a reference to) end
 * up mutated in place rather than replaced. Not a DecoratorManager member,
 * so it stays out of the public API (`migration/api-snapshot`) as even a
 * `@private` static would not. The binding computes the migrated value
 * without mutating the JS object it was given; this mutates it in place, as
 * TS 5.0.0's `migrateTo` did.
 * @param {*} target the object (or array) to mutate in place
 * @param {*} source the value to copy onto it
 * @returns {*} target
 */
function assignDeep(target, source) {
    if (Array.isArray(target) && Array.isArray(source)) {
        target.forEach((item, i) => assignDeep(item, source[i]));
        return target;
    }
    if (target instanceof Object && source instanceof Object) {
        for (const key of Object.keys(source)) {
            if (target[key] instanceof Object && source[key] instanceof Object) {
                assignDeep(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target;
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
        // The structural check only, on validationModelManager's own
        // rustHandle, which mirrors its model files. validationModelManager
        // is built from CTO in TS and returned unchanged.
        engineViews().decoratorManagerValidate(validationModelManager, decoratorCommandSet);
        return validationModelManager;
    }

    /**
     * Rewrites the $class property on decoratorCommandSet classes.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {string} version the DCS version upgrade target
     * @returns {object} the migrated DecoratorCommandSet object
     */
    static migrateTo(decoratorCommandSet, version) {
        // decoratormanager.ts's own callers (e.g. decorateModels's migrate
        // step) rely on decoratorCommandSet being mutated in place, not just
        // on the return value.
        assignDeep(decoratorCommandSet, rust.decoratorManagerMigrateTo(decoratorCommandSet));
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
        // BC-41: a namespace version is strict SemVer 2.0.0, whose
        // components go up to 2^64-1, beyond node-semver's
        // Number.MAX_SAFE_INTEGER, so its major and minor (the first two
        // dot-separated parts, always plain digits) are compared exactly.
        const [major, minor] = inputVersion!.split('.', 2).map(BigInt);
        return (major === BigInt(semver.major(DCS_VERSION)) && (minor < BigInt(semver.minor(DCS_VERSION))));
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

        // Only the migrate step of the old migrateAndValidate call mutated
        // its decoratorCommandSets argument (validate only threw); run it
        // here so decoratorCommandSet (this method's own argument, still
        // referenced by the caller) ends up migrated in place exactly as
        // before.
        if (options?.migrate) {
            decoratorCommandSets.forEach((commandSet, index) => {
                if (this.canMigrate(commandSet, DCS_VERSION)) {
                    decoratorCommandSets[index] = this.migrateTo(commandSet, DCS_VERSION);
                }
            });
        }
        return engineViews().decoratorManagerDecorateModels(modelManager, decoratorCommandSets, options);
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
    static extractDecorators(modelManager,options): { modelManager: ModelManager; decoratorCommandSet: never[]; vocabularies: never[]; } {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        return engineViews().decoratorManagerExtractDecorators(modelManager, options);
    }
    /**
     * Extracts all the vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and vocab yamls
     */
    static extractVocabularies(modelManager,options): { modelManager: ModelManager; vocabularies: never[]; } {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        return engineViews().decoratorManagerExtractVocabularies(modelManager, options);
    }
    /**
     * Extracts all the non-vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out non-vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and a list of extracted decorator jsons
     */
    static extractNonVocabDecorators(modelManager,options): { modelManager: ModelManager; decoratorCommandSet: never[]; } {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        return engineViews().decoratorManagerExtractNonVocabDecorators(modelManager, options);
    }
    /**
     * Compares two arrays. If the first argument is falsy
     * the function returns true.
     * @param {string | string[] | null} test the value to test
     * @param {string[]} values the values to compare
     * @returns {Boolean} true if the test is falsy or the intersection of
     * the test and values arrays is not empty (i.e. they have values in common)
     */
    static falsyOrEqual(test, values): any {
        return Array.isArray(test)
            ? intersect(test, values).length > 0
            : test
                ? values.includes(test)
                : true;
    }

    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property, command) {
        // TS 5.0.0's body: pure work over the caller's own objects, which it
        // changes in place (only the `decorators` array, pushing
        // `command.decorator` itself), so it stays in TS.
        const { target, decorator, type } = command;
        if (target.properties || target.property || target.type) {
            if (this.falsyOrEqual(target.property ? target.property : target.properties, [property.name]) &&
                this.falsyOrEqual(target.type, [property.$class])) {
                applyDecorator(property, type, decorator);
            }
        }
    }

    /**
     * Legacy method. Kept for compatibility. Returns true.
     *  @returns {Boolean} true
     */
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

export { DecoratorManager };
export default DecoratorManager;
