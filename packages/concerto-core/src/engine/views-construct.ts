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

// The construction views: a Rust call that builds a model object returns a
// JSON snapshot, stored in the object's own fields so getters do not cross.
// Each reads the current batch's snapshot first (views-batch.ts).

import { rust } from './index';
import { batchOf, currentBatch } from './views-batch';
import { deferField, inLazyFile, numberValidatorFromSnapshot, sizeValidatorFromSnapshot, stringValidatorFromSnapshot } from './views-lazy';
import { collectionSizeValidatorModule, fieldModule, stringValidatorModule } from './views-modules';
import type { PrecomputedDeclaration } from './views-batch';

/**
 * ScalarDeclaration.process, after super.process(): type, validator and
 * default value from the engine, set in TS 5.0.0's order.
 */
function scalarDeclarationProcess(declaration: any): void {
    const precomputed = batchOf(declaration.modelFile)?.scalars.get(declaration.ast);
    const snapshot = precomputed ?? rust.scalarDeclarationProcess(declaration);
    declaration.superType = null;
    declaration.superTypeDeclaration = null;
    declaration.idField = null;
    declaration.timestamped = false;
    declaration.abstract = false;
    const kind = snapshot.validator?.kind;
    if (precomputed && kind && inLazyFile(declaration)) {
        // Built on first read.
        const regexAst = declaration.ast.validator;
        deferField(declaration, 'validator', () => (kind === 'NumberValidator'
            ? numberValidatorFromSnapshot(declaration, snapshot.validator)
            : stringValidatorFromSnapshot(declaration, regexAst, snapshot.validator)));
        declaration.type = snapshot.type;
        declaration.defaultValue = snapshot.defaultValue;
        return;
    }
    declaration.validator = null;
    declaration.type = snapshot.type;
    if (kind === 'NumberValidator') {
        declaration.validator = numberValidatorFromSnapshot(declaration, snapshot.validator);
    } else if (kind === 'StringValidator') {
        const { StringValidator } = stringValidatorModule();
        declaration.validator = new StringValidator(declaration, declaration.ast.validator, declaration.ast.lengthValidator);
    }
    declaration.defaultValue = snapshot.defaultValue;
}

/**
 * The snapshot entry for a declaration view being constructed. A defaulted
 * copy is found by its shared `properties` array, only with the super type
 * the entry was computed with.
 */
function declarationEntry(view: any): PrecomputedDeclaration | undefined {
    const batch = currentBatch();
    if (!batch || view.modelFile !== batch.modelFile) {
        return undefined;
    }
    const ast = view.ast;
    const direct = batch.declarations.get(ast);
    if (direct) {
        return direct;
    }
    const properties = ast.properties;
    const copy = Array.isArray(properties) ? batch.defaulted.get(properties) : undefined;
    if (copy && copy.name === ast.name && ast.superType && typeof ast.superType === 'object' &&
        copy.cd && ast.superType.name === copy.cd.superType) {
        return copy;
    }
    return undefined;
}

/** `Declaration.process`'s `isValidIdentifier`: true if the snapshot has an entry, else the binding. */
function declarationIsValidIdentifier(view: any): boolean {
    const entry = declarationEntry(view);
    if (entry && (entry.owner === undefined || entry.owner === view) && view.ast.name === entry.name) {
        entry.owner = view;
        return true;
    }
    // BC-01: `Declaration.process` tests `String(this.ast.name)`, as TS 5.0.0.
    return rust.modelUtilIsValidIdentifier(String(view.ast.name));
}

/** `Declaration.process`'s fully qualified name: from the snapshot while its namespace holds. */
function declarationFullyQualifiedName(view: any): string {
    const namespace = view.modelFile.getNamespace();
    const entry = declarationEntry(view);
    if (entry && entry.owner === view && view.name === entry.name && namespace === currentBatch()!.namespace) {
        return entry.fqn;
    }
    return rust.modelUtilGetFullyQualifiedName(namespace, view.name);
}

