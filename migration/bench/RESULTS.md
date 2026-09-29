# P5-41 (F-C): DCS extract results encoded directly, no intermediate Value (2026-09-29)

Task P5-41 (accordproject/concerto-rust#351, F-C from the P5-30 report on
#335) changes only the encode step in concerto-wasm. The three
`decoratorManagerExtract*` bindings and `DcsManagerHandle.extract` (the
resident path the TS API takes by default since P5-27) now serialise the
extract result straight to JSON text. They do this through a borrowed serde
view of the result and of each model AST, so they no longer clone every AST
into a `serde_json::Value` first. The old Value route is kept as the fallback.
Binding names, signatures and output are unchanged: a host test checks that
the text is byte-identical to the Value route, and 27 extract cases (3
bindings × 3 option sets × the 3 dumped inputs) give identical
`JSON.stringify` output on both engines. concerto needs no shim change. The
raw outputs, the driver and the scratch patch to the P5-30 spike are in
`results/P5-41/`.

| | |
|---|---|
| Machine | Cloud container, Intel Xeon @ 2.10GHz, 4 vCPU, Linux 6.18 (the P5-22 machine type) |
| Toolchain | Node v22.22.2, rustc 1.94.1, `concerto-wasm/build.sh` (engine 2,996,949 bytes now, 2,994,581 before) |
| Now | `concerto` `aa2b8c523` (unchanged), `concerto-rust` `adf72f2` (the P5-41 commit on `840fe30`) |
| Before | `concerto-rust` `840fe30` (the integration head) with its engine, timed in the same run against the same concerto dist |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, timed in each round |
| Driver | `results/P5-41/scripts/run.sh`: three interleaved rounds (engine order alternated per round). In each round: (1) `p515-sweep.mjs --ops extract_decorators` through the TS API, on TS 5.0.0, on the Rust engine through the resident path, and on the per-call bindings (`percall.cjs` hides `DcsManagerHandle`), 5 warm-up and 30 samples each. (2) The P5-30 `run-wasm.mjs` binding timing on the dumped extract inputs. (3) The P5-30 native spike binary (glibc and dlmalloc builds) with the old encode and with the direct encode (`P530_ENCODE=direct`, from `scripts/p530-direct-encode.patch` on the spike at `b2bf98c`). Round 1 also runs the allocation-counting build. |
| Quiet gate | Before each timed part: 1-minute load < 2, 5-minute < 3, and no other bench, cargo or mocha process. All 9 parts met it. At the start of each part, 1-minute load was 1.16 to 1.83 and 5-minute load 2.17 to 2.46 (`results/P5-41/loads.txt`). That is busier than P5-27/P5-29 (5-minute load about 1.5 to 1.9), so the noise below is wider. |
| Noise | Round-to-round medians move by up to about ±35% on every engine (here the resident path on synthetic-large read 29.8/43.7/41.5 ms, and TS on core-test-data read 10.8/8.2/12.9 ms). Treat changes under about 25% as noise. The figures are the median over three rounds of each round's median. |

## Where the saving lands: the encode stage (native spike, same code as the binding)

| allocator | set | encode old -> direct (ms) | total old -> direct (ms) |
|---|---|---:|---:|
| dlmalloc (the WASM allocator) | synthetic-large | 7.55 -> **3.47** | 34.13 -> 30.59 |
| dlmalloc | conformance | 1.48 -> **0.56** | 6.80 -> 6.13 |
| dlmalloc | core-test-data | 4.12 -> **1.83** | 18.03 -> 15.22 |
| glibc | synthetic-large | 11.36 -> **5.12** | 46.51 -> 37.65 |
| glibc | conformance | 1.45 -> **0.48** | 8.27 -> 5.29 |
| glibc | core-test-data | 4.07 -> **1.90** | 19.88 -> 16.51 |

Allocations in the encode stage (count-alloc build, round 1):

| set | allocs old -> direct | bytes old -> direct |
|---|---:|---:|
| synthetic-large | 60,017 -> **2** | 6.98 MB -> 2.10 MB |
| conformance | 12,784 -> **2** | 1.33 MB -> 0.26 MB |
| core-test-data | 31,911 -> **2** | 3.52 MB -> 1.05 MB |

The direct encode removes 4.1 ms (dlmalloc) to 6.2 ms (glibc) from the
synthetic-large encode stage, in line with the F-C estimate of -2 to -4 ms
and a little above it. The only allocations left are the output string's two
buffers.

## The binding, from JS (run-wasm.mjs, `decoratorManagerExtractDecorators`)

| set | before (ms) | now (ms) |
|---|---:|---:|
| synthetic-large | 48.50 (48.5/52.8/41.0) | **36.75** (36.7/35.7/44.6) |
| conformance | 10.59 (10.6/10.1/11.5) | **10.01** (8.8/10.0/13.3) |
| core-test-data | 26.66 (25.6/27.4/26.7) | **19.26** (19.3/18.9/28.0) |

## Through the TS public API: `DecoratorManager.extractDecorators`, × TS 5.0.0

| set | TS 5.0.0 (ms) | resident before -> now (ms) | **× TS resident** before -> now | per-call before -> now (ms) | × TS per-call before -> now |
|---|---:|---:|---:|---:|---:|
| synthetic-large | 11.54 | 40.95 -> 41.45 | 3.55 -> **3.59** | 69.22 -> 67.69 | 6.00 -> 5.86 |
| conformance | 3.80 | 10.08 -> 7.99 | 2.65 -> **2.10** | 14.46 -> 16.82 | 3.81 -> 4.43 |
| core-test-data | 10.81 | 20.24 -> 15.02 | 1.87 -> **1.39** | 39.45 -> 38.53 | 3.65 -> 3.56 |

Through the TS API, the change stays inside the noise. The ms saved in the
encode stage is under 10% of the synthetic-large resident time (about 41
ms). At this machine's noise level (±35% between rounds), one run cannot
resolve it. Round 1 alone read 44.4 -> 29.8 ms, but rounds 2 and 3 read
slightly the other way. The conformance and core-test-data resident ratios
moved 21% and 26% in the expected direction, which is also at the edge of
the noise. F-C is therefore a confirmed stage-level saving (half the encode
time, allocations down from tens of thousands to 2). It is not a measured
end-to-end ratio change. The larger costs P5-30 found (extract itself and
the rebuild) are outside this task's scope: F-B (P5-40, #350) and the F-A
design task cover them.

# P5-29 (F5, narrowed): epoch-keyed memo for getNamespaces/getType/resolveType (2026-09-29)

Task P5-29 (accordproject/concerto-rust#334) keeps the engine's answers to
`BaseModelManager.getNamespaces`, `getType` (the fully-qualified name only;
the view is still looked up on every call) and `resolveType` per manager,
keyed on the P5-14 model epoch (`engine/views` `modelGeneration`) and on the
manager's `modelFiles` map and rustHandle. Only answers the engine gave while
the rustHandle mirrored `modelFiles` are kept, errors are never kept, and
`getNamespaces` hands out a copy. The sweep gains three first-read ops
(`get_namespaces_first`, `get_type_first`, `resolve_type_first`), which move
the model epoch before each pass so every read in it misses the memo. The
raw outputs are in `results/P5-29/`.

| | |
|---|---|
| Machine | Cloud container, Intel Xeon @ 2.10GHz, 4 vCPU, Linux 6.18 (the P5-22 machine type) |
| Toolchain | Node v22.22.2, rustc 1.94.1, `concerto-wasm/build.sh` (engine 2,981,988 bytes, the same engine on both sides) |
| Now | `concerto` `4522875be`, `concerto-rust` `2c0bf0c` (unchanged integration head) |
| Before | The integration heads this task started from, timed in the same run: `concerto` `a74d27138` with its concerto-core dist, `concerto-rust` `2c0bf0c` with its engine |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, timed in each round |
| Driver | `p522-run.sh` with `P522_OPS=get_namespaces,get_type,resolve_type,get_namespaces_first,get_type_first,resolve_type_first` and `P522_CRATE=0` (no crate code changed): three interleaved rounds of TS 5.0.0 and the TS API on the Rust engine (now and before, order alternated per round), 5 warm-up and 30 samples each. The before dist has no memo, so its `*_first` ops time the same path as its repeated ops (plus the epoch move) |
| Quiet gate | Before each timed part: 1-minute load < 2, 5-minute < 3, and no other bench, cargo or mocha process. All 9 parts met it; at the start of each part, 1-minute load was 1.12 to 1.51 and 5-minute load 1.48 to 1.55 (`results/P5-29/timed-loads.txt`). The profiles phase (stage split and crossing counts) is ungated; it ran at 1-minute load 1.08 to 1.26 (`profile-loads.txt`). |
| Noise | As in P5-22: round-to-round medians move by up to about ±30% (here the now side's get_namespaces_first on conformance read 15.4/9.7/17.5 us). Treat ratio changes under about 25% as noise. The figures are the median over three rounds of each round's median per item. |

## Before vs now, × TS 5.0.0 (TS API)

| op | set | × TS before | **× TS now** | Rust us/item before -> now | TS 5.0.0 us/item | crossings/item before -> now |
|---|---|---:|---:|---:|---:|---:|
| get_namespaces | core-test-data | 23.31 | **0.50** | 22.81 -> 0.49 | 0.98 | 2.0 -> 0.0 |
| get_namespaces | conformance | 16.23 | **0.30** | 13.38 -> 0.24 | 0.82 | 2.0 -> 0.0 |
| get_namespaces | synthetic-large | 10.86 | **2.46** | 1.41 -> 0.32 | 0.13 | 2.0 -> 0.0 |
| get_type | core-test-data | 8.47 | **0.85** | 5.73 -> 0.57 | 0.68 | 2.0 -> 0.0 |
| get_type | conformance | 4.50 | **1.21** | 2.29 -> 0.62 | 0.51 | 2.0 -> 0.0 |
| get_type | synthetic-large | 2.59 | **1.14** | 1.16 -> 0.51 | 0.45 | 2.0 -> 0.0 |
| resolve_type | core-test-data | 6.44 | **0.32** | 2.28 -> 0.11 | 0.35 | 2.0 -> 0.0 |
| resolve_type | conformance | 6.02 | **0.38** | 1.82 -> 0.12 | 0.30 | 2.0 -> 0.0 |
| resolve_type | synthetic-large | 2.42 | **0.11** | 0.54 -> 0.03 | 0.22 | 2.0 -> 0.0 |
| get_namespaces_first | core-test-data | 13.01 | **17.94** | 10.11 -> 13.93 | 0.78 | 2.0 -> 2.0 |
| get_namespaces_first | conformance | 11.02 | **17.66** | 9.61 -> 15.40 | 0.87 | 2.0 -> 2.0 |
| get_namespaces_first | synthetic-large | 6.62 | **14.89** | 1.08 -> 2.43 | 0.16 | 2.0 -> 2.0 |
| get_type_first | core-test-data | 5.87 | **12.25** | 2.23 -> 4.64 | 0.38 | 2.0 -> 2.0 |
| get_type_first | conformance | 5.31 | **6.42** | 2.39 -> 2.88 | 0.45 | 2.0 -> 2.0 |
| get_type_first | synthetic-large | 2.43 | **2.63** | 1.01 -> 1.09 | 0.42 | 2.0 -> 2.0 |
| resolve_type_first | core-test-data | 7.01 | **9.66** | 1.66 -> 2.29 | 0.24 | 2.0 -> 2.0 |
| resolve_type_first | conformance | 6.76 | **8.63** | 1.95 -> 2.49 | 0.29 | 2.0 -> 2.0 |
| resolve_type_first | synthetic-large | 2.40 | **3.25** | 0.75 -> 1.02 | 0.31 | 2.0 -> 2.0 |

The full tables are `results/P5-29/compare.md`, `table-before.md` and
`table-now.md`.

## F5 (narrowed) against its scope

- **Repeated reads: met.** With no model change between reads, the three
  calls no longer cross into the engine (2.0 crossings per item, `epoch` plus
  the read, down to 0.0). × TS drops from 10.9-23.3× to 0.30-2.46×
  (getNamespaces), 2.6-8.5× to 0.85-1.21× (getType) and 2.4-6.4× to
  0.11-0.38× (resolveType), well beyond the ±25% noise band. getNamespaces on
  synthetic-large stays at 2.46× because TS 5.0.0 answers it in 0.13 us and
  the memo still copies the array; getType still maps the name to its view on
  every call, which is now most of its time (views 51-53%).
- **First reads (just after a model change): slower, by a few microseconds.**
  The crossings are unchanged (2.0 per item), but a first read now also
  starts a fresh memo (a WeakMap lookup, a memo object with two Maps, two
  epoch reads) and stores the answer (a Map insert, or an array copy for
  getNamespaces). Same-run × TS rises on every row: getNamespaces
  13.0/11.0/6.6× to 17.9/17.7/14.9× (+38%, +60%, +125%; Rust time +3.8, +5.8
  and +1.4 us per call), getType 5.9/5.3/2.4× to 12.3/6.4/2.6× (+109%, +21%,
  +8%; +2.4, +0.5, +0.1 us per item), resolveType 7.0/6.8/2.4× to 9.7/8.6/3.3×
  (+38%, +28%, +35%; +0.6, +0.5, +0.3 us per item). Several of these are
  within the noise band on their own (in round 2 the now side read about the
  same as the before side on 5 of the 9 rows), but the now side is slower in
  25 of the 27 round pairs, so the cost is real and small: at most about 6 us per
  getNamespaces call and 2.4 us per getType call. As the scope says, the memo
  helps repeated reads only.

# P5-27 (F6): resident DCS manager with staged-handle results (2026-09-29)

Task P5-27 (accordproject/concerto-rust#332) keeps the DecoratorManager's
input model manager resident in the engine (a `DcsManagerHandle` per source
ModelManager, rebuilt when its epoch or model files change). Each
decorateModels / extract_* call now stages the user model files of its result
directly into the new manager's handle, with the header that
`modelFileFromAstHeader` would compute, so the per-call `stageModelFile`,
`modelFileFromAstHeader` and `validateModelFiles` rebuild of the user models
is gone. `DecoratorManager.validate` now checks the command set against its
validationModelManager's own engine handle (the new
`ModelManagerHandle.dcsValidate` binding, calling `dcs::validate_against`),
instead of reloading every model into a new engine manager on each call. The
raw outputs are in `results/P5-27/` (validate: `results/P5-27/validate/`).

| | |
|---|---|
| Machine | Cloud container, Intel Xeon @ 2.10GHz, 4 vCPU, Linux 6.18 (the P5-22 machine type) |
| Toolchain | Node v22.22.2, rustc 1.94.1, `concerto-wasm/build.sh` (engine 2,981,349 bytes now, 2,965,451 before) |
| Now | `concerto` `552fd526f`, `concerto-rust` `1941026` |
| Before | The integration heads this task started from, timed in the same run: `concerto` `7dc28bafd` with its concerto-core dist, `concerto-rust` `98e0809` with its engine |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, timed in each round |
| Driver | `p522-run.sh` with `P522_OPS=dcs_decorate,dcs_validate,extract_decorators,extract_vocabularies` and `P522_CRATE=0` (no crate code changed, so the crate-direct rounds are skipped): three interleaved rounds of TS 5.0.0 and the TS API on the Rust engine (now and before, order alternated per round), 5 warm-up and 30 samples each |
| Quiet gate | Before each timed part: 1-minute load < 2, 5-minute < 3, and no other bench, cargo or mocha process. All 9 parts met it; at the start of each part, 1-minute load was 1.27 to 1.85 and 5-minute load 1.80 to 1.89 (`results/P5-27/timed-loads.txt`). The profiles phase (stage split and crossing counts) is ungated and ran while another worker's oracle replay was loading the machine (1-minute load 3.9 to 6.1, `profile-loads.txt`); crossing counts are exact, but its stage percentages are only indicative. |
| Noise | As in P5-22: round-to-round medians move by up to about ±30% on every engine, including TS (here TS dcs_decorate on core-test-data read 43.5/48.6/25.0 ms). Treat ratio changes under about 25% as noise. The figures are the median over three rounds of each round's median. |

## Before vs now, × TS 5.0.0 (TS API)

| op | set | × TS before | **× TS now** | Rust ms before -> now (median of rounds) | crossings/item before -> now |
|---|---|---:|---:|---:|---:|
| dcs_decorate | core-test-data | 0.90 | **0.80** | 39.1 -> 34.6 | 162 -> 93 |
| dcs_decorate | conformance | 1.21 | **1.24** | 20.4 -> 20.9 | 190 -> 107 |
| dcs_decorate | synthetic-large | 1.54 | **1.45** | 74.0 -> 69.9 | 30 -> 27 |
| extract_decorators | core-test-data | 4.91 | **3.33** | 39.1 -> 26.6 | 162 -> 93 |
| extract_decorators | conformance | 7.55 | **5.39** | 18.2 -> 13.0 | 190 -> 107 |
| extract_decorators | synthetic-large | 6.14 | **3.23** | 64.6 -> 34.0 | 30 -> 27 |
| extract_vocabularies | core-test-data | 5.12 | **4.77** | 35.5 -> 33.0 | 162 -> 93 |
| extract_vocabularies | conformance | 8.26 | **5.52** | 20.6 -> 13.8 | 190 -> 107 |
| extract_vocabularies | synthetic-large | 7.08 | **4.57** | 71.7 -> 46.4 | 30 -> 27 |
| dcs_validate | core-test-data | 1.07 | **0.66** | 28.7 -> 17.6 | 163 -> 165 |
| dcs_validate | conformance | 1.22 | **0.78** | 17.4 -> 11.2 | 191 -> 193 |
| dcs_validate | synthetic-large | 1.12 | **0.80** | 47.3 -> 33.8 | 31 -> 33 |

The full tables are `results/P5-27/compare.md`, `table-before.md` and
`table-now.md`. The dcs_validate rows come from a second run of the same
driver after the validate change (`P522_OPS=dcs_validate`, `concerto`
`2afbb0e9d` with `concerto-rust` `c34ad92`, engine 2,981,992 bytes, against the
same before heads), in `results/P5-27/validate/`: all 9 timed parts met the
quiet gate (1-minute load 1.09 to 1.15, 5-minute 1.04, `validate/timed-loads.txt`).
In the first run, before the validate change, dcs_validate read
1.34/1.63/1.14× before and 1.44/1.71/1.16× now (core-test-data / conformance /
synthetic-large), i.e. no change.

## F6 against its estimate

- **extract_\* on conformance, estimate about 6.8× to 5.3× TS.** **Met in
  relative terms, a little short in absolute terms.** In this run the before
  side read 7.55× (extract_decorators) and 8.26× (extract_vocabularies), and
  the now side 5.39× and 5.52×: a 29-33% cut, larger than the estimated 22%
  (6.8 to 5.3), landing 0.1-0.2× above the 5.3× figure. The Rust time alone
  drops from 18.2/20.6 ms to 13.0/13.8 ms, and crossings per call from 190 to
  107. The other sets gain too (extract_* on synthetic-large 6.1-7.1× to
  3.2-4.6×).
- **decorateModels, estimate 1.3/1.6/1.8× to about 1.1/1.4/1.6× TS**
  (conformance / core-test-data / synthetic-large, the P5-22 figures).
  **Missed as a measurable change; within noise.** The same-run before side
  already read 1.21/0.90/1.54×, lower than P5-22's figures, and now reads
  1.24/0.80/1.45×. Against the estimate's absolute targets, core-test-data
  (0.80 against 1.4) and synthetic-large (1.45 against 1.6) are under them and
  conformance (1.24 against 1.1) is over, but the same-run changes (+2%, -12%,
  -6%; Rust time 20.4 -> 20.9, 39.1 -> 34.6, 74.0 -> 69.9 ms) are all within
  the ±25% noise band. Crossings drop by the same amount as for extract_*, but
  decorateModels spends 77-81% of its time in WASM code (the decoration
  itself), so the removed rebuild is a small share of it.
- **validate.** Not part of the F6 estimate. The validationModelManager is
  still built in TS (it is the public return value, built as TS 5.0.0 builds
  it), but the command set is now checked against that manager's resident
  engine handle instead of a per-call rebuild of the metamodel, the model
  files and the DCS model in Rust. Same-run, × TS drops by 28% to 38%
  (1.07/1.22/1.12× to 0.66/0.78/0.80×; Rust time 28.7 -> 17.6, 17.4 -> 11.2,
  47.3 -> 33.8 ms), beyond the ±25% noise band, and validate is now faster
  than TS 5.0.0 on all three sets. Crossings rise by 2 per call:
  `dcsValidate` replaces `decoratorManagerValidate` one for one, and the check
  that the handle mirrors the manager's model files adds one `epoch` and one
  `getNamespaces` call.

# P5-22: re-measure after F1-F4, the P5-15 sweep repeated (2026-09-29)

Task P5-22 (accordproject/concerto-rust#326) repeats the P5-15 sweep
(#309) on the integration head after F1-F4 (P5-17 to P5-20) and P5-16,
so the maintainer can decide on F5 and F6. Measure only: no engine or
concerto-core change. The raw outputs are in `results/P5-22/`.

| | |
|---|---|
| Machine | Cloud container, Intel Xeon @ 2.10GHz, 4 vCPU, 15 GB, Linux 6.18. Not the P5-15 laptop, so only same-run × TS ratios are compared. |
| Toolchain | Node v22.22.2, rustc 1.94.1, `concerto-wasm/build.sh` (engine 2,965,455 bytes now, 2,918,997 pre-F1) |
| Now | `concerto` `f90c7cad6`, `concerto-rust` `1b0555d` (integration head plus local-matt's P5-22 bench tooling) |
| Before | The pre-F1 integration head, timed in the same run: `concerto` `e5988a033` with its concerto-core dist, `concerto-rust` `45ff6d5` with its engine and crate bench (P5-22's `p515_sweep.rs` copied in, not committed). The difference is P5-16, P5-17 (F1), P5-18 (F2), P5-19 (F3) and P5-20 (F4). |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, timed in each round; the same files serve both sides |
| Driver | `p522-run.sh`: V8 CPU profiles (stage split) and crossing counts for both sides, no gate; then three interleaved rounds of TS 5.0.0, TS API on the Rust engine (now and before, order alternated per round) and criterion crate-direct (now and before; 1 s warm-up, 3 s measurement). `p515-sweep.mjs` used 5 warm-up and 30 samples. No native profiles (`sample` is macOS only). |
| Quiet gate | Before each part: 1-minute load < 2, 5-minute < 3, and no other bench, cargo or mocha process. All 15 parts met it (the gate held some parts after the 1-minute load reached 2.0-2.5); at the start of each part, 1-minute load was 1.21 to 1.94 and 5-minute load was 1.45 to 1.72 (`results/P5-22/timed-loads.txt`). |
| Noise | Per-run CVs were up to about 50%, and round-to-round medians of one op moved by up to about ±30% on every engine, including TS. Treat ratio changes under about 25% as noise. The figures are the median over three rounds of each round's median. |

## Before (pre-F1, same run) vs now, × TS 5.0.0

Selected rows. The full 59-row tables are `results/P5-22/compare.md`
(pre-F1 in this run) and `compare-vs-p515.md` (P5-15's laptop ratios).

| op | set | × TS API: P5-15 laptop | pre-F1 | **now** | × TS crate: pre-F1 | **now** |
|---|---|---:|---:|---:|---:|---:|
| extract_decorators | core-test-data | 14.83 | 13.66 | **5.83** | 19.27 | **1.62** |
| extract_decorators | conformance | 19.96 | 14.53 | **6.84** | 17.47 | **1.31** |
| extract_decorators | synthetic-large | 8.20 | 6.97 | **7.95** | 4.37 | **2.02** |
| extract_vocabularies | core-test-data | 17.56 | 15.34 | **6.01** | 18.15 | **1.54** |
| extract_vocabularies | conformance | 22.61 | 24.29 | **9.92** | 25.22 | **1.98** |
| extract_vocabularies | synthetic-large | 10.98 | 10.89 | **8.64** | 4.69 | **2.58** |
| dcs_decorate | core-test-data | 2.18 | 2.26 | **1.62** | 2.08 | **0.52** |
| dcs_decorate | conformance | 2.33 | 2.00 | **1.32** | 1.78 | **0.39** |
| dcs_decorate | synthetic-large | 1.40 | 1.49 | **1.82** | 0.86 | **0.66** |
| add_model_file | core-test-data | 5.40 | 7.77 | **5.28** | 5.05 | **1.78** |
| add_model_file | conformance | 13.64 | 20.24 | **14.15** | 6.81 | **2.06** |
| add_model_file | synthetic-large | 4.03 | 5.65 | **5.52** | 2.12 | **1.91** |
| new_resource | core-test-data | 10.77 | 9.76 | **2.97** | 0.23 | **0.22** |
| new_resource | conformance | 12.72 | 14.05 | **4.10** | 0.33 | **0.29** |
| new_resource | synthetic-large | 7.44 | 4.89 | **2.50** | 0.52 | **0.50** |
| mm_new | (system models) | 2.37 | 1.25 | **1.97** | 0.02 | **0.02** |
| from_json | core-test-data | 2.57 | 1.87 | **0.89** | 0.37 | **0.35** |
| from_json | conformance | 3.44 | 2.24 | **0.92** | 0.19 | **0.15** |
| get_namespaces | core-test-data | 15.92 | 13.10 | **13.28** | 1.55 | **1.67** |
| get_namespaces | conformance | 14.90 | 12.75 | **13.03** | 1.38 | **1.33** |
| resolve_type | core-test-data | 8.34 | 12.80 | **11.70** | 0.22 | **0.22** |
| get_type | core-test-data | 5.39 | 8.47 | **9.42** | 0.28 | **0.20** |
| modelfile_new | conformance | 8.90 | 10.11 | **9.11** | 1.78 | **1.61** |
| add_cto_model | conformance | 4.65 | 6.93 | **5.84** | 1.09 | **0.33** |
| validate | core-test-data | - | 1.28 | **1.26** | 0.45 | **0.45** |
| set_property_value | conformance | - | 5.55 | **5.00** | 0.93 | **0.73** |
| add_array_value | core-test-data | - | 5.83 | **3.71** | 0.74 | **0.67** |

## F1-F4 against their estimates

- **F1 (models_ast one snapshot).** Estimate: extract_* through the TS API from about 22× to 3-5× TS, and decorateModels to about 1×. **Met in the crate and missed through the TS API.** On the multi-file sets, crate-direct extract_* is 11-12× faster: 17-25× TS becomes 1.3-2.0×. Through the TS API, extract_* runs 2.2-2.6× faster and lands at 5.8-9.9× TS, not 3-5×. decorateModels lands at 1.3-1.6× (synthetic-large 1.8×, within noise of 1.5×), not 1×. synthetic-large is one file, so F1 barely moves it through the API (crate: about 2× faster). The residual is WASM execution time, not crossings. In the V8 profile, WASM code is 65-80% of each decorator op. `decoratorManagerExtractDecorators` alone takes 45 ms in WASM on synthetic-large against 18 ms for the whole op in native code.
- **F2 (detached-file validation without a manager clone).** Estimate: addModelFile from 10.5×/13.6× to about 3-4×/5×. **Missed through the TS API.** The crate is 2.8-3.2× faster on the multi-file sets (5.1×/6.8× TS becomes 1.8×/2.1×), and flat on single-file synthetic-large, as P5-18 found. Through the TS API, the gain is about 1.4-1.5× on the multi-file sets: 7.8×/20.2× becomes 5.3×/14.2× (the P5-15 laptop measured 5.4×/13.6×). Per file, 5.3 crossings remain: `stageModelFile` (45-68 µs), `modelFileValidateStaged` (58-62 µs) and `modelFileFromAstHeader` (42-51 µs). Together they are about 160 µs in-engine, against about 40-94 µs per file for the whole crate path.
- **F3 (getIdentifierFieldName in Rust plus memo).** Estimate: newResource from 12.7× to about 4×. **Met.** 14.1×/9.8×/4.9× becomes 4.1×/3.0×/2.5×, and crossings drop by 3 per resource.
- **F4 (parseNamespace semver in Rust).** Estimate: new ModelManager about -200 µs, to about 1.5×. **Missed; no measurable gain, as P5-20 reported.** mm_new reads 1.25× before and 1.97× now, but its before rounds were 448/506/814 µs and its now rounds 798/896/714 µs, and the crate is flat (9.2 against 9.6 µs), so this is noise around about 2× TS rather than a regression. `new ModelManager()` does not call parseNamespace.
- **P5-16 (fromJSON fast path, outside F1-F4).** fromJSON is now faster than TS 5.0.0: 1.9-2.3× becomes 0.89-0.93×, with 1 crossing per item, down from 7.5-14.4.

## Remaining hotspots, ranked (× TS through the TS API, now)

1. **addModelFile, conformance, 14.2×** (core-test-data 5.3×, synthetic-large 5.5×). The costs are the three per-file engine calls above, plus GC at 22%. The AST is decoded twice, once by `modelFileFromAstHeader` and once by `stageModelFile`.
2. **getNamespaces, 13×** (9-10 µs against 0.7 µs). This is a pure read, so the F5 memo applies.
3. **resolveType and getType, 5-12×** (2-3 µs against 0.2-0.4 µs). TS-side code accounts for 57-64% of the time (`ts-core`). The engine call is about 1 µs. The F5 memo applies.
4. **extractVocabularies and extractDecorators, 6-10×** (21-71 ms). WASM execution dominates. Each call also rebuilds the DCS model manager (5-45 `stageModelFile` calls plus `modelFileFromAstHeader` and one `validateModelFiles`), which costs 4.9 ms (conformance) to 5.9 ms (synthetic-large) per call. F6 targets this.
5. **ModelFile construction, 6-9×**, and **addCTOModel, 1.5-5.8×** (the cto-parser is 38-62% of the time, JS in both engines).
6. **setPropertyValue, addArrayValue and toJSON, 2-5×** (a few µs each).
7. **decorateModels, 1.3-1.8×.** The same DCS manager rebuild costs 5.7 ms (conformance), 7.0 ms (core-test-data) and 10.3 ms (synthetic-large) per call, against gaps to TS of 7, 24 and 44 ms.

Below 2× TS: validate, dcsValidate, derivesFrom, isAssignableTo, getDecorators and fromJSON.

## Recommendation on F5 and F6, and new items

- **F6 (resident DCS manager with staged-handle results): do it.** Its target has not shrunk. The rebuild costs 5-10 ms per decorateModels, extractDecorators or extractVocabularies call through the TS API. Removing it would take decorateModels to about 1.1× (conformance), 1.4× (core-test-data) and 1.6× (synthetic-large), and extract_* on conformance from about 6.8× to about 5.3×.
- **F5 (epoch-keyed TS memo for pure introspection reads): do it, narrowly and cheaply.** getNamespaces (13×) and resolveType/getType (5-12×) are the highest remaining ratios among cheap reads, but they are 1-10 µs in absolute terms. The memo pays off only for repeated reads, so scope it to getNamespaces, getType and resolveType, keyed on the existing `epoch` binding.
- **New N1: stage and header in one engine call for addModelFile.** Decode the AST once and have `stageModelFile` return the header, dropping `modelFileFromAstHeader` from the per-file path (about 42-51 µs of about 160 µs in-engine per file; unmeasured estimate: addModelFile down about 25%).
- **New N2: profile the WASM build of the DCS path.** In-WASM time is about 2.5× the native crate for the same work (45 ms against 18 ms on synthetic-large extract_decorators). A symbolised WASM profile would show whether allocator, `opt-level` or string-conversion choices explain it. This measure-only task did not investigate further.

No fuzz, per the milestone-only policy. No code changed apart from the driver (`p522-run.sh`) and the results.

# P5-20 (F4): parseNamespace checks the version in Rust, no semver.parse callback (2026-09-29)

Task P5-20 F4 (accordproject/concerto-rust#318) fixes finding F4 of the
P5-15 profiling sweep (#309). `model_util::parse_namespace` checked a
namespace's version with a `regress` regex, and the WASM binding called
back into JS `semver.parse` for every namespace to build `versionParsed`.
The regex is replaced by a hand-written scanner (`scan_full` in
`concerto-core/src/model_util.rs`) that accepts and rejects what
node-semver 7.6.3's `parse` does (the version TS 5.0.0 pins), and
`SemVer.version` is sliced from the matched text. concerto-wasm adds
`modelUtilParseNamespaceChecked` (additive; `modelUtilParseNamespace` and
`setHost` are unchanged), which returns the result packed into one string
with no host callback. `ModelUtil.parseNamespace` in
`packages/concerto-core/src/modelutil.ts` unpacks it and builds
`versionParsed` with the same `semver.parse` in JS, eagerly. Keys, order,
values, the `SemVer` instance, errors and the .d.ts are unchanged.

Differential tests (`concerto-core/tests/semver/`): 3,944 inputs recorded
from node-semver 7.6.3 `parse` by `record.mjs` (prerelease, build metadata,
leading zeros, whitespace, `v`/`=` prefixes, very long input; re-recording
reproduces the JSON byte for byte), a check that the recorded
`safeRe[t.FULL]` source equals the crate's pattern, and the scanner against
the regex on about 2.4 million short strings and at the length limits.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 4 cores / 8 logical CPUs, 16 GB, macOS 13.7.8 (a developer laptop) |
| Toolchain | Node v24.21.0, rustc 1.98.1, wasm-bindgen 0.2.128, wasm-opt applied by `concerto-wasm/build.sh`. The P5-20 engine is 2,846,875 bytes, within the 4 MiB budget (before: 2,846,654). |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 2.5 and the 5-minute below 3, with no other benchmark, cargo or mocha process running. All 21 runs met it; the 1-minute load was 1.65 to 2.44 at each start. |
| Before | `concerto-rust` `c140846` (the integration head when the task started, with P5-16), with `concerto` `49df04c05` and its `concerto-core` dist |
| After | `concerto-rust` `278d03b` (the two P5-20 commits on `c140846`), with `concerto` `7a91c9953` (the P5-20 `modelutil.ts` change on `49df04c05`) and its dist. Unlike P5-18, both the engine and the dist differ between the two sides, because the TS side calls the new binding. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0 (the oracle's reference), run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Driver | `p520-parse-namespace.mjs` (this task), 5 warm-up and 30 samples. Criterion (1 s warm-up, 3 s measurement): a `p520_parse_namespace` bench over the same namespaces, and P5-15's `benches/p515_sweep.rs` filtered to `mm_new/conformance` and `add_model_file`. Both crate benches were copied into `benches/` for the run and not committed. |
| Runs | `results/P5-20-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds (TS reference, then before and after through the TS API, then before and after in the crate). |

## Through the TS public API

Medians are in µs per item (per namespace for `parse_namespace`, per
model file for `add_model_file`, per call for `mm_new`), for runs 1, 2
and 3. The ratios use the median of the three runs. `parse_namespace`
runs `ModelUtil.parseNamespace` over every namespace the set's model files
declare or import (36, 41 and 1); `parse_namespace_read` also reads
`versionParsed.major`.

| Model set | Op | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-20, runs 1 / 2 / 3 | before / TS | **P5-20 / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | parse_namespace | 1.56 / 1.01 / 1.00 | 13.3 / 13.5 / 13.8 | 5.33 / 5.52 / 5.78 | 13.26× | **5.44×** | 2.44× |
| conformance | parse_namespace | 1.16 / 0.76 / 0.72 | 4.97 / 5.87 / 5.03 | 2.04 / 2.01 / 1.94 | 6.63× | **2.65×** | 2.50× |
| synthetic-large | parse_namespace | 0.95 / 0.90 / 0.84 | 7.74 / 6.06 / 7.19 | 2.34 / 2.45 / 2.33 | 8.01× | **2.61×** | 3.07× |
| concerto-core-test-data | parse_namespace_read | 1.03 / 0.83 / 0.81 | 10.5 / 10.4 / 11.0 | 5.27 / 5.38 / 5.38 | 12.65× | **6.51×** | 1.94× |
| conformance | parse_namespace_read | 0.95 / 0.75 / 0.72 | 5.10 / 5.42 / 5.01 | 2.11 / 2.14 / 2.02 | 6.81× | **2.81×** | 2.42× |
| synthetic-large | parse_namespace_read | 0.95 / 0.87 / 0.89 | 7.99 / 6.64 / 7.95 | 2.76 / 2.81 / 2.75 | 8.95× | **3.11×** | 2.88× |
| (none) | mm_new | 280.5 / 296.3 / 284.2 | 603.1 / 595.6 / 602.7 | 574.4 / 610.2 / 552.6 | 2.12× | **2.02×** | 1.05× |
| concerto-core-test-data | add_model_file | 82.1 / 85.1 / 83.5 | 252.3 / 273.6 / 257.5 | 260.7 / 247.6 / 265.4 | 3.08× | **3.12×** | 0.99× |
| conformance | add_model_file | 27.8 / 29.6 / 28.8 | 163.5 / 168.3 / 165.8 | 153.6 / 152.0 / 153.1 | 5.76× | **5.31×** | 1.08× |
| synthetic-large | add_model_file | 2469.9 / 2441.7 / 2463.8 | 6856.7 / 7032.9 / 7515.4 | 7105.1 / 6981.9 / 7005.8 | 2.85× | **2.84×** | 1.00× |

- **`ModelUtil.parseNamespace` is 1.9× to 3.1× faster** and goes from
  6.6× to 13.3× TS to 2.6× to 6.5× TS. What is left is the WASM call
  itself, the string unpacking and `semver.parse` in JS (about 0.26 µs),
  which TS 5.0.0 also pays.
- concerto-core-test-data costs about 2.6× conformance per namespace on
  the Rust side (TS: about 1.4×), before and after alike. Timing single
  namespaces in a hot loop gives 1.5 to 2.2 µs on both sets, so the gap
  looks like a whole-set effect of the harness (GC, cache) rather than the
  inputs. This task did not investigate it further.
- **`new ModelManager()` does not move (1.05×, inside the noise)**. The
  issue estimated about 200 µs off, to about 1.5× TS. `new ModelManager()`
  does not call `parseNamespace`: its boundary crossings are
  `modelFileFromAstHeader` (3) and `stageModelFile` (2), and P5-15's
  native profile of it shows no regex time. It stays about 2× TS.
- **`addModelFile` gains 8% on conformance** (5.8× to 5.3× TS) and is
  unchanged on the other two sets. Validation parses each file's
  namespace and imports in the crate, where the scanner saves a few µs per
  file (see the crate table); that is small next to the rest of
  validation, which P5-18 identified as most of the remaining cost.
- CVs were up to 111% on single runs of `parse_namespace` (a few slow
  samples), and up to 71% for `mm_new`, on both sides and in the TS
  reference. The ratios use medians of three runs.

## The Rust crate directly (criterion)

Criterion's median estimate for runs 1, 2 and 3: µs per pass over every
namespace of the set for `parse_namespace`, µs per call for `mm_new`, and
ms per whole set for `add_model_file` (every file into a fresh manager).
The speed-up uses the median of the three runs. The crate numbers are
native, so only the before/after ratio is meaningful.

| Benchmark | Before (`c140846`), runs 1 / 2 / 3 | P5-20 (`278d03b`), runs 1 / 2 / 3 | Speed-up |
|---|---|---|---|
| `parse_namespace`, concerto-core-test-data (36), µs | 84.62 / 84.19 / 84.23 | 31.15 / 31.33 / 31.26 | 2.69× |
| `parse_namespace`, conformance (41), µs | 99.18 / 99.07 / 97.85 | 38.62 / 37.39 / 39.03 | 2.57× |
| `mm_new`, µs | 31.04 / 31.19 / 31.27 | 30.52 / 30.64 / 31.23 | 1.02× |
| `add_model_file`, concerto-core-test-data, ms | 6.76 / 6.82 / 6.86 | 6.33 / 6.31 / 6.50 | 1.08× |
| `add_model_file`, conformance, ms | 4.67 / 4.67 / 4.66 | 4.15 / 4.10 / 4.24 | 1.12× |
| `add_model_file`, synthetic-large, ms | 8.05 / 8.01 / 8.23 | 7.99 / 7.97 / 8.27 | 1.01× |

- **The scanner makes the crate's `parse_namespace` 2.6× to 2.7× faster**
  (about 2.3 µs to 0.9 µs per namespace, including the name split and the
  `SemVer` fields).
- `add_model_file` is 8% to 12% faster on the many-file sets and flat on
  synthetic-large (one file); `mm_new` is flat.
- The figures are the medians criterion printed, from the run logs; the
  criterion output directories were not kept.

## Correctness during the run

The full tier ran on the final P5-20 tree (`concerto-rust` `278d03b`)
after the benchmark. `cargo fmt --all --check` and `cargo clippy --workspace
--all-targets --all-features -D warnings` were clean. `cargo test
--workspace` passed 996 tests with 0 failures (1 ignored), with
`CONCERTO_ORACLE_FIXTURES` set: the oracle covered 16,242 fixtures
(14,132 pass, 2,110 unsupported, 0 fail) with 0 load errors, 0 harness
errors, 0 unowned and 0 regressions. The concerto-wasm leg passed: `cargo fmt
--check`, wasm32 clippy with `-D warnings`, `cargo check`, `build.sh` and
`smoke:node`. The concerto-core build, the guardrails unit tests and the
guardrails check against `origin/claude/tender-pascal-ocwf9q` passed. The
concerto-core suite with nyc had 1,974 passing, 0 failing and 8 pending,
with coverage at 99.48% statements, 96.6% branches, 99.81% functions and
99.51% lines. No fuzz run, per the milestone-only policy.

---

# P5-19 (F3): `getIdentifierFieldName` in one engine call, memoised per model epoch (2026-09-29)

Task P5-19 (accordproject/concerto-rust#317) fixes finding F3 of the
P5-15 profiling sweep (#309). `ClassDeclaration.getIdentifierFieldName()`
crossed into the engine once per class in the super type chain, and each
of those calls crossed back into JS for `getSuperType()`,
`getSuperTypeDeclaration()`, `getFullyQualifiedName()` and
`getModelFile()`. `Factory.newResource` calls it three times per resource
(`isIdentified()`, `isSystemIdentified()`, `getIdentifierFieldName()`), so
it was most of `newResource`'s cost.

**Result: `Factory.newResource` goes from 11.1× to 3.6× TS 5.0.0 on the
conformance set (36.6 µs to 11.8 µs, 3.10× faster), and is at or below
3.6× TS on every set.** That meets the "about 4×" estimate. `fromJSON` and
`toJSON` do not call it on their hot path (one crossing per item before and
after), and are unchanged within noise.

## What changed

In `concerto-rust` (`concerto-wasm/src/lib.rs`, additive):

- **A new binding, `classDeclarationGetIdentifierFieldNameWalk`.** It is
  the TS method, super type walk included, in one call. It takes the
  unmodified `ClassDeclaration.prototype` methods the TS body reaches
  (`getIdentifierFieldName`, `getSuperType`, `getSuperTypeDeclaration`,
  `getModelFile`, `getFullyQualifiedName`), captured when
  classdeclaration.ts loads. It runs a call itself (field reads) only when
  the receiver's method is still that original, so a stubbed or overridden
  method is still called. `_resolveSuperType`, `getLocalType`,
  `getModelManager` and `getType` are still called as TS calls them, so
  every error comes from the same collaborator as before. A cycle in the
  chain is not inlined, and recurses as TS does. It returns
  `[answer, cacheable, ...chain]`: every declaration it read, and whether
  every step was inlined. `classDeclarationGetIdentifierFieldName` is
  unchanged.

In `concerto` (`packages/concerto-core/src/engine/views.ts`,
`introspect/classdeclaration.ts`):

- `getIdentifierFieldName()` goes through
  `views.classDeclarationGetIdentifierFieldName`, which keeps the binding's
  answer per view in a WeakMap, keyed on the model epoch P5-14 introduced
  (`propertyGeneration`, bumped whenever a model file is added, updated or
  deleted). An answer is kept only when the binding says every step was
  inlined, and only for views of model files built for a real
  `BaseModelManager` (as P5-14's property lookups). It is reused only while
  every declaration in the chain still has the same `idField`,
  `superType`, `superTypeDeclaration` and `modelFile`, its manager still
  holds the same `modelFiles` map, and none of the methods the TS body
  reaches on the way was replaced. Anything else calls the binding again.
  A call that throws keeps nothing.

Results and errors are unchanged. The oracle replays 16,242 fixtures with
0 regressions, and the API snapshot is unchanged.

## Before and after, through the TS public API

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 logical CPUs, 15 GB, Linux x64 (a cloud container) |
| Toolchain | Node v22.22.2, wasm-bindgen 0.2.128, wasm-opt from `concerto-wasm/build.sh`. The P5-19 engine is 2,965,353 bytes (before: 2,962,743), within the 4 MiB budget. |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 1 and no cargo, rustc, mocha, nyc, wasm-opt or fuzz process was running. All 11 runs met it; the 1-minute load was 0.93 to 0.95 at each start. |
| Before | The integration head after P5-16: `concerto` `49df04c05` with `concerto-rust` `c140846` (its dist and engine built separately and loaded with `--core-dist` and `CONCERTO_ENGINE_MODULE`) |
| After | `concerto` `b1c4f536b` with `concerto-rust` `51fea38` (the P5-19 branches, merged with that head) |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Driver | P5-15's sweep (`p515-sweep.mjs` from `ad82d6b1c`, with its fixtures), ops `new_resource,from_json,to_json`, 5 warm-up and 30 samples. The crate bench is not relevant: the change is in the binding and the TS shim only. |
| Runs | `results/P5-19-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds (TS reference, before, after). `results/P5-19-count-{before,after}-rust-engine.json`: one crossing count each (`--mode count`). The `commit` field in each file is the checkout the driver ran from; the table above says what each side measured. |

Medians of the three runs' medians, in µs per item:

| op | set | TS 5.0.0 | before | after | speed-up | before ×TS | after ×TS |
|---|---|---:|---:|---:|---:|---:|---:|
| new_resource | concerto-core-test-data | 6.62 | 45.87 | 19.86 | 2.31× | 6.93× | 3.00× |
| new_resource | conformance | 3.30 | 36.60 | 11.79 | 3.10× | 11.09× | 3.57× |
| new_resource | synthetic-large | 2.56 | 9.31 | 5.92 | 1.57× | 3.63× | 2.31× |
| from_json | concerto-core-test-data | 45.30 | 56.40 | 56.24 | 1.00× | 1.25× | 1.24× |
| from_json | conformance | 13.17 | 11.44 | 12.46 | 0.92× | 0.87× | 0.95× |
| from_json | synthetic-large | 11.59 | 20.46 | 20.46 | 1.00× | 1.77× | 1.77× |
| to_json | concerto-core-test-data | 25.86 | 66.53 | 62.30 | 1.07× | 2.57× | 2.41× |
| to_json | conformance | 5.80 | 20.05 | 16.88 | 1.19× | 3.46× | 2.91× |
| to_json | synthetic-large | 7.01 | 31.65 | 29.47 | 1.07× | 4.51× | 4.20× |

The per-run medians were, for `new_resource`, before 48.99 / 44.72 / 45.87,
42.64 / 36.60 / 33.25 and 11.03 / 9.31 / 9.03, and after 20.11 / 19.86 /
19.59, 11.46 / 11.84 / 11.79 and 6.05 / 5.87 / 5.92 (test-data,
conformance, synthetic-large). `from_json` on concerto-core-test-data had
one slow run on each side (81.08 before, 74.98 after); the `from_json` and
`to_json` differences are within this machine's run-to-run noise.

Crossings per `newResource` (count mode): 10.55 to 7.55 on conformance,
14.41 to 11.41 on concerto-core-test-data and 10.00 to 7.00 on
synthetic-large. The three `classDeclarationGetIdentifierFieldName` calls
per resource (about 59 µs per item in count mode, with the counter's
overhead) are gone: after warm-up every call is a memo hit. The largest
remaining crossings are `classDeclarationIsKind` (2 per resource) and the
manager's type-name lookups.

## Correctness during the run

- `cargo test --workspace` with `CONCERTO_ORACLE_FIXTURES` set: all 18 test
  binaries pass; the oracle replays 16,242 fixtures (14,132 pass, 2,110
  stays-ts unsupported, 0 fail, 0 harness errors, 0 regressions).
  `cargo fmt --check` and `cargo clippy --workspace --all-targets -D
  warnings` are clean.
- concerto-wasm: `cargo fmt --check`, wasm32 `clippy -D warnings`,
  `cargo check`, `build.sh` and `npm run smoke:node` pass.
- concerto-core suite with nyc: 1,636 passing, 345 pending, 1 failing:
  `ModelLoader #loadModelFromUrl`, which fetches
  `models.accordproject.org` and got HTTP 403 from the container's egress
  proxy (a direct `curl` to that host gets the same 403; the test does not
  touch this change). Coverage 99.4%
  statements, 96.75% branches, 99.62% functions, 99.43% lines, above the
  thresholds. Guardrails OK against the integration head.


# P5-18 (F2): validate detached model files without deep-cloning the manager (2026-09-29)

Task P5-18 F2 (accordproject/concerto-rust#316) fixes finding F2 of the
P5-15 profiling sweep (#309). `with_model_file_registered`, the scratch
manager behind `validate_detached_model_file` (`addModelFile`'s
validate-before-register and `new ModelFile(mm, ast).validate()`), rebuilt
the whole manager on every call: it deep-cloned every registered model
file and re-registered each one. The arena now holds each registered
model file as `Arc<ModelFile>` and each declaration's fully-qualified name
as `Arc<str>`. When the manager holds nothing under the file's namespace
(the `addModelFile` case), the scratch copy is the arena as it stands,
sharing every file, with the new file appended. When the namespace is
registered, the new file still takes the old file's place in the order,
and the other files are shared rather than cloned. The copy starts with
empty caches and ends at the same generation as a file-by-file rebuild.
Two unit tests pin it to that rebuild. The change is in
`concerto-core/src/model_manager.rs` only. Results and errors are
unchanged, and there is no TS, WASM binding or engine shim change.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 4 cores / 8 logical CPUs, 16 GB, macOS 13.7.8 (a developer laptop) |
| Toolchain | Node v24.21.0, rustc 1.98.1, wasm-bindgen 0.2.128, wasm-opt applied by `concerto-wasm/build.sh`. The P5-18 engine is 2,808,185 bytes, within the 4 MiB budget (before: 2,805,929). |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 2.5 and the 5-minute below 3, with no other benchmark, cargo or mocha process running. All 15 runs met it; the 1-minute load was 2.01 to 2.47 at each start. The laptop did not settle below 2 that night, so the gate is looser than P5-17's. |
| Before | `concerto-rust` `876bd67` (the integration head when the task started, with P5-17), with `concerto` `8d0d0bb14` |
| After | `concerto-rust` `3a8f3b4` (the P5-18 F2 commit on `876bd67`), with the same `concerto` `8d0d0bb14` and the same `concerto-core` dist. Only the engine module (`CONCERTO_ENGINE_MODULE`) differs between the two sides. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0 (the oracle's reference), run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Driver | P5-15's sweep (`p515-sweep.mjs` from `ad82d6b1c`, and the crate bench `benches/p515_sweep.rs` from `concerto-rust` `0a7edac`), ops `add_model_file,add_cto_model,modelfile_new`, 5 warm-up and 30 samples. Criterion: 1 s warm-up, 3 s measurement, `add_model_file` only. |
| Runs | `results/P5-18-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds (TS reference, then before and after through the TS API, then before and after in the crate). `results/P5-18-recheck-{before,after}-rust-engine-{1,2,3}.json`: a follow-up check of synthetic-large, below. |

## Through the TS public API

Medians are in µs per model file, for runs 1, 2 and 3. The ratios use the
median of the three runs. `add_cto_model` and `modelfile_new` are
controls: `addCTOModel` also parses the CTO text, and `new ModelFile`
does not validate, so neither should move much.

| Model set | Op | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-18, runs 1 / 2 / 3 | before / TS | **P5-18 / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | add_model_file | 69.0 / 68.6 / 68.3 | 436.5 / 388.2 / 389.1 | 306.6 / 284.2 / 258.4 | 5.67× | **4.14×** | 1.37× |
| conformance | add_model_file | 27.7 / 28.5 / 28.7 | 233.3 / 229.5 / 230.1 | 182.2 / 208.7 / 164.2 | 8.07× | **6.39×** | 1.26× |
| synthetic-large | add_model_file | 2455.2 / 2433.4 / 2430.2 | 7078.3 / 7027.6 / 7024.0 | 7724.4 / 7546.0 / 7935.0 | 2.89× | **3.17×** | 0.91× |
| concerto-core-test-data | add_cto_model | 362.2 / 373.4 / 370.9 | 1180.9 / 1162.3 / 1167.0 | 1158.5 / 1120.8 / 1122.1 | 3.15× | **3.03×** | 1.04× |
| conformance | add_cto_model | 109.7 / 112.3 / 105.4 | 598.6 / 545.5 / 573.2 | 497.0 / 536.8 / 555.8 | 5.23× | **4.89×** | 1.07× |
| synthetic-large | add_cto_model | 23014.2 / 23687.6 / 23106.7 | 33466.9 / 34300.0 / 40913.2 | 35420.9 / 37799.4 / 40013.2 | 1.48× | **1.64×** | 0.91× |
| concerto-core-test-data | modelfile_new | 19.4 / 20.2 / 19.8 | 141.7 / 140.8 / 139.4 | 143.6 / 139.4 / 142.9 | 7.11× | **7.22×** | 0.99× |
| conformance | modelfile_new | 6.0 / 6.3 / 6.3 | 86.5 / 82.4 / 87.2 | 84.0 / 82.1 / 82.8 | 13.73× | **13.14×** | 1.04× |
| synthetic-large | modelfile_new | 694.3 / 687.3 / 692.7 | 7811.3 / 7936.0 / 8047.0 | 8202.0 / 7769.5 / 8084.0 | 11.46× | **11.67×** | 0.98× |

- **`add_model_file` is 1.3× to 1.4× faster on the two many-file sets**
  (35 and 41 files). It goes from 5.7× and 8.1× TS to 4.1× and 6.4× TS.
  The issue estimated about 3× to 5× TS, from P5-15's 10.5× and 13.6×;
  the before side here is already lower than P5-15's figures, which this
  task did not investigate. concerto-core-test-data is inside that range.
  conformance is not.
- **What is left is validation itself, not the copy.** A `sample` profile
  of the crate's `add_model_file` on conformance puts the scratch copy at
  about 6% after the change. Most of the rest is validation
  (`check_imports`, the semver parse in `parse_namespace`, which is F4's
  scope, and `class_info`) and reading the AST.
- **synthetic-large (one large file) should not move.** With a single user
  file there was almost nothing to clone. The timed rounds show the P5-18
  side 9% slower (0.91×). A follow-up check run straight after, on a quieter
  machine (1-minute load 1.6 to 1.8), alternated before and after three
  times with 40 samples each. Before was 7526 / 7561 / 7475 µs and P5-18
  7382 / 7584 / 7475 µs, the same. The crate row below also shows no
  change. So the 0.91× is run-to-run noise, not a regression.
  `add_cto_model` on synthetic-large (0.91×) is noisy on both sides
  (33.5 to 40.9 ms).
- The controls `add_cto_model` and `modelfile_new` are unchanged on the
  many-file sets (0.98× to 1.07×).
- CVs were up to 18% for `add_model_file` and up to 32% for
  `modelfile_new`, on both sides and in the TS reference. The laptop was
  not fully quiet (above). The ratios use medians of three runs.

## The Rust crate directly (criterion)

Criterion's median estimate, in ms per call over the whole model set
(`add_model_file` of every file into a fresh manager), for runs 1, 2 and
3. The speed-up uses the median of the three runs. The crate numbers are
native, so only the before/after ratio is meaningful, not a comparison
with the TS rows above.

| Benchmark | Before (`876bd67`), runs 1 / 2 / 3 | P5-18 (`3a8f3b4`), runs 1 / 2 / 3 | Speed-up |
|---|---|---|---|
| `add_model_file`, concerto-core-test-data | 17.92 / 16.56 / 16.50 | 7.55 / 6.95 / 6.80 | 2.38× |
| `add_model_file`, conformance | 11.98 / 10.92 / 10.82 | 4.91 / 4.69 / 4.70 | 2.32× |
| `add_model_file`, synthetic-large | 9.10 / 7.97 / 8.08 | 8.06 / 8.04 / 8.01 | 1.00× |

- **In the crate, `add_model_file` is 2.3× to 2.4× faster on the
  many-file sets**, and unchanged on synthetic-large. The TS API gains are
  smaller, because each call also pays the WASM boundary (the AST goes in
  as JSON) and the TS wrapper's own work.
- The criterion `estimates.json` files were not kept (the copy step looked
  in the wrong directory). The figures above are the medians criterion
  printed, from the run logs.

## Correctness during the run

The full tier ran on the P5-18 tree (`concerto-rust` `3a8f3b4`) before
the benchmark. `cargo fmt --check` and `cargo clippy --workspace
--all-targets --all-features -D warnings` were clean. `cargo test
--workspace` passed 991 tests with 0 failures, with
`CONCERTO_ORACLE_FIXTURES` set: the oracle covered 16,242 fixtures
(14,132 pass, 2,110 unsupported, all stays-ts, 0 fail) with 0 load errors,
0 harness errors and 0 regressions. The concerto-wasm leg passed: `cargo fmt
--check`, wasm32 clippy in its CI form (`--target wasm32-unknown-unknown
-D warnings`), `cargo check`, `build.sh` and `smoke:node`. concerto-wasm
itself is unchanged. (With `--all-targets` added, clippy reports two
`indexing_slicing` errors in existing concerto-wasm test code, which this
task does not touch.) The concerto-core suite with nyc had 1,962 passing, 8 pending
and 0 failing (statements 99.48%, branches 96.75%, functions 99.81%, lines
99.51%). No fuzz run, per the milestone-only policy.

---

# P5-17 (F1): one resolve snapshot per `models_ast` call (2026-09-28)

Task P5-17 F1 (accordproject/concerto-rust#315) fixes finding F1 of the
P5-15 profiling sweep (#309). `models_ast(resolve = true)` called
`resolve_meta_model` for each model file, and each call deep-cloned the
whole registered model set (`models_ast(false, true)`) to resolve against.
That is O(N²) cloning for `getAst(true)`, the DCS decorate and validate
paths, and `extractDecorators` / `extractVocabularies`. Nothing registers
or removes a model file inside that loop. So the call now takes one
borrowed snapshot, indexed by namespace, and reuses it for every file. As
in TS `findNamespace`'s `Array.find`, the first model registered for a
namespace wins. `resolve_meta_model` uses the same borrowed snapshot. The
change is in `concerto-core/src/model_manager.rs` only. Results and errors
are unchanged, and there is no TS, WASM binding or engine shim change.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 4 cores / 8 logical CPUs, 16 GB, macOS 13.7.8 (a developer laptop) |
| Toolchain | Node v24.21.0, rustc 1.98.1, wasm-bindgen 0.2.128, wasm-opt applied by `concerto-wasm/build.sh`. The P5-17 engine is 2,799,916 bytes, within the 4 MiB budget (before: 2,797,957). |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 2 and the 5-minute below 3, with no other benchmark process running. All 15 runs met it; the 1-minute load was 1.58 to 1.98 at each start. This laptop does not settle below 1, so the gate is looser than P5-14's. |
| Before | `concerto-rust` `cd04cb1` (the integration head when the task started), with `concerto` `4ed605ca2` |
| After | `concerto-rust` `338cbaf` (the P5-17 F1 commit on `cd04cb1`), with the same `concerto` `4ed605ca2` and the same `concerto-core` dist. Only the engine module (`CONCERTO_ENGINE_MODULE`) differs between the two sides. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0 (the oracle's reference), run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Driver | P5-15's sweep (`p515-sweep.mjs` from `ad82d6b1c`, and the crate bench `benches/p515_sweep.rs` from `concerto-rust` `0a7edac`), ops `extract_decorators,extract_vocabularies,dcs_decorate,dcs_validate`, 5 warm-up and 30 samples. Criterion: 1 s warm-up, 3 s measurement. |
| Runs | `results/P5-17F1-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds (TS reference, then before and after through the TS API and the crate) |

## Through the TS public API

Medians are in ms per call over the whole model set (each op runs once
over every model in the set), for runs 1, 2 and 3. The ratios use the
median of the three runs.

| Model set | Op | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-17, runs 1 / 2 / 3 | before / TS | **P5-17 / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | extract_decorators | 8.2 / 7.5 / 8.0 | 88.9 / 88.4 / 94.1 | 30.7 / 32.3 / 30.7 | 11.11× | **3.84×** | 2.89× |
| conformance | extract_decorators | 3.2 / 3.0 / 3.1 | 43.6 / 43.3 / 44.6 | 15.3 / 16.3 / 15.2 | 14.26× | **4.99×** | 2.86× |
| synthetic-large | extract_decorators | 10.4 / 9.6 / 9.9 | 64.0 / 63.4 / 65.4 | 54.0 / 57.9 / 54.2 | 6.44× | **5.45×** | 1.18× |
| concerto-core-test-data | extract_vocabularies | 7.1 / 7.0 / 6.7 | 102.6 / 101.1 / 101.6 | 41.9 / 40.5 / 41.3 | 14.51× | **5.90×** | 2.46× |
| conformance | extract_vocabularies | 2.5 / 2.4 / 2.5 | 51.5 / 51.5 / 52.2 | 20.5 / 20.8 / 20.1 | 20.77× | **8.28×** | 2.51× |
| synthetic-large | extract_vocabularies | 10.1 / 9.1 / 9.6 | 79.4 / 77.1 / 79.5 | 67.7 / 69.3 / 65.6 | 8.26× | **7.04×** | 1.17× |
| concerto-core-test-data | dcs_decorate | 40.1 / 37.1 / 38.1 | 89.6 / 90.9 / 90.2 | 58.0 / 60.8 / 57.6 | 2.37× | **1.52×** | 1.56× |
| conformance | dcs_decorate | 20.7 / 18.7 / 19.5 | 48.4 / 49.6 / 48.2 | 30.5 / 29.4 / 28.1 | 2.48× | **1.50×** | 1.65× |
| synthetic-large | dcs_decorate | 64.6 / 58.3 / 60.3 | 93.7 / 95.6 / 92.5 | 83.6 / 88.4 / 82.5 | 1.55× | **1.39×** | 1.12× |
| concerto-core-test-data | dcs_validate | 34.8 / 31.6 / 32.9 | 46.9 / 46.8 / 45.2 | 45.7 / 47.2 / 44.4 | 1.42× | **1.39×** | 1.02× |
| conformance | dcs_validate | 17.9 / 16.5 / 17.3 | 31.5 / 32.7 / 31.0 | 31.1 / 31.9 / 30.3 | 1.83× | **1.80×** | 1.01× |
| synthetic-large | dcs_validate | 54.4 / 50.9 / 53.8 | 67.8 / 68.7 / 67.3 | 68.5 / 69.9 / 66.9 | 1.26× | **1.27×** | 0.99× |

- **`extract_*` is 2.5× to 2.9× faster on the two many-file sets**
  (concerto-core-test-data and conformance). It goes from 11× to 21× TS
  to 3.8× to 8.3× TS. The issue estimated 3× to 5× TS. `extract_decorators`
  is inside that range (3.8× and 5.0×). `extract_vocabularies` is not
  (5.9× and 8.3×).
- **`dcs_decorate` is 1.6× faster** on those sets (2.4× to 2.5× TS, now
  1.5× TS). The issue estimated about 1× TS. What remains is the binding's
  per-call work: it rebuilds a manager from the model ASTs and hands back
  the whole AST. The crate's `dcs_decorate_rebuild` row below measures that
  cost.
- **synthetic-large gains less (1.1× to 1.2×).** It is a single large
  model file (the other two sets have 35 and 41), so the old code cloned
  the set once per call there, not once per file. What it gains comes from
  resolving against a borrowed snapshot instead of a clone.
- **`dcs_validate` is unchanged (0.99× to 1.02×).** `dcs::validate` builds
  its own validation manager and does not call `models_ast`, so F1 does
  not touch it. It is listed as a control.
- CVs were 12% or less, except one before run (run 2, 27%). The ratios use
  medians of three runs, so that run does not move them.

## The Rust crate directly (criterion)

Criterion's median estimate, in ms per call over the whole model set, for
runs 1, 2 and 3. The speed-up uses the median of the three runs. The
`*_rebuild` rows add what the WASM binding does per call: they rebuild a
manager from the model ASTs first and, for decorate, hand back the whole
AST. The crate numbers are native and measured on a resident manager, so
only the before/after ratio is meaningful, not a comparison with the TS
rows above.

| Benchmark | Before (`cd04cb1`), runs 1 / 2 / 3 | P5-17 (`338cbaf`), runs 1 / 2 / 3 | Speed-up |
|---|---|---|---|
| `extract_decorators`, concerto-core-test-data | 280.0 / 270.6 / 250.1 | 25.5 / 27.3 / 24.8 | 10.62× |
| `extract_decorators_rebuild`, concerto-core-test-data | 298.7 / 297.1 / 258.1 | 35.3 / 36.5 / 34.9 | 8.41× |
| `extract_vocabularies`, concerto-core-test-data | 277.6 / 262.5 / 250.8 | 27.3 / 27.0 / 26.8 | 9.71× |
| `extract_vocabularies_rebuild`, concerto-core-test-data | 287.5 / 275.0 / 260.0 | 36.1 / 36.7 / 36.5 | 7.54× |
| `dcs_decorate`, concerto-core-test-data | 169.7 / 168.7 / 170.1 | 48.9 / 53.7 / 47.5 | 3.47× |
| `dcs_decorate_rebuild`, concerto-core-test-data | 177.1 / 181.3 / 182.7 | 61.1 / 63.6 / 60.2 | 2.97× |
| `dcs_validate`, concerto-core-test-data | 21.4 / 22.4 / 22.0 | 22.2 / 22.9 / 21.4 | 0.99× |
| `dcs_validate_rebuild`, concerto-core-test-data | 26.8 / 28.0 / 27.0 | 27.3 / 28.2 / 27.0 | 0.99× |
| `extract_decorators`, conformance | 112.0 / 113.2 / 107.4 | 10.6 / 11.1 / 10.3 | 10.59× |
| `extract_decorators_rebuild`, conformance | 115.7 / 164.1 / 112.0 | 14.2 / 14.8 / 14.1 | 8.13× |
| `extract_vocabularies`, conformance | 113.0 / 300.0 / 108.7 | 10.8 / 11.4 / 10.3 | 10.49× |
| `extract_vocabularies_rebuild`, conformance | 115.8 / 132.0 / 112.9 | 18.3 / 15.1 / 14.0 | 7.68× |
| `dcs_decorate`, conformance | 99.4 / 91.4 / 89.7 | 24.9 / 29.6 / 23.8 | 3.67× |
| `dcs_decorate_rebuild`, conformance | 98.1 / 147.8 / 95.3 | 29.7 / 58.4 / 29.3 | 3.30× |
| `dcs_validate`, conformance | 14.2 / 14.4 / 14.0 | 13.8 / 26.4 / 13.5 | 1.03× |
| `dcs_validate_rebuild`, conformance | 16.8 / 16.9 / 16.5 | 16.6 / 20.8 / 16.0 | 1.01× |
| `extract_decorators`, synthetic-large | 79.5 / 94.7 / 75.6 | 44.3 / 71.9 / 43.9 | 1.79× |
| `extract_decorators_rebuild`, synthetic-large | 97.1 / 145.6 / 94.9 | 62.1 / 77.4 / 59.3 | 1.56× |
| `extract_vocabularies`, synthetic-large | 82.5 / 91.2 / 78.4 | 47.4 / 49.9 / 47.2 | 1.74× |
| `extract_vocabularies_rebuild`, synthetic-large | 100.9 / 131.5 / 94.8 | 63.3 / 66.2 / 62.5 | 1.59× |
| `dcs_decorate`, synthetic-large | 101.9 / 112.4 / 97.8 | 83.0 / 82.4 / 79.0 | 1.24× |
| `dcs_decorate_rebuild`, synthetic-large | 126.6 / 137.3 / 121.7 | 104.1 / 107.6 / 102.5 | 1.22× |
| `dcs_validate`, synthetic-large | 37.5 / 76.7 / 36.1 | 35.8 / 46.1 / 35.5 | 1.05× |
| `dcs_validate_rebuild`, synthetic-large | 45.6 / 56.4 / 45.4 | 44.5 / 106.2 / 44.4 | 1.03× |

- **In the crate, `extract_*` is 9.7× to 10.6× faster, and `dcs_decorate`
  3.5× to 3.7×**, on the many-file sets. With the rebuild the binding
  does, the gains are 7.5× to 8.4× and 3.0× to 3.3×.
- The TS API gains are smaller than the crate's. Through the TS API, the
  per-call boundary cost (JSON encoding in and out of WASM) is now a large
  part of what is left.
- Round 2 was noisy: the 1-minute load reached 7.56 by its end. Some round
  2 figures are outliers on both sides (for example
  `extract_vocabularies`, conformance, before: 300.0; `dcs_validate_rebuild`,
  synthetic-large, after: 106.2). The medians of three runs discard them.
- The absolute crate times (native, resident manager) are higher than the
  TS API times for the same op. This was not investigated here, because
  the exit condition compares before with after, and the TS API with TS
  5.0.0.

## Correctness during the run

The full tier ran on the P5-17 tree (`concerto-rust` `338cbaf`) before
the benchmark. `cargo fmt --check` and `cargo clippy --workspace
--all-targets -D warnings` were clean. `cargo test --workspace` passed
987 tests with 0 failures, with `CONCERTO_ORACLE_FIXTURES` set: the oracle
covered 16,242 fixtures (14,132 pass, 2,110 unsupported, 0 fail) with 0
regressions. The concerto-wasm leg (fmt, wasm32 clippy, check, `build.sh`,
`smoke:node`) passed. The concerto-core suite with nyc had 1,822 passing,
8 pending and 0 failing (statements 99.48%, branches 96.74%, functions
99.81%, lines 99.51%). The guardrails were OK against `origin/main`. No
fuzz run, per the milestone-only policy.

---

# P5-21: native `metamodel::validate_ast` on a resident metamodel (2026-09-28)

Task P5-21 (accordproject/concerto-rust#319), plan accordproject/concerto-rust#29.
P6-04 (below) found the public native free function
`concerto_core::metamodel::validate_ast` 7.35× slower than TS on
conformance, because it built a fresh metamodel ModelManager on every call
(see "The validateAst outlier" below). P5-21 runs it on a per-thread
resident metamodel manager, built on first use, as P5-13's
`ModelManager::validate_ast` does. The public signature, results and error
kinds are unchanged. It is a `concerto-rust` change only; the TS-API route
is not affected.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 logical CPUs, 17 GB, Linux x64 (a shared cloud container). **Not the machine P6-04 used** (a darwin laptop), so compare each P5-21 figure only with the TS figure from the same machine below, not with P6-04's figures. |
| Toolchain | cargo/rustc 1.94.1, Node v22.22.2 |
| Native runs | `concerto-rust`'s `benches/results/P5-21/native-{1,2}.json`: two rounds of `cargo bench --manifest-path benches/Cargo.toml --bench validate_metamodel` (criterion defaults), reduced with `extract-results.sh`. The free function is the new `concerto-core/metamodel::validate_ast` case in `validate_metamodel.rs`, next to `concerto-core/validate_ast` (`ModelManager::validate_ast`). The files record `concerto_rust_commit` `cd04cb1` (the integration head the P5-21 change was built on; the benchmarked tree had the change applied). They carry no `loadavg` field. |
| TS runs | `results/P5-21-ts-reference-5.0.0-{1,2,3}.json`: three rounds of `run-ts.mjs --workloads validate_ast` against the published 5.0.0 reference (`--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist`), defaults (5 warm-up, 30 samples), `concerto` `4ed605ca2`. |
| Load | 1-minute load at the start of the TS runs: 3.59, 2.04 and 2.24. None met P6-04's load1 < 2 quiet gate; the machine is shared with other tasks. The native result files were extracted at 21:31:43Z and 21:33:14Z, the times TS runs 2 and 3 finished; whether the native and TS runs overlapped was not recorded. Treat the figures as indicative: P6-04 saw contention move ratios by up to 1.6×, well inside the margin below. |

Medians in µs per model:

| Model set | n | Native free function, runs 1 / 2 | Native `ModelManager::validate_ast`, runs 1 / 2 | TS 5.0.0, runs 1 / 2 / 3 | **free function / TS** |
|---|---|---|---|---|---|
| concerto-core-test-data | 34 | 147.1 / 147.0 | 132.0 / 133.5 | 532.0 / 521.2 / 516.7 | **0.28× (3.5× faster)** |
| conformance | 41 | 60.6 / 61.7 | 56.1 / 56.6 | 202.6 / 215.4 / 204.5 | **0.30× (3.4× faster)** |
| synthetic-large | 1 | SKIPPED | SKIPPED | SKIPPED | - |

The ratio uses native run 1 against the TS median (runs 2 and 3 give the
same ratio to two places). The free function is now within 8-11% of the
resident-metamodel method, and below TS on both sets, which meets
P5-21's target (at or below TS on conformance). `synthetic-large` is still
rejected by `validateAst` on every route, as in P5-04 onwards.

---

# P6-04: native Rust benchmarks through the public API (informational, 2026-09-28)

Task P6-04 (accordproject/concerto-rust#273), plan accordproject/concerto-rust#29,
depends on P6-01 (#83, the Rust public API design) and P6-02 (#84, the
native acceptance example and `docs/native-guide.md`). Per the maintainer's
request of 2026-09-27, this benchmarks the native Rust crate **through
`concerto-core`'s D11 public API alone** — no TypeScript, no WASM, no
`js-compat` feature — and reports it next to the existing P5-04 numbers so
all three routes are comparable: **native Rust**, **Rust through the TS
public API** (the WASM-backed engine, `run-ts.mjs` with
`CONCERTO_ENGINE=rust`), and **the TS reference**
(`@accordproject/concerto-core` 5.0.0). This is informational only: no CI
regression gate, and no engine change of any kind.

The new native harness is `concerto-rust`'s `benches/benches/public_api.rs`
(a fourth criterion bench target alongside P5-04's `load_validate.rs`,
`validate_metamodel.rs` and `instance_validate.rs`). It compiles and runs
with no `js-compat` feature and no `concerto-core-js` dependency — the same
surface `concerto-core/examples/standalone.rs` (P6-02) walks — and covers:

- **model load**: `ModelManager::add_model_ast` (the stable,
  non-deprecated replacement for `load_validate.rs`'s `add_model`) and the
  batch `add_model_asts`;
- **model validate**: `ModelManager::validate_models`;
- **validateAst**: the crate-root free function `metamodel::validate_ast`
  (see "The validateAst outlier" below — this is *not* the same code path
  as the TS-API number in this table);
- **instance populate and validate**: `ModelManager::validate_instance`
  (first error) and `ModelManager::check_instance` (collect-all,
  accordproject/concerto#1239) — both read the document the way TS
  `Serializer.fromJSON` does (P5-13/P6-01, `docs/public-api.md` §5.7),
  populate and validate in one call;
- **serialisation**: *not exposed*. `Serializer`/`Factory`/`Resource`/
  `InstanceGenerator` are explicitly out of D11's scope
  (`docs/public-api.md` §1) and live in the unpublished `concerto-core-js`
  crate, not in `concerto-core`'s public API, so there is nothing to
  benchmark here.

Same model sets as P5-04: `concerto-core-test-data` (35 files),
`conformance` (41 files), `synthetic-large` (1 file, 300 declarations), and
the 500-instance synthetic `Item` workload, all from
`migration/bench/fixtures/` (`generate-fixtures.mjs`), so all three routes
below load byte-identical models.

## Machine and toolchain

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 8 logical CPUs, 17 GB, macOS (darwin x64, Darwin kernel 22.6.0), a shared developer laptop |
| Toolchain | Node v24.21.0, rustc 1.98.1 / cargo 1.98.1 |
| `concerto` commit | `201e6a74886a1f43db994b41c3187fb2c62f2e83` (branch `claude/tender-pascal-ocwf9q-local-matt-P6-04`, based on the integration branch) |
| `concerto-rust` commit | `ce50e3ab835321d70b079e234d4a2fcff9b2285f` (branch `claude/tender-pascal-ocwf9q-local-matt-P6-04`, based on the integration branch) |
| Load at run time | The 4 TS-API result files (`results/P6-04-{ts-reference-5.0.0,rust-via-ts}-{1,2}.json`) each carry a `loadavg` field, sampled once at the start of that run: 1-minute load 1.77 to 1.98 across those four. The native result JSONs have **no** `loadavg` field; the corresponding start/end loads are logged in `.longrun/native.log` instead. Native round 1 started at load 2.12/2.99 and ended at 1.89/2.48, quiet throughout. **Native round 2 did not stay quiet**: it started at load 1.90/2.42 (18:38:46Z) but ended at 8.36/5.29 (18:45:14Z) — another workload started during the run, and the next quiet gate did not re-clear until 18:58:21. See "Native round 2 was contended" below; the `native/TS` and `native/Rust-via-TS` ratios in the tables use native round 1 only for this reason. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, the oracle's reference (`--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist`) |
| Native runs | `concerto-rust`'s `benches/results/P6-04-native-{1,2}.json`: two rounds of `cargo bench --manifest-path benches/Cargo.toml --bench public_api` (criterion defaults: 3 s warm-up, 100 samples), reduced with `extract-results.sh`. Round 2 ran under load contention (see "Load at run time" above); its figures are shown for reference but excluded from the ratio columns. |
| TS-API runs | `results/P6-04-{ts-reference-5.0.0,rust-via-ts}-{1,2}.json`: two rounds of `run-ts.mjs --workloads load_validate,validate_ast,instance_validate` with the defaults (5 warm-up, 30 samples). Both rounds of both routes started under the quiet gate (native's contention did not carry over, since each round waits for the gate again before it starts). |

## The three-way table

Medians are in µs per model (load/validate/validateAst) or per instance
(instance), for runs 1 and 2. Both figures for every route are shown, but
the ratio columns are computed differently per route because **native
round 2 ran under load contention** (see "Machine and toolchain" and
"Native round 2 was contended" below): `Rust-via-TS/TS` uses the median of
its two (both quiet) runs, as before; `native/TS` and `native/Rust-via-TS`
use **native run 1 only** (both quiet), against the TS/Rust-via-TS median
as usual. "native/TS" and "Rust-via-TS/TS" are speed relative to the TS
5.0.0 reference (lower is faster); "native/Rust-via-TS" compares the two
Rust routes directly.

### Load

| Model set | n | Native, runs 1/2 (µs) | Rust-via-TS, runs 1/2 (µs) | TS 5.0.0, runs 1/2 (µs) | native/TS* | Rust-via-TS/TS | native/Rust-via-TS* |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 35 | 132.8 / 138.0 | 175.2 / 184.2 | 35.9 / 35.8 | 3.70× | 5.02× | 0.74× |
| conformance | 41 | 53.7 / 62.7 | 94.4 / 106.4 | 12.7 / 13.5 | 4.10× | 7.65× | 0.53× |
| synthetic-large | 1 (300 decls) | 8871.4 / 13824.8 | 7843.0 / 7555.3 | 836.8 / 838.4 | 10.59× | 9.19× | 1.15× |

\* native run 2 ran under load contention; these two columns use native run 1 only (see "Native round 2 was contended" below). Rust-via-TS/TS is unaffected — both its runs were quiet — and still uses the median of runs 1 and 2.

### Validate (`validate_models`)

| Model set | n | Native, runs 1/2 (µs) | Rust-via-TS, runs 1/2 (µs) | TS 5.0.0, runs 1/2 (µs) | native/TS* | Rust-via-TS/TS | native/Rust-via-TS* |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 35 | 95.7 / 102.9 | 203.7 / 211.0 | 73.5 / 72.3 | 1.31× | 2.84× | **0.46× (2.2× faster)** |
| conformance | 41 | 74.1 / 113.9 | 134.9 / 154.2 | 28.2 / 30.8 | 2.51× | 4.90× | 0.51× |
| synthetic-large | 1 (300 decls) | 5565.3 / 8662.0 | 11548.1 / 10008.3 | 2717.1 / 2689.4 | 2.06× | 3.99× | 0.52× |

\* native run 2 ran under load contention; these two columns use native run 1 only (see "Native round 2 was contended" below). Rust-via-TS/TS is unaffected and still uses the median of runs 1 and 2.

### validateAst

| Model set | n | Native, runs 1/2 (µs) | Rust-via-TS, runs 1/2 (µs) | TS 5.0.0, runs 1/2 (µs) | native/TS* | Rust-via-TS/TS | native/Rust-via-TS* |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | 34 | 2363.8 / 2396.3 | 265.4 / 275.2 | 795.8 / 835.7 | 2.90× | **0.33× (3.0× faster)** | 8.75× (slower) |
| conformance | 41 | 2230.0 / 3423.5 | 118.5 / 131.1 | 304.0 / 302.8 | 7.35× | **0.41× (2.4× faster)** | 17.87× (slower) |

\* native run 2 ran under load contention; these two columns use native run 1 only (see "Native round 2 was contended" below). Rust-via-TS/TS is unaffected and still uses the median of runs 1 and 2.

**The validateAst outlier is expected, not a regression.** The native
number times the crate-root free function `concerto_core::metamodel::
validate_ast`, which builds and checks against the metamodel schema fresh
on every call — there is no other `validateAst` entry point in the D11
public surface today (`ModelManager::validate_ast(&ModelFile)`, the
resident-metamodel method P5-13 optimised, is a second-tier/seam item
benchmarked in `validate_metamodel.rs`, not part of this file). The
Rust-via-TS number goes through WASM to that resident-metamodel method, so
it pays the metamodel cost once per `ModelManager`, not once per call —
which is why it beats both the native free function *and* TS. This is a
gap in what the public API exposes as a fast validateAst entry point, not
a measurement error; see "Open question" below.

**Update (P5-21, accordproject/concerto-rust#319):** the free function now
runs on a per-thread resident metamodel manager. Re-measured on a
different machine, it is 0.30× of TS on conformance (3.4× faster) and
0.28× on concerto-core-test-data; see the "P5-21" section above. The
figures in this table are P6-04's and are kept as recorded.

### Instance: populate and validate (`Serializer.fromJSON` equivalent)

| | n | Native `validate_instance`, runs 1/2 (µs) | Rust-via-TS `fromJSON`, runs 1/2 (µs) | TS 5.0.0 `fromJSON`, runs 1/2 (µs) | native/TS* | Rust-via-TS/TS | native/Rust-via-TS* |
|---|---|---|---|---|---|---|---|
| (synthetic, 500) | 500 | 8.9 / 14.1 | 36.3 / 40.4 | 10.4 / 9.9 | **0.88× (1.1× faster)** | 3.77× | **0.23× (4.3× faster)** |

\* native run 2 ran under load contention; these two columns use native run 1 only (see "Native round 2 was contended" below). Rust-via-TS/TS is unaffected and still uses the median of runs 1 and 2.

`ModelManager::validate_instance` is the public API's one-call
populate-and-validate route (P5-13/P6-01, §5.7): on the one quiet native
run (run 1, 8.9 µs), it is slightly *faster* than the TS reference
(10.15 µs median), and is 4.3× faster than the same work done through the
TS public API (WASM marshalling overhead on every call). Native run 2
(14.1 µs) ran under load contention and is excluded from these ratios;
using both runs' median (11.5 µs) instead would show native 1.13× *slower*
than TS, which is the contended figure the original write-up reported —
see "Native round 2 was contended" below. The collect-all counterpart,
`public_api/instance/check_instance` (accordproject/concerto#1239, no
TS-side equivalent recorded here), was 11.6 µs on the quiet run 1 and
19.1 µs on the contended run 2 — on run 1, modestly slower than
`validate_instance`, as expected for walking every violation instead of
stopping at the first; run 2's figure reflects the same contention, not a
regression.

## Notes and caveats

- **Two runs, not three.** P5-04's later refreshes (P5-06 onward) used
  three interleaved rounds; this table uses two, run back to back rather
  than interleaved, since this task is informational with no gate to
  satisfy.
- **Native round 2 was contended, not ordinary noise.** Run 2's native
  numbers are consistently higher than run 1's (e.g. `synthetic-large`
  load: 8871.4 µs vs 13824.8 µs; `check_instance`: 11.6 µs vs 19.1 µs),
  and every row in the three-way tables shows the same 1.2×-1.6× slowdown
  from run 1 to run 2. The load average did **not** drop between runs —
  it rose. `.longrun/native.log` records native round 2 starting at load
  1.90/2.42 (18:38:46Z, past the quiet gate) and ending at 8.36/5.29
  (18:45:14Z): another workload started on the machine partway through
  the criterion run. `.longrun/quiet-loads.tsv` shows the next quiet gate
  (before the following leg, `rust-via-ts` round 2) did not clear until
  18:58:21, nearly 13 minutes later. This breaks the "run on a quiet
  machine" rule for native round 2's own duration, which this task owns
  (`concerto-rust`'s `benches/`), so its figures are kept for reference in
  the tables above but excluded from every `native/TS` and
  `native/Rust-via-TS` ratio, which use native run 1 (quiet start to
  finish) only. Rust-via-TS and TS-reference round 2 are unaffected: each
  leg waits for the quiet gate again before it starts, and both started
  and finished quiet (loads 1.95/2.67 and 1.77/2.40 at their own starts).
  A future refresh of this table should re-run native round 2 under the
  quiet gate rather than rely on this correction.
- **The commits are a few commits behind the current integration head.**
  This branch (`claude/tender-pascal-ocwf9q-local-matt-P6-04`) was created
  from `origin/claude/tender-pascal-ocwf9q` before P5-11 (#287) and P5-14
  (#308) landed there; the commits above are recorded exactly as run.
  Measurement only, no engine change, so this does not affect the
  comparison's validity — only its currency. A later refresh should
  re-branch from the current head.
- **`add_model_asts` (batch)** was also benchmarked (`public_api.rs`) but
  is not in the three-way table above since `run-ts.mjs` has no batch-load
  counterpart to compare it with; see `concerto-rust`'s
  `benches/results/P6-04-native-{1,2}.json` for its numbers directly
  (roughly 1.5-3× the single-file `add_model_ast` loop, dominated by the
  whole-batch validate-then-rollback bookkeeping).
- **Open question for a follow-up:** the D11 public API has no
  resident-metamodel `validateAst` entry point that does not also require
  a `ModelFile` (`ModelManager::validate_ast` takes one; the free function
  `metamodel::validate_ast` does not cache the metamodel). A native caller
  that wants TS-API-competitive validateAst performance today has to go
  through `ModelFile::from_json` first. Not a P6-04 finding to fix
  (measurement only) — flagged for P6-01/P6-03 to consider.
  *Addressed by P5-21 (accordproject/concerto-rust#319): the free
  function now caches the metamodel per thread; see the "P5-21" section
  at the top.*

## Reproducing this table

```sh
# Native Rust, through the public API alone (the `--bench public_api`
# selects just this task's bench target, out of the four in benches/)
cd concerto-rust
cargo bench --manifest-path benches/Cargo.toml --bench public_api
./benches/extract-results.sh benches/results/native.json

# Rust engine via the TS public API (needs the WASM engine built first:
# cd ../concerto-rust/concerto-wasm && sh build.sh)
cd ../concerto
CONCERTO_ENGINE=rust node migration/bench/run-ts.mjs --out migration/bench/results/rust-via-ts.json

# TS reference
CONCERTO_ENGINE=ts node migration/bench/run-ts.mjs --out migration/bench/results/ts-reference.json
```

---

# P5-12c: instance validation in one Rust call per resource (2026-09-28)

Task P5-12c (accordproject/concerto-rust#293) sends `ValidatedResource.validate()`,
`setPropertyValue` and `addArrayValue` to the engine. Each makes one call
(`validateResourceBinary` or `validatePropertyBinary` on #292's compact binary
transport, run through the P5-13 validator). The `ResourceValidator` visitor
now runs only for `EngineFastPathUnsupported`.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 8 logical CPUs, 17 GB, macOS (darwin x64), a shared developer laptop |
| Toolchain | Node v24.21.0, rustc 1.98.1. Both engines were built with `npm run build` in `concerto-wasm`, which puts the `wasm-opt` from `node_modules/.bin` on the PATH, so **`wasm-opt` was applied to both** |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 2, the 5-minute load average was below 3, and no cargo, rustc, mocha, nyc, fuzz or linker process was running. **All 9 runs met this gate.** The 1-minute load was 1.92 to 1.95 when runs started and at most 2.51 when they ended. |
| Before | `concerto` `201e6a748`, `concerto-rust` `2ea80b0`: the integration head that P5-12c is merged with. All three sides run the P5-12c checkout's `run-ts.mjs` and differ only in `--core-dist`. Its engine is 2,749,403 bytes. |
| After | `concerto` `0b8cfd1e2`, `concerto-rust` `14d5ff0`: the P5-12c branches. The engine is 2,755,357 bytes (+5,954), within the 4 MiB budget. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Runs | `results/P5-12c-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds of `run-ts.mjs --workloads instance_validate`, each with 5 warm-up and 30 samples. As in P5-13, the `concerto_engine` field reads `ts` and `concerto_commit` gives the driver's checkout. `core_dist` identifies the side. |

## Workload 3 through the TS public API

Medians are in µs per instance for runs 1, 2 and 3 (synthetic, n=500). Each
ratio uses the median of the three runs.

| Metric | TS 5.0.0 | Rust before | Rust P5-12c | before / TS | **P5-12c / TS** | before / P5-12c |
|---|---|---|---|---|---|---|
| fromJSON (populate+validate) | 8.82 / 8.84 / 8.67 | 39.72 / 37.93 / 37.28 | 41.31 / 38.15 / 37.27 | 4.30× | **4.33×** | 0.99× |
| resource.validate() | 1.94 / 1.96 / 1.87 | 22.27 / 22.36 / 21.39 | 5.17 / 4.79 / 4.86 | 11.50× | **2.51×** | **4.58×** |
| setPropertyValue() | 0.16 / 0.16 / 0.17 | 1.63 / 1.62 / 1.43 | 2.54 / 2.39 / 2.49 | 9.88× | **15.13×** | **0.65×** |
| addArrayValue() | 0.29 / 0.28 / 0.28 | 2.78 / 2.66 / 2.59 | 2.84 / 2.73 / 2.83 | 9.36× | **9.95×** | 0.94× |

- **`resource.validate()` meets the target of about 2.5× TS.** It is now
  2.51× TS (4.8 µs against 1.9 µs), down from 11.5×, a 4.58× speed-up on the
  integration head.
- **`fromJSON` has not changed** (0.99×), as expected: P5-12c does not
  change the populate-and-validate path it measures.
- **`setPropertyValue()` is slower: 1.54× the integration head's time**
  (2.49 µs against 1.62 µs). The single-property visitor walk was already
  cheap, and one engine call per property (encoding the value, crossing
  into WASM, looking up the declaration) costs more than it. The
  maintainer's scope comment on #293 routes it through the engine anyway.
  Whether it should go back to the visitor is left to review.
- **`addArrayValue()` is within noise of the integration head** (0.94×,
  CV 7% to 11%). It revalidates the whole new array, so the engine call's
  fixed cost is a smaller share.
- The TS 5.0.0 `setPropertyValue` and `addArrayValue` runs are 0.2 to 0.3
  µs per operation, with CVs of 53% to 73%, close to the timer's
  resolution. Treat the ratios against TS for those two rows as indicative
  only.

A first pass of this benchmark (not kept) used an engine that `sh build.sh`
had built with no `wasm-opt` on the PATH. It compared an unoptimised
P5-12c engine (3,018,921 bytes) with an optimised before engine, so it was
not like for like. It was rerun as above. Its figures were close to these
(`resource.validate()` 5.0 µs, `setPropertyValue()` 2.5 µs). The oracle
replay (16242 pass, 0 fail) and the concerto-core suite (1912 passing, nyc
statements 99.37%) were rerun on the optimised engine.

## Round 2: after the P5-11 merge and the setPropertyValue fix

The continuation brief on #293 asked for workload 3 again on the tree that
merges P5-11 (#287), and for the `setPropertyValue()` regression above to be
fixed or explained. Since round 1, `setPropertyValue` keeps a string,
number or boolean on a plain primitive field with no validator (not an
array, enum or scalar) on the `ResourceValidator` visitor
(`visitorIsCheaper` in `engine/validate-resource.ts`). The visitor is the
TS reference path, so outcomes do not change. Every other value still takes
the engine call. `addArrayValue` still always takes the engine.

| | |
|---|---|
| Before | `concerto` `4ed605ca2`, `concerto-rust` `cd04cb1`: the integration head, which includes P5-11 and P5-14. Its engine is 2,798,129 bytes. |
| After | `concerto` `8825225b7`, `concerto-rust` `77d50bf`: the P5-12c branches merged with that head, plus the fix. The engine is 2,804,075 bytes (+5,946). |
| Build | Both engines were built with `npm run build` in `concerto-wasm`, so `wasm-opt` was applied to both. Each side's concerto-core `dist` loads the engine from its own sibling concerto-rust checkout. |
| Quiet-check | The same gate as round 1. All 9 runs met it, and they started after P5-15's timed benchmark had finished. The 1-minute load was 1.86 to 1.98 when runs started and at most 2.22 when they ended. |
| Runs | `results/P5-12c-r2-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`, three interleaved rounds with 5 warm-up and 30 samples each. The driver is the P5-12c checkout's `run-ts.mjs` for all three sides. |

Medians are in µs per instance for runs 1, 2 and 3 (synthetic, n=500). Each
ratio uses the median of the three runs.

| Metric | TS 5.0.0 | Rust before | Rust P5-12c | before / TS | **P5-12c / TS** | before / P5-12c |
|---|---|---|---|---|---|---|
| fromJSON (populate+validate) | 9.50 / 9.05 / 9.06 | 42.02 / 41.69 / 40.43 | 41.49 / 42.83 / 39.19 | 4.60× | **4.58×** | 1.00× |
| resource.validate() | 2.07 / 2.06 / 2.01 | 9.35 / 9.36 / 9.01 | 4.75 / 5.13 / 4.44 | 4.54× | **2.31×** | **1.97×** |
| setPropertyValue() | 0.167 / 0.167 / 0.164 | 0.700 / 0.650 / 0.686 | 0.760 / 0.824 / 0.773 | 4.10× | **4.63×** | 0.89× |
| addArrayValue() | 0.282 / 0.277 / 0.279 | 1.823 / 1.776 / 1.717 | 2.157 / 2.051 / 1.839 | 6.37× | **7.36×** | 0.87× |

- **`resource.validate()` is 2.31× TS**, which meets the target of about
  2.5×. That is 1.97× faster than the current head, which includes P5-11.
  P5-12c's own figure (4.75 µs) is level with round 1 (4.86 µs), so merging
  P5-11 did not slow P5-12c's path. The head's own `validate()` is 9.35 µs
  here against 22.36 µs for round 1's before side. P5-14's cached property
  lookups also landed in between, so this run cannot isolate P5-11's ~23%
  on its own. Against the current head, P5-12c removes about half of
  `validate()`'s time.
- **`setPropertyValue()` is no longer a large regression.** In round 1 it
  took 1.54× the head's time (2.49 against 1.62 µs). Now it takes 1.13×
  (0.773 against 0.686 µs), a difference of about 0.09 µs per call. The
  workload sets `sequence`, a plain number field, so both sides run the
  same visitor walk. The remaining 0.09 µs is the routing check: the
  memoised `loadEngine` lookup and `visitorIsCheaper`'s six declaration
  calls (`isField`, `isArray`, `isTypeEnum`, `isTypeScalar`,
  `isPrimitive`, `getValidator`). The values that do go to the engine
  gain a lot. Microbenchmarks run for this fix on a loaded machine
  (indicative only) showed: a String with a
  regex and length validator drops from 8.8 to 1.4 µs, a concept from 40 to
  4.1 µs, and adding to a 20-item String[] from 10 to 3.4 µs.
- **`addArrayValue()` is 1.15× the head's time** (2.05 against 1.78 µs,
  CV 12% to 19%). The workload adds a third short string to a two-item
  array, which is the engine call's worst case: its fixed cost is not yet
  paid back by the visitor walk it replaces. In the same microbenchmarks
  the engine is about 8% slower at 3 items and 3× to 9× faster as arrays
  or items grow, so `addArrayValue` stays on the engine.
- As in round 1, the TS 5.0.0 `setPropertyValue` and `addArrayValue` runs
  are 0.2 to 0.3 µs with CVs of 44% to 71%. Treat the ratios against TS for
  those two rows as indicative only.

---

# P5-16: Serializer.fromJSON through the TS API (2026-09-28)

Task P5-16 (accordproject/concerto-rust#310) profiles `Serializer.fromJSON`
through the TS API stage by stage and cuts its cost in the boundary work,
the TS-side result building and the engine's own populate and validate.
The coordinator lifted the porting pause on #310. No TS logic needed
porting: the profile put the cost in boundary work, in building the TS
result objects, and in the engine's hashing and allocation.

**Result: fromJSON is 2.19× faster (26.6 µs to 12.1 µs), from 4.00× to
1.82× TS 5.0.0.** That meets the 2× target, but noise on this machine is
large (the after runs were 12.7 / 12.1 / 9.5 µs).

## What changed

In `concerto-rust`:

- **The wire codec** (`concerto-wasm/src/lib.rs`). `serializerFromJson`
  reads its document straight into the engine's value type (`parse_wire`).
  It writes its result straight to JSON text (`WireOut`, `WireInstanceOut`).
  Before, both directions went through an intermediate `serde_json::Value`
  tree, built, hashed and dropped on every call. The values and the text
  are unchanged; unit tests check them against the old route, byte for
  byte.
- **A new, additive binding, `serializerFromJsonCompact`.** It returns the
  same resource, with its top level as an array:
  `[ctor, fqn, $namespace, $type, $identifierFieldName, $identifier,
  $timestamp, fields]`. It drops the keys the view never copies, finds the
  header values in one pass, and writes integral numbers as integer literals
  (`42`, not `42.0`). `JSON.parse` reads integer literals faster, and the
  numbers are the same (a unit test checks this). `serializerFromJson` is
  unchanged.
- **Options read once.** The serializer and its merged options are kept
  while the options text is unchanged (`FROM_JSON_SERIALIZER`).
  `Serializer::from_json_prepared` with `FromJsonOptions` (additive) reads
  those options once, and `Serializer::options` borrows the defaults
  instead of copying them.
- **Fewer hashes, lookups and allocations** (`concerto-core-js`).
  - `JsObject`: the maps behind instance properties, plain objects and
    serializer options hash with foldhash's per-map seeded hasher instead of
    SipHash. SipHash was the largest single cost inside populate and validate.
    foldhash is not designed to resist crafted colliding keys the way SipHash is.
  - `Instance::set` hashes a new key once instead of twice.
  - The populator reads each property's value in the same pass as its key
    (`object_entries_ref`, checked against `object_keys_ref` by a unit test).
    It looks each declared property up once for both `validateProperties` and
    `getProperty`.
  - The per-property path push and `fully_qualified_identifier` skip the
    formatting machinery.
  - `sync_identifiers` skips an assignment that would change nothing.

In `concerto` (`packages/concerto-core/src/engine/serializer.ts`,
`serializer-codec.ts`):

- The fast path uses `serializerFromJsonCompact` when the engine has it.
  It decodes the parsed result in place instead of copying it.
- The class lookups the instance constructors make are made once per class
  and kept next to the cached engine handle, and dropped with it whenever the
  model files change. These are `getType(fqn)` and `Identifiable`'s own
  `getModelFile(ns).getType(fqn).getIdentifierFieldName()`, which cost about
  2.9 µs per instance, each crossing into the engine. The cache is looked up
  by the parsed class-name string, with a shortcut for runs of one class.
  Later instances get the same own properties, in the same order, and share
  one V8 map (checked with `%HaveSameMap`).
- The options' wire text is reused while the options object and its
  primitive values are unchanged. It is kept in a WeakMap, so no caller's
  options object is retained. One `env` object is shared, and strings are
  checked with `isWellFormed()` where the runtime has it.
- `migration/oracle/lifted/serializer-compact.checks.js`: `fromJSON` through
  the compact result and, with `serializerFromJsonCompact` hidden, through
  the `"typed"` result. Both are checked against the v5.0.0 reference and run
  in the concerto-core suite (`fallbacks.spec.js`).

## Before and after, through the TS public API

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 logical CPUs, 17 GB, Linux x64 (a cloud container) |
| Toolchain | Node v22.22.2, wasm-bindgen 0.2.128, wasm-opt from `concerto-wasm/build.sh`. The P5-16 engine is 2,952,066 bytes (before: 2,912,432), within the 4 MiB budget. |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 1 and no cargo, rustc, mocha, nyc, wasm-opt or fuzz process was running. All 9 runs met it; the load was 0.79 to 0.85 at each start. |
| Before | `concerto` `4ed605ca2` (integration head, after P5-11) with `concerto-rust` `cd04cb1` |
| After | `concerto` `934bd03f5` with `concerto-rust` `5a777a2` (the P5-16 branches) |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Runs | `results/P5-16-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds of `--workloads instance_validate`, with the defaults (5 warm-up and 30 samples). Each file's `concerto_commit`, `concerto_rust_commit`, `engine_module` and `core_dist` record what that run measured (`run-ts.mjs --concerto-commit`/`--concerto-rust-commit`, new in P5-16). |

Medians in µs per instance, for runs 1, 2 and 3. The ratios use the median of
the three runs.

| Metric | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-16, runs 1 / 2 / 3 | before / TS | **P5-16 / TS** | speed-up |
|---|---|---|---|---|---|---|
| fromJSON | 6.4 / 6.7 / 6.8 | 27.5 / 26.6 / 26.4 | 12.7 / 12.1 / 9.5 | 4.00× | **1.82×** | 2.19× |
| resource.validate() | 1.3 / 1.4 / 1.4 | 5.6 / 6.4 / 5.4 | 7.0 / 5.2 / 8.9 | 3.97× | 5.00× | 0.79× |
| toJSON | 4.2 / 3.2 / 3.3 | 21.1 / 21.0 / 20.8 | 21.2 / 21.4 / 21.3 | 6.41× | 6.52× | 0.98× |

`validate()` and `toJSON` run on the resources `fromJSON` returns; this task
does not change them. The P5-16 `validate()` runs spread from 5.2 to 8.9 µs
(CVs up to 25%). A separate check measured `validate()` and `toJSON` over
500 resources, 150 passes, 4 alternating rounds, before and after. It found no
difference: `validate()` 6.10 to 6.69 µs before and 6.12 to 6.24 after,
`toJSON` 16.3 to 20.7 before and 20.4 to 21.1 after.

## Stage profile

Stages timed one at a time over the same 500 instances (median of 40 to 100
passes, µs per instance), in one process per build. The stages do not add up
to the total, which also holds `fromJSON`'s own work and garbage collection.

| Stage | Before | P5-16 |
|---|---|---|
| fromJSON, whole call | 26.2 | 11.4 |
| Encode the document and the options (`encodeValue`, `JSON.stringify`) | 1.06 | 0.64 to 0.76 (the options text is reused) |
| Engine call (strings in, Rust decode, populate, validate, encode, string out) | 15.2 | 6.2 to 7.3 |
| `JSON.parse` of the result | 1.23 | 0.79 |
| Build the resource objects in TS (`decodeValue`/`materializeCompact`) | 3.89 | 0.35 (1.14 with the parse) |
| Everything but the engine (the engine call replaced by a stub returning recorded results) | not measured | 2.45 |

CPU profiles (`node --cpu-prof`, an engine built with symbol names) split the
engine call. Before, about half of it was the `serde_json::Value` round trip
(parse, decode, encode, serialize and drop), the options decode and the
serializer's construction. After the first round of changes, SipHash on the
instance maps, repeated lookups and allocation were the largest costs in
populate and validate. The second round cut those.

## Remaining profile

The P5-16 fromJSON call (11.4 µs in the stage run above) splits roughly as
follows.

- **Engine populate and validate: about 4.1 µs.** `Serializer::from_json`
  inside WASM (`benches/wasm-instance`, 3 runs on this build: 5.07, 4.07 and
  4.14 µs; P5-13 measured 7.26 µs). The largest parts are:
  - `resource::validate`: it copies the instance into a `serde_json::Value`
    for the validator (`to_validator_value`, whose `serde_json::Map` still
    hashes with SipHash), then runs `validate_instance_from`.
  - The populator's `visit_class_declaration`.
  - `new_resource_of`.
- **The rest of the engine call: about 2 to 3 µs.** Parsing the document
  into engine values, writing the result, and the two string crossings
  (wasm-bindgen's per-character copy in, `TextDecoder` out).
- **TS: about 2.5 µs.** Encoding the document (0.7), parsing the result and
  building the resource (1.1), and `fromJSON`'s own work and garbage
  collection.

The next step would be validating the populated instance without copying
it into a `serde_json::Value` (about 1 µs in the profile). The validator is
written against `serde_json::Value` throughout, so that is a rewrite of the
validator's value access, not a local change.

## Correctness during the run

The P5-16 verification is in the task report for
accordproject/concerto-rust#310. It covers the native oracle (16242
fixtures, 0 regressions), the TS-API replay of the corpus through `src/`
(16242 of 16242), the WASM leg, the concerto-core suite with nyc and the
guardrails.

---

# P5-14: cached property lookups on the lazy views (2026-09-28)

Task P5-14 (accordproject/concerto-rust#308) caches a ClassDeclaration
view's `getProperties()` list, and the name lookup `getProperty()` makes
over it, once per view (`packages/concerto-core/src/engine/views.ts`). A
repeated call no longer crosses into the engine. A miss still runs the
`classDeclarationGetProperties` binding, so every error is raised by the
same call. The cache is dropped whenever a ModelManager's model files
change (add, update or replace, delete, clear, and the roll-back of a
failed batch). It is also dropped when a view's own properties, its
`superType`, its model file or its super type's entry change. The change is
TS-side only: no engine or WASM change.

**Why TS-side, and not a Rust port.** The coordinator lifted the porting
pause on #308, so a Rust port was an option. The measurements below favour
the cache. Before P5-14, `getProperties()` on the Item concept took about
6 µs per call. That is JS→WASM→JS work: the binding calls back into the
views for `getOwnProperties`, the super type's resolution and the super
type's own `getProperties()`. A Rust port would still cross the boundary
at least once per call, and would still need the JS view objects returned.
The cache answers a repeated call without crossing at all (0.09 µs), which
is below TS 5.0.0's own 0.40 µs. `getProperty()` goes from 0.56 µs to
0.09 µs.

| | |
|---|---|
| Machine | Intel(R) Xeon(R) Processor @ 2.10GHz, 4 logical CPUs, 17 GB, Linux x64 (a cloud container) |
| Toolchain | Node v22.22.2, wasm-bindgen 0.2.128, wasm-opt applied by `concerto-wasm/build.sh`. The engine is 2,863,571 bytes, within the 4 MiB budget. |
| Quiet-check | Before every run, the driver waited until the 1-minute load average was below 1. All 9 runs met it. The 1-minute load was 0.77 to 0.93 at each start. |
| Before | `concerto` `201e6a748` (the integration head) with `concerto-rust` `2ea80b0` |
| After | the P5-14 branch (the same heads plus this change). Both sides used the same engine build and the same `run-ts.mjs`. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0 (the oracle's reference), run with `--core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| Runs | `results/P5-14-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds of all three workloads, with the defaults (5 warm-up and 30 samples) |

`run-ts.mjs` workload 3 now also times `toJSON` over the same 500
resources. It also times `getProperties()` and `getProperty()` on the Item
declaration: 1,000 calls per sample, with `getProperty()` cycling through
Item's property names.

## Through the TS public API

Medians are in µs per model, per instance or per call, for runs 1, 2 and 3.
The ratios use the median of the three runs.

| Model set | Metric | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-14, runs 1 / 2 / 3 | before / TS | **P5-14 / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | load | 31.2 / 30.0 / 33.6 | 165.1 / 154.6 / 212.1 | 172.1 / 142.9 / 137.4 | 5.30× | **4.58×** | 1.16× |
| concerto-core-test-data | validate | 69.4 / 61.0 / 69.7 | 175.3 / 180.2 / 184.5 | 178.2 / 167.7 / 183.2 | 2.60× | **2.57×** | 1.01× |
| concerto-core-test-data | validateAst | 543.5 / 549.8 / 559.0 | 227.1 / 239.5 / 243.5 | 230.5 / 226.8 / 241.0 | 0.44× | **0.42×** | 1.04× |
| conformance | load | 13.6 / 14.1 / 13.4 | 72.5 / 78.8 / 59.9 | 71.9 / 68.7 / 62.9 | 5.33× | **5.04×** | 1.06× |
| conformance | validate | 21.1 / 21.6 / 23.5 | 185.7 / 151.2 / 158.8 | 165.5 / 154.4 / 177.2 | 7.34× | **7.64×** | 0.96× |
| conformance | validateAst | 207.5 / 214.2 / 216.6 | 108.0 / 112.8 / 148.9 | 99.4 / 112.0 / 124.5 | 0.53× | **0.52×** | 1.01× |
| synthetic-large | load | 611.4 / 642.8 / 591.1 | 7443.0 / 6884.8 / 8896.5 | 7102.2 / 7490.5 / 7602.9 | 12.17× | **12.25×** | 0.99× |
| synthetic-large | validate | 2003.2 / 2346.9 / 2262.4 | 9678.0 / 9589.1 / 10104.3 | 9364.6 / 8794.7 / 8214.7 | 4.28× | **3.89×** | 1.10× |
| (synthetic, 500) | fromJSON | 6.8 / 7.4 / 6.3 | 25.3 / 24.4 / 25.3 | 27.5 / 27.4 / 26.0 | 3.70× | **4.02×** | 0.92× |
| (synthetic, 500) | resource.validate() | 1.6 / 1.7 / 1.6 | 15.2 / 17.9 / 14.7 | 5.8 / 6.3 / 6.3 | 9.53× | **3.92×** | 2.43× |
| (synthetic, 500) | toJSON | 3.5 / 3.6 / 3.7 | 20.5 / 20.9 / 21.4 | 19.3 / 20.9 / 19.6 | 5.88× | **5.52×** | 1.07× |
| Item | getProperties() | 0.409 / 0.401 / 0.399 | 5.4 / 5.8 / 6.8 | 0.091 / 0.091 / 0.101 | 14.55× | **0.23×** | 64.00× |
| Item | getProperty() | 0.038 / 0.037 / 0.038 | 0.517 / 0.564 / 0.570 | 0.090 / 0.096 / 0.087 | 15.04× | **2.39×** | 6.29× |

(`validateAst` rejects every model in synthetic-large, so it has no row, as
in earlier runs.)

- **`getProperties()` is 64× faster** and now takes 0.23× the time of TS
  5.0.0. It returns a copy of the cached list, a new array on every call,
  as the binding did.
- **`getProperty()` is 6.3× faster.** It is still 2.4× TS: each call
  checks that the cache is still valid (the view's own properties and each
  super type's entry) before the map lookup.
- **`resource.validate()` is 2.43× faster** (15.2 µs to 6.3 µs; 9.5× to
  3.9× TS). The validator calls `getProperties()` twice and `getProperty()`
  five times per Item instance through the views, and those calls were
  most of its boundary cost (P5-12's profile).
- **`fromJSON` and `toJSON` are unchanged** (0.92× and 1.07×, within
  noise). Both take the serializer's engine fast path (one engine call per
  document), which makes no
  `getProperties()`/`getProperty()` call through the views. With the
  prototype methods wrapped, one `fromJSON` and one `toJSON` of an Item
  made none, and one `validate()` made 2 and 5. Their remaining cost is in
  that fast path, not in the property lookups.
- **Load, validate and validateAst are unchanged** within the noise of this
  shared container (0.96× to 1.16×; the load CVs were 17% to 52%). They
  make few repeated lookups.

## Correctness during the run

The P5-14 verification (the native oracle, the WASM leg, the concerto-core
suite with nyc and CONCERTO_LAZY_VIEWS_CHECK=1, and the guardrails) is
reported on accordproject/concerto-rust#308. Cache invalidation (add,
update or replace, delete, clear, roll-back) and the returned-array
semantics are covered by the lifted checks in
`migration/oracle/lifted/property-cache.checks.js` (PROP-CACHE-001 to 008),
checked against both `src/` and the TS 5.0.0 reference.

---

# P5-13: validator performance, resident metamodel and fewer allocations (2026-09-28)

Task P5-13 (accordproject/concerto-rust#297) makes the Rust validators
faster without moving any TS logic to Rust:

- `validateAst` checks the AST through the new `validateAstValue` binding,
  with no engine-side ModelFile build (spike (a) from P5-12d).
- The metamodel stays resident, on a per-thread manager.
- The metamodel check and the instance validator allocate less: borrowed
  property lists and super chains, a per-declaration class cache, cached
  FQNs and field defaults, and FxHash for maps that are never iterated.

This section records three sets of runs. Each compares the P5-13 build with
the integration head and, where there is one, the TS reference. The runs
were interleaved round by round on one machine.

1. Workloads 2 (validateAst) and 3 (fromJSON and `resource.validate()`),
   through the TS API.
2. The in-WASM instance validator.
3. The crate-direct criterion benches.

| | |
|---|---|
| Machine | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz, 8 logical CPUs, 17 GB, macOS (darwin x64), a shared developer laptop |
| Toolchain | Node v24.21.0, rustc 1.98.1, wasm-bindgen 0.2.128, wasm-opt applied by `concerto-wasm/build.sh` |
| Quiet-check | Before every round, the driver waited until the 1-minute load average was below 2, the 5-minute load average was below 3, and no cargo, rustc, mocha, nyc, fuzz or linker process was running. **All 10 rounds met this gate**, and none ran unquiet. The 1-minute load was 1.73 to 1.98 when rounds started and at most 3.20 when they ended. The per-round loads are in the P5-13 worktree's `.longrun/quiet-loads.tsv`. |
| Before | `concerto` `b9eb3852f`, `concerto-rust` `f6c797d`: the integration head that P5-13 was last merged with. It was given P5-13's bench files, so both sides run the same benchmarks. Its engine is 2,760,232 bytes. |
| After | `concerto` `697dbc900`, `concerto-rust` `db09431`: the P5-13 branch merged with that integration head. Its engine is 2,749,278 bytes. Both engines are within the 4 MiB budget. |
| TS reference | Published `@accordproject/concerto-core` 5.0.0, the oracle's reference, run with `run-ts.mjs --core-dist migration/oracle/reference/node_modules/@accordproject/concerto-core/dist` |
| TS-API runs | `results/P5-13-{ts-reference-5.0.0,before-rust-engine,after-rust-engine}-{1,2,3}.json`: three interleaved rounds of `--workloads validate_ast,instance_validate` with the defaults (5 warm-up and 30 samples). Their `concerto_engine` field reads `ts` because it echoes the retired `CONCERTO_ENGINE` variable. The before and after builds both run the Rust engine: concerto-core has had no TS engine since P5-02. |
| In-WASM runs | `concerto-rust`'s `benches/results/P5-13/wasm-instance-{before,after}-{1,2,3}.json`: three interleaved rounds of `benches/wasm-instance` (5 warm-up and 30 samples). |
| Crate runs | `concerto-rust`'s `benches/results/P5-13/rust-crit-{before,after}-{1,2}.json`: two interleaved rounds with criterion defaults. |

## Through the TS public API

Medians are in µs per model or per instance, for runs 1, 2 and 3. The
ratios use the median of the three runs.

| Model set | Metric | TS 5.0.0, runs 1 / 2 / 3 | Rust before, runs 1 / 2 / 3 | Rust P5-13, runs 1 / 2 / 3 | before / TS | **P5-13 / TS** | speed-up |
|---|---|---|---|---|---|---|---|
| concerto-core-test-data | validateAst | 718.3 / 731.2 / 734.7 | 897.8 / 901.3 / 929.2 | 291.8 / 263.7 / 273.8 | 1.23× | **0.37×** | 3.29× |
| conformance | validateAst | 278.5 / 278.6 / 305.2 | 567.1 / 530.2 / 526.2 | 133.2 / 122.6 / 120.3 | 1.90× | **0.44×** | 4.32× |
| (synthetic, 500) | fromJSON | 8.8 / 9.0 / 8.8 | 64.8 / 58.4 / 57.7 | 37.2 / 37.4 / 36.1 | 6.61× | **4.22×** | 1.57× |
| (synthetic, 500) | resource.validate() | 2.1 / 2.1 / 2.3 | 24.1 / 21.2 / 21.9 | 21.5 / 21.0 / 21.5 | 10.33× | **10.13×** | 1.02× |

- **validateAst meets its target.** Through the TS API, it is now 2.3× to
  2.7× *faster* than TS 5.0.0 on both model sets. Before P5-13 it was 1.2×
  to 1.9× slower. The P5-13 build is 3.3× to 4.3× faster than the
  integration head.
- **fromJSON is 1.57× faster** than before, but still 4.2× slower than
  TS.
- **resource.validate() through the TS API has not changed** (1.02×) and
  is still about 10× slower than TS. The validator itself got faster in
  WASM and natively (below), so the cost on this path is outside the
  validator, in the per-call work between TS and the engine. P5-13 does
  not change that work.

## The instance validator inside WASM

These runs time `benches/wasm-instance`: the criterion instance workload
(the same model, the same 500 instances), compiled to
`wasm32-unknown-unknown` with wasm-opt and run in V8 under Node. Each timed
call walks all 500 instances inside WASM, so there is no per-call work
between TS and the engine. Medians are in µs per instance, for runs 1, 2
and 3; the ratios use the median of the three runs.

| Route | Before, runs 1 / 2 / 3 | P5-13, runs 1 / 2 / 3 | speed-up | P5-13 / TS 5.0.0 |
|---|---|---|---|---|
| `validate_only` (`validate_instance`, the `ResourceValidator` walk) | 2.45 / 2.23 / 2.26 | 1.33 / 1.35 / 1.38 | 1.68× | **0.64×** of `resource.validate()` (2.12 µs) |
| `from_json` (concerto-core-js `Serializer::from_json`) | 19.94 / 20.08 / 19.85 | 7.54 / 7.26 / 6.96 | 2.75× | **0.82×** of `fromJSON` (8.83 µs) |
| `validate_instance_native` (`ModelManager::validate_instance`) | 17.17 / 16.99 / 17.00 | 5.50 / 5.38 / 5.33 | 3.16× | – |

- **The in-WASM instance validator meets its target.** At 1.35 µs per
  instance, it takes 0.64× the time of TS 5.0.0's whole `validate()`
  (2.12 µs, the TS-API median above). Before P5-13 it took 2.26 µs, about
  the same as TS (1.07×).
- **Inside WASM, `Serializer::from_json` is also below TS's `fromJSON`**
  (7.26 µs against 8.83 µs). Before P5-13 it was 2.3× slower.
- The before figure here (2.26 µs) is lower than P5-12b's 3.9 µs floor
  (accordproject/concerto-rust#292). That floor was measured with a
  different harness, so the two are not directly comparable. This
  section compares only before and after in the same harness.
- So the gap between the in-WASM figures and the TS-API figures (21.5 µs
  for `validate()`, 37.2 µs for `fromJSON`) is the per-call work between
  TS and the engine, not the validator.

## The Rust crate directly (criterion)

Medians are in µs per model or per instance, for runs 1 and 2. The
speed-up uses the mean of the two runs.

| Benchmark | Before (`f6c797d`), runs 1 / 2 | P5-13 (`db09431`), runs 1 / 2 | Speed-up |
|---|---|---|---|
| `ModelManager::validate_ast`, concerto-core-test-data | 1858.4 / 1845.0 | 306.1 / 300.3 | 6.11× |
| `ModelManager::validate_ast`, conformance | 999.7 / 981.3 | 138.5 / 137.3 | 7.18× |
| `ModelFile::from_json`, concerto-core-test-data | 130.6 / 125.9 | 124.8 / 125.5 | 1.03× |
| `ModelFile::from_json`, conformance | 53.5 / 52.4 | 51.6 / 51.0 | 1.03× |
| `ModelFile::from_json`, synthetic-large | 9176.8 / 8613.2 | 8798.0 / 8517.4 | 1.03× |
| `validate_instance` (`validate_only`, 500) | 4.7 / 4.6 | 1.3 / 1.3 | 3.54× |
| `Serializer::from_json` (concerto-core-js, 500) | 45.8 / 44.3 | 12.4 / 12.4 | 3.63× |
| `ModelManager::validate_instance` (native, 500) | 38.2 / 37.3 | 8.9 / 8.8 | 4.27× |

- **The metamodel check is 6.1× to 7.2× faster.** It no longer inserts and
  removes the metamodel on every call, and it clones and allocates less.
  The native time per model (about 300 µs and 140 µs) is close to the
  time through the TS API. So on this path, most of the remaining cost is
  in the check itself, not in crossing between TS and the engine.
- **The instance paths are 3.5× to 4.3× faster.**
- **`ModelFile::from_json` is unchanged within noise.** P5-13 does not
  touch it; it is listed as a control.

## Remaining profile

These figures come from native `sample` profiles of
`concerto-core/examples/validator_profile.rs`, bucketed by
`flame.py` from P5-12d. The P5-13 profiles were taken on the round-1
work tree, shortly before the final commit, so they are indicative rather
than exact.

- **validate_ast on concerto-core-test-data:**
  - Allocation and free fell from 74.8% of self time (base) to 52.9%.
  - The next largest buckets are SipHash and IndexMap lookups (8.0%) and
    `JsValue::from_json`/`Instance::set` (6.6%).
  - Most of the remaining allocator calls come from dropping temporaries,
    building `JsValue` and `Instance` objects, and cloning.
- **Instance validation:** allocation and free fell from 76.0% to 60.8%.
  The next largest buckets are `JsValue::from_json`/`Instance::set`
  (9.3%) and hashing (7.8%).
- **What is left:**
  - The rest of the metamodel check still builds a `JsValue`/`Instance`
    tree per call.
  - Some SipHash cost remains (3.4% self time in
    `Sip13Rounds::Hasher::write`). P5-13 changed only maps whose
    iteration order is never observable. The ordered IndexMaps stay as
    they are, as PORTING.md 3.7 requires.

## Correctness during the run

The P5-13 verification (the oracle, the fuzz shard, the concerto-core
suite and the WASM leg) is reported on accordproject/concerto-rust#297.

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
