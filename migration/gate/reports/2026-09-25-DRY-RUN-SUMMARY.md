# P5-01a gate dry run — 2026-09-25

**Superseded revision.** The original version of this file was assembled by
hand from two runs of two different (and, in places, wrong) versions of
`migration/gate/run.mjs` (`2026-09-25T16-14-43-032Z`, `2026-09-25T16-26-00-974Z`
— kept below for history) — the runner itself did not yet judge any §0
threshold, its failure classification could never match, and it skipped the
§0.3 WASM/JS-binding oracle leg entirely. This revision reflects the fixes
made in response to that review and **one single mechanical run of the fixed
`run.mjs`, end to end, on the current heads**
(`claude/tender-pascal-ocwf9q-cloud-2-P5-01a` @ `c318bab69` /
`concerto-rust` @ `8a0cd4f`):

```
node migration/gate/run.mjs \
  --oracle-fixtures /home/user/concerto/migration/oracle/fixtures \
  --rust-root <concerto-rust worktree> \
  --validate-rs-root <concerto-validate-rs worktree> \
  --conformance-root <concerto-conformance worktree> \
  --skip-conformance-install   # already installed
```

Full evidence: `migration/gate/reports/2026-09-25T16-52-08-367Z/{report.json,report.md}`
and its per-step logs. This is now the one report referenced from the P5-01a
status comment on accordproject/concerto-rust#145; the two runs below are
kept only as a record of what the pre-fix runner produced.

## §0 criterion-by-criterion (from the single 2026-09-25T16-52-08-367Z run)

