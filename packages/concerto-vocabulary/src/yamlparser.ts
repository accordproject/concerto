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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcp47 = require('bcp47') as { parse: (tag: string) => object | null };

export interface VocabularyValidationError {
    path: string;
    message: string;
}

type Pairs = YAML.Pair[];

function isNonEmptyStringScalar(node: unknown): boolean {
    return YAML.isScalar(node) && typeof (node as YAML.Scalar).value === 'string' && ((node as YAML.Scalar).value as string).length > 0;
}

function findPair(pairs: Pairs, key: string): YAML.Pair | undefined {
    return pairs.find(p => YAML.isScalar(p.key) && (p.key as YAML.Scalar).value === key) as YAML.Pair | undefined;
}

// checks parse errors only — structurally valid YAML (e.g. sequence or mapping keys) can still pass this
function validateSyntax(yamlStr: string, errors: VocabularyValidationError[]): YAML.Document | null {
    const doc = YAML.parseDocument(yamlStr);
    for (const err of doc.errors) {
        errors.push({ path: '', message: `YAML syntax error: ${err.message}` });
    }
    return errors.length > 0 ? null : doc;
}

function validateNamespace(pairs: Pairs, errors: VocabularyValidationError[]): void {
    const pair = findPair(pairs, 'namespace');
    if (!pair) {
        errors.push({ path: 'namespace', message: 'namespace is required' });
    } else if (!isNonEmptyStringScalar(pair.value)) {
        errors.push({ path: 'namespace', message: 'namespace must be a non-empty string scalar' });
    }
}

const STRUCTURAL_KEYS = new Set(['namespace', 'locale', 'declarations']);

// validates any top-level key outside namespace/locale/declarations — these are namespace-level terms (e.g. tooltip, description)
// each must be a non-empty string scalar; sequences, mappings, booleans, numbers, and null are all invalid
function validateTopLevelNonStructuralValues(pairs: Pairs, errors: VocabularyValidationError[]): void {
    for (const pair of pairs) {
        const key = YAML.isScalar(pair.key) ? (pair.key as YAML.Scalar).value as string : null;
        if (!key || STRUCTURAL_KEYS.has(key)) continue;
        if (!isNonEmptyStringScalar(pair.value)) {
            errors.push({ path: key, message: `'${key}' must be a non-empty string scalar` });
        }
    }
}

// validates each item in a declaration's properties sequence
// entries must be mappings; all values (primary term and extras like tooltip) must be non-empty string scalars
function validatePropertyEntries(seq: YAML.YAMLSeq, declIndex: number, errors: VocabularyValidationError[]): void {
    seq.items.forEach((item, j) => {
        const path = `declarations[${declIndex}].properties[${j}]`;
        if (!YAML.isMap(item)) {
            errors.push({ path, message: `${path} must be a mapping` });
            return;
        }
        const propPairs = (item as YAML.YAMLMap).items as YAML.Pair[];
        if (propPairs.length === 0) {
            errors.push({ path, message: `${path} must not be an empty mapping` });
            return;
        }
        for (const pair of propPairs) {
            const key = YAML.isScalar(pair.key) ? (pair.key as YAML.Scalar).value as string : null;
            if (!key) continue;
            if (!isNonEmptyStringScalar(pair.value)) {
                errors.push({ path: `${path}.${key}`, message: `${path}.${key} must be a non-empty string scalar` });
            }
        }
    });
}

