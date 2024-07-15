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

class DcsIndexWrapper {

    constructor(command, index) {
        this.command = command;
        this.index = index;
    }

    /**
     * Get the command
     * @return {*} the command
     */
    getCommand() {
        return this.command;
    }

    /**
     * Get the index
     * @return {number} the index
     */
    getIndex() {
        return this.index;
    }
}

module.exports = DcsIndexWrapper;