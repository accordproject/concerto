# Concerto R1 changelog (draft)

R1 is the next major release of Concerto, planned as **6.0.0**. The version
number is set when the release is cut. This page lists what R1 changes for
users of `@accordproject/concerto-core` and the other packages in this
repository. How to upgrade is covered in the [R1 migration guide](./MIGRATION-GUIDE.md).

**Status: draft for maintainer review.** Written from
`migration/BREAKING-CHANGES-PLAN.md` (the one-major-release update, section 3
R1 and section 4), concerto-rust `DIVERGENCES.md` and the merged task records,
at concerto `574faa716` and concerto-rust `bfa4a55` (2026-10-02). The
`BC-nn` IDs refer to rows in `migration/BREAKING-CHANGES-PLAN.md`.

## What's new

- **One engine, written in Rust.** Model loading, model validation, instance
  population and validation, decorator command sets and metamodel checks run
  in the Concerto Rust engine (`concerto-core` crate), shipped to JavaScript
  as a WebAssembly module. The TypeScript API is the same one 5.x has: same
  classes, same exports, same type declarations, apart from the removals listed
  below, and a few return types, all narrowed when P5-02 regenerated the type
  declarations: `ModelUtil.getShortName` (BC-37),
  `getFullyQualifiedName` (BC-37), `capitalizeFirstLetter` (BC-37) and
  `removeNamespaceVersionFromFullyQualifiedName` (BC-37) return `string` where
  5.x declared `any`, both `yamlToJson` declarations (the decorator command set
  YAML converter's and `DecoratorManager.yamlToJson`) return `$class: string`
  (BC-37), and `ModelUtil.parseNamespace` returns one object type in place of
  5.x's union, with `versionParsed` typed `unknown` (BC-37).
- **Clearer errors.** Several inputs that crashed the JavaScript runtime in 5.x
  (`TypeError`, `RangeError`, out of memory) now throw an error that names the
  problem: `IllegalModelException` (BC-11, BC-12, BC-15, BC-16),
  `ValidationException` (BC-06), or a plain `Error` (BC-08, BC-13).
- **Stricter, more predictable input rules.** One `DateTime` grammar
  everywhere, strict SemVer namespaces, and a metamodel check on every model
  loaded from an AST. These are the main breaking changes; see below.
- **Lazy model views.** Declaration, property, decorator and validator objects
  are built the first time they are read, not when a model file is loaded
  (BC-23).

### Performance

Figures are ratios to `@accordproject/concerto-core` 5.0.0 on the same machine
in the same run, as recorded in `migration/bench/RESULTS.md`.
Below 1× is faster than 5.0.0; above 1× is slower. Timings on a shared machine move by up to about
±25-35% between rounds, so treat small differences as noise.

| Operation, through the JavaScript API | R1 vs 5.0.0 | Source |
|---|---:|---|
| `Serializer.fromJSON` | 0.89-0.92× | P5-22 |
| `ModelManager.validateAst` | 0.33-0.41× (2.4-3.0× faster) | P6-04 |
| `DecoratorManager.validate` | 0.66-0.80× | P5-27 |
| `DecoratorManager.decorateModels` | 0.80-1.45× | P5-27 |
| Repeated `getNamespaces`, `getType`, `resolveType` | 0.11-2.46× | P5-29 |
| First `getNamespaces`, `getType`, `resolveType` call after a model change | `getType` 2.3-2.9×, `resolveType` 2.0-3.3×, `getNamespaces` 9.6-14.0× (2-14 µs once per change) | P5-72 |
| `Factory.newResource` | 2.5-4.1× | P5-22 |
| `DecoratorManager.extractDecorators` / `extractVocabularies` | `extractDecorators` 2.1-3.0×, `extractVocabularies` 3.3-4.0×; the first call after a model change 3.4-3.6× | P5-72 (cloud container, Intel Xeon @ 2.10GHz, 4 vCPU) |
| `new ModelFile` | 4.9-8.1× | P5-48 |
| `ModelManager.addModelFile` | 2.9-7.5× | P5-48 |
| `ModelManager.addCTOModel` (the CTO parser is unchanged JavaScript) | 1.7-4.0× | P5-48 |

- Model loading through the JavaScript API is still slower than 5.0.0. In the
  Rust crate itself, `addModelFile` is at or near 5.0.0's speed (0.81-1.09×,
  P5-48). Most of the remaining cost is crossing into WebAssembly and
  allocating there.
- The strict AST check (BC-19) runs inside the engine's one load of the AST
  (P5-69), so it adds no engine call. With the check on, `new ModelFile` costs
  1.11-1.25× what it costs with `metamodelValidation: false`; on
  `addModelFile` and `addCTOModel` the difference is within noise (P5-72).
- The optimised engine module is about 2.93-3.05 MB: 3,052,059 bytes in P5-72
  (973 KB with gzip, 626 KB with brotli), 3,048,959 bytes after P5-76, and
  2,931,108 bytes in the P5-82 gate build (P5-72 and P5-76 in `RESULTS.md`,
  merged at concerto `d1ab2619a` and later).
