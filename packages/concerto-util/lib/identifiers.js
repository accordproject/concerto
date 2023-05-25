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

// Conforms to Concerto Spec for identifiers
const ID_REGEX = /^(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4})(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|\u200C|\u200D)*$/u;

/**
 * Function that attempts to normalize arbitrary strings
 * into valid Concerto identifiers
 *
 * @param {string} identifier - the input value
 * @param {number} [truncateLength] - Length at which to truncate the identifier
 * @returns {string} - An identifier that meets the Concerto specification
 */
function normalizeIdentifier(identifier, truncateLength = -1) {
    const replacer = (_match, group1) => {
        let escapedChar = '';
        // Loop through characters with multiple code points
        for (const codePoint of group1) {
            escapedChar += `_${codePoint.codePointAt(0).toString(16)}`;
        }
        return escapedChar;
    };

    // Stringify null & undefined values
    let result = identifier ?? String(identifier);

    if (typeof result !== 'string'){
        throw new Error(`Unsupported identifier type, '${typeof result}'.`);
    }

    // 1. If the identifier begins with a number, add a leading underscore
    result = result
        .replace(/^\p{Nd}/u, '_$&')

    // 2. Substitute Whitespace, and joiners
        .replace(/[-‐−@#:;,><|/\\\u200c\u200d]/g, '_')
        .replace(/\s/g, '_')

    // 3a. Replace Invalid Characters
        .replace(/(?!\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|\u200C|\u200D|\\u[0-9A-Fa-f]{4})(.)/gu, replacer)

    // 3b. Escape Surrogate Pairs
        .replace(/([\uD800-\uDFFF])/g, replacer);

    // 4. Optionally truncate the identifier
    if (truncateLength > 0){
        result = result.substring(0,truncateLength);
    }

    // Check validity
    if (!ID_REGEX.test(result)){
        throw new Error(`Unexpected error. Not able to escape identifier '${result}'.`);
    }
    return result;
}

module.exports = {
    normalizeIdentifier,
    ID_REGEX
};
