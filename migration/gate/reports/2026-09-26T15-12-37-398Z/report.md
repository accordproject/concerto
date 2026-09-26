# Gate dry run — 2026-09-26T16:11:57.769Z

Dry run of migration/gate/run.mjs (task P5-01a). Not the final gate (P5-01). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.

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

## concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run — status.mjs's own engine_modes.rust is stale)
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
- verdict: NOT RUN: not run by this dry run — long-running, owned by task P5-06; cargo-mutants is installed in this environment for that task to use

