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

const n2words = require('n2words');

/**
 * Utilities for monetary and number formatting.
 * @class
 * @memberof module:concerto-util
 */
class MonetaryUtil {

    /**
     * Converts a number to its written word representation.
     * @param {number} number - The number to convert (e.g. 100)
     * @param {string} [lang='en'] - The language code (default 'en')
     * @returns {string} The written string (e.g. "one hundred")
     */
    static toWords(number, lang = 'en') {
        return n2words(number, { lang: lang });
    }
}

module.exports = MonetaryUtil;