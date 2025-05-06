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

const BaseException = require('../lib/baseexception');
const ErrorCodes = require('../lib/errorcodes');

require('chai').should();

describe('BaseException', function () {

    describe('#constructor', function () {

        it('should return an instance of Error', function () {
            let exc = new BaseException('hello world');
            exc.should.be.an.instanceOf(Error);
            exc.component.should.equal('@accordproject/concerto-util');
        });

        it('should return an instance of Error for another component', function () {
            let exc = new BaseException('hello world','foo');
            exc.should.be.an.instanceOf(Error);
            exc.component.should.equal('foo');
        });

        it('should have a name', function () {
            let exc = new BaseException('hello world');
            exc.name.should.be.a('string');
        });

        it('should have a message', function () {
            let exc = new BaseException('hello world');
            exc.message.should.equal('hello world');
        });

        it('should have a stack trace', function () {
            let exc = new BaseException('hello world');
            exc.stack.should.be.a('string');
        });

        it('should handle a lack of support for stack traces', function () {
            let captureStackTrace = Error.captureStackTrace;
            Error.captureStackTrace = null;
            try {
                new BaseException('hello world');
            } finally {
                Error.captureStackTrace = captureStackTrace;
            }
        });

    });

    describe('#getErrorType', function () {
        it('should return the default error type when not specified', function () {
            let exc = new BaseException('hello world');
            exc.getErrorType().should.equal(ErrorCodes.DEFAULT_BASE_EXCEPTION);
        });

        it('should return the specified error type', function () {
            let exc = new BaseException('hello world', 'component', ErrorCodes.TYPE_NOT_FOUND_EXCEPTION);
            exc.getErrorType().should.equal(ErrorCodes.TYPE_NOT_FOUND_EXCEPTION);
        });
    });

});
