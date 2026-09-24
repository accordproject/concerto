# migration/bench/

The benchmark harness for task **P5-04a** (issue accordproject/concerto-rust#92,
under the migration plan accordproject/concerto-rust#29): a criterion
benchmark against the TypeScript runtime on the same models, so every later
phase of the migration can show its speed-up against a committed baseline.

This is the TS half. The Rust half lives in `accordproject/concerto-rust`'s
`benches/` crate, and reads its inputs from the fixtures generated here (see
below) - both harnesses load byte-identical models.

## What's here

- `generate-fixtures.mjs` - produces the fixed AST fixtures both harnesses
  load (see "Fixtures" below). Re-run only when its inputs change; the
  output is committed.
- `run-ts.mjs` - **the one documented TS benchmark command** (see "Running"
  below).
- `lib/stats.mjs`, `lib/timeit.mjs` - a small, dependency-free sampling
  harness (median/mean/stddev/CV over repeated calls). This task's owned
  path is `migration/bench/` only, so rather than add `tinybench` (or
  anything else) as a new dependency - which would mean touching the
  workspace root's `package.json`/lockfile - these ~70 lines do the same
  job tinybench would have.
- `fixtures/model-sets/` - the committed AST fixtures (see below).
- `results/` - JSON output from past `run-ts.mjs` runs (one file per run,
  named by timestamp). `RESULTS.md` in this directory holds the committed
  baseline table (see "Baseline" below); `results/*.json` is the detail
  behind the numbers there.

## Fixtures

Both harnesses need the exact same input models, but only the TS side can
parse `.cto` source (via `@accordproject/concerto-cto`), so
`generate-fixtures.mjs` converts everything to Concerto's AST (the metamodel
JSON both `ModelManager.addModel`/`AstModelManager` on the TS side and
`ModelManager::add_model` on the Rust side accept directly) once, and both
harnesses read the same committed `.json` files from then on.

Three model sets, matching the plan's workload 1:

- **`concerto-core-test-data`** - parses every `.cto` file under
  `packages/concerto-core/test/data`, keeping one AST per unique namespace.
  That directory is `packages/concerto-core/test/data`, not
  `packages/concerto-core/test/**` itself, so converting it does not touch
  the paths this task must never edit. That tree deliberately repeats
  namespaces across unrelated fixtures (including ones meant to fail
  validation, for the TS suite's own negative tests), so those namespaces
  cannot in general be loaded together as one coherent set. We keep only
  models that load and validate cleanly **on their own**, into a fresh
  model manager - i.e. that are actually self-contained - which gives a
  coherent, always-valid set both harnesses can load together (35 models
  as of this writing).
- **`conformance`** - the same treatment, applied to the already-converted
  AST fixtures under `accordproject/concerto-conformance`'s
  `semantic/specifications/**/*.json` (41 models as of this writing).
  Requires that repo checked out as a sibling of this one (see the
  migration plan's repo layout); override the location with the
  `CONFORMANCE_DIR` environment variable. If it is not found,
  `generate-fixtures.mjs` warns and skips this set rather than failing, so
  the other two fixture sets still get (re)generated.
- **`synthetic-large`** - one large synthetic model (300 concept
  declarations with primitive fields, relationships and an inheritance
  chain, plus a scalar, an enum and a map), generated deterministically in
  `generate-fixtures.mjs` itself so both harnesses load the exact same AST
  without needing a second copy of a large fixture file checked into each
  repo.

Regenerate with (after building `concerto-core`'s `dist/`, since the
self-containment check loads it - see "Running" below):

```sh
node migration/bench/generate-fixtures.mjs
```

## Running

One documented command, from the repo root:

```sh
npm ci
npm run build -w packages/concerto-util
npm run build -w packages/concerto-cto
npm run build -w packages/concerto-core
npm run build -w packages/concerto-vocabulary   # needed at require time, see migration/README.md

node migration/bench/run-ts.mjs
```

(`concerto-vocabulary` is not a declared dependency of `concerto-core`'s
`package.json` but is pulled in at require time through the npm workspace
symlink - the same note migration/README.md makes for running the test
suite applies here.)

Options: `--samples N` (default 30), `--warmup N` (default 5), `--out
FILE` (default: a timestamped file under `results/`).

The script prints a markdown table to stdout and writes full results
(medians, means, standard deviation, coefficient of variation, machine and
toolchain info, the `concerto` commit) as JSON to `--out`.

### Workloads

1. **`load_validate`** - for each model set, times loading (structural
   parse of every model into a fresh `AstModelManager`, with per-model
   validation deferred) and then validating (`validateModelFiles()` once,
   over the whole loaded set) separately, so a slower validator does not
   hide behind a fast loader or vice versa. This is the TS-side
   counterpart to the Rust harness's `add_model` (structural) then
   `validate_models` (semantic) split.
2. **`validate_ast`** - `ModelManager#validateAst` (with
   `metamodelValidation: true`), which deserialises the AST against the
   metamodel schema via the serializer. This is the counterpart to the
   Rust harness's `ModelFile::from_json` and `concerto-validate-rs`'s
   `validate_metamodel`. `validateAst`'s own strict schema check rejects a
   few constructs the normal load path accepts (observed: a
   `DateTimeProperty` with a `defaultValue`); the harness checks each
   model once outside the timed section and benchmarks only the subset
   that passes, printing how many that is when it is not all of them,
   rather than let one edge case sink the whole set's timing.
3. **`instance_validate`** (**TS only**, per the issue - the Rust side is
   filled in once instance validation lands, after P3-01) - generates 500
   instances of a small synthetic concept and times
   `Serializer#fromJSON` (populate + validate together) and
   `Resource#validate()` on its own.

### Variance

Each reported number is the **median** of the configured sample count
(default 30, after 5 untimed warmup calls), with the sample-to-sample
coefficient of variation (CV) recorded alongside it. In this sandboxed,
shared-CPU environment, the CV on a single run for the smallest
workloads (sub-100µs) can be noisy (15-50%) - that reflects GC pauses and
scheduler jitter on operations that take a few tens of microseconds, not
instability in the harness. What matters for the exit condition is that
**the median itself reproduces across reruns**: back-to-back runs on this
machine reproduce every workload's median within about 10-15% (see
`results/RESULTS.md`'s "Reproducibility" note). On a quieter, dedicated
machine, expect materially tighter per-run CVs too.

## Baseline

`RESULTS.md` in this directory holds the committed baseline table (TS vs
current Rust, on the machine and toolchain recorded there) - see that file.
It is a snapshot; refresh it by re-running both harnesses (this script, and
`cargo bench --manifest-path benches/Cargo.toml` in `concerto-rust` -
see that crate's `benches/README.md`) after phases P2, P3 and P4, as the
plan asks for.
