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
// P0-04b trial scaffold: the kinds the trial units raise).
//
// The payload is {kind, code, params, message, location, errorType,
// modelFile}. `message` is the raw rendered message: each TS constructor
// decorates it exactly as it does for the TS code path.

import { BaseException } from '@accordproject/concerto-util';
import IllegalModelException from '../introspect/illegalmodelexception';

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
    Validator: (p) => new BaseException(p.message, undefined, p.errorType),
    Error: (p) => new Error(p.message),
    JsTypeError: (p) => new TypeError(p.message),
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
