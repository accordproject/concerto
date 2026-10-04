# Gate report — 2026-10-02T07:29:24.051Z

Output of migration/gate/run.mjs (built for task P5-01a; used, unchanged apart from additive fixture-level oracle reporting and this §0 summary, as the P5-01 final-gate runner). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.

## §0 criteria summary

- **§0.1 Behavioural (B) unit tests pass unchanged, CONCERTO_ENGINE=rust: PASS** — tag B: 926/932 passing, 0 failing, 6 pending; suite exit 0 [engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default, built 2026-10-02T07:05:10.263Z)]
- **§0.2 White-box (W) tests pass unchanged (or lifted + signed off): PASS** — tag W: 269/269 passing, 0 failing, 0 pending [engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default, built 2026-10-02T07:05:10.263Z)]
- **§0.3a Oracle corpus coverage of the reference (floor: stmt/fn/line >= 99%, branch >= 94.8%): FAIL** — not available
- **§0.3b Oracle corpus: 0 regressions vs baseline.tsv (16,242 fixtures; 2110 unsupported), native (cargo test --test oracle): PASS** — 13861/16242 pass, 271 fail, 2110 unsupported, 0 harness error, 0 unowned, 0 regressions vs baseline.tsv; unsupported by owner: P2-01+P4-03 2, P2-02+P4-04 17, P2-03+P4-06 8, P2-04+P4-07 1, P2-07+P4-05 15, P2-08+P4-08 61, P3-01b 45, P4-09 119, stays-ts 2113
- **§0.3c Oracle corpus 100% pass, WASM/JS binding (replay.js): FAIL** — 15971/16242 pass (98.3315% agreement) [engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default, built 2026-10-02T07:05:10.263Z)]
- **§0.4 >=70% of concerto-core logic, by weight, runs in Rust (ledger): FAIL** — ledger-weighted Rust+hybrid share: 39.7%
- **§0.5 Public TS API unchanged (exports, deep paths, .d.ts snapshot): PASS** — check-guardrails.mjs exit 0
- **§0.6a concerto-core llvm-cov >= 90% lines: NOT JUDGED** — not available (llvm-cov tool missing or not judged)
- **§0.6b cargo-mutants catch rate on validation modules >= 85%: PASS** — 358/420 caught (94.5%), source: concerto-core/MUTANTS.md (accordproject/concerto-rust#183, P5-06)
- **§0.7 concerto-conformance Rust harness current, local run green: PASS** — 109/109 scenarios passing locally (concerto-conformance 57d3c23); CI status must be read separately (this runner cannot see GitHub Actions)

- *P5-04 benchmark finding (not a §0 criterion; report only)*: concerto#1368 measured the Rust engine at 6x-100x slower than TS through the public API. The maintainer decided to accept current performance (P5-06a/b closed) rather than block the gate on it.


- skip flags used: none (every step enabled)

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

## conformance npm install
- verdict: PASS
- log: conformance-npm-install.log

## WASM build (size budget) + smoke:node
- verdict: PASS

## concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run)
- verdict: PASS
- exit code: 0
- log: core-suite-rust.log
- engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default), built 2026-10-02T07:05:10.263Z

## oracle native (cargo test --test oracle, §0.3 native leg)
- verdict: PASS
- log: oracle-native.log

## oracle reference npm ci (frozen concerto-core 5.0.0)
- verdict: PASS
- exit code: 0
- log: oracle-reference-npm-ci.log

## oracle corpus coverage of the reference (§0.3 floor)
- verdict: unexpected (1 of 1 failing item(s) not in a known, owned set)
- exit code: 1
- log: oracle-coverage.log
  - unexpected: oracle coverage: coverage.sh exited 1 or produced no coverage.json

## oracle WASM/JS-binding leg (§0.3, replay.js --engine rust-adapter.js)
- verdict: unexpected (1 of 1 failing item(s) not in a known, owned set)
- exit code: 1
- log: oracle-wasm.log
- engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default), built 2026-10-02T07:05:10.263Z
  - unexpected: oracle WASM replay: failures: 271 failing fixture(s) but the full list is not available

## status.mjs (full run)
- verdict: unexpected (2 of 2 failing item(s) not in a known, owned set)
- exit code: 0
- log: status-run.log
- engine module: /Users/matt/dev/gh/accordproject/concerto-migration/wt/P5-82/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs (--rust-root default), built 2026-10-02T07:05:10.263Z
  - unexpected: threshold: ledger_weighted_pct_rust_plus_hybrid: §0 threshold not met (value 39.7, floor 70); no known pending owner
  - unexpected: threshold: llvm_cov_lines_pct: not judged: the metric was unavailable in status.json

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: PASS

