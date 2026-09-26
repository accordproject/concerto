/*
 * Seam ledger classification rules (task P0-03).
 *
 * One entry per source file under packages/concerto-core/src. Each entry has
 * a file-level default {c, t, p, r} and per-member overrides keyed by
 * "Class.member" (or "member" for top-level functions, "Class.get x" for
 * accessors). build-ledger.js joins these rules with the members extracted
 * from the TypeScript AST, so every member gets exactly one row.
 *
 *   c   classification: RUST | HYBRID | TS
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
        },
    },
    'src/datetimeutil.ts': { c: 'TS', t: NONE, p: NONE, r: R.dayjs },
    'src/dcsconverter.ts': { c: 'TS', t: NONE, p: NONE, r: R.yaml },
    'src/decoratorextractor.ts': {
        c: 'RUST', t: DCS, p: 'P4-09',
        m: {
            'DecoratorExtractor.quoteStringValue': { c: 'HYBRID', r: 'quoting decision is defined by the `yaml` npm lib plain-scalar rules (yaml.stringify); Rust must port the rule and golden-test it against yaml.stringify, or call back into JS' },
        },
    },
    'src/decoratormanager.ts': {
        c: 'RUST', t: DCS, p: 'P4-09',
        m: {
            'DecoratorManager.validate': { c: 'HYBRID', r: R.dcsCto },
            'DecoratorManager.migrateAndValidate': { c: 'HYBRID', r: R.dcsCto },
            'DecoratorManager.jsonToYaml': { c: 'HYBRID', r: 'command-set validation runs in Rust; YAML emission stays in TS (dcsconverter, `yaml` npm lib)' },
            'DecoratorManager.yamlToJson': { c: 'HYBRID', r: 'YAML parsing stays in TS (dcsconverter, `yaml` npm lib); command-set validation runs in Rust' },
            'DecoratorManager.validateCommand': { cat: 'validation' },
        },
    },
    'src/decoratormodelhelper.ts': { c: 'RUST', t: ROOT, p: 'P2-08+P4-08' },
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
