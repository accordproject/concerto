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

'use strict';

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const Declaration = require('./declaration');
const EnumValueDeclaration = require('./enumvaluedeclaration');
const Field = require('./field');
const Globalize = require('../globalize');
const IllegalModelException = require('./illegalmodelexception');
const Introspector = require('./introspector');
const RelationshipDeclaration = require('./relationshipdeclaration');
const ModelUtil = require('../modelutil');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Property = require('./property');
}
/* eslint-enable no-unused-vars */

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

        if (this.ast.superType) {
            this.superType = this.ast.superType.name;
        }
        else if(!(this.modelFile.isSystemModelFile() && this.name === 'Concept')) {
            this.superType = 'Concept';
        }

        if (this.ast.identified) {
            if (this.ast.identified.$class === `${MetaModelNamespace}.IdentifiedBy`) {
                this.idField = this.ast.identified.name;
            } else {
                this.idField = '$identifier';
                this.addIdentifierField();
            }
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

        if (this.fqn === 'concerto@1.0.0.Transaction' || this.fqn === 'concerto@1.0.0.Event') {
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
        const definition = {};
        definition.$class = `${MetaModelNamespace}.DateTimeProperty`;
        definition.name = '$timestamp';
        this.properties.push(new Field(this, definition));
    }

    /**
     * Adds a required field named '$identifier' of type 'String'
     * This method should only be called by system code.
     * @private
     */
    addIdentifierField() {
        const definition = {};
        definition.$class = `${MetaModelNamespace}.StringProperty`;
        definition.name = '$identifier';
        this.properties.push(new Field(this, definition));
    }

    /**
     * Resolve the super type on this class and store it as an internal property.
     * @return {ClassDeclaration} The super type, or null if non specified.
     */
    _resolveSuperType() {
        if (!this.superType) {
            return null;
        }
        // Clear out any old resolved super types.
        this.superTypeDeclaration = null;
        let classDecl = null;
        if (this.getModelFile().isImportedType(this.superType)) {
            let fqnSuper = this.getModelFile().resolveImport(this.superType);
            classDecl = this.modelFile.getModelManager().getType(fqnSuper);
        } else {
            classDecl = this.getModelFile().getType(this.superType);
        }

        if (!classDecl) {
            throw new IllegalModelException('Could not find super type ' + this.superType, this.modelFile, this.ast.location);
        }

        // if super type is not a concept, then check that this type and the super type
        // are of the same type. E.g. an asset cannot extend a participant
        if (classDecl.declarationKind() !== 'ConceptDeclaration' && this.declarationKind() !== classDecl.declarationKind()) {
            throw new IllegalModelException(`${this.declarationKind()} (${this.getName()}) cannot extend ${classDecl.declarationKind()} (${classDecl.getName()})`, this.modelFile, this.ast.location);
        }
        this.superTypeDeclaration = classDecl;
        return classDecl;
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
                        if(this.isSystemIdentified()) {
                            // check that the super type is also system identified
                            if(!superType.isSystemIdentified()) {
                                throw new IllegalModelException(`Super class ${superType.getFullyQualifiedName()} has an explicit identifier ${superType.getIdentifierFieldName()} that cannot be redeclared.`, this.modelFile, this.ast.location);
                            }
                        }
                        else {
                            if(superType.isExplicitlyIdentified()) {
                                throw new IllegalModelException(`Super class ${superType.getFullyQualifiedName()} has an explicit identifier ${superType.getIdentifierFieldName()} that cannot be redeclared.`, this.modelFile, this.ast.location);
                            }
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
    isAbstract() {
        return this.abstract;
    }

    /**
     * Returns true if this class declaration declares an identifying field
     * (system or explicit)
     * @returns {Boolean} true if the class declaration includes an identifier
     */
    isIdentified() {
        return !!(this.getIdentifierFieldName());
    }

    /**
     * Returns true if this class declaration declares a system identifier
     * $identifier
     * @returns {Boolean} true if the class declaration includes a system identifier
     */
    isSystemIdentified() {
        return this.getIdentifierFieldName() === '$identifier';
    }

    /**
     * Returns true if this class declaration declares an explicit identifier
     * @returns {Boolean} true if the class declaration includes an explicit identifier
     */
    isExplicitlyIdentified() {
        return (!!this.idField && this.idField !== '$identifier');
    }

    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName() {
        if (this.idField) {
            return this.idField;
        } else {
            if (this.getSuperType()) {
                // we first check our own modelfile, as we may be called from validate
                // in which case our model file has not yet been added to the model modelManager
                let classDecl = this.getModelFile().getLocalType(this.getSuperType());

                // not a local type, so we try the model manager
                if (!classDecl) {
                    classDecl = this.modelFile.getModelManager().getType(this.getSuperType());
                }
                return classDecl.getIdentifierFieldName();
            } else {
                return null;
            }
        }
    }

    /**
     * Returns the field with a given name or null if it does not exist.
     * The field must be directly owned by this class -- the super-type is
     * not introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field definition or null if it does not exist
     */
    getOwnProperty(name) {
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
    getOwnProperties() {
        return this.properties;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getSuperType() {
        const superTypeDeclaration = this.getSuperTypeDeclaration();
        if (superTypeDeclaration) {
            return superTypeDeclaration.getFullyQualifiedName();
        } else {
            return null;
        }
    }

    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     */
    getSuperTypeDeclaration() {
        if (!this.superType) {
            // No super type.
            return null;
        } else if (!this.superTypeDeclaration) {
            // Super type that hasn't been resolved yet.
            return this._resolveSuperType();
        } else {
            // Resolved super type.
            return this.superTypeDeclaration;
        }
    }

    /**
     * Get the class declarations for all subclasses of this class, including this class.
     * @return {ClassDeclaration[]} subclass declarations.
     */
    getAssignableClassDeclarations() {
        const results = new Set();
        const modelManager = this.getModelFile().getModelManager();
        const introspector = new Introspector(modelManager);
        const allClassDeclarations = introspector.getClassDeclarations();
        const subclassMap = new Map();

        // Build map of all direct subclasses relationships
        allClassDeclarations.forEach((declaration) => {
            const superType = declaration.getSuperType();
            if (superType) {
                const subclasses = subclassMap.get(superType) || new Set();
                subclasses.add(declaration);
                subclassMap.set(superType, subclasses);
            }
        });

        // Recursive function to collect all direct and indirect subclasses of a given (set) of base classes.
        const collectSubclasses = (superclasses) => {
            superclasses.forEach((declaration) => {
                results.add(declaration);
                const superType = declaration.getFullyQualifiedName();
                const subclasses = subclassMap.get(superType);
                if (subclasses) {
                    collectSubclasses(subclasses);
                }
            });
        };

        collectSubclasses([this]);

        return Array.from(results);
    }

    /**
     * Get the class declarations for just the direct subclasses of this class, excluding this class.
     * @return {ClassDeclaration[]} direct subclass declarations.
     */
    getDirectSubclasses() {
        const modelManager = this.getModelFile().getModelManager();
        const introspector = new Introspector(modelManager);
        const allClassDeclarations = introspector.getClassDeclarations();
        const subclassMap = new Map();

        // Build map of all direct subclasses relationships
        allClassDeclarations.forEach((declaration) => {
            const superType = declaration.getSuperType();
            if (superType) {
                const subclasses = subclassMap.get(superType) || new Set();
                subclasses.add(declaration);
                subclassMap.set(superType, subclasses);
            }
        });

        const superType = this.getFullyQualifiedName();
        const subclasses = subclassMap.get(superType);

        if (subclasses) {
            return Array.from(subclasses);
        }
        return [];
    }

    /**
     * Get all the super-type declarations for this type.
     * @return {ClassDeclaration[]} super-type declarations.
     */
    getAllSuperTypeDeclarations() {
        const results = [];
        for (let type = this;
            (type = type.getSuperTypeDeclaration());) {
            results.push(type);
        }

        return results;
    }

    /**
     * Returns the property with a given name or null if it does not exist.
     * Fields defined in super-types are also introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field, or null if it does not exist
     */
    getProperty(name) {
        let result = this.getOwnProperty(name);
        let classDecl = null;

        if (result === null && this.superType !== null) {
            if (this.getModelFile().isImportedType(this.superType)) {
                let fqnSuper = this.getModelFile().resolveImport(this.superType);
                classDecl = this.modelFile.getModelManager().getType(fqnSuper);
            } else {
                classDecl = this.getModelFile().getType(this.superType);
            }
            result = classDecl.getProperty(name);
        }

        return result;
    }

    /**
     * Returns the properties defined in this class and all super classes.
     *
     * @return {Property[]} the array of fields
     */
    getProperties() {
        let result = this.getOwnProperties();
        let classDecl = null;
        if (this.superType !== null) {
            if (this.getModelFile().isImportedType(this.superType)) {
                let fqnSuper = this.getModelFile().resolveImport(this.superType);
                classDecl = this.modelFile.getModelManager().getType(fqnSuper);
            } else {
                classDecl = this.getModelFile().getType(this.superType);
            }

            if (!classDecl) {
                throw new IllegalModelException('Could not find super type ' + this.superType, this.modelFile, this.ast.location);
            }

            // go get the fields from the super type
            // Note: this allows addition of an $identifier field from a supertype
            // even if this type is explicitly identified.
            // We allow this because it allows normalization of identifier lookup without the model present
            result = result.concat(classDecl.getProperties());
        }

        return result;
    }

    /**
     * Get a nested property using a dotted property path
     * @param {string} propertyPath The property name or name with nested structure e.g a.b.c
     * @returns {Property} the property
     * @throws {IllegalModelException} if the property path is invalid or the property does not exist
     */
    getNestedProperty(propertyPath) {

        const propertyNames = propertyPath.split('.');
        let classDeclaration = this;
        let result = null;

        for (let n = 0; n < propertyNames.length; n++) {

            // get the nth property
            result = classDeclaration.getProperty(propertyNames[n]);

            if (result === null) {
                throw new IllegalModelException('Property ' + propertyNames[n] + ' does not exist on ' + classDeclaration.getFullyQualifiedName(), this.modelFile, this.ast.location);
            }
            // not the last element, get the class of the element
            else if (n < propertyNames.length - 1) {
                if (result.isPrimitive() || result.isTypeEnum()) {
                    throw new Error('Property ' + propertyNames[n] + ' is a primitive or enum. Invalid property path: ' + propertyPath);
                } else {
                    // get the nested type, this throws if the type is missing or if the type is an enum
                    classDeclaration = classDeclaration.getModelFile().getModelManager().getType(result.getFullyQualifiedTypeName());
                }
            }
        }

        return result;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        let superType = '';
        if (this.superType) {
            superType = ' super=' + this.superType;
        }
        return 'ClassDeclaration {id=' + this.getFullyQualifiedName() + superType + ' enum=' + this.isEnum() + ' abstract=' + this.isAbstract() + '}';
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset() {
        return this.type === `${MetaModelNamespace}.AssetDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is an asset
     */
    isParticipant() {
        return this.type === `${MetaModelNamespace}.ParticipantDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is an asset
     */
    isTransaction() {
        return this.type === `${MetaModelNamespace}.TransactionDeclaration`;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an asset
     */
    isEvent() {
        return this.type === `${MetaModelNamespace}.EventDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is an asset
     */
    isConcept() {
        return this.type === `${MetaModelNamespace}.ConceptDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isEnum() {
        return this.type === `${MetaModelNamespace}.EnumDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a map.
     *
     * @return {boolean} true if the class is an asset
     */
    isMapDeclaration() {
        return this.type === `${MetaModelNamespace}.MapDeclaration`;
    }

    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isClassDeclaration() {
        return true;
    }
}

module.exports = ClassDeclaration;
