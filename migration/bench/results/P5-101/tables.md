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

- **to_json**: 17-28% faster (x TS 2.00 -> 1.65, 2.70 -> 1.95, 4.03 -> 3.15):
  `serializerToJson` now reads its document in one pass and writes its result straight
  to text, with the serializer and options reused across calls (D-3, E-7).
- **validate_instance / validate_instance_or_throw**: the same or a little faster (the
  options are read once and the serializer reused, D-3).
- **modelfile_new, add_model_file, add_cto_model, validate, from_json**: unchanged
  within noise (the staging, header and wire-writer changes are consolidation, D-4,
  D-10, F-8, E-14, at the same cost).
- **extract_cold**: the sweep's row reads slower on two sets, but its samples have a
  CV of 30-45%, and it runs after every other op in one process (heap state). Run
  alone, 4 alternating pairs of 40 samples each, after matches or beats before:
  conformance median 4.22-4.91 ms against 4.56-4.66 ms (min 3.85-3.95 against
  4.00-4.11), concerto-core-test-data 10.72-13.62 ms against 12.90-15.71 ms (min
  8.28-8.71 against 8.24-9.82).
- **Batch commit (M5) measured and dropped**: a `commitStagedModelFiles(stages)`
  binding cut extract's crossings from 48 to 8 on conformance, but the per-file
  commits it replaced cost about 3 us each (80-130 us per extract), and with it the
  extract_cold median on conformance was 0.7-0.9 ms slower (5.0-5.6 ms against
  4.1-4.3 ms, 5 alternating runs), and addModelFiles of 41 files no faster
  (109-186 us against 109-125 us). The binding alone was 17 us against 19 us for 40
  files. It is not in this branch; extract keeps one commit per file.

## Every row

Rounds: 1, 2, 3. x TS = TS-API / TS 5.0.0 in the same round (> 1 = slower than TS), median over rounds.

| op | set | TS 5.0.0 | x TS before | **x TS after** | before | after | crossings/item before | after |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| to_json | concerto-core-test-data | 36.20 us | 2.00 | **1.65** | 68.40 us | 59.60 us | 1.0 | 1.0 |
| to_json | conformance | 7.60 us | 2.70 | **1.95** | 19.55 us | 14.61 us | 1.0 | 1.0 |
| to_json | synthetic-large | 8.59 us | 4.03 | **3.15** | 33.97 us | 27.13 us | 1.0 | 1.0 |
| modelfile_new | concerto-core-test-data | 27.08 us | 2.28 | **2.19** | 62.62 us | 59.00 us | 1.1 | 1.1 |
| modelfile_new | conformance | 7.50 us | 3.76 | **3.79** | 27.89 us | 28.44 us | 1.0 | 1.0 |
| modelfile_new | synthetic-large | 698.01 us | 3.48 | **3.27** | 2.43 ms | 2.26 ms | 1.0 | 1.0 |
| add_model_file | concerto-core-test-data | 72.83 us | 1.39 | **1.51** | 99.57 us | 100.45 us | 2.1 | 2.1 |
| add_model_file | conformance | 24.01 us | 1.95 | **1.79** | 43.11 us | 43.03 us | 2.1 | 2.1 |
| add_model_file | synthetic-large | 2.26 ms | 2.97 | **3.70** | 7.29 ms | 8.37 ms | 5.0 | 5.0 |
| extract_cold | concerto-core-test-data | 8.31 ms | 1.25 | **1.50** | 10.40 ms | 11.56 ms | 43.0 | 43.0 |
| extract_cold | conformance | 2.97 ms | 2.27 | **3.02** | 6.74 ms | 8.15 ms | 48.0 | 48.0 |
| extract_cold | synthetic-large | 8.81 ms | 2.48 | **2.04** | 21.32 ms | 18.29 ms | 8.0 | 8.0 |
| validate | concerto-core-test-data | 15.75 us | 1.08 | **1.12** | 17.79 us | 17.35 us | 1.0 | 1.0 |
| validate | conformance | 3.69 us | 0.97 | **0.99** | 3.55 us | 3.66 us | 1.0 | 1.0 |
| validate | synthetic-large | 5.32 us | 1.28 | **1.22** | 6.80 us | 6.54 us | 1.0 | 1.0 |
| from_json | concerto-core-test-data | 48.21 us | 0.99 | **0.95** | 47.97 us | 44.22 us | 1.0 | 1.0 |
| from_json | conformance | 13.11 us | 0.89 | **0.84** | 11.66 us | 10.84 us | 1.0 | 1.0 |
| from_json | synthetic-large | 17.11 us | 1.25 | **1.46** | 21.37 us | 24.81 us | 1.0 | 1.0 |
| add_cto_model | concerto-core-test-data | 477.63 us | 2.11 | **2.15** | 997.79 us | 1.01 ms | 2.1 | 2.1 |
| add_cto_model | conformance | 145.90 us | 2.71 | **2.65** | 450.33 us | 386.34 us | 2.1 | 2.1 |
| add_cto_model | synthetic-large | 20.65 ms | 1.32 | **1.27** | 27.05 ms | 26.00 ms | 5.0 | 5.0 |
| validate_instance | concerto-core-test-data | 58.54 us | 0.60 | **0.60** | 35.06 us | 35.21 us | 1.0 | 1.0 |
| validate_instance | conformance | 15.20 us | 0.68 | **0.62** | 10.25 us | 9.40 us | 1.0 | 1.0 |
| validate_instance | synthetic-large | 22.37 us | 0.76 | **0.77** | 17.10 us | 16.63 us | 1.0 | 1.0 |
| validate_instance_or_throw | concerto-core-test-data | 60.79 us | 0.92 | **0.84** | 56.06 us | 49.94 us | 1.0 | 1.0 |
| validate_instance_or_throw | conformance | 15.86 us | 0.91 | **0.83** | 14.40 us | 13.10 us | 1.0 | 1.0 |
| validate_instance_or_throw | synthetic-large | 21.85 us | 1.11 | **1.15** | 24.78 us | 25.78 us | 1.0 | 1.0 |
| extract_decorators | concerto-core-test-data | 6.46 ms | 0.60 | **0.60** | 3.90 ms | 3.86 ms | 43.0 | 43.0 |
| extract_decorators | conformance | 2.50 ms | 0.72 | **0.65** | 1.82 ms | 1.71 ms | 48.0 | 48.0 |
| extract_decorators | synthetic-large | 8.46 ms | 0.60 | **0.56** | 4.91 ms | 4.77 ms | 8.0 | 8.0 |
