Before: P5-15 rounds 1, 2, 3. Now: rounds 1, 2, 3. x TS = Rust / TS 5.0.0 timed in the same sweep (> 1 = slower than TS). Ranked by x TS API now.

| op | set | family | TS 5.0.0 now | crate now | x TS crate before -> now | TS API now | x TS API before -> now | ratio change | crossings/item before -> now | TS-API stages now | crate alloc+free / clone / hash now |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| dcs_validate | synthetic-large | decorator | 42.06 ms | - | new: - | 33.84 ms | 1.12 -> 0.80 | -28% | 31.0 -> 33.0 | core 75.5%, gc 11.4%, glue 5.3% | - |
| dcs_validate | conformance | decorator | 14.23 ms | - | new: - | 11.17 ms | 1.22 -> 0.78 | -36% | 191.0 -> 193.0 | core 65.4%, gc 16.7%, ts-core 4.9% | - |
| dcs_validate | concerto-core-test-data | decorator | 26.89 ms | - | new: - | 17.64 ms | 1.07 -> 0.66 | -38% | 163.0 -> 165.0 | core 74.4%, gc 11.6%, glue 4.8% | - |
