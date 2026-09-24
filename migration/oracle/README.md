# Behavioural oracle for concerto-core (task P0-05)

This directory holds the golden oracle described in plan §2.2 to §2.6. It
records what concerto-core does at its public semantic boundary, stores each
call as a language-neutral fixture, and replays the fixtures against any
engine through an adapter. The judge that compares outcomes is checked
against seeded mutants.

```
reference/        frozen reference: package.json pinning @accordproject/concerto-core,
                  concerto-cto and concerto-util 5.0.0 from npm (plan D10), plus the lockfile
lib/              core.js      loads the modules of one build (workspace src/ via ts-node, or reference dist/)
                  ops.js       op catalogue: what is recorded and how an op is executed
                  codec.js     value encoding for inputs (decodable recipes) and outcomes (summaries)
                  canon.js     canonicalisation (sorted keys, <uuid>, <now>)
                  store.js     content-addressed blob store
                  env.js       determinism envelope (seeded Math.random, clock separation)
                  recorder.js  mocha --require hook that records fixtures
                  adapter.js   engine adapter contract, and the adapter for any JS build of concerto-core
                  judge.js     replay and verdicts
                  rust-adapter.js  the Rust/WASM engine: workspace src/ with CONCERTO_ENGINE=rust (P0-04b trial)
drivers/          data.spec.js (test/data, test/1.0.0), conformance.spec.js (concerto-conformance),
                  gaps.spec.js (task P2-11: targeted inputs closing coverage-gaps.json branches),
                  lifted.spec.js (task P2-10: runs lifted/*.scenarios.js),
                  unit-setup.js (global chai set-up for per-file unit runs)
lifted/           task P2-10: black-box scenarios replacing white-box unit tests (see lifted/README.md)
bin/              record-all.sh, build-corpus.js, replay.js, coverage.sh, coverage-gaps.js, self-check.js,
                  cto-cache.js (CTO -> AST cache for the native Rust harness, OD-9; P0-04b trial)
fixtures/         the corpus: <source>/<op>/<id>.json, blobs/, manifest.json
results/          replay-reference.json, coverage.json, self-check.json
coverage-gaps.json  every branch the corpus does not reach on the reference
gap-reasons.json  the verified reason for every one of those branches the unit suite covers
```

## Commands

Run from anywhere; `<work>` is a scratch directory for raw records and logs.

| Step | Command |
|---|---|
| Install the reference (once) | `cd migration/oracle/reference && npm ci` |
| Record and build the corpus | `CONFORMANCE_DIR=<concerto-conformance checkout> JOBS=<n> migration/oracle/bin/record-all.sh <work>` |
| Replay against the reference | `node migration/oracle/bin/replay.js --report migration/oracle/results/replay-reference.json` |
| Replay against another engine | `node migration/oracle/bin/replay.js --engine path/to/adapter.js` |
| Corpus-only coverage and gaps | `migration/oracle/bin/coverage.sh <work> --with-suite` |
| Judge self-check (mutants) | `node migration/oracle/bin/self-check.js --report migration/oracle/results/self-check.json` |

`replay.js` exits non-zero unless every fixture passes. Options: `--source unit|data|conformance`,
`--op <op>`, `--fixtures <dir>`, `--max-failures N`. Set `ORACLE_VERBOSE=1` to see engine log output.

## How the corpus is recorded

`lib/recorder.js` is loaded with `mocha -r ts-node/register -r migration/oracle/lib/recorder.js`.
It wraps the public boundary of `packages/concerto-core/src` (the same code as the npm 5.0.0 build;
their compiled `dist/*.js` are identical) and writes one raw record per **outermost** public call.
Calls made while another recorded call is running are nested and are not recorded.

Five sources feed it:

