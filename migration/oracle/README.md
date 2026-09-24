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
                  unit-setup.js (global chai set-up for per-file unit runs)
bin/              record-all.sh, build-corpus.js, replay.js, coverage.sh, coverage-gaps.js, self-check.js,
                  cto-cache.js (P0-04b trial version, kept as-is, not used by anything else any more),
                  build-cto-cache.js (CTO -> AST cache for the native Rust harness, OD-9; task P1-07a)
fixtures/         the corpus: <source>/<op>/<id>.json, blobs/, manifest.json
cto-cache/        the CTO -> AST cache: <aa>/<sha256>.json (generated; see "CTO -> AST cache" below)
results/          replay-reference.json, coverage.json, self-check.json, cto-cache.json
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
| Build/refresh the CTO -> AST cache | `node migration/oracle/bin/build-cto-cache.js` |
| Check the CTO -> AST cache is complete | `node migration/oracle/bin/build-cto-cache.js --check` |

`replay.js` exits non-zero unless every fixture passes. Options: `--source unit|data|conformance`,
`--op <op>`, `--fixtures <dir>`, `--max-failures N`. Set `ORACLE_VERBOSE=1` to see engine log output.

## How the corpus is recorded

`lib/recorder.js` is loaded with `mocha -r ts-node/register -r migration/oracle/lib/recorder.js`.
It wraps the public boundary of `packages/concerto-core/src` (the same code as the npm 5.0.0 build;
their compiled `dist/*.js` are identical) and writes one raw record per **outermost** public call.
Calls made while another recorded call is running are nested and are not recorded.

Three sources feed it:

| Source | What runs |
|---|---|
| `unit` | Every file of `packages/concerto-core/test` in its own mocha process (4 in parallel). One file (`test/serializer/jsongenerator.js`) leaks a `ModelUtil.isEnum` stub from a `before` hook into all later files when the suite runs in one process; per-file processes contain that. `drivers/unit-setup.js` supplies the `chai.should()` and chai plugins that the single-process suite gets from other files. Under the recorder: 1299 passing, 1 failing (the network test `ModelLoader #loadModelFromUrl`, as in `baseline.json`), 8 pending. |
| `data` | `drivers/data.spec.js`: every `.cto`, AST `.json`, instance `.json`/`.expect`, DCS `.json` and `.yaml` under `test/data` and `test/1.0.0`, loaded alone and per directory, with and without validation, metamodel validation, instance generation (`sample`/`empty`), `toJSON`/`fromJSON` round trips, decorator application and extraction. |
| `conformance` | `drivers/conformance.spec.js`: every semantic scenario of concerto-conformance run exactly as its JavaScript step definitions do (`new ModelFile`, `addModelFile(…, true)`, `validateModelFiles`), every AST and CTO file under `semantic/specifications` on its own, and every instance scenario of `validate/features` (ModelLoader, `fromJSON`, `toJSON`). |

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

## CTO -> AST cache for the native harness

CTO parsing lives in `concerto-cto`, which stays out of the Rust port, so a native (`cargo test`) harness
cannot itself turn a fixture's CTO text into a model. 13,006 of the corpus' 15,037 fixtures have CTO text as
input (a `ModelManager` recipe with an `addCTOModel` step, or a fixture whose own recorded op is
`ModelManager.addCTOModel`): `bin/build-cto-cache.js` (task P1-07a, PORTING.md OD-9) pre-parses all of them
with the frozen reference `concerto-cto` 5.0.0 -- the same parser the corpus was recorded with -- and writes
the result to a cache the harness can look entries up in without ever running a JS process itself.

```
node migration/oracle/bin/build-cto-cache.js               # build/refresh the cache from the corpus
node migration/oracle/bin/build-cto-cache.js --check        # exit non-zero if any corpus CTO text has no entry
node migration/oracle/bin/build-cto-cache.js --verify        # re-parse every entry fresh and compare it to the cache
node migration/oracle/bin/build-cto-cache.js --force         # re-parse every entry even if a cache file exists
```

`ORACLE_REFERENCE_DIR` overrides the reference directory, same as `bin/cto-cache.js` (the P0-04b trial
version of this generator, at `bin/cto-cache.js`, kept as-is and not touched by this task; nothing else
reads it any more). `--fixtures`, `--cache` and `--manifest` override the corpus, cache and manifest
locations (defaults: `fixtures/`, `cto-cache/`, `results/cto-cache.json`, all under `migration/oracle/`).

**Where the CTO text is collected from.** Every fixture's resolved `inputs` are walked for two shapes: a
`ModelManager` recipe (`"@@oracle":"mm"`), whose `addCTOModel` steps are read directly, including one
reached only through a `derived` spec; and a fixture (or nested `derived` spec) whose own `op` *is*
`ModelManager.addCTOModel`, whose `inputs.args` are the call's own arguments rather than a step in some
other op's target. The P0-04b trial generator (`bin/cto-cache.js`) only covered the first shape; the second
one accounts for several hundred fixtures across the `unit`, `data` and `conformance` sources (`op` itself
is `ModelManager.addCTOModel`) that would otherwise silently be missing from the cache.

**Cache key.** Each entry is keyed by the SHA-256 of `JSON.stringify([cto, fileName, skipLocationNodes])`,
written to `cto-cache/<first two hex chars>/<sha256>.json`. `skipLocationNodes` (the model manager's
constructor option) is the only parser argument that changes the *shape* of a successful AST -- verified by
parsing the same text with the same `skipLocationNodes` but two different file names and diffing the
result: identical, because `fileName` is never written into a location node. `fileName` is still part of the
key even so, because it changes the *message* of a `ParseException` (`" File " + fileName` is appended);
dropping it from the key would let two fixtures with the same invalid CTO text but different file names
collide on one entry and silently give one of them the wrong recorded message.