/**
 * `ClassDeclaration.process`'s superType/idField decision: the snapshot's
 * `cd` while its name and fqn hold, else the binding.
 */
function classDeclarationProcess(view: any): any {
    const entry = declarationEntry(view);
    if (entry && entry.owner === view && entry.cd && view.name === entry.name && view.fqn === entry.fqn) {
        return { ...entry.cd };
    }
    return rust.classDeclarationProcess(view);
}

/** Whether a view's `type` is the one a `fieldProcess` snapshot assumed. */
function sameType(actual: any, expected: any): boolean {
    return actual === expected || (actual == null && expected == null);
}

/**
 * Property.process, after super.process(): name, type, array and optional
 * from the engine, in TS 5.0.0's order. `type` stays unset when the snapshot
 * omits it (an `EnumProperty`), as in TS 5.0.0.
 */
function propertyProcess(property: any): void {
    const entry = currentBatch()?.properties.get(property.ast);
    let snapshot;
    if (entry && entry.p && (entry.owner === undefined ||
        (property.parent !== undefined && entry.parent === property.parent))) {
        entry.owner = property;
        entry.parent = property.parent;
        snapshot = entry.p;
    } else {
        snapshot = rust.propertyProcess(property);
    }
    property.name = snapshot.name;
    if ('type' in snapshot) {
        property.type = snapshot.type;
    }
    property.array = snapshot.array;
    property.optional = snapshot.optional;
    const sizeAst = property.ast.sizeValidator;
    if (sizeAst && entry?.sz && inLazyFile(property)) {
        const sz = entry.sz;
        deferField(property, 'sizeValidator', () => sizeValidatorFromSnapshot(property, sizeAst, sz));
        return;
    }
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    property.sizeValidator = sizeAst
        ? new CollectionSizeValidator(property, sizeAst)
        : null;
}

/** Field.process, after Property's: the validator and default value. */
function fieldProcess(field: any): void {
    const entry = currentBatch()?.properties.get(field.ast);
    let snapshot;
    if (entry && entry.owner === field && entry.f && sameType(field.type, 'type' in entry.p ? entry.p.type : undefined)) {
        snapshot = entry.f;
    } else {
        snapshot = rust.fieldProcess(field);
    }
    const kind = snapshot.validator?.kind;
    // In a lazy file, a validator known to build is built on first read.
    const sv = entry?.sv;
    if ((kind === 'NumberValidator' || (kind === 'StringValidator' && sv)) && inLazyFile(field)) {
        const numberSnapshot = snapshot.validator;
        const regexAst = field.ast.validator;
        deferField(field, 'validator', () => (kind === 'NumberValidator'
            ? numberValidatorFromSnapshot(field, numberSnapshot)
            : stringValidatorFromSnapshot(field, regexAst, sv)));
        field.defaultValue = snapshot.defaultValue;
        return;
    }
    field.validator = null;
    if (kind === 'NumberValidator') {
        field.validator = numberValidatorFromSnapshot(field, snapshot.validator);
    } else if (kind === 'StringValidator') {
        const { StringValidator } = stringValidatorModule();
        field.validator = new StringValidator(field, field.ast.validator, field.ast.lengthValidator);
    }
    field.defaultValue = snapshot.defaultValue;
}

/**
 * Field.getScalarField, after its cache check: the engine resolves the
 * scalar and returns the synthetic field's AST, built as TS 5.0.0 builds it.
 */
function fieldGetScalarField(field: any): any {
    const { Field } = fieldModule();
    const fieldAst = rust.fieldGetScalarField(field);
    const scalarField = new Field(field.getParent(), fieldAst);
    scalarField.array = field.isArray();
    return scalarField;
}

export {
    classDeclarationProcess,
    declarationFullyQualifiedName,
    declarationIsValidIdentifier,
    fieldGetScalarField,
    fieldProcess,
    propertyProcess,
    scalarDeclarationProcess,
};
