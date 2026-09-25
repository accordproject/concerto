# P5-01a gate dry run — 2026-09-25

This is one mechanical run of the committed `migration/gate/run.mjs`, end to
end, with **every step enabled and no skip flags**. That includes
`conformance_install` and the new `oracle_reference_install`. The report
records the flags it ran with (`report.json` → `skipped_steps: []`,
`report.md` → "skip flags used: none").

```
export CONCERTO_ORACLE_FIXTURES=/home/user/concerto/migration/oracle/fixtures
node migration/gate/run.mjs      # sibling worktrees of concerto-rust,
                                 # concerto-validate-rs, concerto-conformance
```

| Repo | Commit |
|---|---|
| concerto (this branch) | `a0e89a9fe`, the runner commit this report was produced by |
| concerto-rust | `eb37a02`, the `claude/tender-pascal-ocwf9q` tip |
| concerto-conformance | `9339642` (`main`) |
| concerto-validate-rs | `c8e2737`, visibility only, never gated |

**Evidence:** `migration/gate/reports/2026-09-25T18-22-08-435Z/{report.json,report.md}`.
The same directory holds `status.json`, `oracle-coverage.json` and
`oracle-replay-wasm.json`. The per-step `*.log` files and `logs/` are
gitignored. This is now the only report. The earlier partial and pre-fix
runs (`16-14-43`, `16-26-00`, `16-52-08`, which used
`--skip-conformance-install`) were removed. They remain in the history of
this branch at `98f618ee2`.

## How failures are classified

`migration/gate/classify.mjs` does the classification, with unit tests in
`migration/gate/test/`. It works from the failures themselves, never from
which step failed.

Each failing step is broken into failing items: thresholds, test
fullTitles, smoke checks, oracle fixtures, and WASM build/budget/install
legs. An item is `expected-pending` only if it matches one of the small
`KNOWN_*` sets, each of which names an owner and a reason. Everything else
is `unexpected`. That includes output the runner cannot parse and counts
that don't add up. A step is `expected-pending` only if every one of its
items is.

## §0 criterion by criterion

