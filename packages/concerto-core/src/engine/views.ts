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
// Snapshot materialisation for the views whose Rust call builds objects
// (P0-04b trial scaffold; PORTING.md 1.5).
//
// A Rust call that constructs a model object returns a JSON snapshot of it.
// The view caches the snapshot in the object's own fields, so the TS getters
// (`getType()`, `getValidator()`, `getDefaultValue()`, `getLowerBound()`,
// ...) read it unchanged, without a boundary call per getter.

import { rust } from './index';

/**
 * ScalarDeclaration.process in rust mode, after super.process(): Rust
 * computes the type, the validator and the default value; this sets the same
 * fields, in the same order, as the TS body. A NumberValidator is rebuilt from
 * its snapshot; a StringValidator is still built by its TS constructor until
 * P2-02 ports it.
 * @param {object} declaration the ScalarDeclaration being processed
 */
function scalarDeclarationProcess(declaration: any): void {
    const snapshot = rust!.scalarDeclarationProcess(declaration);
    declaration.superType = null;
    declaration.superTypeDeclaration = null;
    declaration.idField = null;
    declaration.timestamped = false;
    declaration.abstract = false;
    declaration.validator = null;
    declaration.type = snapshot.type;
    if (snapshot.validator?.kind === 'NumberValidator') {
        const { NumberValidator } = require('../introspect/numbervalidator');
        const validator = Object.create(NumberValidator.prototype);
        // The fields the Validator and NumberValidator constructors set.
        validator.validator = declaration.ast.validator;
        validator.field = declaration;
        validator.lowerBound = snapshot.validator.lowerBound;
        validator.upperBound = snapshot.validator.upperBound;
        declaration.validator = validator;
    } else if (snapshot.validator?.kind === 'StringValidator') {
        const { StringValidator } = require('../introspect/stringvalidator');
        declaration.validator = new StringValidator(declaration, declaration.ast.validator, declaration.ast.lengthValidator);
    }
    declaration.defaultValue = snapshot.defaultValue;
}

/**
 * Property.process in rust mode, after super.process(): Rust computes the
 * name, type, array and optional fields from the AST, in the same order as
 * the TS body. `type` is left unset when the snapshot omits it (the
 * `EnumProperty` case, where TS never assigns `this.type`), so `getType()`
 * reads `undefined` there exactly as ts mode does. `sizeValidator` is still
 * built here, the same way ts mode does, since `CollectionSizeValidator`'s
 * own constructor already ports the Rust engine (P0-04b trial).
 * @param {object} property the Property (or Field/EnumValueDeclaration/
 * RelationshipDeclaration) being processed
 */
function propertyProcess(property: any): void {
    const snapshot = rust!.propertyProcess(property);
    property.name = snapshot.name;
    if ('type' in snapshot) {
        property.type = snapshot.type;
    }
    property.array = snapshot.array;
    property.optional = snapshot.optional;
    const { default: CollectionSizeValidator } = require('../introspect/collectionsizevalidator');
    property.sizeValidator = property.ast.sizeValidator
        ? new CollectionSizeValidator(property, property.ast.sizeValidator)
        : null;
}

/**
 * Field.process in rust mode, after `super.process()` (Property's, already
 * run): Rust computes the validator and the default value, the identical
 * selection `scalarDeclarationProcess` makes for `ScalarDeclaration` — a
 * `NumberValidator` is rebuilt from its snapshot; a `StringValidator` is
 * still built by its TS constructor until P2-02 ports it.
 * @param {object} field the Field being processed
 */
function fieldProcess(field: any): void {
    const snapshot = rust!.fieldProcess(field);
    field.validator = null;
    if (snapshot.validator?.kind === 'NumberValidator') {
        const { NumberValidator } = require('../introspect/numbervalidator');
        const validator = Object.create(NumberValidator.prototype);
        // The fields the Validator and NumberValidator constructors set.
        validator.validator = field.ast.validator;
        validator.field = field;
        validator.lowerBound = snapshot.validator.lowerBound;
        validator.upperBound = snapshot.validator.upperBound;
        field.validator = validator;
    } else if (snapshot.validator?.kind === 'StringValidator') {
        const { StringValidator } = require('../introspect/stringvalidator');
        field.validator = new StringValidator(field, field.ast.validator, field.ast.lengthValidator);
    }
    field.defaultValue = snapshot.defaultValue;
}

export { scalarDeclarationProcess, propertyProcess, fieldProcess };
