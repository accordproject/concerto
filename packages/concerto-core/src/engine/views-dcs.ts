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

// The DecoratorManager entry points (P4-09, P5-27, P5-55): split out of
// views.ts (P5-104, review M7), which re-exports them.

import { rust } from './index';
import { adoptStagedModels, fileStates } from './views-staging';

/**
 * DecoratorManager.validate's structural check (`serializer.fromJSON(
 * decoratorCommandSet)`), once the TS body has built `validationModelManager`
 * (the metamodel, `modelFiles` and the DCS model). P5-27 (F6): the command
 * set is checked against the manager's rustHandle's own resident manager
 * (concerto-wasm `ModelManagerHandle.dcsValidate`), which mirrors its model
 * files (P5-34: a BaseModelManager holds only ModelFiles its constructor
 * built, all mirrored): the model files are neither sent again nor loaded
 * into a second manager. Any error loading the models has already been
 * thrown by the TS body while it built `validationModelManager`. P5-103
 * removed the per-call binding an engine without `dcsValidate` took.
 * @param {object} validationModelManager the validation ModelManager, built
 * @param {*} decoratorCommandSet the DecoratorCommandSet object
 */
function decoratorManagerValidate(validationModelManager: any, decoratorCommandSet: any): void {
    validationModelManager.rustHandle.dcsValidate(decoratorCommandSet);
}

/**
 * P5-68 (BC-19-a, R1): whether a `decorateModels` result may skip the AST
 * shape check: every source model was checked (`dcsSourceShapeChecked`) and
 * everything the commands add passes it (`dcsCommandsShapeChecked`).
 * @param {object} modelManager the input ModelManager
 * @param {object[]} decoratorCommandSets the decorator command sets
 * @param {object} [options] the decorateModels options
 * @return {boolean} true if the result models may skip the check
 */
function decorateResultTrusted(modelManager: any, decoratorCommandSets: any[], options?: any): boolean {
    return dcsSourceShapeChecked(modelManager) && dcsCommandsShapeChecked(decoratorCommandSets, options);
}

/**
 * DecoratorManager.decorateModels in rust mode, after the TS body's
 * `skipValidationAndResolution` handling: on the source ModelManager's own
 * rustHandle (`sourceDcsHandle`), or else on a DCS input manager
 * built from `getAst(!options.disableMetamodelResolution, false)`'s models
 * (`dcsManagerFor`; system namespaces left out, since the engine-side
 * manager carries its own copy of them). The decorated models are staged
 * into a new ModelManager's rustHandle (`adoptStagedModels`).
 * @param {object} modelManager the input ModelManager
 * @param {object[]} decoratorCommandSets the decorator command sets, as an array
 * @param {object} [options] the decorateModels options
 * @return {object} a new ModelManager with the decorations applied
 */
