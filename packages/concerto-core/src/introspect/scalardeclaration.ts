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

import { MetaModelNamespace } from '@accordproject/concerto-metamodel';

import Declaration from './declaration';
import IllegalModelException from './illegalmodelexception';
import NumberValidator from './numbervalidator';
import StringValidator from './stringvalidator';
import { NullUtil as Util } from '@accordproject/concerto-util';
import ModelUtil from '../modelutil';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Validator from './validator';
import type ClassDeclaration from './classdeclaration';
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
 * ScalarDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ScalarDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class ScalarDeclaration extends Declaration {
    // Populated by process(), which the Declaration constructor calls, so these
    // carry definite assignment assertions rather than initialisers.
    // superType, superTypeDeclaration, idField, timestamped and abstract exist
    // only to mirror ClassDeclaration's shape; the accessors below are
    // deprecated and answer with constants.
    superType!: string | null;
    superTypeDeclaration!: ClassDeclaration | null;
    idField!: string | null;
    timestamped!: boolean;
    abstract!: boolean;
    validator!: Validator | null;
    type!: string | null;
    defaultValue!: string | number | boolean | null;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        /* istanbul ignore if */
        if (rust) {
            loadEngine('../engine/views').scalarDeclarationProcess(this);
            return;
        }

        const scalarName = this.getName(); // Get the local name of the scalar
        if (ModelUtil.isPrimitiveType(scalarName)) {
            throw new IllegalModelException(
                `Invalid scalar name '${scalarName}'. Name conflicts with primitive type.`,
                this.modelFile,
                this.ast.location
            );
        }
        this.superType = null;
        this.superTypeDeclaration = null;
        this.idField = null;
        this.timestamped = false;
        this.abstract = false;
        this.validator = null;

        if (this.ast.$class === `${MetaModelNamespace}.BooleanScalar`) {
            this.type = 'Boolean';
        } else if (this.ast.$class === `${MetaModelNamespace}.IntegerScalar`) {
            this.type = 'Integer';
        } else if (this.ast.$class === `${MetaModelNamespace}.LongScalar`) {
            this.type = 'Long';
        } else if (this.ast.$class === `${MetaModelNamespace}.DoubleScalar`) {
            this.type = 'Double';
        } else if (this.ast.$class === `${MetaModelNamespace}.StringScalar`) {
            this.type = 'String';
        } else if (this.ast.$class === `${MetaModelNamespace}.DateTimeScalar`) {
            this.type = 'DateTime';
        } else {
            this.type = null;
        }

        switch(this.getType()) {
        case 'Integer':
        case 'Double':
        case 'Long':
            if(this.ast.validator) {
                this.validator = new NumberValidator(this, this.ast.validator);
            }
            break;
        case 'String':
            if(this.ast.validator || this.ast.lengthValidator) {
                this.validator = new StringValidator(this, this.ast.validator, this.ast.lengthValidator);
            }
            break;
        }

        if(!Util.isNull(this.ast.defaultValue)) {
            this.defaultValue = this.ast.defaultValue;
        } else {
            this.defaultValue = null;
        }
    }

    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        super.validate();

        /* istanbul ignore if */
        if (rust) {
            rust.scalarDeclarationValidate(this);
            return;
        }

        const declarations = this.getModelFile().getAllDeclarations();
        const declarationNames = declarations.map(
            d => d.getFullyQualifiedName()
        );
        const uniqueNames = new Set(declarationNames);

        if (uniqueNames.size !== declarations.length) {
            const duplicateElements = declarationNames.filter(
                (item, index) => declarationNames.indexOf(item) !== index
            );
            throw new IllegalModelException(
                `Duplicate class name ${duplicateElements[0]}`
            );
        }
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isIdentified(): boolean {
        return false;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isSystemIdentified(): boolean {
        return false;
    }

    /**
     * Returns null as scalars are never identified.
     * @return {string} as scalars are never identified
     * @deprecated
     */
    getIdentifierFieldName(): string | null {
        return null;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string | null {
        return this.type;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     * @deprecated
     */
    getSuperType(): string | null {
        return null;
    }

    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     * @deprecated
     */
    getSuperTypeDeclaration(): ClassDeclaration | null {
        return null;
    }

    /**
     * Returns the validator string for this scalar definition
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator | null {
        return this.validator;
    }

    /**
     * Returns the default value for the field or null
     * @return {string | number | null} the default value for the field or null
     */
    getDefaultValue(): string | number | boolean | null {
        return this.defaultValue;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string {
        /* istanbul ignore if */
        if (rust) {
            return rust.scalarDeclarationToString(this);
        }
        return 'ScalarDeclaration {id=' + this.getFullyQualifiedName() + '}';
    }

    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     * @deprecated
     */
    isAbstract(): boolean {
        return true;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean {
        return true;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     * @deprecated
     */
    isAsset(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     * @deprecated
     */
    isParticipant(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     * @deprecated
     */
    isTransaction(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     * @deprecated
     */
    isEvent(): boolean {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     * @deprecated
     */
    isConcept(): boolean {
        return false;
    }

}

export { ScalarDeclaration };
export default ScalarDeclaration;