| § | Criterion | Result | Verdict (owner) |
|---|---|---|---|
| 0.1/0.2 | B+W tests, `CONCERTO_ENGINE=rust` (a real run, not `status.mjs`'s stale stub) | 1299/1308 passing, 1 failing, 8 pending. B 949/956 (1 failing), M 78/80, **W 272/272**. The one failure is `modelloader.js :: ModelLoader #loadModelFromUrl should load models`: "HTTP request failed with status: 403" | **expected-pending** (environment: sandboxed network egress, not a migration task) |
| 0.1/0.2 + 0.4/0.6/0.7 (`status.mjs` thresholds) | `status.mjs` runs the suite with `CONCERTO_ENGINE=ts` only. `run.mjs` applies the ledger, llvm-cov, conformance and B/W thresholds | ledger 85.3% ≥ 70 ✓, llvm-cov `concerto-core` 92.74% ≥ 90 ✓, conformance 75/75 ✓, W 0 failing ✓. **B: 1 failing ✗**, the same network test (the TS engine gives the same 403) | **expected-pending** (environment). This is **not P4-08**: see finding 5 |
| 0.3 native | `cargo test --test oracle` on the canonical corpus | 32/32 | **PASS** |
| 0.3 WASM (JS binding) | `replay.js --engine rust-adapter.js` | 16055/16085 (99.81%), 30 failing, 0 harness errors. All 30 are among the 31 fixtures pinned for P4-09a (finding 2) | **expected-pending** (P4-09a, accordproject/concerto-rust#157, local-matt) |
| 0.3 coverage floor | corpus-only nyc coverage of the frozen reference | statements 95.38%, branches 95.85%, functions 94.26%, lines 95.34%. The floor is 99/94.8/99/99 | **unexpected**: statements, functions and lines are below the floor. Routed to the maintainer (finding 3) |
| 0.4 ledger | RUST+HYBRID weighted share | 85.3% | **PASS** (≥ 70) |
| 0.5 API/guardrails | `check-guardrails.mjs --base-ref origin/main` | exit 0, "Guardrails OK" | **PASS** |
| 0.6 llvm-cov | `concerto-core` crate lines % | 92.74% (92.75% across the workspace) | **PASS** (≥ 90) |
| 0.6 mutants | `cargo-mutants` on the validation modules | not run: long-running, owned by P5-06 | **not run** |
| 0.7 conformance | local `concerto-conformance` run, installed by the runner | 75/75 | **PASS** |
| — | WASM size budget | `pkg/concerto_wasm.wasm` is **1,516,457 bytes**, against a budget of 4,194,304 | **PASS** |
| — | WASM Node smoke | 3 failing checks: 2 known, 1 new (finding 4) | **unexpected**: 1 of 3 items. Routed to accordproject/concerto-rust#150 |

Corpus provenance: 16,704 files, which is the canonical count. Guardrails,
the conformance install and the oracle reference `npm ci` all pass.

## Findings

1. **Runner changes in this revision.**
   - `classify()` returned a fixed label per step. It is replaced by
     `classify.mjs`, which classifies each failure, and the runner now
     records what it needs to do that: the failing tests from both engine
     runs (file, fullTitle, tag, message), the smoke rows, and the WASM
     oracle failure list.
   - `concerto-wasm` is built before the steps that load it
     (`core_suite_rust`, `oracle_wasm`).
   - A new `oracle_reference_install` step runs `npm ci` in
     `migration/oracle/reference`, so that `coverage.sh` works from a fresh
     checkout.
   - §0.6 llvm-cov is now judged on the `concerto-core` crate. The earlier
     lookup by package name never matched and fell back to the workspace
     figure without saying so.
   - `report.md` lists the skip flags used.

2. **The WASM oracle leg (§0.3): 30 of the 31 fixtures tracked as P4-09a
   still fail.** The 31 fixtures from the `16-52-08` run are pinned by path
   in `classify.mjs` and owned by P4-09a (#157). An earlier revision of this
   file described them as all `DecoratorManager.decorateModels`/
   `extractDecorators`. That was wrong: **25 are DecoratorManager ops**
   (22 `extractDecorators`, 2 `decorateModels`, 1 `migrateTo`) and **6 are
   ModelManager ops** (3 `addCTOModel`, 2 `validateModelFiles`, 1 `fromAst`).
   On `concerto-rust` @ `eb37a02`, `gaps/ModelManager.fromAst/6134444e…`
   now agrees, which leaves 30. The native cargo oracle passes all of them.
   A disagreement outside the pinned 31 would be `unexpected`.

3. **Corpus currency against P2-10/P2-11 needs a maintainer decision and is
   not fixed here.** P2-10 (#54) and P2-11 (#55) closed as `mig:done`. Yet
   the pinned canonical corpus (`oracle-corpus-p107-06aa375`) covers only
   95.38/94.26/95.34% of the reference's statements/functions/lines, below
   the 99% floor. Branches clears its floor. The likely cause is that the
   pinned corpus predates some of those tasks' lifted fixtures. Whether to
   re-cut the pinned corpus is the maintainer's call. No open task owns this
   gap, so the classifier reports it as `unexpected`.

4. **`concerto-wasm` smoke: a third stale check, routed to #150.**
   "errors leave through the registered factory" fails with `kind Error`
   because it expects `IllegalModel` for a duplicate namespace.
   `concerto-rust` `7a062fa` (P2-08b review, "fix duplicate-namespace
   error") changed that error to TS's plain `Error`. The two checks #150
   originally described still fail and are classified `expected-pending`
   under #150. The third check is `unexpected` until #150 fixes it or adds
   it to the known set.

5. **Nothing failing today is owned by P4-08 (#67), so it has no entry in
   the known set.** #67's exit condition is that its group's B tests and
   oracle fixtures pass with `CONCERTO_ENGINE=rust` and its W tests pass.
   The only B failure in either engine mode is the network test, W is
   272/272, and `status.mjs` runs `CONCERTO_ENGINE=ts` only. The previous
   report's "status → expected-pending (P4-08)" label was therefore a
   misattribution. The tag-B threshold fails only because of the network
   test, which is an environment caveat.

6. **`status.mjs`'s `engine_modes.rust` is a hardcoded stub**
   (`na('... P4-02 ... has not landed')`). `run.mjs` works around it by
   running the `CONCERTO_ENGINE=rust` suite directly. The stub is outside
   this task's owned paths, since `migration/bin/` changes here are
   additive only, so it needs a small follow-up.

Every unexpected item is filed or routed. Finding 4 went to #150 as a
comment. Finding 3 went to the maintainer. P4-09a's items are already
tracked in #157.
