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
import EnumValueDeclaration from './enumvaluedeclaration';
import Field from './field';
import Globalize from '../globalize';
import IllegalModelException from './illegalmodelexception';
import RelationshipDeclaration from './relationshipdeclaration';
import ModelUtil from '../modelutil';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Property from './property';
import type Resource from '../model/resource';
import type { ValidateInstanceOptions, ValidationResult } from '../types';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */
import { rust, engineValidateInstance, engineViews } from '../engineloader';

/**
 * The declaration kind a metamodel `$class` names, as the engine's
 * `ClassDeclaration::is_kind` compares it: whatever follows the last `.`.
 * A pure predicate over a string the view already holds, so it runs here
 * rather than crossing into the engine on every call. A missing or
 * non-string `$class` (a declaration built from a stub AST with
 * `metamodelValidation: false`) gives `''`, which matches no kind, so
 * `isAsset()` and its siblings return false as the TS string checks did.
 * Only the last segment is compared, so under `metamodelValidation: false`
 * (the trusted-input escape hatch) a `$class` outside the metamodel whose
 * last segment is a kind (`foo.AssetDeclaration`) matches it, where TS
 * 5.0.0 compared the whole metamodel name.
 * @param {string} type - the declaration's `$class` (`this.type`)
 * @return {string} its short name
 * @private
 */
function declarationKindOf(type: string): string {
    if (typeof type !== 'string') {
        return '';
    }
    return type.substring(type.lastIndexOf('.') + 1);
}

