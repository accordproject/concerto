# migration/

Working area for the TS-to-Rust migration of `concerto-core` (see
`migration/PLAN.md`, a copy of `RUST_MIGRATION_PLAN.md`, for the full plan).

## What's here

- `PLAN.md` - the full migration plan (copied verbatim; the source of truth
  is the top-level `RUST_MIGRATION_PLAN.md`, kept in sync here for agents
  working only inside this repo checkout).
- `baseline.json` - the reference numbers recorded before any migration
  work: the TS `concerto-core` mocha/nyc suite results, and `cargo test` /
  `cargo llvm-cov` results for `concerto-rust` and `concerto-validate-rs`,
  plus tool versions and each repo's commit SHA (task P0-01).
- `queue.yaml` - the work queue: every task from plan §4 (P0-01..P5-06)
  with its dependencies, priority, assigned agent/model and status. This
  file is the source of truth for what's done, in progress or pending; a
  dispatcher/orchestrator resumes from it.
- `bin/run-core-tests.sh` - the wrapper every agent uses to run the
  `concerto-core` suite with an isolated nyc temp/report dir, so parallel
  agents working in the same checkout don't collide (see below).
- `logs/` - long-running command output from work done in `migration/`
  (npm/build/test/coverage logs). Keep large output here, not in chat or
  in git-tracked summaries.

Not yet created (owned by other tasks in the queue): `test-tags.tsv`
(P0-02), the seam ledger (P0-03), `PORTING.md` (P0-04), `oracle/` (P0-05),
`status.mjs` (P0-06), `telemetry/` (P0-08).

## Hard rules (apply to every agent working under `migration/` or in the
attached repos)

- Never edit `packages/concerto-core/test/` or the nyc thresholds in
  `packages/concerto-core/package.json`.
- Never run `npm test` directly in `concerto-core` - its `pretest` runs
  lint, and the default nyc temp/report dirs collide across parallel
  agents. Use `bin/run-core-tests.sh` instead.
- `concerto-validate-rs`'s `build.rs` downloads and overwrites the tracked
  `metamodel.json` on every `cargo build`/`cargo test`. Restore it after
  any cargo command in that repo:
  `git -C /home/user/concerto-validate-rs checkout metamodel.json`.

## How to run the concerto-core suite

```sh
migration/bin/run-core-tests.sh \
  --nyc-temp-dir /path/to/scratch/nyc-tmp \
  --report-dir   /path/to/scratch/nyc-report \
  --json-out     /path/to/scratch/results.json \
  [test/somefile.js ...]
```

- Omit the trailing file list to run the full `test/` tree recursively.
- Pass one or more specific test files while iterating - it's much
  faster. Only do full-suite runs when you need the whole picture (e.g.
  before a merge, or for a baseline/status snapshot).
- `--json-out` is optional; when given, mocha's JSON reporter output
  (pass/fail/pending counts and details) is written there so a script can
  read it back without re-running anything.
- The nyc coverage gate (`all: true`, 99% statements/lines/functions,
  94.8% branches, from `packages/concerto-core/package.json`) is measured
  and enforced on every run, so a single-file run will normally report a
  non-zero exit code even when every test in that file passes - it hasn't
  exercised the rest of the codebase. Check the mocha pass/fail counts
  (or `--json-out`) for whether the tests themselves passed; treat the
  nyc-threshold exit code as informative only outside full-suite runs.

## Before you build

`concerto-core` depends on the workspace builds of `concerto-util`,
`concerto-cto`, and (at test time only, via `test/decoratormanager.js`)
`concerto-vocabulary`, none of which npm builds automatically as part of
installing `concerto-core` alone. From the monorepo root:

```sh
npm ci
npm run build -w packages/concerto-util
npm run build -w packages/concerto-cto
npm run build -w packages/concerto-core
npm run build -w packages/concerto-vocabulary
```

(`test/1.0.0/validate.js` and other fixtures need `packages/concerto-core/dist/`
to exist.)

## Baseline status (see `baseline.json` for full numbers)

The TS reference suite is **not fully green in this sandboxed
environment**: one test (`ModelLoader #loadModelFromUrl should load
models`) fails because it fetches a model over live HTTP, which the
sandbox's egress proxy blocks (403). That single blocked test is also why
nyc's statement/line coverage falls just short of the 99% gate (98.95%
statements, 98.96% lines) while branches (95.8%) and functions (99.18%)
clear it. This is an environment limitation, not a code regression -
re-run with real network access to confirm a fully green baseline.
