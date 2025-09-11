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

/**
 * Tracks a stack of typed instances. The type information is used to detect
 * overflow / underflow bugs by the caller. It also performs basic sanity
 * checking on push/pop to make detecting bugs easier.
 * @class
 * @memberof module:concerto-core
 */
export class TypedStack {
    private stack: any[];

    /**
   * Create the Stack with the resource at the head.
   * @param resource - the resource to be put at the head of the stack
   */
    constructor(resource: any) {
        this.stack = [];
        this.push(resource);
    }

    /**
     * Push a new object.
     * @param obj - the object being visited
     * @param expectedType - the expected type of the object being pushed
     */
    push(obj: any, expectedType?: any): void {
        if(expectedType && !(obj instanceof expectedType)) {
            throw new Error('Did not find expected type ' + expectedType.constructor.name + ' as argument to push. Found: ' + obj.toString());
        }

        this.stack.push(obj);
        // console.log('Push depth is: ' + this.stack.length + ', contents: ' + this.stack.toString() );
    }

    /**
     * Pop an object from the stack.
     * @param expectedType - the type that should be the result of pop
     * @returns the result of pop
     */
    pop(expectedType?: any): any {
        this.peek(expectedType);
        return this.stack.pop();
    }

    /**
     * Peek the top of the stack
     * @param expectedType - the type that should be the result of pop
     * @returns the result of peek
     */
    peek(expectedType?: any): any {

        // console.log( 'pop ' );

        if(this.stack.length < 1) {
            throw new Error('Stack is empty!');
        }

        const result = this.stack[this.stack.length-1];
        if(expectedType && !(result instanceof expectedType)) {
            throw new Error('Did not find expected type ' + expectedType + ' on head of stack. Found: ' + result);
        }

        return result;
    }

    /**
     * Clears the stack
     */
    clear(): void {
        this.stack = [];
    }
}

module.exports = TypedStack;
