# P5-05 stage 1: divergence triage

Plan: accordproject/concerto-rust#29 §2.5, §4 (Phase 5). Issue:
accordproject/concerto-rust#76. Coordinator decision (#76 comment 5835650999): land
P5-05 in two stages. This is stage 1's report: the harness plus this triage. No
product code is changed here.

## Run

`node migration/fuzz/bin/fuzz.js --count 60000 --batch-size 1000 --run-seed 42`
against the canonical corpus (`oracle-corpus-p107-06aa375`), with the TS side from
this branch's `packages/concerto-core/src` and a WASM engine built from this task's
concerto-rust branch (`claude/tender-pascal-ocwf9q-cloud-2-P5-05-156fix`, the
integration branch plus DV-015/DV-009 docs and tests, no behaviour change). Summary:
`results/run-42.json`. The raw outputs are `results/divergences.jsonl` (unresolved),
`results/expected-divergences.jsonl` (maintainer-accepted, documented) and
`results/harness-errors.jsonl` (empty for this run). Each line carries a reproducible
`{seedFile, mutationSeed}` (README.md, "Reproducing a divergence").

Every derived file is regenerated from those outputs by
`node migration/fuzz/bin/finalize-triage.js` (with `FIXTURES_DIR` and
`CONCERTO_ENGINE_MODULE` set). It runs `bin/summarize.js` to write
`results/divergence-summary.json`, then `bin/triage.js`, `bin/minimize-clusters.js`
and `bin/attribute-owners.js` to write `results/triage-clusters.json`. Running it again
over the committed outputs reproduces the committed JSON byte for byte.

