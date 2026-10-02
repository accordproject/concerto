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

import Validator from './validator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidatedElement, NumberDomainValidatorAst } from './validator';
/* eslint-enable no-unused-vars */

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Field from './field';
import type ScalarDeclaration from './scalardeclaration';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). Its bindings are typed
// `never` so that a view leaves the member's inferred return type, and so
// the .d.ts, exactly as the TS body used to make it.
//
// dist/, dist/esm and dist/esm-browser ship src/engine/ as JavaScript only,
// with no .d.ts, since it is not public API (tsconfig.build.internal.json;
// OD-11). A bundler must never see a specifier it would resolve: `loadEngine`
// takes a non-literal one (esbuild, rollup and browserify leave it alone) and
// never names the bare `require` (esbuild's ESM output would add its
// `__require` shim, which webpack reports as a critical dependency), and
// webpack folds the `typeof __webpack_require__` test and keeps only the
// dead-in-Node `__non_webpack_require__` branch, so it neither resolves nor
// warns.
//
// Loading through the public ESM entry points (P4-11a, PORTING.md 1.5):
// - Node ESM (dist/esm/index.mjs) works unaided. scripts/build-esm.js's Node
//   banner sets a `globalThis.module` whose `require` resolves the engine
//   specifiers. It does not rely on the relative specifier above matching
//   the output file's location (esbuild hoists shared views into chunks at
//   the outdir root, where `../engine` would point outside dist/). Instead
//   it rewrites `./engine`, `../engine` and `../engine/<subpath>` to the
//   engine directory it finds at runtime from the file's own import.meta.url.
// - The browser (dist/esm-browser/index.mjs) needs a bundler, or a host that
//   supplies a synchronous `require`. This call is synchronous and a browser
//   cannot load an ES module synchronously, so the browser ESM graph does not
//   load dist/esm-browser/engine/*.mjs by itself. scripts/browser-module-shim.js
//   reads `module.require` from the `globalThis.module` that the bundler or
//   host provides, and throws if there is none.
//
// `module.require` is checked before `globalThis.module.require` so that
// real Node CJS always resolves through its own require, exactly as it did
// before this loader gained the ESM/vite-node fallbacks below. Checking
// `globalThis.module` first would break that in the dual-package case: the
// Node-ESM banner (scripts/build-esm.js) sets `globalThis.module` whenever
// it finds it undefined, so a process that imports dist/esm/index.mjs and
// later requires dist/index.js would have the CJS build's own loadEngine
// see that global and load the ESM engine build instead of its own
// dist/engine/index.js.
//
// A module context that gives every loaded file its own `module` with no
// `.require` (Vitest's vite-node, and anything else that behaves the same
// way) falls through this first check, so `globalThis.module.require`
// still reaches a loader a Node-ESM banner installed, regardless of the
// local shadow (this is a plain property read, not a bound alias of
// `require`, so it is as invisible to webpack as `module.require` already
// was, per the banner comment above). `createRequire(__filename)` is the
// final fallback, for a context with neither: it resolves the same
// relative specifier the source file itself sees, unbundled, though it
// cannot find a directory that (like dist/esm/engine/) only has a `.mjs`
// entry.
import { createRequire } from 'module';
import type { EngineBindings } from '../engine/bindings';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: EngineBindings = loadEngine('../engine').rust;

/**
 * A Validator to enforce that non null numeric values are between two values.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class NumberValidator extends Validator{
    declare validator: NumberDomainValidatorAst;
    // Definitely assigned: by the TS body, or from the Rust snapshot.
    lowerBound!: number | null;
    upperBound!: number | null;

    /**
     * Create a NumberValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} ast - The ast for the range defined as [lower,upper] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, ast: NumberDomainValidatorAst) {
        super(field, ast);
        Object.assign(this, rust.numberValidatorNew(this, ast));
    }

    /**
     * Returns the lower bound for this validator, or null if not specified
     * @returns {number} the lower bound or null
     */
    getLowerBound(): number | null {
        return this.lowerBound;
    }
    /**
     * Returns the upper bound for this validator, or null if not specified
     * @returns {number} the upper bound or null
     */
    getUpperBound(): number | null {
        return this.upperBound;
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void {
        rust.numberValidatorValidate(this, identifier, value);
    }

    /**
     * Returns a string representation
     * @return {string} the string representation
     * @private
     */
    toString(): string {
        return rust.numberValidatorToString(this);
    }

    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean {
        return rust.numberValidatorCompatibleWith(this, other, NumberValidator);
    }
}

export { NumberValidator };
export default NumberValidator;
