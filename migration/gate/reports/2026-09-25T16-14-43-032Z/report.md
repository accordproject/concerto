# Gate dry run — 2026-09-25T16:21:59.228Z

Dry run of migration/gate/run.mjs (task P5-01a). Not the final gate (P5-01) — failures below are triaged as expected-pending, environment-gap, or unexpected.

## oracle corpus provenance (must be the canonical corpus, never self-recorded)
- verdict: PASS

## guardrails (§0.5 API snapshot + guardrails)
- verdict: PASS
- exit code: 0
- log: guardrails.log

## conformance npm install
- verdict: PASS
- log: conformance-npm-install.log

## status.mjs (full run)
- verdict: PASS
- exit code: 0
- log: status-run.log

## oracle native (cargo test --test oracle, §0.3 native leg)
- verdict: PASS
- log: oracle-native.log

## oracle corpus coverage of the reference (§0.3 floor)
- verdict: unexpected
- log: oracle-coverage.log

## WASM build (size budget) + smoke:node
- verdict: PASS

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: SKIPPED/NA: not run by this dry run — long-running, owned by task P5-06; cargo-mutants is installed in this environment for that task to use

