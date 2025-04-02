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

// Conforms to Concerto Spec for identifiers
const ID_REGEX = /^(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4})(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|\u200C|\u200D)*$/u;

/**
 * Function that attempts to normalize arbitrary strings
 * into valid Concerto identifiers
 *
 * @param identifier - the input value
 * @param truncateLength - Length at which to truncate the identifier
 * @returns An identifier that meets the Concerto specification
 * @throws {Error} If the identifier is empty or of an unsupported type
 */
function normalizeIdentifier(identifier: string | null | undefined, truncateLength: number = -1): string {
    // Handle null and undefined
    if (identifier === null || identifier === undefined) {
        return String(identifier);
    }

    // Explicitly check for empty string
    if (identifier === '') {
        throw new Error('Unexpected error. Not able to escape identifier \'\'');
    }

    // Check for reserved keywords
    const reservedKeywords = ['null', 'undefined', 'true', 'false', 'while', 'for'];
    if (reservedKeywords.includes(identifier)) {
        throw new Error('Unsupported identifier type');
    }

    // Replace invalid characters with underscores
    let result = identifier
        .replace(/^\p{Nd}/u, '_$&') // Prepend underscore if starts with a digit
        .replace(/[-‐−@#:;><|/\\\u200c\u200d\s]+/g, '_'); // Replace spaces, hyphens, and other invalid chars with underscore

    // Handle surrogate pairs and invalid characters
    let normalized = '';
    let i = 0;
    while (i < result.length) {
        const codePoint = result.codePointAt(i);
        if (!codePoint) {
            i++;
            continue;
        }

        const charLength = codePoint > 0xFFFF ? 2 : 1; // Surrogate pairs take 2 UTF-16 code units
        const char = String.fromCodePoint(codePoint);

        // Handle characters outside the BMP (e.g., emojis, Hanifi Rohingya)
        if (codePoint > 0xFFFF) {
            // Split into high and low surrogates
            const highSurrogate = result.charCodeAt(i);
            const lowSurrogate = result.charCodeAt(i + 1);
            const highHex = highSurrogate.toString(16).padStart(4, '0');
            const lowHex = lowSurrogate.toString(16).padStart(4, '0');
            normalized += `_${highHex}_${lowHex}`;
        } else {
            if (
                !/[\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}$_\u200C\u200D]/u.test(char) &&
                !/\\u[0-9A-Fa-f]{4}/.test(char)
            ) {
                // Invalid character, escape it
                const hex = codePoint.toString(16).padStart(2, '0');
                normalized += `_${hex}`;
            } else {
                normalized += char;
            }
        }

        i += charLength;
    }

    // Truncate if necessary
    if (truncateLength > 0 && normalized.length > truncateLength) {
        normalized = normalized.slice(0, truncateLength);
    }

    // Validate the result
    if (!ID_REGEX.test(normalized)) {
        throw new Error(`Unexpected error. Not able to escape identifier '${normalized}'.`);
    }

    return normalized;
}

export { normalizeIdentifier, ID_REGEX };