/**
 * ClassDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ClassDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class ClassDeclaration extends Declaration {
    // These are populated by process(), which the Declaration constructor calls,
    // so they carry definite assignment assertions rather than initialisers --
    // an initialiser here would run after the base constructor and clobber it.
    properties!: Property[];
    superType!: string | null;
    superTypeDeclaration!: ClassDeclaration | null;
    idField!: string | null;
    timestamped!: boolean;
    abstract!: boolean;
    type!: string;

    /**
     * Returns the kind of declaration
     * @abstract
     * @return {string} the kind of declaration
     */
    declarationKind(): string {
        throw new Error('not implemented');
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        this.properties = [];
        this.superType = null;
        this.superTypeDeclaration = null;
        this.idField = null;
        this.timestamped = false;
        this.abstract = false;
        this.type = this.ast.$class;

        if (this.ast.isAbstract) {
            this.abstract = true;
        }

        // The superType/idField decision below does not depend on the
        // ast.properties loop that follows, so it is made once, up front.
        let shouldAddIdentifierField = false;
        let shouldAddTimestampField = false;

        // The `classDeclarationProcess` binding, read from the file's
        // view snapshot while its declarations are built
        // (engine/views.ts).
        const decision = engineViews().classDeclarationProcess(this) as {
            superType: string | null;
            idField: string | null;
            addIdentifierField: boolean;
            addTimestampField: boolean;
        };
        this.superType = decision.superType;
        this.idField = decision.idField;
        shouldAddIdentifierField = decision.addIdentifierField;
        shouldAddTimestampField = decision.addTimestampField;

        if (shouldAddIdentifierField) {
            this.addIdentifierField();
        }

        if (!Array.isArray(this.ast.properties)) {
            let formatter = Globalize.messageFormatter('classdeclaration-validate-undefined-properties');
            throw new IllegalModelException(formatter({
                'class':this.name
            }), this.modelFile, this.ast.location);
        }

        for (let n = 0; n < this.ast.properties.length; n++) {
            let thing = this.ast.properties[n];

            if(ModelUtil.isSystemProperty(thing.name)) {
                throw new IllegalModelException(`Invalid field name '${thing.name}'`, this.modelFile, this.ast.location);
            }

            if (thing.$class === `${MetaModelNamespace}.RelationshipProperty`) {
                this.properties.push(new RelationshipDeclaration(this, thing));
            } else if (thing.$class === `${MetaModelNamespace}.EnumProperty`) {
                this.properties.push(new EnumValueDeclaration(this, thing));
            } else if (
                thing.$class === `${MetaModelNamespace}.BooleanProperty` ||
                    thing.$class === `${MetaModelNamespace}.StringProperty` ||
                    thing.$class === `${MetaModelNamespace}.IntegerProperty` ||
                    thing.$class === `${MetaModelNamespace}.LongProperty` ||
                    thing.$class === `${MetaModelNamespace}.DoubleProperty` ||
                    thing.$class === `${MetaModelNamespace}.DateTimeProperty` ||
                    thing.$class === `${MetaModelNamespace}.ObjectProperty`
            ) {
                this.properties.push(new Field(this, thing));
            } else {
                let formatter = Globalize.messageFormatter('classdeclaration-process-unrecmodelelem');
                throw new IllegalModelException(formatter({
                    'type': thing.$class
                }), this.modelFile, this.ast.location);
            }
        }

        if (shouldAddTimestampField) {
            this.addTimestampField();
        }
    }

    /**
     * Adds a required field named 'timestamp' of type 'DateTime' if this class declaration has the 'concerto.Concept'
     * super type.
     * This method should only be called by system code.
     * @private
     */
    addTimestampField() {
        const definition: AstNode = { $class: `${MetaModelNamespace}.DateTimeProperty` };
        definition.name = '$timestamp';
        this.properties.push(new Field(this, definition));
    }

    /**
     * Adds a required field named '$identifier' of type 'String'
     * This method should only be called by system code.
     * @private
     */
    addIdentifierField() {
        const definition: AstNode = { $class: `${MetaModelNamespace}.StringProperty` };
        definition.name = '$identifier';
        this.properties.push(new Field(this, definition));
    }

    /**
     * Resolve the super type on this class and store it as an internal property.
     * @return {ClassDeclaration} The super type, or null if non specified.
     */
    _resolveSuperType(): ClassDeclaration | null {
        return rust.classDeclarationResolveSuperType(this) as ClassDeclaration | null;
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

        // if we have a super type make sure it exists
        if (this.superType !== null) {
            // and make sure that the class isn't extending itself
            // (an exemption is made for the core classes)
            if (
                this.superType === this.name &&
                ![
                    'Asset', 'Concept', 'Event', 'Participant', 'Transaction',
                ].includes(this.superType)
            ) {
                let formatter = Globalize('en').messageFormatter('classdeclaration-validate-selfextending');
                throw new IllegalModelException(formatter({
                    'class': this.name,
                }), this.modelFile, this.ast.location);
            }
            this._resolveSuperType();
        }

        if (this.idField) {
            const idField = this.getProperty(this.idField);
            if (!idField) {
                let formatter = Globalize('en').messageFormatter('classdeclaration-validate-identifiernotproperty');
                throw new IllegalModelException(formatter({
                    'class': this.name,
                    'idField': this.idField
                }), this.modelFile, this.ast.location);
            } else {
                // check that identifiers are strings
                const isPrimitiveString = idField.getType() === 'String';
                const modelFile = idField.getParent().getModelFile();
                const declaration = modelFile.getType(idField.getType());
                const isScalarString = declaration !== null && declaration.isScalarDeclaration?.() && declaration.getType?.() === 'String';

                if (!isPrimitiveString && !isScalarString) {
                    let formatter = Globalize('en').messageFormatter('classdeclaration-validate-identifiernotstring');
                    throw new IllegalModelException(formatter({
                        'class': this.name,
                        'idField': this.idField
                    }), this.modelFile, this.ast.location);
                }

                if (idField.isOptional()) {
                    throw new IllegalModelException('Identifying fields cannot be optional.', this.modelFile, this.ast.location);
                }

                if(this.superType) {
                    const superType = this.getModelFile().getType(this.superType);
                    if (superType && superType.isIdentified() ) {
                        if (rust.classDeclarationIdentifierRedeclareConflict(this.isSystemIdentified(), superType.isSystemIdentified(), superType.isExplicitlyIdentified())) {
                            throw new IllegalModelException(`Super class ${superType.getFullyQualifiedName()} has an explicit identifier ${superType.getIdentifierFieldName()} that cannot be redeclared.`, this.modelFile, this.ast.location);
                        }
                    }
                }
            }
        }
        // we also have to check fields defined in super classes
        const properties = this.getProperties();
        const uniquePropertyNames = new Set();
        properties.forEach(p => {
            const propertyName = p.getName();
            if (!uniquePropertyNames.has(propertyName)) {
                uniquePropertyNames.add(propertyName);
            } else {
                const formatter = Globalize('en').messageFormatter(
                    'classdeclaration-validate-duplicatefieldname'
                );
                throw new IllegalModelException(formatter({
                    'class': this.name,
                    'fieldName': propertyName
                }), this.modelFile, this.ast.location);
            }
        });

        for (let n = 0; n < properties.length; n++) {
            let field = properties[n];

            // we now validate the field, however to ensure that
            // imports are resolved correctly we validate in the context
            // of the declared type of the field for non-primitives in a different namespace
            if (
                field.isPrimitive() ||
                this.isEnum() ||
                field.getNamespace() === this.getNamespace()
            ) {
                field.validate(this);
            } else {
                const typeFqn = field.getFullyQualifiedTypeName();
                const classDecl = this.modelFile.getModelManager().getType(typeFqn);
                field.validate(classDecl);
            }
        }
    }

    /**
     * Returns true if this class is declared as abstract in the model file
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract(): boolean {
        return this.abstract;
    }

    /**
     * Returns true if this class declaration declares an identifying field
     * (system or explicit)
     * @returns {Boolean} true if the class declaration includes an identifier
     */
    isIdentified(): boolean {
        return !!(this.getIdentifierFieldName());
    }

    /**
     * Returns true if this class declaration declares a system identifier
     * $identifier
     * @returns {Boolean} true if the class declaration includes a system identifier
     */
    isSystemIdentified(): boolean {
        return this.getIdentifierFieldName() === '$identifier';
    }

    /**
     * Returns true if this class declaration declares an explicit identifier
     * @returns {Boolean} true if the class declaration includes an explicit identifier
     */
    isExplicitlyIdentified(): boolean {
        return (!!this.idField && this.idField !== '$identifier');
    }

    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName(): string | null {
        // The whole super type walk runs in one engine call, and the answer
        // is memoised per view until the models change (engine/views-lookups.ts).
        // BC-50: the walk inlines the ClassDeclaration methods it reaches,
        // so replacing them at runtime does not change the answer.
        return engineViews().classDeclarationGetIdentifierFieldName(this) as string | null;
    }

    /**
     * Returns the field with a given name or null if it does not exist.
     * The field must be directly owned by this class -- the super-type is
     * not introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field definition or null if it does not exist
     */
    getOwnProperty(name: string): Property | null {
        for (let n = 0; n < this.properties.length; n++) {
            const field = this.properties[n];
            if (field.getName() === name) {
                return field;
            }
        }

        return null;
    }

    /**
     * Returns the fields directly defined by this class.
     *
     * @return {Property[]} the array of fields
     */
    getOwnProperties(): Property[] {
        return this.properties;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getSuperType(): string | null {
        return rust.classDeclarationGetSuperType(this) as string | null;
    }

    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     */
    getSuperTypeDeclaration(): ClassDeclaration | null {
        return rust.classDeclarationGetSuperTypeDeclaration(this) as ClassDeclaration | null;
    }

    /**
     * Get the class declarations for all subclasses of this class, including this class.
     * @return {ClassDeclaration[]} subclass declarations.
     */
    getAssignableClassDeclarations(): ClassDeclaration[] {
        // BC-52: answered by the engine from its arena and its cached
        // subclass map, by this declaration's handle, as fully
        // qualified names (this declaration's first); a replaced
        // `getSuperType` or `getModelFiles` method is not called.
        const views = engineViews();
        const ref = views.declarationArenaRef(this);
        if (ref === undefined) {
            throw views.notInArena('ClassDeclaration.getAssignableClassDeclarations');
        }
        const names = ref.handle.classDeclarationGetAssignableClassDeclarations(ref.id);
        return [this, ...views.declarationViews(this.modelFile.modelManager, names.slice(1))];
    }

    /**
     * Get the class declarations for just the direct subclasses of this class, excluding this class.
     * @return {ClassDeclaration[]} direct subclass declarations.
     */
    getDirectSubclasses(): ClassDeclaration[] {
        // BC-52: as `getAssignableClassDeclarations`.
        const views = engineViews();
        const ref = views.declarationArenaRef(this);
        if (ref === undefined) {
            throw views.notInArena('ClassDeclaration.getDirectSubclasses');
        }
        return views.declarationViews(this.modelFile.modelManager, ref.handle.classDeclarationGetDirectSubclasses(ref.id));
    }

    /**
     * Get all the super-type declarations for this type.
     * @return {ClassDeclaration[]} super-type declarations.
     */
    getAllSuperTypeDeclarations(): ClassDeclaration[] {
        return rust.classDeclarationGetAllSuperTypeDeclarations(this) as ClassDeclaration[];
    }

    /**
     * Returns the property with a given name or null if it does not exist.
     * Fields defined in super-types are also introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field, or null if it does not exist
     */
    getProperty(name: string): Property | null {
        // The `classDeclarationGetProperty` binding, answered from the
        // view's cached property list when it has one (engine/views-lookups.ts).
        return engineViews().classDeclarationGetProperty(this, name) as Property | null;
    }

    /**
     * Validates an instance as this type (accordproject/concerto#1239),
     * without building a Resource: its own `$class` must be this type or a
     * subtype of it, and an instance with no `$class` is read as this type.
     * The instance is valid exactly when {@link Serializer#fromJSON} (with the
     * same options) would accept it.
     * @param {object|string} json the instance, as a JSON object or its JSON text
     * @param {ValidateInstanceOptions} [options] the options
     * @return {ValidationResult} `{ valid: true, resource, warnings }`, the
     * resource being built when first read (or `null` with `hydrate: false`),
     * or `{ valid: false, resource: null, errors, warnings }`, the first
     * error being the one {@link ClassDeclaration#validateInstanceOrThrow}
     * throws
     */
    validateInstance(json: object | string, options?: ValidateInstanceOptions): ValidationResult<Resource> {
        return engineValidateInstance().validateInstance(this.modelFile.getModelManager(), json, options, this.getFullyQualifiedName());
    }

    /**
     * Validates an instance as {@link ClassDeclaration#validateInstance}
     * does, and returns it as a Resource (accordproject/concerto#1239).
     * @param {object|string} json the instance, as a JSON object or its JSON text
     * @param {ValidateInstanceOptions} [options] the options
     * @return {Resource|null} the resource, or `null` with `hydrate: false`
     * @throws {ValidationException|TypeNotFoundException|Error} what
     * {@link Serializer#fromJSON} throws for the instance, with its
     * diagnostics as `details`; a ValidationException when its `$class` is
     * not this type or a subtype of it
     */
    validateInstanceOrThrow(json: object | string, options?: ValidateInstanceOptions): Resource | null {
        return engineValidateInstance().validateInstanceOrThrow(this.modelFile.getModelManager(), json, options, this.getFullyQualifiedName());
    }

    /**
     * Returns the properties defined in this class and all super classes.
     *
     * @return {Property[]} the array of fields
     */
    getProperties(): Property[] {
        // The `classDeclarationGetProperties` binding, cached per view
        // (engine/views-lookups.ts).
        return engineViews().classDeclarationGetProperties(this) as Property[];
    }

    /**
     * Get a nested property using a dotted property path
     * @param {string} propertyPath The property name or name with nested structure e.g a.b.c
     * @returns {Property} the property
     * @throws {IllegalModelException} if the property path is invalid or the property does not exist
     */
    getNestedProperty(propertyPath: string): Property {
        return rust.classDeclarationGetNestedProperty(this, propertyPath) as Property;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string {
        // As TS 5.0.0 builds it: a truthy super type, and the class's own
        // `isEnum()` and `isAbstract()`, which a subclass may override.
        const superType = this.superType ? ` super=${this.superType}` : '';
        return `ClassDeclaration {id=${this.getFullyQualifiedName()}${superType} enum=${this.isEnum()} abstract=${this.isAbstract()}}`;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean {
        return declarationKindOf(this.type) === 'AssetDeclaration';
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is an asset
     */
    isParticipant(): boolean {
        return declarationKindOf(this.type) === 'ParticipantDeclaration';
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is an asset
     */
    isTransaction(): boolean {
        return declarationKindOf(this.type) === 'TransactionDeclaration';
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an asset
     */
    isEvent(): boolean {
        return declarationKindOf(this.type) === 'EventDeclaration';
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is an asset
     */
    isConcept(): boolean {
        return declarationKindOf(this.type) === 'ConceptDeclaration';
    }

    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isEnum(): boolean {
        return declarationKindOf(this.type) === 'EnumDeclaration';
    }

    /**
     * Returns true if this class is the definition of a map.
     *
     * @return {boolean} true if the class is an asset
     */
    isMapDeclaration(): boolean {
        return declarationKindOf(this.type) === 'MapDeclaration';
    }

    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isClassDeclaration(): boolean {
        return true;
    }
}

export { ClassDeclaration };
export default ClassDeclaration;