| op | ran | agree | divergences | expected (DV-015/#156) | harness errors (ts / rust) |
|---|---|---|---|---|---|
| Resource.validate | 15,942 | 15,942 | 0 | 0 | 0 / 0 |
| Serializer.fromJSON | 12,454 | 9,700 | 1 | 2,753 | 0 / 0 |
| ModelManager.fromAst | 19,313 | 17,808 | 1,505 | 0 | 0 / 0 |
| ModelManager.addModelFile | 12,291 | 11,426 | 865 | 0 | 0 / 0 |
| **total** | **60,000** | **54,876** | **2,371** | **2,753** | **0 / 0** |

For every op, `ran = agree + divergences + expected + harness-error cases`. The 2,371
unresolved divergences form **309 signature clusters** (`results/triage-clusters.json`).

**Comparison with the previous committed run.** That run used the same run-seed and
the same plan, but an older engine and harness. Every expected (DV-015) case is the
same: 2,753 cases, one set. No new unresolved divergence appeared and no outcome
changed. 124 `ModelManager.fromAst` cases (3 clusters) now agree: TS's regex error
`Invalid regular expression: /(/: Unterminated group` now matches in Rust, which
reported `Unbalanced parenthesis` before. That regex-message wording was fixed on the
integration branch after the previous run. The harness changes in this revision
(below) changed no case's outcome: both runs had 0 harness errors.

## Harness correctness

- **Engine errors during input decoding are verdicts.** `adapter.run()` decodes a
  fixture's inputs, and decoding calls engine code: the `ModelFile`, `ModelManager`,
  `Serializer`, `Factory`, `Introspector` and `ResourceValidator` constructors,
  `getModelFile`, the declaration/property/decorator/validator accessors, and so on.
  `migration/oracle/lib/codec.js` sends each of those calls through one
  `engineCall()` helper. The helper tags anything the engine call throws with
  `decodeConstruct` (additively: the same error, thrown the same way). The worker
  compares a tagged error against the other engine as the op's outcome. A
  `HarnessError`, a replay "state divergence" or an untagged throw is a harness error.
  (`lib/classify.js` `classifyThrow`.)
- **Harness errors are counted per side and per op.** `bin/fuzz.js` classifies every
  case once (`lib/classify.js` `classifyCase`/`tally`). It no longer skips the Rust
  side when the TS side fails. Each harness-error case goes to
  `results/harness-errors.jsonl` with both sides, and a side that produced a verdict
  keeps it.
- **Tests:** `node --test migration/fuzz/test/*.test.js` runs 13 tests. They cover TS
  ok with Rust throwing, TS throwing with Rust ok, both throwing with the same
  class/message, both throwing with a different class, and both throwing with a
  different message. They also cover an expected (DV-015) pair, genuine harness errors
  on one side, both sides and a missing result, per-side/per-op tallies, and codec
  tagging of engine errors beyond the `ModelFile` constructor (while `HarnessError` and
  state divergences stay untagged).
- **Expected divergences are excluded before clustering.** `lib/expected-divergences.js`
  matches a maintainer-accepted, documented signature. Today that is only DV-015
  (#156).

## Themes

### T1: `Serializer.fromJSON`

**T1a/T1b: a non-string `$class`, 2,753 cases in 97 signature clusters, all
expected (DV-015, accordproject/concerto-rust#156).** TS's `Serializer.fromJSON`
reaches `ModelUtil.getShortName`/`getNamespace`
(`packages/concerto-core/src/modelutil.ts:119,143`). These call `fqn.lastIndexOf('.')`
with no type check. Falsy values (`null`, `false`, `0`, `""`) never get there: on both
sides they take the earlier `!jsonObject.$class` "no $class" branch, so they don't
diverge. A truthy non-string `$class` gives one of two shapes:
- **T1a:** `true`, a non-zero number or a plain object has no `lastIndexOf` of its
  own, so V8 throws `TypeError: fqn.lastIndexOf is not a function` (1,694 cases).
- **T1b:** an array has `Array.prototype.lastIndexOf`, which returns `-1`. The
  array is stringified later, and TS raises
  `TypeNotFoundException: Namespace is not defined for type "…"` (1,059 cases).

Rust rejects both shapes with `Error: a $class that is not a string: <value>`. The
maintainer's decision on #156 (comment 5837231174) is to keep Rust's clearer error.
It is recorded in `DIVERGENCES.md` as DV-015 (`maintainer-accepted`, in
accordproject/concerto-rust). The decision covers a non-string `$class` as a whole,
so the matcher keys on Rust's rejection message paired with either TS shape. These
cases are in `results/expected-divergences.jsonl`, and none of them is in
`triage-clusters.json`. Representative seeds:
`data/Serializer.fromJSON/05598770d4c6f12c4d5dcf8e.json`, mutationSeed 29 (T1a);
`data/Serializer.fromJSON/019ca6f000af29c0d09ac831.json`, mutationSeed 2639346688
(T1b). accordproject/concerto-rust#160 was filed for T1b before #156's scope was
confirmed to cover it, and it is now superseded.

**T1c: a `DateTime` string with an embedded NUL, 1 cluster, 1 case.** Owner:
**accordproject/concerto-rust#169** (new).
Signature: `Serializer.fromJSON | ts=ok | rust=error(ValidationException) |
rust:"Expected value at path `$.t` to be of type `DateTime`"`. Seed
`data/Serializer.fromJSON/024a285d00093fff73ca0e8d.json`, mutationSeed 3124886527.
It minimises to one edit, `t = "1970-01-01T00:00:00.000+00:00\u0000"`:
- TS accepts it as `1970-01-01T00:00:00.000Z`. The default non-strict DateTime path is
  `dayjs.utc(string)` → `new Date(string)`, and V8's date tokenizer reads U+0000 as
  the end of its input. `…\u0000junk` also parses, while `…\u0001` is invalid on both
  sides.
- Rust's `date_parse` (`concerto-core/src/instance/dayjs.rs`) matches the whole
  string, so it rejects it.

This is not a TS bug. It falls inside the documented `engine` divergence DV-009:
Rust covers the ECMAScript format plus only the V8 extensions the corpus reaches.
DV-009's own example, `Nov 28 2022`, gives the identical signature on this seed.
concerto-rust's `DIVERGENCES.md` now names the NUL case under DV-009, and a `dayjs.rs`
test pins it. #169 asks the plan owner either to confirm DV-009 or to port V8's rule.
If DV-009 is confirmed, stage 2 can add the signature to
`lib/expected-divergences.js`.

### T2: `ModelManager.fromAst`/`addModelFile`, 2,370 divergences in 308 clusters

Mutated model ASTs where the engines disagree (1,505 from `fromAst`, 865 from
`addModelFile`):
- **Rust's serde AST deserialisation is stricter than TS's untyped walk**, for
  example `invalid type: integer, expected a string` or `missing field 'pattern'`. TS
  loads the model, or fails later with another message.
- **Unguarded field access on optional or nullable AST fields** in the Rust view/glue
  path, for example `this.name.toString is not a function` or
  `Cannot read properties of null (reading '…')`.
- **Rust too permissive (14 cases):** `ts=TypeError rust=ok`, 12 from `addModelFile`
  and 2 from `fromAst`. For example, TS crashes on a `RelationshipProperty` whose
  `type` is `null`, and Rust accepts it. Seed
  `conformance/ModelManager.addModelFile/005d5a23d5c0d57ce9dfb0a4.json`, mutationSeed
  2183103348.
- **Class or message-text-only mismatches** where both sides reject.

In total, 1,038 T2 cases are `ts=ok` with Rust rejecting (`results/divergence-summary.json`).

**Owner, from the ledger:** `ModelManager.fromAst`/`addModelFile` and
`ModelFile.fromAst` have `planned_task` `P2-08+P4-08` in `SEAM_LEDGER.tsv`.
- P2-08 (#52) is closed.
- P2-08b (#129) is closed. Its scope never included `fromAst`/`addModelFile`, so no
  T2 cluster is its.
- P2-08c (#144) is closed. It fixed the root-cause files these traces name. This
  run is on post-#144 Rust, so the remaining clusters are what it did not cover.
- **P4-08 (#67) is open, and it owns every T2 cluster (`owner.issue`).** Its exit
  condition requires the group's oracle fixtures to pass under `CONCERTO_ENGINE=rust`
  for `addModel(s)`/`validate`/`validateAst`.

### T3: `Resource.validate`, no divergences

`Resource.validate` had 0 divergences in 15,942 cases.

## Stage-1 exit condition

The coordinator's condition (#76 comment 5835650999) is: **the harness is correct, and
every cluster has an owner or a new issue.**
- **The harness is correct.** See "Harness correctness" above. This run had 0 harness
  errors on either side, and every case was compared or excluded as a documented,
  maintainer-accepted divergence.
- **Every cluster has an owner or a new issue.** `bin/attribute-owners.js` checks this
  and exits non-zero otherwise. All 309 clusters in `results/triage-clusters.json`
  carry a non-null `owner.issue`:
  - 308 T2 clusters: accordproject/concerto-rust#67.
  - 1 T1c cluster: accordproject/concerto-rust#169, a new issue.

  The 97 T1a/T1b signatures are not clusters here, because they are expected
  divergences (DV-015, #156).

The *issue's* own exit condition is 1,000,000 cases with no unresolved divergence.
It is stage 2's, and it is not met.

## Cross-check against DIVERGENCES.md

Every cluster's signature was checked against the subjects of `DIVERGENCES.md`'s rows
DV-001 to DV-015, including circular inheritance and `RangeError`,
`dayjs`/`DateTime`/legacy dates, `Infinity`, lone surrogates and a non-string instance
`$class`. The 13 T2 clusters that mention `$class` are about a model AST's
`$class`, not an instance's, and the 9 whose TS message is an invalid-regex error have
no DV row. Two rows match:
- DV-015, for T1a/T1b, which is excluded as expected.
- DV-009, for T1c (#169).

No T2 cluster duplicates a documented row.

## What this triage does not do

- **It fixes no product code.** The fixes belong to the owners named above.
- **It leaves the corpus and `baseline.tsv` untouched.**
- **It does not inspect every divergence by hand.** `bin/minimize-clusters.js`
  re-verifies and shrinks each cluster's sample: 309/309 were minimised, 0 are stale,
  and they need 1 edit (181 clusters), 2 edits (118) or 3 edits (10). It does not
  re-inspect each of the other cases a cluster's `count` stands for.
- **It does not attempt stage 2**, the 1,000,000-case run. At about 63 cases/s on
  this machine (see `run-42.json`'s `started`/`finished`), that run is a multi-hour
  job. The coordinator deferred it until the owning tasks land, and it should be
  sharded.
