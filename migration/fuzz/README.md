# Differential fuzzing (task P5-05)

Plan: accordproject/concerto-rust#29 §2.5 ("Differential fuzzing"), §4 (Phase 5).
Issue: accordproject/concerto-rust#76.

Mutates models and instances drawn from the oracle corpus (`migration/oracle/fixtures`,
read-only) with a deterministic, seeded generator, runs each mutated case through the
TS reference-mode engine and the Rust/WASM engine, and diffs the canonical outcome
(verdict, error class, location) the same way `migration/oracle/lib/judge.js`
does for the recorded corpus. Since task P5-09 (accordproject/concerto-rust#253, maintainer
decision 2026-09-27) the exception message text is not compared: a case whose outcomes differ
only in message is an agreement, counted in `messageOnlyAgree` (a subset of `agree`); a
throw/no-throw, class, component, location or value difference is still a divergence.
`bin/reclassify-class-not-message.js` re-judges the stage-2 clusters under this rule
(`results/stage2/reclassified-class-not-message.json`; see TRIAGE.md).

**Scope, per the coordinator's comment on accordproject/concerto-rust#76:** this task
owns the harness only. It never edits `migration/oracle/`, the canonical corpus or
`baseline.tsv`, and never edits `packages/concerto-core/test/**` or `src/`. Every
divergence it finds is reported (`results/divergences.jsonl`) with a minimised,
reproducible seed; turning it into a permanent oracle fixture and fixing the losing
side is a follow-up task, not this one.

## Layout

