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

/**
 * The op catalogue: the public semantic boundary of concerto-core that the
 * oracle records and replays. Shared by the recorder (what to patch) and by
 * engine adapters (how to execute an op on a core).
 *
 * Op kinds:
 *   ctor    new <Class>(...args)                       inputs: {args}
 *   method  target.<method>(...args)                   inputs: {target, args}
 *   static  <holder>.<fn>(...args)                     inputs: {args}
 *
 * An op with `async: true` returns a promise; its outcome is what the promise
 * settles to (task accordproject/concerto-rust#94). Such an op may also carry
 * an environment in its inputs: `fs` (files it reads, by relative path) and
 * `net` (the HTTP responses it fetched, by URL); see README.md.
 */

// Model manager calls that change (or may cache into) its state. They are
// appended to the model manager's recipe as "steps".
const MM_STEPS = [
    'addModel', 'addModelFile', 'addModelFiles', 'updateModelFile', 'deleteModelFile',
    'clearModelFiles', 'fromAst', 'validateModelFiles',
    // task accordproject/concerto-rust#94: a step whose argument is an
    // encodable DecoratorFactory (lib/encodable.js); any other factory still
    // taints the model manager (step-nonplain).
    'addDecoratorFactory',
];
// ModelManager (CTO) only.
const MM_CTO_STEPS = ['addCTOModel'];
// Read-only model manager queries.
const MM_QUERIES = [
    'validateModelFile', 'getType', 'resolveType', 'getAst', 'getModels', 'getNamespaces',
    'derivesFrom', 'isAssignableTo', 'getAssignableConcreteTypes', 'resolveMetaModel',
    'getAssetDeclarations', 'getTransactionDeclarations', 'getEventDeclarations',
    'getParticipantDeclarations', 'getMapDeclarations', 'getEnumDeclarations',
    'getConceptDeclarations', 'getDecoratorValidation', 'filter',
    // writeModelsToFileSystem (task P2-11): recorded only when its path is
    // falsy, where it throws (no file name, or no path) before touching the
    // disk; see WRITES_TO_DISK below.
    'writeModelsToFileSystem',
    // task P2-11b: public accessors that were missing from this list, so no
    // call to them was ever recorded, whatever the input. accept takes a
    // visitor, recorded only as an encodable kind (lib/encodable.js).
    'isModelManager', 'isAliasedTypeEnabled', 'getModelFileByFileName', 'getFactory', 'accept',
];
// Ops that would write files for a truthy first argument (the directory).
// The recorder skips such calls ('writes-to-disk') and an adapter refuses to
// run one, so no recorded or replayed call ever writes to disk.
const WRITES_TO_DISK = new Set(['ModelManager.writeModelsToFileSystem']);
// Calls that make a model manager's state unreproducible from plain data.
// updateExternalModels is async: the call itself is recorded (task
// accordproject/concerto-rust#94), with the model manager after it as an
// effect, but a replayed recipe cannot await a step, so later calls on that
// model manager are still not recorded.
const MM_TAINT = ['updateExternalModels'];
// Async public ops (task accordproject/concerto-rust#94).
const MODELLOADER_STATICS = ['loadModelManager', 'loadModelManagerFromModelFiles'];
const ASYNC_OPS = new Set([
    ...MM_TAINT.map((m) => 'ModelManager.' + m),
    ...MODELLOADER_STATICS.map((f) => 'ModelLoader.' + f),
]);
// Matches a string ModelLoader hands to a URL loader rather than to the file
// system (http://, https://, github://).
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;

const MODELFILE_METHODS = [
    'validate', 'getType', 'resolveType', 'isLocalType', 'isImportedType', 'resolveImport',
    'getFullyQualifiedTypeName', 'getLocalType', 'isDefined',
    // getImportURI (task P2-11): a plain public accessor over importUriMap,
    // reachable on any registered ModelFile with no stub needed; it was
    // simply missing from this op table, so no call to it was ever
    // recorded regardless of input.
    'getImportURI',
];
const FACTORY_METHODS = ['newResource', 'newConcept', 'newRelationship', 'newTransaction', 'newEvent'];
// setDefaultOptions (task P2-11b): a public method missing from this list.
const SERIALIZER_METHODS = ['fromJSON', 'toJSON', 'setDefaultOptions'];

const MODELUTIL_STATICS = [
    'getShortName', 'getNamespace', 'parseNamespace', 'importFullyQualifiedNames', 'isPrimitiveType',
    'isAssignableTo', 'capitalizeFirstLetter', 'isEnum', 'isMap', 'isScalar', 'isValidIdentifier',
    'getFullyQualifiedName', 'removeNamespaceVersionFromFullyQualifiedName', 'isSystemProperty',
    'isPrivateSystemProperty', 'isValidMapKey', 'isValidMapKeyScalar', 'isValidMapValue',
];
const METAMODEL_FUNCS = ['newMetaModelManager', 'validateMetaModel', 'modelManagerFromMetaModel'];
const DCS_FUNCS = ['jsonToYaml', 'yamlToJson'];

