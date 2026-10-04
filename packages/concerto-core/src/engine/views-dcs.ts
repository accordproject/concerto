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

// The DecoratorManager entry points.

import { rust } from './index';
import { adoptStagedModels, fileStates } from './views-staging';

/**
 * DecoratorManager.validate's structural check (`serializer.fromJSON(
 * decoratorCommandSet)`), once `DecoratorManager.validate` has built `validationModelManager`
 * (and thrown any model error): run on that manager's rustHandle, which
 * mirrors its model files, so nothing is sent again.
 * @param {object} validationModelManager the validation ModelManager, built
 */
function decoratorManagerValidate(validationModelManager: any, decoratorCommandSet: any): void {
    validationModelManager.rustHandle.dcsValidate(decoratorCommandSet);
}

/**
 * BC-19-a: whether a `decorateModels` result may skip the AST shape check:
 * every source model was checked (`dcsSourceShapeChecked`) and everything
 * the commands add passes it (`dcsCommandsShapeChecked`).
 * @return {boolean} true if the result models may skip the check
 */
function decorateResultTrusted(modelManager: any, decoratorCommandSets: any[], options?: any): boolean {
    return dcsSourceShapeChecked(modelManager) && dcsCommandsShapeChecked(decoratorCommandSets, options);
}

/**
 * DecoratorManager.decorateModels, after the public method's
 * `skipValidationAndResolution` handling: on the source manager's own
 * rustHandle (`sourceDcsHandle`), else on a DCS input manager built from
 * `getAst(!options.disableMetamodelResolution, false)`'s models (the engine
 * has its own system models). The result is staged into a new
 * ModelManager's rustHandle (`adoptStagedModels`).
 * @param {object[]} decoratorCommandSets the decorator command sets, as an array
 * @return {object} a new ModelManager with the decorations applied
 */
function decoratorManagerDecorateModels(modelManager: any, decoratorCommandSets: any[], options?: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const source = sourceDcsHandle(modelManager);
    if (source) {
        // On the source manager's own rustHandle, which resolves its
        // models itself; nothing is copied.
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
    // A DCS input manager, and the result staged into the new manager's
    // rustHandle (see `adoptStagedModels`).
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
 * Restores a `decorators` field the TS extractor leaves present but
 * `undefined` (`filterOutDecorators` assigns `decl.decorators = undefined`)
 * where the engine's extractor removes the key: on a node whose source
 * counterpart had a truthy `decorators` and whose result has none.
 * @param {object} sourceNode the pre-extraction AST node (declaration,
 * property, or map key/value type)
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
 * `restoreUndefinedDecorators` over every result model and its declarations,
 * matched by namespace: the results also carry the engine's own system
 * namespaces, which `sourceModels` does not.
 * @param {object[]} resultModels the extracted models, re-shaped in place
 */
function restoreAllUndefinedDecorators(sourceModels: any[], resultModels: any[]): void {
    const sourceByNamespace = new Map<string, any>(sourceModels.map((m: any) => [m.namespace, m]));
    resultModels.forEach((resultModel: any) => {
        const sourceModel = sourceByNamespace.get(resultModel.namespace);
        // A model can carry decorators, as well as its declarations.
        restoreUndefinedDecorators(sourceModel, resultModel);
        (resultModel.declarations || []).forEach((resultDecl: any, j: number) => {
            restoreUndefinedDecorators(sourceModel?.declarations?.[j], resultDecl);
        });
    });
}

/**
 * The three DecoratorManager.extract* methods, after the public methods' option
 * defaults: on the source manager's own rustHandle, else on a DCS input
 * manager. The engine returns the stripped models, staged into a new
 * ModelManager, and the extracted command sets and vocabularies; each caller
 * returns the fields TS 5.0.0 returns, in the same order.
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
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
 * extract binding (`DcsManagerHandle.extract`, `ModelManagerHandle.dcsExtract`).
 */
const EXTRACT_ACTION: { [binding: string]: number } = {
    decoratorManagerExtractDecorators: 0,
    decoratorManagerExtractVocabularies: 1,
    decoratorManagerExtractNonVocabDecorators: 2,
};

/**
 * `decoratorManagerExtract` on the source manager's own rustHandle
 * (`dcsExtract`), staged as `decoratorManagerExtractStaged` stages it. The
 * source models are read only for `restoreUndefinedDecorators`, unresolved
 * (`getAst(false, false)`), since it reads nothing resolution changes.
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
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
 * `decoratorManagerExtract` on a DCS input manager (`dcsManagerFor`, from
 * `getAst(true, false)`'s models), staged into the new ModelManager's
 * rustHandle.
 * @param {string} binding the extract method (an `EXTRACT_ACTION` key)
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
 * DecoratorManager.extractDecorators (see decoratorManagerExtract).
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
 * DecoratorManager.extractVocabularies (see decoratorManagerExtract).
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
 * DecoratorManager.extractNonVocabDecorators (see decoratorManagerExtract).
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
// Staged-handle results. Each operation runs on the source manager's own
// rustHandle (`sourceDcsHandle`), else on a `DcsManagerHandle` built for the
// call (`dcsManagerFor`), and stages the result's model files into the new
// ModelManager's rustHandle, returning their stage ids and headers with the
// result AST. `adoptStagedModels` then does what `fromAst` does, but each
// ModelFile takes its stage and header instead of crossing again, and
// `validateModelFiles` is skipped when the engine validated exactly those
// files under the new manager's options. Every error is thrown by the same
// code at the same point of the call.
// ---------------------------------------------------------------------------

/**
 * Whether a DecoratorManager operation may read `modelManager`'s models from
 * its rustHandle: `getAst`, `getModelFiles` and `resolveMetaModel` are
 * BaseModelManager's own, and the manager has its engine state.
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
 * BC-19: whether every model a DecoratorManager operation reads from
 * `modelManager` passed `checkAstShape`: `dcsCacheable` holds, and every
 * model file was checked with the AST object it holds now and reads it with
 * ModelFile's own `getAst`. A manager built with `metamodelValidation:
 * false`, or holding a file one built, never qualifies.
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
 * BC-19: whether everything `decorateModels` adds passes `checkAstShape`:
 * each command's decorator, and the `ImportType` nodes the engine declares
 * for it and its type-reference arguments (`dcs::synthetic_decorator_imports`),
 * checked together as one synthetic model. A superset of what the engine
 * adds. Anything malformed answers false, and the caller checks each result
 * model instead.
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
 * The source ModelManager's own rustHandle, when the operation can run on
 * it (`dcsDecorateModels`, `dcsExtract`): `dcsCacheable` holds and the
 * handle mirrors the model files, so it holds exactly the models
 * `getAst(resolve, false)` reads and resolves them itself. Otherwise
 * undefined, and the caller takes a `DcsManagerHandle`.
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
 * handle at once, so the two must differ, or wasm-bindgen's borrow check
 * would panic.
 */
function assertDistinctHandles(source: any, target: any): void {
    /* istanbul ignore next: the result manager is always built for the call, so its handle is never the source's */
    if (source === target) {
        throw new Error('DecoratorManager: the result ModelManager must not share the source ModelManager\'s engine handle');
    }
}

/**
 * The DCS input manager for `modelManager.getAst(resolve, false).models`,
 * for a manager whose operations cannot run on its own rustHandle: built
 * for one operation, which frees it.
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
