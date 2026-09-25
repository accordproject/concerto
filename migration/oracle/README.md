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
                  encodable.js language-neutral kinds for arguments that are code in JS: filter
                               predicates and decorator factories (task accordproject/concerto-rust#94)
                  canon.js     canonicalisation (sorted keys, <uuid>, <now>)
                  store.js     content-addressed blob store
                  env.js       determinism envelope (seeded Math.random, clock separation)
                  recorder.js  mocha --require hook that records fixtures
                  adapter.js   engine adapter contract, and the adapter for any JS build of concerto-core
                  judge.js     replay and verdicts
                  rust-adapter.js  the Rust/WASM engine: workspace src/ with CONCERTO_ENGINE=rust (P0-04b trial)
drivers/          data.spec.js (test/data, test/1.0.0), conformance.spec.js (concerto-conformance),
                  gaps.spec.js (task P2-11: targeted inputs closing coverage-gaps.json branches;
                  task accordproject/concerto-rust#94 added predicates, factories, async ops),
                  lifted.spec.js (task P2-10: runs lifted/*.scenarios.js),
                  unit-setup.js (global chai set-up for per-file unit runs)
lifted/           task P2-10: black-box scenarios replacing white-box unit tests (see lifted/README.md)
bin/              record-all.sh, build-corpus.js, replay.js, coverage.sh, coverage-gaps.js, self-check.js,
                  cto-cache.js (P0-04b trial version, kept as-is, not used by anything else any more),
                  build-cto-cache.js (CTO -> AST cache for the native Rust harness, OD-9; task P1-07a)
fixtures/         the corpus: <source>/<op>/<id>.json, blobs/, manifest.json
cto-cache/        the CTO -> AST cache: <aa>/<sha256>.json (generated; see "CTO -> AST cache" below)
results/          replay-reference.json, coverage.json, self-check.json, cto-cache.json
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
| Gaps against the suite on the reference's source (while `src/` differs from v5.0.0, see "Coverage") | run the unit suite under nyc over a copy of `packages/concerto-core` with `src/` from `git archive v5.0.0`, then `node migration/oracle/bin/coverage-gaps.js` with `--corpus`, `--corpus-summary`, `--corpus-src`, `--corpus-src-summary` from `<work>` and `--suite`, `--suite-summary` from that run |
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
  (a custom `processFile`, non-plain options, `addDecoratorFactory` with a factory that is not an encodable
  kind, `updateExternalModels` (async: the call itself is recorded, but a replayed recipe cannot await it),
  a mutation made inside another op, a step whose arguments were not plain);
* the result of an op that is not an async op is a promise (`async-result`);
* an async op reads a file by an absolute path or one that leaves the working directory
  (`nonportable-path`), or a fetch it made failed without a response (`network-error`).

Async ops (`lib/ops.js` `async: true`, task accordproject/concerto-rust#94: `ModelLoader.loadModelManager`,
`ModelLoader.loadModelManagerFromModelFiles`, `ModelManager.updateExternalModels`) are recorded when their
promise settles; the outcome is the settled value or the rejection. An `AsyncLocalStorage` scope marks every
call made on the op's behalf after an `await`, so those calls are nested exactly like the ones it makes
synchronously. While the op runs, the recorder wraps `globalThis.fetch` and keeps every response
(`inputs.net`), and it reads the local files the op will read (`inputs.fs`). A model manager an async op
creates is never a `derived` recipe (a replayed recipe cannot await). Instead its recipe is its
constructor plus the state-changing calls the op makes on it, recorded as steps as if the op's code had
made them at the top level; an async call on it (`updateExternalModels`) taints it.

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
* Async ops only (task accordproject/concerto-rust#94): `inputs.fs` maps each relative path the op reads to
  the file's contents (UTF-8), and `inputs.net` maps each URL the op fetched to `{"status": <HTTP status>,
  "body": <text>}`. A harness writes `fs` into a fresh directory that is the op's working directory, and
  answers every fetch from `net`. The recorder keeps every URL the reference fetched, so an engine that
  fetches any other URL has diverged (a failure); a malformed `fs` or `net` is a harness error.
  The outcome of an async op is what its promise settles to.
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
| `declnew` | a declaration built by a recorded constructor op, not part of its model file: `{cls: "ScalarDeclaration", mf, ast}`, rebuilt as `new ScalarDeclaration(mf, ast)` |
| `predicate` | a filter predicate over a declaration: `{kind: "fqn-in", names}` is true when the declaration's fully qualified name is in `names` |
| `decoratorfactory` | a `DecoratorFactory`: `{kind: "base"}` is the exported base class (its `newDecorator` throws `Error('abstract function called')`); `{kind: "names", names}` returns `new Decorator(parent, ast)` when `ast.name` is in `names`, and `null` otherwise |
| `factory`, `serializer`, `introspector` | rebuilt from their model manager (and the serializer's default options) |
| `typed` | a Resource, ValidatedResource or Relationship: its handles plus every own property in order |
| outcome only: `ModelManager`, `ModelFile`, `Declaration`, `Property`, `Decorator`, `Validator`, `object`, `function`, `throws` | summaries of handles returned by an op (e.g. a model manager's full AST) |

A model manager recipe's `steps` are the state-changing public calls made on it, in order:
`{method, args, status: ok|error, errorClass}`. Replaying a recipe re-runs the steps; a step whose
status or error class differs from the recorded one is a **state divergence**, reported as a failure.
`addDecoratorFactory` is a step when its argument is a `decoratorfactory` kind.

The `predicate` and `decoratorfactory` kinds (task accordproject/concerto-rust#94, `lib/encodable.js`) stand
for arguments that are code in JavaScript. A driver builds them with `encodable.predicate(...)` and
`encodable.decoratorFactory(core, ...)`, which register the value with its encoding; the encoder accepts a
function or factory only when it is registered (or is the bare base `DecoratorFactory`), so an encoding
always describes the whole behaviour. Any other function or factory stays unrecordable (`nonplain:function`,
`nonplain:decoratorfactory:<class>`). Each kind is defined by what it does, not by JavaScript, so a native
harness implements it directly: a predicate is a set of fully qualified names, and a factory is "fail" or
"a plain decorator for these names".

## Ops

`lib/ops.js` is the single list. Families (op name = `<Class>.<method>`):

| Family | Ops |
|---|---|
| Model managers | `ModelManager.new`, `BaseModelManager.new`, `AstModelManager.new`; steps `addModel`, `addCTOModel`, `addModelFile`, `addModelFiles`, `updateModelFile`, `deleteModelFile`, `clearModelFiles`, `fromAst`, `validateModelFiles`, `addDecoratorFactory`; async `updateExternalModels` (its effect on the model manager is `effects.target`); queries `validateModelFile`, `getType`, `resolveType`, `getAst`, `getModels`, `getNamespaces`, `derivesFrom`, `isAssignableTo`, `getAssignableConcreteTypes`, `resolveMetaModel`, `get*Declarations`, `getDecoratorValidation`, `filter` (with a `predicate`), `writeModelsToFileSystem` (only with no directory) |
| Model files | `ModelFile.new`, `validate`, `getType`, `resolveType`, `isLocalType`, `isImportedType`, `resolveImport`, `getFullyQualifiedTypeName`, `getLocalType`, `isDefined`, and every other public accessor |
| Model loader | async `ModelLoader.loadModelManager`, `ModelLoader.loadModelManagerFromModelFiles` |
| Introspection | `ScalarDeclaration.new` (the exported constructor; its result is a `declnew` input); every public method of `Declaration`, `ClassDeclaration` and subclasses, `MapDeclaration`, `ScalarDeclaration`, `Property`, `Field`, `RelationshipDeclaration`, `EnumValueDeclaration`, `MapKeyType`, `MapValueType`, `Decorated`, `Decorator`, the validators, `Introspector` |
| Instances | `Factory.newResource/newConcept/newRelationship/newTransaction/newEvent`, `TypeNotFoundException.new` (recorded as an error value), `Serializer.new` (the constructor; a successful one is summarised as `{"@@oracle":"object","ctor":"Serializer"}`), `Serializer.fromJSON/toJSON`, `Resource.validate/setPropertyValue/addArrayValue/instanceOf/toJSON`, `Typed`/`Identifiable`/`Resource`/`Relationship` accessors, `Relationship.fromURI` |
| Statics | every `ModelUtil` static, every `DecoratorManager` static, `MetaModel.newMetaModelManager/validateMetaModel/modelManagerFromMetaModel`, `DcsConverter.jsonToYaml/yamlToJson`, `DateTimeUtil.setCurrentTime` |

## Adding an engine adapter

An adapter is a module exporting `createAdapter()` that returns:

```js
{
  name: 'rust-wasm',
  run(op, inputs) {
    // inputs: fixture inputs with every blob resolved
    // return { outcome, window } (or, for an async op, a promise of it) where
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
5. For an async op, run it inside `inputs.fs` and `inputs.net` (see "Fixture schema") and report what it
   settles to. An engine without async APIs runs the op to completion and reports its result the same way.

`lib/adapter.js` `coreAdapter(core)` is the adapter for any JS build of concerto-core; `referenceAdapter()`
uses `reference/node_modules/@accordproject/concerto-core` and `srcAdapter()` the workspace `src/`.

Verdicts: `pass` (canonical outcomes identical), `fail` (different outcome, state divergence, input
construction failed, unsupported op), `harness-error` (fixture or blob missing, unreadable or malformed).
A harness error is never a pass.

## CTO -> AST cache for the native harness

CTO parsing lives in `concerto-cto`, which stays out of the Rust port, so a native (`cargo test`) harness
cannot itself turn a fixture's CTO text into a model. 14,018 of the corpus' 15,040 fixtures have CTO text as
input -- a `ModelManager` recipe with a step, or a fixture whose own recorded op is, one of the five methods
that reach `ctoProcessFile`: `addCTOModel`, `addModel`, `addModelFiles`, `updateModelFile` or
`validateModelFile` -- `bin/build-cto-cache.js` (task P1-07a, PORTING.md OD-9) pre-parses all of them with the
frozen reference `concerto-cto` 5.0.0 -- the same parser the corpus was recorded with -- and writes the
result to a cache the harness can look entries up in without ever running a JS process itself. (The issue
that scoped this task quoted 13,006 of 15,037, counting only `addCTOModel`; see "Reconciling the 13,006
figure" below for how the two numbers relate.)

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
`ModelManager` recipe (`"@@oracle":"mm"`), whose steps are read directly, including one reached only through
a `derived` spec; and a fixture (or nested `derived` spec) whose own `op` *is* one of the five entry points
below, whose `inputs.args` are the call's own arguments rather than a step in some other op's target. Both
shapes are collected only when the owning recipe's `kind` is `ModelManager` -- `BaseModelManager` and
`AstModelManager` inherit the same method names, but their `processFile` never runs `Parser.parse`, so a
string argument there is AST-shaped input, not CTO text.

`ModelManager` has five entry points into `ctoProcessFile`, all read by `CTO_ENTRY_POINTS` in
`bin/build-cto-cache.js`:

| Method | CTO text | File name | Step? |
|---|---|---|---|
| `addCTOModel(cto, fileName?, disableValidation?)` | `args[0]` | `args[1]` | yes |
| `addModel(modelInput, cto?, fileName?, disableValidation?)` | `args[0]` (`processFile` parses `modelInput`, not the convenience `cto` argument) | `args[2]` | yes |
| `addModelFiles(modelFiles, fileNames?, disableValidation?)` | each string element of `args[0]` | the same-index element of `args[1]` | yes |
| `updateModelFile(modelFile, fileName?, disableValidation?)` | `args[0]`, when a string | `args[1]` | yes |
| `validateModelFile(modelFile, fileName?)` | `args[0]`, when a string | `args[1]` | no -- a query, never a recipe step |

`addModelFile(modelFile, cto?, fileName?, disableValidation?)` is excluded: `modelFile` is always an
already-built `ModelFile`, never a string, so it never reaches `processFile`.

The P0-04b trial generator (`bin/cto-cache.js`) only read `addCTOModel` steps and `op === addCTOModel`
fixtures. The first release of this generator (P1-07a) added `op === addCTOModel` fixtures on top of that
but still missed the other four entry points: on the canonical corpus (see "Reconciling the 13,006 figure"
below), 1,012 more fixtures reach `addModel`, `addModelFiles`, `updateModelFile` or `validateModelFile` with
string CTO; after deduplicating against the generator's own keys, 38 more `(cto, fileName,
skipLocationNodes)` keys were needed, so a native harness replaying those fixtures would hit a harness error
even though `--check` reported every collected key present (it only ever checks what the generator itself
collects). Reading through all five entry points closes that gap.

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
  "fixturesScanned": 15040, "fixturesWithCto": 14018, "uniqueCtoTexts": 509,
  "entries": { "ast": 486, "error": 23, "total": 509 },
  "written": 509, "reused": 0,
  "contentHash": "<sha-256 over every entry's own sha-256, sorted by key>"
}
```

`fixturesWithCto` is what the exit condition calls "the CTO-dependent fixtures": every fixture whose
resolved inputs reached at least one of the five `CTO_ENTRY_POINTS` calls, of either shape above, on a
`ModelManager`. It tracks the corpus present at generation time, so it moves as the corpus grows (P2-10 and
P2-11 add fixtures under `fixtures/lifted` and `fixtures/gaps`); a manifest whose `fixturesWithCto` differs
from the 13,006 the issue and this file's earlier corpus snapshot record carries a `note` saying so, rather
than silently disagreeing with it.

**Reconciling the 13,006 figure.** 13,006 counted only fixtures reaching `addCTOModel`. On the canonical
`unit`+`data`+`conformance` corpus (no `fixtures/lifted`, no `fixtures/gaps`), this generator reproduces
that figure exactly when it is scoped to just that one entry point -- checked directly by reverting the
entry-point fix and re-running against the same recorded corpus. Reading all five entry points instead
(the fix for the gap described above) raises the count on that same corpus to 14,018: 1,012 more fixtures
reach `addModel`, `addModelFiles`, `updateModelFile` or `validateModelFile` with CTO text, and 38 more
unique `(cto, fileName, skipLocationNodes)` keys are needed (509 total, up from 471). The corpus itself
also moved slightly since the snapshot the issue and README recorded: a fresh recording from this branch's
own `packages/concerto-core/src` gives 15,040 fixtures (unit 4,091, data 10,123, conformance 826) against
the earlier 15,037 (unit 4,088) -- a 3-fixture difference in `unit` alone, within the recorder's normal
run-to-run variance in this environment, and not from `fixtures/lifted` or `fixtures/gaps` (both excluded
from this corpus). `contentHash`
lets a stale or corrupted cache be detected -- for example after a partial rebuild was interrupted -- without
diffing the (git-ignored) cache directory itself: `--check` (existence and readability of every needed
entry) and `--verify` (every needed entry re-parsed fresh and compared byte for byte to what is cached) are
the two ways to detect that, and both fail loudly (non-zero exit, the offending keys named) rather than
silently passing on a missing or corrupt entry.

## Determinism of the recorder, and the pinned canonical corpus

**The canonical corpus, `oracle-corpus-p107-06aa375` (recorded from `accordproject/concerto@06aa375a6`,
content hash `7b9be1de66690be63e689b3bf0feb4583ed6cd9597099fdec1acb32f87736e71`), is pinned permanently.**
Re-recording it, at this or any later commit, needs the maintainer's explicit approval, because a second
corpus that disagrees with `concerto-core/tests/oracle/baseline.tsv` on fixture ids makes the baseline
ping-pong between whoever last recorded it (accordproject/concerto-rust#113). This directory's recorder is
not fully deterministic (below); until it is, or until a re-recording is explicitly approved, the corpus in
use stays this one build, not a fresh recording, however faithfully reproduced.

accordproject/concerto-rust#113 asked whether `bin/record-all.sh` (and `bin/build-cto-cache.js`) produce the
same fixture ids and contents when run twice from the same commit, on different machines/JOBS. Two clean
worktrees of `06aa375a6` were recorded independently (`JOBS=4` and `JOBS=2`) and diffed fixture-by-fixture
and as a corpus-wide content hash, the same way `manifest.json`'s hash is defined. Three real,
machine/run-dependent sources of nondeterminism were found and fixed on this branch:

1. **Absolute `fileName` arguments** (fixed in `lib/recorder.js`). A `ModelFile` constructed, or a
   `ModelManager` step (`addCTOModel`/`addModel`/`addModelFile`/`addModelFiles`/`updateModelFile`/
   `validateModelFile`) called, with an absolute `fileName` (tests using a `__dirname`-derived path, e.g.
   `test/introspect/metamodel.js`, and the conformance driver's `new ModelFile(mm, ast, undefined, path)`)
   baked the *recording machine's own checkout path* into fixture/blob content -- confirmed directly
   against the canonical corpus, which carries a literal `/Users/matt/dev/gh/accordproject/concerto-migration/...`
   path in 66 fixtures/blobs (32 found by a simple grep for `"fileName":"/..."`; the rest are the same root
   cause at a different string position or nesting depth, not individually re-verified here). `fileName`s
   under a known checkout root (the concerto repo, or `concerto-conformance` via `CONFORMANCE_DIR`) are now
   rewritten to a root-relative form; one outside every known root is tainted/skipped like any other
   nonportable path.
2. **`source_test` tie-break order** (fixed in `bin/build-corpus.js`). When two raw records deduplicate to
   the same fixture id with the same source rank, the dedup picked whichever raw `.jsonl` file the process
   happened to read first to decide the recorded `source_test` -- and raw filenames embed the recording
   process's PID, so that order differs on every run. The tie-break is now a deterministic sort on
   `source_test` text.
3. **`uuid.v4()` unseeded** (fixed in `lib/env.js`, plus a reseed in `drivers/data.spec.js`). `Factory`'s
   default identifier for an identified resource with no id given (`factory.ts`) draws from Node's crypto
   RNG via `uuid.v4()`, not `Math.random`, so it sat outside the recorder's seeded envelope entirely: every
   `Factory.newResource`/`newRelationship` fixture with a generated id differed on every recording.
   `seededRandom()` now also seeds `uuid.v4` (its own PRNG stream); `data.spec.js`'s `generate: 'sample'`
   calls reseed explicitly around themselves, because they build another op's *input*, outside any op's own
   recorded window.

After these three fixes, every unit-source fixture they touched matched between the two recordings, and
`data`-source duplicate fixtures dropped from 10,234 to 10,044 fixtures (the uuid-driven duplicates
collapsed). `JOBS` (4 vs 2) itself produced no observable difference once the three fixes above were
applied: each unit test file already runs as its own isolated mocha process, so `JOBS` only changes how
many run concurrently, not what any one of them records.

### Two residual causes, documented rather than fixed

The two recordings are still not byte-identical. Both remaining differences are real -- the recorded values
genuinely vary between runs -- and both are out of this task's safe scope (fixing either means editing a
protected `test/**` file, or a cross-op driver change with its own deadlock risk):

**(a) Values baked in by a protected `test/**` file.** A test file is allowed to embed a wall-clock- or
run-dependent literal directly in the data it hands to concerto-core, and the recorder has no way to
canonicalise that: canonicalisation only ever normalises a value the *op itself* generates (`lib/canon.js`),
never one supplied as input. A concrete, verified instance: `test/introspect/concertoVersion.js`'s
`'should return when concerto version is compatible with model with a pre-release version'` test builds
`` `${pkgJSON.version}-unittest.${new Date().getTime()}` `` and stubs `pkgJSON.version` to it before parsing
a model file, so the parsed `ModelFile.new`/`validate` fixture's input carries that run's wall-clock
millisecond count as part of a version string, and differs on every recording. `test/**` is never edited by
this task (and cannot be by any task without the maintainer's sign-off), so this class of residual cannot be
fixed from `migration/oracle` alone; it can only be catalogued as it is found. Earlier investigation
(accordproject/concerto-rust#113 comment history) also attributed part of the `Factory.newResource`/
`newRelationship` unit residual (of the order of 50 fixtures) to test-authored literal random ids feeding
`factory.newResource`/`newRelationship`, by analogy with the pattern above; a repo-wide grep of
`packages/concerto-core/test` for `Math.random`, `uuid.v4()`, `randomUUID` and `Date.now()`/`new Date()`
finds no other occurrence beyond `concertoVersion.js`, so that specific attribution is not independently
confirmed here and the exact mechanism for the rest of that residual is still open; it is documented as
unresolved rather than asserted.

**(b) Wall-clock values that cross from one op's outcome into a later op's input.** `drivers/data.spec.js`
builds a `Resource` via `serializer.fromJSON(json)` from JSON test data that has no `$timestamp` field;
concerto-core defaults `$timestamp` to the real wall-clock instant at population time. `fixtures/manifest.json`'s
outcome canonicalisation (`lib/canon.js`) only replaces an ISO date-time whose instant falls inside *that
op's own* recorded execution window and that does not already appear in *that op's own* inputs -- which is
correct for the op that generated it, `Serializer.fromJSON` itself. But `data.spec.js` goes on to pass that
same populated resource into further recorded ops (`Resource.validate`, `toJSON`, and similar) as their
*input*; from a later op's point of view, that timestamp is caller-supplied data, not something it
generated, so it is correctly left alone by canonicalisation and instead varies with wall-clock time between
recordings. This affects roughly 1,000 `data`-source fixtures (about 1,056 measured, `Resource.validate` and
similar ops that take an already-populated resource as an argument). A real fix needs a clock frozen for the
whole driver run (so every `fromJSON` in the same run defaults `$timestamp` to the same instant, matching
what a second run would also produce) -- which interacts with the recorder's own `waitPastInputInstants`
spin-wait (used to keep an op's *own* generated timestamp outside the window of any timestamp already in its
inputs) and needs a separate, careful change of its own. Not attempted here; left as a follow-up issue
(the frozen-clock work is explicitly out of scope for this task, per the maintainer's decision on
accordproject/concerto-rust#113).

Given the above, the exit condition is read as met in the sense the issue allows: the recorder is not yet
producing byte-identical corpora, but every difference class found is now either fixed (three bugs, above)
or precisely root-caused and out of safe scope to fix here, and the corpus stays pinned rather than
re-recorded while that holds.

## Results

Recorded 2026-09-24 (task P0-05), re-recorded by task P2-11 after merging P2-10 part 1 (`lifted/`), and
re-recorded end to end the same day by task accordproject/concerto-rust#94: `record-all.sh` (all five
sources, `JOBS=6`, concerto-conformance at 66a5e8bc), `coverage.sh --with-suite`, the unit suite over the
reference's own source (see "Coverage" below), both replays and `self-check.js`, in that order, on the
committed drivers. Full numbers: `fixtures/manifest.json`, `results/*.json`, `coverage-gaps.json`.

### Corpus

| Source | Fixtures | Ops |
|---|---:|---:|
| unit | 4,082 | 213 |
| data | 10,231 | 32 |
| conformance | 815 | 9 |
| gaps | 658 | 54 |
| lifted | 64 | 3 |
| **total** | **15,850** (from 28,927 recorded calls; 618 blobs) | |

Unit suite under the recorder: 1300 passing, 0 failing, 8 pending. The network test `ModelLoader
#loadModelFromUrl` (failing in `baseline.json`) passed, and is now recorded with the response it fetched
(`inputs.net`), so its fixture replays offline; recording it again needs the network.

New fixtures of task accordproject/concerto-rust#94, by op (source):

| Op | Fixtures |
|---|---:|
| `ModelManager.filter` (predicate `fqn-in`) | 20 (gaps) |
| `ModelManager.addDecoratorFactory` (and as a step in 26 other gaps fixtures) | 6 (gaps) |
| `ModelManager.updateExternalModels` | 6 (2 unit, 4 gaps) |
| `ModelLoader.loadModelManager` | 10 (1 unit, 9 gaps) |
| `ModelLoader.loadModelManagerFromModelFiles` | 7 (2 unit, 5 gaps) |
| `ScalarDeclaration.new` (and 31 calls on its result, `declnew`) | 13 (8 unit, 5 gaps) |

Some counts fell against the P2-11 corpus (`ModelFile.new` 211 to 196, `ModelManager.addModelFile` 107
to 92, `ModelManager.validateModelFiles` 385 to 376, a few `ModelUtil` statics). Those fixtures were calls
that `ModelLoader` makes after an `await`: with no async scope, the old recorder saw them as outermost
calls. They are now part of the `ModelLoader` op that makes them, and the model manager the loader builds
is rebuilt from its constructor and those calls as steps. The conformance count fell by 24 for the same
reason: `drivers/conformance.spec.js` loads models by absolute path, which is not portable
(`nonportable-path`, 15 calls).

Skipped calls: 885 in `unit` (tainted model managers, declarations built outside a model file,
validators not owned by their field, properties built outside a declaration, cycles, a stubbed `ModelUtil`
function, function arguments including 3 `filter` predicates, 2 decorator factories that carry code,
8 `updateExternalModels` calls given a stub `FileDownloader`, 23 `ModelLoader` calls with absolute paths,
a stubbed CTO parser, and 3 `writeModelsToFileSystem` calls given a real directory, skipped as
`writes-to-disk`), 15 in `conformance` (`nonportable-path`) and 1 in `gaps` (a P2-11 `filter` call with a
plain function predicate, `nonplain:function`).

### Replay

`results/replay-reference.json`: **15,850 / 15,850 pass (100%)** against the frozen reference, 0 fail,
0 harness errors. Against the workspace `src/`: also 15,850 / 15,850, 0 harness errors.

### Coverage with the corpus as the only driver

`bin/coverage.sh` replays the corpus under nyc twice. The primary run is against the **frozen reference**:
nyc instruments `reference/node_modules/@accordproject/concerto-core/dist/*.js` and remaps the counts
through the package's own source maps to `src/*.ts`. The second run, against the workspace `src/`
through ts-node, is a cross-check.

The workspace `src/` is no longer the reference's source: the P0-04b trial port (merged after P2-11) added
engine views to `modelutil.ts`, `introspect/numbervalidator.ts` and `introspect/scalardeclaration.ts`,
so those three files have a different branch map in `src/` (1,860 branches in all, against the
reference's 1,835). `coverage.sh` compares branches by id, so in those three files its cross-check reports
58 layout mismatches and 18 hit disagreements, and a unit suite run over `src/` cannot be compared with
the reference branch by branch (it reported one spurious "unexplained" gap,
`scalardeclaration.ts:134:12[0]`). The test files are unchanged since v5.0.0. So the unit-suite figures
below, and the `covered_by_suite` marks in `coverage-gaps.json`, come from the same suite command run over
a copy of `packages/concerto-core` whose `src/` is `git archive v5.0.0 packages/concerto-core/src`
(`TZ=UTC`, `nyc … mocha -r ts-node/register --recursive -t 10000 test/`), passed to `coverage-gaps.js` as
`--suite`/`--suite-summary`. That run gives exactly the P2-11 suite figures: 1300 passing, branches 95.80%
(1758/1835).

| Metric | Corpus → reference | Corpus → `src/` (P0-04b layout) | Unit suite → v5.0.0 `src/` |
|---|---:|---:|---:|
| Statements | 95.36% (3268/3427) | 97.88% (3292/3363) | 99.01% (3308/3341) |
| Branches | **95.85% (1759/1835)** | 95.86% (1783/1860) | **95.80% (1758/1835)** |
| Functions | 94.09% (574/610) | 94.09% (574/610) | 99.34% (606/610) |
| Lines | 95.31% (3214/3372) | 97.88% (3238/3308) | 99.02% (3254/3286) |

**Corpus-only branch coverage of the reference is now 95.85% (1759/1835), against the unit suite's
95.80% (1758/1835).** The corpus reaches every branch the suite reaches except the 12 below, and 13 the
suite does not. Statements, lines and functions stay below the suite's: the uncovered statements and
functions are mostly those only a stub or an internal call reaches (see "Remaining gaps").

History of corpus-only branch coverage: 80.92% (1485/1835) after P0-05; 88.99% (1633/1835) at the start of
P2-11; 92.86% (1704/1835) after P2-11; 95.85% (1759/1835) now.

Task accordproject/concerto-rust#94 closed all 53 branches that P2-11 handed to it, and 2 more the suite
does not cover:

| Group | Branches | Closed by |
|---|---:|---|
| `filter()` predicates: `basemodelmanager.ts` 914, 918; `modelfile.ts` 894–941 | 30 | `ModelManager.filter` with `fqn-in` predicates over models with ImportType, ImportTypes (with an alias), wildcard and system imports, imports of missing namespaces and types, a model file with no `imports`, and `disableValidation` on and off |
| `modelloader.ts` | 14 | `ModelLoader.loadModelManager` over a relative file (`inputs.fs`), `https://` and `github://` URLs (`inputs.net`), a 404, default, `null`, offline and online options; `loadModelManagerFromModelFiles` likewise |
| `updateExternalModels`: `basemodelmanager.ts` 457, 473 | 4 | `updateExternalModels` with the default downloader over served external imports: a new namespace, an existing one, none, and a 404 |
| Decorator factories: `decorated.ts` 107[0], 107[1], 112[1] | 3 | `addDecoratorFactory` steps with `names` factories |
| `decorated.ts` 104[0] (plan-owner decision) | 1 | `addDecoratorFactory` step with the `base` factory |
| `scalardeclaration.ts` 89[1] (plan-owner decision) | 1 | a new `ScalarDeclaration.new` op, with an AST that has no scalar `$class` |

Decisions on the two plan-owner items: `ScalarDeclaration.new` is now an op (the constructor is exported;
the declaration it builds is an input as a `declnew` recipe, so calls on it such as `getType()` are
recorded too), and `addDecoratorFactory` is a model manager step when its factory is an encodable kind.

### Remaining gaps

`coverage-gaps.json` lists all 76 branches the corpus does not reach on the reference. 12 of them are
covered by the unit suite, each with a verified reason from `gap-reasons.json`, and all handed to P2-10:

| Handed to | Category | Branches | Where |
|---|---|---:|---|
| P2-10 (accordproject/concerto-rust#54) | `internal-only` | 8 | `jsonpopulator.ts` 129, 171, 281, 363, 439; `valuegenerator.ts` 80, 102, 171 |
| P2-10 (accordproject/concerto-rust#54) | `stub-only` | 4 | `property.ts` 209, 213; `field.ts` 194; `relationshipdeclaration.ts` 79 |

No suite-covered branch is unexplained and no reason is stale.

### Judge self-check

`results/self-check.json` (`bin/self-check.js`), run on this corpus: baseline 15,850 / 15,850 pass,
0 fail, 0 harness errors; every seeded mutant is detected. The last five (task
accordproject/concerto-rust#94) each name the kind of fixture that must catch them, and count as detected
only when such a fixture fails.

| Mutant | Kind | Fixtures that flag it |
|---|---|---:|
| error-message-changed: IllegalModelException messages gain a full stop | adapter wrapper | 638 |
| verdict-flipped: `validateModelFiles` succeeds where the reference throws and vice versa | adapter wrapper | 376 |
| identifier-check-dropped: `ModelUtil.isValidIdentifier` always true | in-engine patch | 5 |
| abstract-check-dropped: `ClassDeclaration.isAbstract` always false | in-engine patch | 180 |
| canonical-result-altered: `Serializer.toJSON` results lose `$class` | adapter wrapper | 1,670 |
| error-class-swapped: TypeNotFoundException reported as Error | adapter wrapper | 285 |
| optional-field-rule-dropped: `Property.isOptional` always true | in-engine patch | 11,326 |
| datetime-shifted: DateTime values serialised 1 ms late | in-engine patch | 585 |
| filter-imports-unpruned: `filter` keeps every import whatever the predicate says | in-engine patch | 12 (all `ModelManager.filter`) |
| offline-flag-inverted: `ModelLoader` resolves external models offline, only validates online | in-engine patch | 4 (all `ModelLoader.*`) |
| async-rejection-swallowed: a rejected async op reported as resolving to undefined | adapter wrapper | 6 (3 `updateExternalModels`) |
| decorator-factories-ignored: `getDecoratorFactories` always empty | in-engine patch | 9 (all with an `addDecoratorFactory` step) |
| scalar-type-fallback-changed: a scalar with no scalar `$class` gets type String, not null | in-engine patch | 2 (both on a `ScalarDeclaration.new` result) |

Harness checks, all reported as `harness-error`: a fixture whose input blob is missing, a fixture without
inputs, a fixture file that does not exist, a fixture referencing an unknown blob, and an async fixture
whose network response is malformed.

## Known limits

* Logger output (e.g. decorator validation warnings) is not part of the outcome.
* A test that mutates concerto-core objects through non-API paths (assigning fields directly) after a
  recipe was captured would produce a fixture whose inputs no longer match; none occurs in this corpus
  (100% replay), and plain-function overrides of methods on tracked objects are detected and skipped.
* A function argument is recorded only when it is an encodable kind (`lib/encodable.js`): the unit
  suite's own `filter` predicates and its `DecoratorFactory` subclass carry code, so those calls stay
  unrecorded, and a model manager given such a factory is tainted. The `names` factory returns plain
  `Decorator`s, which are indistinguishable from the ones built without a factory; the `base` factory is
  what makes a factory's effect observable (and what the `decorator-factories-ignored` mutant needs).
* `updateExternalModels` is recorded, but a recipe cannot replay an async step, so the model manager it
  changed is tainted afterwards (its state after the call is `effects.target`). Likewise a model manager
  an async op returns is rebuilt from its steps only when the op made no async call on it: an online
  `ModelLoader` load calls `updateExternalModels`, so calls on its result stay unrecorded.
* A `FileDownloader` argument is code, so `updateExternalModels` is recorded with the default downloader
  only; its downloads come from `inputs.net`.
* Async ops that read files by absolute path (the unit suite's `ModelLoader` tests, the conformance
  driver) are skipped as `nonportable-path`; one that fetches with no response at all is skipped as
  `network-error`.
* `writeModelsToFileSystem` with a directory is never recorded (it would write files; only a call with no
  directory is recorded).
