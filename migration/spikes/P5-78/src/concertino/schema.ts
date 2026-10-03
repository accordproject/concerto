/*
 * P5-78 spike (accordproject/concerto-rust#420): `@accordproject/concertino/schema`,
 * the JSON-schema check of a Concertino document as its own subpath. Not shipped.
 *
 * `schema-validator.mjs` is generated at build time by bin/build-schema-validator.mjs
 * with ajv's standalone code generation (ajv/dist/standalone), so the browser
 * bundle carries the compiled checks and a few ajv runtime helpers, not the
 * ajv compiler, and never calls `new Function` (strict-CSP safe).
 */
// @ts-ignore generated file
import validateConcertinoSchema from './schema-validator.mjs';
import type { IConcertino } from './spec/concertino.metamodel@5.0.0';

export interface SchemaError {
    instancePath: string;
    message?: string;
    keyword: string;
    params: unknown;
}

/**
 * Check a document against concertino.schema.json.
 * @param concertino the document
 * @returns the errors, or null when the document is valid
 */
export function checkSchema(concertino: IConcertino | unknown): SchemaError[] | null {
    const ok = validateConcertinoSchema(concertino);
    return ok ? null : (validateConcertinoSchema.errors as SchemaError[]);
}

/**
 * @param concertino the document
 * @returns true when the document matches concertino.schema.json
 */
export function isValid(concertino: IConcertino | unknown): boolean {
    return checkSchema(concertino) === null;
}
