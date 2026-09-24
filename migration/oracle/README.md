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
drivers/          data.spec.js (test/data, test/1.0.0), conformance.spec.js (concerto-conformance),
                  gaps.spec.js (task P2-11: targeted inputs closing coverage-gaps.json branches),
                  unit-setup.js (global chai set-up for per-file unit runs)
bin/              record-all.sh, build-corpus.js, replay.js, coverage.sh, coverage-gaps.js, self-check.js
fixtures/         the corpus: <source>/<op>/<id>.json, blobs/, manifest.json
results/          replay-reference.json, coverage.json, self-check.json
coverage-gaps.json  every src branch the corpus does not reach
```

## Commands

Run from anywhere; `<work>` is a scratch directory for raw records and logs.

| Step | Command |
|---|---|
| Install the reference (once) | `cd migration/oracle/reference && npm ci` |
| Record and build the corpus | `migration/oracle/bin/record-all.sh <work>` |
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

Four sources feed it:

| Source | What runs |
|---|---|
| `unit` | Every file of `packages/concerto-core/test` in its own mocha process (4 in parallel). One file (`test/serializer/jsongenerator.js`) leaks a `ModelUtil.isEnum` stub from a `before` hook into all later files when the suite runs in one process; per-file processes contain that. `drivers/unit-setup.js` supplies the `chai.should()` and chai plugins that the single-process suite gets from other files. Under the recorder: 1299 passing, 1 failing (the network test `ModelLoader #loadModelFromUrl`, as in `baseline.json`), 8 pending. |
| `data` | `drivers/data.spec.js`: every `.cto`, AST `.json`, instance `.json`/`.expect`, DCS `.json` and `.yaml` under `test/data` and `test/1.0.0`, loaded alone and per directory, with and without validation, metamodel validation, instance generation (`sample`/`empty`), `toJSON`/`fromJSON` round trips, decorator application and extraction. |
| `conformance` | `drivers/conformance.spec.js`: every semantic scenario of concerto-conformance run exactly as its JavaScript step definitions do (`new ModelFile`, `addModelFile(…, true)`, `validateModelFiles`), every AST and CTO file under `semantic/specifications` on its own, and every instance scenario of `validate/features` (ModelLoader, `fromJSON`, `toJSON`). |
| `gaps` | `drivers/gaps.spec.js` (task P2-11, plan §2.4): targeted black-box inputs — crafted CTO models, mutated metamodel ASTs (via `fromAst`), and direct calls on the introspection objects a model manager returns — each aimed at one or more branches listed in `coverage-gaps.json` that the unit suite covers but the corpus did not. |

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
once, under the first of unit, data, conformance, with `occurrences` counting the copies.

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
| Model managers | `ModelManager.new`, `BaseModelManager.new`, `AstModelManager.new`; steps `addModel`, `addCTOModel`, `addModelFile`, `addModelFiles`, `updateModelFile`, `deleteModelFile`, `clearModelFiles`, `fromAst`, `validateModelFiles`; queries `validateModelFile`, `getType`, `resolveType`, `getAst`, `getModels`, `getNamespaces`, `derivesFrom`, `isAssignableTo`, `getAssignableConcreteTypes`, `resolveMetaModel`, `get*Declarations`, `getDecoratorValidation` |
| Model files | `ModelFile.new`, `validate`, `getType`, `resolveType`, `isLocalType`, `isImportedType`, `resolveImport`, `getFullyQualifiedTypeName`, `getLocalType`, `isDefined`, and every other public accessor |
| Introspection | every public method of `Declaration`, `ClassDeclaration` and subclasses, `MapDeclaration`, `ScalarDeclaration`, `Property`, `Field`, `RelationshipDeclaration`, `EnumValueDeclaration`, `MapKeyType`, `MapValueType`, `Decorated`, `Decorator`, the validators, `Introspector` |
| Instances | `Factory.newResource/newConcept/newRelationship/newTransaction/newEvent`, `Serializer.fromJSON/toJSON`, `Resource.validate/setPropertyValue/addArrayValue/instanceOf/toJSON`, `Typed`/`Identifiable`/`Resource`/`Relationship` accessors, `Relationship.fromURI` |
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

