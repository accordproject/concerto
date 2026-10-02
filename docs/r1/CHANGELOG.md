# Concerto R1 changelog (draft)

R1 is the next major release of Concerto, planned as **6.0.0**. The version
number is set when the release is cut. This page lists what R1 changes for
users of `@accordproject/concerto-core` and the other packages in this
repository. How to upgrade is covered in the [R1 migration guide](./MIGRATION-GUIDE.md).

**Status: draft for maintainer review.** Written from
`migration/BREAKING-CHANGES-PLAN.md` (the one-major-release update, section 3
R1 and section 4), concerto-rust `DIVERGENCES.md` and the merged task records,
at concerto `09295b075` and concerto-rust `fa4ee0b` (2026-09-30). The
`BC-nn` IDs refer to rows in `migration/BREAKING-CHANGES-PLAN.md`.

## What's new

- **One engine, written in Rust.** Model loading, model validation, instance
  population and validation, decorator command sets and metamodel checks run
  in the Concerto Rust engine (`concerto-core` crate), shipped to JavaScript
  as a WebAssembly module. The TypeScript API is the same one 5.x has: same
  classes, same exports, same type declarations, apart from the removals listed
  below, and a few return types: `ModelUtil.getShortName`,
  `getFullyQualifiedName`, `capitalizeFirstLetter` and
  `removeNamespaceVersionFromFullyQualifiedName` return `string` where 5.x
  declared `any`, the `yamlToJson` result has `$class: string`, and
  `ModelUtil.parseNamespace` returns one object type in place of 5.x's union,
  with `versionParsed` typed `unknown`.
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
in the same run, as recorded in `migration/bench/RESULTS.md`, or for P5-60 in
its report on accordproject/concerto-rust#392 (not yet in `RESULTS.md`).
Below 1× is faster than 5.0.0; above 1× is slower. Timings on a shared machine move by up to about
±25-35% between rounds, so treat small differences as noise.

| Operation, through the JavaScript API | R1 vs 5.0.0 | Source |
|---|---:|---|
| `Serializer.fromJSON` | 0.89-0.92× | P5-22 |
| `ModelManager.validateAst` | 0.33-0.41× (2.4-3.0× faster) | P6-04 |
| `DecoratorManager.validate` | 0.66-0.80× | P5-27 |
| `DecoratorManager.decorateModels` | 0.80-1.45× | P5-27 |
| Repeated `getNamespaces`, `getType`, `resolveType` | 0.11-2.46× | P5-29 |
| First `getNamespaces`, `getType`, `resolveType` call after a model change | 2.6-17.9× (P5-29); `getNamespaces` 20.5-28.2× in P5-60, 3-26 µs once per change | P5-29, P5-60 |
| `Factory.newResource` | 2.5-4.1× | P5-22 |
| `DecoratorManager.extractDecorators` / `extractVocabularies` | `extractDecorators` 3.5-6.6×, `extractVocabularies` 5.3-9.2×; the first call after a model change 5.2-6.2× | P5-60 (cloud container, Intel Xeon @ 2.10GHz, 4 vCPU) |
| `new ModelFile` | 4.9-8.1× | P5-48 |
| `ModelManager.addModelFile` | 2.9-7.5× | P5-48 |
| `ModelManager.addCTOModel` (the CTO parser is unchanged JavaScript) | 1.7-4.0× | P5-48 |

- Model loading through the JavaScript API is still slower than 5.0.0. In the
  Rust crate itself, `addModelFile` is at or near 5.0.0's speed (0.81-1.09×,
  P5-48). Most of the remaining cost is crossing into WebAssembly and
  allocating there.
- The strict AST check (BC-19) adds one engine call per model file loaded
  (P5-49).
- The optimised engine module is 2,833,833 bytes (P5-61). An earlier build of
  about 3.0 MB compressed to about 947 KB with gzip and 613 KB with brotli
  (P5-48).
- _Placeholder: the consolidated R1 re-measure (P5-60, accordproject/concerto-rust#392)
  is added here when its numbers land in `RESULTS.md`._

## Breaking changes

Each entry is one line. The [migration guide](./MIGRATION-GUIDE.md) gives the
reason, who is affected and the upgrade step for each one.

### Packaging

- **Node.js 20.19+ (on 20.x) or 22.12+ is required** in every package
  (`engines.node` is `^20.19.0 || >=22.12.0`). Node.js 18 is no longer
  supported. (BC-31)
- **Browsers need a bundler, or a host that supplies a synchronous `require`,
  to load the engine.** The browser ESM build does not load the engine module
  by itself, and the engine adds about 2.8 MB before compression. The async
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

- **Every AST is checked against the Concerto metamodel when its `ModelFile` is
  built.** A malformed AST is an `IllegalModelException`. This covers a
  `decorators` value that is not an array, non-string names and empty super
  type names, and nodes that used to crash with a `TypeError`. Turn the check
  off with `metamodelValidation: false`, an escape hatch for trusted input
  only. (BC-19, with BC-17, BC-18 and BC-20)

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
| An element `fromJSON`/`toJSON` cannot read or write (an enum value as a property, say) | `TypeError` (circular JSON) | `Error` naming the element | BC-08 |
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
| `metamodelValidation` | `new ModelManager(options)` | On unless set to `false`: every AST is checked against the metamodel when its `ModelFile` is built (BC-19). `true` also runs `validateAst` in `addModelFile`, as before. `false` is an escape hatch for trusted input only (see the migration guide). |
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
  `init()` and the engine size reductions. Until those are decided, BC-32
  ships as described above.
