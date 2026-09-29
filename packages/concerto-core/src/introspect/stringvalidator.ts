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

import { ErrorCodes, NullUtil } from '@accordproject/concerto-util';
const { isNull } = NullUtil;
import Validator from './validator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidatedElement } from './validator';
import type { IStringLengthValidator, IStringRegexValidator } from '@accordproject/concerto-metamodel';
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
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('../engine').rust;

/**
 * The `options.regExp` hook configured on the validator's model manager, if
 * any: a pluggable RegExp-compatible constructor that must stay in JS
 * (PORTING.md section 3), so the view only calls the Rust engine's default
 * ECMAScript regex path (the `regress` crate) when this is absent.
 * ScalarDeclarations have no parent, so this is only ever set for a Field.
 * @param {Object} field - the field or scalar declaration this validator is attached to
 * @returns {Function} the custom RegExp-compatible constructor, or undefined
 */
function customRegExp(field: ValidatedElement): RegExp | undefined {
    const parent = 'getParent' in field ? field.getParent() : undefined;
    return parent?.getModelFile()?.getModelManager()?.options?.regExp;
}

/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
class StringValidator extends Validator{
    declare validator: IStringRegexValidator | undefined;
    // The metamodel makes both bounds optional, so an AST can leave either
    // absent as well as explicitly null.
    // Definitely assigned: by the TS body, or from the Rust snapshot.
    minLength!: number | null | undefined;
    maxLength!: number | null | undefined;
    regex!: RegExp | null;

    /**
     * Create a StringValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string. This must be a regex
     * @param {Object} lengthValidator - The length validation string - [minLength,maxLength] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator?: IStringRegexValidator, lengthValidator?: IStringLengthValidator) {
        super(field, validator);

        if (!customRegExp(field)) {
            Object.assign(this, rust.stringValidatorNew(this, validator, lengthValidator));
            this.regex = validator ? new RegExp(validator.pattern, validator.flags) : null;
            return;
        }

        this.minLength = null;
        this.maxLength = null;
        this.regex = null;

        if (lengthValidator) {
            this.minLength = lengthValidator?.minLength;
            this.maxLength = lengthValidator?.maxLength;

            if(isNull(this.minLength) && isNull(this.maxLength)) {
                // can't specify no upper and lower value: absent (length=[,])
                // or null alike (BC-40; 5.0.0 rejected only two nulls)
                this.reportModelError(field.getName(), 'Invalid string length, minLength and-or maxLength must be specified.');
            } else if ((this.minLength ?? 0) < 0 || (this.maxLength ?? 0) < 0) {
                this.reportModelError(field.getName(), 'minLength and-or maxLength must be positive integers.');
            } else if (this.minLength === null || this.maxLength === null) {
                // this is fine and means that we don't need to check whether minLength > maxLength
            } else if(this.minLength !== undefined && this.maxLength !== undefined && this.minLength > this.maxLength) {
                this.reportModelError(field.getName(), 'minLength must be less than or equal to maxLength.');
            }
        }

        if (validator) {
            try {
                // ScalarDeclarations have no parent, so the custom RegExp option
                // is only picked up for properties
                const CustomRegExp = (customRegExp(field) || RegExp) as typeof RegExp;
                this.regex = new CustomRegExp(validator.pattern, validator.flags);
            }
            catch (exception) {
                this.reportModelError(field.getName(), (exception as Error).message, ErrorCodes.REGEX_VALIDATOR_EXCEPTION);
            }
        }

        if(this.field?.ast?.defaultValue) {
            // A default outside the validator is a model error (BC-39).
            checkValue(this, field.getName(), this.field.ast.defaultValue, true);
        }
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: string): void {
        if (!customRegExp(this.field)) {
            rust.stringValidatorValidate(this, identifier, value);
            return;
        }
        checkValue(this, identifier, value, false);
    }

    /**
     * Tests a value against the validation regex. Returns true when no regex is
     * specified.
     * @param {string} value the value to test
     * @returns {boolean} true if the value matches the validation regex
     */
    matchesRegex(value) {
        if (!this.regex) {
            return true;
        }
        // `test` advances `lastIndex` when the regex has the global or sticky flag, so
        // testing the same value twice would otherwise alternate between matching and
        // not matching. Reset it before and after so that every test is independent of
        // previous ones, and so that getRegex() never hands out a poisoned object.
        this.regex.lastIndex = 0;
        try {
            return this.regex.test(value);
        } finally {
            this.regex.lastIndex = 0;
        }
    }

    /**
     * Returns the minLength for this validator, or null if not specified
     * @returns {number} the min length or null
     */
    getMinLength(): number | null | undefined {
        return this.minLength;
    }
    /**
     * Returns the maxLength for this validator, or null if not specified
     * @returns {number} the max length or null
     */
    getMaxLength(): number | null | undefined {
        return this.maxLength;
    }

    /**
     * Returns the RegExp object associated with the string validator, or null if not specified
     * @returns {RegExp} the RegExp object
     */
    getRegex(): RegExp | null {
        return this.regex;
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
        if (!customRegExp(this.field) && !(other instanceof StringValidator && customRegExp(other.field))) {
            return rust.stringValidatorCompatibleWith(this, other, StringValidator);
        }
        if (!(other instanceof StringValidator)) {
            return false;
        }

        if (this.validator?.pattern !== other.validator?.pattern) {
            return false;
        } else if (this.validator?.flags !== other.validator?.flags) {
            return false;
        }

        const thisMinLength = this.getMinLength();
        const otherMinLength = other.getMinLength();
        if (isNull(thisMinLength) && !isNull(otherMinLength)) {
            return false;
        } else if (!isNull(thisMinLength) && !isNull(otherMinLength)) {
            if (thisMinLength < otherMinLength) {
                return false;
            }
        }
        const thisMaxLength = this.getMaxLength();
        const otherMaxLength = other.getMaxLength();
        if (isNull(thisMaxLength) && !isNull(otherMaxLength)) {
            return false;
        } else if (!isNull(thisMaxLength) && !isNull(otherMaxLength)) {
            if (thisMaxLength > otherMaxLength) {
                return false;
            }
        }
        return true;
    }
}

/**
 * The TS checks of StringValidator.validate(), for the options.regExp path.
 * @param {StringValidator} v the validator
 * @param {string} identifier the identifier of the instance being validated
 * @param {Object} value the value to validate
 * @param {boolean} atLoad true for the constructor's default value check,
 * which reports an IllegalModelException, false for an instance value,
 * which reports a ValidationException (BC-39)
 * @private
 */
function checkValue(v: StringValidator, identifier: string | null, value: string, atLoad: boolean): void {
    const report = (msg: string): never => atLoad ? v.reportModelError(identifier, msg) : v.reportError(identifier, msg);
    if(value !== null) {
        //Enforce string length rule first
        if(v.minLength !== null && v.minLength !== undefined && value.length < v.minLength) {
            report(`The string length of '${value}' should be at least ${v.minLength} characters.`);
        }
        if(v.maxLength !== null && v.maxLength !== undefined && value.length > v.maxLength) {
            report(`The string length of '${value}' should not exceed ${v.maxLength} characters.`);
        }

        if (v.regex && !v.matchesRegex(value)) {
            report(`Value '${value}' failed to match validation regex: ${v.regex}`);
        }
    }
}

export { StringValidator };
export default StringValidator;