// validates each declaration entry: primary term (first key, e.g. Vehicle) must be a string scalar,
// extra named terms (e.g. tooltip, description) must be string scalars,
// properties if present must be a block sequence
function validateDeclarationEntries(seq: YAML.YAMLSeq, errors: VocabularyValidationError[]): void {
    seq.items.forEach((item, i) => {
        if (!YAML.isMap(item)) {
            errors.push({ path: `declarations[${i}]`, message: `declarations[${i}] must be a mapping` });
            return;
        }
        const declPairs = (item as YAML.YAMLMap).items as YAML.Pair[];
        if (declPairs.length === 0) {
            errors.push({ path: `declarations[${i}]`, message: `declarations[${i}] must not be an empty mapping` });
            return;
        }
        const primaryPair = declPairs[0];
        if (primaryPair) {
            const key = YAML.isScalar(primaryPair.key) ? (primaryPair.key as YAML.Scalar).value as string : null;
            if (key && !isNonEmptyStringScalar(primaryPair.value)) {
                errors.push({ path: `declarations[${i}].${key}`, message: `declarations[${i}].${key} must be a non-empty string scalar` });
            }
        }
        for (const pair of declPairs.slice(1)) {
            const key = YAML.isScalar(pair.key) ? (pair.key as YAML.Scalar).value as string : null;
            if (!key) continue;
            if (key === 'properties') {
                if (!YAML.isSeq(pair.value)) {
                    errors.push({ path: `declarations[${i}].properties`, message: `declarations[${i}].properties must be a sequence` });
                } else if ((pair.value as YAML.YAMLSeq).flow) {
                    errors.push({ path: `declarations[${i}].properties`, message: `declarations[${i}].properties must use block sequence style` });
                } else {
                    validatePropertyEntries(pair.value, i, errors);
                }
                continue;
            }
            if (!isNonEmptyStringScalar(pair.value)) {
                errors.push({ path: `declarations[${i}].${key}`, message: `declarations[${i}].${key} must be a non-empty string scalar` });
            }
        }
    });
}

// entry point for declarations validation — checks the field exists, is a block sequence, then delegates to entry validation
function validateDeclarations(pairs: Pairs, errors: VocabularyValidationError[]): void {
    const pair = findPair(pairs, 'declarations');
    if (!pair) {
        errors.push({ path: 'declarations', message: 'declarations is required' });
    } else if (!YAML.isSeq(pair.value)) {
        errors.push({ path: 'declarations', message: 'declarations must be a sequence' });
    } else if ((pair.value as YAML.YAMLSeq).flow) {
        errors.push({ path: 'declarations', message: 'declarations must use block sequence style' });
    } else {
        validateDeclarationEntries(pair.value, errors);
    }
}

function validateLocale(pairs: Pairs, errors: VocabularyValidationError[]): void {
    const pair = findPair(pairs, 'locale');
    if (!pair) {
        errors.push({ path: 'locale', message: 'locale is required' });
    } else if (!isNonEmptyStringScalar(pair.value)) {
        errors.push({ path: 'locale', message: 'locale must be a non-empty string scalar' });
    } else {
        const val = (pair.value as YAML.Scalar).value as string;
        if (!bcp47.parse(val)) {
            errors.push({ path: 'locale', message: `locale is not a valid BCP-47 tag: '${val}'` });
        }
    }
}

/**
 * Validates vocabulary YAML, collecting all structural and type errors without coercing values.
 * @param {string} yamlStr the YAML string to validate
 * @returns {{ errors: VocabularyValidationError[] }}
 */
export function validateVocabularyYaml(yamlStr: string): { errors: VocabularyValidationError[] } {
    const errors: VocabularyValidationError[] = [];

    const doc = validateSyntax(yamlStr, errors);
    if (!doc) {
        return { errors };
    }

    const pairs: Pairs = YAML.isMap(doc.contents) ? doc.contents.items : [];

    // <validation> top-level 'namespace' field
    //   required; must be a non-empty string scalar
    //   invalid: missing, null, empty string, boolean, number, sequence, mapping
    //   valid: `namespace: org.acme@1.0.0`
    validateNamespace(pairs, errors);

    // <validation> top-level 'locale' field
    //   required; must match BCP-47 format /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/
    //   invalid: missing, null, `en_GB`, `not-a-locale`
    //   valid: `en`, `en-GB`, `en-gb`, `fr`, `zh-CN`
    validateLocale(pairs, errors);

    // <validation> top-level 'declarations' field
    //   required; must be a YAML sequence (block or flow array)
    //   invalid: missing, null, scalar, mapping
    //   valid: a block sequence `declarations:\n  - Vehicle: ...`
    validateDeclarations(pairs, errors);

    // <validation> top-level non-structural keys (anything other than namespace/locale/declarations)
    //   each value must be a non-empty string scalar
    //   invalid: `tooltip: true`, `tooltip: [a, b]`, `tooltip:\n  - a`
    //   valid: `tooltip: Acme`
    validateTopLevelNonStructuralValues(pairs, errors);

    return { errors };
}

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
