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



import BaseException from '../src/baseexception';
import { expect } from 'chai';

describe('BaseException', () => {
    describe('#constructor', () => {
        it('should return an instance of Error', () => {
            const exc = new BaseException('hello world');
            expect(exc).to.be.an.instanceOf(Error);
            expect(exc.component).to.equal('@accordproject/concerto-util');
        });

        it('should return an instance of Error for another component', () => {
            const exc = new BaseException('hello world', 'foo');
            expect(exc).to.be.an.instanceOf(Error);
            expect(exc.component).to.equal('foo');
        });

        it('should have a name', () => {
            const exc = new BaseException('hello world');
            expect(exc.name).to.be.a('string');
        });

        it('should have a message', () => {
            const exc = new BaseException('hello world');
            expect(exc.message).to.equal('hello world');
        });

        it('should have a stack trace', () => {
            const exc = new BaseException('hello world');
            expect(exc.stack).to.be.a('string');
        });

        it('should handle a lack of support for stack traces', () => {
            // Use type assertion to bypass the type error
            const originalCaptureStackTrace = Error.captureStackTrace as ((targetObject: object, constructorOpt?: Function | undefined) => void) | undefined;
            (Error as any).captureStackTrace = undefined;
            try {
                const exc = new BaseException('hello world');
                expect(exc).to.be.an.instanceOf(Error);
                expect(exc.stack).to.be.a('string');
            } finally {
                (Error as any).captureStackTrace = originalCaptureStackTrace;
            }
        });
    });
});