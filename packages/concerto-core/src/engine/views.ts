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

export { scalarDeclarationProcess };
