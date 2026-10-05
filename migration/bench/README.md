# migration/bench/

The benchmark harness against the TypeScript runtime on the same models,
so every later phase of the migration can show its speed-up against a
committed baseline. Started under task **P5-04a** (issue
accordproject/concerto-rust#92); extended under task **P5-04** (issue
accordproject/concerto-rust#75) with `CONCERTO_ENGINE=rust` support (the
finished Rust-backed concerto-core, via WASM, through this same script)
and a Rust-side instance-validation workload - both under the migration
plan accordproject/concerto-rust#29.

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
- `results/` - one directory per benchmark task (`results/<run>/`), plus
  the JSON output of past `run-ts.mjs` runs (one file per run, named by
  timestamp). `RESULTS.md` in this directory holds the committed
  baseline table (see "Baseline" below). Only each run's summaries are in
  git; its raw outputs are a release asset (see "Raw results" below).
- `bin/archive-results.mjs`, `bin/fetch-results.sh` - move a run's raw
  outputs to a release asset, and restore them (see "Raw results" below).

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
toolchain info, the `concerto` commit, and which engine served the run) as
JSON to `--out`.

### Running against the Rust engine (task P5-04)

Set `CONCERTO_ENGINE=rust` before the same command to run every workload
through the finished Rust-backed concerto-core instead of the TS
reference, via `@accordproject/concerto-engine` (the WASM build of
`concerto-rust`'s `concerto-wasm` crate) - see
`packages/concerto-engine/README.md`. Build that package first, in a
`concerto-rust` checkout next to this one:

```sh
cd ../concerto-rust/concerto-wasm
npm install   # binaryen (wasm-opt) and Playwright, for the smokes
sh build.sh   # needs the wasm32-unknown-unknown target and wasm-bindgen-cli 0.2.128

cd ../../concerto
CONCERTO_ENGINE=rust node migration/bench/run-ts.mjs
```

This is a different comparison from `concerto-rust`'s own `cargo bench`
(which calls the Rust crate directly, no TS or WASM boundary) - see
`RESULTS.md`'s "Two different Rust numbers" for what each one measures
and why they currently disagree by orders of magnitude.

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
3. **`instance_validate`** - generates 500 instances of a small synthetic
   concept and times `Serializer#fromJSON` (populate + validate together)
   and `Resource#validate()` on its own. Under `CONCERTO_ENGINE=rust` this
   exercises `concerto-core`'s instance validator (task P3-01) through the
   same TS entry points. The matching Rust-crate-direct benchmark
   (`concerto-rust`'s `benches/instance_validate.rs`, task P5-04) only
   covers the `Resource#validate()` half - there is still no Rust
   `JSONPopulator`, so `fromJSON`'s populate step has no Rust-crate
   counterpart to compare against yet.

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

## Raw results

Since P5-135 (accordproject/concerto-rust#516) raw benchmark and fuzz
outputs are not committed. They go into a tarball on a **draft** release
of `accordproject/concerto-rust`, like the oracle corpus, and only the
summaries stay in git, so results stay reproducible without thousands of
raw files in the tree.

- **Committed, per run:** `RESULTS.md`'s section; the run's summaries
  (`tables.md`, `tables.json`, `*-tables.json` and the other `*.md`);
  charts (`*.svg`, under 200 KB); `run-log.txt` and `timed-loads.txt`;
  `summary.txt`; the run's own scripts; and a `MANIFEST`.
- **Release asset:** everything else - sweep JSON, criterion estimates,
  V8 profiles, soak samples, typed-read and dhat dumps, bundle and load
  measurements, and anything else the table scripts read. For fuzz runs
  (`migration/fuzz/results/`), the per-case `*.jsonl` files and the
  triage clusters; `run-summary.json`, `divergence-summary.json`,
  `commits.json`, `state.json` and `run-42.json` stay in git.
- `results/.gitignore` and `../fuzz/results/.gitignore` allow only the
  committed kinds, so a new run's raw files can't be committed by
  accident. `bin/archive-results.mjs` applies the same rule.
- `MANIFEST` (one per archived directory) names the release, the asset,
  its sha256 (and the sha256 of the uncompressed tar, which does not
  depend on the gzip build), the file count and every archived path.

The first archive is the draft release
`migration-results-archive-2026-10-05`: one asset per directory
(`bench-<run>.tgz`, `bench-root.tgz` for the top-level `run-ts.mjs` JSON,
`fuzz-<run>.tgz`, `fuzz-root.tgz`, and `tags-mocha-results.tgz` /
`logs-mocha-results.tgz` for the two generated mocha JSON files under
`migration/tags/` and `migration/logs/`).

To restore raw outputs, for example before re-running a table script:

```sh
sh migration/bench/bin/fetch-results.sh P5-131 P5-121   # or bench-P5-131, fuzz-stage2, all
```

It downloads each asset with `gh release download` (a draft, so it needs
a GitHub login that can see it), checks the sha256 against `MANIFEST` and
extracts into the run's directory. The table scripts check their inputs
first: when an archived input is missing they stop with the
`fetch-results.sh` command to run, instead of failing obscurely or
printing empty rows. For example, P5-131's tables need `P5-131` and,
for the cross-run columns, `P5-121`.

A new benchmark run: write the raw outputs under `results/<run>/` as
usual, commit the summaries, and archive the rest:

```sh
node migration/bench/bin/archive-results.mjs --release <draft release> --out <dir> --remove migration/bench/results/<run>
gh release upload <draft release> -R accordproject/concerto-rust <dir>/bench-<run>.tgz   # or gh release create <tag> --draft
git add migration/bench/results/<run>/MANIFEST
```

The tarball is deterministic (sorted entries, fixed mtime, uid/gid 0,
`gzip -n -9`). Never publish the draft releases, and never delete or
change an existing release's assets: a MANIFEST pins each sha256.

## Baseline

`RESULTS.md` in this directory holds the committed baseline table (TS vs
current Rust, on the machine and toolchain recorded there) - see that file.
It is a snapshot; refresh it by re-running both harnesses (this script, and
`cargo bench --manifest-path benches/Cargo.toml` in `concerto-rust` -
see that crate's `benches/README.md`) after phases P2, P3 and P4, as the
plan asks for.
