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

const { TypedStack } = require('@accordproject/concerto-util');
const RandExp = require('randexp');
const ResourceValidator = require('./resourcevalidator');
const ValidationException = require('./validationexception');

/**
 * Structured diagnostic emitted by {@link validateInstance}.
 */
export interface Diagnostic {
    /** Stable machine-readable code, e.g. 'MISSING_REQUIRED_FIELD'. */
    code: string;
    /** Human-readable message; not stable, do not parse. */
    message: string;
    /** JSON Pointer (RFC 6901) to the offending value; '/' is the root. */
    path: string;
    /** 'error' or 'warning'. */
    severity: 'error' | 'warning';
    /** The fully-qualified type of the expected value, when relevant. */
    expected?: string;
    /** The actual type or value observed, when relevant. */
    actual?: string;
    /** The original Error, if this diagnostic wraps one. */
    cause?: Error;
}

/**
 * Options accepted by the instance-validation entry points.
 */
export interface ValidateInstanceOptions {
    /**
     * Collect all diagnostics rather than stopping at the first error.
     * Defaults to `true`.
     */
    collectAll?: boolean;
    /** Forwarded to Serializer.fromJSON: enforce qualified date-times. */
    strictQualifiedDateTimes?: boolean;
    /** Forwarded to Serializer.fromJSON: allow Resources in relationship slots. */
    acceptResourcesForRelationships?: boolean;
    /** UTC offset for DateTime values. */
    utcOffset?: number;
}

/**
 * Outcome of an instance validation. Discriminated on `valid`.
 */
export type ValidationResult =
    | { valid: true; resource: any; warnings: Diagnostic[] }
    | { valid: false; resource: null; errors: Diagnostic[]; warnings: Diagnostic[] };

/**
 * Convert a thrown error into a single Diagnostic. Used for failures that
 * happen before the visitor can even start (e.g. unknown $class).
 * @param {string} code diagnostic code
 * @param {unknown} err thrown error
 * @returns {Diagnostic} a structured diagnostic
 * @private
 */
function diagnosticFromError(code: string, err: unknown): Diagnostic {
    const message = err instanceof Error ? err.message : String(err);
    return {
        code,
        message,
        path: '/',
        severity: 'error',
        cause: err instanceof Error ? err : undefined,
    };
}

/**
 * Build a "wrong $class" diagnostic when the expected fully-qualified type
 * does not match (and is not a supertype of) the type in the JSON instance.
 * @param {string} expected the expected fully-qualified type
 * @param {string} actual the observed `$class`
 * @returns {Diagnostic} a TYPE_MISMATCH diagnostic
 * @private
 */
function typeMismatchDiagnostic(expected: string, actual: string): Diagnostic {
    return {
        code: 'TYPE_MISMATCH',
        message: `Expected an instance of '${expected}' (or a subtype) but found '${actual}'.`,
        path: '/',
        expected,
        actual,
        severity: 'error',
    };
}

/**
 * Returns true if `actualFqn` is `expectedFqn` or any of its subclasses.
 * @param {*} modelManager the model manager
 * @param {string} expectedFqn the expected fully-qualified type
 * @param {string} actualFqn the observed fully-qualified type
 * @returns {boolean} whether actualFqn is assignable to expectedFqn
 * @private
 */
function isSubtypeOrSame(modelManager: any, expectedFqn: string, actualFqn: string): boolean {
    if (expectedFqn === actualFqn) {
        return true;
    }
    try {
        const actualDecl = modelManager.getType(actualFqn);
        let cursor = actualDecl;
        while (cursor) {
            if (cursor.getFullyQualifiedName() === expectedFqn) {
                return true;
            }
            cursor = cursor.getSuperTypeDeclaration?.();
        }
    } catch {
        // unknown type → not assignable
    }
    return false;
}

/**
 * Validate a plain JS object against a class declaration. The single entry
 * point shared by `ClassDeclaration.validateInstance` and
 * `ModelManager.validateInstance`.
 *
 * Always uses the existing `Serializer.fromJSON` + `ResourceValidator`
 * pipeline; the only difference from `Serializer.fromJSON(json).validate()`
 * is that, by default, diagnostics are aggregated rather than thrown on the
 * first error.
 *
 * Aggregation is best-effort. Errors that the JSON populator rejects up
 * front (e.g. a number passed where a string field is expected, or extra
 * unknown properties) surface as a single `DESERIALIZATION_ERROR`. Once
 * deserialization succeeds, all remaining model violations (regex/range
 * violations, missing required fields, invalid enum values, abstract
 * instantiation, undeclared subtypes, etc.) are aggregated.
 *
 * @param {*} classDeclaration the expected ClassDeclaration
 * @param {unknown} json the JSON instance to validate
 * @param {ValidateInstanceOptions} [options] validation options
 * @returns {ValidationResult} the structured validation outcome
 */
