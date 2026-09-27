/*
 * Seam ledger classification rules (task P0-03).
 *
 * One entry per source file under packages/concerto-core/src. Each entry has
 * a file-level default {c, t, p, r} and per-member overrides keyed by
 * "Class.member" (or "member" for top-level functions, "Class.get x" for
 * accessors). build-ledger.js joins these rules with the members extracted
 * from the TypeScript AST, so every member gets exactly one row.
 *
 *   c   classification: RUST | HYBRID | TS (never PARTIAL: build-ledger.js
 *       sets PARTIAL itself when a RUST row's body makes no engine call,
 *       engine-calls.js, accordproject/concerto-rust#261)
 *   t   target Rust module ('-' when the member stays in TS)
 *   p   planned task(s): Rust implementation task + view-conversion task
 *   r   reason (mandatory for TS and HYBRID)
 *   cat weight category override: glue (x0.5) | logic (x1) | validation (x1.5)
 *
 * Automatic rules applied by build-ledger.js before the overrides:
 *   - accept(visitor, parameters)            -> TS  (visitor dispatch)
 *   - body is a single `return <literal>`    -> TS  (constant marker)
 *   - body only throws "not implemented"     -> TS  (abstract stub)
 * An explicit override always wins over the automatic rules.
 */
'use strict';

// Target Rust modules (concerto-rust/concerto-core unless stated).
const MU = 'concerto_core::model_util';
const MM = 'concerto_core::model_manager';
const MF = 'concerto_core::introspect::model_file';
const DECL = 'concerto_core::introspect::declaration';
const PROP = 'concerto_core::introspect::property';
const MAP = 'concerto_core::introspect::map';
const SCAL = 'concerto_core::introspect::scalar';
const VAL = 'concerto_core::introspect::validators';
const DEC = 'concerto_core::introspect::decorator';
const INST = 'concerto_core::instance';
const MMV = 'concerto_core::instance::metamodel';
const DCS = 'concerto_core::dcs';
const RID = 'concerto_core::instance::resource_id';
const ROOT = 'concerto_core::rootmodel';
const NONE = '-';

// Reusable reasons.
const R = {
    processFile: 'processFile callback is the pluggable parse seam: CTO text is parsed by concerto-cto in JS (tests stub Parser.parse); the resulting AST is what crosses into Rust',
    parseThenRust: 'string inputs go through the JS processFile callback (CTO parsing stays in concerto-cto); the add/validate/rollback logic runs in Rust',
    ctorFallback: 'view constructor: attaches to the Rust node when the parent is Rust-backed; W tests construct it with sinon-stubbed parents, so it keeps the collaborator-context fallback (plan section 3)',
    exception: 'exception class must stay a JS Error subclass (instanceof / class checks in ~81 assertions, M tests construct it directly); Rust supplies kind/code/params/location and the P4-02 error mapper instantiates this class',
    d7Factory: 'D7: Factory stays TS (uuid/dayjs, constructs dynamic TS Resource objects); model queries it makes go through Rust-backed views',
    d7Instance: 'D7: Resource/Typed dynamic objects stay TS (user-visible JS objects with arbitrary properties and dayjs values)',
    visitorShell: 'visitor shell kept in TS because W tests spy on / stub visitX and build it over stub Resource/Field objects; per-field checks, coercions and messages it calls go to Rust (plan section 3)',
    reportStatic: 'message template moves to the Rust catalogue (P1-05); the static stays as the TS throw site because tests call it directly with stub fields',
    valueGen: 'sample-data generation: Math.random, randexp over JS RegExp and dayjs; output is non-deterministic and tied to Factory generate options (D7)',
    instGen: 'Factory generate path (D7): builds TS Resource objects via Factory and a JS value generator',
    globalize: 'public helper over messages/en.json used by M tests and remaining TS throw sites; the templates themselves are ported to the Rust catalogue (P1-05) but this function stays',
    dayjs: 'dates stay in dayjs (plan section 3, D7); returns dayjs objects',
    yaml: 'YAML (de)serialisation via the `yaml` npm lib (failsafe schema, exact text output); pure data reshaping that only feeds it, no model semantics',
    ownerRef: 'returns a TS-owned object (Factory/Serializer/JS DecoratorFactory list) that has no Rust counterpart',
    dcsCto: 'the DCS model is CTO text compiled by concerto-cto in JS (via addCTOModel); the command-set instance validation itself is Rust (Serializer fast path / validateCommand)',
    userDecoratorFactory: 'decorator objects may be produced by user DecoratorFactory subclasses (JS callbacks); Rust supplies the decorator ASTs and order',
    predicate: 'takes a JS predicate callback over Declaration views; Rust does the AST copy and import pruning',
    regExp: 'pluggable options.regExp (a JS RegExp-compatible constructor) must stay in JS; default ECMAScript regex path uses the regress crate in Rust',
    loader: 'async file/URL loading orchestration (fs, FileLoader, concerto-cto Parser); all model work goes through the ledgered ModelManager methods it calls',
    fsWrite: 'writes files through concerto-util ModelWriter (Node fs); no model logic',
    tsLogger: 'Logger.dispatch is the JS logging sink; the error-vs-warn decision and message come from Rust',
    engineShim: 'engine shim (P4-02/P5-02): plumbing that loads or calls the Rust engine, not ported TS model logic; the model behaviour itself runs in Rust',
};