Originally recorded 2026-09-24 (task P0-05); the `gaps` source and the coverage figures below were
updated the same day by task P2-11 (full numbers: `fixtures/manifest.json`, `results/*.json`).

### Corpus

| Source | Fixtures | Ops |
|---|---:|---:|
| unit | 4,091 | 206 |
| data | 10,123 | 31 |
| conformance | 826 | 8 |
| gaps | 174 | 22 |
| **total** | **15,214** (from 27,902 recorded calls; 619 blobs) | |

Largest op families (fixtures, all sources): Serializer 3,621; ModelManager 2,988; ClassDeclaration 1,670;
DecoratorManager 1,542; Factory 1,444; Declaration 1,340; Property 778; ModelFile 579; Field 263;
Typed 141; ModelUtil 127; Resource 125. Per-op counts per source are in `fixtures/manifest.json` (`by_source`).

Skipped calls: e.g. tainted model managers, declarations built outside a model file, validators not owned
by their field, properties built outside a declaration, cycles, a stubbed `ModelUtil` function, function
arguments, async results, a stubbed CTO parser. `gaps` itself skips one op it deliberately still exercises
for its throw side effect: `ModelManager.filter` takes a predicate *function*, which the recorder cannot
encode as plain data (`nonplain:function`) — its own branches (`basemodelmanager.ts` lines 914, 918) can
never become a corpus fixture, whatever input reaches them.

### Replay against the frozen reference

`results/replay-reference.json`: **15,214 / 15,214 pass (100%)**, 0 fail, 0 harness errors
(unit 4,091/4,091, data 10,123/10,123, conformance 826/826, gaps 174/174). The corpus also replays 100%
against the workspace `src/` (the coverage run below).

### Coverage of the reference with the corpus as the only driver

nyc over `packages/concerto-core/src`, driver `bin/replay.js --engine src`:

| Metric | Corpus only | Unit suite (this run; = `baseline.json`) | Thresholds |
|---|---:|---:|---:|
| Statements | 90.50% (3013/3329) | 99.01% (3308/3341) | 99 |
| Branches | 85.83% (1575/1835) | 95.80% (1758/1835) | 94.8 |
| Functions | 89.67% (547/610) | 99.34% (606/610) | 99 |
| Lines | 90.43% (2961/3274) | 99.02% (3254/3286) | 99 |

Before task P2-11 the corpus-only figures were statements 87.77% (2922/3329), branches 80.92%
(1485/1835), functions 88.36% (539/610), lines 87.66% (2870/3274): the `gaps` driver closed 90 branches
(91 statements, 8 functions) with black-box inputs alone, at 100% replay agreement throughout.

The statement/line totals differ slightly between the two runs because nyc `all: true` counts files that a
run never loads without their source map (the suite run loads every file). Branch and function totals agree.

`coverage-gaps.json` lists all 260 branches the corpus still does not reach (189 of them are covered by the
unit suite) with file, line, type and location, and per file the uncovered statement lines and functions.
The largest remaining gaps are `introspect/modelfile.ts` (33), `serializer/jsonpopulator.ts` (29),
`serializer/jsongenerator.ts` (20), `serializer/resourcevalidator.ts` (17), `serializer/valuegenerator.ts`
(17), `basemodelmanager.ts` (16), `modelloader.ts` (14, async, not recorded) and
`introspect/collectionsizevalidator.ts` (9). Most of the branches in the `serializer/*` and
`modelfile.ts` families are reached in the unit suite only through stubs (validators built on stub
fields, populators and generators driven with fake parameters, as `fixtures/manifest.json`'s
`skip_and_taint_samples` confirms for several of them, e.g. `nonplain:validator-not-in-owner`): these are
the lifting tasks of plan §2.3 (P2-10), which was already lifting `jsonpopulator.ts` in parallel with this
task. P2-11 did not verify stub-only-ness branch by branch for that whole set, so P2-10 should treat the
"largely stub-only" read as a strong hint, not a certainty, for any branch it turns out to still be able to
reach through a real model.