- The consolidated R1 re-measure (P5-72, accordproject/concerto-rust#413,
  which repeats P5-60's sweep after BC-19's load-cost fixes): through the
  JavaScript API, 19 of 73 operation and model-set rows are at or below
  5.0.0. The geometric mean against 5.0.0 is 3.68× for model loading, 1.48×
  for introspection including decorator command sets, 1.84× for
  serialisation, 1.68× for instance creation and 2.05× for validation. Called
  directly, the Rust crate is at 0.33×, 0.31×, 0.53×, 0.35× and 0.57× for the
  same categories. P5-72 also measured `new ModelManager()` at 1.26×; P5-73
  then cut its time to 0.62× of the P5-72 head's.

## Breaking changes

Each entry is one line. The [migration guide](./MIGRATION-GUIDE.md) gives the
reason, who is affected and the upgrade step for each one.

### Packaging

- **Node.js 20.19+ (on 20.x) or 22.12+ is required** in every package
  (`engines.node` is `^20.19.0 || >=22.12.0`). Node.js 18 is no longer
  supported. (BC-31)
- **Browsers need a bundler, or a host that supplies a synchronous `require`,
  to load the engine.** The browser ESM build does not load the engine module
  by itself, and the engine adds about 2.93-3.05 MB before compression. The async
  `init()` entry and the size reductions are pending a maintainer decision
  (P5-39) and are not in R1 as written. (BC-32)
- **The `./dist/*` export of `@accordproject/concerto-core` is removed.**
  5.0.0 exported it. In R1, deep imports such as
  `@accordproject/concerto-core/dist/serializer/jsonpopulator` fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. The package exports only its root (`.`) and
  `./package.json`. Use the root exports; the migration guide lists the
  replacements. (BC-34)

### Dates

- **`DateTime` values must be strict ISO 8601 / RFC 3339:**
  `YYYY-MM-DDTHH:mm:ss`, an optional fraction, then `Z` or `±HH:mm`. Date-only
  strings, a missing offset, a lower-case `t` or `z`, a space separator and the
  other forms JavaScript's `Date` accepted are rejected with a
  `ValidationException`. `strictQualifiedDateTimes: false` is ignored, with a
  warning. (BC-07)
- **A `DateTime` must name a real instant.** `2024-02-30T00:00:00Z` and
  `…T24:00:00Z` are rejected instead of rolled over. (BC-42)
- **Map values of type `DateTime` follow the same rule** as `DateTime` fields.
  Numbers and lenient strings are rejected. (BC-43)
- **A `DateTime` default value must be strict.** It is checked when it is applied
  by `Serializer.fromJSON`, not when the model loads. (BC-45)
- **`DateTimeUtil.setCurrentTime` accepts only a strict `DateTime` string.**
  (BC-51)

### Namespaces

- **Namespace and import versions must be strict SemVer 2.0.0** on every path:
  no leading `v`, no surrounding whitespace. (BC-41)
- **Namespaces must be versioned.** `ModelUtil.parseNamespace('org.acme')`
  throws, and so do the APIs that parse a namespace through it. Decorator
  command set targets must be versioned too. (BC-02)

### Relationships

- **A relationship-typed map value behaves like a relationship property.** It
  is a reference by default. An embedded object is accepted only with the
  relationship options. (BC-05)

### Instances

- **`Serializer.fromJSON` rejects `Infinity` and `-Infinity` for `Integer` and
  `Long` fields**, even with `validate: false`. (BC-10)

### Model loading from an AST

- **Every AST you supply is checked against the Concerto metamodel when its
  `ModelFile` is built.** A malformed AST is an `IllegalModelException`. This covers a
  `decorators` value that is not an array, non-string names and empty super
  type names, and nodes that used to crash with a `TypeError`. Turn the check
  off with `metamodelValidation: false`, an escape hatch for trusted input
  only. ASTs of trusted origin skip the check: the result ASTs the engine
  writes for `DecoratorManager.decorateModels` from models that all passed it
  (P5-68), and the two fixed system models, which take a verdict the engine
  computed once for their exact text (P5-73). (BC-19, with BC-17, BC-18 and
  BC-20)

### Regular expressions

- **The `ModelManager` `regExp` option is ignored, with a warning.** Every
  `regex=` validator is evaluated by the engine with ECMAScript syntax and
  semantics. (BC-28)

### Validators

- **Validator errors have new classes.** They are `IllegalModelException` when a
  model loads and `ValidationException` when an instance is validated, not
  `BaseException`. `errorType` is unchanged. (BC-39)
- **`length=[,]` is rejected.** A string length validator needs at least one
  bound. (BC-40)

### Model files and model managers

- **Only a `ModelFile` built by its constructor is accepted** by
  `addModelFile`, `addModelFiles` and `updateModelFile`. (BC-46)
- **`new ModelFile(manager, ast)` requires a real `BaseModelManager`.**
  (BC-47)
- **`ModelManager.modelFiles` is internal and read-only.** It is no longer in
  the type declarations. (BC-48)
- **Replacing `ClassDeclaration` methods at runtime is not supported.** The
  identifier walk no longer calls replaced methods. (BC-50)

### Lazy views and internals

