export = ModelManager;
/**
 * Manages the Concerto model files in CTO format.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * @memberof module:concerto-core
 */
declare class ModelManager extends BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {boolean} [options.strict] - require versioned namespaces and imports
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.metamodelValidation] - When true, modelfiles will be validated
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
     * @param {boolean} [options.enableMapType] - When true, the Concerto Map Type feature is enabled
     * @param {boolean} [options.importAliasing] - When true, the Concerto Aliasing feature is enabled
     * @param {object} [options.decoratorValidation] - the decorator validation configuration
     * @param {string} [options.decoratorValidation.missingDecorator] - the validation log level for missingDecorator decorators: off, warning, error
     * @param {string} [options.decoratorValidation.invalidDecorator] - the validation log level for invalidDecorator decorators: off, warning, error
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
     */
    constructor(options?: {
        strict?: boolean;
        regExp?: any;
        metamodelValidation?: boolean;
        addMetamodel?: boolean;
        enableMapType?: boolean;
        importAliasing?: boolean;
        decoratorValidation?: {
            missingDecorator?: string;
            invalidDecorator?: string;
        };
    });
    /**
     * Adds a model in CTO format to the ModelManager.
     * This is a convenience function equivalent to `addModel` but useful since it avoids having to copy the input CTO.
     * @param {string} cto - a cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {ModelFile} The newly added model file (internal).
     */
    addCTOModel(cto: string, fileName?: string, disableValidation?: boolean): ModelFile;
}
import BaseModelManager = require("./basemodelmanager");
import ModelFile = require("./introspect/modelfile");