function decoratorManagerDecorateModels(modelManager: any, decoratorCommandSets: any[], options?: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const source = sourceDcsHandle(modelManager);
    if (source) {
        // P5-55 (T1, F-A1): on the source manager's own rustHandle, which
        // resolves its models itself; nothing is copied.
        const decoratedModelManager = new ModelManager({
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        decoratedModelManager.clearModelFiles();
        const target = decoratedModelManager.rustHandle;
        assertDistinctHandles(source, target);
        const result = source.dcsDecorateModels(target, decoratorCommandSets, options ?? {});
        adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
            decorateResultTrusted(modelManager, decoratorCommandSets, options));
        return decoratedModelManager;
    }
    // P5-27 (F6): a DCS input manager, and the result staged into the new
    // manager's rustHandle (see `adoptStagedModels`).
    const { dcs } = dcsManagerFor(modelManager, !options?.disableMetamodelResolution);
    try {
        const decoratedModelManager = new ModelManager({
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        decoratedModelManager.clearModelFiles();
        const result = dcs.decorateModels(decoratedModelManager.rustHandle, decoratorCommandSets, options ?? {});
        adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
            decorateResultTrusted(modelManager, decoratorCommandSets, options));
        return decoratedModelManager;
    } finally {
        dcs.free();
    }
}

/**
 * Restores a `decorators` field the TS extractor leaves present-but-`undefined`
 * (`decoratorextractor.ts` `filterOutDecorators`'s `Action.EXTRACT_ALL` branch
 * assigns `decl.decorators = undefined` rather than deleting the key) after
 * the Rust extractor's `filter_out_decorators` (`concerto-rust` `dcs/extractor.rs`)
 * deletes the key outright (`map.remove("decorators")`) instead. Both are
 * `undefined` when read and identical once JSON-serialised, but the oracle
 * distinguishes a present-and-`undefined` field from an absent one (task
 * accordproject/concerto-rust#157), so a node whose *source* counterpart had
 * a (truthy) `decorators` field, and whose extracted counterpart now has
 * none, gets that field set back to `undefined` here — matching the TS shape
 * without touching the Rust engine's own behaviour or its JSON output.
 * @param {object} sourceNode the pre-extraction AST node (declaration,
 * property, or map key/value type)
 * @param {object} resultNode the corresponding post-extraction AST node
 */
function restoreUndefinedDecorators(sourceNode: any, resultNode: any): void {
    if (!sourceNode || !resultNode || typeof resultNode !== 'object') {
        return;
    }
    if (sourceNode.decorators && !('decorators' in resultNode)) {
        resultNode.decorators = undefined;
    }
    if (Array.isArray(sourceNode.properties) && Array.isArray(resultNode.properties)) {
        sourceNode.properties.forEach((sourceProperty: any, i: number) => {
            restoreUndefinedDecorators(sourceProperty, resultNode.properties[i]);
        });
    }
    if (sourceNode.key && resultNode.key) {
        restoreUndefinedDecorators(sourceNode.key, resultNode.key);
    }
    if (sourceNode.value && resultNode.value) {
        restoreUndefinedDecorators(sourceNode.value, resultNode.value);
    }
}

/**
 * `restoreUndefinedDecorators` over every result model and its
 * declarations. `resultModels` also carries the Rust engine's own system
 * namespaces (the Rust-side manager carries its own copy of them, see
 * `decoratorManagerDecorateModels`), which `sourceModels` (system
 * namespaces excluded, `getAst`'s second argument false) does not, so the
 * two arrays line up by namespace, not by index.
 * @param {object[]} sourceModels the pre-extraction models
 * @param {object[]} resultModels the extracted models, re-shaped in place
 */
function restoreAllUndefinedDecorators(sourceModels: any[], resultModels: any[]): void {
    const sourceByNamespace = new Map<string, any>(sourceModels.map((m: any) => [m.namespace, m]));
    resultModels.forEach((resultModel: any) => {
        const sourceModel = sourceByNamespace.get(resultModel.namespace);
        // The model (namespace) itself can carry decorators
        // (`decoratorextractor.ts` `processModels`), as well as its
        // declarations.
        restoreUndefinedDecorators(sourceModel, resultModel);
        (resultModel.declarations || []).forEach((resultDecl: any, j: number) => {
            restoreUndefinedDecorators(sourceModel?.declarations?.[j], resultDecl);
        });
    });
}

/**
 * The three DecoratorManager.extract* methods in rust mode, after the TS
 * body's option defaults: on the source ModelManager's own rustHandle
 * (`decoratorManagerExtractOnSource`), or else on a DCS input manager
 * (`decoratorManagerExtractStaged`). Rust returns the stripped
 * models' AST, staged into a new ModelManager, and the extracted command
 * sets and vocabularies; each caller returns the fields its TS body
 * returns, in the same order. When `options.removeDecoratorsFromModel` is
 * set, `restoreUndefinedDecorators` re-shapes the stripped declarations to
 * match the TS extractor exactly (see its doc comment).
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the binding's result, with `modelManager` materialised
 */
function decoratorManagerExtract(binding: string, modelManager: any, options: any): any {
    const source = sourceDcsHandle(modelManager);
    if (source) {
        return decoratorManagerExtractOnSource(binding, source, modelManager, options);
    }
    return decoratorManagerExtractStaged(binding, modelManager, options);
}

/**
 * The extract action of each DecoratorManager.extract* method, for the one
 * extract binding of the resident manager (`DcsManagerHandle.extract`) and
 * of the source handle (`ModelManagerHandle.dcsExtract`): P5-101 (D-10,
 * accordproject/concerto-rust#455), in place of one binding per action.
 */
const EXTRACT_ACTION: { [binding: string]: number } = {
    decoratorManagerExtractDecorators: 0,
    decoratorManagerExtractVocabularies: 1,
    decoratorManagerExtractNonVocabDecorators: 2,
};

/**
 * `decoratorManagerExtract` on the source ModelManager's own rustHandle
 * (P5-55, T1, F-A1; concerto-wasm `ModelManagerHandle.dcsExtract`), with
 * the result staged into the new ModelManager's rustHandle as
 * `decoratorManagerExtractStaged` stages it. Rust resolves the handle's
 * models itself, as a DCS input manager's input is resolved, so the
 * source models are read only when `restoreUndefinedDecorators` needs them,
 * and then unresolved (`getAst(false, false)`: the model files' own ASTs,
 * not copied): it reads only which nodes have `decorators`, and their
 * `declarations`, `properties`, `key` and `value`, which resolution never
 * changes, so a `resolveMetaModel` here would only cost time.
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
 * @param {object} source the source ModelManager's rustHandle
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the result, with `modelManager` materialised
 */
function decoratorManagerExtractOnSource(binding: string, source: any, modelManager: any, options: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const updatedModelManager = new ModelManager();
    updatedModelManager.clearModelFiles();
    const target = updatedModelManager.rustHandle;
    assertDistinctHandles(source, target);
    const result = source.dcsExtract(target, options, EXTRACT_ACTION[binding]);
    const { staged, validated } = result;
    delete result.staged;
    delete result.validated;
    if (options?.removeDecoratorsFromModel) {
        restoreAllUndefinedDecorators(modelManager.getAst(false, false).models, result.modelManager.models);
    }
    adoptStagedModels(updatedModelManager, result.modelManager, staged, validated, undefined, dcsSourceShapeChecked(modelManager));
    result.modelManager = updatedModelManager;
    return result;
}

/**
 * `decoratorManagerExtract` on a DCS input manager (`dcsManagerFor`), with the
 * result staged into the new ModelManager's rustHandle (P5-27, F6; see
 * `adoptStagedModels`). The same result, and the same errors at the same
 * points: the input is `getAst(true, false)`'s models, and the result
 * AST, re-shaped by `restoreUndefinedDecorators` when
 * `options.removeDecoratorsFromModel` is set, is what the new ModelManager
 * is built from.
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the result, with `modelManager` materialised
 */
function decoratorManagerExtractStaged(binding: string, modelManager: any, options: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const { dcs, sourceModels } = dcsManagerFor(modelManager, true);
    try {
        const updatedModelManager = new ModelManager();
        updatedModelManager.clearModelFiles();
        const result = dcs.extract(updatedModelManager.rustHandle, options, EXTRACT_ACTION[binding]);
        const { staged, validated } = result;
        delete result.staged;
        delete result.validated;
        if (options?.removeDecoratorsFromModel) {
            restoreAllUndefinedDecorators(sourceModels, result.modelManager.models);
        }
        adoptStagedModels(updatedModelManager, result.modelManager, staged, validated, undefined, dcsSourceShapeChecked(modelManager));
        result.modelManager = updatedModelManager;
        return result;
    } finally {
        dcs.free();
    }
}

/**
 * DecoratorManager.extractDecorators in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, decoratorCommandSet, vocabularies}`
 */
function decoratorManagerExtractDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet,
        vocabularies: result.vocabularies
    };
}

