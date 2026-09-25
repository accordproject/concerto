# P5-01b gate dry run #2: 2026-09-25

This is one run of the committed `migration/gate/run.mjs` (P5-01a,
`85ed46a87`), end to end, on the integration heads as they stood when the
run started. **Every step was enabled and no skip flags were used**
(`report.json`: `skipped_steps: []`, every `options.skip*` is `false`,
`fast: false`). Task: accordproject/concerto-rust#182.

```
export CONCERTO_ORACLE_FIXTURES=/home/user/concerto/migration/oracle/fixtures
node migration/gate/run.mjs      # sibling worktrees of concerto-rust,
                                 # concerto-validate-rs, concerto-conformance
```

| Repo | Commit used by the run | Integration tip at hand-off |
|---|---|---|
| concerto | `cf01b466c` (P5-05 merge) | `24cbc5bbb`. The only change is `migration/worker/*-workflow.js` (CARGO_INCREMENTAL). No gate input changed |
| concerto-rust | `3f2b571` | `673a39d`. P2-09c F5–F7 (#181) and DIVERGENCES links. See the tip re-check below |
| concerto-conformance | `9339642` (`main`) | unchanged |
| concerto-validate-rs | `c8e2737` (visibility only, never gated) | unchanged |

The run started at 21:04:27Z and finished at 21:21:26Z. The canonical corpus
was `oracle-corpus-p107-06aa375` with 16,704 files, which is the expected count.

**Evidence:** `migration/gate/reports/2026-09-25T21-04-27-773Z/`:
`report.json`, `report.md`, `status.json`, `oracle-coverage.json` and
`oracle-replay-wasm.json`. The per-step `*.log` files and `logs/` are
gitignored, as in dry run #1. The runner's scratch directory
`oracle-coverage-work/` is not committed.

## §0 criterion by criterion

| § | Criterion | Dry run #2 | Dry run #1 (`18-22-08`) | Verdict (owner) |
|---|---|---|---|---|
| 0.1/0.2 | B+W tests, `CONCERTO_ENGINE=rust` (a real run) | 1299/1308, 1 failing, 8 pending. B 949/956, M 78/80, **W 272/272** | same | **expected-pending** (environment). The only failure is `modelloader.js :: ModelLoader #loadModelFromUrl should load models`, which gets "HTTP request failed with status: 403" from the sandbox egress proxy |
| 0.1/0.2 + 0.4/0.6/0.7 (`status.mjs` thresholds) | ledger, llvm-cov, conformance, B/W | ledger 85.3% ✓. llvm-cov `concerto-core` **93.41%** ✓. Conformance 75/75 ✓. W 0 failing ✓. B has 1 failing, the same network test (TS engine) | llvm-cov was 92.74%, otherwise the same | **expected-pending** (environment) |
| 0.3 native | `cargo test --release --test oracle` | 32/32 | 32/32 | **PASS** |
| 0.3 WASM | `replay.js --engine rust-adapter.js` | 16055/16085 (99.81%), 30 failing, 0 harness errors. All 30 are in the pinned P4-09a set | same 30 | **expected-pending** (P4-09a, #157, local-matt) |
| 0.3 coverage floor | corpus-only nyc coverage of the reference | statements 95.38%, branches 95.85% ✓, functions 94.26%, lines 95.34%, against a floor of 99/94.8/99/99 | same | **unexpected**. Filed as **accordproject/concerto-rust#188** |
| 0.4 ledger | RUST+HYBRID weighted share | 85.3% | 85.3% | **PASS** |
| 0.5 API/guardrails | `check-guardrails.mjs --base-ref origin/main` | exit 0, "Guardrails OK" | same | **PASS** |
| 0.6 llvm-cov | `concerto-core` lines % | 93.41% | 92.74% | **PASS** (≥ 90) |
| 0.6 mutants | cargo-mutants | not run (P5-06, #77) | not run | **not run** |
| 0.7 conformance | local run, installed by the runner | 75/75 | 75/75 | **PASS** |
| — | WASM size budget | 1,546,369 bytes, budget 4,194,304 | 1,516,457 | **PASS** |
| — | WASM Node smoke | **all checks pass** | 3 failing (2 known under #150, 1 new) | **PASS**. #150 fixed all three |

Guardrails, the conformance install, the oracle reference `npm ci` and corpus
provenance all pass.

## Changes since dry run #1

- **WASM smoke is green.** #150 closed as `mig:done` and fixed the two stale
  checks plus the third one routed there ("errors leave through the registered
  factory").
- **The WASM oracle leg is unchanged: 30 of the pinned 31 still disagree.**
  The P4-09a fix (concerto-rust `7dfa18f`, accordproject/concerto-rust#170 and
  accordproject/concerto#1360) has not landed. #157 is `mig:in-review`, and its
  merge is blocked on a concerto-core coverage drop (#157 comment 5838649447).
  The one pinned fixture that passes is still
  `gaps/ModelManager.fromAst/6134444e…`.
- **llvm-cov** rose from 92.74% to 93.41%.
- **Corpus coverage** is unchanged. It is now tracked as #188 instead of only
  a routed comment.

## Tip re-check (concerto-rust `673a39d`)

concerto-rust moved during the run: #181 (P2-09c F5–F7) touches
`introspect/decorator.rs`, `scalar.rs`, `validation.rs` and `baseline.tsv`. The
§0.3 legs are the ones that change could affect, so I re-ran them against the
tip rather than starting another full run. Tip worktree, same canonical
corpus:

- `cargo test --release -p accordproject-concerto-core --test oracle`: **32/32**
- `concerto-wasm/build.sh`: 1,434,860 bytes, within the budget
- `replay.js --engine rust-adapter.js`: 16055/16085 with 0 harness errors. The
  failing set is **identical** to the run's 30, and none falls outside the
  pinned set.

The concerto tip's only change (`24cbc5bbb`) is to the worker workflow
scripts. The verdicts above therefore hold on the current tips.
The llvm-cov and `CONCERTO_ENGINE=rust` suite figures were not re-measured on
`673a39d`.

## Classification check

`classify.mjs` was re-applied independently to every step in `report.json`.
The result matched the recorded `classification` exactly for all 11 steps.
Each verdict was also cross-checked against the raw artefacts:

- the mocha JSON in `core-suite-rust-raw-stdout.log` has 1 failure, the network test with a 403;
- `oracle-replay-wasm.json` has 30 failures, all pinned, 0 harness errors and no truncation;
- `oracle-coverage.json` gives the corpus figures above;
- `guardrails.log` says "Guardrails OK".

`node --test migration/gate/test/*.test.mjs` passes 28/28.

## Findings

1. **One unexpected item, filed as #188.** The §0.3 corpus-coverage floor is
   below 99% for statements, functions and lines. It is the maintainer's call
   whether to re-cut the corpus or revise the floor. No other failure is unexpected.

2. **The classifier's `KNOWN_WASM_SMOKE_FAILURES` is stale.** Both entries
   name #150 as "open", but #150 closed as `mig:done` and the smoke is green.
   This had no effect on this run: the step passed, so no smoke item was
   classified. The entries should be removed, so that a regression in those
   checks reports as `unexpected`. That is a subtraction, and #182 scopes
   runner changes to additive ones, so `classify.mjs` is left unchanged here as
   a follow-up. `KNOWN_ORACLE_WASM_DISAGREEMENTS` (P4-09a, #157, still open) is
   current. Once #170/#1360 land, all 31 should pass and that set can be
   retired.

3. **The expected-pending owners match #182.** The WASM oracle items belong
   to P4-09a (#157). The network test is the sandbox-environment caveat the
   coordinator approved on #145 (comment 5836654215), not a migration task.
   Nothing failing is owned by P4-08 (#67), P4-08a (#173), P2-09c (#171) or the
   P5-05 stage-2 run (#76), so none of them needed a known-set entry.

4. **Environment caveat outside §0: concerto-core's own nyc threshold.**
   `status.json` reports `nyc_coverage.gate_status`: "FAILS: statements, lines
   below threshold" (98.98% / 98.99%, against a threshold of 99). Dry run #1
   showed the same figures. A re-run here showed that the only
   `modelloader.ts` statements not covered are lines 74–75. Those lines are the
   `processFile` callback, which only the network test reaches. With them
   covered the figures would be 3403/3436 = 99.04% and 99.05%, which matches
   the 99.03/99.05 measured with network access on #157. So this is the same
   sandbox network caveat, not a regression. `run.mjs` does not judge this
   metric: it is not a §0 criterion in `CHECKLIST.md`.

5. **Carried over from dry run #1:** `status.mjs`'s `engine_modes.rust` stub is
   still stale. `run.mjs` works around it.

6. **Where the reports go.** #182 says `migration/gate/runs/`, but the runner
   writes to `migration/gate/reports/<stamp>/` and dry run #1 is committed
   there. This report follows that convention so that both dry runs sit side by
   side.