| Source | What runs |
|---|---|
| `unit` | Every file of `packages/concerto-core/test` in its own mocha process (`JOBS` in parallel, default 4). One file (`test/serializer/jsongenerator.js`) leaks a `ModelUtil.isEnum` stub from a `before` hook into all later files when the suite runs in one process; per-file processes contain that. `drivers/unit-setup.js` supplies the `chai.should()` and chai plugins that the single-process suite gets from other files. |
| `data` | `drivers/data.spec.js`: every `.cto`, AST `.json`, instance `.json`/`.expect`, DCS `.json` and `.yaml` under `test/data` and `test/1.0.0`, loaded alone and per directory, with and without validation, metamodel validation, instance generation (`sample`/`empty`), `toJSON`/`fromJSON` round trips, decorator application and extraction. |
| `conformance` | `drivers/conformance.spec.js`: every semantic scenario of concerto-conformance run exactly as its JavaScript step definitions do (`new ModelFile`, `addModelFile(…, true)`, `validateModelFiles`), every AST and CTO file under `semantic/specifications` on its own, and every instance scenario of `validate/features` (ModelLoader, `fromJSON`, `toJSON`). |
| `gaps` | `drivers/gaps.spec.js` (task P2-11, plan §2.4): targeted black-box inputs — crafted CTO models, mutated metamodel ASTs (via `fromAst`), Resources built by a Factory and assigned field values directly, `Serializer`/`Factory` options, and direct calls on the introspection objects a model manager returns — each aimed at one or more branches listed in `coverage-gaps.json` that the unit suite covers but the corpus did not. |
| `lifted` | `drivers/lifted.spec.js` (task P2-10, plan §2.3): every scenario in `lifted/*.scenarios.js`, each replacing a white-box unit test with a public `Serializer.fromJSON` call. |

A call is **skipped** (and counted by op and reason in `fixtures/manifest.json`) when:

* any concerto-core, concerto-cto, concerto-util, concerto-metamodel, uuid or dayjs function, `Math.random`
  or the clock is a sinon stub at the time of the call (`env-stubbed:<where>`);
* an input is not plain data and has no recipe: a function or sinon fake, an instance built from stubs,
  an object with a stubbed or monkey-patched method, a declaration that is not part of its model file,
  a cycle (`nonplain:<reason>`);
* the receiver's model manager was *tainted*: its state stopped being reproducible from plain data
  (a custom `processFile`, non-plain options, `addDecoratorFactory`, `updateExternalModels`, a mutation made
  inside another op, a step whose arguments were not plain);
* the result is a promise (`async-result`); async ops are not recorded.

Deduplication: records are hashed on `{op, inputs, outcome, env}`; a fixture seen in several sources is kept
once, under the first of unit, data, conformance, gaps, lifted, with `occurrences` counting the copies.