/**
 * DecoratorManager.extractVocabularies in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, vocabularies}`
 */
function decoratorManagerExtractVocabularies(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractVocabularies', modelManager, options);
    return {
        modelManager: result.modelManager,
        vocabularies: result.vocabularies
    };
}

/**
 * DecoratorManager.extractNonVocabDecorators in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, decoratorCommandSet}`
 */
function decoratorManagerExtractNonVocabDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractNonVocabDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet
    };
}

// ---------------------------------------------------------------------------
// P5-27 (F6, accordproject/concerto-rust#332): a resident DCS manager with
// staged-handle results.
//
// `decorateModels` and the three `extract*` methods used to send the source
// models' AST to Rust on every call, which rebuilt its input manager from
// it, and to load the result's AST into a new ModelManager with `fromAst`,
// which sent every result model back to Rust (`stageModelFile`), read each
// header across the boundary (`modelFileFromAstHeader`) and validated the
// set again (`validateModelFiles`).
//
// Now the operation runs on the source ModelManager's own rustHandle
// (P5-55, `sourceDcsHandle`), or else on a DCS input manager built in Rust
// for the call (concerto-wasm `DcsManagerHandle`, `dcsManagerFor`; P5-103
// removed the resident copy kept per source manager, which only a manager
// the source handle serves could use). Each operation stages the result's model files into
// the new ModelManager's own rustHandle and returns their stage ids and
// headers with the result AST. `adoptStagedModels` then does what `fromAst`
// does, but each ModelFile takes its stage (`takePrestaged`) and header
// (`applyStagedFileHeader`) instead of crossing again, and `validateModelFiles`
// is skipped when Rust has validated exactly those files, under the same
// (default) options the new manager's rustHandle has. Every error is still
// thrown by the same Rust or TS code, at the same point of the call.
// ---------------------------------------------------------------------------

