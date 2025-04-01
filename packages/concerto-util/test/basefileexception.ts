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
import BaseFileException from '../src/basefileexception';
import { expect } from 'chai';

describe('BaseFileException', () => {
    describe('#constructor', () => {
        it('should return an instance of BaseFileException', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message');
            expect(exc).to.be.an.instanceOf(BaseException);
            expect(exc.component).to.equal('@accordproject/concerto-util');
        });

        it('should return an instance of BaseFileException for another component', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message', 'file', 'foo');
            expect(exc).to.be.an.instanceOf(BaseException);
            expect(exc.component).to.equal('foo');
        });

        it('should have a fileLocation', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message');
            expect(exc.getFileLocation()).to.deep.equal({ start: 1, end: 2 });
        });

        it('should have a short message', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message');
            expect(exc.getShortMessage()).to.equal('message');
        });

        it('should have a stack trace', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message');
            expect(exc.stack).to.be.a('string');
        });

        it('should have a file name', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message', 'file name');
            expect(exc.getFileName()).to.equal('file name');
        });

        it('should use message over fullMessage', () => {
            const exc = new BaseFileException('message', { start: 1, end: 2 });
            expect(exc.message).to.equal('message');
        });

        it('should handle a lack of support for stack traces', () => {
            const originalCaptureStackTrace = Error.captureStackTrace as ((targetObject: object, constructorOpt?: Function | undefined) => void) | undefined;
            (Error as any).captureStackTrace = undefined;
            try {
                const exc = new BaseFileException('message', { start: 1, end: 2 }, 'full message');
                expect(exc).to.be.an.instanceOf(BaseException);
                expect(exc.stack).to.be.a('string');
            } finally {
                (Error as any).captureStackTrace = originalCaptureStackTrace;
            }
        });
    });
});