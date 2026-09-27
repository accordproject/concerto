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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ModelFile from './introspect/modelfile';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). Its bindings are typed
// `never` so that a view leaves the member's inferred return type, and so
// the .d.ts, exactly as the TS body used to make it.
// See src/modelutil.ts for why this is loaded this way (dist/, bundler and
// CJS/ESM notes); the same considerations apply here unchanged.
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
// P5-06: memoised per specifier, so a call site on a per-element or
// per-instance path (propertyProcess, fastFromJson, ...) resolves the module
// once rather than on every call.
/* istanbul ignore next */
const engineModules: { [specifier: string]: any } = {};
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    engineModules[specifier] ??
    (engineModules[specifier] =
        typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : createRequire(__filename)(specifier));
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('./engine').rust;
// The rust-mode view functions (src/engine/views.ts), typed `never` for the
// same reason as `rust` above (PORTING.md 1.5, "Why never"): the return types
// the declaration build infers stay exactly those of the TS bodies.
type EngineViews = { [view: string]: (...args: any[]) => never };

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
 * Copies every own field of `source` onto `target`, recursing into matching
 * nested objects and arrays so nested references already held by a caller
 * (for example a DecoratorCommandSet an outer scope kept a reference to) end
 * up mutated in place rather than replaced. Not a DecoratorManager member on
 * purpose: it is an engine-shim implementation detail (used only in rust
 * mode, by `DecoratorManager.migrateTo` below) and must not appear in
 * DecoratorManager's public API (`migration/api-snapshot`) the way a
 * `static` method -- even one tagged `@private` in its jsdoc -- would. Used
 * because the WASM binding computes the migrated value but, unlike the
 * ts-mode body, does not mutate the JS object it was given: this reproduces
 * that in-place mutation so rust mode has the same observable effect on its
 * argument as ts mode.
 * @param {*} target the object (or array) to mutate in place
 * @param {*} source the value to copy onto it
 * @returns {*} target
 */
// Rust-mode only, so excluded from ts-mode coverage (PORTING.md 1.5; P4-09a).
/* istanbul ignore next */
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
        // The structural check only (src/dcs/mod.rs `validate`); the
        // validationModelManager above is still built the TS way (CTO
        // parsing is not ported) and returned unchanged.
        rust.decoratorManagerValidate(decoratorCommandSet, modelFiles?.map((mf: ModelFile) => mf.getAst()));
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
        return (semver.major(inputVersion!) === semver.major(DCS_VERSION) && (semver.minor(inputVersion!) < semver.minor(DCS_VERSION)));
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
        return (loadEngine('./engine/views') as EngineViews).decoratorManagerDecorateModels(modelManager, decoratorCommandSets, options);
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
        return (loadEngine('./engine/views') as EngineViews).decoratorManagerExtractDecorators(modelManager, options);
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
        return (loadEngine('./engine/views') as EngineViews).decoratorManagerExtractVocabularies(modelManager, options);
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
        return (loadEngine('./engine/views') as EngineViews).decoratorManagerExtractNonVocabDecorators(modelManager, options);
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
        return rust.decoratorManagerFalsyOrEqual(test, values);
    }

    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property, command) {
        // Mutates a detached clone across the boundary; copy the result
        // back onto `property` so callers that hold onto it (as every
        // test does) see the same mutation the TS body used to make in
        // place.
        Object.assign(property, rust.decoratorManagerExecutePropertyCommand(property, command));
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
