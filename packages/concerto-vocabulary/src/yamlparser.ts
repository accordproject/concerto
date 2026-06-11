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

import YAML from 'yaml';

/**
 * Parses vocabulary YAML, ensuring all non-structural collection values remain strings.
 * YAML.parse can incorrectly interpret flow syntax (e.g. {Човек} or [value])
 * as objects/arrays — in vocabularies, these should be preserved as literal strings.
 * Only 'declarations' and 'properties' are kept as actual collections.
 * @param {string} yamlStr the YAML string to parse
 * @returns {*} the parsed vocabulary object
 */
export function parseVocabularyYaml(yamlStr: string): any {
    const doc = YAML.parseDocument(yamlStr);
    if (doc.errors.length > 0) {
        throw doc.errors[0];
    }
    YAML.visit(doc, {
        Pair(_, pair) {
            const key = (pair.key as YAML.Scalar).value;
            const value = pair.value;

            if (key === 'declarations' || key === 'properties') {
                return;
            }

            if (YAML.isScalar(value) && typeof value.value !== 'string') {
                pair.value = new YAML.Scalar(String(value.value));
                return;
            }

            if (YAML.isCollection(value)) {
                if (value.range) {
                    const [start, end] = value.range as [number, number, number];
                    pair.value = new YAML.Scalar(yamlStr.substring(start, end));
                } else {
                    pair.value = new YAML.Scalar(JSON.stringify(value.toJSON()));
                }
            }
        },
    });
    return doc.toJSON();
}
