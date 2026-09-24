# Lifted fixtures (task P2-10)

Black-box replacements for the white-box (W) unit tests listed in
`migration/ledger/SUMMARY.md` §10 (272 tests across 24 files). See
`accordproject/concerto-rust#54` for the task and `accordproject/concerto-rust#29`
§2.3 for the plan.

## Status: in progress, not complete

**`serializer/jsonpopulator.js` is done (65 of 65 W tests): 58 lifted, 7
listed `not-liftable`** in `MAP.tsv`, with a reason for each. The whole
corpus (`record-all.sh`: unit + data + conformance) was rebuilt end to end
with these fixtures folded in and replays 100% against both `src` and the
frozen reference, with the before/after coverage numbers the exit
condition asks for (see "Whole-corpus coverage" below). The other 23 files
in SUMMARY.md §10 (207 W tests) are not yet lifted, and this PR does not
claim the exit condition of the parent issue (accordproject/concerto-rust#54)
is met. Per the issue's own allowance ("If the work is large, it may land
as several PRs, one or more test files each"), this is the first file
completed; `MAP.tsv` will grow with each follow-up.

### The 7 `not-liftable` tests

All 7 are genuinely internal wiring that the public `Serializer.fromJSON`
API cannot reach, confirmed by trying and recording what the reference
actually does (never assumed):

* **`#visit` unrecognised-type dispatch** (1 test) — `visit()`'s fallthrough
  `throw` only fires when `thing` has none of `isClassDeclaration`/
  `isMapDeclaration`/`isRelationship`/`isTypeScalar`/`isField`; every real
  caller only ever passes a real `Declaration`/`Field`.
* **3 "root object path injection" tests** (`#visit`, `#visitField`,
  `#visitClassDeclaration`) — `parameters.path` is seeded internally by
  `JSONPopulator` itself and is not one of `Serializer.fromJSON`'s public
  options.
* **`#visitRelationshipDeclaration` "get the relationship namespace if
  required"** — only reachable by stubbing
  `relationshipDeclaration.getFullyQualifiedTypeName()` to return an
  unqualified name; a relationship's real target is never a primitive, so
  `ModelFile#getFullyQualifiedTypeName()` always returns a namespace-
  qualified name through the public API.
* **2 "create/accept a relationship from an object if permitted" tests**
  (single and array) — verified against the reference: with
  `acceptResourcesForRelationships: true`, `JSONPopulator` does return the
  embedded sub-`Resource`, but assigning it to the outer field re-triggers
  the outer object's own live `ValidatedResource` property setter (built by
  `Factory#newResource` without `disableValidation`, which
  `Serializer.fromJSON` never sets). That setter's `ResourceValidator` is
  constructed bare (no `permitResourcesForRelationships`), so it rejects
  the `Resource` with a `ValidationException` before `fromJSON` can return
  — a different, real behaviour from the reference, not the W test's
  stubbed "no live validation" outcome. See `MAP.tsv` for the full note.

## How a scenario is defined and recorded

Each `*.scenarios.js` file in this directory exports an array of
`{ id, model, json, options }` objects: a CTO model, a JSON payload, and
`Serializer.fromJSON` options. `drivers/lifted.spec.js` builds a
`ModelManager`/`Factory`/`Serializer` for each distinct model and calls
`serializer.fromJSON(json, options)` for every scenario — the same public
entry point the original sinon-stubbed test called `JSONPopulator` methods
directly. `options.validate: false` is used throughout so a scenario
exercises `JSONPopulator`'s own rules, not `ResourceValidator`'s (a
separate ledger member with its own W tests, lifted separately).

The driver never asserts — like `drivers/data.spec.js` and
`drivers/conformance.spec.js`, it only exercises the call so the recorder
(`ORACLE_SOURCE=lifted`) captures whatever the reference actually does as
the fixture. Record and replay it directly (this repo's own copy of the
corpus is not built by this PR; `fixtures/` is generated and gitignored):

```
cd packages/concerto-core
TS_NODE_PROJECT=tsconfig.build.json TZ=UTC ORACLE_BLOB_DIR=<work>/blobs \
  ORACLE_SOURCE=lifted ORACLE_RAW_DIR=<work>/raw \
  npx mocha -r ts-node/register -r ../../migration/oracle/lib/recorder.js \
  -t 10000 --reporter dot ../../migration/oracle/drivers/lifted.spec.js

node ../../migration/oracle/bin/build-corpus.js \
  --raw <work>/raw --blobs <work>/blobs --out <work>/fixtures

node ../../migration/oracle/bin/replay.js --engine reference --fixtures <work>/fixtures
node ../../migration/oracle/bin/replay.js --engine src        --fixtures <work>/fixtures
```

## Verification done for the 58 lifted (jsonpopulator.js)