// Classes whose public prototype methods are recorded as introspection ops
// (op name "<Class>.<method>", the class that defines the method).
const INTROSPECTION_CLASSES = [
    'ModelFile', 'Decorated', 'Declaration', 'ClassDeclaration', 'IdentifiedDeclaration',
    'AssetDeclaration', 'ConceptDeclaration', 'EventDeclaration', 'ParticipantDeclaration',
    'TransactionDeclaration', 'EnumDeclaration', 'MapDeclaration', 'ScalarDeclaration',
    'Property', 'Field', 'RelationshipDeclaration', 'EnumValueDeclaration', 'MapKeyType',
    'MapValueType', 'Decorator', 'Validator', 'StringValidator', 'NumberValidator',
    'CollectionSizeValidator', 'Typed', 'Identifiable', 'Resource', 'Relationship', 'Introspector',
    // task P2-11b: getTypeName, on an exception built by its recorded
    // constructor op (an `errnew` input, lib/codec.js).
    'TypeNotFoundException',
];
// Construction-time internals. Visitor entry points (accept) are recorded
// since task P2-11b, but only with a visitor built by lib/encodable.js; any
// other visitor is code, and the call is skipped as nonplain.
const INTROSPECTION_EXCLUDE = new Set([
    'constructor', 'process', 'processType', 'fromAst', 'addTimestampField', 'addIdentifierField',
    'assignFieldDefaults',
]);
// Instance methods that change their receiver: the receiver's state after
// the call is part of the outcome.
const INTROSPECTION_MUTATORS = new Set(['setIdentifier']);

/**
 * Static function names of DecoratorManager in a given core.
 * @param {object} core module set
 * @returns {string[]} names
 */
function decoratorManagerStatics(core) {
    return Object.getOwnPropertyNames(core.DecoratorManager)
        .filter((k) => !['length', 'name', 'prototype'].includes(k) && typeof core.DecoratorManager[k] === 'function');
}

/**
 * Build the op table for a core.
 *
 * Each entry: {op, kind, patch: [{holder, key}], exec(core, target, args), step?}
 * `patch` lists where the recorder installs its wrapper in that core.
 *
 * @param {object} core module set
 * @returns {Map<string, object>} op name -> spec
 */