export function validateInstance(
    classDeclaration: any,
    json: unknown,
    options: ValidateInstanceOptions = {},
): ValidationResult {
    const errors: Diagnostic[] = [];
    const warnings: Diagnostic[] = [];
    const collectAll = options.collectAll !== false;
    const modelManager = classDeclaration.getModelFile().getModelManager();
    const expectedFqn = classDeclaration.getFullyQualifiedName();

    if (json === null || typeof json !== 'object') {
        errors.push({
            code: 'TYPE_MISMATCH',
            message: `Expected an object instance of '${expectedFqn}' but got ${json === null ? 'null' : typeof json}.`,
            path: '/',
            expected: expectedFqn,
            actual: json === null ? 'null' : typeof json,
            severity: 'error',
        });
        return { valid: false, resource: null, errors, warnings };
    }

    const $class = (json as any).$class;
    if (typeof $class !== 'string') {
        errors.push({
            code: 'MISSING_CLASS',
            message: 'Input object is missing a $class type identifier.',
            path: '/',
            expected: expectedFqn,
            severity: 'error',
        });
        return { valid: false, resource: null, errors, warnings };
    }

    if (!isSubtypeOrSame(modelManager, expectedFqn, $class)) {
        errors.push(typeMismatchDiagnostic(expectedFqn, $class));
        if (!collectAll) {
            return { valid: false, resource: null, errors, warnings };
        }
    }

    // Stage 1: deserialise without validation. If $class is unknown or the
    // populator itself rejects the input, surface the cause as a diagnostic.
    const serializer = modelManager.getSerializer();
    let resource: any;
    try {
        resource = serializer.fromJSON(json, {
            validate: false,
            strictQualifiedDateTimes: options.strictQualifiedDateTimes,
            acceptResourcesForRelationships: options.acceptResourcesForRelationships,
            utcOffset: options.utcOffset,
        });
    } catch (err) {
        errors.push(diagnosticFromError('DESERIALIZATION_ERROR', err));
        return errors.length > 0
            ? { valid: false, resource: null, errors, warnings }
            : { valid: true, resource: null as any, warnings };
    }

    // Stage 2: walk the resource through the validator in collect mode.
    const declToWalk = modelManager.getType(resource.getFullyQualifiedType());
    const validator = new ResourceValidator({
        acceptResourcesForRelationships: options.acceptResourcesForRelationships,
        utcOffset: options.utcOffset,
    });
    const stageErrors: Diagnostic[] = [];
    const parameters: any = {
        stack: new TypedStack(resource),
        modelManager,
        rootResourceIdentifier: resource.getIdentifier?.() ?? '',
        pathStack: [],
    };
    if (collectAll) {
        parameters.errorCollector = stageErrors;
    }

    try {
        declToWalk.accept(validator, parameters);
    } catch (err) {
        if (collectAll) {
            // Collector mode should not surface exceptions; if one escapes it's
            // a bug in the validator. Record it so the caller sees something
            // useful rather than crashing.
            stageErrors.push(diagnosticFromError('VALIDATION_ERROR', err));
        } else {
            errors.push(diagnosticFromError('VALIDATION_ERROR', err));
        }
    }

    errors.push(...stageErrors);

    if (errors.length > 0) {
        return { valid: false, resource: null, errors, warnings };
    }
    return { valid: true, resource, warnings };
}

/**
 * Like {@link validateInstance} but throws a {@link ValidationException} with
 * an aggregated message if validation fails. Returns the populated Resource
 * on success.
 *
 * @param {*} classDeclaration the expected ClassDeclaration
 * @param {unknown} json the JSON instance to validate
 * @param {ValidateInstanceOptions} [options] validation options
 * @returns {*} the populated Resource
 * @throws {ValidationException} aggregated validation failure
 */
export function validateInstanceOrThrow(
    classDeclaration: any,
    json: unknown,
    options: ValidateInstanceOptions = {},
): any {
    const result = validateInstance(classDeclaration, json, options);
    if (result.valid) {
        return result.resource;
    }
    const errors = result.errors;
    const summary = errors.length === 1
        ? errors[0].message
        : `${errors.length} validation errors:\n` + errors.map(e => `  - [${e.code}] ${e.path}: ${e.message}`).join('\n');
    const ex: any = new ValidationException(summary);
    ex.diagnostics = errors;
    throw ex;
}

/**
 * Boolean shortcut over {@link validateInstance}. Useful as a TypeScript type
 * guard.
 *
 * @param {*} classDeclaration the expected ClassDeclaration
 * @param {unknown} json the JSON instance to test
 * @param {ValidateInstanceOptions} [options] validation options
 * @returns {boolean} true iff the JSON is a valid instance
 */
export function isValidInstance(
    classDeclaration: any,
    json: unknown,
    options: ValidateInstanceOptions = {},
): boolean {
    return validateInstance(classDeclaration, json, { ...options, collectAll: false }).valid;
}

/**
 * Options accepted by {@link generateSample}.
 */
export interface SampleOptions {
    /** 'sample' (deterministic placeholder values) or 'empty'. Defaults to 'sample'. */
    generate?: 'sample' | 'empty';
    /** Include optional fields in the generated instance. */
    includeOptionalFields?: boolean;
}

/**
 * Generate a JSON instance that conforms to the given class declaration.
 * Thin wrapper over `Factory.newResource({ generate })` followed by
 * `Serializer.toJSON`.
 *
 * @param {*} classDeclaration the type to generate
 * @param {SampleOptions} [options] generation options
 * @returns {object} a conforming JSON object
 */
export function generateSample(
    classDeclaration: any,
    options: SampleOptions = {},
): Record<string, unknown> {
    const modelManager = classDeclaration.getModelFile().getModelManager();
    const factory = modelManager.getFactory();
    const serializer = modelManager.getSerializer();

    let id: string | null = null;
    if (classDeclaration.isIdentified()) {
        const idFieldName = classDeclaration.getIdentifierFieldName();
        let idField = classDeclaration.getProperty(idFieldName);
        if (idField?.isTypeScalar?.()) {
            idField = idField.getScalarField();
        }
        if (idField?.validator?.regex) {
            id = new RandExp(idField.validator.regex.source, idField.validator.regex.flags).gen();
        } else {
            id = 'sample-id';
        }
    }

    const resource = factory.newResource(
        classDeclaration.getNamespace(),
        classDeclaration.getName(),
        id,
        {
            generate: options.generate ?? 'sample',
            includeOptionalFields: options.includeOptionalFields ?? false,
        },
    );
    return serializer.toJSON(resource);
}
