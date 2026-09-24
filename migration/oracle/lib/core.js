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
 * Loads the set of concerto-core modules the oracle needs from one
 * implementation root: either the workspace `src/` (TypeScript, via ts-node;
 * used by the recorder and for coverage) or the frozen npm reference's
 * `dist/` (used by the reference adapter).
 */

const path = require('path');

const ORACLE_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(ORACLE_DIR, '..', '..');
const CORE_PKG_DIR = path.join(REPO_DIR, 'packages', 'concerto-core');
const SRC_ROOT = path.join(CORE_PKG_DIR, 'src');
const REF_PKG_DIR = path.join(ORACLE_DIR, 'reference', 'node_modules', '@accordproject', 'concerto-core');
const REF_ROOT = path.join(REF_PKG_DIR, 'dist');

/**
 * Pick the named export of a CJS-compiled TS module.
 * @param {object} mod module
 * @param {string} name export name
 * @returns {*} export
 */
function pick(mod, name) {
    if (mod && mod[name] !== undefined) {
        return mod[name];
    }
    if (mod && mod.default !== undefined) {
        return mod.default;
    }
    return mod;
}

/**
 * Load the module set.
 * @param {string} root directory containing basemodelmanager(.ts|.js) etc.
 * @param {string} label a label for diagnostics
 * @returns {object} core module set
 */
function loadCore(root, label) {
    const req = (rel) => require(path.join(root, rel));
    const core = {
        label,
        root,
        req,
        BaseModelManager: pick(req('basemodelmanager'), 'BaseModelManager'),
        ModelManager: pick(req('modelmanager'), 'ModelManager'),
        AstModelManager: pick(req('astmodelmanager'), 'AstModelManager'),
        modelFileModule: req('introspect/modelfile'),
        Declaration: pick(req('introspect/declaration'), 'Declaration'),
        ClassDeclaration: pick(req('introspect/classdeclaration'), 'ClassDeclaration'),
        MapDeclaration: pick(req('introspect/mapdeclaration'), 'MapDeclaration'),
        Property: pick(req('introspect/property'), 'Property'),
        MapKeyType: pick(req('introspect/mapkeytype'), 'MapKeyType'),
        MapValueType: pick(req('introspect/mapvaluetype'), 'MapValueType'),
        Factory: pick(req('factory'), 'Factory'),
        Serializer: pick(req('serializer'), 'Serializer'),
        Typed: pick(req('model/typed'), 'Typed'),
        Resource: pick(req('model/resource'), 'Resource'),
        Relationship: pick(req('model/relationship'), 'Relationship'),
        ValidatedResource: pick(req('model/validatedresource'), 'ValidatedResource'),
        ResourceValidator: pick(req('serializer/resourcevalidator'), 'ResourceValidator'),
        ModelUtil: pick(req('modelutil'), 'ModelUtil'),
        metaModelModule: req('introspect/metamodel'),
        DecoratorManager: pick(req('decoratormanager'), 'DecoratorManager'),
        dcsConverterModule: req('dcsconverter'),
        dayjs: pick(req('dayjs-setup'), 'default'),
        dateTimeUtilModule: req('datetimeutil'),
        Introspector: pick(req('introspect/introspector'), 'Introspector'),
        Identifiable: pick(req('model/identifiable'), 'Identifiable'),
        Decorated: pick(req('introspect/decorated'), 'Decorated'),
        Decorator: pick(req('introspect/decorator'), 'Decorator'),
        Validator: pick(req('introspect/validator'), 'Validator'),
        StringValidator: pick(req('introspect/stringvalidator'), 'StringValidator'),
        NumberValidator: pick(req('introspect/numbervalidator'), 'NumberValidator'),
        CollectionSizeValidator: pick(req('introspect/collectionsizevalidator'), 'CollectionSizeValidator'),
        IdentifiedDeclaration: pick(req('introspect/identifieddeclaration'), 'IdentifiedDeclaration'),
        AssetDeclaration: pick(req('introspect/assetdeclaration'), 'AssetDeclaration'),
        ConceptDeclaration: pick(req('introspect/conceptdeclaration'), 'ConceptDeclaration'),
        EventDeclaration: pick(req('introspect/eventdeclaration'), 'EventDeclaration'),
        ParticipantDeclaration: pick(req('introspect/participantdeclaration'), 'ParticipantDeclaration'),
        TransactionDeclaration: pick(req('introspect/transactiondeclaration'), 'TransactionDeclaration'),
        EnumDeclaration: pick(req('introspect/enumdeclaration'), 'EnumDeclaration'),
        ScalarDeclaration: pick(req('introspect/scalardeclaration'), 'ScalarDeclaration'),
        Field: pick(req('introspect/field'), 'Field'),
        RelationshipDeclaration: pick(req('introspect/relationshipdeclaration'), 'RelationshipDeclaration'),
        EnumValueDeclaration: pick(req('introspect/enumvaluedeclaration'), 'EnumValueDeclaration'),
        TypeNotFoundException: pick(req('typenotfoundexception'), 'TypeNotFoundException'),
        // task accordproject/concerto-rust#94: decorator factories as model
        // manager steps, and the async ModelLoader statics.
        DecoratorFactory: pick(req('introspect/decoratorfactory'), 'DecoratorFactory'),
        ModelLoader: pick(req('modelloader'), 'ModelLoader'),
    };
    // ModelFile is looked up lazily: the recorder replaces the export with a
    // recording subclass, and every consumer must see the current binding.
    Object.defineProperty(core, 'ModelFile', {
        enumerable: true,
        get: () => pick(core.modelFileModule, 'ModelFile'),
    });
    return core;
}

let srcCore = null;
let refCore = null;

/**
 * Register ts-node exactly as the unit suite does (tsconfig.build.json).
 */
function ensureTsNode() {
    if (!process[Symbol.for('ts-node.register.instance')]) {
        process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || path.join(CORE_PKG_DIR, 'tsconfig.build.json');
        require(require.resolve('ts-node', { paths: [CORE_PKG_DIR] })).register({
            project: path.join(CORE_PKG_DIR, 'tsconfig.build.json'),
        });
    }
}

/**
 * The workspace src/ core (TypeScript via ts-node).
 * @returns {object} core
 */
function getSrcCore() {
    if (!srcCore) {
        ensureTsNode();
        srcCore = loadCore(SRC_ROOT, 'src');
    }
    return srcCore;
}

/**
 * The frozen npm reference core (concerto-core 5.0.0 dist).
 * @returns {object} core
 */
function getRefCore() {
    if (!refCore) {
        refCore = loadCore(REF_ROOT, 'reference@5.0.0');
    }
    return refCore;
}

module.exports = { loadCore, getSrcCore, getRefCore, ORACLE_DIR, REPO_DIR, CORE_PKG_DIR, SRC_ROOT, REF_ROOT, REF_PKG_DIR };
