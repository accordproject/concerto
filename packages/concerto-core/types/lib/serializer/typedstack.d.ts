export = TypedStack;
/**
 * Tracks a stack of typed instances. The type information is used to detect
 * overflow / underflow bugs by the caller. It also performs basic sanity
 * checking on push/pop to make detecting bugs easier.
 * @class
 * @memberof module:concerto-core
 */
declare class TypedStack {
    /**
   * Create the Stack with the resource at the head.
   * @param {Object} resource - the resource to be put at the head of the stack
   */
    constructor(resource: any);
    stack: any[];
    /**
     * Push a new object.
     * @param {Object} obj - the object being visited
     * @param {Object} expectedType - the expected type of the object being pushed
     */
    push(obj: any, expectedType: any): void;
    /**
     * Push a new object.
     * @param {Object} expectedType - the type that should be the result of pop
     * @return {Object} the result of pop
     */
    pop(expectedType: any): any;
    /**
     * Peek the top of the stack
     * @param {Object} expectedType - the type that should be the result of pop
     * @return {Object} the result of peek
     */
    peek(expectedType: any): any;
    /**
     * Clears the stack
     */
    clear(): void;
}