/**
 * Whether a DecoratorManager operation may read `modelManager`'s models from
 * its rustHandle (`sourceDcsHandle`): `getAst` is BaseModelManager's own,
 * over `getModelFiles` and `resolveMetaModel` also its own, over the
 * manager's rustHandle, which mirrors every model file (P5-34), and the
 * manager has its engine state (P5-100). P5-103 removed the resident DCS
 * input manager this used to decide the keeping of: a manager it holds
 * for always runs on its own rustHandle (P5-55).
 * @param {object} modelManager the source ModelManager
 * @return {boolean} true if it may be
 */
function dcsCacheable(modelManager: any): boolean {
    const { default: BaseModelManager } = require('../basemodelmanager');
    const proto = BaseModelManager.prototype;
    const handle = modelManager?.rustHandle;
    return !!handle && modelManager._engine !== undefined &&
        modelManager.getAst === proto.getAst &&
        modelManager.getModelFiles === proto.getModelFiles &&
        modelManager.resolveMetaModel === proto.resolveMetaModel;
}

/**
 * P5-68 (BC-19-a, R1): whether every model a DecoratorManager operation
 * reads from `modelManager` passed `checkAstShape`: `dcsCacheable` holds
 * (the models are `getAst`'s own reading of the model files, as on the
 * source handle), and every model file, as `getAst(…, false)` lists them,
 * was checked with the AST object it holds now and reads it with
 * ModelFile's own `getAst`. A manager built with `metamodelValidation:
 * false`, or holding any file one built, never qualifies.
 * @param {object} modelManager the source ModelManager
 * @return {boolean} true if every source model was checked
 */
function dcsSourceShapeChecked(modelManager: any): boolean {
    if (!dcsCacheable(modelManager)) {
        return false;
    }
    const { default: ModelFile } = require('../introspect/modelfile');
    const getAst = ModelFile.prototype.getAst;
    return modelManager.getModelFiles(false).every((f: any) =>
        fileStates.get(f)?.shapeChecked === f.ast && f.getAst === getAst);
}

/**
 * P5-68 (BC-19-a, R1): whether everything `decorateModels` adds to the
 * source models passes `checkAstShape`: each command's decorator, and the
 * `ImportType` nodes the engine declares for it and for each of its
 * type-reference arguments (concerto-rust `dcs::synthetic_decorator_imports`:
 * the node's own namespace, else `options.defaultNamespace`, when truthy).
 * They are checked once, together, as the decorators and imports of one
 * synthetic model. This is a superset of what the engine can add (every
 * command, applied or not, and every candidate import). It runs only after
 * the engine has applied the commands, so each set, command, decorator and
 * argument is an object; anything else fails the check or throws here, and
 * either way the answer is false, so the caller then checks each result
 * model as before.
 * @param {object[]} decoratorCommandSets the decorator command sets
 * @param {object} [options] the decorateModels options
 * @return {boolean} true if the added nodes have the metamodel's shape
 */
