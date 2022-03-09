export = DecoratorManager;
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
declare class DecoratorManager {
    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager. Note that the ModelManager is modifed.
     * @param {ModelManager} modelManager the model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     */
    static decorateModels(modelManager: ModelManager, decoratorCommandSet: any): void;
    /**
     * Compares two values
     * @param {string | null} test the value to test (lhs)
     * @param {string} value the value to compare (rhs)
     * @returns {Boolean} true if the lhs is falsy or test === value
     */
    static isMatch(test: string | null, value: string): boolean;
    /**
     * Applies a decorator to a decorated model element.
     * @param {Decorated} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {Decorator} newDecorator the decorator to add
     */
    static applyDecorator(decorated: Decorated, type: string, newDecorator: Decorator): void;
    /**
     * Executes a Command against a ClassDeclaration, adding
     * decorators to the ClassDeclaration, or its properties, as required.
     * @param {ClassDeclaration} declaration the class declaration
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executeCommand(declaration: ClassDeclaration, command: any): void;
}
import Decorator = require("./introspect/decorator");
