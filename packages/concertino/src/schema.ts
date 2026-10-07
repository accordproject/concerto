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
 * `@accordproject/concertino/schema`: checks a Concertino document against
 * concertino.schema.json.
 *
 * The checks are compiled from the schema at build time
 * (scripts/generateSchemaValidator.js, ajv standalone code), so this module
 * needs neither ajv nor `new Function` at run time. Import it on its own when
 * you only need the schema check; the converter entry point does not need it.
 */
import validate from './spec/concertinoSchemaValidator';
import type { IConcertino } from './spec/concertino.metamodel@5.0.0';

/**
 * One schema error, as ajv reports it (ajv's `ErrorObject`).
 */
export interface SchemaError {
    keyword: string;
    instancePath: string;
    schemaPath: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: Record<string, any>;
    propertyName?: string;
    message?: string;
    schema?: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentSchema?: any;
    data?: unknown;
}

/**
 * The generated validator: a function that sets `errors` after each call, as ajv's do.
 */
const validateConcertinoSchema = validate as unknown as {
    (data: unknown): boolean;
    errors?: SchemaError[] | null;
};

/**
 * Checks a document against concertino.schema.json.
 * @param {IConcertino | unknown} concertino - The document to check.
 * @returns {SchemaError[] | null} The errors, or null when the document is valid.
 */
export function checkSchema(concertino: IConcertino | unknown): SchemaError[] | null {
    if (validateConcertinoSchema(concertino)) {
        return null;
    }
    return validateConcertinoSchema.errors ?? null;
}

/**
 * Whether a document matches concertino.schema.json.
 * @param {IConcertino | unknown} concertino - The document to check.
 * @returns {boolean} True when the document is valid.
 */
export function isValid(concertino: IConcertino | unknown): boolean {
    return checkSchema(concertino) === null;
}
