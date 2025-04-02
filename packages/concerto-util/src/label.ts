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

/**
 * Inserts correct spacing and capitalization to a camelCase label
 * @param {string | undefined} labelName - the label text to be transformed
 * @returns {string} - The label text formatted for rendering
 */
export function labelToSentence(labelName: string | undefined): string {
    if (!labelName) {
        return '';
    }

    return labelName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([a-z])/g, ' $1$2')
        .replace(/ +/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Create a camelCase label from a sentence
 * @param {string | undefined} sentence - the sentence
 * @returns {string} - The camelCase label
 */
export function sentenceToLabel(sentence: string | undefined): string {
    if (!sentence) {
        return '';
    }

    // Split on spaces and remove special characters
    const words = sentence
        .toLowerCase()
        .replace(/[^a-z\s]/g, '') // Remove special characters like apostrophes
        .split(/\s+/);

    // Convert to camelCase: first word lowercase, subsequent words capitalized
    return words
        .map((word, index) => {
            if (index === 0) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('')
        .trim();
}

