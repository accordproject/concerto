# Gate report — 2026-09-27T04:42:29.731Z

Output of migration/gate/run.mjs (built for task P5-01a; used, unchanged apart from additive fixture-level oracle reporting and this §0 summary, as the P5-01 final-gate runner). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.

## §0 criteria summary

- **§0.1 Behavioural (B) unit tests pass unchanged, CONCERTO_ENGINE=rust: PASS** — tag B: 950/956 passing, 0 failing, 6 pending; suite exit 0
- **§0.2 White-box (W) tests pass unchanged (or lifted + signed off): PASS** — tag W: 272/272 passing, 0 failing, 0 pending
- **§0.3a Oracle corpus coverage of the reference (floor: stmt/fn/line >= 99%, branch >= 94.8%): PASS** — stmt 99.21%, branch 96.34%, fn 99.01%, line 99.19%
- **§0.3b Oracle corpus: 0 regressions vs baseline.tsv (16,242 fixtures; 2321 unsupported), native (cargo test --test oracle): PASS** — 13921/16242 pass, 0 fail, 2321 unsupported, 0 harness error, 0 unowned, 0 regressions vs baseline.tsv; unsupported by owner: P2-03+P4-05 11, P2-08+P4-08 172, P3-04+P4-08 17, stays-ts 2121
- **§0.3c Oracle corpus 100% pass, WASM/JS binding (replay.js): PASS** — 16242/16242 pass (100% agreement)
- **§0.4 >=70% of concerto-core logic, by weight, runs in Rust (ledger): PASS** — ledger-weighted Rust+hybrid share: 85.3%
- **§0.5 Public TS API unchanged (exports, deep paths, .d.ts snapshot): PASS** — check-guardrails.mjs exit 0
- **§0.6a concerto-core llvm-cov >= 90% lines: PASS** — 94.43% lines
- **§0.6b cargo-mutants catch rate on validation modules >= 85%: PASS** — 358/420 caught (94.5%), source: concerto-core/MUTANTS.md (accordproject/concerto-rust#183, P5-06)
- **§0.7 concerto-conformance Rust harness current, local run green: PASS** — 75/75 scenarios passing locally (concerto-conformance 9339642); CI status must be read separately (this runner cannot see GitHub Actions)

- *P5-04 benchmark finding (not a §0 criterion; report only)*: concerto#1368 measured the Rust engine at 6x-100x slower than TS through the public API. The maintainer decided to accept current performance (P5-06a/b closed) rather than block the gate on it.


- skip flags used: skipConformanceInstall

## TS workspace build (prerequisite for §0.1/§0.2/§0.3a/§0.5)
- verdict: PASS
- exit code: 0
- log: workspace-build.log

## oracle corpus provenance (must be the canonical corpus, never self-recorded)
- verdict: PASS

## guardrails (§0.5 API snapshot + guardrails)
- verdict: PASS
- exit code: 0
- log: guardrails.log

## WASM build (size budget) + smoke:node
- verdict: PASS

## concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run)
- verdict: PASS
- exit code: 0
- log: core-suite-rust.log

## oracle native (cargo test --test oracle, §0.3 native leg)
- verdict: PASS
- log: oracle-native.log

## oracle reference npm ci (frozen concerto-core 5.0.0)
- verdict: PASS
- exit code: 0
- log: oracle-reference-npm-ci.log

## oracle corpus coverage of the reference (§0.3 floor)
- verdict: PASS
- exit code: 0
- log: oracle-coverage.log

## oracle WASM/JS-binding leg (§0.3, replay.js --engine rust-adapter.js)
- verdict: PASS
- exit code: 0
- log: oracle-wasm.log

## status.mjs (full run)
- verdict: PASS
- exit code: 0
- log: status-run.log

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: PASS

