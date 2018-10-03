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
const os = require('os');
const path = require('path');

/**
 * Internal Utility Class
 * <p><a href="./diagrams-private/util.svg"><img src="./diagrams-private/util.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:composer-common
 */
class Util {

    /**
     * Returns true if the typeof the object === 'undefined' or
     * the object === null.
     * @param {Object} obj - the object to be tested
     * @returns {boolean} true if the object is null or undefined
     */
    static isNull(obj) {
        return(typeof(obj) === 'undefined' || obj === null);
    }

    /**
     * Get the home directory path for the current user. Returns root directory for environments where there is no
     * file system path available.
     * @returns {String} A file system path.
     */
    static homeDirectory() {
        return (os.homedir && os.homedir()) || path.sep;
    }

}

module.exports = Util;
