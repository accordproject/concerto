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

'use strict';

type Constructor<T> = new (...args: unknown[]) => T;

/**
 * Tracks a stack of typed instances. The type information is used to detect
 * overflow / underflow bugs by the caller. It also performs basic sanity
 * checking on push/pop to make detecting bugs easier.
 * @class
 * @memberof module:concerto-core
 */
class TypedStack<T> {
    public stack: T[];

    /**
   * Create the Stack with the resource at the head.
   * @param resource - the resource to be put at the head of the stack
   */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(resource: T) {
        this.stack = [];
        this.push(resource);
    }

    /**
     * Push a new object.
     * @param obj - the object being visited
     * @param expectedType - the expected type of the object being pushed
     */
    push(obj: T, expectedType?: Constructor<T>): void {
        if(expectedType && !(obj instanceof expectedType)) {
            throw new Error('Did not find expected type ' + expectedType.name + ' as argument to push. Found: ' + obj?.toString());
        }

        this.stack.push(obj);
    }

    /**
     * Push a new object.
     * @param expectedType - the type that should be the result of pop
     * @return the result of pop
     */
    pop(expectedType?: Constructor<T>): T | undefined {
        this.peek(expectedType);
        return this.stack.pop();
    }

    /**
     * Peek the top of the stack
     * @param expectedType - the type that should be the result of pop
     * @return the result of peek
     */
    peek(expectedType?: Constructor<T>): T {

        if(this.stack.length < 1) {
            throw new Error('Stack is empty!');
        }

        const result = this.stack[this.stack.length-1];
        if(expectedType && !(result instanceof expectedType)) {
            throw new Error('Did not find expected type ' + expectedType.name + ' on head of stack. Found: ' + result);
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

export = TypedStack;