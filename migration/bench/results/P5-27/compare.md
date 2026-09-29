Before: P5-15 rounds 1, 2, 3. Now: rounds 1, 2, 3. x TS = Rust / TS 5.0.0 timed in the same sweep (> 1 = slower than TS). Ranked by x TS API now.

| op | set | family | TS 5.0.0 now | crate now | x TS crate before -> now | TS API now | x TS API before -> now | ratio change | crossings/item before -> now | TS-API stages now | crate alloc+free / clone / hash now |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| extract_vocabularies | conformance | decorator | 2.49 ms | - | new: - | 13.75 ms | 8.26 -> 5.52 | -33% | 190.0 -> 107.0 | core 60.9%, gc 21.7%, views 7.5% | - |
| extract_decorators | conformance | decorator | 2.42 ms | - | new: - | 13.04 ms | 7.55 -> 5.39 | -29% | 190.0 -> 107.0 | core 62.5%, gc 20.5%, views 7.1% | - |
| extract_vocabularies | concerto-core-test-data | decorator | 6.93 ms | - | new: - | 33.02 ms | 5.12 -> 4.77 | -7% | 162.0 -> 93.0 | core 67.5%, gc 22.3%, glue 4.6% | - |
| extract_vocabularies | synthetic-large | decorator | 10.14 ms | - | new: - | 46.38 ms | 7.08 -> 4.57 | -35% | 30.0 -> 27.0 | core 66.1%, gc 26.6%, glue 5% | - |
| extract_decorators | concerto-core-test-data | decorator | 7.97 ms | - | new: - | 26.55 ms | 4.91 -> 3.33 | -32% | 162.0 -> 93.0 | core 64.7%, gc 18.8%, glue 9.2% | - |
| extract_decorators | synthetic-large | decorator | 10.53 ms | - | new: - | 34.00 ms | 6.14 -> 3.23 | -47% | 30.0 -> 27.0 | core 76.6%, gc 12.8%, glue 5.9% | - |
| dcs_validate | conformance | decorator | 14.84 ms | - | new: - | 25.33 ms | 1.63 -> 1.71 | +5% | 191.0 -> 191.0 | core 76.6%, gc 10.7%, glue 3.7% | - |
| dcs_decorate | synthetic-large | decorator | 48.03 ms | - | new: - | 69.86 ms | 1.54 -> 1.45 | -6% | 30.0 -> 27.0 | core 81%, gc 11.3%, glue 5.4% | - |
| dcs_validate | concerto-core-test-data | decorator | 25.94 ms | - | new: - | 37.24 ms | 1.34 -> 1.44 | +7% | 163.0 -> 163.0 | core 80.2%, gc 7.1%, glue 5.3% | - |
| dcs_decorate | conformance | decorator | 16.91 ms | - | new: - | 20.91 ms | 1.21 -> 1.24 | +2% | 190.0 -> 107.0 | core 77.5%, gc 9.3%, views 5.5% | - |
| dcs_validate | synthetic-large | decorator | 42.85 ms | - | new: - | 49.74 ms | 1.14 -> 1.16 | +2% | 31.0 -> 31.0 | core 81.1%, glue 7.4%, gc 6.7% | - |
| dcs_decorate | concerto-core-test-data | decorator | 43.47 ms | - | new: - | 34.62 ms | 0.90 -> 0.80 | -12% | 162.0 -> 93.0 | core 78.3%, gc 10.5%, glue 7.3% | - |