```
lib/
  mutate.js     deterministic JSON mutation: mutate(value, seed) -> mutated value.
                A 32-bit integer seed fully determines the edits (mulberry32 PRNG),
                so {seedFile, mutationSeed} is a complete, reproducible repro.
  seeds.js      loads real oracle fixtures for the 4 targeted ops as mutation seeds,
                and knows which part of each fixture's `inputs` is a plain
                model/instance document (as opposed to `@@oracle`-encoded recipe
                scaffolding, which mutate.js must not be pointed at — see its
                TARGETS comment). Filters out any seed whose blobs the corpus is
                missing (a pre-existing corpus gap, not a bug this harness can fix).
  worker.js     runs as its own process, one per engine (ENGINE=ts|rust): the engine
                choice is read from the environment once at module load, so a TS
                adapter and a Rust adapter can never coexist in one process. Reads
                newline-delimited {id, op, inputs} requests from stdin, replays each
                through migration/oracle/lib/adapter.js (ts) or rust-adapter.js
                (rust), canonicalises the outcome exactly as judge.js does, and
                writes one newline-delimited result per request to stdout. Batching
                many cases through one process amortises ts-node/wasm start-up.
  run-batch.js  spawns one worker.js per engine per batch and pairs up results by id.
  classify.js   outcome classification, free of engines and I/O (unit-tested in
                test/classify.test.js): classifyThrow() decides, inside a worker,
                whether an error thrown out of adapter.run() is the engine's verdict
                (an engine call during input decoding that codec.js tagged — any
                constructor/accessor, not only `new ModelFile`) or a harness error;
                classifyCase() turns both workers' results into agree / divergence /
                expected / harness; tally() counts each case once, per op, with
                harness errors counted per side.
  signature.js  the cluster-signature function (op, TS outcome kind, Rust outcome
                kind, templated message) shared by bin/triage.js and
                bin/minimize-clusters.js, so both agree on what "the same cluster"
                means.
  expected-divergences.js
                signatures the maintainer has explicitly accepted as permanent,
                documented divergences (each citing the DIVERGENCES.md row in
                accordproject/concerto-rust that records the decision). Matched on
                whatever the decision actually scoped — the first entry (DV-015,
                accordproject/concerto-rust#156) covers a non-string $class as a
                whole (both TS's TypeError crash and, for an array $class, TS's
                non-crashing TypeNotFoundException), discriminated by Rust's
                distinctive "a $class that is not a string" rejection rather than
                by matching the TS side alone — see the file's header for why a
                narrower, TS-shape-only match under-covered the decision. The
                second (DV-017, accordproject/concerto-rust#218) covers a
                RelationshipProperty with a missing or null `type` on a model-loading
                op: TS's TypeError "Cannot read properties of undefined|null (reading
                'name')" paired with Rust's "Relationship <name> must have a type"
                IllegalModelException. The third (DV-018, the same issue and
                decision) covers a null element in a `decorators` array: the same
                TS crash, from decorator.ts:139, paired with Rust's "Invalid
                decorator. Expected object. Found null" IllegalModelException.
                bin/fuzz.js
                and bin/triage.js both use it to exclude a matching case *before* it
                is ever counted as an unresolved divergence.
bin/
  fuzz.js       the driver: fast-check picks (seedIndex, mutationSeed) pairs
                deterministically from --run-seed, lib/mutate.js applies them,
                both engines run, and canonical outcomes are diffed with
                migration/oracle/lib/canon.js's sortedStringify.
  triage.js     clusters results/divergences.jsonl by signature (lib/signature.js)
                and writes results/triage-clusters.json: {sig, op, count, sample}
                per cluster, sample being the first divergence seen.
  minimize-clusters.js
                for each cluster, re-derives lib/mutate.js's edit trace for its
                sample (mutateTraced()) and runs ddmin over it: drop one edit,
                replay the rest through both engines (a persistent lib/worker.js
                per engine, reused across every cluster), keep the drop only if
                the result still canonicalises to the same cluster signature.
                Writes each cluster's `minimized` field: the smallest edit list
                found, as engine-agnostic {kind, path, value?, index?} ops
                (lib/mutate.js's applyEdits()) plus the resulting document — a
                reproducer that needs no seed, run-seed or PRNG to replay.
  attribute-owners.js
                writes each cluster's `owner` field from a fixed op -> ledger-row
                -> GitHub-issue table (see the file for how it was resolved), with a
                `clusterOverride` that checks a cluster's actual sample shape, not
                just its op, so an unrelated cluster sharing an op with a resolved
                theme isn't silently attributed to that theme's owner (the one
                Serializer.fromJSON cluster that survives lib/expected-divergences.js
                — a ts=ok/rust=ValidationException DateTime case — is attributed to
                DIVERGENCES.md DV-009, not to #156 or #160).
  summarize.js  writes results/divergence-summary.json (counts by op and by
                TS/Rust outcome class) from divergences.jsonl and
                expected-divergences.jsonl.
  finalize-triage.js
                prints TRIAGE.md's headline table from results/run-42.json, then
                regenerates every derived results file: summarize.js, triage.js,
                minimize-clusters.js (only if FIXTURES_DIR/CONCERTO_ENGINE_MODULE
                are set) and attribute-owners.js. Re-running it over the committed
                run outputs reproduces the committed JSON exactly.
  run-shards.js stage 2's shard supervisor: runs fixed, recorded shards of
                fuzz.js (default run-seeds 1001-1010 x 100,000 cases), at most
                --parallel at a time, keeping per-shard raw outputs in --raw-dir
                (outside the repo) and a resumable results/stage2/state.json.
                Re-running it skips `done` shards and restarts any other one
                from scratch.
  aggregate-shards.js
                sums the shards' run.json counts (results/stage2/run-summary.json),
                runs summarize.js over all shards (divergence-summary.json) and
                clusters every shard's divergences (triage-clusters.json, with
                per-shard counts and a sample carrying its shard/run-seed).
  finalize-stage2.js
                regenerates every committed results/stage2/ file from the raw
                shard outputs: aggregate-shards.js, minimize-clusters.js,
                attribute-owners.js --stage2 (each cluster's `status`:
                `pending-rerun` when its owner is in-flight work the
                coordinator named, `documented` when a DIVERGENCES.md row covers
                it, else `unresolved`), then compaction (owner details once at
                the top level; `minimized.doc` and a sample's `ok` payload
                dropped). Deterministic: a re-run reproduces the files exactly.
test/
  classify.test.js  node --test migration/fuzz/test/*.test.js — outcome
                classification (ts-ok/rust-throw, ts-throw/rust-ok, both throw
                with the same or a different class/message, genuine harness errors
                per side) and codec.js's tagging of engine errors raised while
                inputs are decoded.
results/
  run-*.json          one run's summary: ran = agree + divergences +
                      expectedDivergences + harnessErrorCases, overall and by op,
                      plus harnessErrorsTs/harnessErrorsRust per side.
  harness-errors.jsonl
                      one line per case with a harness error on either side, both
                      sides kept ({harnessError} for a failed side, the canonical
                      outcome for the other) — never silently dropped.
  divergences.jsonl   one line per unresolved divergence: {op, seedFile,
                      mutationSeed, ts: <canonical outcome>, rust: <canonical outcome>}.
                      Reproduce with the "Reproducing a divergence" recipe below.
  expected-divergences.jsonl
                      same shape, plus {dv, issue}: cases that differ but matched
                      lib/expected-divergences.js (a maintainer-accepted, documented
                      divergence). Kept for visibility; not unresolved, not clustered.
  triage-clusters.json
                      one entry per signature cluster: {sig, op, count, sample,
                      minimized, owner}. `sample` is bin/triage.js's raw first
                      hit (seed + mutationSeed); `minimized` is
                      bin/minimize-clusters.js's shrunk, seed-free reproducer
                      (edits + the resulting document); `owner` is
                      bin/attribute-owners.js's ledger-derived task/issue (or
                      DIVERGENCES.md row) attribution; the script exits non-zero if
                      any cluster has neither an owner nor an issue.
  stage2/             stage 2 (the 1,000,000-case run): state.json, commits.json
                      (the exact concerto/concerto-rust commits used),
                      run-summary.json, divergence-summary.json and
                      triage-clusters.json. The raw per-case jsonl files are not
                      committed (about 53 MB); see TRIAGE.md.
```