A few remaining gaps are not stub-only but structurally unrecordable by this oracle and are not P2-10's to
lift either:
* `basemodelmanager.ts` 914, 918 (`filter()`'s own branches): `ModelManager.filter` takes a predicate
  function as its argument, which the recorder's plain-data encoding cannot capture (`nonplain:function`).
* `basemodelmanager.ts` 457, 473 (inside `updateExternalModels`): async, and `updateExternalModels` is
  listed as taint-only in `lib/ops.js`, never as a tracked, replayable op.
* `basemodelmanager.ts` 499, 507 (inside `writeModelsToFileSystem`): that method is not in `lib/ops.js`'s
  `MM_STEPS`/`MM_QUERIES` list at all, so no call to it is ever recorded.
* `serializer.ts` 56, 58 (the `Serializer` constructor's null-factory/null-modelManager checks): only
  `Serializer.fromJSON`/`toJSON` are wrapped ops; the constructor itself is never intercepted, and nothing
  else in the recorded surface constructs a `Serializer` with invalid arguments.
* `introspect/decorated.ts` 104, 107, 112 (the decorator-factory path of `Decorated.process()`): reaching
  it needs `ModelManager.addDecoratorFactory`, which is in `lib/ops.js`'s `MM_TAINT` list — calling it
  taints the model manager, so every later op on it (including the `addCTOModel`/`addModel` that would
  build the decorated declaration) is skipped from recording.
* `basemodelmanager.ts` 371 (`updateModelFile`'s `!modelFile.getVersion()` throw) and
  `typenotfoundexception.ts` 36 (the default-message branch of its constructor) both look like dead code:
  `introspect/modelfile.ts`'s `fromAst` unconditionally rejects an unversioned, non-system namespace before
  a `ModelFile` can exist, so `updateModelFile` can never see one; and every call site that throws
  `TypeNotFoundException` in `src/` already supplies a message, so the omitted-message branch has no
  caller. Confirming either is truly unreachable, rather than reachable through some path this task did not
  find, is worth a second pair of eyes before anyone spends more time trying to cover them.

### Judge self-check

`results/self-check.json` (`bin/self-check.js`): every seeded mutant is detected.

| Mutant | Kind | Fixtures that flag it |
|---|---|---:|
| error-message-changed: IllegalModelException messages gain a full stop | adapter wrapper | 606 |
| verdict-flipped: `validateModelFiles` succeeds where the reference throws and vice versa | adapter wrapper | 383 |
| identifier-check-dropped: `ModelUtil.isValidIdentifier` always true | in-engine patch | 2 |
| abstract-check-dropped: `ClassDeclaration.isAbstract` always false | in-engine patch | 178 |
| canonical-result-altered: `Serializer.toJSON` results lose `$class` | adapter wrapper | 1,619 |
| error-class-swapped: TypeNotFoundException reported as Error | adapter wrapper | 272 |
| optional-field-rule-dropped: `Property.isOptional` always true | in-engine patch | 11,134 |
| datetime-shifted: DateTime values serialised 1 ms late | in-engine patch | 584 |

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
  `addDecoratorFactory` (`lib/ops.js`'s `MM_TAINT`). See "Coverage of the reference…" above for the
  `coverage-gaps.json` branches task P2-11 traced to these two causes, plus to ops that are not in
  `lib/ops.js`'s wrapped surface at all (`writeModelsToFileSystem`, the `Serializer` constructor).
