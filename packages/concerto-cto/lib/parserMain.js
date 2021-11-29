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

const Parser = require('./parser');
const ParseException = require('./parseexception');

/**
 * Create decorator argument string from a metamodel
 * @param {object} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @return {string} the string for the decorator argument
 */
function parse(cto, fileName) {
    try {
        return Parser.parse(cto);
    } catch(err) {
        if(err.location && err.location.start) {
            throw new ParseException(err.message, err.location, fileName);
        }
        else {
            throw err;
        }
    }
}

module.exports = {
    parse,
};
