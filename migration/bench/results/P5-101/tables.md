# P5-101 benchmark: TS-API x TS 5.0.0, before and after

accordproject/concerto-rust#455 (transport and serializer consistency: one-pass codec,
stage-aware snapshots, one wire module). Driver: the P5-96 sweep
(`migration/bench/p515-sweep.mjs`), run by `migration/bench/p5101-run.sh` over the rows
the issue names (to_json, modelfile_new, add_model_file, extract_cold, validate) and the
rows the same changes touch; tables by `migration/bench/p5100-table.mjs`. One machine,
one run: TS 5.0.0 (the oracle reference), **before** (the integration heads, concerto
9633c99cf dist with concerto-rust 9fb1b63's engine) and **after** (this branch), 30
samples per row, 3 rounds with the order reversed every other round. Crossings per item
from the count mode (10 samples).

## Summary

- **to_json**: 27-35% faster (x TS 2.21 -> 1.62, 2.54 -> 1.67, 4.08 -> 2.67):
  `serializerToJson` reads its document in one pass and writes its result straight to
  text, with the serializer and options reused across calls (D-3, E-7), and the resource
  is written by the binary writer straight from the live object
  (`serializerToJsonBytes`, E-7), with no tagged object tree and no `JSON.stringify`.
- **from_json**: 2-13% faster (x TS 0.99 -> 0.85, 0.82 -> 0.79, 1.24 -> 1.13): the
  document goes through the same binary writer (`serializerFromJsonCompactBytes`, E-7).
- **extract_cold / extract_decorators (M5, D-10)**: crossings per item 48 -> 8
  (conformance) and 43 -> 10 (concerto-core-test-data): a DecoratorManager result
  registers its files from their stages in one call (`commitStagedModelFiles`, used
  directly by `adoptStagedModels`). The ids come back in a buffer the caller reuses:
  a first version returned a new `Uint32Array` per call and took one as input, and each
  new typed array's off-heap store cost about 1 ms of garbage collection on a
  47-file extract, which is what made that version slower (measured with a forced GC
  before each sample: commit time 1.3 ms against 0.08 ms for the per-file commits;
  with the reused buffer 0.07 ms). The sweep's extract_cold row has a CV of 30-70%
  and runs after every other op in one process; run alone (`extract-cold-alone/`, 4
  alternating pairs of 40 samples), after matches or beats before: conformance median
  4.16-4.41 ms against 4.40-4.92 ms (min 3.89-4.14 against 4.00-4.23),
  concerto-core-test-data 11.34-15.08 ms against 12.69-16.68 ms (min 8.16-9.04
  against 8.28-9.70), synthetic-large (8 crossings either way, unchanged by the
  batch) 21.80-24.38 ms against 19.82-23.19 ms (min 13.44-14.80 against 13.62-14.99).
- **validate_instance / validate_instance_or_throw, validate, modelfile_new,
  add_model_file, add_cto_model**: unchanged within noise (the staging, header and
  wire-writer changes are consolidation, D-4, D-10, F-8, E-14, at the same cost). The
  sweep has no `setPropertyValue` row, so the D-10 by-slot property binding
  (`validatePropertyById`) is not in this table.

## Every row

Rounds: 1, 2, 3. x TS = TS-API / TS 5.0.0 in the same round (> 1 = slower than TS), median over rounds.

| op | set | TS 5.0.0 | x TS before | **x TS after** | before | after | crossings/item before | after |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| to_json | concerto-core-test-data | 32.30 us | 2.21 | **1.62** | 72.69 us | 52.67 us | 1.0 | 1.0 |
| to_json | conformance | 7.72 us | 2.54 | **1.67** | 19.67 us | 12.83 us | 1.0 | 1.0 |
| to_json | synthetic-large | 8.62 us | 4.08 | **2.67** | 34.82 us | 22.89 us | 1.0 | 1.0 |
| modelfile_new | concerto-core-test-data | 27.24 us | 2.45 | **2.20** | 63.69 us | 59.90 us | 1.1 | 1.1 |
| modelfile_new | conformance | 7.71 us | 4.09 | **3.54** | 31.56 us | 26.70 us | 1.0 | 1.0 |
| modelfile_new | synthetic-large | 592.56 us | 4.06 | **3.92** | 2.41 ms | 2.35 ms | 1.0 | 1.0 |
| add_model_file | concerto-core-test-data | 61.23 us | 1.74 | **1.61** | 107.42 us | 109.62 us | 2.1 | 2.1 |
| add_model_file | conformance | 22.96 us | 2.00 | **1.93** | 49.47 us | 44.24 us | 2.1 | 2.1 |
| add_model_file | synthetic-large | 2.25 ms | 2.85 | **2.85** | 6.62 ms | 6.47 ms | 5.0 | 5.0 |
| extract_cold | concerto-core-test-data | 7.60 ms | 1.62 | **1.63** | 12.64 ms | 11.80 ms | 43.0 | 10.0 |
| extract_cold | conformance | 2.68 ms | 2.08 | **2.66** | 5.35 ms | 7.01 ms | 48.0 | 8.0 |
| extract_cold | synthetic-large | 8.51 ms | 2.02 | **2.40** | 17.02 ms | 20.39 ms | 8.0 | 8.0 |
| validate | concerto-core-test-data | 15.77 us | 1.06 | **1.06** | 16.86 us | 17.60 us | 1.0 | 1.0 |
| validate | conformance | 3.73 us | 0.92 | **0.98** | 3.61 us | 3.70 us | 1.0 | 1.0 |
| validate | synthetic-large | 6.06 us | 1.17 | **1.14** | 7.09 us | 6.50 us | 1.0 | 1.0 |
| from_json | concerto-core-test-data | 49.12 us | 0.99 | **0.85** | 47.01 us | 41.10 us | 1.0 | 1.0 |
| from_json | conformance | 12.92 us | 0.82 | **0.79** | 10.64 us | 10.38 us | 1.0 | 1.0 |
| from_json | synthetic-large | 16.76 us | 1.24 | **1.13** | 20.83 us | 18.64 us | 1.0 | 1.0 |
| add_cto_model | concerto-core-test-data | 435.13 us | 2.25 | **2.37** | 978.81 us | 1.01 ms | 2.1 | 2.1 |
| add_cto_model | conformance | 135.12 us | 2.77 | **2.77** | 374.92 us | 376.74 us | 2.1 | 2.1 |
| add_cto_model | synthetic-large | 20.81 ms | 1.26 | **1.23** | 25.79 ms | 25.18 ms | 5.0 | 5.0 |
| validate_instance | concerto-core-test-data | 60.38 us | 0.56 | **0.57** | 33.57 us | 34.62 us | 1.0 | 1.0 |
| validate_instance | conformance | 16.58 us | 0.58 | **0.60** | 9.55 us | 9.92 us | 1.0 | 1.0 |
| validate_instance | synthetic-large | 22.97 us | 0.69 | **0.71** | 15.82 us | 16.31 us | 1.0 | 1.0 |
| validate_instance_or_throw | concerto-core-test-data | 58.42 us | 0.84 | **0.82** | 49.06 us | 47.62 us | 1.0 | 1.0 |
| validate_instance_or_throw | conformance | 16.05 us | 0.80 | **0.84** | 13.19 us | 13.30 us | 1.0 | 1.0 |
| validate_instance_or_throw | synthetic-large | 22.58 us | 1.06 | **1.10** | 24.32 us | 24.88 us | 1.0 | 1.0 |
| extract_decorators | concerto-core-test-data | 6.20 ms | 0.60 | **0.60** | 3.70 ms | 3.70 ms | 43.0 | 10.0 |
| extract_decorators | conformance | 2.30 ms | 0.71 | **0.75** | 1.64 ms | 1.74 ms | 48.0 | 8.0 |
| extract_decorators | synthetic-large | 8.49 ms | 0.61 | **0.56** | 4.76 ms | 4.76 ms | 8.0 | 8.0 |
