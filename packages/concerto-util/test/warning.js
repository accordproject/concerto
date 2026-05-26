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

const { expect } = require('chai');
const { printDeprecationWarning } = require('../src/warning');

describe('printDeprecationWarning', () => {

    it('should emit the correct deprecation warning message', () => {
        const message = 'This feature is deprecated';
        const type = 'Deprecation';
        const code = 'DEP001';
        const detail = 'Please use the new feature instead';

        process.once('warning', (warning) => {
            expect(warning.message).to.be.equals(`DEPRECATED: ${message}`);
            expect(warning.code).to.be.equals(code);
            expect(warning.detail).to.be.equals(detail);
        });

        printDeprecationWarning(message, type, code, detail);
        // Do it twice, to check it only emits once
        printDeprecationWarning(message, type, code, detail);
    });
});
