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
 * A typed stack that enforces type safety for its elements.
 */
export default class TypedStack<T = any> {
    private stack: T[];

    /**
     * Creates a new TypedStack with an initial value.
     * @param initialValue - The initial value to push onto the stack.
     */
    constructor(initialValue: T) {
        this.stack = [initialValue];
    }

    /**
     * Pushes a value onto the stack, ensuring it matches the expected type.
     * @param value - The value to push.
     * @param type - The expected type of the value.
     */
    push(value: T, type: Function): void {
        if (!(value instanceof type)) {
            throw new Error(`Did not find expected type Function as argument to push. Found: ${value}`);
        }
        this.stack.push(value);
    }

    /**
     * Removes and returns the top value from the stack, ensuring it matches the expected type.
     * @param type - The expected type of the value (optional).
     * @returns The top value on the stack.
     */
    pop(type?: Function): T {
        if (this.stack.length === 0) {
            throw new Error('Stack is empty!');
        }
        const value = this.stack.pop()!;
        if (type && !(value instanceof type)) {
            throw new Error(`Expected type ${type.name}, Found: ${value}`);
        }
        return value;
    }

    /**
     * Returns the top value on the stack without removing it, ensuring it matches the expected type.
     * @param type - The expected type of the value (optional).
     * @returns The top value on the stack.
     */
    peek(type?: Function): T {
        if (this.stack.length === 0) {
            throw new Error('Stack is empty!');
        }
        const value = this.stack[this.stack.length - 1];
        if (type && !(value instanceof type)) {
            throw new Error(`Expected type ${type.name}, Found: ${value}`);
        }
        return value;
    }

    /**
     * Clears all values from the stack.
     */
    clear(): void {
        this.stack = [];
    }
}