# Lifted fixtures (task P2-10)

Black-box replacements for the white-box (W) unit tests listed in
`migration/ledger/SUMMARY.md` §10 (272 tests across 24 files). See
`accordproject/concerto-rust#54` for the task and `accordproject/concerto-rust#29`
§2.3 for the plan.

## Status: in progress, not complete

**39 of 272 W tests lifted so far** (all of `serializer/jsonpopulator.js`'s
`#convertToObject` and `#convertItem` groups; see `MAP.tsv`). The remaining
226 W tests across 23 files — including the rest of `jsonpopulator.js`
itself (`#visit`, `#visitField`, `#visitClassDeclaration`,
`#visitRelationshipDeclaration`, 26 tests) — are not yet lifted, and this PR
does not claim the exit condition of the parent issue is met. Per the
issue's own allowance ("If the work is large, it may land as several PRs,
one or more test files each"), this is the first such PR; `MAP.tsv` will
grow with each follow-up.

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

## Verification done for the 39 lifted so far

* Every scenario's `attempt(() => serializer.fromJSON(...))` outcome
  (`ok`/`throw`, and error class/message for the throws) was checked by
  hand against the intent of the W test it replaces before recording.
* Recorded against the reference: 43 raw records -> 42 deduplicated
  fixtures (`ModelManager.new` x1 after dedup, `ModelManager.addCTOModel`
  x2, `Serializer.fromJSON` x39), 0 skipped, 0 tainted.
* Replay: **42/42 pass (100%)** against both the frozen reference
  (`--engine reference`) and the workspace `src/` (`--engine src`).
* Corpus-only coverage of `packages/concerto-core/src/serializer/jsonpopulator.ts`
  from these 39 fixtures alone (`replay.js --engine src` under nyc,
  `--include src/serializer/jsonpopulator.ts`): **56.21% statements /
  52.00% branches / 75.00% functions / 56.06% lines**. The 39 W tests they
  replace, run directly (sinon stubs, same file scoped with
  `mocha --grep`) under the same nyc configuration, cover **51.74%
  statements / 51.20% branches / 75.00% functions / 52.02% lines** of the
  same file — i.e. the lifted fixtures reach very slightly *more* of
  `jsonpopulator.ts` than the tests they replace (they also exercise
  `Serializer.fromJSON`'s and `visitClassDeclaration`'s own code around the
  populator, which the sinon-based calls bypassed).
* This is a narrow, file-scoped measurement, not the whole-corpus
  before/after coverage the parent issue's exit condition asks for — that
  needs the full corpus built by `record-all.sh` (unit + data +
  conformance, ~15k fixtures), which this PR does not build. A later PR
  that completes or substantially extends the lift should report that
  number.

## Not yet attempted

* The rest of `jsonpopulator.js` (26 W tests: `#visit`, `#visitField`,
  `#visitClassDeclaration`, `#visitRelationshipDeclaration`).
* The other 23 files in SUMMARY.md §10, largest next:
  `introspect/stringvalidator.js` (45), `introspect/numbervalidator.js` (27,
  note 6 of these are listed `not-liftable` already in SUMMARY.md §11),
  `serializer/jsongenerator.js` (22), `modelmanager.js` (21), and the rest.

None of these are marked `not-liftable` here — that determination (per the
issue) needs the same per-test read SUMMARY.md §10/§11 already gives for
`introspect/numbervalidator.js`, `introspect/scalars.js`,
`introspect/stringvalidator.js`, `introspect/modelfile.js` and
`scripts/jsonsignaturegenerator.js`; this PR did not re-derive it for any
new file.
