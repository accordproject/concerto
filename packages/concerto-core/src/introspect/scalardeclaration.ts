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

import Declaration from './declaration';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Validator from './validator';
import type ClassDeclaration from './classdeclaration';
/* eslint-enable no-unused-vars */
import { rust, engineViews } from '../engineloader';

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

        engineViews().scalarDeclarationProcess(this);
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

        // P5-106 (BC-52): answered by the engine from its arena, by this
        // declaration's handle; a replaced `getModelFile` or
        // `getAllDeclarations` method is not called.
        const views = engineViews();
        const ref = views.declarationArenaRef(this);
        if (ref === undefined) {
            throw views.notInArena('ScalarDeclaration.validate');
        }
        ref.handle.scalarDeclarationValidate(ref.id);
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
        return rust.scalarDeclarationToString(this);
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

// P5-10b: built on first read in a lazily built file (engine/views.ts).
engineViews().installLazyField(ScalarDeclaration.prototype, 'validator');

export { ScalarDeclaration };
export default ScalarDeclaration;