| § | Criterion | Result | Verdict |
|---|---|---|---|
| 0.1/0.2 | B+W tests pass, `CONCERTO_ENGINE=rust` (real run, not the stale `status.mjs` stub) | 1299/1308 passing, 1 failing (`ModelLoader #loadModelFromUrl`, HTTP 403 — same known sandboxed-network failure as `CONCERTO_ENGINE=ts`), 8 pending. By tag: B 949/956 (1 fail = the network test, 6 pending), M 78/80 (2 pending), **W 272/272 all passing** | **expected-pending** (classifier now correctly attributes the network-test reason, not the P4-08 one) |
| 0.1/0.2 (status.mjs) | Same tags, read from `status.json`, plus `status.mjs`'s own §0 threshold checks (ledger, llvm-cov, conformance, B/W tallies) applied by `run.mjs` | ledger 85.3% ≥70 ✓, llvm-cov 92.37% ≥90 ✓, conformance 75/75 ✓, **tag B: 1 failing ✗** (same network test), tag W: 0 failing ✓ | **expected-pending** (P4-08, same network-test caveat) — `run.mjs` now actually judges these thresholds instead of trusting `status.mjs`'s exit 0 |
| 0.3 native | `cargo test --test oracle` against the canonical corpus | 32/32 passing, full corpus replay ok | **PASS** |
| 0.3 WASM (JS binding) | `replay.js --engine migration/oracle/lib/rust-adapter.js`, driven by the built `concerto-engine.cjs` — **now actually run**, not skipped | 16054/16085 passing, **31 failing**, 0 harness errors, 99.81% agreement. All 31 failures are `DecoratorManager.decorateModels`/`DecoratorManager.extractDecorators` fixtures | **unexpected** — a real §0.3 gap through the WASM binding, previously invisible because this leg was never run. See finding 6 below |
| 0.3 coverage floor | corpus-only nyc coverage of the frozen reference | statements 95.38%, branches **95.85%**, functions 94.26%, lines 95.34%, against the 99/94.8/99/99 floor | **unexpected** — branches clears the floor; statements/functions/lines do not (`run.mjs` now checks this instead of reporting the shell exit code) — see the corpus-currency finding below |
| 0.4 ledger | RUST+HYBRID weighted share | 85.3% (RUST-only 57.2%) | **PASS** (≥70%) |
| 0.5 API/guardrails | `check-guardrails.mjs --base-ref origin/main` | exit 0, "Guardrails OK" | **PASS** |
| 0.6 llvm-cov | `concerto-core` (accordproject-concerto-core) lines % | 92.35% per-crate (92.37% whole `concerto-rust` workspace) | **PASS** (≥90%) |
| 0.6 mutants | `cargo-mutants` on validation modules | not run — long-running, owned by P5-06; the tool is installed in this environment | **not judged this run** |
| 0.7 conformance | `concerto-conformance` local run | **75/75 scenarios passing, 0 failing** | **PASS** (CI status on the current head not checked from here — read the Actions tab) |
| — | WASM size budget | optimised module 1,489,538 bytes, budget 4,194,304 | **PASS**, well inside budget |
| — | WASM Node smoke | `npm run smoke:node` exits non-zero (`run.mjs` now folds this into the step's own `ok`, not a separate ignored field) | **unexpected** — filed as accordproject/concerto-rust#150 |

## Findings

1. **Runner fixes made in response to review (this revision).** `migration/gate/run.mjs`:
   - `stepWasm` now returns `ok` from `build_ok && within_budget && install_ok && smoke_ok` — a failing smoke run (or an over-budget module) can no longer read as PASS.
   - `stepOracleCoverage` now compares `coverage.json`'s `corpus.{statements,functions,lines,branches}.pct` against the §0.3 floor (99/99/99/94.8) and only reports `ok: true` when every metric clears it.
   - `stepCorpusProvenance` now reports `ok` from `exists && file_count === 16704`, instead of always reading as a pass regardless of what's on disk.
   - `stepStatus` now applies the §0 thresholds itself (ledger ≥70, llvm-cov ≥90, conformance all-pass, B/W tag tallies) against `status.json`'s metrics, since `status.mjs` itself always exits 0 and never judges them.
   - `classify()` is now keyed on each step's own object key (`status`, `core_suite_rust`), matched against `expectedPendingReasons` entries keyed the same way — the previous version matched substrings of the human-readable step *name* against literal strings (`'status.mjs'`, `'CONCERTO_ENGINE=rust'`) that only appear in names, so no match could ever succeed, and (once that was naively fixed by matching on name) `core_suite_rust`'s name incidentally contains the substring `"status.mjs"` in its own explanatory text, so it collided with `status`'s reason. Keying on the step's own unique dict key avoids both problems.
   - Added `stepOracleWasm`: runs `migration/oracle/bin/replay.js --engine migration/oracle/lib/rust-adapter.js` with `CONCERTO_ENGINE_MODULE` pointed at the built `concerto-wasm/pkg/concerto-engine.cjs` (same module `stepCoreSuiteRust` uses), per CHECKLIST.md §3's documented command. This §0.3 WASM/JS-binding leg is no longer skipped.
   - `main()` now runs `run.mjs` itself end to end on the current heads (see the single report referenced above) rather than being validated only by two runs of two different script revisions.

2. **New finding, only visible now that the WASM oracle leg actually runs
   (§0.3, not fixed by this task — `run.mjs` only checks, per its own
   header comment).** 31 of 16,085 fixtures disagree through the WASM
   binding (99.81% agreement), all under `DecoratorManager.decorateModels`
   and `DecoratorManager.extractDecorators`. Native (`cargo test --test
   oracle`) passes 32/32 on the same corpus, so this is specific to the
   WASM/JS-binding path, not the Rust engine itself. Not filed as a new
   issue by this task (fixing product code is out of scope for
   `migration/gate/`) — flag for the maintainer alongside finding 3 below.
   Detail: `migration/gate/reports/2026-09-25T16-52-08-367Z/oracle-replay-wasm.json`.

3. **Corpus currency vs. P2-10/P2-11 (needs a maintainer decision, not
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

4. **`concerto-wasm` Node smoke check is stale**, filed as
   accordproject/concerto-rust#150: two of its assertions describe
   pre-P2-04 behaviour ("enum values have no PropId yet") and a
   single-model-file assumption that no longer holds after later Phase 2/4
   work. Filed against the WASM/P4-01 owner rather than fixed here (out of
   this task's owned paths: `accordproject/concerto` only).

5. **`status.mjs`'s own `engine_modes.rust` field is a hardcoded stub**
   (`na('CONCERTO_ENGINE=rust is not implemented yet (P4-02 ... has not
   landed)')`) that predates P4-02 landing and has not been updated since —
   every Phase 4 group that has merged since makes this stub stale.
   `migration/gate/run.mjs` works around it by running the
   `CONCERTO_ENGINE=rust` suite directly (see the table above) rather than
   trusting `status.mjs` for that number. **Not fixed here** since
   `status.mjs` is existing code outside `migration/gate/`'s new-file scope
   and `migration/bin/`'s additive-only scope; worth a small follow-up task
   to update the stub once P4-08 lands and the flag can be trusted.

6. **P4-08 (#67) is still `mig:backlog`**, not done — the only §0.1/§0.2
   dependency issue #145 named as blocking. Given finding 5, this dry run
   could not distinguish "P4-08's group is fully covered by other views'
   fallbacks already" from "status.mjs would have caught something P4-08
   fixes" — the direct `CONCERTO_ENGINE=rust` run above is real evidence
   either way (1299/1308, same single known failure), but P4-08's own exit
   condition (ModelFile/BaseModelManager B+W tests, specifically) hasn't
   been separately isolated by this dry run.

No new unexpected failure required filing beyond #150 (finding 4); finding 2
(the WASM oracle leg's 31 disagreements) and finding 3 (corpus currency) are
reported to the maintainer rather than filed as issues, since resolving
either means a product or corpus-pinning decision, not something this
checking-only task makes.

---

## Appendix: the two pre-fix runs (history only, do not treat as evidence)

Kept for the record of what the unfixed runner produced; superseded by the
single run above.

Two `migration/gate/run.mjs` runs against the integration branch head
(`claude/tender-pascal-ocwf9q` @ `82f1dd05e` / `concerto-rust` @ `8a0cd4f`),
in a worktree of each repo. The first run (`2026-09-25T16-14-43-032Z`)
predates `core_suite_rust` existing as a step (an earlier script revision).
The second (`2026-09-25T16-26-00-974Z`) used `--skip-status --skip-wasm
--skip-conformance-install`. Neither run's `report.md` verdicts should be
trusted: the pre-fix runner gave PASS to `stepWasm` regardless of
`smoke_ok`, never compared `stepOracleCoverage`'s numbers to the §0.3 floor,
always passed `stepCorpusProvenance`, and never ran the §0.3 WASM oracle
leg at all.