- **Model views are built lazily.** A model file's AST is read-only once the
  `ModelFile` is built. Some view fields are accessors until first read. (BC-23)

### Removed APIs

- **`DecoratorExtractor`, 11 internal `DecoratorManager` static helpers, and
  `MapKeyType.processType` / `MapValueType.processType` are removed.** (BC-37)

### Error changes for inputs that already failed

These inputs already failed in 5.x, so no valid input changes. A different
error is now thrown.

| Input | 5.x | R1 | ID |
|---|---|---|---|
| A non-string `$class` in an instance | `TypeError`, or `TypeNotFoundException` for an array | `Error` (`a $class that is not a string: …`) | BC-13 |
| A relationship property with no `type` in an AST | `TypeError` | `IllegalModelException` | BC-15 |
| A `null` element in a `decorators` array | `TypeError` | `IllegalModelException` | BC-16 |
| A non-`Identifiable` or `null` value in a relationship or concept array, when validated | `TypeError` | `ValidationException` | BC-06 |
| An element `fromJSON`/`toJSON` cannot read or write (an enum value as a property, say), or `Factory.newResource` with `generate` for a type it cannot generate (an enum type, say) | `TypeError` (circular JSON) | `Error` naming the element | BC-08 |
| Circular inheritance (`A extends C`, `B extends A`, `C extends B`) | `RangeError`, or out of memory | `IllegalModelException` naming the cycle | BC-11 |
| A map whose value type is not declared | `TypeError` | `IllegalModelException` | BC-12 |
| A decorator validation error under `decoratorValidation` | `IllegalModelException` naming the file twice | the same class, naming the file once | BC-14 |

### Other fixes

- **`ModelUtil.isValidIdentifier` returns `false` for any value that is not a
  string.** In 5.x, `undefined` and `null` were reported as valid. (BC-01)
- **A lone UTF-16 surrogate in a string reaches the engine as U+FFFD.** Strings
  cross into the engine as UTF-8. This is accepted as is, with no fix
  planned. (BC-03)

## Compatibility options

| Option | Where | R1 behaviour |
|---|---|---|
| `metamodelValidation` | `new ModelManager(options)` | On unless set to `false`: every AST you supply is checked against the metamodel when its `ModelFile` is built; engine-written `decorateModels` results and the fixed system models skip it by trusted origin (BC-19). `true` also runs `validateAst` in `addModelFile`, as before. `false` is an escape hatch for trusted input only (see the migration guide). |
| `strictQualifiedDateTimes` | `Serializer.fromJSON` options | Only strict `DateTime` values are accepted whatever it says. `false` is ignored, with one warning per process (`concerto-strict-datetime`). `true` still stops `utcOffset` from being applied. (BC-07) |
| `acceptResourcesForRelationships` | `Serializer.fromJSON` options | Unchanged for relationship properties. It now also lets a relationship-typed map value be an embedded object. (BC-05) |
| `permitResourcesForRelationships` | `Serializer.toJSON` and validation options | Unchanged for relationship properties. It now also permits embedded objects as relationship-typed map values. (BC-05) |
| `convertResourcesToRelationships` | `Serializer.toJSON` options | Unchanged for relationship properties. It now also writes embedded map values as references. (BC-05) |
| `regExp` | `new ModelManager(options)` | Ignored, with one warning per process (`concerto-regexp-option`). (BC-28) |

## Not in R1

The following are proposals in `migration/BREAKING-CHANGES-PLAN.md`. None of
them ships in R1, and each still needs a maintainer decision or a later
release:

- BC-04: map values of a scalar type validated against the value type, not
  the key type.
- BC-09: a map's identified concept value gets its own `$identifier`.
- BC-21: rejecting non-object decorators such as `[7]`.
- BC-24, factory-timing part: running decorator factories on first read.
  Decorator factories stay eager in R1.
- BC-27: a read-only `Resource.validate()` that accepts frozen resources.
- BC-33: typing `getModelFileByFileName` as `ModelFile | undefined`.
- BC-35: deprecating `Globalize`, or generating its messages from the engine.
- BC-44: the `utcOffset` units. The option behaves as in 5.x.
- BC-49: deprecating the per-declaration `validate()` methods.
- The P5-39 decisions (accordproject/concerto-rust#349): the browser async
  `init()` and the engine size reductions, and the follow-ups that wait on
  them: P5-44 (#365, the size wins), P5-45 (#366, async init), P5-46 (#367,
  unreferenced engine exports) and P5-47 (#368, the CTO parser out of
  AST-only entry points). Until those are decided, BC-32 ships as described
  above.
- The Concertino spike, P5-78 (accordproject/concerto-rust#420): whether
  Concertino becomes the R1 web story for introspection, validation and
  plain-JSON serialisation. Its decisions are open, so the browser story also
  waits on #420, and any BC rows it would add are not in R1.
- The P5-80 spike (accordproject/concerto-rust#424): a cached
  per-generation validation plan for instance validation and serialisation.
  Analysis only.
- The P5-81 spike (accordproject/concerto-rust#425): a table-driven
  typed-AST decoder to reduce the engine size. Analysis only.
