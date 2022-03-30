export = DecoratorManager;
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
declare class DecoratorManager {
    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager.
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager: ModelManager, decoratorCommandSet: any): ModelManager;
    /**
     * Compares two values. If the first argument is falsy
     * the function returns true.
     * @param {string | null} test the value to test (lhs)
     * @param {string} value the value to compare (rhs)
     * @returns {Boolean} true if the lhs is falsy or test === value
     */
    static falsyOrEqual(test: string | null, value: string): boolean;
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
}
import ModelManager = require("./modelmanager");