function dcsCommandsShapeChecked(decoratorCommandSets: any[], options?: any): boolean {
    const defaultNamespace = options?.defaultNamespace;
    const decorators: any[] = [];
    const imports: any[] = [];
    const importFor = (node: any) => {
        const namespace = node.namespace || defaultNamespace;
        if (namespace) {
            imports.push({ $class: 'concerto.metamodel@1.0.0.ImportType', name: node.name, namespace });
        }
    };
    try {
        for (const commandSet of decoratorCommandSets) {
            // `decoratorCommandSets.flatMap(commandSet => commandSet.commands)`.
            const commands = commandSet.commands;
            for (const command of Array.isArray(commands) ? commands : [commands]) {
                const decorator = command.decorator;
                decorators.push(decorator);
                importFor(decorator);
                for (const arg of Array.isArray(decorator.arguments) ? decorator.arguments : []) {
                    if (arg.type) {
                        importFor(arg.type);
                    }
                }
            }
        }
        rust.checkAstShape(JSON.stringify({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'concerto.dcs.shapecheck@1.0.0',
            imports,
            declarations: [],
            decorators,
        }));
        return true;
    } catch {
        return false;
    }
}

/**
 * P5-55 (T1, F-A1, accordproject/concerto-rust#376): the source
 * ModelManager's own rustHandle, when the DecoratorManager operation can run
 * on it (concerto-wasm `ModelManagerHandle.dcsDecorateModels` and
 * `dcsExtract`) instead of on a `DcsManagerHandle` built from a copy of its
 * models: `dcsCacheable` holds (the manager's `getAst`, `getModelFiles` and
 * `resolveMetaModel` are BaseModelManager's own) and the handle mirrors the
 * model files (`_mirrorPending`, P5-34). The handle then holds exactly the
 * models `getAst(resolve, false)` reads, with the same system models, and
 * resolves them itself, so no epoch or invalidation is needed. Otherwise
 * undefined, and the caller takes the `DcsManagerHandle`.
 * @param {object} modelManager the source ModelManager
 * @return {object|undefined} the rustHandle, or undefined
 */
function sourceDcsHandle(modelManager: any): any {
    if (!dcsCacheable(modelManager) || modelManager._mirrorPending) {
        return undefined;
    }
    return modelManager.rustHandle;
}

/**
 * The operations on the source handle borrow it and the new manager's
 * handle at once: the two must differ (the new manager is always built for
 * the call, so they always do), or wasm-bindgen's borrow check would panic.
 * @param {object} source the source ModelManager's rustHandle
 * @param {object} target the new ModelManager's rustHandle
 */
function assertDistinctHandles(source: any, target: any): void {
    /* istanbul ignore next: the result manager is always built for the call, so its handle is never the source's */
    if (source === target) {
        throw new Error('DecoratorManager: the result ModelManager must not share the source ModelManager\'s engine handle');
    }
}

/**
 * The DCS input manager for `modelManager.getAst(resolve, false).models`
 * (concerto-wasm `DcsManagerHandle`), for a manager whose operations cannot
 * run on its own rustHandle (`sourceDcsHandle`): built from `getAst` (its
 * errors thrown at that point), for one operation, which frees it.
 * @param {object} modelManager the source ModelManager
 * @param {boolean} resolve getAst's `resolve` argument
 * @return {object} `{dcs, sourceModels}`: the DcsManagerHandle and the
 * models it was built from (read only)
 */
function dcsManagerFor(modelManager: any, resolve: boolean): any {
    const models = modelManager.getAst(resolve, false).models;
    return { dcs: new rust.DcsManagerHandle(models), sourceModels: models };
}

export {
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractNonVocabDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerValidate,
};
