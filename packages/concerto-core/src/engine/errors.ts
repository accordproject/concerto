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

/* istanbul ignore file */
// Maps the engine's error payload to the TS exception class (PORTING.md 2.3;
// P4-02). Every ErrorKind concerto-rust's error/mod.rs defines has an entry
// here, so a ported member is never left throwing the "unknown engine error
// kind" fallback just because it is not one of the P0-04b trial units.
//
// The payload is {kind, code, params, message, location, errorType,
// modelFile}. `message` is the raw rendered message: each TS constructor
// decorates it exactly as it does for the TS code path.

import { BaseException } from '@accordproject/concerto-util';
import IllegalModelException from '../introspect/illegalmodelexception';
import TypeNotFoundException from '../typenotfoundexception';
import ValidationException from '../serializer/validationexception';
import MetamodelException from '../metamodelexception';

/**
 * The error payload the engine hands to the factory.
 */
interface ErrorPayload {
    kind: string;
    code: string;
    params: Record<string, string>;
    message: string;
    location?: unknown;
    errorType?: string;
    modelFile?: unknown;
}

const FACTORIES: Record<string, (p: ErrorPayload) => Error> = {
    IllegalModel: (p) => new IllegalModelException(p.message, p.modelFile, p.location),
    // `TypeNotFoundException(typeName, message)`: `typeName` travels in
    // `params.typeName` (concerto-rust error/mod.rs `ContractError::type_not_found`),
    // separately from the rendered `message` the constructor would otherwise
    // recompute a default for.
    TypeNotFound: (p) => new TypeNotFoundException(p.params.typeName, p.message),
    // `ValidationException(message)` (error/mod.rs `ErrorKind::Validation`
    // doc): thrown by `ResourceValidator`'s `report*` methods, and by the
    // populator/generator/validator per-field delegation the P4-10 fast
    // path and views call into (concerto-core/src/instance/populator.rs
    // `validation()`).
    Validation: (p) => new ValidationException(p.message),
    Validator: (p) => new BaseException(p.message, undefined, p.errorType),
    Error: (p) => new Error(p.message),
    JsTypeError: (p) => new TypeError(p.message),
    // error/mod.rs `ErrorKind::JsRangeError` (task accordproject/concerto-rust#151,
    // P2-08b): a JS `RangeError(message)`, the same relationship JsTypeError
    // above has to TypeError.
    JsRangeError: (p) => new RangeError(p.message),
    // `MetamodelException(message)` (P4-08b): thrown by
    // `BaseModelManager.validateAst`.
    Metamodel: (p) => new MetamodelException(p.message),
};

/**
 * Builds the TS exception for an engine error payload.
 * @param {ErrorPayload} payload the payload
 * @return {Error} the exception to throw
 */
function makeError(payload: ErrorPayload): Error {
    const factory = FACTORIES[payload.kind];
    if (!factory) {
        return new Error(`Unknown engine error kind ${payload.kind}: ${payload.message}`);
    }
    return factory(payload);
}

export { makeError };