function opTable(core) {
    const ops = new Map();
    const method = (op, holders, name, extra) => {
        ops.set(op, Object.assign({
            op, kind: 'method', method: name,
            patch: holders.map((h) => ({ holder: h, key: name })),
            exec: (c, target, args) => {
                if (!target || typeof target[name] !== 'function') {
                    throw new TypeError(`target has no method ${name}`);
                }
                return target[name](...args);
            },
        }, extra || {}));
    };
    const stat = (op, holderName, holders, name, extra) => {
        ops.set(op, Object.assign({
            op, kind: 'static', fn: name,
            patch: holders.map((h) => ({ holder: h, key: name })),
            exec: (c, target, args) => {
                const h = staticHolder(c, holderName);
                if (typeof h[name] !== 'function') {
                    throw new TypeError(`${holderName} has no function ${name}`);
                }
                return h[name](...args);
            },
        }, extra || {}));
    };

    const BMM = core.BaseModelManager.prototype;
    for (const m of MM_STEPS) {
        method('ModelManager.' + m, [BMM], m, { step: true });
    }
    for (const m of MM_CTO_STEPS) {
        method('ModelManager.' + m, [core.ModelManager.prototype], m, { step: true });
    }
    for (const m of MM_QUERIES) {
        const op = 'ModelManager.' + m;
        if (!WRITES_TO_DISK.has(op)) {
            method(op, [BMM], m);
            continue;
        }
        method(op, [BMM], m, {
            skipIf: (args) => (args[0] ? 'writes-to-disk' : null),
            exec: (c, target, args) => {
                if (args[0]) {
                    const err = new Error(op + ' with a directory would write to disk');
                    err.name = 'HarnessError';
                    throw err;
                }
                if (!target || typeof target[m] !== 'function') {
                    throw new TypeError(`target has no method ${m}`);
                }
                return target[m](...args);
            },
        });
    }
    for (const m of MM_TAINT) {
        method('ModelManager.' + m, [BMM], m, { taint: true, async: true, mutatesTarget: true });
    }
    for (const m of MODELFILE_METHODS) {
        method('ModelFile.' + m, [core.ModelFile.prototype], m);
    }
    for (const m of FACTORY_METHODS) {
        method('Factory.' + m, [core.Factory.prototype], m);
    }
    for (const m of SERIALIZER_METHODS) {
        method('Serializer.' + m, [core.Serializer.prototype], m);
    }
    method('Resource.validate', [core.ValidatedResource.prototype], 'validate');
    method('Resource.setPropertyValue', [core.Typed.prototype, core.ValidatedResource.prototype], 'setPropertyValue', { mutatesTarget: true });
    method('Resource.addArrayValue', [core.Typed.prototype, core.ValidatedResource.prototype], 'addArrayValue', { mutatesTarget: true });
    method('Resource.instanceOf', [core.Typed.prototype], 'instanceOf');
    method('Resource.toJSON', [core.Typed.prototype, core.Resource.prototype], 'toJSON');

    for (const f of MODELUTIL_STATICS) {
        stat('ModelUtil.' + f, 'ModelUtil', [core.ModelUtil], f);
    }
    for (const f of decoratorManagerStatics(core)) {
        stat('DecoratorManager.' + f, 'DecoratorManager', [core.DecoratorManager], f);
    }
    const mmod = core.metaModelModule;
    for (const f of METAMODEL_FUNCS) {
        stat('MetaModel.' + f, 'MetaModel', [mmod, mmod.default].filter(Boolean), f);
    }
    const dmod = core.dcsConverterModule;
    for (const f of DCS_FUNCS) {
        stat('DcsConverter.' + f, 'DcsConverter', [dmod, dmod.default].filter(Boolean), f);
    }

    // Introspection and instance accessors: every public prototype method of
    // the introspection / model classes not already listed above.
    const taken = new Map();
    for (const spec of ops.values()) {
        for (const { holder, key } of spec.patch || []) {
            taken.set(holder, (taken.get(holder) || new Set()).add(key));
        }
    }
    for (const cls of INTROSPECTION_CLASSES) {
        const C = core[cls];
        if (!C) {
            continue;
        }
        const proto = C.prototype;
        for (const m of Object.getOwnPropertyNames(proto)) {
            const d = Object.getOwnPropertyDescriptor(proto, m);
            if (!d || typeof d.value !== 'function' || INTROSPECTION_EXCLUDE.has(m) || m.startsWith('_')) {
                continue;
            }
            if (taken.has(proto) && taken.get(proto).has(m)) {
                continue;
            }
            const op = cls + '.' + m;
            if (ops.has(op)) {
                continue;
            }
            method(op, [proto], m, INTROSPECTION_MUTATORS.has(m) ? { mutatesTarget: true } : undefined);
        }
    }
    stat('Relationship.fromURI', 'Relationship', [core.Relationship], 'fromURI');
    const dtu = core.dateTimeUtilModule;
    stat('DateTimeUtil.setCurrentTime', 'DateTimeUtil', [dtu, dtu.default].filter(Boolean), 'setCurrentTime');

    // ModelLoader (task accordproject/concerto-rust#94): static async.
    // loadModelManager reads each of its ctoFiles that is not a URL from the
    // file system; `envFiles` names those paths so the recorder can put their
    // contents in the fixture (inputs.fs).
    for (const f of MODELLOADER_STATICS) {
        stat('ModelLoader.' + f, 'ModelLoader', [core.ModelLoader], f, {
            async: true,
            envFiles: f === 'loadModelManager'
                ? (args) => (Array.isArray(args[0]) ? args[0].filter((x) => typeof x === 'string' && !URL_LIKE.test(x)) : [])
                : undefined,
        });
    }

    // Serializer.new and TypeNotFoundException.new (task P2-11): public,
    // exported constructors, recorded for their own argument handling (a
    // missing factory or model manager; the default message). A successful
    // Serializer is summarised as an object, an exception as an error value.
    // ScalarDeclaration.new (task accordproject/concerto-rust#94): the exported
    // constructor, the only way to a ScalarDeclaration whose AST has no scalar
    // $class. The result is summarised; as an input it is encoded as a
    // `declnew` recipe (its model file and AST).
    // SecurityException.new (task P2-11b): the exported constructor, recorded
    // like TypeNotFoundException.new (its result is an error value).
    for (const cls of ['ModelManager', 'BaseModelManager', 'AstModelManager', 'ModelFile', 'Serializer', 'TypeNotFoundException', 'ScalarDeclaration', 'SecurityException']) {
        ops.set(cls + '.new', {
            op: cls + '.new', kind: 'ctor', cls,
            exec: (c, target, args) => new (c[cls])(...args),
        });
    }
    return ops;
}

/**
 * @param {object} core module set
 * @param {string} name holder name
 * @returns {object} holder
 */
function staticHolder(core, name) {
    switch (name) {
    case 'ModelUtil': return core.ModelUtil;
    case 'DecoratorManager': return core.DecoratorManager;
    case 'MetaModel': return core.metaModelModule;
    case 'DcsConverter': return core.dcsConverterModule;
    case 'Relationship': return core.Relationship;
    case 'DateTimeUtil': return core.dateTimeUtilModule;
    case 'ModelLoader': return core.ModelLoader;
    default: throw new Error('unknown static holder ' + name);
    }
}

module.exports = { opTable, MM_STEPS, MM_CTO_STEPS, MM_QUERIES, MM_TAINT, ASYNC_OPS, URL_LIKE, staticHolder };
