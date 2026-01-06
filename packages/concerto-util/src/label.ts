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
 * Inserts correct spacing and capitalization to a camelCase label
 * @param labelName - the label text to be transformed
 * @returns - The label text formatted for rendering
 */
export function labelToSentence(labelName: string = ''): string {
    return labelName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([a-z])/g, ' $1$2')
        .replace(/ +/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Create a camelCase label from a sentence
 * @param sentence - the sentence
 * @returns - The camelCase label
 */
export function sentenceToLabel(sentence: string = ''): string {
    const split = sentence.split(/[^A-Za-z0-9_-]+/);
    split.forEach((word, index) => {
        split[index] = split[index].replace(/^./, str => str.toUpperCase());
    });
    const joined = split.join('');
    return joined.replace(/^./, str => str.toLowerCase());
}