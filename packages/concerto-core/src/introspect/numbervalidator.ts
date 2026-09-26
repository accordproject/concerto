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

import { NullUtil } from '@accordproject/concerto-util';
const { isNull } = NullUtil;
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

// CONCERTO_ENGINE=rust: the Rust engine, or null in ts mode (src/engine/index.ts).
// Its bindings are typed `never` so that a view leaves the member's inferred
// return type, and so the .d.ts, exactly as the TS body makes it.
//
// dist/, dist/esm and dist/esm-browser ship src/engine/ as JavaScript only,
// with no .d.ts, since it is not public API (tsconfig.build.internal.json;
// OD-11). A ts-mode bundle of dist/ must still leave it out, so a bundler
// must never see a specifier it would resolve: `loadEngine` takes a
// non-literal one (esbuild, rollup and browserify leave it alone) and never
// names the bare `require` (esbuild's ESM output would add its `__require`
// shim, which webpack reports as a critical dependency), and webpack folds
// the `typeof __webpack_require__` test and keeps only the dead-in-Node
// `__non_webpack_require__` branch, so it neither resolves nor warns. ts mode
// bundles exactly as before (PORTING.md 1.5).
//
// rust mode through the public ESM entry points (P4-11a, PORTING.md 1.5):
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
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : module.require(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } | null =
    typeof process !== 'undefined' && process.env?.CONCERTO_ENGINE === 'rust' ? loadEngine('../engine').rust : null;

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

        /* istanbul ignore if */
        if (rust) {
            Object.assign(this, rust.numberValidatorNew(this, ast));
            return;
        }

        this.lowerBound = null;
        this.upperBound = null;

        // the hasOwnProperty guards establish that the bound is present
        if(Object.prototype.hasOwnProperty.call(ast, 'lower')) {
            this.lowerBound = ast.lower as number;
        }

        if(Object.prototype.hasOwnProperty.call(ast, 'upper')) {
            this.upperBound = ast.upper as number;
        }

        if(this.lowerBound === null && this.upperBound === null) {
            // can't specify no upper and lower value
            this.reportError(null, 'Invalid range, lower and-or upper bound must be specified.');
        } else if (this.lowerBound === null || this.upperBound === null) {
            // this is fine and means that we don't need to check whether upper > lower
        } else {
            if(this.lowerBound > this.upperBound) {
                this.reportError(null, 'Lower bound must be less than or equal to upper bound.');
            }
        }

        if(this.field?.ast?.defaultValue !== undefined) {
            let value = this.field.ast.defaultValue;
            if(this.lowerBound !== null && value < this.lowerBound) {
                this.reportError(null, `Value ${value} is outside lower bound ${this.lowerBound}`);
            }

            if(this.upperBound !== null && value > this.upperBound) {
                this.reportError(null, `Value ${value} is outside upper bound ${this.upperBound}`);
            }
        }
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
        /* istanbul ignore if */
        if (rust) {
            rust.numberValidatorValidate(this, identifier, value);
            return;
        }
        if(value !== null) {
            if(this.lowerBound !== null && value < this.lowerBound) {
                this.reportError(identifier, `Value ${value} is outside lower bound ${this.lowerBound}`);
            }

            if(this.upperBound !== null && value > this.upperBound) {
                this.reportError(identifier, `Value ${value} is outside upper bound ${this.upperBound}`);
            }
        }
    }

    /**
     * Returns a string representation
     * @return {string} the string representation
     * @private
     */
    toString(): string {
        /* istanbul ignore if */
        if (rust) {
            return rust.numberValidatorToString(this);
        }
        return 'NumberValidator lower: ' + this.lowerBound + ' upper: ' + this.upperBound;
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
        /* istanbul ignore if */
        if (rust) {
            return rust.numberValidatorCompatibleWith(this, other, NumberValidator);
        }
        if (!(other instanceof NumberValidator)) {
            return false;
        }
        const thisLowerBound = this.getLowerBound();
        const otherLowerBound = other.getLowerBound();
        if (isNull(thisLowerBound) && !isNull(otherLowerBound)) {
            return false;
        } else if (!isNull(thisLowerBound) && !isNull(otherLowerBound)) {
            if (thisLowerBound < otherLowerBound) {
                return false;
            }
        }
        const thisUpperBound = this.getUpperBound();
        const otherUpperBound = other.getUpperBound();
        if (isNull(thisUpperBound) && !isNull(otherUpperBound)) {
            return false;
        } else if (!isNull(thisUpperBound) && !isNull(otherUpperBound)) {
            if (thisUpperBound > otherUpperBound) {
                return false;
            }
        }
        return true;
    }
}

export { NumberValidator };
export default NumberValidator;
