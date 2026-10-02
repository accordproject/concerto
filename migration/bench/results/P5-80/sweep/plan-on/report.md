Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| modelfile_new | conformance | 11.4 us | 9.43 us | 0.83 | 57.4 us | 5.04 | - | - | - | - |
| set_property_value | conformance | 0.91 us | 0.39 us | 0.43 | 4.46 us | 4.88 | - | - | - | - |
| modelfile_new | concerto-core-test-data | 30.7 us | 29.1 us | 0.95 | 138.5 us | 4.52 | - | - | - | - |
| modelfile_new | synthetic-large | 813.8 us | 1.50 ms | 1.84 | 3.23 ms | 3.97 | - | - | - | - |
| to_json | synthetic-large | 10.2 us | 9.45 us | 0.92 | 37.8 us | 3.70 | - | - | - | - |
| add_array_value | conformance | 1.55 us | 0.93 us | 0.60 | 5.56 us | 3.59 | - | - | - | - |
| set_property_value | synthetic-large | 0.79 us | 0.61 us | 0.78 | 2.25 us | 2.86 | - | - | - | - |
| add_array_value | concerto-core-test-data | 22.0 us | 9.62 us | 0.44 | 57.6 us | 2.62 | - | - | - | - |
| add_array_value | synthetic-large | 1.32 us | 1.07 us | 0.81 | 3.01 us | 2.28 | - | - | - | - |
| validate | conformance | 4.49 us | 1.21 us | 0.27 | 8.16 us | 1.82 | - | - | - | - |
| set_property_value | concerto-core-test-data | 2.59 us | 1.05 us | 0.41 | 4.58 us | 1.77 | - | - | - | - |
| to_json | conformance | 14.0 us | 3.40 us | 0.24 | 23.9 us | 1.71 | - | - | - | - |
| new_resource | synthetic-large | 3.56 us | 1.32 us | 0.37 | 5.56 us | 1.56 | - | - | - | - |
| to_json | concerto-core-test-data | 52.8 us | 19.4 us | 0.37 | 81.2 us | 1.54 | - | - | - | - |
| new_resource | conformance | 4.83 us | 1.13 us | 0.23 | 7.16 us | 1.48 | - | - | - | - |
| dcs_decorate | synthetic-large | 60.31 ms | 37.36 ms | 0.62 | 83.31 ms | 1.38 | - | - | - | - |
| new_resource | concerto-core-test-data | 10.6 us | - | - | 14.0 us | 1.32 | - | - | - | - |
| dcs_decorate | conformance | 21.60 ms | 8.18 ms | 0.38 | 24.83 ms | 1.15 | - | - | - | - |
| from_json | conformance | 14.8 us | 3.43 us | 0.23 | 16.3 us | 1.10 | - | - | - | - |
| validate | synthetic-large | 6.68 us | 3.02 us | 0.45 | 7.14 us | 1.07 | - | - | - | - |
| from_json | concerto-core-test-data | 63.2 us | 15.6 us | 0.25 | 60.4 us | 0.96 | - | - | - | - |
| dcs_decorate | concerto-core-test-data | 40.61 ms | 20.89 ms | 0.51 | 38.09 ms | 0.94 | - | - | - | - |
| validate | concerto-core-test-data | 21.4 us | 5.89 us | 0.28 | 19.9 us | 0.93 | - | - | - | - |
| from_json | synthetic-large | 31.0 us | 8.14 us | 0.26 | 27.6 us | 0.89 | - | - | - | - |
| mm_new | conformance | 386.6 us | 1.58 us | 0.00 | 307.3 us | 0.79 | - | - | - | - |
