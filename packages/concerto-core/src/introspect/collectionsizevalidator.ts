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
import Validator from './validator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidatedElement } from './validator';
import type { ICollectionSizeValidator } from '@accordproject/concerto-metamodel';
/* eslint-enable no-unused-vars */

const { isNull } = NullUtil;

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
 * A Validator to enforce that a collection (array or map) has a size within a specified range.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class CollectionSizeValidator extends Validator {
    declare validator: ICollectionSizeValidator;
    // Definitely assigned: by the TS body, or from the Rust snapshot.
    minSize!: number | null;
    maxSize!: number | null;

    /**
     * Create a CollectionSizeValidator.
     * @param {Object} field - the field or declarations this validator is attached to
     * @param {Object} validator - The size validation object - [minSize, maxSize] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: ICollectionSizeValidator) {
        super(field, validator);

        /* istanbul ignore if */
        if (rust) {
            Object.assign(this, rust.collectionSizeValidatorNew(this, validator));
            return;
        }

        this.minSize = validator.minSize ?? null;
        this.maxSize = validator.maxSize ?? null;

        if (isNull(this.minSize) && isNull(this.maxSize)) {
            this.reportError(field.getName(), 'Invalid collection size, minSize and/or maxSize must be specified.');
        } else if ((this.minSize ?? 0) < 0 || (this.maxSize ?? 0) < 0) {
            this.reportError(field.getName(), 'minSize and/or maxSize must be positive integers.');
        } else if (isNull(this.minSize) || isNull(this.maxSize)) {
            // this is fine and means that we don't need to check whether minSize > maxSize
        } else if (this.minSize > this.maxSize) {
            this.reportError(field.getName(), 'minSize must be less than or equal to maxSize.');
        }
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {number} value the collection size to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void {
        /* istanbul ignore if */
        if (rust) {
            rust.collectionSizeValidatorValidate(this, identifier, value);
            return;
        }
        if(!isNull(this.minSize) && value < this.minSize) {
            this.reportError(identifier, `Collection must contain at least ${this.minSize} elements.`);
        }
        if(!isNull(this.maxSize) && value > this.maxSize) {
            this.reportError(identifier, `Collection must contain no more than ${this.maxSize} elements.`);
        }
    }

    /**
     * Returns the minSize for this validator, or null if not specified
     * @returns {number} the min size or null
     */
    getMinSize(): number | null {
        return this.minSize;
    }

    /**
     * Returns the maxSize for this validator, or null if not specified
     * @returns {number} the max size or null
     */
    getMaxSize(): number | null {
        return this.maxSize;
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
            return rust.collectionSizeValidatorCompatibleWith(this, other, CollectionSizeValidator);
        }
        if (!(other instanceof CollectionSizeValidator)) {
            return false;
        }

        const thisMinSize = this.getMinSize();
        const otherMinSize = other.getMinSize();
        if (isNull(thisMinSize) && !isNull(otherMinSize)) {
            return false;
        } else if (!isNull(thisMinSize) && !isNull(otherMinSize)) {
            if (thisMinSize < otherMinSize) {
                return false;
            }
        }

        const thisMaxSize = this.getMaxSize();
        const otherMaxSize = other.getMaxSize();
        if (isNull(thisMaxSize) && !isNull(otherMaxSize)) {
            return false;
        } else if (!isNull(thisMaxSize) && !isNull(otherMaxSize)) {
            if (thisMaxSize > otherMaxSize) {
                return false;
            }
        }

        return true;
    }
}

export { CollectionSizeValidator };
export default CollectionSizeValidator;
