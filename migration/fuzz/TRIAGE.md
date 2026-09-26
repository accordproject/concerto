# P5-05: divergence triage

Plan: accordproject/concerto-rust#29 §2.5, §4 (Phase 5). Issue:
accordproject/concerto-rust#76. Coordinator decision (#76 comment 5835650999): land
P5-05 in two stages. **Stage 2** (the 1,000,000-case run, released early by the
coordinator in #76 comment 5843986603) is reported first, below; **stage 1**'s
report (the harness and the 60,000-case triage) follows it unchanged. No product code
is changed by either.

# Stage 2: the 1,000,000-case run

## Run

Ten shards of 100,000 cases, run-seeds **1001-1010**, batch size 1000, 25 seeds per
op, driven by `bin/run-shards.js` (at most 2 shards at a time, resumable from
`results/stage2/state.json`). Each shard is exactly
`node bin/fuzz.js --count 100000 --batch-size 1000 --seeds-per-op 25 --run-seed <seed>`,
so any shard can be re-run on its own and reproduces its counts.

- **concerto:** `claude/tender-pascal-ocwf9q` at `2b1e969654951040f6c52412baf18f9f751d9386`
  (TS side from `packages/concerto-core/src`; harness from `migration/fuzz/` at that
  commit, plus this change's driver and aggregation scripts, which don't touch case
  generation or classification).
- **concerto-rust:** `claude/tender-pascal-ocwf9q` at
  `418c72d7669c5ec23f59fe8649da10b22cbcdb66`, with `concerto-wasm` built fresh from it
  (`sh concerto-wasm/build.sh`, its own target dir).
- **Corpus:** the canonical `oracle-corpus-p107-06aa375` (16,704 files), with
  `migration/ledger/` alongside and the CTO cache rebuilt (`build-cto-cache.js`, 705
  texts, `--check` OK).

`results/stage2/commits.json` records the same details. Wall time was 2 h 15 min
(06:55-09:10 UTC on 2026-09-26): 27 minutes per shard, two at a time on 4 cores,
about 62 cases/s per shard.

| shard | run-seed | ran | agree | divergences | expected (DV-015) | harness errors (ts / rust) |
|---|---|---|---|---|---|---|
| 1 | 1001 | 100,000 | 91,592 | 3,803 | 4,605 | 0 / 0 |
| 2 | 1002 | 100,000 | 91,286 | 3,945 | 4,769 | 0 / 0 |
| 3 | 1003 | 100,000 | 91,500 | 3,812 | 4,688 | 0 / 0 |
| 4 | 1004 | 100,000 | 91,440 | 3,886 | 4,674 | 0 / 0 |
| 5 | 1005 | 100,000 | 91,531 | 3,865 | 4,604 | 0 / 0 |
| 6 | 1006 | 100,000 | 91,439 | 3,858 | 4,703 | 0 / 0 |
| 7 | 1007 | 100,000 | 91,492 | 3,854 | 4,654 | 0 / 0 |
| 8 | 1008 | 100,000 | 91,370 | 3,881 | 4,749 | 0 / 0 |
| 9 | 1009 | 100,000 | 91,404 | 3,792 | 4,804 | 0 / 0 |
| 10 | 1010 | 100,000 | 91,485 | 3,921 | 4,594 | 0 / 0 |
| **total** | | **1,000,000** | **914,539** | **38,617** | **46,844** | **0 / 0** |

| op | ran | agree | divergences | expected | harness errors (ts / rust) |
|---|---|---|---|---|---|
| ModelManager.fromAst | 321,562 | 297,434 | 24,128 | 0 | 0 / 0 |
| ModelManager.addModelFile | 206,674 | 192,193 | 14,481 | 0 | 0 / 0 |
| Serializer.fromJSON | 207,957 | 161,105 | 8 | 46,844 | 0 / 0 |
| Resource.validate | 263,807 | 263,807 | 0 | 0 | 0 / 0 |

In every row, `ran = agree + divergences + expected + harness-error cases`. There were
0 harness errors on either side.

**What is committed:** `results/stage2/`, which holds `state.json` (the shard plan and
per-shard status and counts), `commits.json`, `run-summary.json`,
`divergence-summary.json` and `triage-clusters.json`. The raw per-case files (the
divergences, expected divergences and harness errors of each shard, about 53 MB) are
not committed. Every case is reproducible from its shard's run-seed, or from
`{seedFile, mutationSeed}`, and each cluster carries its first sample (with shard and
run-seed) and a minimised, seed-free edit list. `node bin/finalize-stage2.js --raw-dir
<dir>` regenerates the committed JSON from the raw shard outputs, and a second run
reproduces it byte for byte.

## Clusters

The 38,617 unresolved divergences form **1,075 signature clusters**. All 1,075 were
minimised: 0 stale, 1 edit (279), 2 edits (612), 3 edits (176) or 4 edits (8).
Owners come from `bin/attribute-owners.js --stage2`, through the ledger:

| status | clusters | cases | owner |
|---|---|---|---|
| `pending-rerun` | 1,073 | 38,609 | **P4-08, accordproject/concerto-rust#67** (open, in flight) |
| `documented` | 2 | 8 | DIVERGENCES.md **DV-009** (`engine`) |
| `unresolved` | **0** | **0** | none, so no new issue was filed |

### T2: `ModelManager.fromAst`/`addModelFile`, 1,073 clusters, 38,609 cases, `pending-rerun` (#67)

This is the same theme as stage 1's T2, at the same rate: 7.5% of `fromAst` cases
(stage 1: 7.8%) and 7.0% of `addModelFile` cases (stage 1: 7.0%). The ledger rows
(`BaseModelManager.fromAst`/`addModelFile` and `ModelFile.fromAst`, planned_task
`P2-08+P4-08`) resolve to P4-08 (#67). P4-08 is still open and is converting exactly
these paths (`ModelFile` and `BaseModelManager`) to views over the Rust engine: see
#67 comment 5843956468, which covers the rest of the `ModelFile` view including
`fromAst`/`validate`, plus delegating `addModel`/`addModelFiles`/`validate`. So per the
coordinator's rule, every T2 cluster is **`pending-rerun` with owner #67**, not final.
By outcome pair:
- `ts=ok` with Rust rejecting: 71 clusters, 17,237 cases. Examples are serde
  strictness (`invalid type: …, expected f64/a string`), `Invalid property name`, and
  unguarded `this.name.toString`/`Cannot read properties of undefined` in the view
  glue.
- Both reject, with a different class or message: 999 clusters, 21,187 cases.
- `ts=TypeError` or `IllegalModelException` with Rust accepting: 5 clusters, 193
  cases. TS crashes on a property whose `type` is deleted or `null`
  (`conformance/ModelManager.addModelFile/1fdeeb379822d62d5821fe34.json`, delete
  `declarations[0].properties[1].type`), or on an empty `superType.name`
  (`data/ModelManager.fromAst/6287c8da05a81a766dd6845b.json`). Rust accepts both.

Cross-check with stage 1: 282 of stage 1's 309 signatures recur. The other 27 (29
stage-1 cases) are long-tail message variants that these run-seeds didn't draw.
Replaying their stage-1 samples on the current engines, all 27 still reproduce, so
none of them is fixed. 793 signatures are new in stage 2. They are the same T2 theme,
with the larger run reaching more message and path variants.

### T1: `Serializer.fromJSON`

- **T1a/T1b (DV-015, #156): 46,844 cases, expected, not clustered.** 28,683 are the
  `TypeError` shape and 18,161 the array `TypeNotFoundException` shape. That is 22.5%
  of `fromJSON` cases, against 22.1% in stage 1.
- **T1c (embedded-NUL `DateTime`, #169): fixed.** 0 cases in stage 2. Stage 1's
  sample (`data/Serializer.fromJSON/024a285d00093fff73ca0e8d.json`, mutationSeed
  3124886527) no longer reproduces on these engines. The Rust side now truncates at
  an embedded NUL like V8 (concerto-rust 531fdc5, #176).
- **T1d: a lone-number `DateTime` string, 2 clusters, 8 cases, `documented` (DV-009).**
  Signatures: `Serializer.fromJSON | ts=ok | rust=error(ValidationException) |
  rust:"Expected value at path `$.t` to be of type `DateTime`"` (6 cases, shards 8-10)
  and the same with `$.dateTimeValue` (2 cases, shards 5-6). All 8 cases, checked
  individually, set the field to the string `"-0"`, one of `lib/mutate.js`'s junk
  strings. Minimised to one edit, for example `t = "-0"` on
  `data/Serializer.fromJSON/024a285d00093fff73ca0e8d.json` (sample: shard 8, run-seed
  1008, mutationSeed 927039764):
  - TS accepts it as `2000-01-01T00:00:00.000Z`: `new Date("-0")` goes to V8's legacy
    parser, which reads a lone number as a year.
  - Rust's `date_parse`/`legacy_numeric_date` (`concerto-core/src/instance/dayjs.rs`)
    only covers two or three numbers, so it rejects it.

  This is the case DV-009's row names word for word: "a non-strict `DateTime` string
  in an uncovered legacy form (for example `"1"`, which V8 reads as 2001-01-01) is a
  `ValidationException` (`Expected value at path … to be of type DateTime`) in rust
  mode where ts mode accepts it". So it is documented, not new, and no issue is filed.
  `bin/attribute-owners.js --stage2` gives it to DV-009 only when the cluster's
  minimised reproducer sets a lone number. Any other `DateTime` shape stays
  `unresolved`. `lib/expected-divergences.js` is unchanged, because an outcome-only
  matcher for this pair could also hide a real Rust `DateTime` bug. Whether to add an
  input-aware DV-009 entry there is left to the reviewer.

### T3: `Resource.validate`, no divergences

`Resource.validate` had 0 divergences in 263,807 cases.

## Cross-check against DIVERGENCES.md

Every stage-2 signature was checked against rows DV-001 to DV-016 (concerto-rust at
`418c72d`):
- No cluster matches the subject of DV-002, DV-004, DV-010, DV-012, DV-013, DV-014 or
  DV-016. That rules out `isValidIdentifier`, lone surrogates, circular JSON,
  `Infinity`, `RangeError`/call-stack cycles, `isMapDeclaration` and a doubled
  `IllegalModelException` prefix.
- DV-015 is excluded before clustering.
- DV-009 covers T1d, as described above.
- 196 T2 clusters (5,645 cases) are serde deserialisation errors (`invalid type`,
  `missing field`, `invalid length`). DV-001 covers only *which* field such an error
  names when several are malformed, not whether TS accepts the input at all, so these
  stay with #67.

## Stage-2 status against the exit condition

The issue's exit condition is **1,000,000 cases with no unresolved divergence**. This
run has **0 `unresolved` clusters**, but 1,073 are `pending-rerun` on P4-08 (#67).
Under the coordinator's rule, the report merges, and the issue waits (`mig:blocked`)
for the re-run.

- **Re-run once P4-08 (#67) and P2-11b (#190) have landed:** all 10 shards, run-seeds
  1001-1010, with the same command and a fresh `concerto-wasm` build.
- **Why P2-11b too:** the coordinator named it. P2-11b adds `fixtures/supplement/`
  and gives owners to the new Rust failures it finds, which can change engine
  behaviour. No cluster in this run is attributed to it. `lib/seeds.js` draws seeds
  only from `data/`, `conformance/`, `unit/`, `gaps/` and `lifted/`, so the supplement
  won't change the seed set unless `supplement` is added there.

Every shard is a T2 re-run candidate, because T2 appears in every shard (3,792 to
3,945 cases each). The re-run will need a new `state.json`, or a new `--state` path,
and the new commits recorded.

# Stage 1: the 60,000-case run and harness

## Run

`node migration/fuzz/bin/fuzz.js --count 60000 --batch-size 1000 --run-seed 42`
against the canonical corpus (`oracle-corpus-p107-06aa375`), with the TS side from
this branch's `packages/concerto-core/src` and a WASM engine built from this task's
concerto-rust branch (`claude/tender-pascal-ocwf9q-cloud-2-P5-05-156fix`, the
integration branch plus DV-015 docs and tests, no behaviour change). Summary:
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

This is not a TS bug. It reads like the same root cause as the documented `engine`
divergence DV-009 (Rust covers the ECMAScript format plus only the V8 extensions the
corpus reaches), and DV-009's own example, `Nov 28 2022`, gives the identical
signature on this seed — but DV-009's text does not name the embedded-NUL shape, and
widening an `engine` row is the reviewer's call (PORTING.md 7.3), not a worker's.
`DIVERGENCES.md` is unchanged here. #169 asks the plan owner either to confirm this
falls under DV-009 (and to extend its row) or to port V8's NUL rule instead. If
confirmed, stage 2 can add the signature to `lib/expected-divergences.js`.

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
- DV-009 in substance, for T1c. DV-009's text doesn't name the embedded-NUL shape, so #169 asks the plan owner to confirm it.

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
