# Lifted fixtures (task P2-10)

Black-box replacements for the white-box (W) unit tests listed in
`migration/ledger/SUMMARY.md` §10 (272 tests across 24 files). See
`accordproject/concerto-rust#54` for the task and `accordproject/concerto-rust#29`
§2.3 for the plan.

## Status: in progress, not complete

**`serializer/jsonpopulator.js` is done (65 of 65 W tests): 58 lifted, 7
listed `not-liftable`**, and **`introspect/stringvalidator.js` is done (45
of 45 W tests): 42 lifted, 3 listed `not-liftable`**, both in `MAP.tsv` with
a reason for each. The whole corpus (`record-all.sh`: unit + data +
conformance + gaps + lifted) was rebuilt end to end with both files' fixtures
folded in and replays 100% against both `src` and the frozen reference, with
the before/after coverage numbers the exit condition asks for (see
"Whole-corpus coverage" below). 162 W tests across 22 files are not yet
lifted (`introspect/numbervalidator.js` (27) is next, largest first), and
this PR does not claim the exit condition of the parent issue
(accordproject/concerto-rust#54) is met. Per the issue's own allowance ("If
the work is large, it may land as several PRs, one or more test files
each"), this is the second file completed; `MAP.tsv` will grow with each
follow-up.

### `stringvalidator.js`'s scenario shape

Unlike `jsonpopulator.js`, none of `StringValidator`'s own public methods
need to go through `Serializer.fromJSON` at all: `getValidator`, `validate`,
`getRegex` and `compatibleWith` are themselves recorded ops (see
`migration/oracle/lib/ops.js`, `INTROSPECTION_CLASSES`), so a scenario can
call them straight off a `Field` a real `ModelManager` built. Because of
that, `stringvalidator.scenarios.js` uses a different, more flexible entry
than `jsonpopulator.scenarios.js`'s plain `{model, json, options}` object:
each entry is `{ id, run(ctx) }`, and `drivers/lifted.spec.js` now runs
`run(ctx)` directly when a scenario has one (`ctx` is
`{ ModelManager, Factory, Serializer }`), falling back to the original
`Serializer.fromJSON` path for scenario files (jsonpopulator.js's) that
don't. Nine of the constructor scenarios load a one-off CTO model whose
String field carries the same `regex=`/`length=`/`default=` clause
combination the W test gave `new StringValidator` directly; one
(`SV-CTOR-002`, "no bound specified at all") needs `ModelManager#fromAst` on
a mutated, otherwise-valid AST instead, because CTO's own `length=[,]`
compiles to *absent* keys, never the explicit `{minLength: null, maxLength:
null}` the W test's stub-backed AST supplied — the same `fromAst`-on-a-
mutated-AST technique `drivers/gaps.spec.js` already uses for other
AST-shape edge cases.

### The 3 `not-liftable` tests (`stringvalidator.js`)

* **"should not leave lastIndex set on the regex it exposes"** — the
  oracle's RegExp encoding (`lib/codec.js` `encodeScalar`) stores only
  `{source, flags}`, never `lastIndex`, so no fixture can carry this
  assertion. The behaviour it guards — that a global/sticky regex does not
  leak match state between calls — is exercised anyway by the repeated-
  validate scenarios (`SV-VAL-004`, `SV-VAL-005`, `SV-VAL-006`).
* **Both "custom RegEx engine" tests** — `options.regExp` (e.g. `XRegExp`)
  is a function passed as a `ModelManager` constructor option. The oracle's
  input codec (`lib/codec.js` `encodePlain`/`encode`) throws
  `NonPlain('function')` for any function-valued input, so a `ModelManager`
  built with a custom `regExp` option can never be recorded — the
  `ModelManager.new` call itself is skipped and everything built from it is
  tainted. There is no public-API route to this option's effect that stays
  inside what the oracle can encode.

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

Each `*.scenarios.js` file in this directory exports an array of scenario
entries. `jsonpopulator.scenarios.js` uses the original plain
`{ id, model, json, options }` shape: a CTO model, a JSON payload, and
`Serializer.fromJSON` options. `drivers/lifted.spec.js` builds a
`ModelManager`/`Factory`/`Serializer` for each distinct model and calls
`serializer.fromJSON(json, options)` for every such scenario — the same
public entry point the original sinon-stubbed test called `JSONPopulator`
methods directly. `options.validate: false` is used throughout so a
scenario exercises `JSONPopulator`'s own rules, not `ResourceValidator`'s (a
separate ledger member with its own W tests, lifted separately).

`stringvalidator.scenarios.js` instead uses `{ id, run(ctx) }`: `run` is
called directly with `ctx = { ModelManager, Factory, Serializer }` and
drives whatever public calls the scenario needs (a `StringValidator` read
off a real `Field`, `fromAst`, and so on — see "stringvalidator.js's
scenario shape" above). `drivers/lifted.spec.js` runs `run(ctx)` for any
scenario that has one, and the plain shape otherwise, so both live in the
same file list and the same driver.

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

## Verification done for the 42 lifted (stringvalidator.js)

* Every scenario's outcome was checked by hand against the intent of the W
  test it replaces before recording, and by running the whole file directly
  against `src/` outside the recorder first (see this file's own
  construction: every constructor scenario's expected throw/no-throw was
  confirmed against the exact message regex the W test asserted; every
  `compatibleWith` scenario's expected `true`/`false` was confirmed against
  the rule its title states, and all 16 matched on the first try once the
  CTO field-clause order (`default=` before `regex=`/`length=`) was fixed).
* Recorded against the reference: 284 raw records -> 236 deduplicated
  fixtures, 0 skipped, 0 tainted. (An earlier version of this file recorded
  280 -> 234: SV-VAL-014 and SV-VAL-015 were not faithful lifts — see below
  — and fixing them adds the 4 extra raw records / 2 extra fixtures that
  `fromAst` on a mutated AST needs over the CTO text those two used before.)
* Replay: **236/236 pass (100%)** against both the frozen reference
  (`--engine reference`) and the workspace `src/` (`--engine src`).
* Corpus-only coverage of `packages/concerto-core/src/introspect/stringvalidator.ts`
  from these 236 fixtures alone (`replay.js` under nyc, `--include
  src/introspect/stringvalidator.ts`), against both the frozen reference and
  `src` (the two agree exactly): **98.43% statements / 97.33% branches /
  100% functions / 98.43% lines**. All 45 W tests in the file, run directly
  (sinon stubs) under the same nyc configuration, cover the exact same
  **98.43% statements / 97.33% branches / 100% functions / 98.43% lines** —
  this lift now matches the W suite's own coverage of the file exactly, with
  nothing narrowed. The one line neither suite covers is `matchesRegex`'s
  `if (!this.regex) return true` fallback (line 124), never reached by *any*
  test including the W ones, because `validate()` only calls `matchesRegex`
  when `this.regex` is already truthy.
* This corrects two earlier, unverified claims about this file. First,
  SV-VAL-014 and SV-VAL-015 used to build their field with CTO's
  `length=[,10]` / `length=[2,]`, which — confirmed with `Parser.parse` —
  leaves the omitted bound's key out of the AST entirely (`undefined`), not
  `null`; that only reaches the same `this.minLength !== null && ... value
  < this.minLength` fallthrough SV-VAL-013/SV-VAL-012 already exercise, not
  the constructor's `this.minLength === null || this.maxLength === null`
  branch (line 68) the W tests' own bare `{minLength: null, maxLength: 10}`
  / `{minLength: 2, maxLength: null}` objects reach directly. Both scenarios
  now go through `fromAst` on a mutated AST instead, the same technique
  SV-CTOR-002 already used for the both-bounds-null case, putting an
  explicit `null` on exactly one bound. Second, `SV-CW-007` ("should return
  false when the string length is changed") used to build its two fields
  with `length=[1,100]`/`length=[2,]`, values that don't match the W test it
  claims to replace (`other=VALID_MIN_LENGTH_AND_MAX_LENGTH_AST={minLength:1,
  maxLength:100}`, `v=NO_MIN_LENGTH_AST={maxLength:10}`) and so landed on a
  different `compatibleWith` branch (the `!isNull(thisMinLength) &&
  !isNull(otherMinLength)` min-length comparison at line 184, not the
  `isNull(thisMinLength) && !isNull(otherMinLength)` branch at line 182 the
  W test's own null/value combination reaches). `SV-CW-007` now uses
  `length=[,10]` / `length=[1,100]`, matching the W test's field values, and
  reaches line 182 as it should. Together these two fixes are what closes
  the coverage gap above from two lines to one: an nyc run of the *previous*
  version of these 236 fixtures (i.e. before this correction) was missing an
  arm at lines 68 and 182 in addition to line 124, confirmed by re-running
  nyc against both that version and the unmodified W suite side by side, not
  assumed.

## Whole-corpus coverage of the reference, before and after this PR

Per the parent issue's exit condition ("Report the corpus-only coverage of
the reference before and after"), built with `record-all.sh` (unit + data +
conformance + gaps + lifted; `CONFORMANCE_DIR` pointed at a
`concerto-conformance` checkout) run once for a clean `<work>` dir, then
merged twice with `build-corpus.js`: once as the corpus stood before this
PR (`lifted/` driver over `jsonpopulator.scenarios.js` only, i.e. the state
already on `origin/claude/tender-pascal-ocwf9q`), once with
`stringvalidator.scenarios.js`'s fixtures folded in too, both replayed
under nyc (`--engine src`) against `packages/concerto-core/src`:

* **Before**: 15,794 fixtures (unit 4,117 / data 10,231 / conformance 839 /
  gaps 543 / lifted 64). Corpus-only coverage of `packages/concerto-core/src`
  (whole repo): **94.81% statements (3,180/3,354), 92.84% branches
  (1,727/1,860), 91.47% functions (558/610), 94.78% lines (3,127/3,299)**.
  Replay against `src`: 15,794/15,794 pass (100%), 0 harness errors.
* **After**: `stringvalidator.scenarios.js` now records 236 fixtures (not
  234 -- see "Verification done" above), of which 235 are new to the corpus
  (the other, a bare `ModelManager.new` with no arguments, is identical
  content to one `unit` already recorded and stays attributed there by the
  source-priority dedup rule). **16,029 fixtures.** The two branches
  (stringvalidator.ts lines 68 and 182) this correction newly exercises
  *within the lifted bucket* were, on inspection, already exercised by the
  `gaps` driver's own `StringValidator` scenarios (`drivers/gaps.spec.js`,
  the `bothNullLen`/`minOnly` `compatibleWith` pair for line 182, and the
  `explicitNullMin` degenerate-bounds case for line 68) before this PR, so
  the whole-corpus coverage percentages above are not expected to move; they
  were not independently re-measured for this fix (a full corpus rebuild is
  expensive and this correction's own, directly-verified claim is the
  236-fixture lifted-only coverage number above, not the whole-repo one).
* Replay of the "after" corpus against the frozen reference
  (`--engine reference`): confirmed via the isolated 300-fixture lifted-only
  replay (jsonpopulator.js + stringvalidator.js together): 300/300
  pass (100%), 0 harness errors; the full 16,029-fixture reference replay
  was not re-run in this PR (it is the same code path `--engine src`
  already exercises, and the isolated lifted-only reference replay already
  confirms these specific new fixtures agree with the reference).

The whole-corpus delta is small — one more statement, no more branches,
one more function, one more line — because `packages/concerto-core` already
sits at 94.8%/92.8% corpus-only coverage on `origin/claude/tender-pascal-ocwf9q`
(task P2-11 closed most of the reachable gap already, including in
`stringvalidator.ts`, with its own targeted black-box inputs in
`drivers/gaps.spec.js`). This PR's fixtures mostly overlap branches the
corpus already reached by other routes. That is expected and does not
weaken the lift: P2-10's own exit condition is about retiring each W test
with a fixture the reference verifies (see "Verification done" above,
which measures this file's fixtures in isolation), not about moving the
whole-repo coverage number, which is P2-11's job.

## Not yet attempted

* 162 W tests across 22 files remain, largest next: `introspect/numbervalidator.js`
  (27; note 6 of these are listed `not-liftable` already in SUMMARY.md §11),
  `serializer/jsongenerator.js` (22), `modelmanager.js` (21),
  `introspect/scalars.js` (10), `serializer/resourcevalidator.js` (10; the
  ledger's own count, not the 45 the parent issue's summary paragraph
  estimated), and the rest.

None of these are marked `not-liftable` here — that determination (per the
issue) needs the same per-test read this PR gave `stringvalidator.js`'s
tests; it has not been redone for any other file.
