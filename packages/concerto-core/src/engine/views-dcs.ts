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
import { adoptStagedModels } from './views-staging';
import { baseModelManagerModule, modelFileModule, modelManagerModule } from './views-modules';
import { isShapeChecked } from './views-state';

/**
 * DecoratorManager.validate's structural check, run on the validation
 * manager's rustHandle, which already mirrors its model files.
 */
function decoratorManagerValidate(validationModelManager: any, decoratorCommandSet: any): void {
    validationModelManager.rustHandle.dcsValidate(decoratorCommandSet);
}

/**
 * BC-19: whether a `decorateModels` result may skip the AST shape check:
 * every source model and everything the commands add was checked.
 */
function decorateResultTrusted(modelManager: any, decoratorCommandSets: any[], options?: any): boolean {
    return dcsSourceShapeChecked(modelManager) && dcsCommandsShapeChecked(decoratorCommandSets, options);
}

/**
 * DecoratorManager.decorateModels: on the source manager's rustHandle, else
 * on a DCS input manager built from `getAst`'s models. The result is staged
 * into a new ModelManager (`adoptStagedModels`).
 */
function decoratorManagerDecorateModels(modelManager: any, decoratorCommandSets: any[], options?: any): any {
    const { default: ModelManager } = modelManagerModule();
    const source = sourceDcsHandle(modelManager);
    if (source) {
        // The source handle resolves its models itself; nothing is copied.
        // A new manager holds only the system models, which
        // `adoptStagedModels` skips, so it needs no clearing.
        const decoratedModelManager = new ModelManager({
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        const target = decoratedModelManager.rustHandle;
        const result = source.dcsDecorateModels(target, decoratorCommandSets, options ?? {});
        adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
            decorateResultTrusted(modelManager, decoratorCommandSets, options));
        return decoratedModelManager;
    }
    const { dcs } = dcsManagerFor(modelManager, !options?.disableMetamodelResolution);
    try {
        const decoratedModelManager = new ModelManager({
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        const result = dcs.decorateModels(decoratedModelManager.rustHandle, decoratorCommandSets, options ?? {});
        adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
            decorateResultTrusted(modelManager, decoratorCommandSets, options));
        return decoratedModelManager;
    } finally {
        dcs.free();
    }
}

/**
 * Restores a `decorators` field that TS `filterOutDecorators` leaves present
 * but `undefined` where the engine removes the key: on a node whose source
 * had truthy `decorators` and whose result has none.
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

/** `restoreUndefinedDecorators` over every result model, matched by namespace. */
function restoreAllUndefinedDecorators(sourceModels: any[], resultModels: any[]): void {
    const sourceByNamespace = new Map<string, any>(sourceModels.map((m: any) => [m.namespace, m]));
    resultModels.forEach((resultModel: any) => {
        const sourceModel = sourceByNamespace.get(resultModel.namespace);
        restoreUndefinedDecorators(sourceModel, resultModel);
        (resultModel.declarations || []).forEach((resultDecl: any, j: number) => {
            restoreUndefinedDecorators(sourceModel?.declarations?.[j], resultDecl);
        });
    });
}

/**
 * The three DecoratorManager.extract* methods, on the source rustHandle or a
 * DCS input manager. The stripped models are staged into a new
 * ModelManager; each caller returns the fields TS 5.0.0 returns.
 */
function decoratorManagerExtract(binding: string, modelManager: any, options: any): any {
    const source = sourceDcsHandle(modelManager);
    if (source) {
        return decoratorManagerExtractOnSource(binding, source, modelManager, options);
    }
    return decoratorManagerExtractStaged(binding, modelManager, options);
}

/** The extract action of each extract* method, for the one extract binding. */
const EXTRACT_ACTION: { [binding: string]: number } = {
    decoratorManagerExtractDecorators: 0,
    decoratorManagerExtractVocabularies: 1,
    decoratorManagerExtractNonVocabDecorators: 2,
};

/**
 * `decoratorManagerExtract` on the source rustHandle. The source models are
 * read unresolved, only for `restoreUndefinedDecorators`.
 */
function decoratorManagerExtractOnSource(binding: string, source: any, modelManager: any, options: any): any {
    const { default: ModelManager } = modelManagerModule();
    const updatedModelManager = new ModelManager();
    const target = updatedModelManager.rustHandle;
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

/** `decoratorManagerExtract` on a DCS input manager, staged into the new ModelManager. */
function decoratorManagerExtractStaged(binding: string, modelManager: any, options: any): any {
    const { default: ModelManager } = modelManagerModule();
    const { dcs, sourceModels } = dcsManagerFor(modelManager, true);
    try {
        const updatedModelManager = new ModelManager();
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

/** DecoratorManager.extractDecorators: `{modelManager, decoratorCommandSet, vocabularies}`. */
function decoratorManagerExtractDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet,
        vocabularies: result.vocabularies
    };
}

/** DecoratorManager.extractVocabularies: `{modelManager, vocabularies}`. */
function decoratorManagerExtractVocabularies(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractVocabularies', modelManager, options);
    return {
        modelManager: result.modelManager,
        vocabularies: result.vocabularies
    };
}

/** DecoratorManager.extractNonVocabDecorators: `{modelManager, decoratorCommandSet}`. */
function decoratorManagerExtractNonVocabDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractNonVocabDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet
    };
}

// Staged-handle results: each operation runs on the source rustHandle,
// else on a `DcsManagerHandle` built for the call, and stages the result's
// files into the new manager's rustHandle. `adoptStagedModels` then does
// what `fromAst` does without sending them again, skipping
// `validateModelFiles` when the engine validated exactly those files. Every
// error is thrown at the same point as in TS.

/**
 * Whether an operation may read `modelManager`'s models from its rustHandle:
 * `getAst`, `getModelFiles` and `resolveMetaModel` are BaseModelManager's own.
 */
function dcsCacheable(modelManager: any): boolean {
    const { default: BaseModelManager } = baseModelManagerModule();
    const proto = BaseModelManager.prototype;
    const handle = modelManager?.rustHandle;
    return !!handle && modelManager._engine !== undefined &&
        modelManager.getAst === proto.getAst &&
        modelManager.getModelFiles === proto.getModelFiles &&
        modelManager.resolveMetaModel === proto.resolveMetaModel;
}

/**
 * BC-19: whether every source model passed `checkAstShape` with the AST it
 * holds now and reads it with ModelFile's own `getAst`. A manager built with
 * `metamodelValidation: false`, or holding such a file, never qualifies.
 */
function dcsSourceShapeChecked(modelManager: any): boolean {
    if (!dcsCacheable(modelManager)) {
        return false;
    }
    const { default: ModelFile } = modelFileModule();
    const getAst = ModelFile.prototype.getAst;
    return modelManager.getModelFiles(false).every((f: any) =>
        isShapeChecked(f) && f.getAst === getAst);
}

/**
 * BC-19: whether everything `decorateModels` adds (each decorator and the
 * imports the engine declares for it) passes `checkAstShape`, checked as one
 * synthetic model. False on anything malformed; the caller then checks each
 * result model.
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
 * The source manager's rustHandle, when it mirrors the model files and so
 * holds exactly what `getAst(resolve, false)` reads; otherwise undefined.
 */
function sourceDcsHandle(modelManager: any): any {
    if (!dcsCacheable(modelManager) || modelManager._mirrorPending) {
        return undefined;
    }
    return modelManager.rustHandle;
}

/**
 * A DCS input manager for `getAst(resolve, false).models`, built for one
 * operation, which frees it. Returns `{dcs, sourceModels}`.
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
