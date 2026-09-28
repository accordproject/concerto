# P5-12 SPIKE: instance validation design (2026-09-28) - DO NOT MERGE

Task P5-12 (accordproject/concerto-rust#289) measures three designs for
`ValidatedResource.validate()` against the integration head. Measure only.
The variants are switched at load by `CONCERTO_P512_VARIANT`:

- **A**: `ResourceValidator.checkItem` skips the per-field engine call and runs its existing TS `switch`.
- **B**: `ValidatedResource.validate()` makes one engine call per resource. This uses the additive concerto-wasm binding `ModelManagerHandle.validateResource(wireText, optionsText)`, which runs the existing `validate.rs` instance validator. TS then applies the `$identifier` write-back. The visitor remains the `EngineFastPathUnsupported` fallback.
- **C** (control): the codec and binding lookups are hoisted out of the per-field path, and the per-field engine call is kept.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ @ 2.90GHz, 8 threads, macOS 13 (Darwin 22.6.0), shared with other agents |
| Toolchain | Node v24.21.0, rustc 1.98.1, wasm-bindgen 0.2.128, wasm-opt (binaryen 132) applied by `npm run build` |
| Load average | 1-minute load was 2.2 to 3.2 during the runs. `loadavg` is recorded in every results file. `mds_stores` (Spotlight) was active. |
| Baseline | `concerto` `f4c55d90b`, `concerto-rust` `af207c5`, engine built unmodified (2,757,411 bytes) |
| Variants | the same heads plus this spike. The engine is built with the additive binding (2,761,376 bytes). |
| TS reference | published `@accordproject/concerto-core` 5.0.0 (`migration/oracle/reference`), via `BENCH_CORE_DIST` |
| Runs | `results/P5-12-{ts-reference-5.0.0,baseline-rust-engine,variant-{A,B,C}-rust-engine}-{1,2,3}.json`. Three interleaved rounds with `run-ts.mjs` defaults (5 warm-up + 30 samples). |

Medians in µs per instance (synthetic, 500). × TS uses the median of the three runs.

| Variant | resource.validate(), runs 1 / 2 / 3 | × TS | vs baseline | fromJSON, runs 1 / 2 / 3 | × TS |
|---|---|---|---|---|---|
| TS reference 5.0.0 | 2.4 / 2.4 / 2.3 | 1.0× | - | 9.1 / 8.9 / 9.5 | 1.0× |
| Baseline | 21.0 / 21.7 / 22.3 | **9.2×** | 1.00× | 65.9 / 65.6 / 67.5 | 7.2× |
| A: TS primitive check | 18.0 / 18.6 / 17.3 | **7.6×** | 1.21× faster | 63.9 / 60.8 / 64.9 | 7.0× |
| B: one Rust call per resource | 15.7 / 16.5 / 15.6 | **6.6×** | 1.38× faster | 65.0 / 62.9 / 65.6 | 7.1× |
| C: hoist only | 21.5 / 21.7 / 21.5 | **9.1×** | 1.01× faster | 66.6 / 64.8 / 64.0 | 7.1× |

`fromJSON` does not change in any variant. It already validates inside
`serializerFromJson` (P4-10), so it never reaches these paths.

**Per-call counts** (one `validate()` of the bench instance): baseline and C
make 6 per-field engine calls. A makes none. B makes 1 resource call and no
per-field calls, with 0 fallbacks.

**Profiles** (`node --cpu-prof`, 200,000 `validate()` calls):

- **Variant A**: about 70% of the time is still spent crossing the boundary.
  - `ClassDeclaration.getProperties()` takes 47%. It is a view call that rebuilds the property list across WASM on every call.
  - `getProperty()` takes 22%, from the undeclared-field check on each own property.

  So the per-field primitive call accounts for only about 4 µs of the baseline's 21.7 µs. The visitor's introspection calls account for most of the rest.
- **Variant B**: about 72% is the `validateResource` call itself: wire decode, `to_validator_value` and the validator in WASM. That is about 11 µs, against the crate-direct `validate_instance` at about 1.9 µs (P5-10c). Encoding takes about 7%.
  - The first B build called `require()` on each call, and that cost 15%.
  - The write-back called `getIdentifierFieldName()` through the engine, and that cost 7%.
  - Both are fixed in the measured build: the module is memoised, and the write-back reads `$identifierFieldName`.

**Correctness** (quick; no fuzz, no lifted tests):

- **Oracle `Resource.validate`** (75 fixtures, `rust-adapter.js`, canonical corpus): 75/75 for base, A, B and C. Under B, all 75 took the one-call path, with 0 fallbacks.
- **concerto-core suite** (mocha + nyc, one run per variant): 1624 passing, 8 pending and 0 failing in every variant.
  - Base, A and C meet the nyc thresholds.
  - B fails the 99% statements threshold (98.97%) because the bypassed visitor code is no longer covered by `validate()`.
- **Error classes**: string in an Integer field, number in a Boolean field, empty identifier, undeclared field and missing required field all give `ValidationException` in every variant, matching TS 5.0.0. A Double in an Integer field is accepted in every variant, as TS accepts it.

---

# P5-10c: lazy views, full benchmark after parts 1 and 2 (2026-09-27)

Task P5-10c (accordproject/concerto-rust#271) re-runs the full P5-04
suite on the integration heads after lazy views parts 1 and 2 (P5-10a
#269, P5-10b #270) merged. It compares them against the last pre-lazy
integration head (the same "before" build P5-10a used) and the TS
reference, on one machine, interleaved round by round. The crate-direct
criterion suite is re-run too.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 17 GB, Linux, used only by this task |
| Toolchain | Node v22.22.2, rustc 1.94.1, wasm-bindgen 0.2.128, wasm-opt (binaryen 132) applied by `npm run build` |
| Quiet-check | The TS-API runs started when the 1-minute load average was 0.47 (`.longrun/chain.log`), after all builds and the criterion runs had finished. The three rounds took 41 seconds. The criterion runs followed the builds directly (load average 1.1 to 1.5, with no other job running). |
| Pre-lazy ("before") | `concerto` `796669d5c`, `concerto-rust` `5498f61`: the integration head immediately before P5-10a, the same as P5-10a's "before" |
| Lazy ("after") | `concerto` `d2be3f7be`, `concerto-rust` `e7c0163`: the integration head after the P5-10b merge |
| Engine builds | Both built fresh with `npm run build` in `concerto-wasm` (wasm-opt applied): 2,775,931 bytes before and 2,846,550 bytes after, both within the 4 MiB budget |
| TS reference | published `@accordproject/concerto-core` 5.0.0, the oracle's reference |
| TS-API runs | `results/P5-10c-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds, `run-ts.mjs` defaults (5 warm-up + 30 samples) |
| Crate runs | `concerto-rust`'s `benches/results/P5-10c/2026-09-27-rust-crit-{before,after}-{1,2}.json`: two interleaved rounds, criterion defaults |

## Through the TS public API

Medians in µs per model or per instance, for runs 1, 2 and 3. Ratios
use the median of the three runs. `load+validate` is `run-ts.mjs`'s
`validate` metric. The last three columns are earlier tasks' own
engine / TS ratios, for comparison: P5-04b (post-P5-02, on a different
machine, mean of its two runs), P5-06d (after typed deserialisation) and
P5-10a (after lazy views part 1). Only their ratios are comparable, not
their µs.

| Model set | Metric | TS, runs 1 / 2 / 3 | Rust pre-lazy, runs 1 / 2 / 3 | Rust lazy, runs 1 / 2 / 3 | pre-lazy / TS | **lazy / TS** | speed-up | P5-04b | P5-06d | P5-10a |
|---|---|---|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 37.3 / 35.9 / 33.5 | 520.8 / 416.5 / 429.3 | 148.8 / 145.8 / 149.2 | 12.0× | **4.1×** | 2.89× | 16.9× | 14.9× | 4.6× |
| concerto-core-test-data | load+validate | 71.2 / 57.7 / 60.9 | 536.0 / 568.6 / 582.2 | 224.0 / 191.7 / 184.7 | 9.3× | **3.2×** | 2.97× | 18.7× | 8.2× | 3.0× |
| concerto-core-test-data | validateAst | 588.6 / 541.3 / 485.4 | 954.4 / 883.2 / 1163.6 | 874.1 / 970.4 / 957.3 | 1.8× | **1.8×** | 1.00× | 1.5× | 1.4× | 1.8× |
| conformance | load | 13.4 / 14.8 / 13.4 | 134.5 / 128.6 / 143.7 | 51.7 / 61.5 / 70.2 | 10.0× | **4.6×** | 2.19× | 28.6× | 10.4× | 5.3× |
| conformance | load+validate | 27.7 / 19.3 / 20.0 | 299.7 / 244.1 / 273.5 | 180.4 / 159.9 / 160.7 | 13.7× | **8.0×** | 1.70× | 26.0× | 12.1× | 8.1× |
| conformance | validateAst | 209.3 / 191.6 / 199.2 | 548.7 / 550.4 / 486.0 | 548.2 / 504.3 / 541.0 | 2.8× | **2.7×** | 1.01× | 2.1× | 2.4× | 2.6× |
| synthetic-large | load | 655.9 / 571.5 / 560.5 | 19819.6 / 20377.5 / 20938.4 | 8431.8 / 6302.6 / 7089.7 | 35.7× | **12.4×** | 2.87× | 65.4× | 28.6× | 10.3× |
| synthetic-large | load+validate | 1993.4 / 1704.6 / 1558.1 | 23417.2 / 25671.8 / 25584.9 | 10190.5 / 12117.6 / 9527.1 | 15.0× | **6.0×** | 2.51× | 29.2× | 9.0× | 5.2× |
| (synthetic, 500) | fromJSON | 6.8 / 6.5 / 5.6 | 41.3 / 41.7 / 36.9 | 38.0 / 37.8 / 40.9 | 6.3× | **5.8×** | 1.09× | 6.2× | 7.0× | 6.4× |
| (synthetic, 500) | resource.validate() | 1.6 / 1.7 / 1.4 | 15.3 / 14.7 / 13.8 | 15.9 / 15.6 / 15.1 | 9.2× | **9.7×** | 0.95× | 9.3× | 9.3× | 9.2× |

- **Load and load+validate:** with lazy views, load is 2.2× to 2.9× faster
  than the pre-lazy head, and load+validate is 1.7× to 3.0× faster.
  Against TS, load is now 4.1× to 12.4× slower, and load+validate 3.2×
  to 8.0× slower. P5-04b measured 16.9× to 65.4× for load, and P5-06d
  measured 10.4× to 28.6×.
- **Against P5-10a:** parts 1 and 2 together are within run-to-run noise of
  part 1 alone (P5-10a: load 4.6× to 10.3×, load+validate 3.0× to 8.1×).
  Part 2's deferred decorators, validators and map types do not change
  these three model sets measurably. On this run, test-data and
  conformance load come out a little faster than P5-10a's, and
  synthetic-large load a little slower (its lazy runs spread from 6.3 to
  8.4 ms).
- **validateAst and instance validation** do not use the view layer. They
  are unchanged within noise (0.95× to 1.09×).
- **Parity is not reached.** The Rust engine through the TS API is still
  slower than the TS reference on every operation. The largest remaining
  gap is synthetic-large load (12.4×). The crate itself loads that model
  in about 3.3 ms (below), against TS's 0.6 ms for the whole public-API
  load, so part of that gap is the crate's own floor, not the view layer.

## The Rust crate directly (criterion)

Medians in µs per model or per instance, for runs 1 and 2. The speed-up
uses the mean of the two runs. The crate diff between the two heads is
small: `concerto-core/src/model_manager.rs` (+26) and the #265 native
oracle comparison (`instance/metamodel.rs`), plus the concerto-wasm
bindings, which criterion does not exercise. The last column is P5-06d's
"after" runs (`benches/results/P5-06d/`), from the same machine type.

| Benchmark | Pre-lazy (`5498f61`), runs 1 / 2 | Lazy (`e7c0163`), runs 1 / 2 | Speed-up | P5-06d after, runs 1 / 2 |
|---|---|---|---|---|
| `load`, concerto-core-test-data | 70.6 / 57.9 | 52.5 / 56.2 | 1.18× | 56.2 / 58.5 |
| `load_text_typed`, concerto-core-test-data | 44.1 / 43.7 | 40.5 / 41.3 | 1.07× | 43.8 / 43.7 |
| `load_text_value`, concerto-core-test-data | 64.1 / 64.3 | 68.2 / 65.8 | 0.96× | 62.9 / 66.6 |
| validate, concerto-core-test-data | 57.5 / 53.5 | 48.9 / 53.6 | 1.08× | 53.7 / 56.9 |
| `load`, conformance | 27.6 / 21.9 | 21.5 / 21.1 | 1.16× | 21.3 / 21.4 |
| `load_text_typed`, conformance | 15.2 / 15.4 | 14.8 / 13.4 | 1.09× | 14.6 / 14.9 |
| `load_text_value`, conformance | 25.8 / 25.2 | 25.0 / 25.0 | 1.02× | 23.9 / 24.7 |
| validate, conformance | 25.7 / 24.7 | 25.5 / 19.7 | 1.11× | 25.4 / 25.5 |
| `load`, synthetic-large | 3727.6 / 3309.7 | 3256.3 / 3244.6 | 1.08× | 3323.9 / 3393.6 |
| `load_text_typed`, synthetic-large | 1823.4 / 1793.5 | 1752.3 / 1768.5 | 1.03× | 1770.0 / 1766.9 |
| `load_text_value`, synthetic-large | 3694.2 / 3722.3 | 3831.7 / 3722.5 | 0.98× | 3356.7 / 3721.4 |
| validate, synthetic-large | 3779.5 / 2647.1 | 2963.2 / 2835.1 | 1.11× | 2783.6 / 2921.2 |
| `ModelFile::from_json`, concerto-core-test-data | 54.8 / 52.1 | 52.5 / 53.7 | 1.01× | 51.4 / 52.0 |
| `ModelFile::from_json`, conformance | 18.3 / 18.0 | 18.4 / 18.9 | 0.97× | 18.3 / 19.1 |
| `ModelFile::from_json`, synthetic-large | 3313.2 / 3364.7 | 3377.1 / 3220.9 | 1.01× | 3430.9 / 3120.7 |
| `validate_instance` (500) | 2.0 / 1.9 | 1.9 / 2.0 | 1.02× | 1.9 / 1.9 |

The crate is unchanged within noise, as expected: lazy views change the
TS view layer and add concerto-wasm bindings, not the crate's load or
validate. The pre-lazy runs' first round was noisier (`load` 70.6 and
27.6, synthetic-large validate 3779.5), which accounts for most of the
1.1× to 1.2× "speed-ups".

## Correctness during the run

The P5-10c verification results for the same lazy build (the fuzz run, the
conformance suite and the lazy-views check mode) are reported in
`migration/fuzz/TRIAGE.md` ("P5-10c") and on
accordproject/concerto-rust#271.

---

# P5-10a: lazy views for ModelFile, ClassDeclaration and Property (2026-09-27)

Task P5-10a (accordproject/concerto-rust#269) makes `ModelFile`
declarations, `ClassDeclaration` and `Property` views lazy on the load
path. Each file's view data now crosses the boundary once, in a single
`modelFileViewSnapshot` call, instead of in hundreds of per-element calls.
This re-runs the P5-04 load and load+validate suite (plus the other
`run-ts.mjs` workloads, unchanged) before and after the change, on the
same machine and interleaved round by round.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 17 GB, Linux |
| Toolchain | Node v22.22.2, rustc 1.94.1 |
| Before | `concerto` `796669d5c`, `concerto-rust` `5498f61` (the integration head), `concerto-engine` built with `build.sh` (wasm-opt applied) |
| After | `concerto` `388457398`, `concerto-rust` `cac2772` (P5-10a, integration head merged in), `concerto-engine` built the same way |
| TS reference | published `@accordproject/concerto-core` 5.0.0, the oracle's reference |
| TS-API runs | `results/P5-10a-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds, `run-ts.mjs` defaults (5 warm-up + 30 samples) |

## Through the TS public API

Medians in µs per model or per instance, for runs 1, 2 and 3. The ratios
use the median of the three runs. `load+validate` is `run-ts.mjs`'s
`validate` metric. The P5-04b column is P5-04b's own after / TS ratio
(mean of its two runs). P5-04b ran on a different machine, so only its
ratios, not its µs, are comparable.

| Model set | Metric | TS, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust after, runs 1 / 2 / 3 | before / TS | **after / TS** | speed-up | P5-04b after / TS |
|---|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 32.8 / 34.4 / 24.0 | 443.0 / 446.3 / 493.1 | 124.5 / 149.5 / 156.6 | 13.6× | **4.6×** | 2.99× | 16.9× |
| concerto-core-test-data | load+validate | 69.4 / 64.0 / 56.1 | 534.6 / 551.6 / 567.1 | 150.8 / 190.4 / 203.1 | 8.6× | **3.0×** | 2.90× | 18.7× |
| concerto-core-test-data | validateAst | 509.7 / 535.4 / 517.8 | 946.7 / 926.8 / 995.2 | 976.8 / 928.0 / 904.8 | 1.8× | **1.8×** | 1.02× | 1.5× |
| conformance | load | 12.8 / 13.5 / 12.7 | 142.4 / 156.5 / 163.9 | 77.9 / 68.0 / 64.1 | 12.2× | **5.3×** | 2.30× | 28.6× |
| conformance | load+validate | 22.0 / 20.0 / 19.2 | 278.3 / 263.8 / 357.6 | 179.6 / 153.9 / 162.5 | 13.9× | **8.1×** | 1.71× | 26.0× |
| conformance | validateAst | 228.9 / 205.8 / 206.7 | 538.5 / 534.5 / 568.8 | 539.9 / 547.3 / 422.6 | 2.6× | **2.6×** | 1.00× | 2.1× |
| synthetic-large | load | 970.8 / 672.4 / 546.8 | 22619.3 / 20026.0 / 20393.2 | 7283.7 / 6956.4 / 6618.1 | 30.3× | **10.3×** | 2.93× | 65.4× |
| synthetic-large | load+validate | 2162.6 / 1939.4 / 2052.1 | 25551.8 / 25555.8 / 25704.2 | 10583.1 / 10345.6 / 11651.3 | 12.5× | **5.2×** | 2.41× | 29.2× |
| (synthetic, 500) | fromJSON | 6.6 / 6.9 / 6.8 | 41.0 / 40.3 / 40.4 | 43.9 / 41.7 / 44.0 | 5.9× | **6.4×** | 0.92× | 6.2× |
| (synthetic, 500) | resource.validate() | 1.5 / 1.7 / 1.6 | 15.1 / 15.0 / 15.4 | 11.9 / 15.1 / 19.4 | 9.2× | **9.2×** | 1.00× | 9.3× |

Load gets 2.3× to 3.0× faster and load+validate 1.7× to 2.9× faster than
the integration head. Against the TS reference, load goes from 12.2×–30.3×
slower to 4.6×–10.3× slower, and load+validate from 8.6×–13.9× to
3.0×–8.1×. P5-04b measured 16.9×–65.4× for load; part of that gap closed
earlier (P5-06d and the integration head's other changes), and P5-10a
closes about two thirds of what was left. validateAst and instance
validation do not use the view layer and are unchanged within noise
(0.92× to 1.02×; the `resource.validate()` after runs spread from 11.9 to
19.4 µs). The Rust engine through the TS API is still slower than the TS
reference on every operation, so parity is not reached by part 1 alone.

### Boundary crossings

A crossing probe on a cold load of concerto-core-test-data counts 2,177
engine calls before and 187 after. The per-element calls
(`propertyProcess` 273, `fieldProcess` 238, `classDeclarationProcess` 241,
`getFullyQualifiedName` 257 before) are replaced by one
`modelFileViewSnapshot` call per file, made when its declarations are
first read.

## Correctness

- **concerto-core suite (nyc):** before and after give the same result:
  1,445 pass, 154 pending (the same set) and 1 failure,
  `ModelLoader #loadModelFromUrl`, which needs the network and gets HTTP
  403 in this sandbox. Coverage stays above the thresholds (99.32%
  statements, 96.21% branches, 99.81% functions, 99.31% lines). The same
  holds with `CONCERTO_LAZY_VIEWS_CHECK=1`, with 0 LAZY-CHECK lines.
- **Oracle:** the JS replay through the WASM engine agrees on 16,242 of
  16,242 fixtures (canonical corpus plus supplement, CTO cache rebuilt),
  in normal and check mode. `cargo test --workspace` with
  `CONCERTO_ORACLE_FIXTURES` set passes; `baseline.tsv` is unchanged.
- **Guardrails** pass, including the byte-identical API snapshot.
- **WASM:** `concerto-engine` is 2,807,334 bytes, within the 4 MiB budget.
  The WASM LEG checks pass: fmt, wasm32 clippy `-D warnings`, check,
  `build.sh`, and 84 of 84 `smoke:node` checks.

---

# P5-06d: typed AST deserialisation (2026-09-27)

Task P5-06d (accordproject/concerto-rust#239) adopts the P5-06c spike's
lever 1. When a model's JSON AST is loaded from text, it is now read
straight into typed Rust structs, with no intermediate
`serde_json::Value`. Any document the typed structs do not cover falls back
to the unchanged `Value` path, which keeps error parity. This re-runs the
P5-04 suite unchanged, after P5-02, before and after the change, on the
same machine and interleaved round by round.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 17 GB, Linux |
| Toolchain | Node v22.22.2, rustc 1.94.1 |
| Before | `concerto` `c73e6aa8c`, `concerto-rust` `a2bb5b4` (the post-P5-02 integration head), built as-is |
| After | `concerto-rust` `6afca8a` (P5-06c spike merged onto `a2bb5b4`, then completed); `concerto` unchanged |
| TS reference | published `@accordproject/concerto-core` 5.0.0, the oracle's reference, because P5-02 removed the in-tree TS engine |
| TS-API runs | `results/2026-09-27-P5-06d-{before-rust-engine,after-rust-engine,ts-reference-5.0.0}-{1,2,3}.json`: three interleaved rounds, `run-ts.mjs` defaults (5 warm-up + 30 samples) |
| Crate runs | `concerto-rust`'s `benches/results/P5-06d/2026-09-27-rust-crit-{before,after}-{1,2}.json`: two interleaved rounds, criterion defaults |

## Through the TS public API

Medians in µs per model or per instance, for runs 1, 2 and 3. The ratios
use the median of the three runs. `load+validate` is `run-ts.mjs`'s
`validate` metric, which times a fresh load and `validateModelFiles()`
together.

| Model set | Metric | TS, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust after, runs 1 / 2 / 3 | before / TS | **after / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 37.1 / 34.9 / 27.9 | 611.7 / 498.9 / 516.5 | 465.6 / 518.7 / 522.9 | 14.8× | **14.9×** | 1.00× |
| concerto-core-test-data | load+validate | 64.5 / 83.0 / 67.3 | 1166.2 / 991.6 / 1068.3 | 579.5 / 551.2 / 536.8 | 15.9× | **8.2×** | 1.94× |
| concerto-core-test-data | validateAst | 646.2 / 846.4 / 560.2 | 1001.8 / 897.7 / 1012.2 | 1020.8 / 933.8 / 787.8 | 1.6× | **1.4×** | 1.07× |
| conformance | load | 13.9 / 14.5 / 13.5 | 321.4 / 329.7 / 412.2 | 144.1 / 157.5 / 129.7 | 23.7× | **10.4×** | 2.29× |
| conformance | load+validate | 21.5 / 24.6 / 25.0 | 473.0 / 472.7 / 481.0 | 357.0 / 296.9 / 251.6 | 19.2× | **12.1×** | 1.59× |
| conformance | validateAst | 192.3 / 226.3 / 290.8 | 521.6 / 509.8 / 516.3 | 541.2 / 567.5 / 415.6 | 2.3× | **2.4×** | 0.95× |
| synthetic-large | load | 865.3 / 1111.7 / 929.8 | 33500.6 / 29816.8 / 28770.4 | 20773.1 / 27547.5 / 26634.6 | 32.1× | **28.6×** | 1.12× |
| synthetic-large | load+validate | 1908.7 / 3060.2 / 2879.7 | 42890.7 / 45380.3 / 42472.8 | 26522.5 / 25890.2 / 24629.2 | 14.9× | **9.0×** | 1.66× |
| (synthetic, 500) | fromJSON | 6.3 / 6.4 / 5.8 | 39.0 / 42.8 / 41.6 | 44.1 / 44.0 / 38.9 | 6.6× | **7.0×** | 0.95× |
| (synthetic, 500) | resource.validate() | 1.6 / 1.6 / 1.7 | 15.1 / 12.2 / 14.2 | 15.6 / 11.9 / 14.9 | 8.8× | **9.3×** | 0.95× |

Model load and load+validate get faster by 1.1× to 2.3×. The clearest
gains are conformance load (2.3×) and load+validate on all three sets
(1.6× to 1.9×). synthetic-large load gains only 1.1× on the median, and
its after runs are noisy (20.8 to 27.5 ms). concerto-core-test-data load
does not change (see below). validateAst and instance validation do not
take the typed path, and they are unchanged within noise (0.95× to 1.07×).
The Rust engine through the TS API is still slower than the TS reference
on every operation.

### concerto-core-test-data `load`

This row showed no gain in the spike either. Profiling the TS-API load of
this set shows that `addModelWithDefinitions`, the call the typed path
speeds up, is only about 119 of the roughly 567 µs per model. The rest is
TS `ModelFile` construction and its per-node engine bindings
(`classDeclarationProcess`, `propertyProcess`, `fieldProcess`,
`decoratorProcess`, `modelFilePropertySnapshots`). Those take JS objects,
not JSON text, so typed deserialisation cannot reach them. Speeding them
up would mean changing how the view layer crosses the boundary. That is
not a cheap fix, so this task leaves it alone.

## The Rust crate directly (criterion)

Medians in µs per model or per instance, for runs 1 and 2. The speed-up
uses the mean of the two runs. `load_text_typed` is a new bench, the typed
text-to-`ModelFile` path, and `load_text_value` is the same input through
the `Value` path. Both are measured on the after tree.

| Benchmark | Before, runs 1 / 2 | After, runs 1 / 2 | Speed-up |
|---|---|---|---|
| text→ModelFile, concerto-core-test-data: `Value` path → typed path | - | 62.9 / 66.6 → 43.8 / 43.7 | 1.48× |
| text→ModelFile, conformance: `Value` path → typed path | - | 23.9 / 24.7 → 14.6 / 14.9 | 1.65× |
| text→ModelFile, synthetic-large: `Value` path → typed path | - | 3356.7 / 3721.4 → 1770.0 / 1766.9 | 2.00× |
| `load` (from a parsed `Value`), concerto-core-test-data | 59.3 / 55.3 | 56.2 / 58.5 | 1.00× |
| `load` (from a parsed `Value`), conformance | 18.2 / 21.2 | 21.3 / 21.4 | 0.92× |
| `load` (from a parsed `Value`), synthetic-large | 3495.4 / 3358.6 | 3323.9 / 3393.6 | 1.02× |
| validate, concerto-core-test-data | 49.9 / 52.7 | 53.7 / 56.9 | 0.93× |
| validate, conformance | 25.0 / 25.0 | 25.4 / 25.5 | 0.98× |
| validate, synthetic-large | 3142.9 / 3009.4 | 2783.6 / 2921.2 | 1.08× |
| `ModelFile::from_json`, concerto-core-test-data | 52.6 / 52.7 | 51.4 / 52.0 | 1.02× |
| `ModelFile::from_json`, conformance | 18.6 / 19.0 | 18.3 / 19.1 | 1.01× |
| `ModelFile::from_json`, synthetic-large | 3380.5 / 3074.5 | 3430.9 / 3120.7 | 0.99× |
| `validate_instance` (500) | 1.9 / 1.9 | 1.9 / 1.9 | 1.01× |

Text to `ModelFile` is 1.5× to 2.0× faster on the typed path. The
existing benches start from an already-parsed `Value`, so they do not
touch the typed path, and they are unchanged within noise, as expected.

## Correctness and budget

- **Coverage:** all 1,283 loadable models in the canonical corpus, the
  supplement, the CTO cache and the bench sets take the typed path. None
  falls back, and none disagrees with the `Value` path (the spike reached
  1,282 of 1,283). A differential and drift test in `cargo test`
  (`concerto-core/src/introspect/typed_ast.rs`) fails if the two paths
  disagree or if a model that loads falls back. It runs in CI over the
  in-repo coverage model `concerto-core/tests/typed_ast/`, and over the
  whole corpus when `CONCERTO_ORACLE_FIXTURES` is set.
- **Oracle:** 16,242 fixtures (canonical corpus plus supplement, CTO cache
  rebuilt): 13,921 pass, 0 fail, 0 regressions. `baseline.tsv` is
  unchanged after `ORACLE_UPDATE_BASELINE=1`. The JS replay through the
  WASM engine agrees on 16,242 of 16,242, before and after.
- **concerto-core suite (nyc):** the before and after engines give the same
  result: 1,445 pass, 154 pending and 1 failure. The failure is
  `ModelLoader #loadModelFromUrl`, which needs the network and gets HTTP 403
  in this sandbox. Coverage is identical.
- **Guardrails** pass, including the byte-identical API snapshot.
- **WASM:** `concerto-engine` goes from 2,621,682 to 2,775,834 bytes
  (+154 KB), within the 4 MiB budget. The WASM LEG checks pass: fmt,
  wasm32 clippy `-D warnings`, check, `build.sh`, and 80 of 80
  `smoke:node` checks.

---

# P5-04b: fresh benchmark after P5-02 (2026-09-27)

Task P5-04b (accordproject/concerto-rust#255, under the migration plan
accordproject/concerto-rust#29) re-runs the P5-04 suite on the integration
heads right after P5-02 (accordproject/concerto-rust#73, "Delete
superseded TS logic; remove engine flag") merged.

**Corrected 2026-09-27 (post-review).** The original version of this
section made two claims that don't hold up: a false provenance claim
about the "before" concerto-rust build, and a misattribution of the
quiet-check threshold revision to the maintainer. Both are fixed in place
below (nothing was re-measured); see "Provenance correction" and
"Attribution correction" under Notes and caveats for what changed and why.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 8 cores, 17 GiB, macOS (Darwin 22.6.0), worker local-matt |
| Toolchain | Node v22.23.2, npm 10.9.8, cargo 1.98.1 (797e8a9bc 2026-08-05), rustc 1.98.1 (48a229cea 2026-09-01), wasm-bindgen 0.2.128 |
| Quiet-check | 1-minute load 3.57 at the start of the timed section (threshold revised by the **worker**, not the maintainer, on #255 at 17:06 local, to < 4.0 — **unconfirmed by the coordinator**, see "Attribution correction" below; no cargo/rustc/oracle/mocha/gate process at ≥ 20% CPU); the machine had been busy (load1 up to ~32) for the first ~15 minutes of quiet-polling and settled before any timed run started. Full poll log: `.longrun/p5-04b.log`. |
| Post-P5-02 head ("after") | `concerto` `c73e6aa8c`, `concerto-rust` `a2bb5b4b2` (both `origin/claude/tender-pascal-ocwf9q`) — the heads named on #255 |
| Pre-P5-02 head ("before"), concerto | `concerto` `f1ddaf658` (the integration head immediately before the P5-02 merge commit) |
| concerto-rust used for the "before" column | **`a2bb5b4b2` — the same post-P5-02 build used for "after". This task did not roll concerto-rust back and did not build a pre-P5-02 engine.** See "Provenance correction" below: the true pre-P5-02 concerto-rust integration head is `9fc95b6`, and it differs from `a2bb5b4b2`. |
| TS-API runs | `results/P5-04b-{before-ts,before-rust-engine,after}-run{1,2}.json`: two runs of each, `run-ts.mjs` defaults |
| Crate runs | `concerto-rust`'s `benches/results/2026-09-27T16-29-30Z-rust.json` (criterion defaults) |

**Why a separate "before" worktree.** P5-02 deleted concerto-core's
TS-native implementation and the `CONCERTO_ENGINE=ts\|rust` flag entirely
(`packages/concerto-core/src/engine/index.ts` now always
`require('./rust').loadRustEngine()`). Past the merge there is no live TS
reference in the same checkout to compare against. To still get a TS
reference number, this task built a second, scratch worktree at the
immediate pre-P5-02 **concerto** integration head and ran the TS reference
there; it did **not** build a separate pre-P5-02 **concerto-rust**/WASM
engine — the "Rust before/TS API" column below calls the identical
post-P5-02 `concerto-wasm` build (`a2bb5b4b2`) that the "after" column
uses. So the only thing that actually varies between the "before" and
"after" TS-API runs is the TS-side wrapper code (pre- vs post-P5-02
`packages/concerto-core`), not the Rust engine itself. The pre-P5-02
worktree is not a task branch: it is not committed or pushed.

## Through the TS public API (the exit condition's comparison)

Medians, µs per model or per instance. `load+validate` is `run-ts.mjs`'s
`validate` metric (a fresh load plus `validateModelFiles()`). Ratios use
the mean of the two runs on each side.

| Model set | Metric | TS before (µs) | Rust, post-P5-02 engine via before-TS (µs) | **post-P5-02 (µs)** | before/TS | **post-P5-02/TS** |
|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 37.7 | 636.6 | 636.2 | 16.9× | **16.9×** |
| concerto-core-test-data | load+validate | 76.1 | 1424.7 | 1421.0 | 18.7× | **18.7×** |
| concerto-core-test-data | validateAst | 785.3 | 1203.7 | 1178.3 | 1.5× | **1.5×** |
| conformance | load | 17.6 | 508.0 | 503.9 | 28.9× | **28.6×** |
| conformance | load+validate | 26.9 | 679.9 | 697.5 | 25.3× | **26.0×** |
| conformance | validateAst | 303.8 | 611.1 | 644.1 | 2.0× | **2.1×** |
| synthetic-large | load | 791.3 | 50819.4 | 51776.6 | 64.2× | **65.4×** |
| synthetic-large | load+validate | 2407.2 | 70683.8 | 70348.2 | 29.4× | **29.2×** |
| synthetic-large | validateAst | SKIPPED | SKIPPED | SKIPPED | - | - |
| (synthetic, 500) | fromJSON | 9.2 | 58.4 | 57.3 | 6.4× | **6.2×** |
| (synthetic, 500) | resource.validate() | 2.5 | 22.6 | 23.0 | 9.1× | **9.3×** |

`synthetic-large` `validateAst` is still rejected by both engines, as in
P5-04 and P5-06: its `DateTimeProperty` default value fails `validateAst`'s
strict check.

**post-P5-02 vs "before", same machine:** every ratio above matches its
"before" counterpart to within run-to-run noise (≤ 2%). **This is expected
but does not test P5-02's Rust/WASM change:** as corrected above, the
"before" and "after" Rust-side figures both ran the identical `a2bb5b4b2`
`concerto-wasm` build, so this agreement only shows that P5-02's *TS-side*
change (deleting the already-dead TS-native implementation and the engine
flag) is a performance no-op in Rust mode — which is expected, since that
deletion is not on the Rust-mode call path. It does **not** show anything
about P5-02's own Rust/WASM commit (concerto-wasm's new
`sanitize_lone_surrogate_escapes` pass, `+163/-3` in
`concerto-wasm/src/lib.rs` plus `+18` in `concerto-wasm/scripts/checks.mjs`
per `git diff --stat 9fc95b6 a2bb5b4`), because no pre-P5-02 Rust build was
measured here — see "Provenance correction" below. The exit condition
(≤ 1.0× on all of these) is **not met**, and per the maintainer's decision
on accordproject/concerto-rust#226 (2026-09-26, "accept the current
performance and proceed. There is no lazy-views rollout.") it is not
expected to be met by any change currently planned.

**Comparison with P5-06 (#220) and P5-06a (#226).** Both were run on a
different machine (Linux Xeon, 4 cores), so absolute µs are not
comparable, but the same-machine ratios line up with the same story:
- P5-06 (#220, after its performance pass, merged): load 13.3×–40.4×,
  validateAst 1.7×–2.5×, instance ops 5.7×–6.8×. This run's post-P5-02
  ratios (load 16.9×–65.4×, validateAst 1.5×–2.1×, instance ops 6.2×–9.3×)
  are the same order of magnitude; the larger `synthetic-large` load ratio
  here (65.4× vs 40.4×) is consistent with this machine's TS reference
  being proportionally faster on that one large-model case, not with any
  code change on the TS side — but, as above, this task cannot speak to a
  possible P5-02 Rust-side contribution either way, since it never
  measured a pre-P5-02 Rust build.
- P5-06a (#226, no-go spike): lazy views reached load 4.7×–21.3× and
  load+validate 6.2×–10.3× at best, still short of parity, and the
  maintainer decided not to roll them out. This run's numbers (16.9×–65.4×
  load) confirm that ceiling was never reached in the shipped tree, as
  expected since the spike stayed an unmerged draft.

## The Rust crate directly (criterion)

Medians in ns/op, this machine. These are the crate's own numbers; they
skip the TS<->WASM boundary entirely and are shown for reference only —
compare within this run, not against P5-06's crate table (different
machine: this Mac is consistently ~2.7×–2.9× slower per-op across every
benchmark than the Linux Xeon box used for P5-06/P5-06a, e.g.
`instance_validate/validate_only` 6493 ns here vs 2259 ns there for the
same op count — a hardware difference, not a regression). This table is
the post-P5-02 `a2bb5b4b2` crate only; this task did not build or bench a
pre-P5-02 crate, so it offers no before/after crate comparison (see
"Provenance correction" below).

| Benchmark | n | median (ns/op) | CV |
|---|---|---|---|
| instance_validate/validate_only | 500 | 6493.5 | 7.3% |
| load_validate_concerto-core-test-data/load | 35 | 140311.4 | 6.5% |
| load_validate_concerto-core-test-data/validate | 35 | 158133.5 | 7.5% |
| load_validate_conformance/load | 41 | 59983.4 | 7.0% |
| load_validate_conformance/validate | 41 | 87353.7 | 6.6% |
| load_validate_synthetic-large/load | 1 | 9597086.1 | 7.8% |
| load_validate_synthetic-large/validate | 1 | 8794275.7 | 9.6% |
| validate_metamodel_concerto-core-test-data/concerto-core_from_json | 35 | 139180.9 | 7.6% |
| validate_metamodel_conformance/concerto-core_from_json | 41 | 56169.5 | 8.8% |
| validate_metamodel_synthetic-large/concerto-core_from_json | 1 | 9792664.8 | 8.2% |

## Notes and caveats

- **Provenance correction (post-review, 2026-09-27).** This section
  originally claimed the "before" run used "the same concerto-rust
  `a2bb5b4b2`" and called it "confirmed byte-identical to the pre-P5-02
  concerto-rust head by an empty `git diff 62304c2..a2bb5b4b2`". That is
  wrong: `62304c2` is the tip of the *P5-02* branch itself (`a2bb5b4`'s
  second merge parent), not the pre-P5-02 integration head, so of course
  the merge's tree matches it — that diff being empty proves nothing about
  what P5-02 changed. The actual pre-P5-02 concerto-rust integration head
  is `9fc95b6` (`a2bb5b4`'s *first* parent), and `git diff --stat 9fc95b6
  a2bb5b4` shows real changes: `concerto-wasm/src/lib.rs` (+163/-3,
  including a new `sanitize_lone_surrogate_escapes` pass) and
  `concerto-wasm/scripts/checks.mjs` (+18/-0). So concerto-rust is **not**
  unchanged between the two heads, and every "before" figure in the tables
  above — TS-API and crate alike — in fact used the post-P5-02 WASM
  engine, not a true pre-P5-02 build. The claims this previously supported
  ("concerto-rust is unchanged between the two 'before' heads", "P5-02
  touched no performance-relevant code path", the "expected, not a
  regression" conclusion drawn from that) have been removed or qualified
  in place above. This was not re-measured against a genuine pre-P5-02
  Rust build in this fix; doing that would need building `concerto-wasm`
  from `9fc95b6` in its own worktree and re-running the "before" TS-API
  and crate benchmarks against it.
- **Attribution correction (post-review, 2026-09-27).** This section (and
  the matching #255 report comment) attributed the quiet-check threshold
  revision (1-minute load < 4.0) to "the maintainer". It was the worker's
  own revision: the #255 comment making it is headed "Quiet-check revision
  (local-matt, 17:06 local)" and written in the first person ("My start
  note's threshold..."), revising a start note that is itself labelled
  local-matt. No maintainer (mttrbrts, acting in a decision-making
  capacity) comment endorsed that revision before or after this benchmark
  ran on it. A worker's own revision of its own precondition is not by
  itself authority to treat the resulting run as validated for merge; that
  needs a coordinator comment confirming it on #255, and there isn't one.
  This run's quiet-check basis should be read as **unconfirmed** pending
  that confirmation, not as maintainer-set.
- `wasm-opt` was not installed on this machine, so the `concerto-wasm`
  engine module used for every TS-API run (before and after) was built
  without the size/speed optimisation pass P5-06's build had (`build.sh:
  wasm-opt not found; the module is not size-optimised`). This is shared
  identically across the before and after runs in this task (one engine
  build serves both), so it does not affect the before/after ratios above;
  it does mean the absolute µs figures here are not directly comparable to
  P5-06's, consistent with the cross-machine caveat already noted.
- `benches/extract-results.sh` failed under `sh` on this machine (`line
  47: syntax error near unexpected token '<'`): its `done < <(find ...)`
  is a bash process-substitution construct that plain `sh` (dash on this
  Mac) does not support. The criterion run itself completed and its raw
  output is intact under `benches/target/criterion`; the summary file was
  produced by re-running the same script with `bash` directly, with no
  other changes. Worth fixing the script's shebang/invocation separately
  — flagged, not fixed here, since this task is measurement-only.
- This task's report generator (`gen_report.py`, local to the task
  worktree, not committed) originally passed the wrong loop variable to
  its `load+validate` lookup and reported it as `SKIPPED` throughout; the
  bug was in report generation only, not in the underlying `run-ts.mjs`
  data, and is fixed above.

---

# P5-06a: lazy-views spike (2026-09-26)

Task P5-06a (accordproject/concerto-rust#226, under the migration plan
accordproject/concerto-rust#29). It tests whether rust mode reaches
parity with the TS reference on **load** when it stops building the eager
TS view graph. The design note is on the issue.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 15 GiB, Linux |
| Toolchain | Node v22.22.2, rustc 1.94.1, wasm-bindgen 0.2.128, binaryen 132 |
| Before | `concerto` `9bd0db715`, `concerto-rust` `f324f76`: the integration heads with P5-06 merged in (concerto#1371, concerto-rust#225), built as-is in a separate worktree |
| After | the P5-06a commits on top of those heads. The "after" runs were made on the working tree before the commit, so their JSON records `9bd0db715` as `concerto_commit` |
| Runs | `results/P5-06a-*.json`. Three rounds, each running TS, then Rust before, then Rust after with lazy views off (`CONCERTO_LAZY_VIEWS=0`, same build), then Rust after, back to back. Every run uses the `run-ts.mjs` defaults (5 warm-up, 30 samples). |

## What the prototype does (rust mode only)

- **One crossing.** `new ModelFile(...)` sends the AST into Rust once
  (`ModelManagerHandle.stageModelFile`). Rust loads it there and keeps the
  result in a bounded staging slot.
- **If Rust's load fails**, the ModelFile is built eagerly, exactly as
  before. The TS code then throws the TS error at the same point.
- **If Rust's load succeeds**, only the namespace, imports and model-level
  decorators are set. The `declarations` and `localTypes` fields become
  accessors that build the ClassDeclaration and Property views on first
  use and cache them.
- **No re-sends.** The `rustHandle` mirror registers the staged file
  (`commitStagedModelFile`). `ModelFile.validate()` validates the staged
  or registered file (`modelFileValidateStaged` / `modelFileValidate`)
  instead of sending the AST again.
- **Stays eager:** a manager with decorator factories, a manager with no
  `rustHandle`, and everything when `CONCERTO_LAZY_VIEWS=0`.
- **Guard:** `CONCERTO_LAZY_VIEWS_CHECK=1` builds the views at
  construction anyway, and reports any model Rust accepted but TS
  construction rejects or mutates.

## Through the TS public API

Medians in µs per model or per instance. Ratios use the mean of the three
runs. `load+validate` is `run-ts.mjs`'s `validate` metric: a fresh load
plus `validateModelFiles()`. The speed-up column is Rust before / Rust
after.

|---|---|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 42.0 / 37.3 / 33.4 | 503.3 / 536.3 / 582.9 | 502.1 / 584.2 / 479.8 | 193.6 / 161.8 / 168.7 | 14.4× | 13.9× | **4.7×** | 3.1× |
| concerto-core-test-data | load+validate | 69.9 / 72.1 / 73.4 | 1073.4 / 1106.7 / 1071.8 | 1011.1 / 1022.3 / 1077.1 | 452.4 / 457.9 / 432.5 | 15.1× | 14.4× | **6.2×** | 2.4× |
| concerto-core-test-data | validateAst | 662.9 / 656.1 / 623.1 | 1086.0 / 1125.4 / 1224.1 | 1110.2 / 1080.2 / 1153.4 | 1113.0 / 1065.7 / 1140.1 | 1.8× | 1.7× | **1.7×** | 1.0× |
| conformance | load | 18.3 / 18.8 / 28.5 | 338.3 / 399.2 / 376.6 | 324.1 / 317.9 / 374.8 | 194.9 / 161.9 / 182.5 | 17.0× | 15.5× | **8.2×** | 2.1× |
| conformance | load+validate | 23.3 / 24.8 / 24.5 | 518.9 / 512.2 / 475.1 | 636.2 / 463.1 / 482.5 | 265.5 / 242.2 / 236.4 | 20.8× | 21.8× | **10.3×** | 2.0× |
| conformance | validateAst | 245.1 / 257.8 / 249.5 | 605.9 / 587.5 / 645.8 | 615.4 / 594.5 / 631.3 | 619.0 / 612.9 / 659.1 | 2.4× | 2.4× | **2.5×** | 1.0× |
| synthetic-large | load | 698.0 / 676.0 / 720.2 | 28519.4 / 26763.7 / 43232.6 | 28878.3 / 36453.8 / 27995.4 | 14789.4 / 15015.9 / 14758.6 | 47.0× | 44.6× | **21.3×** | 2.2× |
| synthetic-large | load+validate | 2247.4 / 2224.2 / 2702.0 | 37689.4 / 49576.8 / 36357.3 | 35841.4 / 37175.1 / 35688.4 | 18368.1 / 19220.3 / 24726.8 | 17.2× | 15.2× | **8.7×** | 2.0× |
| synthetic-large | validateAst | SKIPPED | SKIPPED | SKIPPED | SKIPPED | - | - | - | - |
| (synthetic, 500) | fromJSON | 8.9 / 7.9 / 13.6 | 44.0 / 43.5 / 46.9 | 45.7 / 44.5 / 46.6 | 44.5 / 46.9 / 45.7 | 4.4× | 4.5× | **4.5×** | 1.0× |
| (synthetic, 500) | resource.validate() | 2.1 / 2.1 / 2.1 | 17.8 / 17.7 / 19.1 | 18.0 / 17.8 / 18.3 | 18.2 / 17.8 / 19.2 | 8.7× | 8.6× | **8.8×** | 1.0× |

Lazy views make rust-mode load 2.1× to 3.1× faster and load+validate
2.0× to 2.4× faster. validateAst and the instance operations are
unchanged, as expected: the spike does not touch them. **Load is still
4.7× to 21× the TS reference, and load+validate 6.2× to 10×.** Parity
(≤ 1.0×) is not reached.

## Why the rest is out of reach: the crate itself

With lazy views, a rust-mode load is roughly Rust's own load of the AST,
plus the JS->WASM text crossing, plus the TS header. The crate alone,
measured natively (release build, same fixtures, no WASM), is already
slower than the whole TS reference:

| Model set | TS load (µs/model) | Rust native `from_json` (µs/model) | Rust through WASM `stageModelFile` (µs/model) | TS validate part (µs/model) | Rust native `validate_models` (µs/model) |
|---|---|---|---|---|---|
| concerto-core-test-data | ~38 | 60 | 93 | ~34 | 41 |
| conformance | ~22 | 23 | 43 | ~2 | 18 |
| synthetic-large | ~700 | 3,376 | ~5,100 | ~1,700 | 2,121 |

- **Native `from_json`:** about 50% is `serde_json` parsing the text into
  a `Value` (with `IndexMap` insertion for key order), and most of the
  rest is allocation (callgrind).
- **Through WASM:** `dlmalloc` malloc and free are the largest single cost
  in the rust-mode profile (about 20%).
- **Outside the spike's scope, still on the load path:**
  `ModelUtil.parseNamespace` costs about 11 µs per call in rust mode,
  against 1.8 µs in TS, because it calls back into JS for `semver.parse`.

---

# P5-06: after the performance pass (2026-09-26)

Task P5-06 (accordproject/concerto-rust#220, under the migration plan
accordproject/concerto-rust#29) re-ran the P5-04 suite unchanged: the same
`run-ts.mjs` script and fixtures, and the same `cargo bench`, on the same
kind of machine. Each figure is run on this machine back to back, before
and after the change. The profile breakdown the changes are based on is on
the issue.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 15 GiB, Linux |
| Toolchain | Node v22.22.2, rustc 1.94.1, wasm-bindgen 0.2.128, binaryen 132 |
| Before | `concerto` `77189c436`, `concerto-rust` `2fdd791` (both `origin/claude/tender-pascal-ocwf9q`), built as-is |
| After | the P5-06 commits on top of those heads (`concerto-rust` `5e3f330`) |
| TS-API runs | `results/*-P5-06-{before,after}-{ts,rust-engine}.json`: two runs of each, `run-ts.mjs` defaults (5 warm-up + 30 samples) |
| Crate runs | `concerto-rust`'s `benches/results/*-rust-P5-06-{before,after}.json` (criterion defaults) |

## Through the TS public API (the exit condition's comparison)

Medians, µs per model or per instance. `load+validate` is `run-ts.mjs`'s
`validate` metric, which times a fresh load and `validateModelFiles()`
together. "TS" is the TS reference. Its code path is unchanged by P5-06,
and its "after" runs are shown; the "before" runs agree within noise. The
ratios use the mean of the two runs.

| Model set | Metric | TS, run 1 / 2 | Rust engine before, run 1 / 2 | Rust engine after, run 1 / 2 | before / TS | **after / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 33.0 / 53.8 | 1356.3 / 1486.4 | 642.9 / 512.9 | 40.4× | **13.3×** | 2.5× |
| concerto-core-test-data | load+validate | 66.6 / 66.7 | 2048.4 / 2080.3 | 1125.0 / 1140.1 | 27.8× | **17.0×** | 1.8× |
| concerto-core-test-data | validateAst | 638.1 / 671.8 | 4097.7 / 4350.1 | 1116.1 / 1099.8 | 6.5× | **1.7×** | 3.8× |
| conformance | load | 15.9 / 16.0 | 677.7 / 670.5 | 413.0 / 374.5 | 41.9× | **24.6×** | 1.7× |
| conformance | load+validate | 27.7 / 24.0 | 883.1 / 879.2 | 509.8 / 575.9 | 34.4× | **21.0×** | 1.6× |
| conformance | validateAst | 244.8 / 254.8 | 3009.0 / 2923.6 | 616.6 / 632.3 | 11.7× | **2.5×** | 4.8× |
| synthetic-large | load | 697.1 / 676.0 | 70268.3 / 77344.0 | 27890.4 / 27526.6 | 105.6× | **40.4×** | 2.7× |
| synthetic-large | load+validate | 2263.5 / 2167.2 | 94772.7 / 98133.0 | 37687.0 / 38850.8 | 42.4× | **17.3×** | 2.5× |
| synthetic-large | validateAst | SKIPPED | SKIPPED | SKIPPED | - | - | - |
| (synthetic, 500) | fromJSON | 8.7 / 8.1 | 129.4 / 133.7 | 47.2 / 49.3 | 16.5× | **5.7×** | 2.7× |
| (synthetic, 500) | resource.validate() | 3.5 / 2.0 | 71.5 / 64.8 | 18.2 / 19.6 | 32.8× | **6.8×** | 3.6× |

The Rust engine through the TS API is now 1.6× to 4.8× faster than before
P5-06. It is still slower than the TS reference on every operation: 1.7×
to 2.5× on validateAst, 5.7× to 6.8× on instance fromJSON/validate, and
13× to 40× on model load and validate. **The exit condition (≤ 1.0× on all
of these) is not met.** The best achieved ratios are in the "after / TS"
column.
`synthetic-large` validateAst is still rejected by both engines, as in
P5-04: its `DateTimeProperty` default value fails `validateAst`'s strict
check.

JS->WASM calls per operation, counted with a wrapper around the engine
module. The counts are for a first load, before any memo is warm.

| Operation | Before | After |
|---|---|---|
| `new ModelManager()` | 558 | 266 |
| load, concerto-core-test-data (per model) | 103.7 | 62.2 |
| load, conformance (per model) | 20.6 | 15.4 |
| load, synthetic-large (one model) | 5,271 | 1,179 |
| validateModelFiles / validateAst (per model) | 1.1 / 1.1 | 1.1 / 1.1 |

## The Rust crate directly (criterion)

The same benches as Table A below: medians in µs per model or per
instance. These figures are the crate's own speed-up; they do not measure
the boundary.

| Benchmark | Before | After | Speed-up |
|---|---|---|---|
| load, concerto-core-test-data | 96.4 | 50.6 | 1.90× |
| validate, concerto-core-test-data | 67.8 | 57.0 | 1.19× |
| load, conformance | 37.7 | 21.8 | 1.73× |
| validate, conformance | 35.7 | 24.4 | 1.46× |
| load, synthetic-large | 5567.7 | 2789.7 | 2.00× |
| validate, synthetic-large | 3667.6 | 3317.2 | 1.11× |
| `ModelFile::from_json`, concerto-core-test-data | 101.0 | 47.7 | 2.12× |
| `ModelFile::from_json`, conformance | 33.5 | 18.6 | 1.80× |
| `ModelFile::from_json`, synthetic-large | 6538.3 | 2653.3 | 2.46× |
| `validate_instance` (500) | 4.2 | 2.3 | 1.85× |

## What changed

All of these are performance-only. Results and errors are unchanged:
- The oracle replays 16,242 fixtures with 0 regressions, and `baseline.tsv`
  is unchanged after `ORACLE_UPDATE_BASELINE=1`.
- The concerto-core suite passes 1,299 of 1,300 tests in both modes. The
  one failure is `ModelLoader #loadModelFromUrl`, which needs the network
  and gets HTTP 403 in this sandbox; it fails the same way on the unchanged
  base.
- The API snapshot is byte-identical.

The changes, by where the time was going:
- **Module resolution.** `loadEngine` is memoised per specifier, and the
  per-element `require`s in the views are cached.
- **Crossings.**
  - `modelFilePropertySnapshots` gives each `ModelFile` view every
    property's `propertyProcess`/`fieldProcess` snapshot in one call. The
    per-property bindings stay as the fallback, so errors come from the
    same call as before.
  - The pure string `ModelUtil` delegations are memoised by argument.
  - `ModelManagerHandle.epoch()` lets the views cache `getNamespaces()` and
    `modelFileId()` between mutations.
- **The crate.** Changes to `concerto-core` itself:
  - Declaration, property and scalar nodes are deserialised from borrowed
    JSON instead of clones.
  - `is_valid_identifier` has an ASCII fast path.
  - The system and metamodel model files are cached.
  - Compiled `StringValidator` regexes are cached.
  - Super-type chains are memoised, and property lookup no longer clones
    every inherited property.
- **The WASM build** is optimised for speed (`opt-level = 3`,
  `wasm-opt -O3`). The module is 2.56 MB, inside the 4 MiB budget.

## Why load/validate cannot reach parity yet

In rust mode, `concerto-core` builds the full TS view graph of every model
file, as the TS reference does. It then also sends the whole AST across the
boundary (`JSON.stringify`, then a serde parse and `ModelFile::from_json`
in WASM):
- once for the property snapshots;
- once for the `rustHandle` mirror (P4-08);
- once more for `ModelFile.validate()`'s `modelFileValidateDetached`.

Each of those whole-AST round trips alone costs about as much as the TS
reference's entire load of the same model set. Through the public API,
load and validate therefore stay slower than TS for as long as both the TS
graph and the Rust mirror exist.

In the profile after this change:
- The two load-time round trips are about 45% of rust-mode load for
  `synthetic-large`.
- The remaining per-declaration crossings are about 10%:
  `classDeclarationProcess`, `decoratorProcess`, and the synthetic
  `$identifier`/`$timestamp` fields' `propertyProcess`.
- `new ModelManager()` building the system models' views is about 10%.

Closing that gap means not materialising the TS graph in rust mode (the
P5-02 direction), or views that read lazily from the Rust arena instead of
being built eagerly. That is beyond a performance-only change.

---

# Baseline: TS vs Rust (task P5-04)

Committed baseline for accordproject/concerto-rust#75 (task P5-04, under
the migration plan accordproject/concerto-rust#29). Extends the P5-04a
baseline (accordproject/concerto-rust#92, kept below as an appendix) with:

- workload 3 (instance validation) on the Rust side, now that the instance
  validator has landed (task P3-01, `concerto_core::instance::validate`);
- a second Rust comparison point, run through concerto-core's own public
  API rather than the crate directly - see "Two different Rust numbers"
  below, which is the main thing this task adds.

Per the coordinator's release-early note on the issue: this was recorded
before task P5-01's full gate finished, at the exact heads named there -
`concerto` `fe5358c68` and `concerto-rust` `ba060b3` (see "Machine and
toolchain"). It is not re-run after the gate; the maintainer re-runs it
manually later if wanted.

## Two different Rust numbers

There are two legitimately different ways to ask "how fast is Rust", and
this baseline reports both rather than picking one:

1. **The Rust crate directly** (`concerto-rust`'s `benches/`, criterion,
   calling `concerto-core`'s Rust API with no TS or WASM involved at all).
   This is what P5-04a measured, and what "Table A" below updates.
2. **The Rust engine through concerto-core's TS public API**
   (`CONCERTO_ENGINE=rust node migration/bench/run-ts.mjs`, the same
   script, same fixtures, same process as the plain TS run, but every
   `ModelManager`/`Resource` call now round-trips through
   `@accordproject/concerto-engine`, the WASM build of `concerto-wasm`).
   This is what an application actually gets today when it turns the
   engine flag on, and it is "Table B" below - new for this task, and the
   comparison the issue's exit condition and the coordinator's note both
   ask for ("the same set of models for both the finished Rust-backed
   concerto-core and the original TS reference").

These tell different stories - see Table B's summary - and neither one
alone is "the" Rust number.

## Machine and toolchain

| | |
|---|---|
| CPU | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores |
| Memory | 15 GiB |
| OS | Linux |
| Node | v22.22.2 |
| npm | 10.9.7 |
| rustc | 1.94.1 (e408947bf 2026-03-25) |
| cargo | 1.94.1 (29ea6fb6a 2026-03-24) |
| criterion | 0.5.1 |
| wasm-bindgen | 0.2.128 |
| `concerto` commit | `fe5358c68c4f118d8588c43a151a678455ac57aa` (branch `claude/tender-pascal-ocwf9q`) |
| `concerto-rust` commit | `ba060b395d2b7419b2b36c35da76ab0860b96789` (branch `claude/tender-pascal-ocwf9q`) |
| Table A / instance (Rust crate) run | `concerto-rust`'s `benches/results/2026-09-26T14-48-06Z-rust.json` (full run, default features - `validate-rs` is a separate, optional comparison this task did not touch) |
| Table A / B (TS, engine=ts) run | `results/2026-09-26T14-51-10-215Z-ts.json` |
| Table B (TS, engine=rust) run | `results/2026-09-26T14-51-12-291Z-ts-rust-engine.json` |

Every JSON file carries standard deviation and coefficient of variation
(CV) per entry; the tables below report median and CV per workload, per
the issue ("report medians and variance per workload in a markdown
table").

## Table A: the Rust crate directly vs TS (workloads 1 and 2)

Updates the P5-04a table (below) on the current heads. All figures are
medians, per model (µs/op). "Rust /TS" is Rust's time divided by TS's
(< 1 means Rust is faster).

| Model set | n | Phase | TS (µs) | TS CV | Rust crate (µs) | Rust CV | Rust /TS |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 35 | load | 32.3 | 28.0% | 93.0 | 6.2% | 2.88× (slower) |
| concerto-core-test-data | 35 | validate | 66.9 | 17.1% | 66.0 | 10.3% | 0.99× (~even) |
| conformance | 41 | load | 16.2 | 27.2% | 37.3 | 6.6% | 2.30× (slower) |
| conformance | 41 | validate | 24.6 | 27.0% | 34.3 | 12.9% | 1.39× (slower) |
| synthetic-large | 1 (300 decls) | load | 682.7 | 33.5% | 5801.0 | 9.1% | 8.50× (slower)¹ |
| synthetic-large | 1 (300 decls) | validate | 2255.2 | 15.6% | 3496.9 | 5.1% | 1.55× (slower) |

`validate` no longer needs to be skipped on any set - the P5-04a gap
("explicit-over-explicit identity and inherited identifier lookup", plan
§1.2) that skipped `concerto-core-test-data`/`synthetic-large` `validate`
in that baseline has since closed.

¹ `load` (`add_model`/`from_json`, purely structural, no semantic
validation) is the one phase where the Rust crate is consistently slower
than TS across all three sets, most severely on the single large model -
this matches P5-04a's finding and is carried forward unchanged; it was
not this task's scope to investigate.

### Workload 2: validating the metamodel AST

TS's `validateAst` vs `concerto-core`'s `ModelFile::from_json` (the same
structural check `add_model`'s `load` above performs, isolated here on
its own). `concerto-validate-rs`'s half of this workload (the
`validate-rs` feature) is unchanged from P5-04a and not re-run here - see
`concerto-rust`'s `benches/README.md`.

| Model set | n (TS / core) | TS validateAst (µs) | TS CV | core from_json (µs) | core CV | core /TS |
|---|---|---|---|---|---|---|
| concerto-core-test-data | 34 / 35 | 684.5 | 13.9% | 90.7 | 9.0% | **0.133× (7.5× faster)** |
| conformance | 41 / 41 | 244.7 | 4.7% | 33.3 | 16.7%² | **0.136× (7.4× faster)** |
| synthetic-large | 0 / 1 | SKIPPED³ | - | 6202.1 | 14.8% | - |

² Taken from the same-model figure in the `validate_metamodel_conformance`
criterion group (the concerto-core-test-data/conformance sets are
identical AST fixtures for both `add_model`'s `load` and this workload).
³ TS's `validateAst` still rejects every model in `synthetic-large` (a
`DateTimeProperty` with a `defaultValue` - a `validateAst`-specific edge
case, not present in the normal load path); unchanged from P5-04a.

## Table B: the same public API, TS vs the Rust engine (WASM)

**New for this task.** Both rows of each pair are the *same* `run-ts.mjs`
script, same fixtures, same process, only `CONCERTO_ENGINE` differs -
`ts` (the reference implementation) vs `rust` (concerto-core delegating
to `@accordproject/concerto-engine`, the `concerto-wasm` build of the
finished Rust-backed concerto-core, task P4-01/P4-02). This is the "for
the finished Rust-backed concerto-core and the original TS reference, on
the same set of models" comparison the issue and the coordinator's note
ask for, and it is a very different result from Table A:

| Workload | Model set | n | TS (µs) | Rust engine (µs) | Rust engine /TS |
|---|---|---|---|---|---|
| load_validate | concerto-core-test-data | 35 | load: 32.3 | load: 1292.9 | **40.0× (slower)** |
| load_validate | concerto-core-test-data | 35 | validate: 66.9 | validate: 2136.6 | **31.9× (slower)** |
| validate_ast | concerto-core-test-data | 34 | 684.5 | 4431.4 | **6.5× (slower)** |
| load_validate | conformance | 41 | load: 16.2 | load: 757.8 | **46.8× (slower)** |
| load_validate | conformance | 41 | validate: 24.6 | validate: 924.4 | **37.6× (slower)** |
| validate_ast | conformance | 41 | 244.7 | 2952.5 | **12.1× (slower)** |
| load_validate | synthetic-large | 1 | load: 682.7 | load: 73461.5 | **107.6× (slower)** |
| load_validate | synthetic-large | 1 | validate: 2255.2 | validate: 99452.6 | **44.1× (slower)** |
| validate_ast | synthetic-large | 1 | SKIPPED³ | SKIPPED³ | - |
| instance_validate | (synthetic) | 500 | fromJSON: 8.8 | fromJSON: 131.2 | **14.9× (slower)** |
| instance_validate | (synthetic) | 500 | validate_only: 2.1 | validate_only: 64.6 | **30.8× (slower)** |

**Through the TS public API, the Rust engine is uniformly slower than the
TS reference today - by 6× to over 100×**, the opposite conclusion from
Table A (where the Rust crate itself is competitive or faster once
`validate`/`from_json` are isolated). The two tables are both correct;
they measure different things:

- Table A calls `concerto-core`'s Rust API directly, in one process, no
  serialisation boundary.
- Table B's `rust` rows go through `concerto-core`'s TS views
  (`src/engine/`), which for every `ModelManager`/`ModelFile` operation
  in these workloads currently: serialises the AST/value to a JSON
  string on the TS side (`JSON.stringify`), crosses into WASM, and
  (for `add_model`/`validateAst`) re-parses it there - `load_validate`'s
  per-model `add_model` and `validate_ast` each do this once *per model*,
  so the 35- and 41-model sets pay that cost 35 and 41 times over, and
  the single 300-declaration `synthetic-large` model pays it once for a
  much larger string. This matches the migration plan's own risk list
  (§7: "WASM boundary cost and browser sync-compile limits") and the
  P4-01 spike's brief - it is the expected shape of an unoptimised
  per-call FFI boundary, not a defect in the underlying Rust logic
  (Table A's `validate`/`from_json` numbers show that logic is already
  fast). No fast-path batching (e.g. handing the whole model set across
  the boundary once) exists yet for these calls; that is future work, not
  something this benchmarking task changes (see "Scope" below).

³ Both engines reject `synthetic-large` in `validate_ast`, for different
surface reasons that both round-trip to the same TS message: TS's own
`validateAst` schema check rejects the `DateTimeProperty` `defaultValue`
in that model (footnote 3 above); under `CONCERTO_ENGINE=rust`, the
call reaches `rustHandle.validateAst` first and is rejected there before
TS's own check would even run. Either way, `n=0/1` for this cell in both
columns.

## Workload 3: instance validation

New this task on the Rust crate side (task P3-01 landed
`concerto_core::instance::validate::validate_instance` after P5-04a
shipped): `concerto-rust`'s `benches/instance_validate.rs` times
`validate_instance` alone, over the *same* 500-instance workload
`run-ts.mjs` generates (`org.accordproject.bench.instance@1.0.0.Item`,
built directly from its `concerto.metamodel@1.0.0` AST on the Rust side,
since there is no CTO parser there - see that bench file's docs).

There is still no `JSONPopulator`/`Resource` port on the Rust side (task
P3-01b), so only `validate_instance` - the counterpart to TS's
`resource.validate()` alone, **not** to `Serializer#fromJSON`'s combined
populate-and-validate figure - is comparable to the Rust crate:

| Metric | n | TS (µs/op) | TS CV | Rust crate (µs/op) | Rust CV | Rust /TS |
|---|---|---|---|---|---|---|
| `Serializer#fromJSON` (populate + validate) | 500 | 8.8 | 25.2% | - (no populator yet) | - | - |
| `Resource#validate()` / `validate_instance` | 500 | 2.1 | 13.2% | 4.4 | 9.2% | 2.1× (slower) |

The Rust engine (WASM)-via-TS figures for both metrics are in Table B
above (14.9× and 30.8× slower than TS respectively) - the same
boundary-cost story as the rest of that table.

## Reproducibility

Each harness was run twice on this machine, back to back:

- **TS** (`run-ts.mjs`, both engines): every workload's median reproduced
  within about 1-20% between the two runs (worst case:
  `concerto-core-test-data`/`load` under `CONCERTO_ENGINE=rust`, 1548.5 µs
  then 1292.9 µs, ~20%; most workloads were within 10%, consistent with
  P5-04a's "10-15%" finding).
- **Rust crate** (`cargo bench --manifest-path benches/Cargo.toml`): a
  full run (committed above) followed by a `--quick` rerun agreed within
  each benchmark's own confidence interval - criterion's own built-in
  comparison reported "No change in performance detected" (p > 0.05) on
  every one of the nine `load_validate`/`validate_metamodel` benchmarks.

Per-sample CV is noisier for the smallest, sub-100µs-per-op workloads in
this shared, sandboxed environment (GC pauses, scheduler jitter) - see
`migration/bench/README.md`'s "Variance" section - but medians hold up
across reruns, which is what the exit condition asks for.

## Scope

Per the coordinator's note on the issue: this task added only new
benchmark files (`concerto-rust`'s `benches/benches/instance_validate.rs`
and this repo's `run-ts.mjs`/`RESULTS.md` extensions) plus building the
already-existing `concerto-wasm` crate unchanged (`sh build.sh`) so
`CONCERTO_ENGINE=rust` could be exercised - no engine, view, or test
changes. `run-ts.mjs`'s existing `validateAst` stub gained a `getName()`
method (the rust-delegating branch of `BaseModelManager#validateAst`
calls it; the TS branch never needed it) so `validate_ast` could run
under both engines - the only change to a P5-04a file.

## Refreshing this table

```sh
# TS reference
cd concerto
CONCERTO_ENGINE=ts node migration/bench/run-ts.mjs --out migration/bench/results/ts-reference.json

# Rust engine via the TS public API - needs `@accordproject/concerto-engine`
# built first: cd ../concerto-rust/concerto-wasm && sh build.sh
# (see packages/concerto-engine/README.md)
CONCERTO_ENGINE=rust node migration/bench/run-ts.mjs --out migration/bench/results/ts-rust-engine.json

# Rust crate directly (add --features validate-rs for the
# concerto-validate-rs half of workload 2)
cd ../concerto-rust
cargo bench --manifest-path benches/Cargo.toml && ./benches/extract-results.sh
```

Re-run after later phases land, as the plan asks (§4, task P5-04), and
update the tables above from the new `results/*.json` files.

---

## Appendix: the P5-04a baseline (2026-09-24)

Kept verbatim for history; Table A above supersedes its numbers on the
current heads (the `validate` skips it records have since closed).

Committed baseline for accordproject/concerto-rust#92 (task P5-04a).
Recorded from one run of each harness, on the same machine, in the same
session: `run-ts.mjs` with its defaults (5 warm-up + 30 timed samples per
workload) and a full criterion run (criterion's defaults: 3 s warm-up,
100 samples per benchmark - *not* `--quick`).

### Machine and toolchain (P5-04a run)

| | |
|---|---|
| CPU | Intel(R) Xeon(R) Processor @ 2.80GHz, 4 cores |
| Memory | 16 GiB |
| `concerto` commit | `b81adfad8c8d` (branch `claude/tender-pascal-ocwf9q`) |
| `concerto-rust` commit | `fb972a2fdafc` (branch `claude/tender-pascal-ocwf9q-cloud-2-P5-04a`) |
| TS run | `results/2026-09-24T16-46-49-815Z-ts.json` |
| Rust run | `concerto-rust`'s `benches/results/2026-09-24T17-22-00Z-rust.json` (full run, `--features validate-rs`) |

### Workload 1: load, then validate, a model set

| Model set | n | Phase | TS (µs) | TS CV | Rust (µs) | Rust CV | Rust /TS |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 35 | load | 45.5 | 25.3% | 118.8 | 8.6% | 2.61× (slower) |
| concerto-core-test-data | 35 | validate | 105.0 | 23.5% | SKIPPED¹ | - | - |
| conformance | 41 | load | 21.6 | 31.5% | 41.0 | 13.6% | 1.90× (slower) |
| conformance | 41 | validate | 32.7 | 20.0% | 8.0 | 16.9% | **0.24× (4.1× faster)** |
| synthetic-large | 1 (300 decls) | load | 980.4 | 22.0% | 8395.3 | 13.8% | 8.56× (slower) |
| synthetic-large | 1 (300 decls) | validate | 3902.7 | 29.2% | SKIPPED¹ | - | - |

¹ `validate_models` (Rust) did not yet accept these two sets at this
commit (plan §1.2: "explicit-over-explicit identity and inherited
identifier lookup"); closed since - see Table A above.

### Workload 2: validating the metamodel AST (P5-04a run)

| Model set | n (TS / core / validate-rs) | TS validateAst (µs) | concerto-core from_json (µs) | core /TS | concerto-validate-rs (µs) | validate-rs /TS |
|---|---|---|---|---|---|---|
| concerto-core-test-data | 34 / 35 / 17 | 871.2 | 106.5 | **0.122× (8.2× faster)** | 47.2 | **0.054× (18.5× faster)** |
| conformance | 41 / 41 / 40 | 329.9 | 36.8 | **0.112× (9.0× faster)** | 38.4 | **0.116× (8.6× faster)** |
| synthetic-large | 0 / 1 / 0 | SKIPPED | 7706.0 | - | SKIPPED | - |

### Workload 3: instance validation (P5-04a run, TS only)

| Metric | n | TS (µs/op) | TS CV |
|---|---|---|---|
| `Serializer#fromJSON` (populate + validate) | 500 | 10.4 | 9.7% |
| `Resource#validate()` alone | 500 | 3.0 | 18.3% |