* Every scenario's outcome (`ok`/`throw`, and error class/message for the
  throws) was checked by hand — and, for the 17 new ones added to complete
  the file, by running them directly against `src/` outside the recorder
  first — against the intent of the W test it replaces before recording.
  Three candidate scenarios (the map-deserialise case, and the two
  "permitted" relationship cases) turned up real reference behaviour that
  diverged from the W test's stubbed assertion; the map case was fixed by
  supplying the required identifier, and the two relationship cases were
  reclassified `not-liftable` (see above) rather than recorded with a
  different outcome than the rule they were meant to exercise.
* Recorded against the reference: 64 raw records -> 60 deduplicated
  fixtures, 0 skipped, 0 tainted.
* Replay: **60/60 pass (100%)** against both the frozen reference
  (`--engine reference`) and the workspace `src/` (`--engine src`).
* Corpus-only coverage of `packages/concerto-core/src/serializer/jsonpopulator.ts`
  from these 58 fixtures alone (`replay.js --engine src` under nyc,
  `--include src/serializer/jsonpopulator.ts`): **86.06% statements /
  80.00% branches / 100% functions / 85.85% lines** (173/201, 100/125,
  16/16, 170/198). All 65 W tests in the file, run directly (sinon stubs)
  under the same nyc configuration, cover **91.54% statements / 84.80%
  branches / 100% functions / 91.41% lines** (184/201, 106/125, 16/16,
  181/198) — the gap is exactly the 7 `not-liftable` tests: the `#visit`
  dispatch fallthrough and the relationship-namespace fallback are branches
  no public-API call can reach, and the two "permitted" relationship tests'
  own branch is reached right up to the point where the outer
  `ValidatedResource` assignment throws, one statement short of "returns
  the sub-Resource".

## Whole-corpus coverage of the reference, before and after this PR

Per the parent issue's exit condition ("Report the corpus-only coverage of
the reference before and after"), built with `record-all.sh` (unit + data +
conformance; `CONFORMANCE_DIR` pointed at a `concerto-conformance` checkout,
since the driver's built-in default does not exist outside its original
container) run once for a clean `<work>` dir, then merged twice with
`build-corpus.js`: once as the corpus stood before this PR (no `lifted/`
driver), once with `drivers/lifted.spec.js`'s 60 recorded jsonpopulator.js
fixtures folded in (59 of the 60 are new to the corpus; 1 -- a bare
`ModelManager.new` with no constructor args -- was already present from
other tests), both replayed under nyc (`--engine src`) against
`packages/concerto-core/src`:

* **Before**: 15,040 fixtures (unit 4,091 / data 10,123 / conformance 826).
  Corpus-only coverage of `packages/concerto-core/src` (whole repo):
  **87.77% statements (2,922/3,329), 80.92% branches (1,485/1,835), 88.36%
  functions (539/610), 87.66% lines (2,870/3,274)**. Replay against `src`:
  15,040/15,040 pass (100%), 0 harness errors.
* **After** (+ 59 new fixtures from this PR's `jsonpopulator.js` lift):
  15,099 fixtures. Corpus-only coverage: **88.43% statements (2,944/3,329),
  82.12% branches (1,507/1,835), 88.36% functions (539/610), 88.33% lines
  (2,892/3,274)** -- statements, branches and lines each gain exactly 22
  covered units over "before" (functions unchanged: no new function is
  reached for the first time, only new branches inside functions the
  corpus already reached). Replay against `src`: 15,099/15,099 pass (100%),
  0 harness errors.
* Replay of the "after" corpus against the frozen reference
  (`--engine reference`): **15,099/15,099 pass (100%), 0 harness errors.**
  (Whole-corpus replay was 100% before this PR too, since it only adds
  fixtures; this PR does not change or remove any existing
  fixture-producing test.)

This is whole-corpus coverage of `packages/concerto-core/src` (all files),
not scoped to `jsonpopulator.ts` — the "Verification done" section above
answers that narrower, file-scoped question. The whole-corpus "after"
number moves only slightly, since 59 new fixtures are a small fraction of
the full corpus (15,099); the point of this measurement is the exit
condition's own requirement to report it, and to confirm the addition
doesn't regress whole-corpus replay.

## Not yet attempted

* The other 23 files in SUMMARY.md §10 (207 W tests), largest next:
  `introspect/stringvalidator.js` (45), `serializer/resourcevalidator.js`
  (45), `introspect/numbervalidator.js` (27, note 6 of these are listed
  `not-liftable` already in SUMMARY.md §11), `serializer/jsongenerator.js`
  (22), `modelmanager.js` (21), and the rest.

None of these are marked `not-liftable` here — that determination (per the
issue) needs the same per-test read this PR gave `jsonpopulator.js`'s
remaining tests; it has not been redone for any other file.
