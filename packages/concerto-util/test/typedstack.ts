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



import { strict as assert } from 'assert';
import chai, { expect } from 'chai';
import TypedStack from '../src/typedstack';

describe('TypedStack', () => {
    describe('#push', () => {
        it('check push with wrong type', () => {
            const ts = new TypedStack('ROOT');
            assert.throws(
                () => ts.push('1', String),
                /Did not find expected type Function as argument to push. Found: 1/,
                'did not throw with expected message'
            );
        });
    });

    describe('#pop', () => {
        it('check pop with empty stack', () => {
            const ts = new TypedStack('ROOT');
            ts.pop();
            assert.throws(
                () => ts.pop(),
                /Stack is empty!/,
                'did not throw with expected message'
            );
        });

        it('check pop with wrong type', () => {
            const ts = new TypedStack('ROOT');
            assert.throws(
                () => ts.pop(Number),
                /Found: ROOT/,
                'did not throw with expected message'
            );
        });
    });

    describe('#peek', () => {
        it('should throw an error if value given has wrong types', () => {
            const ts = new TypedStack('ROOT');
            assert.throws(
                () => ts.peek(Number),
                /Found: ROOT/,
                'did not throw with expected message'
            );
        });
    });

    describe('#clear', () => {
        it('should clear the stack', () => {
            const ts = new TypedStack('ROOT');
            expect(ts.peek()).to.equal('ROOT');
            ts.clear();
            expect(() => ts.peek()).to.throw('Stack is empty!');
        });
    });
});