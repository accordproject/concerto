# P5-01a gate dry run — 2026-09-25

Two `migration/gate/run.mjs` runs against the integration branch head
(`claude/tender-pascal-ocwf9q` @ `82f1dd05e` / `concerto-rust` @ `8a0cd4f`),
in a worktree of each repo (see `migration/gate/run.mjs`'s own header for
how to reproduce). Full logs are in the two timestamped subdirectories next
to this file; this is the human-readable rollup referenced from the P5-01a
status comment on accordproject/concerto-rust#145.

The first run (`2026-09-25T16-14-43-032Z`) covers `status.mjs` (full, not
`--fast`), guardrails, conformance, WASM build/size/smoke, and the native
oracle harness. The second (`2026-09-25T16-26-00-974Z`) re-runs the oracle
corpus coverage step and the `CONCERTO_ENGINE=rust` core suite after fixing
a setup bug found in the first run (see below) — read it for those two
steps' numbers.

## §0 criterion-by-criterion

| § | Criterion | Result | Verdict |
|---|---|---|---|
| 0.1/0.2 | B+W tests pass, `CONCERTO_ENGINE=rust` | 1299/1308 passing, 1 failing (`ModelLoader #loadModelFromUrl`, HTTP 403 — the same known sandboxed-network failure as `CONCERTO_ENGINE=ts`), 8 pending. By tag: B 949/956 (1 fail = the network test, 6 pending), M 78/80 (2 pending), **W 272/272 all passing**. | **Effectively green** modulo the known network test |
| 0.3 native | `cargo test --test oracle` against the canonical corpus | 32/32 passing, full corpus replay ok | **PASS** |
| 0.3 WASM | oracle replay through the JS/WASM binding | not run — no `migration/oracle/lib/rust-adapter.js`-driven `replay.js --engine <adapter>` invocation exists yet in this dry run; `status.mjs`'s own `oracle.wasm` field is still `na` | **not judged this run** |
| 0.3 coverage floor | corpus-only nyc coverage of the frozen reference | statements 95.38%, branches **95.85%**, functions 94.26%, lines 95.34%, against the 99/94.8/99/99 floor | **branches clears; statements/functions/lines do not** — see the corpus-currency finding below |
| 0.4 ledger | RUST+HYBRID weighted share | 85.3% (RUST-only 57.2%) | **PASS** (≥70%) |
| 0.5 API/guardrails | `check-guardrails.mjs --base-ref origin/main` | exit 0, "Guardrails OK" | **PASS** |
| 0.6 llvm-cov | `concerto-core` (accordproject-concerto-core) lines % | 92.35% workspace-reported per-crate (92.37% whole `concerto-rust` workspace) | **PASS** (≥90%) |
| 0.6 mutants | `cargo-mutants` on validation modules | not run — long-running, owned by P5-06; the tool is installed in this environment | **not judged this run** |
| 0.7 conformance | `concerto-conformance` local run | **75/75 scenarios passing, 0 failing** | **PASS** (CI status on the current head not checked from here — read the Actions tab) |
| — | WASM size budget | optimised module 1,943,635 bytes, budget 4,194,304 | **PASS**, well inside budget |
| — | WASM Node smoke | `npm run smoke:node` exits 1: 2 of 12 checks fail | **stale test, filed as accordproject/concerto-rust#150** |
| — | TS suite (`CONCERTO_ENGINE=ts`) | 1299/1308 passing, same 1 known network failure; nyc 98.98/95.7/99.18/98.99 vs 99/94.8/99/99 (fails statements+lines by ~0.02, matches the known sandboxed-network-caused gap documented in COORDINATOR.md) | **matches documented known state** |

## Findings

1. **`migration/gate/run.mjs`'s own setup bug, found and fixed in this
   task.** The JS oracle tools (`coverage.sh` → `replay.js`) don't honour
   `CONCERTO_ORACLE_FIXTURES` (that variable is Rust-only) and always
   resolve `migration/oracle/fixtures` relative to the checkout they run
   from. In a worktree that directory doesn't exist (it's gitignored), so
   the first attempt at the coverage step silently "passed" against an
   almost-empty corpus (10.47% statement coverage) instead of failing
   loudly. Fixed by symlinking the canonical corpus into the worktree
   before running, and `run.mjs` now refuses to run if that symlink would
   point somewhere other than the canonical corpus. **CHECKLIST.md
   documents this** so the next agent doesn't lose time to it.

2. **Corpus currency vs. P2-10/P2-11 (needs a maintainer decision, not
   fixed by this task).** P2-10 (#54) and P2-11 (#55) both closed
   `mig:done`, each reporting corpus-only coverage of the reference at or
   above the unit suite's figures. Today, against the **pinned canonical
   corpus** (`oracle-corpus-p107-06aa375`, sha256 verified), corpus
   coverage of the reference is statements 95.38%, branches 95.85%,
   functions 94.26%, lines 95.34% — branches clears the §0.3 floor, the
   other three don't. Since this task must never regenerate the corpus,
   the likely explanation is that **the pinned release draft predates
   some of P2-10's/P2-11's lifted fixtures** landing on the integration
   branch. Whether to re-cut `oracle-corpus-p107-*` (or a new pinned
   release) after those fixtures, or treat the current pin as final, is a
   maintainer call — not resolved here.

3. **`concerto-wasm` Node smoke check is stale**, filed as
   accordproject/concerto-rust#150: two of its assertions describe
   pre-P2-04 behaviour ("enum values have no PropId yet") and a
   single-model-file assumption that no longer holds after later Phase 2/4
   work. Filed against the WASM/P4-01 owner rather than fixed here (out of
   this task's owned paths: `accordproject/concerto` only).

4. **`status.mjs`'s own `engine_modes.rust` field is a hardcoded stub**
   (`na('CONCERTO_ENGINE=rust is not implemented yet (P4-02 ... has not
   landed)')`) that predates P4-02 landing and has not been updated since —
   every Phase 4 group that has merged since makes this stub stale.
   `migration/gate/run.mjs` works around it by running the
   `CONCERTO_ENGINE=rust` suite directly (see the table above) rather than
   trusting `status.mjs` for that number. **Not fixed here** since
   `status.mjs` is existing code outside `migration/gate/`'s new-file scope
   and `migration/bin/`'s additive-only scope; worth a small follow-up task
   to update the stub once P4-08 lands and the flag can be trusted.

5. **P4-08 (#67) is still `mig:backlog`**, not done — the only §0.1/§0.2
   dependency issue #145 named as blocking. Given finding 4, this dry run
   could not distinguish "P4-08's group is fully covered by other views'
   fallbacks already" from "status.mjs would have caught something P4-08
   fixes" — the direct `CONCERTO_ENGINE=rust` run above is real evidence
   either way (1299/1308, same single known failure), but P4-08's own exit
   condition (ModelFile/BaseModelManager B+W tests, specifically) hasn't
   been separately isolated by this dry run.

No unexpected failure required filing beyond #150; the corpus-currency
question (finding 2) is reported to the maintainer rather than filed as an
issue, since fixing it means a corpus-pinning decision, not a code change.
