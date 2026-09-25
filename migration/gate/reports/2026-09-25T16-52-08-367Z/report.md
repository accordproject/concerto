# Gate dry run — 2026-09-25T17:04:02.109Z

Dry run of migration/gate/run.mjs (task P5-01a). Not the final gate (P5-01) — failures below are triaged as expected-pending, environment-gap, or unexpected.

## oracle corpus provenance (must be the canonical corpus, never self-recorded)
- verdict: PASS

## guardrails (§0.5 API snapshot + guardrails)
- verdict: PASS
- exit code: 0
- log: guardrails.log

## status.mjs (full run)
- verdict: expected-pending: CONCERTO_ENGINE=rust mode and downstream metrics depend on Phase 4 groups; P4-08 (#67, ModelFile/BaseModelManager views) has not landed
- exit code: 0
- log: status-run.log

## concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run — status.mjs's own engine_modes.rust is stale)
- verdict: expected-pending: as of this dry run its only failure is the known network test (ModelLoader #loadModelFromUrl, HTTP 403 in sandboxed environments) - same failure as CONCERTO_ENGINE=ts; check core-suite-rust.log's failure list before treating a non-zero exit here as new
- exit code: 1
- log: core-suite-rust.log

## oracle native (cargo test --test oracle, §0.3 native leg)
- verdict: PASS
- log: oracle-native.log

## oracle corpus coverage of the reference (§0.3 floor)
- verdict: unexpected
- exit code: 0
- log: oracle-coverage.log

## WASM build (size budget) + smoke:node
- verdict: unexpected

## oracle WASM/JS-binding leg (§0.3, replay.js --engine rust-adapter.js)
- verdict: unexpected
- exit code: 1
- log: oracle-wasm.log

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: SKIPPED/NA: not run by this dry run — long-running, owned by task P5-06; cargo-mutants is installed in this environment for that task to use

