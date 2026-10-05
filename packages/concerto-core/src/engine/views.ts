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

// The views the engine loader hands the public classes (`engineViews()`),
// re-exported from the modules that hold them (the ones the public classes
// and the fuzz harness read). This module holds no code of its own, and no
// views module imports it:
//
//   views-modules.ts    the introspect modules the views build (a leaf)
//   views-state.ts      the per-ModelFile state of the lazy load path
//   views-batch.ts      a file's construction snapshots, in one engine call
//   views-lazy.ts       the lazily built parts of a lazy file's views
//   views-construct.ts  the construction views, reading the batch
//   views-staging.ts    staging and prestaging in a manager's rustHandle
//   views-lookups.ts    property lookups, identifier names, arena handles
//   views-dcs.ts        the DecoratorManager entry points

export {
    beginModelFile,
    endModelFile,
} from './views-batch';

export type {
    Batch,
} from './views-batch';

export {
    classDeclarationProcess,
    declarationFullyQualifiedName,
    declarationIsValidIdentifier,
    fieldGetScalarField,
    fieldProcess,
    propertyProcess,
    scalarDeclarationProcess,
} from './views-construct';

export {
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractNonVocabDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerValidate,
} from './views-dcs';

export {
    buildDeferredParts,
    builtDeclaration,
    decoratorFactories,
    deferDeclarations,
    deferDecorators,
    installLazyField,
    installLazyViewsCheck,
    localType,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    materialise,
} from './views-lazy';

export {
    adoptFilteredStage,
    adoptSharedView,
    adoptSystemView,
    applyStagedFileHeader,
    applyStagedHeaders,
    checkAstShape,
    commitStaged,
    commitStagedAll,
    copyImportNames,
    dropStaged,
    markSystemModelAst,
    recordImportNames,
    recordedImportNames,
    stageModelFile,
    systemViewHeader,
    updateExternalStaged,
    updateStaged,
    validateAndCommitStaged,
    validateAndUpdateStaged,
    validateAstStaged,
    validateLoaded,
} from './views-staging';

export {
    isShapeChecked,
} from './views-state';

export {
    classDeclarationGetIdentifierFieldName,
    classDeclarationGetProperties,
    classDeclarationGetProperty,
    declarationArenaRef,
    declarationViews,
    modelFileArenaRef,
    notInArena,
} from './views-lookups';
