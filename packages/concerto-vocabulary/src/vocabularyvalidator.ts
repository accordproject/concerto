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

function checkValueIsString(value: unknown, path: string, errors: VocabularyValidationError[]): boolean {
    if (YAML.isAlias(value as YAML.Node)) {
        errors.push({ path, message: `${path} must not use a YAML alias` });
        return false;
    }
    if (!isNonEmptyStringScalar(value)) {
        errors.push({ path, message: `${path} must be a non-empty string scalar` });
        return false;
    }
    return true;
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
    } else {
        checkValueIsString(pair.value, 'namespace', errors);
    }
}

const STRUCTURAL_KEYS = new Set(['namespace', 'locale', 'declarations']);

// validates any top-level key outside namespace/locale/declarations — these are namespace-level terms (e.g. tooltip, description)
// each must be a non-empty string scalar; sequences, mappings, booleans, numbers, and null are all invalid
function validateTopLevelNonStructuralValues(pairs: Pairs, errors: VocabularyValidationError[]): void {
    for (const pair of pairs) {
        const key = YAML.isScalar(pair.key) ? (pair.key as YAML.Scalar).value as string : null;
        if (!key || STRUCTURAL_KEYS.has(key)) continue;
        checkValueIsString(pair.value, key, errors);
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
            checkValueIsString(pair.value, `${path}.${key}`, errors);
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
            if (key) checkValueIsString(primaryPair.value, `declarations[${i}].${key}`, errors);
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
            checkValueIsString(pair.value, `declarations[${i}].${key}`, errors);
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
        return;
    }
    if (!checkValueIsString(pair.value, 'locale', errors)) return;
    const val = (pair.value as YAML.Scalar).value as string;
    if (!bcp47.parse(val)) {
        errors.push({ path: 'locale', message: `locale is not a valid BCP-47 tag: '${val}'` });
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

    validateNamespace(pairs, errors);
    validateLocale(pairs, errors);
    validateDeclarations(pairs, errors);
    validateTopLevelNonStructuralValues(pairs, errors);

    return { errors };
}
