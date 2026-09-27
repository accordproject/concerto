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

import Property from './property';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ClassDeclaration from './classdeclaration';
import type Validator from './validator';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). Its bindings are typed
// `never` so that a view leaves the member's inferred return type, and so
// the .d.ts, exactly as the TS body used to make it. See property.ts's own
// copy of this comment for the bundler/webpack reasoning this loader relies
// on.
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
// P5-06: memoised per specifier, so a call site on a per-element or
// per-instance path (propertyProcess, fastFromJson, ...) resolves the module
// once rather than on every call.
const engineModules: { [specifier: string]: any } = {};
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    engineModules[specifier] ??
    (engineModules[specifier] =
        typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : module.require(specifier));
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('../engine').rust;

/**
 * Class representing the definition of a Field. A Field is owned
 * by a ClassDeclaration and has a name, type and additional metadata
 * (see below).
 * @private
 * @extends Property
 * @see See  {@link  Property}
 * @class
 * @memberof module:concerto-core
 */
class Field extends Property {
    // Populated by process(), which the Property constructor calls, so these
    // carry definite assignment assertions rather than initialisers.
    validator!: Validator | null;
    defaultValue!: string | number | boolean | null;
    scalarField: Field | null;
    /**
     * Create a Field.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode) {
        super(parent, ast);
        this.scalarField = null; // cache scalar field
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        loadEngine('../engine/views').fieldProcess(this);
    }

    /**
     * Returns the validator string for this field
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator | null {
        return this.validator;
    }

    /**
     * Returns the default value for the field or null if there is no default value
     * @return {string | number} the default value for the field or null
     */
    getDefaultValue(): string | number | boolean | null {
        return this.defaultValue;
    }

    /**
     * Returns a string representation of this property§
     * @return {String} the string version of the property.
     */
    toString(): string {
        return rust.fieldToString(this);
    }

    /**
     * Returns true if this class is the definition of a field.
     *
     * @return {boolean} true if the class is a field
     */
    isField(): boolean {
        return true;
    }

    /**
     * Returns true if the field's type is a scalar
     * @returns {boolean} true if the field is a scalar type
     */
    isTypeScalar(): boolean {
        if (this.isPrimitive()) {
            return false;
        } else {
            this.getParent()
                .getModelFile().resolveType( 'property ' + this.getFullyQualifiedName(), this.getType());
            const type = this.getParent()
                .getModelFile()
                .getType(this.getType());
            return type.isScalarDeclaration?.();
        }
    }

    /**
     * Unboxes a field that references a scalar type to an
     * underlying Field definition.
     * @throws {Error} throws an error if this field is not a scalar type.
     * @returns {Field} the primitive field for this scalar
     */
    getScalarField(): Field {
        if(this.scalarField) {
            return this.scalarField;
        }

        const scalarField: Field = loadEngine('../engine/views').fieldGetScalarField(this);
        this.scalarField = scalarField;
        return scalarField;
    }
}

export { Field };
export default Field;
