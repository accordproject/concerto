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
    // P5-11 (accordproject/concerto-rust#276): rows that make no engine call
    // and stay in TS by the maintainer's decision of 2026-09-28, per the
    // stage 1 evaluation posted on #276. Each keeps its planned task, so the
    // oracle's owner attribution is unchanged.
    p511: 'Stays TS by maintainer decision (accordproject/concerto-rust#276, 2026-09-28)',
};
R.fwd = 'forward/orchestration over members counted elsewhere: the logic is in the callee(s) it calls, which is where any Rust work is counted; this body makes no engine call. ' + R.p511;
R.fwdParse = 'orchestration: parses CTO text through the JS processFile callback (concerto-cto) and forwards to RUST members, where the Rust work is counted; this body makes no engine call. ' + R.p511;
R.fieldRead = 'trivial accessor: returns a field of the view, which P5-10 lazy views fill from the Rust snapshot (or the wrapped AST); a Rust crossing (0.2-1.4 us) costs 2-30x the read (0.1-0.2 us). ' + R.p511;
R.lazyAccessor = 'trivial accessor or filter over lazily built views: the state it reads was computed by Rust at load; a crossing costs more than it saves. ' + R.p511;
R.superCtor = 'JS class wiring: a constructor that only calls super and/or process() (process runs in Rust and is counted there); kept because the override is in the BC-37 api-snapshot. ' + R.p511;
R.fixedData = 'fixed-data builder: returns or adds a fixed system model/field definition (rootmodel.json/decoratormodel.json are duplicated in concerto-rust src/); no model logic to port. ' + R.p511;
R.viewGlue = 'view constructor glue: stores the parent and AST and calls process(), which is counted separately (the Rust snapshot or the collaborator-context fallback for W tests over stubbed parents, plan section 3); no engine call of its own. ' + R.p511;
R.visitorFallback = 'visitor fallback path: runs only when Serializer.fromJSON/toJSON hit EngineFastPathUnsupported (a custom options.regExp, a lone surrogate, a cycle or a wire shape the codec rejects) or when a caller drives the visitor directly; the fast path runs the same work in Rust in one call. ' + R.p511;
R.rvShell = 'ResourceValidator visitor: the fallback path behind EngineFastPathUnsupported of ValidatedResource.validate/setPropertyValue/addArrayValue, which validate in one Rust call since P5-12c (accordproject/concerto-rust#293; the entry point moved by maintainer decision on #289), and the Serializer visitor fallback; W tests drive visitX directly. ' + R.p511;
R.shimP511 = R.engineShim + ' (P5-11: reclassified from HYBRID; it makes no engine call of its own)';

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
            'BaseModelManager.validateModelFile': { c: 'TS', r: R.fwdParse + ' (then ModelFile.validate)' },
            'BaseModelManager.addModel': { c: 'TS', r: R.fwdParse + ' (then addModelFile)' },
            'BaseModelManager.updateModelFile': { c: 'HYBRID', r: R.parseThenRust },
            'BaseModelManager.addModelFiles': { c: 'HYBRID', r: R.parseThenRust },
            // P5-11 (accordproject/concerto-rust#276, ported by #287): the
            // apply/validate/rollback part runs in Rust (update_external_models);
            // the download stays in JS.
            'BaseModelManager.updateExternalModels': { c: 'RUST' },
            'BaseModelManager.writeModelsToFileSystem': { c: 'TS', t: NONE, p: NONE, r: R.fsWrite },
            'BaseModelManager.getFactory': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.getSerializer': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.getDecoratorFactories': { c: 'TS', t: NONE, p: NONE, r: R.ownerRef },
            'BaseModelManager.addDecoratorFactory': { c: 'TS', t: NONE, p: NONE, r: 'registers a user JS DecoratorFactory; factories are JS callbacks invoked while decorators are materialised' },
            'BaseModelManager.validateAst': { p: 'P3-04+P4-08', t: MMV },
            'BaseModelManager.filter': { c: 'TS', r: R.predicate + '; this member only runs the JS predicate and forwards to ModelFile.filter, where the Rust work is counted. ' + R.p511 },
            'BaseModelManager.resolveType': { cat: 'validation' },
            'BaseModelManager.getType': { cat: 'validation' },
            // rustHandle cache plumbing (accordproject/concerto-rust#261): not
            // ported model logic, so engine shim like src/engine/*.
            'rustHandleReads': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (caches a rustHandle\'s epoch/namespaces reads)' },
            'BaseModelManager._needsRustWrite': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (decides which namespaces are mirrored to rustHandle)' },
            // accordproject/concerto-rust#262: mirror writes are unguarded;
            // only a stub ModelFile the constructor never ran for is not mirrored.
            'BaseModelManager._isMirrored': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (decides which model files are mirrored to rustHandle: every one but a stub the ModelFile constructor never ran for)' },
            'BaseModelManager._rustMirrorUpdate': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (the rustHandle write for a replaced model file: update, add or delete)' },
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
            'DecoratorManager.jsonToYaml': { c: 'TS', r: R.yaml + ' (forwards to dcsconverter; P5-11: no engine call of its own)' },
            'DecoratorManager.yamlToJson': { c: 'TS', r: R.yaml + ' (forwards to dcsconverter; P5-11: no engine call of its own)' },
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
    'src/engine/validate-resource.ts': {
        c: 'TS', t: NONE, p: NONE, r: 'binary wire codec for one-call instance validation (P5-12c): writes a live JS value (numbers, strings, Maps, dayjs, typed Resource/ValidatedResource/Relationship instances) in the validator\'s value shape, and rejects shapes it cannot carry so the caller falls back to the TS visitor; pure transcoding, no validation logic of its own',
        m: {
            'validateResource': { c: 'HYBRID', p: 'P5-12c', r: 'one validateResourceBinary call per ValidatedResource.validate(): the result code maps to the TS exception class, or to the visitor fallback; the validation itself runs in Rust' },
            'validateProperty': { c: 'HYBRID', p: 'P5-12c', r: 'one validatePropertyBinary call per ValidatedResource.setPropertyValue/addArrayValue: the result code maps to the TS exception class, or to the visitor fallback; the validation itself runs in Rust' },
            'visitorIsCheaper': { r: 'routing decision (P5-12c): a string, number or boolean set on a plain primitive field with no validator stays on the ResourceValidator visitor, which is cheaper there than an engine call; reads the field\'s shape only, no validation logic of its own' },
            'outcome': { c: 'TS', r: R.engineShim + ' (maps a result code to the exception the error factory builds, or to the visitor fallback)' },
        },
    },
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
            'decoratorFactories': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: no decorator factory applies while a lazily built file\'s views are built; factories keep the eager path)' },
            'probeCustomRegExp': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: with a custom options.regExp, builds the Fields\' StringValidators at construction so the user engine runs, and throws, at load)' },
            'hasStringValidator': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: which property AST nodes the Rust fieldProcess selection gives a StringValidator)' },
            'takeProbedStringValidator': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: hands a StringValidator built at construction to its Field)' },
            'materialise': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: builds a file\'s declaration views on first read through the ledgered view constructors, and caches them)' },
            'defineLazyFields': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: installs the declarations/localTypes accessors)' },
            'deferDeclarations': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: defers a file\'s declaration views; the migration check mode builds them at once)' },
            'takeStage': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: stage bookkeeping)' },
            'commitStaged': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: registers the staged file in rustHandle)' },
            'dropStaged': { c: 'TS', p: 'P5-10a', r: R.engineShim + ' (lazy views: drops a stage that will not be registered)' },
            'isEngineBuilt': { c: 'TS', t: NONE, p: NONE, r: R.engineShim + ' (whether a model file was built through the engine path; false only for a stub the ModelFile constructor never ran for, accordproject/concerto-rust#262)' },
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
            'buildDecorators': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: Decorated.process\'s decorator loop on first read; no decorator factory applies in a lazily built file)' },
            'deferDecorators': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: defers an element\'s decorators when building them cannot throw)' },
            'inLazyFile': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: whether an element belongs to a lazily built file)' },
            'numberValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a NumberValidator from its Rust snapshot)' },
            'stringValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a StringValidator from its Rust stringValidatorNew snapshot)' },
            'sizeValidatorFromSnapshot': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (rebuilds a CollectionSizeValidator from its Rust collectionSizeValidatorNew snapshot)' },
            'buildDeferredParts': { c: 'TS', p: 'P5-10b', r: R.engineShim + ' (lazy views: the migration check mode builds every deferred part at once)' },
            // P5-14 (accordproject/concerto-rust#308): the per-view cache of
            // ClassDeclaration.getProperties/getProperty; a miss still runs
            // the Rust classDeclarationGetProperties binding.
            'classDeclarationGetProperties': { c: 'HYBRID', p: 'P5-14', r: R.engineShim + ' (property lookup cache: a copy of the cached list, else the Rust classDeclarationGetProperties binding, whose answer it caches)' },
            'propertiesOf': { c: 'HYBRID', p: 'P5-14', r: R.engineShim + ' (property lookup cache: the cached list, else the Rust classDeclarationGetProperties binding, recording the super type\'s call)' },
            'classDeclarationGetProperty': { c: 'HYBRID', p: 'P5-14', r: R.engineShim + ' (property lookup cache: a name lookup over the cached list, else the Rust classDeclarationGetProperty binding)' },
            'invalidatePropertyLookups': { c: 'TS', p: 'P5-14', r: R.engineShim + ' (property lookup cache: dropped when a ModelManager changes its model files)' },
            'lookupCacheable': { c: 'TS', p: 'P5-14', r: R.engineShim + ' (property lookup cache: only views of engine-built files of a real ModelManager)' },
            'lookupValid': { c: 'TS', p: 'P5-14', r: R.engineShim + ' (property lookup cache: whether an entry still holds)' },
            'validLookup': { c: 'TS', p: 'P5-14', r: R.engineShim + ' (property lookup cache: a view\'s entry, if it still holds)' },
            'newLookup': { c: 'TS', p: 'P5-14', r: R.engineShim + ' (property lookup cache: builds an entry from the binding\'s answer)' },
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
            'Decorated.constructor': { c: 'TS', r: R.viewGlue },
            'Decorated.process': { c: 'HYBRID', r: R.userDecoratorFactory },
            'Decorated.getDecorators': { c: 'TS', r: R.lazyAccessor + ' (the decorators, built by Rust decoratorProcess snapshots or user DecoratorFactory callbacks)' },
            'Decorated.getDecorator': { c: 'TS', r: R.lazyAccessor + ' (a name lookup over the decorator views)' },
        },
    },
    'src/introspect/decorator.ts': {
        c: 'RUST', t: DEC, p: 'P2-07+P4-05',
        m: {
            'Decorator.constructor': { c: 'TS', r: 'Decorator is a user-subclassable JS class (DecoratorFactory returns subclasses); tests construct it directly. Argument parsing (process) is Rust and counted there. ' + R.p511 },
            'Decorator.handleError': { c: 'TS', r: R.tsLogger + '. ' + R.p511 },
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
            'Declaration.constructor': { c: 'TS', r: R.viewGlue },
        },
    },
    'src/introspect/enumdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-04+P4-06' },
    'src/introspect/enumvaluedeclaration.ts': { c: 'RUST', t: PROP, p: 'P2-04+P4-07' },
    'src/introspect/eventdeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/field.ts': {
        c: 'RUST', t: PROP, p: 'P2-04+P4-07',
        m: {
            'Field.constructor': { c: 'TS', r: R.viewGlue },
        },
    },
    'src/introspect/identifieddeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/illegalmodelexception.ts': { c: 'TS', t: NONE, p: 'P1-05+P4-02', r: R.exception },
    'src/introspect/introspector.ts': { c: 'RUST', t: MM, p: 'P2-08+P4-08' },
    'src/introspect/mapdeclaration.ts': {
        c: 'RUST', t: MAP, p: 'P2-06+P4-07',
        m: {
            'MapDeclaration.constructor': { c: 'TS', r: R.viewGlue },
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
            'ModelFile.getDeclarations': { c: 'TS', r: 'takes a JS class constructor and filters the lazily built declaration views with instanceof (a JS-only concern); no engine call. ' + R.p511 },
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
            'Property.constructor': { c: 'TS', r: R.viewGlue },
        },
    },
    'src/introspect/relationshipdeclaration.ts': { c: 'RUST', t: PROP, p: 'P2-04+P4-07' },
    'src/introspect/scalardeclaration.ts': { c: 'RUST', t: SCAL, p: 'P2-05+P4-07' },
    'src/introspect/stringvalidator.ts': {
        c: 'RUST', t: VAL, p: 'P2-02+P4-04',
        m: {
            'StringValidator.constructor': { c: 'HYBRID', r: R.regExp, cat: 'validation' },
            'StringValidator.validate': { c: 'HYBRID', r: 'length checks and messages in Rust; regex match must use the JS RegExp when options.regExp is supplied (see matchesRegex)' },
            'StringValidator.matchesRegex': { c: 'TS', r: R.regExp + '; this member runs the JS RegExp (or the user\'s options.regExp) match itself. ' + R.p511 },
            'StringValidator.getRegex': { c: 'TS', t: NONE, p: NONE, r: 'public API returns a JS RegExp object (possibly an options.regExp instance) that Factory/InstanceGenerator/randexp consume' },
        },
    },
    'src/introspect/transactiondeclaration.ts': { c: 'RUST', t: DECL, p: 'P2-03+P4-06' },
    'src/introspect/validator.ts': {
        c: 'RUST', t: VAL, p: 'P2-02+P4-04',
        m: {
            'Validator.reportError': { c: 'TS', r: 'JS throw site: throws concerto-util BaseException (JS class, errorType code) with the message its caller passes; no engine call. ' + R.p511 },
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
            'ResourceId.constructor': { c: 'TS', r: 'plain JS value object with public namespace/type/id fields that callers read directly; argument checks are trivial and make no engine call. ' + R.p511 },
        },
    },
    'src/model/typed.ts': { c: 'TS', t: NONE, p: NONE, r: R.d7Instance },
    'src/model/validatedresource.ts': {
        c: 'TS', t: NONE, p: NONE, r: R.d7Instance,
        // P5-12c (accordproject/concerto-rust#293): one Rust call per
        // validation, the visitor behind EngineFastPathUnsupported.
        m: {
            'ValidatedResource.validate': { c: 'HYBRID', t: INST, p: 'P5-12c', r: 'fast path (P5-12c): one Rust call (validateResourceBinary, src/engine/validate-resource.ts) validates the whole resource; the ResourceValidator visitor runs only behind EngineFastPathUnsupported; the Resource object stays TS (D7)' },
            'ValidatedResource.setPropertyValue': { c: 'HYBRID', t: INST, p: 'P5-12c', r: 'the undeclared-field check and the assignment stay TS (D7); the value is validated by one Rust call (validatePropertyBinary, src/engine/validate-resource.ts), with the ResourceValidator visitor behind EngineFastPathUnsupported, and for a string, number or boolean on a plain primitive field with no validator, where the visitor is cheaper (visitorIsCheaper)' },
            'ValidatedResource.addArrayValue': { c: 'HYBRID', t: INST, p: 'P5-12c', r: 'the undeclared-field and not-an-array checks, the array copy and the assignment stay TS (D7); the new array is validated by one Rust call (validatePropertyBinary, src/engine/validate-resource.ts), with the ResourceValidator visitor behind EngineFastPathUnsupported' },
        },
    },
    'src/modelloader.ts': { c: 'TS', t: NONE, p: NONE, r: R.loader },
    'src/modelmanager.ts': {
        c: 'TS', t: NONE, p: NONE, r: R.processFile,
        m: {
            'ModelManager.constructor': { r: 'subclass wiring only: passes the CTO processFile callback to BaseModelManager' },
            'ModelManager.addCTOModel': { c: 'TS', p: 'P2-08+P4-08', r: R.fwdParse + ' (then addModelFile)' },
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
            'InstanceGenerator.findConcreteSubclass': { c: 'TS', p: 'P3-01+P4-10', r: R.instGen + '; the concrete-type ordering comes from the RUST getAssignableClassDeclarations. ' + R.p511 },
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
            'getAssignableProperties': { c: 'TS', r: R.visitorFallback + ' (Rust serializer.rs carries the same checks and messages)', cat: 'validation' },
            'validateProperties': { c: 'TS', r: R.visitorFallback + ' (Rust serializer.rs carries the same checks and messages)', cat: 'validation' },
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

// ---------------------------------------------------------------- P5-11
// accordproject/concerto-rust#276 stage 2: the maintainer's decision of
// 2026-09-28 on the stage 1 evaluation of the rows that make no engine call
// (the PARTIAL rows of #261 and the HYBRID rows with no engine call):
//   - no more code moves to Rust for now: the 14 rows the evaluation
//     recommended moving stayed RUST in the rules, so the engine-call scan
//     kept them PARTIAL, marked `deferred` (port candidates, SUMMARY 5b).
//     The pause was lifted on 2026-09-28 and accordproject/concerto-rust#287
//     ported all 14: each now makes an engine call, so the scan counts it
//     RUST, and none is marked `deferred` any more;
//   - every row recommended "stay in TS" or "forward" becomes TS with the
//     reason below (SUMMARY 4); none was found dead;
//   - the six HYBRID rows whose engine call is one hop away are counted by
//     the engine-call scan itself (engine-calls.js: same-module helpers and
//     local handles), so they need no rule here.
// Merged into the per-file overrides above; a key that already has an
// override is an error, so each row is decided in exactly one place.
const P5_11 = {
    'src/basemodelmanager.ts': {
        // Stay TS.
        'BaseModelManager.getModelFiles': { c: 'TS', r: R.lazyAccessor + ' (a filter over the model-file view map: 0.23 us in TS against 3.1 us for a string[] crossing)' },
        'BaseModelManager.getModels': { c: 'TS', r: 'returns the CTO definitions text, which lives in JS (ModelFile.getDefinitions); a crossing would copy every CTO text back. ' + R.p511 },
        'BaseModelManager.getAst': { c: 'TS', r: 'returns the caller\'s own AST objects (JS object identity preserved); `resolve` goes to concerto-metamodel\'s resolveLocalNames, a JS package. ' + R.p511 },
        'BaseModelManager.getAssignableConcreteTypes': { c: 'TS', r: R.fwd + ' (getType, the RUST getAssignableClassDeclarations and an isAbstract filter)' },
        'BaseModelManager.fromAst': { c: 'TS', r: R.fwd + ' (orchestrates the RUST addModelFile and validateModelFiles)' },
        'BaseModelManager.addRootModel': { c: 'TS', r: 'JS module-interop guard (`getRootModel || module`) around adding the fixed root model; Rust mirrors the system models itself. ' + R.p511 },
        'BaseModelManager.addDecoratorModel': { c: 'TS', r: 'JS module-interop guard (`getDecoratorModel || module`) around adding the fixed decorator model; Rust mirrors the system models itself. ' + R.p511 },
        'getFileNameFromIdentifier': { c: 'TS', r: 'JS-side helper: path string handling for writeModelsToFileSystem. ' + R.p511 },
        'BaseModelManager.resolveMetaModel': { c: 'TS', r: 'JS-side helper: calls concerto-metamodel\'s resolveLocalNames (a JS package) over getAst. ' + R.p511 },
        'BaseModelManager.getDecoratorValidation': { c: 'TS', r: R.fieldRead },
        'BaseModelManager.getModelFile': { c: 'TS', r: R.lazyAccessor + ' (a map read)' },
        'BaseModelManager.getAssetDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getTransactionDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getEventDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getParticipantDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getMapDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getEnumDeclarations': { c: 'TS', r: R.fwd },
        'BaseModelManager.getConceptDeclarations': { c: 'TS', r: R.fwd },
    },
    'src/decoratormanager.ts': {
        'assignDeep': { c: 'TS', r: 'merges the result of the RUST decoratorManagerMigrateTo into the caller\'s object in place, to preserve JS object identity (a JS-only concern). ' + R.p511 },
        'DecoratorManager.canMigrate': { c: 'TS', r: 'JS-side helper: a semver comparison of the command set\'s namespace version. ' + R.p511 },
    },
    'src/decoratormodelhelper.ts': {
        'getDecoratorModel': { c: 'TS', r: R.fixedData },
    },
    'src/engine/serializer.ts': {
        'asUnsupported': { c: 'TS', r: R.shimP511 + ' (maps a codec wire error to EngineFastPathUnsupported)' },
    },
    'src/engine/views.ts': {
        'numberValidatorModule': { c: 'TS', r: R.shimP511 + ' (requires introspect/numbervalidator once)' },
        'stringValidatorModule': { c: 'TS', r: R.shimP511 + ' (requires introspect/stringvalidator once)' },
        'collectionSizeValidatorModule': { c: 'TS', r: R.shimP511 + ' (requires introspect/collectionsizevalidator once)' },
        'fieldModule': { c: 'TS', r: R.shimP511 + ' (requires introspect/field once)' },
        'endModelFile': { c: 'TS', r: R.shimP511 + ' (restores the previous snapshot batch)' },
        'declarationEntry': { c: 'TS', r: R.shimP511 + ' (finds the precomputed Rust snapshot entry of a declaration view)' },
        'sameType': { c: 'TS', r: R.shimP511 + ' (compares a view\'s AST super type with the one its snapshot entry was computed with)' },
        'restoreUndefinedDecorators': { c: 'TS', r: R.shimP511 + ' (restores `decorators: undefined` on the Rust extract result so the JS object shape matches the input)' },
    },
    'src/introspect/assetdeclaration.ts': {
        'AssetDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/classdeclaration.ts': {
        'ClassDeclaration.getOwnProperty': { c: 'TS', r: R.lazyAccessor + ' (a loop over the cached property views)' },
        'ClassDeclaration.addTimestampField': { c: 'TS', r: R.fixedData },
        'ClassDeclaration.addIdentifierField': { c: 'TS', r: R.fixedData },
        'ClassDeclaration.isAbstract': { c: 'TS', r: R.fieldRead },
        'ClassDeclaration.isIdentified': { c: 'TS', r: R.fwd },
        'ClassDeclaration.isSystemIdentified': { c: 'TS', r: R.fwd },
        'ClassDeclaration.isExplicitlyIdentified': { c: 'TS', r: R.fieldRead },
        'ClassDeclaration.getOwnProperties': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/collectionsizevalidator.ts': {
        'CollectionSizeValidator.getMinSize': { c: 'TS', r: R.fieldRead },
        'CollectionSizeValidator.getMaxSize': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/conceptdeclaration.ts': {
        'ConceptDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/declaration.ts': {
        'Declaration.getModelFile': { c: 'TS', r: R.fieldRead },
        'Declaration.getName': { c: 'TS', r: R.fieldRead },
        'Declaration.getNamespace': { c: 'TS', r: R.fwd },
        'Declaration.getFullyQualifiedName': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/decorator.ts': {
        'Decorator.getParent': { c: 'TS', r: R.fieldRead },
        'Decorator.getName': { c: 'TS', r: R.fieldRead },
        'Decorator.getArguments': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/enumdeclaration.ts': {
        'EnumDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/enumvaluedeclaration.ts': {
        'EnumValueDeclaration.constructor': { c: 'TS', r: R.superCtor },
        'EnumValueDeclaration.validate': { c: 'TS', r: R.fwd + ' (super.validate)' },
    },
    'src/introspect/eventdeclaration.ts': {
        'EventDeclaration.constructor': { c: 'TS', r: R.superCtor },
        'EventDeclaration.process': { c: 'TS', r: R.fwd + ' (super.process; the override is in the BC-37 api-snapshot)' },
    },
    'src/introspect/field.ts': {
        'Field.isTypeScalar': { c: 'TS', r: R.fwd + ' (resolves the type through ModelFile.resolveType/getType, then the RUST fieldGetScalarField)' },
        'Field.getValidator': { c: 'TS', r: R.fieldRead },
        'Field.getDefaultValue': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/identifieddeclaration.ts': {
        'IdentifiedDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/introspector.ts': {
        'Introspector.constructor': { c: 'TS', r: R.superCtor },
        'Introspector.getClassDeclarations': { c: 'TS', r: R.lazyAccessor + ' (a filter over the model-file views)' },
        'Introspector.getClassDeclaration': { c: 'TS', r: R.fwd + ' (ModelManager.getType)' },
        'Introspector.getModelManager': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/mapdeclaration.ts': {
        'MapDeclaration.validate': { c: 'TS', r: R.fwd + ' (super.validate and the key/value validate, which run in Rust)' },
        'MapDeclaration.getKey': { c: 'TS', r: R.fieldRead },
        'MapDeclaration.getValue': { c: 'TS', r: R.fieldRead },
        'MapDeclaration.toString': { c: 'TS', r: R.fwd },
    },
    'src/introspect/mapkeytype.ts': {
        'MapKeyType.constructor': { c: 'TS', r: R.superCtor },
        'MapKeyType.getModelFile': { c: 'TS', r: R.fwd },
        'MapKeyType.getParent': { c: 'TS', r: R.fieldRead },
        'MapKeyType.getType': { c: 'TS', r: R.fieldRead },
        'MapKeyType.toString': { c: 'TS', r: R.fwd },
        'MapKeyType.getNamespace': { c: 'TS', r: R.fwd },
    },
    'src/introspect/mapvaluetype.ts': {
        'MapValueType.constructor': { c: 'TS', r: R.superCtor },
        'MapValueType.getModelFile': { c: 'TS', r: R.fwd },
        'MapValueType.getParent': { c: 'TS', r: R.fieldRead },
        'MapValueType.getType': { c: 'TS', r: R.fieldRead },
        'MapValueType.toString': { c: 'TS', r: R.fwd },
        'MapValueType.getNamespace': { c: 'TS', r: R.fwd },
    },
    'src/introspect/metamodel.ts': {
        'newMetaModelManager': { c: 'TS', r: R.fixedData },
        'modelManagerFromMetaModel': { c: 'TS', r: R.fwd + ' (orchestration over RUST members)' },
    },
    'src/introspect/modelfile.ts': {
        'ModelFile.resolveImport': { c: 'TS', r: R.lazyAccessor + ' (a lookup in the import map of the header; 148 ns in TS against 1.4 us for a string crossing, on the getType hot path)' },
        'ModelFile.getImportURI': { c: 'TS', r: R.lazyAccessor + ' (a map read of the header)' },
        'ModelFile.getAssetDeclaration': { c: 'TS', r: R.lazyAccessor + ' (getLocalType plus a kind check)' },
        'ModelFile.getTransactionDeclaration': { c: 'TS', r: R.lazyAccessor + ' (getLocalType plus a kind check)' },
        'ModelFile.getEventDeclaration': { c: 'TS', r: R.lazyAccessor + ' (getLocalType plus a kind check)' },
        'ModelFile.getParticipantDeclaration': { c: 'TS', r: R.lazyAccessor + ' (getLocalType plus a kind check)' },
        'ModelFile.isExternal': { c: 'TS', r: R.fieldRead },
        'ModelFile.getModelManager': { c: 'TS', r: R.fieldRead },
        'ModelFile.isImportedType': { c: 'TS', r: R.lazyAccessor + ' (a set lookup)' },
        'ModelFile.getImportedType': { c: 'TS', r: R.fwd + ' (resolveImport)' },
        'ModelFile.isDefined': { c: 'TS', r: R.fwd + ' (ModelUtil.isPrimitiveType, getLocalType)' },
        'ModelFile.getNamespace': { c: 'TS', r: R.fieldRead },
        'ModelFile.getName': { c: 'TS', r: R.fieldRead },
        'ModelFile.getAssetDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getTransactionDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getEventDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getParticipantDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getClassDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getConceptDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getEnumDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getMapDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getScalarDeclarations': { c: 'TS', r: R.fwd + ' (getDeclarations)' },
        'ModelFile.getAllDeclarations': { c: 'TS', r: R.fieldRead },
        'ModelFile.getDefinitions': { c: 'TS', r: R.fieldRead },
        'ModelFile.getAst': { c: 'TS', r: R.fieldRead },
        'ModelFile.getConcertoVersion': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/numbervalidator.ts': {
        'NumberValidator.getLowerBound': { c: 'TS', r: R.fieldRead },
        'NumberValidator.getUpperBound': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/participantdeclaration.ts': {
        'ParticipantDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/property.ts': {
        'Property.getFullyQualifiedTypeName': { c: 'TS', r: R.fwd + ' (ModelFile.getFullyQualifiedTypeName, after null checks for detached or stubbed views)' },
        'Property.isTypeEnum': { c: 'TS', r: R.fwd + ' (ModelFile.getType)' },
        'Property.getModelFile': { c: 'TS', r: R.fwd },
        'Property.getParent': { c: 'TS', r: R.fieldRead },
        'Property.getName': { c: 'TS', r: R.fieldRead },
        'Property.getType': { c: 'TS', r: R.fieldRead },
        'Property.isOptional': { c: 'TS', r: R.fieldRead },
        'Property.getFullyQualifiedName': { c: 'TS', r: R.fwd },
        'Property.getNamespace': { c: 'TS', r: R.fwd },
        'Property.isArray': { c: 'TS', r: R.fieldRead },
        'Property.getSizeValidator': { c: 'TS', r: R.fieldRead },
        'Property.isPrimitive': { c: 'TS', r: R.fwd + ' (ModelUtil.isPrimitiveType)' },
    },
    'src/introspect/relationshipdeclaration.ts': {
        'RelationshipDeclaration.constructor': { c: 'TS', r: R.superCtor },
        'RelationshipDeclaration.toString': { c: 'TS', r: R.fwd },
    },
    'src/introspect/scalardeclaration.ts': {
        'ScalarDeclaration.getType': { c: 'TS', r: R.fieldRead },
        'ScalarDeclaration.getValidator': { c: 'TS', r: R.fieldRead },
        'ScalarDeclaration.getDefaultValue': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/stringvalidator.ts': {
        'customRegExp': { c: 'TS', r: 'JS-side helper: looks up the user\'s options.regExp on the model manager. ' + R.p511 },
        'StringValidator.getMinLength': { c: 'TS', r: R.fieldRead },
        'StringValidator.getMaxLength': { c: 'TS', r: R.fieldRead },
    },
    'src/introspect/transactiondeclaration.ts': {
        'TransactionDeclaration.constructor': { c: 'TS', r: R.superCtor },
    },
    'src/introspect/validator.ts': {
        'Validator.constructor': { c: 'TS', r: R.superCtor },
        'Validator.getFieldOrScalarDeclaration': { c: 'TS', r: R.fieldRead },
    },
    'src/rootmodelhelper.ts': {
        'getRootModel': { c: 'TS', r: R.fixedData },
    },
    'src/serializer/jsongenerator.ts': Object.fromEntries([
        'JSONGenerator.visitMapDeclaration', 'JSONGenerator.visitClassDeclaration', 'JSONGenerator.visitField',
        'JSONGenerator.visitRelationshipDeclaration', 'JSONGenerator.getRelationshipText',
    ].map(k => [k, { c: 'TS', r: R.visitorFallback }])),
    'src/serializer/jsonpopulator.ts': Object.fromEntries([
        'JSONPopulator.visitClassDeclaration', 'JSONPopulator.visitMapDeclaration', 'JSONPopulator.processMapType',
        'JSONPopulator.visitField', 'JSONPopulator.convertItem', 'JSONPopulator.visitRelationshipDeclaration',
    ].map(k => [k, { c: 'TS', r: R.visitorFallback }])),
    'src/serializer/resourcevalidator.ts': Object.fromEntries([
        'ResourceValidator.visitEnumDeclaration', 'ResourceValidator.checkMapType', 'ResourceValidator.visitMapDeclaration',
        'ResourceValidator.visitClassDeclaration', 'ResourceValidator.visitField', 'ResourceValidator.checkEnum',
        'ResourceValidator.checkArray', 'ResourceValidator.visitRelationshipDeclaration', 'ResourceValidator.checkRelationship',
        'ResourceValidator.reportFieldTypeViolation', 'ResourceValidator.reportNotResouceViolation',
        'ResourceValidator.reportNotRelationshipViolation', 'ResourceValidator.reportMissingRequiredProperty',
        'ResourceValidator.reportEmptyIdentifier', 'ResourceValidator.reportInvalidEnumValue',
        'ResourceValidator.reportAbstractClass', 'ResourceValidator.reportUndeclaredField',
        'ResourceValidator.reportInvalidFieldAssignment',
    ].map(k => [k, { c: 'TS', r: R.rvShell }])),
};
P5_11['src/introspect/modelfile.ts']['ModelFile._declarationView'] = {
    c: 'TS', r: 'JS view-class factory (`new AssetDeclaration(...)` by AST $class); Rust staging has already rejected an unknown $class, and the injected default super type mirrors Rust implicit_super_type for 4 fixed cases. ' + R.p511,
};
for (const [file, members] of Object.entries(P5_11)) {
    const fr = module.exports[file];
    if (!fr) { throw new Error('P5-11 rule for unknown file ' + file); }
    fr.m = fr.m || {};
    for (const [k, ov] of Object.entries(members)) {
        const prev = fr.m[k];
        if (prev && prev.c && ov.c) { throw new Error('P5-11 rule overrides an existing classification: ' + file + ' ' + k); }
        fr.m[k] = Object.assign({}, prev, ov);
    }
}
