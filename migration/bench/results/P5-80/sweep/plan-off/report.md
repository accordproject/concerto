Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| modelfile_new | conformance | 11.4 us | 10.1 us | 0.89 | 71.6 us | 6.29 | - | - | - | - |
| modelfile_new | concerto-core-test-data | 30.7 us | 30.1 us | 0.98 | 142.5 us | 4.65 | - | - | - | - |
| to_json | synthetic-large | 10.2 us | 10.5 us | 1.03 | 46.5 us | 4.55 | - | - | - | - |
| modelfile_new | synthetic-large | 813.8 us | 1.45 ms | 1.78 | 3.50 ms | 4.30 | - | - | - | - |
| set_property_value | conformance | 0.91 us | 0.51 us | 0.56 | 3.84 us | 4.20 | - | - | - | - |
| add_array_value | conformance | 1.55 us | 0.88 us | 0.57 | 5.74 us | 3.70 | - | - | - | - |
| set_property_value | synthetic-large | 0.79 us | 0.70 us | 0.89 | 2.48 us | 3.14 | - | - | - | - |
| add_array_value | concerto-core-test-data | 22.0 us | 10.6 us | 0.48 | 60.6 us | 2.76 | - | - | - | - |
| add_array_value | synthetic-large | 1.32 us | 1.02 us | 0.78 | 3.40 us | 2.58 | - | - | - | - |
| new_resource | concerto-core-test-data | 10.6 us | - | - | 25.0 us | 2.35 | - | - | - | - |
| set_property_value | concerto-core-test-data | 2.59 us | 1.24 us | 0.48 | 5.90 us | 2.28 | - | - | - | - |
| new_resource | conformance | 4.83 us | 1.21 us | 0.25 | 9.87 us | 2.04 | - | - | - | - |
| to_json | conformance | 14.0 us | 3.71 us | 0.27 | 25.5 us | 1.82 | - | - | - | - |
| validate | conformance | 4.49 us | 1.61 us | 0.36 | 8.04 us | 1.79 | - | - | - | - |
| to_json | concerto-core-test-data | 52.8 us | 21.7 us | 0.41 | 84.4 us | 1.60 | - | - | - | - |
| new_resource | synthetic-large | 3.56 us | 1.42 us | 0.40 | 5.59 us | 1.57 | - | - | - | - |
| validate | synthetic-large | 6.68 us | 3.35 us | 0.50 | 10.1 us | 1.51 | - | - | - | - |
| validate | concerto-core-test-data | 21.4 us | 7.12 us | 0.33 | 30.7 us | 1.43 | - | - | - | - |
| dcs_decorate | synthetic-large | 60.31 ms | 40.17 ms | 0.67 | 84.96 ms | 1.41 | - | - | - | - |
| dcs_decorate | conformance | 21.60 ms | 8.18 ms | 0.38 | 26.40 ms | 1.22 | - | - | - | - |
| from_json | conformance | 14.8 us | 3.56 us | 0.24 | 17.0 us | 1.15 | - | - | - | - |
| from_json | concerto-core-test-data | 63.2 us | 19.9 us | 0.32 | 68.0 us | 1.07 | - | - | - | - |
| dcs_decorate | concerto-core-test-data | 40.61 ms | 22.25 ms | 0.55 | 39.35 ms | 0.97 | - | - | - | - |
| from_json | synthetic-large | 31.0 us | 10.5 us | 0.34 | 28.9 us | 0.93 | - | - | - | - |
| mm_new | conformance | 386.6 us | 1.64 us | 0.00 | 316.8 us | 0.82 | - | - | - | - |
