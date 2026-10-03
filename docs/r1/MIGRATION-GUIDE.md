# Migrating to Concerto R1 (draft)

R1 is the next major release of Concerto, planned as **6.0.0**. It moves
`@accordproject/concerto-core` onto the Concerto Rust engine and ships a set of
stricter rules in the same major, so that you only have to upgrade once. The
[R1 changelog](./CHANGELOG.md) lists every change. This guide gives the reason
for each breaking change, who it affects and how to upgrade.

**Status: draft for maintainer review.** Written at concerto `574faa716` and
concerto-rust `bfa4a55` (2026-10-02). The `BC-nn` IDs refer to rows in
`migration/BREAKING-CHANGES-PLAN.md`.

## Am I affected?

Most users who load models from CTO files and exchange strictly formatted
JSON need only the Node.js upgrade. Check the following:

1. **Node.js version.** Run `node --version`. You need 20.19 or later on the 20.x
   line, or 22.12 or later.
2. **Browser use without a bundler.** See [Packaging](#packaging).
3. **Dates.** Do your instances, default values or `DateTimeUtil.setCurrentTime`
   calls use anything other than `YYYY-MM-DDTHH:mm:ss[.SSS]` followed by `Z` or
   `±HH:mm`?
4. **Hand-built or tool-built ASTs.** Do you load JSON ASTs that the CTO parser
   did not write?
5. **Search your code** for the options and APIs that changed:

```bash
grep -rnE "strictQualifiedDateTimes|regExp *:|metamodelValidation|setCurrentTime" .
grep -rnE "\.modelFiles\b|DecoratorExtractor|processType|isValidIdentifier" .
grep -rnE "name *=== *['\"]BaseException['\"]|instanceof +TypeError" .
grep -rnE "@accordproject/concerto-core/(dist|src)/" .
grep -rnE "length *= *\[ *, *\]" --include=*.cto .
```

---

## Packaging

### Node.js 20.19+ or 22.12+ (BC-31)

- **Why:** the engine is loaded synchronously, and the Node ESM build loads it
  with `require()` of an `.mjs` file. Node.js does that without a flag only from
  20.19 and 22.12.
- **Who:** anyone on Node.js 18, or on 20.x or 22.x releases before those
  versions. This applies to every package in this repository.
- **What to do:** upgrade Node.js. The `engines.node` field of every package is
  `^20.19.0 || >=22.12.0`.

### Browsers (BC-32)

- **Why:** a browser cannot load an ES module synchronously, and the engine is
  loaded synchronously. So the browser ESM build
  (`dist/esm-browser/index.mjs`) does not load the engine by itself.
- **Who:** anyone using `@accordproject/concerto-core` in a browser.
- **What to do:** use a bundler, which resolves the engine modules at build
  time. Without a bundler, the page must supply a synchronous `require` on
  `globalThis.module` before concerto-core is first imported. That `require`
  must resolve `./engine`, `../engine`, `./engine/<subpath>` and
  `../engine/<subpath>` (for example `./engine/views` and `../engine/views`)
  to the matching `dist/esm-browser/engine/*.mjs` modules, and resolve the
  engine's own imports to the same module instances the public graph uses.
  `e2e/tests/wasm-engine.spec.ts` shows the pattern. Allow for about
  2.93-3.05 MB of WebAssembly before compression (P5-72 and P5-76 in
  `migration/bench/RESULTS.md`).
- **Pending:** an asynchronous `await init()` entry for browsers and smaller
  engine builds are proposed in P5-39 (accordproject/concerto-rust#349). They
  wait on a maintainer decision and are **not in R1** as this guide is written.
  The browser story also waits on the Concertino spike, P5-78
  (accordproject/concerto-rust#420).

### Deep imports (BC-34)

- **Why:** R1 removes the `./dist/*` entry from the `exports` map of
  `@accordproject/concerto-core`. 5.0.0 exported `./dist/*`, so deep imports
  resolved. In R1 the package exports only its root (`.`, with the `types`,
  `browser`, `import` and `require` conditions) and `./package.json`. The
  modules behind the root exports, such as the serializer visitors
  (`JSONPopulator`, `JSONGenerator`, `ResourceValidator`, with their `visitX`
  methods and `parameters.path` argument), are internal.
- **Who:** code that imports or requires a path under
  `@accordproject/concerto-core/dist/`. For example,
  `require('@accordproject/concerto-core/dist/serializer/jsonpopulator')` now
  fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` in Node.js, and bundlers report
  that the path is not exported. TypeScript type imports from
  `.../dist/...` fail in the same way under `moduleResolution` `node16`,
  `nodenext` or `bundler`. Only concerto-core changes: the other packages keep
  their `./dist/*` export in R1.
- **What to do:** import from the package root.

  | 5.0.0 deep import (under `@accordproject/concerto-core/dist/`) | R1 |
  |---|---|
  | A module whose class is a root export: `modelmanager`, `factory`, `serializer`, `modelloader`, `modelutil`, `datetimeutil`, `decoratormanager`, `globalize`, `introspect/*` (for example `introspect/classdeclaration`, `introspect/modelfile`, `introspect/metamodel`), `model/*` (`resource`, `relationship`, `typed`, `identifiable`), and the exceptions `securityexception`, `typenotfoundexception`, `metamodelexception` and `introspect/illegalmodelexception` | The same class as a named root export, for example `const { ClassDeclaration } = require('@accordproject/concerto-core')` or `import { ClassDeclaration } from '@accordproject/concerto-core'`. |
  | `serializer/jsonpopulator`, `serializer/jsongenerator` | `Serializer`: `serializer.fromJSON(json, options)` and `serializer.toJSON(resource, options)`. |
  | `serializer/resourcevalidator` | `resource.validate()` on a resource from `Factory`, or the `validate` option of `Serializer.toJSON` and `fromJSON` (on by default). |
  | `serializer/validationexception` | Check `err.name === 'ValidationException'`, or catch `BaseException` from `@accordproject/concerto-util`. |
  | `basemodelmanager` | `ModelManager`, which extends `BaseModelManager`. |
  | `types` (TypeScript only: `ModelManagerOptions`, `SerializerOptions` and the other option types) | Derive the type from a root export, for example `ConstructorParameters<typeof ModelManager>[0]` or `ConstructorParameters<typeof Serializer>[2]`. |

  The visitor methods (`visitX`) and the `parameters.path` argument have no
  public replacement.

---

## Dates

All `DateTime` strings now follow one rule: the `strictQualifiedDateTimes`
format, `YYYY-MM-DDTHH:mm:ss`, an optional fraction of a second, then `Z` or
`±HH:mm`, naming a real instant. For example, `2022-11-28T01:02:03.987Z` or
`2022-11-28T01:02:03+05:30`.

- **Why:** 5.x parsed non-strict dates with dayjs, and fell back to the
  JavaScript engine's own `Date` parser. What was accepted depended on the
  runtime, and some impossible dates were silently moved to another day. R1
  parses dates with the `chrono` crate behind the strict pattern, so every
  path and every runtime agrees.
- **What to do in general:** convert stored and incoming dates to full ISO 8601
  date-times with an offset before you pass them to Concerto. For example,
  `2022-11-28` becomes `2022-11-28T00:00:00Z`.

### Strict `DateTime` fields (BC-07)

- **Who:** callers of `Serializer.fromJSON` (and `JSONPopulator`) whose data
  holds date-only strings (`2022-11-28`), date-times with no offset
  (`2022-11-28T01:02:03`), a lower-case `t` or `z`, a space separator, or
  other forms such as `Nov 28 2022`. This includes callers that set
  `strictQualifiedDateTimes: false`, which was also the default.
- **What changes:** these values throw a `ValidationException`, the class strict
  mode already used. `strictQualifiedDateTimes: false` is ignored, and a
  warning (`concerto-strict-datetime`) is printed once per process.
  `strictQualifiedDateTimes: true` still stops `utcOffset` from being applied.
- **What to do:** fix the data. Remove `strictQualifiedDateTimes: false`
  to silence the warning.

### Impossible instants (BC-42)

- **Who:** data with dates such as `2024-02-30T00:00:00Z`,
  `2023-02-29T00:00:00Z`, `2024-04-31T00:00:00Z` or `…T24:00:00Z`. 5.x strict
  mode rolled them over to the next valid instant.
- **What changes:** they are rejected with a `ValidationException`. A leap second
  (`:60`) is rejected, as before.
- **What to do:** fix the data at the source. Rolling the date over yourself
  hides the error.

### `DateTime` map values (BC-43)

- **Who:** models with a `map` whose value type is `DateTime`, fed with numbers
  or lenient date strings.
- **What changes:** map values follow the field rule. Anything else throws the
  same `Error` a wrong map value type throws (`Model violation in … Expected
  Type of DateTime …`). An absent value still passes.
- **What to do:** send strict date-time strings.

### `DateTime` default values (BC-45)

- **Who:** models with a `DateTime` property or `DateTime` scalar whose `default`
  is not strict, such as `default="2022-11-18"` or
  `default="2008-09-15T15:53:00"`.
- **What changes:** the model still loads. The default is checked when it is
  applied: `Serializer.fromJSON` throws a `ValidationException` when the input
  omits the field, so that the default would be used. The JavaScript
  `Factory.newResource` still assigns the default as 5.x did.
- **What to do:** write the default in strict form, for example
  `default="2022-11-18T00:00:00Z"`.

### `DateTimeUtil.setCurrentTime` (BC-51)

- **Who:** callers that pass a lenient time (`2020-01-01`, `Nov 28 2022`, a
  `Date` or a number) to fix "now", usually in tests or replays.
- **What changes:** `currentTime` must be a strict `DateTime` string naming a
  real instant. Anything else throws the `Error` that an unparseable time
  already threw (`Current time '…' is not in standard UTC format`). Omitting
  `currentTime` still means now. `utcOffset` is unchanged.
- **What to do:** pass an ISO string, for example
  `DateTimeUtil.setCurrentTime('2020-01-01T00:00:00Z')`, or
  `date.toISOString()` for a `Date`.

---

## Namespaces

### Strict SemVer versions (BC-41)

- **Why:** the CTO grammar already requires strict SemVer 2.0.0. The other
  paths used node-semver's lenient parser, so the same model could load from a
  JSON AST and fail from CTO.
- **Who:** anyone who writes namespace or import versions in a JSON AST,
  `ModelUtil.parseNamespace`, a `$class` or a decorator command set with a leading
  `v` (`org.acme@v1.0.0`) or surrounding whitespace.
- **What changes:** such versions are rejected with the error an invalid version
  already threw. Version numbers may now go up to 2^64−1. A version beyond
  node-semver's limits (a number above 2^53−1, or more than 256 characters)
  is accepted, but `parseNamespace` returns `versionParsed: null` for it.
- **What to do:** write versions as `1.0.0`.

### Versioned namespaces (BC-02)

- **Why:** Concerto v4 made namespace versions mandatory in model files and
  imports. Some APIs still accepted an unversioned namespace.
- **Who:**
  - callers of `ModelUtil.parseNamespace` or
    `ModelUtil.removeNamespaceVersionFromFullyQualifiedName` with an unversioned
    namespace (`org.acme`, `org.acme.Person`). This applies even with
    `disableVersionParsing`.
  - `DecoratorManager.canMigrate` and the decorator command set YAML converter
    and extractor, given an unversioned `$class`.
  - **Decorator command sets** whose `target.namespace` has no version (`test`).
    In 5.x such a target matched every version of that namespace.
- **What changes:** each of these throws the plain `Error` that an invalid
  namespace throws (`Invalid namespace org.acme`). For command sets, both
  `validateCommands` and `DecoratorManager.decorateModels` throw, whether or
  not validation is on. A model file with the bare `concerto` namespace is
  rejected too. Model files and imports already needed a version and keep
  their errors.
- **What to do:** add the version (`org.acme@1.0.0`, `test@1.0.0`). If a
  command set must target several versions of a namespace, write one command
  per version.

---

## Relationships

### Relationship-typed map values (BC-05)

- **Why:** in 5.x, a map whose value is a relationship (`map Owners { o String
  --> Person }`) required an embedded object, and rejected the relationship
  reference the model declares. R1 treats the map value like a relationship
  property (`--> Person owner`).
- **Who:** code that stores or validates embedded objects in such maps.
- **What changes:** by default, `Serializer.fromJSON` reads a relationship URI
  (or a bare identifier of the declared type) as a `Relationship`, `toJSON`
  writes it back as its URI, and validation expects a `Relationship`. An
  embedded object is accepted only where a relationship property accepts one.
- **What to do:** send relationship references, or keep embedded objects by
  setting the existing options:
  - `acceptResourcesForRelationships: true` on `fromJSON`;
  - `permitResourcesForRelationships: true` on `toJSON` and validation;
  - `convertResourcesToRelationships: true` on `toJSON`, to write embedded
    values as references.

---

## Instances

### Non-finite `Integer` and `Long` values (BC-10)

- **Why:** the populator let `Infinity` and `-Infinity` through for `Integer`
  and `Long` fields, and only validation rejected them.
- **Who:** callers of `Serializer.fromJSON` with `validate: false` whose data
  holds non-finite integers. JSON text cannot express them, so only
  JavaScript objects built in code can.
- **What changes:** `fromJSON` throws the `ValidationException` it throws for
  any other invalid number (`Expected value at path … to be of type Integer`).
  `Double` fields are unchanged.
- **What to do:** drop or replace non-finite integer values before
  deserialising.

### New: `validateInstance` and `validateInstanceOrThrow` (BC-26, concerto#1239)

This is an addition, not a breaking change: nothing needs to change, and
`Serializer.fromJSON` and `Resource.validate()` work as before. The new
methods replace the usual boilerplate for checking JSON against a model.

Before:

```js
if (data.$class !== templateModel.getFullyQualifiedName()) {
    throw new Error(`Invalid data, must be a valid instance of ${templateModel.getFullyQualifiedName()} but got: ${JSON.stringify(data)}`);
}
const resource = this.getTemplate().getSerializer().fromJSON(data);
resource.validate();
this.concertoData = resource;
```

After:

```js
this.concertoData = templateModel.validateInstanceOrThrow(data);
```

Or, to report every problem instead of throwing the first:

```js
const result = templateModel.validateInstance(data);
if (!result.valid) return { errors: result.errors };
this.concertoData = result.resource;
```

- `templateModel` is a `ClassDeclaration` (`modelManager.getType(fqn)`): the
  instance's `$class` must be that type or a subtype of it (an instance with
  no `$class` is read as that type). `modelManager.validateInstance(data)`
  uses the instance's own `$class` instead.
- Each entry of `errors` is
  `{ code, path, expected?, severity, message }`, for example
  `{ code: 'MISSING_REQUIRED_PROPERTY', path: '/parties/0/email', expected: 'String', severity: 'error', message: '…' }`.
  The first entry is the error `validateInstanceOrThrow` throws, which is
  also what `fromJSON` throws for the same data and options.
- `code`, `path`, `expected` and `severity` never contain values from the
  instance (concerto#1325). `message` can; pass `redactMessages: true` to
  build it from the other fields. `includeActual: true` adds the offending
  value as `actual`.
- `result.resource` is built on first read. Pass `hydrate: false` to only
  validate.
- The exceptions `fromJSON` and `validateInstanceOrThrow` throw now carry
  the same diagnostics as `err.details`.
- `rejectUnknownKeys: true` rejects keys the type does not declare, even
  with a `null` value, and `rejectRequiredNull: true` rejects `null` for a
  required property (concerto#1273). Both are off by default, as before;
  `Serializer.fromJSON` accepts them too.

---

## Model loading from an AST

### Strict AST shape (BC-19, with BC-17, BC-18 and BC-20)

- **Why:** 5.x walked a model AST without checking its shape. Many malformed ASTs
  loaded silently, and others crashed with a `TypeError`. For example, a
  `decorators` string was read one character at a time, and numeric names were
  coerced to strings. R1 checks every AST you supply against the Concerto
  metamodel before it is used. ASTs of trusted origin skip the check: the
  result ASTs the engine writes for `DecoratorManager.decorateModels` from
  models that all passed it (P5-68), and the two fixed system models, which
  take a verdict the engine computed once for their exact text (P5-73).
- **Who:** anyone who builds model ASTs by hand or with their own tools and
  loads them with `fromAst`, `addModel`, `addCTOModel`, `addModelFiles`,
  `updateModelFile`, `new ModelFile` or `addModelFile`. ASTs written by the CTO
  parser are unaffected.
- **What changes:**
  - An AST that does not have the metamodel's shape is an
    `IllegalModelException` when its `ModelFile` is built. Examples:
    wrong-typed validator bounds, an `identified` or validator that is not a
    node with a `$class`, unknown properties or `$class` values, a `decorators`
    value that is not an array, a non-string name, or an empty super type name.
  - With `metamodelValidation: true`, a malformed AST is now an
    `IllegalModelException` from the `ModelFile` constructor, ahead of the
    `MetamodelException` that `addModelFile`'s `validateAst` threw.
- **What to do:** fix the tool that writes the AST. `ModelManager.validateAst`
  tells you what is wrong.
- **Escape hatch:** `new ModelManager({ metamodelValidation: false })` skips the
  check. It is an escape hatch for **trusted input only**, and code downstream
  of the load may assume a well-formed AST. A malformed AST still throws an
  error when it is loaded, never a WebAssembly trap or a process crash, unless
  the loader can read it all the same (a node's `$class` naming the wrong type,
  say). The error's class and message are unspecified.

---

## Regular expressions

### The `regExp` option is ignored (BC-28)

- **Why:** every `regex=` validator is now compiled and evaluated by the engine,
  which cannot call a custom JavaScript regular expression engine.
- **Who:** users who pass `new ModelManager({ regExp: XRegExp })` or another
  custom engine, and models that rely on that engine's syntax.
- **What changes:** the option is ignored, and a warning
  (`concerto-regexp-option`) is printed once per process. Patterns use
  ECMAScript syntax and semantics. `StringValidator.getRegex()` still returns
  a native `RegExp` built from the validated pattern and flags.
- **What to do:** remove the option, and rewrite any pattern that needs
  the custom engine in ECMAScript form. For example, XRegExp's `\p{S}` without
  the `u` flag becomes `/\p{S}/u`.

---

## Validators

### Validator exception classes (BC-39)

- **Why:** 5.x threw a plain `BaseException` for validator errors, unlike every
  other model or instance rule. R1 treats it as a bug.
- **Who:** code that checks `error.name === 'BaseException'` or
  `error.constructor === BaseException` for validator errors. Code that uses
  `instanceof BaseException` or switches on `errorType` is unaffected.
- **What changes:** a validator error found while a model loads (no bound,
  negative or swapped bounds, an invalid regex, a default value outside its
  validator) is an `IllegalModelException`. An instance value that fails a
  validator (length, regex, range, size) is a `ValidationException`. Both are
  `BaseException` subclasses and keep their `errorType`
  (`DefaultValidatorException`, `RegexValidatorException`).
- **What to do:** use `instanceof`, or check `errorType`.

### Empty length validators (BC-40)

- **Why:** a number `range=[,]` was already rejected, but a string `length=[,]`
  slipped through.
- **Who:** models with `length=[,]`, or an AST `lengthValidator` with neither
  `minLength` nor `maxLength`. The validator had no effect.
- **What changes:** the model is rejected with an `IllegalModelException`
  (`errorType` `DefaultValidatorException`).
- **What to do:** delete the empty validator, or give it a bound.

---

## Model files and model managers

These changes remove support for test stubs and wrappers that the engine
cannot see into. No production use was found for any of them.

### Only constructor-built `ModelFile`s (BC-46)

- **Who:** code that passes a duck-typed object,
  `Object.create(ModelFile.prototype)` or a sinon stub to `addModelFile`,
  `addModelFiles` or `updateModelFile`.
- **What changes:** these methods throw a `TypeError` (`<method> expects a
  ModelFile built by the ModelFile constructor`). 5.x already threw a
  `TypeError` for most such values.
- **What to do:** build real model files with `new ModelFile(modelManager,
  ast)`, or use `addCTOModel`/`addModel`.

### A `ModelFile` needs a `BaseModelManager` (BC-47)

- **Who:** code that passes a wrapper, a `Proxy` or a stub as the manager to
  `new ModelFile(manager, ast)`.
- **What changes:** the constructor throws a `TypeError` (`ModelFile expects a
  BaseModelManager built by its constructor`) unless the manager is a
  `ModelManager`, an `AstModelManager` or a subclass whose constructor ran.
- **What to do:** pass the real manager, or build model files through the
  `ModelManager` methods.

### `modelFiles` is internal (BC-48)

- **Who:** code that reads or changes `modelManager.modelFiles` directly.
- **What changes:** the field is `@internal`, so it is no longer in the type
  declarations. It is read-only: a direct change is no longer detected.
- **What to do:** read models with `getModelFile`, `getModelFiles` or
  `getNamespaces`, and change them only through the `ModelManager` methods.

### No monkeypatched `ClassDeclaration` methods (BC-50)

- **Who:** code (usually tests) that replaces `getSuperType`,
  `getSuperTypeDeclaration`, `getModelFile`, `getFullyQualifiedName` or
  `getIdentifierFieldName` on a declaration or on `ClassDeclaration.prototype`.
- **What changes:** `getIdentifierFieldName()`, and so `isIdentified()`,
  `isSystemIdentified()` and instance identifiers, no longer call replaced
  methods while walking the super types.
- **What to do:** change the model instead of patching its declarations.

### Model answers from the engine (BC-52)

- **Who:** code (usually tests) that replaces `getType`, `getSuperType` or
  `getModelFiles` (on a model file, a declaration, a manager or a prototype),
  or passes stand-in objects to `ModelUtil`, and code that calls these
  members for a `ModelFile` that is not added to its `ModelManager`.
- **What changes:** `ModelUtil.isAssignableTo`, `isEnum`, `isMap`, `isScalar`
  and `isValidMapKeyScalar`, `ScalarDeclaration.validate()`, decorator
  validation and `ClassDeclaration.getAssignableClassDeclarations()` and
  `getDirectSubclasses()` answer from the engine's copy of the model and no
  longer call replaced methods. For a `ModelFile` that is not registered in
  its manager, `isEnum`, `isMap` and `isScalar` return `undefined` and
  `isAssignableTo` cannot find the type, and the other members throw a
  `TypeError`.
- **What to do:** add model files to their `ModelManager` before asking these
  questions, and change the model instead of patching it.

---

## Lazy views and internals

### Lazy model views (BC-23)

- **Why:** building every declaration, property, decorator and validator
  object when a model loads was the main load cost on the engine. R1 builds
  them the first time they are read, which makes loading 2.2-2.9× faster
  than eager building (P5-10c).
- **Who:** code that changes a model's AST after its `ModelFile` is built, or
  copies view objects by enumerating their own properties.
- **What changes:**
  - Object identity is unchanged: the getters return the same object on
    every call. Model errors are still thrown when the model loads (BC-25).
  - A model file's AST is read-only once the `ModelFile` is built. Changing it
    afterwards is not supported, and the declarations may or may not reflect
    the change, depending on when they are first read.
  - Some fields (`declarations`, `decorators`, `validator` and similar) are
    accessors until first read. So spread, `Object.assign` and `Object.keys`
    may miss them.
  - `getProperties()`/`getProperty()` answers are cached per declaration.
    `getNamespaces()`, `getType()` and `resolveType()` answers are cached per
    manager. The caches are refreshed when models are added, updated, deleted
    or cleared through the `ModelManager`. Replacing a `Property` object in
    place on a view, or changing the manager's internal model file map, may
    not be seen. `getNamespaces()` returns a new array on every call.
  - Decorator factories still run while the model loads, as in 5.x. A manager
    with a decorator factory builds its files eagerly.
- **What to do:** call the getters (`getDeclarations()`, `getDecorators()`,
  `getValidator()`), and change models only through the `ModelManager`.

---

## Removed APIs (BC-37)

- **Why:** decorator command sets are applied by the engine, so the
  TypeScript implementation was deleted.
- **Who:** code that deep-imports `DecoratorExtractor`, or calls these
  `DecoratorManager` static helpers: `validateCommand`, `executeCommand`,
  `applyDecorator`, `applyDecoratorForMapElement`, `migrateAndValidate`,
  `getDecoratorMaps`, `addDcsWithIndexToMap`, `pushMapValues`,
  `checkForDuplicateDecorators`, `checkForNamespaceTargetAndApplyDecorator`,
  `executeNamespaceCommand`. It also affects callers of
  `MapKeyType.processType` or `MapValueType.processType`.
- **What to do:** use `DecoratorManager.decorateModels`, `validate`,
  `migrateTo`, `extractDecorators`, `extractVocabularies` and
  `extractNonVocabDecorators`, which are unchanged. There is no replacement
  for `processType`.

---

## Changed errors and return values

These inputs already failed in 5.x, or were edge cases. Only the error class
or the return value changes. Update your code if it catches the old class.

| Change | ID |
|---|---|
| A non-string `$class` in an instance throws `Error` (`a $class that is not a string: …`), not `TypeError`. For an array `$class` it throws `Error`, not `TypeNotFoundException`. | BC-13 |
| An AST relationship property with no `type` throws `IllegalModelException` (`Relationship <name> must have a type`), not `TypeError`. | BC-15 |
| A `null` element in an AST `decorators` array throws `IllegalModelException` (`Invalid decorator. Expected object. Found null`), not `TypeError`. | BC-16 |
| Validating a relationship array field that holds a value that is not `Identifiable`, or a relationship or concept array that holds `null` or `undefined`, throws `ValidationException`, not `TypeError`. | BC-06 |
| `fromJSON`/`toJSON` on an element they cannot read or write (an enum value named as a property, a relationship to a scalar) throws `Error` (`Unrecognised element "org.acme@1.0.0.Color.RED"`), not `TypeError: Converting circular structure to JSON`. So does `Factory.newResource` with the `generate` option for a type it cannot generate, such as an enum type. | BC-08 |
| Circular inheritance throws `IllegalModelException` naming the cycle, from validation, loading and every super type walk (`getProperties`, `getProperty`, `getIdentifierFieldName`, `getAllSuperTypeDeclarations`, `getAssignableClassDeclarations`, `derivesFrom`), not `RangeError` or out of memory. | BC-11 |
| A map whose value type is not declared throws `IllegalModelException` naming the type, not `TypeError`. | BC-12 |
| With `decoratorValidation` set to `error`, a decorator validation error names its model file once and no longer embeds `IllegalModelException: ` in its message. The class is unchanged. | BC-14 |
| `ModelUtil.isValidIdentifier` returns `false` for any value that is not a string (`undefined`, `null`, a number). The string `"undefined"` is still valid. | BC-01 |
| `ModelManager.filter` keeps the built-in models (`concerto.decorator@1.0.0`, `concerto@1.0.0`, and the metamodel with `addMetamodel`) whole and no longer calls the predicate on their declarations, so a user model's import of one of their types is always kept. A predicate that keeps a decorator-model declaration, such as `filter(() => true)`, returns the filtered manager instead of throwing `Error` (`Namespace concerto.decorator@1.0.0 … is already declared`), and one that drops them keeps a user type extending `Decorator` instead of throwing `Could not find super type Decorator`. | BC-53 |
| A JavaScript string with a lone UTF-16 surrogate reaches the engine as U+FFFD, because strings cross into WebAssembly as UTF-8. This is accepted, with no fix planned. | BC-03 |

---

## Not in R1

These proposals do not ship in R1. They are listed in the
[changelog](./CHANGELOG.md#not-in-r1): BC-04, BC-09, BC-21, BC-24 (the
factory-timing part), BC-27, BC-33, BC-35, BC-44, BC-49, the P5-39
decisions on browser async `init()` and engine size with their follow-ups
(P5-44 to P5-47), the Concertino spike (P5-78, #420), and the P5-80 and
P5-81 spikes (#424, #425).
