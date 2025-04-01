/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
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

import { expect } from 'chai';
import sinon from 'sinon';
import { printDeprecationWarning, resetWarningFlag } from '../src/warning';

describe('printDeprecationWarning', () => {
    let mockEmitWarning: sinon.SinonStub;

    beforeEach(() => {
        // Stub process.emitWarning to track calls
        mockEmitWarning = sinon.stub(process, 'emitWarning');
        resetWarningFlag(); // Ensure fresh state before each test
    });

    afterEach(() => {
        // Restore original process.emitWarning behavior
        mockEmitWarning.restore();
    });

    it('should emit the correct deprecation warning message', () => {
        const message = 'This feature is deprecated';
        const type = 'Deprecation';
        const code = 'DEP001';
        const detail = 'Please use the new feature instead';

        // Invoke the function
        printDeprecationWarning(message, type, code, detail);

        // Assertions
        expect(mockEmitWarning.calledOnce).to.be.true;
        expect(mockEmitWarning.calledWithExactly(`DEPRECATED: ${message}`, { type, code, detail })).to.be.true;
    });

    it('should not emit a warning if already emitted once', () => {
        // Call twice
        printDeprecationWarning('Message 1', 'Type 1', 'CODE1', 'Detail 1');
        printDeprecationWarning('Message 2', 'Type 2', 'CODE2', 'Detail 2');

        // Ensure only one warning was emitted
        expect(mockEmitWarning.calledOnce).to.be.true;
    });

    it('should fallback to console.warn if process.emitWarning is unavailable', () => {
        // Remove the stub so we can test fallback behavior
        mockEmitWarning.restore();
        const mockConsoleWarn = sinon.stub(console, 'warn');

        // Simulate missing emitWarning
        (process as any).emitWarning = undefined;

        printDeprecationWarning('Fallback message', 'WarningType', 'CODEX', 'Some details');

        // Assertions
        expect(mockConsoleWarn.calledOnce).to.be.true;
        expect(mockConsoleWarn.calledWithExactly(
            'DEPRECATED: Fallback message (Type: WarningType, Code: CODEX, Detail: Some details)'
        )).to.be.true;

        // Restore console.warn
        mockConsoleWarn.restore();
    });
});