`CONFORMANCE_DIR` must point at a concerto-conformance checkout (the driver's default,
`/home/user/concerto-conformance`, is the original container's path). The figures below used commit
66a5e8bc (its `main`, the commit recorded in `migration/baseline.json`).

## Fixture schema

```json
{
  "id": "0348844b174ac7163bd75789",
  "source": "unit",
  "source_test": "InstanceGenerator #visit should generate an id matching ...",
  "op": "ModelManager.addCTOModel",
  "inputs": { "target": <encoded receiver>, "args": [<encoded argument>, ...] },
  "outcome": { "ok": <encoded result> } | { "error": { "class", "message", "location", "component" } },
  "env": { "random": false },
  "occurrences": 1
}
```

* `inputs.target` is present for method ops only; constructors and static functions have `args` only.
* `outcome` may also carry `effects`: `{"target": <receiver after the call>}` for ops that change an instance
  (`setPropertyValue`, `addArrayValue`, `setIdentifier`), and `{"args": {"<i>": <argument after the call>}}`
  when an op changed a plain-data argument in place (for example DCS options or ASTs).
* `error.location` is the exception's `fileLocation` (or `null`), `component` its `component` (or `null`).
* `outcome` is canonical: keys sorted; a v4 UUID not present in the inputs becomes `<uuid>`; an ISO date-time
  whose instant lies inside the op's execution window and is not the instant of any date-time in the inputs
  becomes `<now>`.
* `env.random` is true when the op drew from `Math.random` (sample instance generation). The JS adapters run
  every op under the same seeded PRNG (`lib/env.js`), so these replay exactly. An engine that cannot reproduce
  that PRNG should compare such fixtures structurally (it is told which ones they are).
* Large values (strings over 1024 characters, objects whose JSON exceeds 4096 characters) are stored once
  in `fixtures/blobs/<aa>/<sha256>.json` and referenced as `{"@@oracle":"blob","sha256":"..."}`. A missing,
  corrupt or unreadable blob is a **harness error**.

### Value encoding

Plain JSON is itself. Everything else is an object with an `"@@oracle"` kind:

| Kind | Meaning |
|---|---|
| `undefined`, `number` (`NaN`, `Infinity`, `-0`), `bigint`, `date`, `regexp`, `map`, `set` | JS values JSON cannot hold |
| `dayjs` | `{iso, offset, utc, valid}` |
| `mm` | a model manager recipe: `{id, kind: ModelManager/BaseModelManager/AstModelManager, options, steps}` or `{id, kind, derived: {op, inputs, path?}, steps}` |
| `mmref`, `self` | the model manager with that `id` in the same inputs; the model manager a step runs on |
| `mfref` | model file registered in a model manager: `{mm, ns}` |
| `mfnew` | model file built but not registered: `{mm, ast, definitions, fileName}` |
| `declref`, `propref`, `decoref`, `validatorref` | declaration / property / map key or value / decorator / validator, by position inside its parent |
| `factory`, `serializer`, `introspector` | rebuilt from their model manager (and the serializer's default options) |
| `typed` | a Resource, ValidatedResource or Relationship: its handles plus every own property in order |
| outcome only: `ModelManager`, `ModelFile`, `Declaration`, `Property`, `Decorator`, `Validator`, `object`, `function`, `throws` | summaries of handles returned by an op (e.g. a model manager's full AST) |

A model manager recipe's `steps` are the state-changing public calls made on it, in order:
`{method, args, status: ok|error, errorClass}`. Replaying a recipe re-runs the steps; a step whose
status or error class differs from the recorded one is a **state divergence**, reported as a failure.

## Ops

`lib/ops.js` is the single list. Families (op name = `<Class>.<method>`):

| Family | Ops |
|---|---|
| Model managers | `ModelManager.new`, `BaseModelManager.new`, `AstModelManager.new`; steps `addModel`, `addCTOModel`, `addModelFile`, `addModelFiles`, `updateModelFile`, `deleteModelFile`, `clearModelFiles`, `fromAst`, `validateModelFiles`; queries `validateModelFile`, `getType`, `resolveType`, `getAst`, `getModels`, `getNamespaces`, `derivesFrom`, `isAssignableTo`, `getAssignableConcreteTypes`, `resolveMetaModel`, `get*Declarations`, `getDecoratorValidation`, `writeModelsToFileSystem` (only with no directory) |
| Model files | `ModelFile.new`, `validate`, `getType`, `resolveType`, `isLocalType`, `isImportedType`, `resolveImport`, `getFullyQualifiedTypeName`, `getLocalType`, `isDefined`, and every other public accessor |
| Introspection | every public method of `Declaration`, `ClassDeclaration` and subclasses, `MapDeclaration`, `ScalarDeclaration`, `Property`, `Field`, `RelationshipDeclaration`, `EnumValueDeclaration`, `MapKeyType`, `MapValueType`, `Decorated`, `Decorator`, the validators, `Introspector` |
| Instances | `Factory.newResource/newConcept/newRelationship/newTransaction/newEvent`, `TypeNotFoundException.new` (recorded as an error value), `Serializer.new` (the constructor; a successful one is summarised as `{"@@oracle":"object","ctor":"Serializer"}`), `Serializer.fromJSON/toJSON`, `Resource.validate/setPropertyValue/addArrayValue/instanceOf/toJSON`, `Typed`/`Identifiable`/`Resource`/`Relationship` accessors, `Relationship.fromURI` |
| Statics | every `ModelUtil` static, every `DecoratorManager` static, `MetaModel.newMetaModelManager/validateMetaModel/modelManagerFromMetaModel`, `DcsConverter.jsonToYaml/yamlToJson`, `DateTimeUtil.setCurrentTime` |

## Adding an engine adapter

An adapter is a module exporting `createAdapter()` that returns:

```js
{
  name: 'rust-wasm',
  run(op, inputs) {
    // inputs: fixture inputs with every blob resolved
    // return { outcome, window } where
    //   outcome = { ok: <result in the output encoding> } | { error: { class, message, location, component } }
    //             (+ effects when the op changed its receiver or a plain argument)
    //   window  = { start, end }  wall-clock ms around the op itself (optional; the judge times run() otherwise)
  }
}
```

Rules:

1. Rebuild the inputs with public calls only: a model manager from its constructor options and steps (or by
   running its `derived` op), model files from `mfref`/`mfnew`, and so on (see `makeDecoder` in `lib/codec.js`).
2. Throw an error whose `name` is `HarnessError` when the fixture cannot be set up for reasons of the fixture
   itself. Set `err.divergence = true` when the engine's own behaviour made the set-up fail (a step with a
   different status), and `err.unsupported = true` for an op the engine does not implement: both are failures.
3. Keys need not be sorted and generated ids/timestamps need not be normalised: the judge canonicalises.
4. Run the op under the seeded PRNG if the engine can; otherwise treat `env.random` fixtures specially.

`lib/adapter.js` `coreAdapter(core)` is the adapter for any JS build of concerto-core; `referenceAdapter()`
uses `reference/node_modules/@accordproject/concerto-core` and `srcAdapter()` the workspace `src/`.

Verdicts: `pass` (canonical outcomes identical), `fail` (different outcome, state divergence, input
construction failed, unsupported op), `harness-error` (fixture or blob missing, unreadable or malformed).
A harness error is never a pass.

## Results

Recorded 2026-09-24 (task P0-05) and re-recorded end to end the same day by task P2-11, after
merging P2-10 part 1 (`lifted/`): `record-all.sh` (all five sources, `JOBS=5`), `coverage.sh
--with-suite`, both replays and `self-check.js`, in that order, on the committed drivers. Full numbers:
`fixtures/manifest.json`, `results/*.json`, `coverage-gaps.json`.

### Corpus

| Source | Fixtures | Ops |
|---|---:|---:|
| unit | 4,117 | 208 |
| data | 10,231 | 32 |
| conformance | 839 | 9 |
| gaps | 543 | 38 |
| lifted | 64 | 3 |
| **total** | **15,794** (from 28,936 recorded calls; 620 blobs) | |

Unit suite under the recorder: 1300 passing, 0 failing, 8 pending (the network test `ModelLoader
#loadModelFromUrl`, failing in `baseline.json`, passes when the network is reachable).

Skipped calls: 978 in `unit` (tainted model managers, declarations built outside a model file,
validators not owned by their field, properties built outside a declaration, cycles, a stubbed `ModelUtil`
function, function arguments, async results, a stubbed CTO parser, and 3 `writeModelsToFileSystem` calls given a real directory, skipped as
`writes-to-disk`) and 1 in `gaps`: `ModelManager.filter`,
whose predicate is a function (`nonplain:function`), so none of `filter()`'s branches can become a fixture.

### Replay

`results/replay-reference.json`: **15,794 / 15,794 pass (100%)** against the frozen reference, 0 fail,
0 harness errors. Against the workspace `src/`: also 15,794 / 15,794, 0 harness errors.

The corpus recorded at the start of this round (15,384 fixtures) had one failing fixture on both engines,
`gaps/Serializer.toJSON/504efcf4…`: `drivers/gaps.spec.js` built a DateTime with the `dayjs` that
`require('dayjs')` resolves to from `drivers/`, a copy without concerto-core's `utc` plugin, so the recorded
outcome (`obj.utc is not a function`) depended on which dayjs the engine decoded the value with. The driver
now uses concerto-core's own `dayjs-setup` and a fixed instant.

### Coverage with the corpus as the only driver

`bin/coverage.sh` replays the corpus under nyc twice. The primary run is against the **frozen reference**:
nyc instruments `reference/node_modules/@accordproject/concerto-core/dist/*.js` and remaps the counts
through the package's own source maps to `src/*.ts`, which gives the same files and the same branch map
as the workspace `src/` (`coverage-gaps.js` compares every branch's location: 0 mismatches). The second run,
against `src/` through ts-node, is a cross-check: 0 branches on which the two runs disagree. The unit suite
can only run against `src/`.

| Metric | Corpus → reference | Corpus → `src/` | Unit suite → `src/` |
|---|---:|---:|---:|
| Statements | 92.12% (3157/3427) | 94.83% (3157/3329) | 99.01% (3308/3341) |
| Branches | **92.86% (1704/1835)** | 92.86% (1704/1835) | **95.80% (1758/1835)** |
| Functions | 91.47% (558/610) | 91.47% (558/610) | 99.34% (606/610) |
| Lines | 92.05% (3104/3372) | 94.80% (3104/3274) | 99.02% (3254/3286) |

Branches and functions have the same totals in every run. Statement and line totals differ: on the
reference, nyc also counts statements of the compiled `dist/*.js` (such as the module interop helpers tsc
emits) that the source maps attribute to `src` lines, and a ts-node run counts a file it never loads
without its source map. The covered counts of the two corpus runs are identical.

History of corpus-only branch coverage: 80.92% (1485/1835) after P0-05; 88.99% (1633/1835) at the start of
this round (15,384 fixtures, measured with this pipeline after merging P2-10 part 1; statements 89.78%
3077/3427, functions 90.16% 550/610, lines 89.70% 3025/3372 on the reference); 92.26% (1693/1835) after
this round's first pass (15,773 fixtures); 92.86% (1704/1835) now.
The README's earlier 85.83% predated the previous round's fix-up and was never re-measured.

This round closed 60 branches, 58 of them covered by the unit suite: `jsongenerator.ts` 22 (all of its
suite-covered gaps), `valuegenerator.ts` 14, `resourcevalidator.ts` 10, `instancegenerator.ts` 8,
`serializer.ts` 2 (through the new `Serializer.new` op), and one each in `basemodelmanager.ts`
(`deleteModelFile` of an unknown namespace), `modelfile.ts` (`getFullyQualifiedTypeName` of a primitive),
`property.ts` (`getFullyQualifiedTypeName` of an undeclared type) and `jsonpopulator.ts` (the default
namespace of a relationship to a primitive type). Two of these correct earlier claims: `jsongenerator.ts`'s
`visit()` fallthrough is reachable (`Relationship.fromURI` to a scalar, then `Serializer.toJSON`), and the
`jsonpopulator.ts` default-namespace branch, listed not-liftable in `lifted/MAP.tsv`, is reachable with a
model added without validation whose relationship targets a primitive.

A review of that pass then recorded fixtures for 9 more suite-covered branches it had listed as
unrecordable or internal-only; the fix round closed them (11 branches in all, 9 of them suite-covered):

* `resourcevalidator.ts` 306: `Resource.setPropertyValue('s', undefined)` on a Factory-built
  (validated) instance, which validates the raw value.
* `instancegenerator.ts` 44: `Factory.newResource` of an enum type with `generate: 'sample'` and
  `'empty'`; the generator visits the enum declaration and none of its cases accepts it.
* `jsonpopulator.ts` 154: `Serializer.fromJSON` of a nested object, and of a map value, whose `$class`
  names an enum.
* `basemodelmanager.ts` 499, 507 (33[0], 33[1], 34[0..2]) and 508: `writeModelsToFileSystem` is now an
  op (`lib/ops.js` `MM_QUERIES`), recorded only with a falsy directory, where it throws before writing
  (`` `path` is a required parameter`` or "has no file name"). A call with a directory is skipped by the
  recorder (`writes-to-disk`) and refused by the adapter, so no recorded or replayed call writes to disk.
* `typenotfoundexception.ts` 36: a `TypeNotFoundException.new` constructor op (the class is exported
  from the package index), recorded like `Serializer.new`; `new TypeNotFoundException(name)` takes the
  default-message branch. The exception is recorded as an error value.

**Note for P2-10 (`lifted/MAP.tsv` is P2-10's file and is not edited here):** two of its `not-liftable`
rows are wrong. Line 41 (`JSONPopulator #visit should throw an error for an unrecognized type`) is
liftable: `Serializer.fromJSON` with a nested `$class` naming an enum reaches the same throw
(`jsonpopulator.ts` 154, closed above). Line 53 (`#visitRelationshipDeclaration should get the
relationship namespace if required`) is liftable too: a relationship to a primitive type in a model added
without validation reaches it (`jsonpopulator.ts` 445, closed by `drivers/gaps.spec.js`).

### Remaining gaps

`coverage-gaps.json` lists all 131 branches the corpus does not reach on the reference. 65 of them are
covered by the unit suite. Each of the 65 carries a category, the task it is handed to and a verified
reason from `gap-reasons.json` (`coverage-gaps.js` merges them, and reports a stale or missing reason: none):

| Handed to | Category | Branches | Where |
|---|---|---:|---|
| accordproject/concerto-rust#94 | `unrecordable` | 30 | `ModelManager.filter` (`basemodelmanager.ts` 914, 918) and the private `ModelFile.filter` it calls (`modelfile.ts` 894–941): the predicate is a function |
| accordproject/concerto-rust#94 | `unrecordable` | 14 | `modelloader.ts`: static async, reads files and URLs |
| accordproject/concerto-rust#94 | `unrecordable` | 4 | `updateExternalModels` (`basemodelmanager.ts` 457, 473): async, taints the model manager |
| accordproject/concerto-rust#94 | `unrecordable` | 3 | `decorated.ts` 107[0], 107[1], 112[1]: need a `DecoratorFactory` subclass carrying code |
| accordproject/concerto-rust#94 | `plan-owner-decision` | 2 | `scalardeclaration.ts` 89[1] (reachable through the exported `ScalarDeclaration` constructor, but introspection constructors are deliberately not ops); `decorated.ts` 104[0] (reachable with the base `DecoratorFactory`, but needs a codec change: a factory encoding and `addDecoratorFactory` as a step) |
| P2-10 (accordproject/concerto-rust#54) | `internal-only` | 8 | `jsonpopulator.ts` 129, 171, 281, 363, 439; `valuegenerator.ts` 80, 102, 171 |
| P2-10 (accordproject/concerto-rust#54) | `stub-only` | 4 | `property.ts` 209, 213; `field.ts` 194; `relationshipdeclaration.ts` 79 |
| | | **65** | 53 to #94, 12 to P2-10 |

**Exit condition: met through the fallback clause**, as the plan owner extended it: every remaining
suite-covered gap is either closed or handed off with a verified reason (53 to accordproject/concerto-rust#94,
12 to P2-10). The first clause is not met: corpus-only branch coverage is 92.86% (1704/1835) against the
unit suite's 95.80% (1758/1835).

### Judge self-check

`results/self-check.json` (`bin/self-check.js`), run on this corpus: baseline 15,794 / 15,794 pass,
0 fail, 0 harness errors; every seeded mutant is detected.

| Mutant | Kind | Fixtures that flag it |
|---|---|---:|
| error-message-changed: IllegalModelException messages gain a full stop | adapter wrapper | 623 |
| verdict-flipped: `validateModelFiles` succeeds where the reference throws and vice versa | adapter wrapper | 385 |
| identifier-check-dropped: `ModelUtil.isValidIdentifier` always true | in-engine patch | 5 |
| abstract-check-dropped: `ClassDeclaration.isAbstract` always false | in-engine patch | 180 |
| canonical-result-altered: `Serializer.toJSON` results lose `$class` | adapter wrapper | 1,670 |
| error-class-swapped: TypeNotFoundException reported as Error | adapter wrapper | 281 |
| optional-field-rule-dropped: `Property.isOptional` always true | in-engine patch | 11,290 |
| datetime-shifted: DateTime values serialised 1 ms late | in-engine patch | 585 |

Harness checks, all reported as `harness-error`: a fixture whose input blob is missing, a fixture without
inputs, a fixture file that does not exist, a fixture referencing an unknown blob.

## Known limits

* Async public calls (`ModelLoader.*`, `updateExternalModels`) are not recorded; `modelloader.ts` is only
  reached through its synchronous callees.
* Logger output (e.g. decorator validation warnings) is not part of the outcome.
* A test that mutates concerto-core objects through non-API paths (assigning fields directly) after a
  recipe was captured would produce a fixture whose inputs no longer match; none occurs in this corpus
  (100% replay), and plain-function overrides of methods on tracked objects are detected and skipped.
* An op whose primary argument is a function (`ModelManager.filter`'s predicate) is never recorded
  (`nonplain:function`); nor is a call that would taint its model manager first, such as one made after
  `addDecoratorFactory` (`lib/ops.js`'s `MM_TAINT`), nor `writeModelsToFileSystem` with a directory (it
  would write files; only a call with no directory is recorded). The first two, with the async calls
  above, are the `unrecordable` gaps in "Remaining gaps", handed to accordproject/concerto-rust#94.
