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
 */

// Model manager calls that change (or may cache into) its state. They are
// appended to the model manager's recipe as "steps".
const MM_STEPS = [
    'addModel', 'addModelFile', 'addModelFiles', 'updateModelFile', 'deleteModelFile',
    'clearModelFiles', 'fromAst', 'validateModelFiles',
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
];
// Calls that make a model manager's state unreproducible from plain data.
const MM_TAINT = ['addDecoratorFactory', 'updateExternalModels'];

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
const SERIALIZER_METHODS = ['fromJSON', 'toJSON'];

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
];
// Construction-time internals and visitor entry points (their arguments are
// visitors, never plain data).
const INTROSPECTION_EXCLUDE = new Set([
    'constructor', 'accept', 'process', 'processType', 'fromAst', 'addTimestampField', 'addIdentifierField',
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
    const stat = (op, holderName, holders, name) => {
        ops.set(op, {
            op, kind: 'static', fn: name,
            patch: holders.map((h) => ({ holder: h, key: name })),
            exec: (c, target, args) => {
                const h = staticHolder(c, holderName);
                if (typeof h[name] !== 'function') {
                    throw new TypeError(`${holderName} has no function ${name}`);
                }
                return h[name](...args);
            },
        });
    };

    const BMM = core.BaseModelManager.prototype;
    for (const m of MM_STEPS) {
        method('ModelManager.' + m, [BMM], m, { step: true });
    }
    for (const m of MM_CTO_STEPS) {
        method('ModelManager.' + m, [core.ModelManager.prototype], m, { step: true });
    }
    for (const m of MM_QUERIES) {
        method('ModelManager.' + m, [BMM], m);
    }
    for (const m of MM_TAINT) {
        method('ModelManager.' + m, [BMM], m, { taint: true });
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

    for (const cls of ['ModelManager', 'BaseModelManager', 'AstModelManager', 'ModelFile']) {
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
    default: throw new Error('unknown static holder ' + name);
    }
}

module.exports = { opTable, MM_STEPS, MM_CTO_STEPS, MM_QUERIES, MM_TAINT, staticHolder };
