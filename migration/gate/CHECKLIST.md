# Phase 5 gate checklist (task P5-01a)

Maps each PLAN.md §0 done criterion to the exact command that judges it, the
result that counts as passing, and where the evidence lands. Written so that
once P4-08 (#67) and every other Phase 4 group lands, `migration/gate/run.mjs`
(this directory) can run the whole thing mechanically and produce one report.

This file only *checks*. It never fixes product code, never touches
`packages/concerto-core/test/**`, never edits the canonical oracle corpus or
`baseline.tsv`, and never changes concerto-validate-rs.

## Maintainer decisions this checklist bakes in

- **P4-12 (NAPI) is closed as not needed.** No criterion below depends on a
  NAPI addon; the gate is WASM-only for the JS binding leg of §0.3.
- **concerto-validate-rs is reference-only and is not gated.** `run.mjs`
  still runs its `cargo test` (via `status.mjs`) for visibility, but a
  validate-rs failure is never an "unexpected failure" for this gate and
  never blocks it. D3 (folding it into concerto-rust) has not happened yet.
- **The canonical corpus is pinned.** Every criterion that touches the
  oracle uses the corpus at `migration/oracle/fixtures`, which must be the
  tarball recorded from the draft release
  `oracle-corpus-p107-06aa375` in `accordproject/concerto-rust`
  (sha256 `e8a2bf72c7775a2d45123dea7b6ff897823c74a108603f5412251ced2619fce1`,
  16,704 files, recorded from concerto `06aa375a6`). The gate never records
  its own corpus (no `record-all.sh`, no `build-cto-cache.js`) and never
  hand-edits or hand-merges `baseline.tsv` — a mismatch is regenerated with
  `ORACLE_UPDATE_BASELINE=1` on a full run against the canonical corpus, and
  a merge conflict on it takes the integration branch's version and
  regenerates.
- **The API snapshot must stay byte-identical.** §0.5 is judged by
  `check-guardrails.mjs` rule 4 (the generated `.d.ts` for concerto-core
  against the committed `migration/api-snapshot/`), not by inspection.
- **`CONCERTO_ORACLE_FIXTURES` must be exported** for every command below
  that touches the Rust engine's own oracle harness (`cargo test --test
  oracle`) or `status.mjs`'s Rust cargo test/llvm-cov collection, pointed at
  the canonical corpus (`.../concerto/migration/oracle/fixtures`, the
  checkout whose `migration/ledger/` is present — see the ledger note
  below). Worktrees are nested too deep for the harness to find the corpus
  on its own, and a missing corpus panics naming what it tried; a run
  without the variable set (from a worktree) is not evidence for §0.3's
  native leg.
  **This variable is Rust-only.** The JS-side oracle tools
  (`migration/oracle/bin/{replay.js,coverage.sh,self-check.js}`) do not read
  it at all — they always resolve fixtures relative to `migration/oracle/`
  in whichever concerto checkout they run from, with no override flag on
  `coverage.sh`. From a worktree, symlink the canonical corpus into place
  first:
  ```
  ln -s <canonical concerto>/migration/oracle/fixtures migration/oracle/fixtures
  ```
  A worktree that skips this does not fail loudly — `coverage.sh` and
  `replay.js` exit 0 against a near-empty corpus and report near-zero
  coverage (single digits), which looks like a catastrophic regression but
  is actually just "ran against nothing". Treat a coverage number that low
  as a setup bug, not a finding, and check the symlink before trusting it.
- **The oracle's owner attribution needs `migration/ledger/SEAM_LEDGER.tsv`
  next to the fixtures' grandparent** (`<fixtures>/../../ledger/`). Extract
  or point the corpus only at a concerto checkout whose `migration/ledger/`
  is present, or the report's owner breakdown (`stays-ts` vs `unowned`) is
  silently wrong — pass/fail and `baseline.tsv` are unaffected either way.

## §0 criterion → command → evidence

### 1. Behavioural (B) unit tests pass unchanged against the Rust-backed core

- **Command:**
  ```
  cd packages/concerto-core
  CONCERTO_ENGINE=rust \
  CONCERTO_ENGINE_MODULE=<concerto-rust>/concerto-wasm/pkg/web/concerto-engine.js \
  npx mocha -r ts-node/register --recursive -t 10000 --reporter json test/ \
    > mocha-rust.json
  ```
  (`run.mjs` gets the same numbers for free from `status.mjs`'s
  `metrics.concerto_core_tests.by_tag`, keyed on `CONCERTO_ENGINE=rust`.)
- **Expected:** every test tagged `B` in `migration/tags/test-tags.tsv`
  passes. `test/**` is untouched (never edited to make this true).
- **Evidence:** `migration/gate/reports/<run>/status.json`
  → `metrics.concerto_core_tests.by_tag.tally.B`; raw mocha JSON under
  `migration/gate/reports/<run>/logs/concerto-core/`.

### 2. White-box (W) tests pass unchanged, or are lifted and signed off

- **Command:** same run as §1, tally filtered to tag `W`; cross-checked
  against `migration/oracle/lifted/**` and the sign-off notes referenced
  from `migration/ledger/SUMMARY.md` / the P2-10 tracking issues.
- **Expected:** every `W` test passes via the P1-04 context-trait fallback,
  **or** has a lifted black-box fixture under `migration/oracle/lifted/`
  that a human reviewer signed off (D10). No `W` test is silently skipped.
- **Evidence:** `status.json` → `metrics.concerto_core_tests.by_tag.tally.W`;
  a diff of `migration/oracle/lifted/` file count against the W-test count
  minus fallback-passing W tests (`run.mjs` reports the gap, not a verdict —
  the sign-off itself is a human review artifact, not machine-checkable).

### 3. Oracle corpus: coverage of the reference, 100% on Rust native + WASM

**Corpus currency caveat, found by this task's dry run (2026-09-25).** P2-10
(#54) and P2-11 (#55) both closed `mig:done`, each reporting corpus-only
coverage of the reference at or above the unit suite's own figures. Running
`coverage.sh --with-suite` against the **pinned canonical corpus**
(`oracle-corpus-p107-06aa375`) today gives statements 95.38%, branches
95.85%, functions 94.26%, lines 95.34% — branches clears the 94.8% floor,
but statements/functions/lines fall short of the 99% floor P2-10/P2-11
reported meeting. The likely explanation, given the corpus is pinned and
this task must never regenerate it: **the pinned release draft predates
some of P2-10's or P2-11's lifted fixtures**, i.e. it was cut before those
tasks' final corpus state landed on the integration branch, or before
some later fixture addition. This is a call for the maintainer (whether to
re-cut `oracle-corpus-p107-*` after P2-10/P2-11's fixtures, or accept the
current pin) — this task does not resolve it and does not touch the
corpus. See the P5-01a status comment on accordproject/concerto-rust#145
for the numbers as found.

- **Corpus coverage of the reference (nyc, corpus-only driver):**
  ```
  CONCERTO_ORACLE_FIXTURES=<canonical fixtures> \
  bash migration/oracle/bin/coverage.sh <workdir> --with-suite
  ```
  **Expected:** `migration/oracle/results/coverage.json` → `corpus.statements.pct`
  and `corpus.lines.pct` ≥ 99, `corpus.branches.pct` ≥ 94.8 (the unit suite's
  own coverage of the reference, §0.3's floor).
- **Native (`cargo test`):**
  ```
  CONCERTO_ORACLE_FIXTURES=<canonical fixtures> \
  cargo test --release -p accordproject-concerto-core --test oracle
  ```
  (in the concerto-rust checkout, at the integration branch head).
  **Expected:** `replays_the_oracle_corpus` passes; 100% of fixtures pass,
  0 failures, 0 harness errors.
- **WASM (JS binding):**
  ```
  CONCERTO_ORACLE_FIXTURES=<canonical fixtures> \
  node migration/oracle/bin/replay.js --engine <path to migration/oracle/lib/rust-adapter.js>
  ```
  **Expected:** same as native — 100% pass, 0 fail, 0 harness error.
- **Evidence:** `migration/oracle/results/{coverage,replay-reference,replay-<engine>}.json`,
  copied into `migration/gate/reports/<run>/oracle/`.

### 4. At least 70% of concerto-core logic, by weight, runs in Rust (D1)

- **Command:** read the already-built ledger (regenerate only if stale):
  ```
  node migration/ledger/build-ledger.js   # only if SEAM_LEDGER.tsv is stale
  cat migration/ledger/SUMMARY.md         # §1 headline table
  ```
- **Expected:** `SUMMARY.md` §1 "RUST+HYBRID weighted share (new D1
  denominator)" ≥ 70%.
- **Evidence:** `status.json` → `metrics.ledger.weighted_pct_rust_plus_hybrid`
  (sourced from `SUMMARY.md`, not re-derived — see `status.mjs`'s own
  comment on why re-summing `SEAM_LEDGER.tsv` directly reproduces the
  superseded denominator).

### 5. The public TS API is unchanged (exports, deep paths, `.d.ts` snapshot)

- **Command:**
  ```
  node migration/bin/check-guardrails.mjs --base-ref origin/main
  ```
- **Expected:** exit 0. Rule 4 (the `.d.ts` snapshot) is the one that
  actually judges §0.5; rules 1–3 (test/**, nyc thresholds, index.ts export
  list) are guardrails this task must never trip, not the criterion itself.
- **Evidence:** guardrails' own stdout/exit code, copied into
  `migration/gate/reports/<run>/guardrails.log`.

### 6. Rust test strength: llvm-cov ≥ 90% lines; cargo-mutants ≥ 85% catch rate

- **llvm-cov:**
  ```
  cargo llvm-cov --workspace --summary-only   # in concerto-rust
  ```
  **Expected:** `concerto-core`'s (`accordproject-concerto-core`) lines %
  ≥ 90. Needs the `llvm-tools-preview` rustup component and `cargo-llvm-cov`
  installed — a missing tool is an environment gap to fix, not a §0 failure,
  but it means the criterion has **not been judged** and must be reported as
  such, never silently skipped as "n/a = pass".
- **cargo-mutants (validation modules only, task P5-06):**
  ```
  cargo mutants --package accordproject-concerto-core \
    -- <validation module paths>
  ```
  **Expected:** catch rate ≥ 85%; every surviving mutant becomes a P5-06
  test-writing task.
  This is **distinct** from the oracle's own judge self-check
  (`migration/oracle/results/self-check.json`), which checks that the
  *oracle judge* catches seeded mutants of the *reference*, not that the
  Rust *validation code* is well tested by `cargo-mutants`. `run.mjs` reports
  both under separate labels so they are never conflated.
- **Evidence:** `status.json` → `metrics.rust['concerto-rust'].llvm_cov`;
  `migration/gate/reports/<run>/cargo-mutants.json` (new; §0.6's own report,
  not produced by any existing script yet).

### 7. Upstream conformance: harness current, CI green

- **Command:**
  ```
  cd concerto-conformance && npm install && npm run test:semantic
  ```
- **Expected:** every scenario with a usable AST fixture passes (62/65 per
  PLAN.md §1.2 as of the last count; `run.mjs` reports whatever the run
  says, not a hardcoded number). The conformance **CI job** going green is
  checked separately, by reading the workflow run for the current head via
  the GitHub API/MCP tools — `run.mjs` cannot see GitHub Actions status from
  inside the sandbox, so it reports the local run only and flags the CI
  check as "read the Actions tab / API for this SHA" rather than guessing.
- **Evidence:** `status.json` → `metrics.conformance`.

## Also gated, even though it is not numbered in §0

- **WASM size budget.** `concerto-wasm/build.sh` already fails the build
  itself above `BUDGET` bytes (4 MiB, spike `REPORT.md` §1–2: half of
  Chromium's 8 MiB synchronous-compile ceiling). `run.mjs` runs the build
  and reports the optimised module's byte size either way, pass or fail.
- **WASM smokes.** `concerto-wasm`'s `npm run smoke` (Node + headless
  Chromium, `scripts/node-smoke.{cjs,mjs}` and `chromium-smoke.mjs`).
  `run.mjs` runs it and reports each result file under
  `concerto-wasm/results/smoke-*.json`.
- **Full `status.mjs` (not `--fast`).** `run.mjs`'s baseline step. Includes
  the concerto-core suite in both `CONCERTO_ENGINE=ts` and `rust`, Rust
  `cargo test` + `llvm-cov` for both `concerto-rust` and (visibility only)
  `concerto-validate-rs`, and conformance.

## Failure classification (used by `run.mjs`'s report)

Classification is failure-driven and lives in `migration/gate/classify.mjs`
(unit tests: `node --test migration/gate/test/*.test.mjs`). Each failing
step is broken into failing *items* (a §0 threshold, a mocha test fullTitle,
a WASM smoke check, an oracle fixture, a WASM build/budget/install leg), and
each item is one of:

- **expected-pending** — the item matches an entry in one of the small,
  explicit `KNOWN_*` sets in `classify.mjs`, each naming its owner and
  reason. As of 2026-09-25 those are: the `ModelLoader #loadModelFromUrl
  should load models` network test failing with a network-shaped error
  (owner: the sandboxed environment, not a migration task); the two stale
  `concerto-wasm` smoke checks (accordproject/concerto-rust#150); and up to
  31 `DecoratorManager.decorateModels`/`extractDecorators` disagreements in
  the WASM oracle leg (P4-09a, accordproject/concerto-rust#157).
- **unexpected** — anything else, including a failure the runner cannot
  break down (unparsable output, a failure count that does not match the
  identified failures, a truncated list, a metric that was not judged).
  Filed as a new issue, or routed to the owning task's issue, per this
  task's exit condition.

A step is expected-pending only if every one of its failing items is. P4-08
(#67) has no entry: nothing currently failing is owned by it (its exit
condition is its group's B/W tests and oracle fixtures under
`CONCERTO_ENGINE=rust`, which pass today apart from the network test, and
`status.mjs` runs `CONCERTO_ENGINE=ts` only). A step whose tool is missing
is reported as NOT RUN, never as a pass. The report lists any `--skip-*`
flags used.