module.exports = {
    'src/astmodelmanager.ts': {
        c: 'TS', t: NONE, p: NONE, r: R.processFile,
        m: {
            'AstModelManager.constructor': { r: 'subclass wiring only: passes the AST processFile callback to BaseModelManager' },
        },
    },
    'src/basemodelmanager.ts': {
        c: 'RUST', t: MM, p: 'P2-08+P4-08',
        m: {
            'defaultProcessFile': { c: 'TS', t: NONE, p: NONE, r: R.processFile },
            'BaseModelManager.constructor': { c: 'HYBRID', r: 'creates the Rust ModelManager handle; also builds the TS Factory/Serializer, keeps the JS processFile callback and the options object (options.regExp, decoratorValidation)' },
            'BaseModelManager.validateModelFile': { c: 'HYBRID', r: R.parseThenRust },
            'BaseModelManager.addModel': { c: 'HYBRID', r: R.parseThenRust },
            'BaseModelManager.updateModelFile': { c: 'HYBRID', r: R.parseThenRust },
            'BaseModelManager.addModelFiles': { c: 'HYBRID', r: R.parseThenRust },
            'BaseModelManager.updateExternalModels': { c: 'HYBRID', r: 'async download through FileDownloader (JS I/O, stubbed by tests) stays in TS; the add/update/validate/rollback of the downloaded ASTs runs in Rust' },
            'BaseModelManager.writeModelsToFileSystem': { c: 'TS', t: NONE, p: NONE, r: R.fsWrite },
            'BaseModelManager.getFactory': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.getSerializer': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.getDecoratorFactories': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.addDecoratorFactory': { c: 'TS', t: NONE, p: NONE, r: 'registers a user JS DecoratorFactory; factories are JS callbacks invoked while decorators are materialised' },
            'BaseModelManager.validateAst': { p: 'P3-04+P4-08', t: MMV },
            'BaseModelManager.filter': { c: 'HYBRID', r: R.predicate },
            'BaseModelManager.resolveType': { cat: 'validation' },
            'BaseModelManager.getType': { cat: 'validation' },
            // rustHandle cache plumbing (accordproject/concerto-rust#261): not
            // ported model logic, so engine shim like src/engine/*.
            'rustHandleReads': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (caches a rustHandle\'s epoch/namespaces reads)' },
            'BaseModelManager._needsRustWrite': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (decides which namespaces are mirrored to rustHandle)' },
            'BaseModelManager._mirrorWrite': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (runs a rustHandle mirror write, swallowing its error)' },
            // P5-10a lazy views (accordproject/concerto-rust#269).
            'engineViews': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (requires engine/views once, on first use)' },
            'BaseModelManager._rustMirrorAdd': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (the rustHandle write for an added model file: registers the file Rust loaded at construction, or sends the AST)' },
        },
    },
    'src/datetimeutil.ts': { c: 'TS', t: NONE, p: NONE, r: R.dayjs },
    'src/dcsconverter.ts': { c: 'TS', t: NONE, p: NONE, r: R.yaml },
    // src/decoratorextractor.ts was deleted by the P5-02 decorator-manager
    // chunk (2026-09-27): its only callers, DecoratorManager.extract*, now
    // delegate straight to the Rust engine, so the TS extractor class became
    // dead code everywhere and was removed with them. No classification rule
    // needed: the file no longer exists.
    'src/decoratormanager.ts': {
        c: 'RUST', t: DCS, p: 'P4-09',
        m: {
            'DecoratorManager.validate': { c: 'HYBRID', r: R.dcsCto },
            'DecoratorManager.jsonToYaml': { c: 'HYBRID', r: 'command-set validation runs in Rust; YAML emission stays in TS (dcsconverter, `yaml` npm lib)' },
            'DecoratorManager.yamlToJson': { c: 'HYBRID', r: 'YAML parsing stays in TS (dcsconverter, `yaml` npm lib); command-set validation runs in Rust' },
        },
    },
    'src/decoratormodelhelper.ts': { c: 'RUST', t: ROOT, p: 'P2-08+P4-08' },
    // engine/ (P4-02; P5-02 removed the CONCERTO_ENGINE flag). The whole
    // directory is `/* istanbul ignore file */` and excluded from the
    // declaration build (PORTING.md 1.5), so it never moves nyc or the .d.ts
    // snapshot. These files are the shim itself -- the loader, the handle
    // registry, the error-payload mapper and the fast-path wire codec -- not
    // TS logic superseded by Rust, so each is classified TS with a reason
    // naming what it does, per the maintainer's 2026-09-27 ruling on #73.
    'src/engine/errors.ts': { c: 'TS', t: NONE, p: NONE, r: 'JS error-class mapping for engine results: builds the TS exception (IllegalModelException/TypeNotFoundException/ValidationException/MetamodelException/BaseException/Error/TypeError/RangeError) for an engine error payload {kind, code, params, message, location}; Rust decides the kind and renders the message, this only picks the constructor' },
    'src/engine/handles.ts': { c: 'TS', t: NONE, p: NONE, r: 'handle registry bookkeeping: a per-ModelManagerHandle WeakMap from a live TS view object to its Rust arena handle (ModelFileId/DeclId/PropId); no model logic' },
    'src/engine/index.ts': { c: 'TS', t: NONE, p: NONE, r: 'engine loader entry point: requires rust.ts and re-exports the loaded engine; no model logic' },
    'src/engine/rust.ts': { c: 'TS', t: NONE, p: NONE, r: 'loads the @accordproject/concerto-engine WASM module and registers its host callbacks (the error factory, semver.parse); no model logic' },
    'src/engine/serializer-codec.ts': { c: 'TS', t: NONE, p: NONE, r: 'JSON wire codec for the Serializer fast path: encodes/decodes JS runtime values (numbers, Maps, dayjs, typed Resource/ValidatedResource/Relationship instances) to and from the plain-JSON shape the engine call can carry, and rejects shapes it cannot (cycles, lone surrogates, `__proto__`) so the caller falls back to the TS visitor path; pure wire-format transcoding, no validation or population logic of its own' },
    'src/engine/serializer.ts': {
        c: 'HYBRID', t: NONE, p: 'P4-10', r: 'JSON envelope building, the ModelManagerHandle cache and the options.regExp fallback decision stay JS; the actual population (fromJSON) and generation (toJSON) logic runs in Rust via one serializerFromJson/serializerToJson call per document (the P4-10 fast path)',
    },
    'src/engine/views.ts': {
        c: 'HYBRID', t: NONE, p: 'P4-06+P4-07', r: 'per-declaration/property Rust-call result materialisation: calls the Rust engine to compute the value (a ScalarDeclaration\'s type/validator/default, and similar snapshots), then assigns the returned fields onto the TS view object so its existing getters read them unchanged; the computation itself is Rust',
        // P5-10a lazy views (accordproject/concerto-rust#269): the staging,
        // deferral and identity plumbing around the Rust load; the load and
        // every check it makes run in Rust (stageModelFile), and the views
        // are built by the ledgered view constructors.
        m: {
            'stageModelFile': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: sends a ModelFile\'s AST to Rust once and keeps the loaded file staged; decides lazy vs eager)' },
            'markLazy': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: records a lazily built file and the decorator factories its manager had at construction)' },
            'materialise': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: builds a file\'s declaration views on first read through the ledgered view constructors, and caches them)' },
            'defineLazyFields': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: installs the declarations/localTypes accessors)' },
            'deferDeclarations': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: defers a file\'s declaration views; the migration check mode builds them at once)' },
            'takeStage': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: stage bookkeeping)' },
            'commitStaged': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: registers the staged file in rustHandle)' },
            'dropStaged': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: drops a stage that will not be registered)' },
            'validateLoaded': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: validates the staged or registered file without sending the AST again)' },
            // P5-10b lazy views, part 2 (accordproject/concerto-rust#270):
            // per-declaration building, and the decorators, validators and
            // map types built on first read from the file's view snapshot.
            'computeBatch': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: reads a file\'s one-call Rust view snapshot into per-node lookups)' },
            'declarationIndex': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: indexes a file\'s declarations by their localTypes key)' },
            'localType': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: getLocalType for a lazily built file builds only the declaration view asked for)' },
            'builtDeclaration': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: the identity map from a declaration index to the view already built)' },
            'defineOwn': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: stores a built part as a plain own field)' },
            'installLazyField': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: the prototype accessor over a deferred part)' },
            'deferField': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: defers a part to its first read)' },
            'isPending': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: whether a part is still deferred)' },
            'withBatch': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: runs a deferred build with its file\'s snapshots)' },
            'batchOf': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: the current snapshots of a file)' },
            'decoratorModule': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (requires introspect/decorator once)' },
            'decoratorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: rebuilds a Decorator from its Rust decoratorProcess snapshot)' },
            'buildDecorators': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: Decorated.process\'s decorator loop on first read, running the decorator factories, BC-24)' },
            'deferDecorators': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: defers an element\'s decorators when building them cannot throw)' },
            'inLazyFile': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: whether an element belongs to a lazily built file)' },
            'numberValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a NumberValidator from its Rust snapshot)' },
            'stringValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a StringValidator from its Rust stringValidatorNew snapshot)' },
            'sizeValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a CollectionSizeValidator from its Rust collectionSizeValidatorNew snapshot)' },
            'buildDeferredParts': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: the migration check mode builds every deferred part at once)' },
        },
    },
    'src/factory.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Factory },
    'src/globalize.ts': { c: 'TS', t: NONE, p: NONE, r: R.globalize },
    'src/introspect/assetdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/classdeclaration.ts': {
        c: 'RUST', t: DECL, p: 'P2-03+P4-06',
        m: {
            'ClassDeclaration.getProperties': { cat: 'validation' },
            'ClassDeclaration.getNestedProperty': { cat: 'validation' },
        },
    },
    'src/introspect/collectionsizevalidator.ts': { c: 'RUST', t: VAL, p: 'P2-02+P4-04' },
    'src/introspect/conceptdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/decorated.ts': {
        c: 'RUST', t: DEC, p: 'P2-07+P4-05',
        m: {
            'Decorated.constructor': { c: 'HYBRID', r: R.ctorFallback },
            'Decorated.process': { c: 'HYBRID', r: R.userDecoratorFactory },
            'Decorated.getDecorators': { c: 'HYBRID', r: R.userDecoratorFactory },
            'Decorated.getDecorator': { c: 'HYBRID', r: R.userDecoratorFactory },
        },
    },
    'src/introspect/decorator.ts': {
        c: 'RUST', t: DEC, p: 'P2-07+P4-05',
        m: {
            'Decorator.constructor': { c: 'HYBRID', r: 'Decorator is a user-subclassable JS class (DecoratorFactory returns subclasses); tests construct it directly. Argument parsing (process) is Rust' },
            'Decorator.handleError': { c: 'HYBRID', r: R.tsLogger },
        },
    },
    'src/introspect/decoratorfactory.ts': {
        c: 'TS', t: NONE, p: NONE,
        m: {
            'DecoratorFactory.newDecorator': { r: 'abstract user extension point: users subclass DecoratorFactory in JS' },
        },
    },
    'src/introspect/declaration.ts': {
        c: 'RUST', t: DECL, p: 'P2-03+P4-05',
        m: {
            'Declaration.constructor': { c: 'HYBRID', r: R.ctorFallback },
        },
    },
    'src/introspect/enumdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-04+P4-06' },
    'src/introspect/enumvaluedeclaration.ts': { c: 'RUST', t: PROP, p: 'P2-04+P4-07' },
    'src/introspect/eventdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/field.ts': {
        c: 'RUST', t: PROP, p: 'P2-04+P4-07',
        m: {
            'Field.constructor': { c: 'HYBRID', r: R.ctorFallback },
        },
    },
    'src/introspect/identifieddeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/illegalmodelexception.ts': { c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception },
    'src/introspect/introspector.ts': { c: 'RUST', t: MM, p: 'P2-08+P4-08' },
    'src/introspect/mapdeclaration.ts': {
        c: 'RUST', t: MAP, p: 'P2-06+P4-07',
        m: {
            'MapDeclaration.constructor': { c: 'HYBRID', r: R.ctorFallback },
        },
    },
    'src/introspect/mapkeytype.ts': { c: 'RUST', t: MAP, p: 'P2-06+P4-07' },
    'src/introspect/mapvaluetype.ts': { c: 'RUST', t: MAP, p: 'P2-06+P4-07' },
    'src/introspect/metamodel.ts': { c: 'RUST', t: MMV, p: 'P3-04+P4-08' },
    'src/introspect/modelfile.ts': {
        c: 'RUST', t: MF, p: 'P2-08+P4-08',
        m: {
            'ModelFile.constructor': { c: 'HYBRID', r: R.ctorFallback + ' (modelmanager.js/modelfile.js build ModelFile over stub ModelManagers)', cat: 'validation' },
            'ModelFile.getModelFile': { c: 'TS', t: NONE, p: NONE, r: 'returns `this`; nothing to port' },
            'ModelFile.filter': { c: 'HYBRID', r: R.predicate },
            'ModelFile.getDeclarations': { c: 'HYBRID', r: 'takes a JS class constructor and filters with instanceof; TS maps the constructor to a Rust declaration kind, Rust does the filtering' },
            'ModelFile.fromAst': { cat: 'validation' },
            // P5-10a: fromAst split into its header and declarations parts.
            'ModelFile._fromAstHeader': { cat: 'validation' },
            'ModelFile._fromAstDeclarations': { c: 'HYBRID', r: 'reads the file\'s one-call Rust view snapshot (modelFileViewSnapshot) around the declaration views it builds', cat: 'validation' },
            'ModelFile._fromAstDeclarationViews': { cat: 'validation' },
            // P5-10b: one declaration's view, built on its own or in order.
            'ModelFile._declarationView': { cat: 'validation' },
            'ModelFile.isCompatibleVersion': { cat: 'validation' },
            'ModelFile.enforceImportVersioning': { cat: 'validation' },
        },
    },
    'src/introspect/numbervalidator.ts': { c: 'RUST', t: VAL, p: 'P2-02+P4-04' },
    'src/introspect/participantdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/property.ts': {
        c: 'RUST', t: PROP, p: 'P2-04+P4-07',
        m: {
            'Property.constructor': { c: 'HYBRID', r: R.ctorFallback },
        },
    },
    'src/introspect/relationshipdeclaration.ts': { c: 'RUST', t: PROP, p: 'P2-04+P4-07' },
    'src/introspect/scalardeclaration.ts': { c: 'RUST', t: SCAL, p: 'P2-05+P4-07' },
    'src/introspect/stringvalidator.ts': {
        c: 'RUST', t: VAL, p: 'P2-02+P4-04',
        m: {
            'StringValidator.constructor': { c: 'HYBRID', r: R.regExp, cat: 'validation' },
            'StringValidator.validate': { c: 'HYBRID', r: 'length checks and messages in Rust; regex match must use the JS RegExp when options.regExp is supplied (see matchesRegex)' },
            'StringValidator.matchesRegex': { c: 'HYBRID', r: R.regExp },
            'StringValidator.getRegex': { c: 'TS', t: NONE, p: NONE, r: 'public API returns a JS RegExp object (possibly an options.regExp instance) that Factory/InstanceGenerator/randexp consume' },
        },
    },
    'src/introspect/transactiondeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/validator.ts': {
        c: 'RUST', t: VAL, p: 'P2-02+P4-04',
        m: {
            'Validator.reportError': { c: 'HYBRID', r: 'throws concerto-util BaseException (JS class, errorType code); the message text and error code come from Rust' },
            'Validator.validate': { c: 'TS', t: NONE, p: NONE, r: 'empty base-class no-op; nothing to port' },
        },
    },
    'src/metamodelexception.ts': { c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception },
    'src/model/identifiable.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance },
    'src/model/relationship.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance },
    'src/model/resource.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance },
    'src/model/resourceid.ts': {
        c: 'RUST', t: RID, p: 'P2-01+P4-03',
        m: {
            'ResourceId.constructor': { c: 'HYBRID', r: 'plain JS value object with public namespace/type/id fields that callers read directly; argument checks are trivial' },
        },
    },
    'src/model/typed.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance },
    'src/model/validatedresource.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance + '; these shells hand the value to the ResourceValidator visitor, whose checks are ledgered separately' },
    'src/modelloader.ts': { c: 'TS', t: NONE, p: NONE, r: R.loader },
    'src/modelmanager.ts': {
        c: 'TS', t: NONE, p: NONE, r: R.processFile,
        m: {
            'ModelManager.constructor': { r: 'subclass wiring only: passes the CTO processFile callback to BaseModelManager' },
            'ModelManager.addCTOModel': { c: 'HYBRID', t: MM, p: 'P2-08+P4-08', r: R.parseThenRust },
        },
    },
    'src/modelutil.ts': {
        c: 'RUST', t: MU, p: 'P2-01+P4-03',
        m: {
            'ModelUtil.isValidIdentifier': { cat: 'validation' },
            'ModelUtil.parseNamespace': { cat: 'validation' },
        },
    },
    'src/rootmodelhelper.ts': { c: 'RUST', t: ROOT, p: 'P2-08+P4-08' },
    'src/securityexception.ts': { c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception },
    'src/serializer.ts': {
        c: 'HYBRID', t: INST, p: 'P3-01+P4-10',
        m: {
            'Serializer.constructor': { c: 'TS', t: NONE, p: NONE, r: 'holds TS Factory/ModelManager references and the options object; argument checks only' },
            'Serializer.setDefaultOptions': { c: 'TS', t: NONE, p: NONE, r: 'options-object bookkeeping; no model logic' },
            'Serializer.toJSON': { r: 'fast path: one Rust call validates and serialises the whole document; visitor path (ResourceValidator + JSONGenerator over TS Resource objects) kept for options/tests that need it' },
            'Serializer.fromJSON': { r: 'fast path: one Rust call validates/coerces the whole document; building the TS Resource objects (Factory, dayjs) stays in TS (D7)' },
        },
    },
    'src/serializer/instancegenerator.ts': {
        c: 'TS', t: NONE, p: NONE, r: R.instGen,
        m: {
            'InstanceGenerator.findConcreteSubclass': { c: 'RUST', t: INST, p: 'P3-01+P4-10', r: '' },
        },
    },
    'src/serializer/jsongenerator.ts': {
        c: 'HYBRID', t: INST, p: 'P3-01+P4-10', r: R.visitorShell,
        m: {
            'JSONGenerator.constructor': { c: 'TS', t: NONE, p: NONE, r: 'options plumbing for the TS visitor shell' },
            'JSONGenerator.visit': { c: 'TS', t: NONE, p: NONE, r: 'visitor dispatch: W tests spy on visit/visitX' },
            'JSONGenerator.convertToJSON': { r: 'DateTime formatting of TS dayjs values on the visitor path; Rust formats from (epoch ms, offset) on the fast path' },
        },
    },
    'src/serializer/jsonpopulator.ts': {
        c: 'HYBRID', t: INST, p: 'P3-01+P4-10', r: R.visitorShell,
        m: {
            'getAssignableProperties': { c: 'RUST', r: '', cat: 'validation' },
            'validateProperties': { c: 'RUST', r: '', cat: 'validation' },
            'JSONPopulator.constructor': { c: 'TS', t: NONE, p: NONE, r: 'options plumbing for the TS visitor shell (plus a process.env.TZ debug warning)' },
            'JSONPopulator.visit': { c: 'TS', t: NONE, p: NONE, r: 'visitor dispatch: W tests spy on visit/visitX (jsonpopulator.js, 57 stub instances)' },
            'JSONPopulator.convertToObject': { r: 'type checks, integer/strict-datetime rules and messages in Rust; the dayjs value is created in TS (D7)', cat: 'validation' },
        },
    },
    'src/serializer/resourcevalidator.ts': {
        c: 'HYBRID', t: INST, p: 'P3-01+P4-10', r: R.visitorShell,
        m: {
            'ResourceValidator.constructor': { c: 'TS', t: NONE, p: NONE, r: 'options plumbing for the TS visitor shell' },
            'ResourceValidator.visit': { c: 'TS', t: NONE, p: NONE, r: 'visitor dispatch: W tests spy on visit/visitX (resourcevalidator.js)' },
            'ResourceValidator.checkMapType': { cat: 'validation' },
            'ResourceValidator.checkEnum': { cat: 'validation' },
            'ResourceValidator.checkArray': { cat: 'validation' },
            'ResourceValidator.checkItem': { cat: 'validation' },
            'ResourceValidator.checkRelationship': { cat: 'validation' },
            'ResourceValidator.visitClassDeclaration': { cat: 'validation' },
            'ResourceValidator.visitField': { cat: 'validation' },
            'ResourceValidator.visitEnumDeclaration': { cat: 'validation' },
            'ResourceValidator.visitMapDeclaration': { cat: 'validation' },
            'ResourceValidator.visitRelationshipDeclaration': { cat: 'validation' },
            'ResourceValidator.reportFieldTypeViolation': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportNotResouceViolation': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportNotRelationshipViolation': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportMissingRequiredProperty': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportEmptyIdentifier': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportInvalidEnumValue': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportAbstractClass': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportUndeclaredField': { r: R.reportStatic, cat: 'logic' },
            'ResourceValidator.reportInvalidFieldAssignment': { r: R.reportStatic, cat: 'logic' },
        },
    },
    'src/serializer/validationexception.ts': { c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception },
    'src/serializer/valuegenerator.ts': { c: 'TS', t: NONE, p: NONE, r: R.valueGen },
    'src/typenotfoundexception.ts': {
        c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception,
        m: {
            'TypeNotFoundException.getTypeName': { r: 'accessor on the TS exception class' },
        },
    },
};
