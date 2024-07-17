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

/**
 * Wrapper class to wrap the decorator command and the index of the command
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DcsIndexWrapper {

    /**
     * Create the DcsIndexWrapper.
     * @constructor
     * @param {*} command - the decorator command
     * @param {number} index - the index of the command
     */
    constructor(command, index) {
        this.command = command;
        this.index = index;
    }

    /**
     * Get the decorator command.
     * @returns {*} The decorator command.
     */
    getCommand() {
        return this.command;
    }

    /**
     * Get the index of the command.
     * @returns {number} The index of the command.
     */
    getIndex() {
        return this.index;
    }
}

module.exports = DcsIndexWrapper;