**Entry shape.** `{"ast": <AST>}` for a successful parse, or `{"error": {"class", "message", "location"}}`
for a `ParseException` -- `class` is the constructor name, `message` the exception's own `.message`
(location and file name already folded in, matching how fixtures record other errors), `location` its
`getFileLocation()` (`null` when the exception carries none). The native harness replays an `addCTOModel`
step as `add_model` with the cached AST on a hit, and a recorded `ParseException` on an error entry; a CTO
text with no entry is a harness error there, never a skip or a pass (plan §2.6).

**Regeneration.** The cache is generated output, exactly like the corpus it is built from (`fixtures/` is
git-ignored -- see `.gitignore`), so `cto-cache/` is git-ignored too and never appears in a PR diff. Rebuild
it locally with `node migration/oracle/bin/build-cto-cache.js` whenever the corpus is re-recorded; it reuses
any cache file already on disk unless `--force` is given, so a routine re-run after `record-all.sh` only
(re)parses CTO text that changed. What *is* committed is the generator above, this documentation, and a
small evidence manifest, `results/cto-cache.json`:

```json
{
  "generatedAt": "...", "fixturesDir": "fixtures", "cacheDir": "cto-cache", "ctoParserVersion": "5.0.0",
  "fixturesScanned": 15794, "fixturesWithCto": 13699, "uniqueCtoTexts": 534,
  "entries": { "ast": 516, "error": 18, "total": 534 },
  "written": 534, "reused": 0,
  "contentHash": "<sha-256 over every entry's own sha-256, sorted by key>"
}
```

`fixturesWithCto` is what the exit condition calls "the CTO-dependent fixtures": every fixture whose
resolved inputs reached at least one `addCTOModel` call, of either shape above. It tracks the corpus present
at generation time, so it moves as the corpus grows (P2-10 and P2-11 add fixtures under `fixtures/lifted`
and `fixtures/gaps`); a manifest whose `fixturesWithCto` differs from the 13,006 noted above (this file's
corpus snapshot, and the issue's own figure) carries a `note` saying so, rather than silently disagreeing
with it. `contentHash`
lets a stale or corrupted cache be detected -- for example after a partial rebuild was interrupted -- without
diffing the (git-ignored) cache directory itself: `--check` (existence and readability of every needed
entry) and `--verify` (every needed entry re-parsed fresh and compared byte for byte to what is cached) are
the two ways to detect that, and both fail loudly (non-zero exit, the offending keys named) rather than
silently passing on a missing or corrupt entry.

## Results

Recorded on 2026-09-24 from the migration branch (full numbers: `fixtures/manifest.json`,
`results/*.json`).

### Corpus

| Source | Fixtures | Ops |
|---|---:|---:|
| unit | 4,088 | 206 |
| data | 10,123 | 31 |
| conformance | 826 | 8 |
| **total** | **15,037** (from 27,577 recorded calls; 615 blobs) | |

Largest op families (fixtures, all sources): Serializer 3,621; ModelManager 2,988; ClassDeclaration 1,670;
DecoratorManager 1,542; Factory 1,444; Declaration 1,340; Property 778; ModelFile 579; Field 263;
Typed 141; ModelUtil 127; Resource 125. 2,080 fixtures record an error outcome; 516 carry `env.random`;
79 carry `effects`. Per-op counts per source are in `fixtures/manifest.json` (`by_source`).

Skipped calls: 1,000 in the unit source (0 in data and conformance), e.g. 236 on tainted model managers,
138 on declarations built outside a model file, 126 on validators not owned by their field, 90 on
properties built outside a declaration, 75 cycles, 73 while a `ModelUtil` function was stubbed,
63 with function arguments, 27 async results, 19 while the CTO parser was stubbed.

### Replay against the frozen reference

`results/replay-reference.json`: **15,037 / 15,037 pass (100%)**, 0 fail, 0 harness errors
(unit 4,088/4,088, data 10,123/10,123, conformance 826/826). The corpus also replays 100% against the
workspace `src/` (the coverage run below).

### Coverage of the reference with the corpus as the only driver

nyc over `packages/concerto-core/src`, driver `bin/replay.js --engine src`:

| Metric | Corpus only | Unit suite (this run; = `baseline.json`) | Thresholds |
|---|---:|---:|---:|
| Statements | 87.77% (2922/3329) | 98.95% (3306/3341) | 99 |
| Branches | 80.92% (1485/1835) | 95.80% (1758/1835) | 94.8 |
| Functions | 88.36% (539/610) | 99.18% (605/610) | 99 |
| Lines | 87.66% (2870/3274) | 98.96% (3252/3286) | 99 |

The statement/line totals differ slightly between the two runs because nyc `all: true` counts files that a
run never loads without their source map (the suite run loads every file). Branch and function totals agree.

`coverage-gaps.json` lists all 350 uncovered branches (279 of them are covered by the unit suite) with file,
line, type and location, and per file the uncovered statement lines and functions. The largest gaps are
`introspect/modelfile.ts` (37), `introspect/stringvalidator.ts` (34), `serializer/jsonpopulator.ts` (33),
`basemodelmanager.ts` (30), `introspect/numbervalidator.ts` (28), `introspect/collectionsizevalidator.ts` (23),
`serializer/jsongenerator.ts` (22), `serializer/resourcevalidator.ts` (22), `serializer/valuegenerator.ts` (17)
and `modelloader.ts` (16, async, not recorded). Most are reached in the unit suite only through stubs
(validators built on stub fields, populators and generators driven with fake parameters): these are the
lifting tasks of plan §2.3 (P2-10).

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
