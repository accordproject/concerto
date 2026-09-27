# Gate report — 2026-09-26T23:07:10.866Z

Output of migration/gate/run.mjs (built for task P5-01a; also used, unchanged, as the P5-01 final-gate runner). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.

- skip flags used: skipConformanceInstall

## oracle corpus provenance (must be the canonical corpus, never self-recorded)
- verdict: PASS

## guardrails (§0.5 API snapshot + guardrails)
- verdict: PASS
- exit code: 0
- log: guardrails.log

## status.mjs (full run)
- verdict: PASS
- exit code: 0
- log: status-run.log

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

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: PASS

