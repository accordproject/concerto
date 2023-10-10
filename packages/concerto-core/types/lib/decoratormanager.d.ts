export = DecoratorManager;
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
declare class DecoratorManager {
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
    static validate(decoratorCommandSet: any, modelFiles?: ModelFile[]): ModelManager;
    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager.
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {object} [options] - decorator models options
     * @param {boolean} [options.validate] - validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} [options.validateCommands] - validate the decorator command set targets. Note that
     * the validate option must also be true
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager: ModelManager, decoratorCommandSet: any, options?: {
        validate?: boolean;
        validateCommands?: boolean;
    }): ModelManager;
    /**
     * Throws an error if the decoractor command is invalid
     * @param {ModelManager} validationModelManager the validation model manager
     * @param {*} command the decorator command
     */
    static validateCommand(validationModelManager: ModelManager, command: any): void;
    /**
     * Applies a new decorator to the Map element
     * @private
     * @param {string} element the element to apply the decorator to
     * @param {string} target the command target
     * @param {*} declaration the map declaration
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    private static applyDecoratorForMapElement;
    /**
     * Compares two arrays. If the first argument is falsy
     * the function returns true.
     * @param {string | string[] | null} test the value to test
     * @param {string[]} values the values to compare
     * @returns {Boolean} true if the test is falsy or the intersection of
     * the test and values arrays is not empty (i.e. they have values in common)
     */
    static falsyOrEqual(test: string | string[] | null, values: string[]): boolean;
    /**
     * Applies a decorator to a decorated model element.
     * @param {*} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecorator(decorated: any, type: string, newDecorator: any): void;
    /**
     * Executes a Command against a ClassDeclaration, adding
     * decorators to the ClassDeclaration, or its properties, as required.
     * @param {string} namespace the namespace for the declaration
     * @param {*} declaration the class declaration
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executeCommand(namespace: string, declaration: any, command: any): void;
    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property: any, command: any): void;
}
import ModelFile = require("./introspect/modelfile");
import ModelManager = require("./modelmanager");
