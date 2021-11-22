export = DecoratorFactory;
/**
 * An interface for a class that processes a decorator and returns a specific
 * implementation class for that decorator.
 * @class
 * @memberof module:concerto-core
 */
declare class DecoratorFactory {
    /**
     * Process the decorator, and return a specific implementation class for that
     * decorator, or return null if this decorator is not handled by this processor.
     * @abstract
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @return {Decorator} The decorator.
     */
    newDecorator(parent: ClassDeclaration | Property, ast: any): Decorator;
}
