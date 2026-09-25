# Gate dry run — 2026-09-25T18:38:11.730Z

Dry run of migration/gate/run.mjs (task P5-01a). Not the final gate (P5-01). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.

- skip flags used: none (every step enabled)

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
- verdict: expected-pending (owner: environment (sandboxed network egress), not a migration task)
- exit code: 0
- log: status-run.log
  - expected-pending: test: modelloader.js :: ModelLoader #loadModelFromUrl should load models (owner: environment (sandboxed network egress), not a migration task): fetches a model over HTTPS; sandboxed environments block outbound requests (HTTP 403 from the egress proxy). Fails identically under CONCERTO_ENGINE=ts and =rust; passes with network access.

## WASM build (size budget) + smoke:node
- verdict: unexpected (1 of 3 failing item(s) not in a known, owned set)
  - unexpected: wasm smoke check: errors leave through the registered factory (node v22.22.2 (CommonJS)): not in the known-failure set: Error: kind Error
  - expected-pending: wasm smoke check: a new manager holds the system model (node v22.22.2 (CommonJS)) (owner: accordproject/concerto-rust#150 (open, worker:cloud-2)): stale assertion: a new manager now starts with two model files (modelFileIds 0,1), not one
  - expected-pending: wasm smoke check: property handles and snapshots (node v22.22.2 (CommonJS)) (owner: accordproject/concerto-rust#150 (open, worker:cloud-2)): stale assertion 'enum values have no PropId yet (P2-04)': P2-04 (#48) landed and enum values have PropIds

## concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run — status.mjs's own engine_modes.rust is stale)
- verdict: expected-pending (owner: environment (sandboxed network egress), not a migration task)
- exit code: 1
- log: core-suite-rust.log
  - expected-pending: test: modelloader.js :: ModelLoader #loadModelFromUrl should load models (owner: environment (sandboxed network egress), not a migration task): fetches a model over HTTPS; sandboxed environments block outbound requests (HTTP 403 from the egress proxy). Fails identically under CONCERTO_ENGINE=ts and =rust; passes with network access.

## oracle native (cargo test --test oracle, §0.3 native leg)
- verdict: PASS
- log: oracle-native.log

## oracle reference npm ci (frozen concerto-core 5.0.0)
- verdict: PASS
- exit code: 0
- log: oracle-reference-npm-ci.log

## oracle corpus coverage of the reference (§0.3 floor)
- verdict: unexpected (3 of 3 failing item(s) not in a known, owned set)
- exit code: 0
- log: oracle-coverage.log
  - unexpected: oracle coverage: statements: 95.38% < floor 99%; no open task owns it (corpus-currency question routed to the maintainer)
  - unexpected: oracle coverage: functions: 94.26% < floor 99%; no open task owns it (corpus-currency question routed to the maintainer)
  - unexpected: oracle coverage: lines: 95.34% < floor 99%; no open task owns it (corpus-currency question routed to the maintainer)

## oracle WASM/JS-binding leg (§0.3, replay.js --engine rust-adapter.js)
- verdict: expected-pending (owner: P4-09a, accordproject/concerto-rust#157 (open, worker:local-matt))
- exit code: 1
- log: oracle-wasm.log
  - expected-pending: 30 items (oracle-wasm-p4-09a) (owner: P4-09a, accordproject/concerto-rust#157 (open, worker:local-matt)): one of the 31 WASM-leg oracle disagreements found on 2026-09-25 and tracked as P4-09a (native cargo oracle passes the same fixtures, so the gap is in the binding/shim path)

## cargo-mutants on validation modules (§0.6 catch rate)
- verdict: NOT RUN: not run by this dry run — long-running, owned by task P5-06; cargo-mutants is installed in this environment for that task to use