## Running stage 2 (sharded)

```sh
FIXTURES_DIR=<concerto checkout>/migration/oracle/fixtures \
CONCERTO_ENGINE_MODULE=<concerto-rust checkout>/concerto-wasm/pkg/concerto-engine.cjs \
  nohup node migration/fuzz/bin/run-shards.js --state migration/fuzz/results/stage2/state.json \
    --raw-dir <dir outside the repo> --parallel 2 &
# when every shard is done:
FIXTURES_DIR=... CONCERTO_ENGINE_MODULE=... \
  node migration/fuzz/bin/finalize-stage2.js --raw-dir <same dir>
```

## Targeted ops

`lib/seeds.js`'s `TARGETS` fuzzes 4 ops, chosen to cover both models and instances
per the issue: `ModelManager.fromAst`, `ModelManager.addModelFile` (models),
`Serializer.fromJSON`, `Resource.validate` (instances). Each op's seeds come from
real corpus fixtures (`fixtures/data`, `.../conformance`, `.../unit`, `.../gaps`,
`.../lifted`), up to `--seeds-per-op` (default 25) per op.

## Running

Needs a built Rust/WASM engine (`sh concerto-wasm/build.sh` in a concerto-rust
checkout — this repo's `packages/concerto-engine` links to it) and the canonical
oracle corpus.

```sh
node migration/fuzz/bin/fuzz.js \
  --count 1000000 \
  --batch-size 1000 \
  --run-seed <any integer, for a reproducible run> \
  --fixtures-dir <concerto checkout>/migration/oracle/fixtures \
  --engine-module <concerto-rust checkout>/concerto-wasm/pkg/concerto-engine.cjs \
  --out migration/fuzz/results/run.json \
  --divergences migration/fuzz/results/divergences.jsonl
```

`FIXTURES_DIR` and `CONCERTO_ENGINE_MODULE` env vars work in place of the flags.
Case throughput on one core was measured at roughly 65-70 cases/s (dominated by the
TS side's ts-node compile and the Rust WASM instantiation per batch, amortised across
the batch); see the run summary's `started`/`finished` for the actual rate of any
given run.

## Reproducing a divergence

Each line of `divergences.jsonl` is reproducible without re-running the whole batch:

```js
const { loadSeeds, withMutatedDoc, getAt } = require('./lib/seeds');
const { mutate } = require('./lib/mutate');
const seeds = loadSeeds(fixturesDir, 25 /* must match the run's --seeds-per-op */);
const seed = seeds.find((s) => s.file.endsWith(divergence.seedFile) && s.op === divergence.op);
const doc = getAt(seed.raw.inputs, seed.path);
const mutatedDoc = mutate(doc, divergence.mutationSeed);
const inputs = withMutatedDoc(seed, mutatedDoc);
// then adapter.run(seed.op, unpackedInputs) per engine, as lib/worker.js does.
```

## Reproducing a minimized cluster

`results/triage-clusters.json`'s `minimized.edits` need no seed, run-seed or
PRNG — they are already a concrete edit list, applied directly to the
fixture's own document:

```js
const { getAt, withMutatedDoc } = require('./lib/seeds');
const { applyEdits } = require('./lib/mutate');
const seedLike = { raw: JSON.parse(fs.readFileSync(path.join(fixturesDir, cluster.minimized.seedFile))), path: TARGETS.find((t) => t.op === cluster.op).path };
const doc = getAt(seedLike.raw.inputs, seedLike.path);
const mutatedDoc = applyEdits(doc, cluster.minimized.edits); // === cluster.minimized.doc
const inputs = withMutatedDoc(seedLike, mutatedDoc);
// then adapter.run(cluster.op, unpackedInputs) per engine, as lib/worker.js does.
```

## Why only these ops, and why lenses instead of hand-built cases

The corpus already records, for real models and real instances, the exact recipe
(`@@oracle`-encoded model-manager/serializer/factory construction) each op needs to
run for real through the public API — the same recipes `migration/oracle/lib/adapter.js`
decodes for the recorded corpus. Reusing them means every fuzzed case exercises real
machinery (a real `ModelManager`, a real `Serializer`) instead of a hand-built stand-in,
and it is why `lib/mutate.js` is generic JSON-shape mutation rather than a
grammar-aware model/instance generator: mutating the *document* inside a real recipe
gets structurally-plausible-but-wrong models and instances for free, without having to
re-implement Concerto's grammar in the fuzzer.

The corresponding risk is mutating the recipe's own scaffolding instead of the
document — collapsing a `ModelManager` step or a `typed` resource's `ctor` field is a
harness error, not a divergence. `lib/seeds.js`'s `TARGETS` lenses point only at the
plain sub-document for each op (e.g. `Resource.validate`'s lens is `target.fields`,
not the whole `target` recipe), and `lib/mutate.js` additionally refuses to recurse
*into* any node that itself carries an `@@oracle` marker, so at worst such a node is
replaced or duplicated whole, never corrupted piecemeal.

## Stage 1 vs stage 2 (coordinator decision on accordproject/concerto-rust#76)

P5-05 lands in two stages:

- **Stage 1 (this PR):** the harness, a fix for the `decodeMF`/harness-error bug the
  first review found (see below), and `TRIAGE.md`: the unresolved divergences from a
  60,000-case run, clustered by signature, each with a minimised reproducer
  (`bin/minimize-clusters.js`) and an owner attributed through the ledger
  (`bin/attribute-owners.js`) — an open task, or, where the ledger's owning tasks are
  all closed, a newly filed follow-up issue. No product code is fixed here.
- **Stage 2 (later, before or with P5-01):** once the owning tasks land their fixes,
  a full 1,000,000-case run with (by then) no unresolved divergences — sharded or
  parallelised, since one core manages roughly 60-70 cases/s.

### The `decodeMF` harness-error bug

`ModelManager.addModelFile`'s single argument is recorded as an `@@oracle: 'mfnew'`
recipe node, decoded by `migration/oracle/lib/codec.js`'s `decodeMF` into a real
`new ModelFile(mm, ast, defs, fileName)` call *before* the op itself runs — this
happens for every op, not just this one, since every op's arguments are decoded up
front. For a **mutated** AST, that constructor is itself exactly the code path P5-05
fuzzes, so its rejection is a real, comparable engine behaviour. But the throw
happened outside any outcome-shaped try/catch, so `migration/fuzz/lib/worker.js`
caught it at the `adapter.run()` boundary and reported it as a `harness error`
(`harnessErrorsTs`/`harnessErrorsRust`) — silently dropped from the comparison,
never diffed against the other engine, even though on the first 60k-case run **all
643** of `harnessErrorsRust` were, on inspection, cases where the TS side returned
`ok` and only Rust's `ModelFile` constructor threw.

The fix (additive, `migration/oracle/lib/codec.js` and `migration/fuzz/lib/worker.js`
only — `migration/oracle/lib/judge.js` and `bin/replay.js`, which also call
`decodeMF` for the recorded corpus, are unaffected because a recorded fixture's
`ModelFile` never fails to construct: it succeeded when the reference recorded it):
`decodeMF` tags an error thrown by the `ModelFile` constructor with
`e.decodeConstruct = true`, without otherwise changing it (same object, same class,
same message — any existing caller that doesn't look for the tag sees identical
behaviour). `worker.js` checks for the tag around `adapter.run()`; when present, it
encodes the error the same way `adapter.js` encodes any other thrown-op outcome
(`codec.encodeError`) and canonicalises it, so it diffs against the other engine like
any other result instead of disappearing as a harness error.

**Generalised (stage-1 review fix #4, worker note 5837364211 on #76):** the
`ModelFile` constructor is not the only engine call made while inputs are decoded —
`decodeMM`'s model-manager constructor, `mm.getModelFile`, a `declnew` constructor,
`getAllDeclarations`/`getKey`/`getValue`/`getOwnProperties`/`getDecorators`/the
validator accessors, and the `Introspector`, `Factory`, `Serializer` and
`ResourceValidator` constructors are all engine code too. `codec.js` now routes each
of them through one `engineCall()` helper that applies the same tag (never to a
`HarnessError` or a replay "state divergence"), and `lib/classify.js`'s
`classifyThrow()` is the single rule the worker applies. `bin/fuzz.js` no longer stops
at a TS-side harness error before looking at the Rust side: every case is classified
once (`lib/classify.js`), harness errors are counted per side and per op, and each
harness-error case is written to `results/harness-errors.jsonl` with both sides.

## CI: the nightly safety net (task P2, accordproject/concerto-rust#307)

`.github/workflows/fuzz-nightly.yml` runs one fixed-seed, 100,000-case shard of
`bin/fuzz.js` nightly (03:17 UTC) and on manual dispatch, against the migration
integration branch. It is the safety net for the maintainer decision (2026-09-27)
that fuzzing otherwise happens only on tasks that change Rust engine semantics,
never at merge — this catches anything slipping between tasks.

- **Engine:** built from the pinned `concerto-rust` ref in
  `.github/actions/concerto-engine`, the same ref every other job in this repo's CI
  uses — not `concerto-rust`'s own integration head, which carries no such CI gate
  of its own and can be red between tasks (as it was when this task verified the
  workflow: `concerto-wasm` did not compile at the then-current integration head,
  but built cleanly from the pinned ref).
- **Run-seed:** `date -u +%Y%m%d` (UTC), so each night samples a different slice of
  the mutation space (a different `(seedIndex, mutationSeed)` plan, `bin/fuzz.js`
  §"Usage") while staying individually reproducible — replay any night's shard with
  `--run-seed <that date>`. Recorded in `run.json`'s `runSeed` field and the job
  summary.
- **Budget:** one shard of 100,000 cases, batch size 1000. Measured at roughly 90
  cases/s on one core (task P2 verification run; the harness's own README previously
  measured 60-70 cases/s on different hardware) — about 20 minutes, plus setup, well
  inside the 60-minute job timeout. No sharding was needed to hit that budget; if a
  future op addition or slowdown pushes the shard over budget, lower `--count` or
  split into parallel shards (`bin/run-shards.js`'s pattern) before raising the
  timeout.
- **Baseline and pass/fail:** `bin/fuzz.js`'s own `divergences` count already
  excludes every maintainer-accepted, *permanent* divergence
  (`lib/expected-divergences.js`, the DV-\* rows). It does **not** exclude the much
  larger set of divergences this migration's fuzzing has found that are real,
  individually-tracked engine gaps not yet fixed (see `results/stage2/triage-clusters.json`'s
  `owners` for the issue each is attributed to) — gating on `divergences > 0` alone
  would fail the job every night for already-known reasons. `bin/check-nightly.js`
  instead clusters tonight's divergences by signature (`lib/signature.js`, the same
  function `bin/triage.js` uses) and fails only when a cluster's signature is not
  already in the committed baseline, `results/nightly-baseline/known-clusters.json`
  — a divergence *shape* nobody has seen and attributed yet. A new *case* of an
  already-known cluster (same signature, a different seed or mutation) is not new
  and does not fail the job.
- **Regenerating the baseline:** the baseline is a plain list of cluster signatures
  from one full shard run (this task recorded it at `--run-seed 1`, the pinned
  `concerto-rust` ref, and the canonical corpus, listed in
  `results/nightly-baseline/known-clusters.json`'s `generatedFrom`). Regenerate it
  (after a fix lands and a cluster should stop being "known", or after enough new,
  individually-triaged-and-owned clusters accumulate that re-baselining is cheaper
  than listing them all) with:
  ```sh
  FIXTURES_DIR=<concerto checkout>/migration/oracle/fixtures \
  CONCERTO_ENGINE_MODULE=<concerto-rust checkout>/concerto-wasm/pkg/concerto-engine.cjs \
    node migration/fuzz/bin/fuzz.js --count 100000 --batch-size 1000 --run-seed 1 \
      --out migration/fuzz/results/nightly-baseline/run.json \
      --divergences migration/fuzz/results/nightly-baseline/divergences.jsonl
  node migration/fuzz/bin/triage.js migration/fuzz/results/nightly-baseline/divergences.jsonl \
    > /tmp/triage.json   # then update known-clusters.json's "signatures" from its
                          # clusters[].sig and its generatedFrom metadata by hand
  ```
  A baseline update is a review point like any other change here: shrinking it
  (removing a signature) asserts a fix landed; growing it asserts a newly-owned,
  already-tracked gap, not a shrug.
- **Never a corpus or baseline (P5-05 sense) change:** this task only adds the
  workflow, `bin/check-nightly.js` and the nightly nightly-baseline snapshot files
  above. It does not touch `bin/fuzz.js`'s case generation or classification,
  `lib/expected-divergences.js`, the oracle corpus, or `concerto-core/tests/oracle/baseline.tsv`.
- **Verifying a real failure locally** (not committed — the exit condition is a
  *local*, deliberately injected divergence): append a fabricated line to a copy of
  `results/nightly/divergences.jsonl` with an `op`/`ts`/`rust` shape that
  `lib/signature.js` cannot match to any signature in `known-clusters.json` (a
  new op name is the simplest), then run `bin/check-nightly.js` against it — it
  exits 1, lists the new cluster, and writes it into `triage-clusters.json`'s
  `newClusterCount`.

**Schedule caveat:** GitHub only fires a workflow's `schedule` trigger from the copy
of the workflow file on the repository's *default* branch (`main`), not from a
feature/integration branch, even though `workflow_dispatch` runs the branch's own
copy on demand. Until `claude/tender-pascal-ocwf9q` merges to `main`, exercise this
job with "Run workflow"; the nightly cron activates itself, unmodified, once merged.
