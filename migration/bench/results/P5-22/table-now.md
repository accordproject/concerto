Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| add_model_file | conformance | 19.5 us | 40.3 us | 2.06 | 276.1 us | 14.15 | 5.3 | 78% | core 50.1%, gc 22.3%, glue 13.4% | - |
| get_namespaces | concerto-core-test-data | 0.67 us | 1.12 us | 1.67 | 8.87 us | 13.28 | 2.0 | 66% | other 40.5%, glue 22.2%, ts-core 19.5% | - |
| get_namespaces | conformance | 0.78 us | 1.03 us | 1.33 | 10.1 us | 13.03 | 2.0 | 78% | other 40.1%, glue 21.4%, ts-core 19.4% | - |
| resolve_type | concerto-core-test-data | 0.24 us | 0.05 us | 0.22 | 2.76 us | 11.70 | 2.0 | 30% | ts-core 63.8%, core 13.1%, glue 11.2% | - |
| get_namespaces | synthetic-large | 0.12 us | 0.06 us | 0.46 | 1.31 us | 10.88 | 2.0 | 77% | other 50.4%, glue 24%, core 16.2% | - |
| extract_vocabularies | conformance | 2.31 ms | 4.56 ms (rebuild 6.00 ms) | 1.98 (2.60) | 22.89 ms | 9.92 | 190.0 | 86% | core 64.8%, glue 11.9%, gc 8.3% | - |
| get_type | concerto-core-test-data | 0.35 us | 0.07 us | 0.20 | 3.26 us | 9.42 | 2.0 | 26% | ts-core 57.1%, views 11.4%, glue 10.2% | - |
| modelfile_new | conformance | 7.13 us | 11.5 us | 1.61 | 65.0 us | 9.11 | 3.0 | 76% | core 39.9%, glue 29.5%, views 17% | - |
| modelfile_new | concerto-core-test-data | 25.0 us | 51.1 us | 2.05 | 227.2 us | 9.10 | 3.0 | 84% | core 54.9%, glue 21.5%, views 15.5% | - |
| resolve_type | conformance | 0.29 us | 0.05 us | 0.17 | 2.61 us | 8.94 | 2.0 | 23% | ts-core 64%, glue 12.5%, core 11.7% | - |
| extract_vocabularies | synthetic-large | 8.17 ms | 21.11 ms (rebuild 31.39 ms) | 2.58 (3.84) | 70.64 ms | 8.64 | 30.0 | 92% | core 75.5%, glue 7.8%, gc 7.3% | - |
| extract_decorators | synthetic-large | 8.87 ms | 17.88 ms (rebuild 27.35 ms) | 2.02 (3.08) | 70.48 ms | 7.95 | 30.0 | 91% | core 74.9%, glue 9.1%, other 7.3% | - |
| extract_decorators | conformance | 3.12 ms | 4.07 ms (rebuild 5.61 ms) | 1.31 (1.80) | 21.31 ms | 6.84 | 190.0 | 83% | core 64.6%, glue 12.1%, gc 8.2% | - |
| modelfile_new | synthetic-large | 629.1 us | 1.72 ms | 2.74 | 4.00 ms | 6.36 | 3.0 | 86% | core 66.6%, views 14%, glue 12.5% | - |
| extract_vocabularies | concerto-core-test-data | 7.60 ms | 11.74 ms (rebuild 16.61 ms) | 1.54 (2.18) | 45.69 ms | 6.01 | 162.0 | 90% | core 71%, glue 9.8%, gc 7.5% | - |
| add_cto_model | conformance | 121.8 us | 40.3 us | 0.33 | 710.6 us | 5.84 | 5.3 | 40% | cto-parser 37.9%, core 24.9%, gc 14.8% | - |
| extract_decorators | concerto-core-test-data | 6.88 ms | 11.13 ms (rebuild 17.94 ms) | 1.62 (2.61) | 40.11 ms | 5.83 | 162.0 | 88% | core 69.5%, glue 11.1%, other 7.4% | - |
| add_model_file | synthetic-large | 1.87 ms | 3.56 ms | 1.91 | 10.29 ms | 5.52 | 18.0 | 88% | core 67.8%, gc 15.9%, views 8.9% | - |
| add_model_file | concerto-core-test-data | 52.9 us | 94.2 us | 1.78 | 279.5 us | 5.28 | 5.4 | 80% | core 51.7%, gc 21.8%, glue 12.8% | - |
| get_type | conformance | 0.41 us | 0.10 us | 0.24 | 2.13 us | 5.22 | 2.0 | 25% | ts-core 57.2%, views 12.1%, glue 10.3% | - |
| set_property_value | conformance | 0.50 us | 0.36 us | 0.73 | 2.48 us | 5.00 | 1.2 | 14% | ts-core 37.9%, core 23%, glue 9.6% | - |
| to_json | synthetic-large | 6.54 us | 10.3 us | 1.57 | 29.2 us | 4.46 | 1.0 | 74% | core 69.2%, encode 17.9%, decode 5.8% | - |
| add_array_value | conformance | 0.97 us | 0.84 us | 0.87 | 4.29 us | 4.42 | 1.0 | 27% | ts-core 41%, encode 20.8%, core 17.3% | - |
| derives_from | concerto-core-test-data | 0.57 us | 0.15 us | 0.27 | 2.46 us | 4.31 | 2.0 | 41% | ts-core 56.2%, core 25.6%, glue 10.4% | - |
| add_array_value | synthetic-large | 0.69 us | 1.02 us | 1.47 | 2.89 us | 4.18 | 1.0 | 40% | core 32.2%, glue 20.8%, ts-core 19.6% | - |
| new_resource | conformance | 3.40 us | 0.97 us | 0.29 | 14.0 us | 4.10 | 7.5 | 26% | ts-core 43.6%, views 25.2%, glue 14.2% | - |
| add_array_value | concerto-core-test-data | 14.2 us | 9.52 us | 0.67 | 52.7 us | 3.71 | 32.0 | 30% | ts-core 45.1%, views 14.6%, glue 12.3% | - |
| to_json | conformance | 6.04 us | 2.86 us | 0.47 | 18.9 us | 3.13 | 1.0 | 66% | core 60%, encode 22.2%, ts-core 5.9% | - |
| get_type | synthetic-large | 0.39 us | 0.06 us | 0.16 | 1.17 us | 3.01 | 2.0 | 66% | views 29.7%, glue 19.3%, core 17.2% | - |
| new_resource | concerto-core-test-data | 5.79 us | 1.29 us | 0.22 | 17.2 us | 2.97 | 11.4 | 24% | ts-core 43%, views 25.4%, glue 13.2% | - |
| set_property_value | synthetic-large | 0.57 us | 0.69 us | 1.22 | 1.65 us | 2.91 | 1.0 | 40% | ts-core 33.2%, core 31.9%, views 12.2% | - |
| derives_from | conformance | 0.61 us | 0.18 us | 0.29 | 1.75 us | 2.84 | 2.0 | 38% | ts-core 59.5%, core 21.8%, glue 10.5% | - |
| add_cto_model | concerto-core-test-data | 487.3 us | 94.2 us | 0.19 | 1.36 ms | 2.79 | 5.4 | 35% | cto-parser 40.4%, core 28.2%, gc 15.4% | - |
| new_resource | synthetic-large | 2.56 us | 1.29 us | 0.50 | 6.40 us | 2.50 | 7.0 | 32% | views 33.2%, glue 22.5%, ts-core 22.3% | - |
| to_json | concerto-core-test-data | 31.4 us | 20.5 us | 0.65 | 72.1 us | 2.30 | 1.0 | 67% | core 64.6%, encode 20.3%, decode 6% | - |
| resolve_type | synthetic-large | 0.27 us | 0.05 us | 0.20 | 0.61 us | 2.24 | 2.0 | 65% | glue 35.1%, core 31.6%, other 22.6% | - |
| is_assignable_to | concerto-core-test-data | 0.94 us | 0.21 us | 0.22 | 2.02 us | 2.14 | 2.0 | 52% | ts-core 53.9%, core 29.6%, other 9.8% | - |
| validate | conformance | 2.90 us | 1.19 us | 0.41 | 6.16 us | 2.13 | 1.0 | 20% | ts-core 55.6%, core 36.8%, glue 4.7% | - |
| set_property_value | concerto-core-test-data | 1.70 us | 1.14 us | 0.67 | 3.41 us | 2.01 | 1.2 | 32% | ts-core 35.1%, core 30.8%, views 13.1% | - |
| mm_new | conformance | 404.8 us | 9.63 us | 0.02 | 797.7 us | 1.97 | 13.0 | 57% | views 29.6%, core 28.5%, gc 22.5% | - |
| validate | synthetic-large | 4.15 us | 2.62 us | 0.63 | 7.94 us | 1.91 | 1.0 | 57% | core 60.1%, ts-core 30.7%, glue 5.2% | - |
| dcs_decorate | synthetic-large | 53.85 ms | 35.58 ms (rebuild 48.06 ms) | 0.66 (0.89) | 98.06 ms | 1.82 | 30.0 | 94% | core 82.6%, glue 7%, gc 4.8% | - |
| is_assignable_to | conformance | 1.00 us | 0.21 us | 0.21 | 1.80 us | 1.80 | 2.0 | 41% | ts-core 55.7%, core 28%, other 8.6% | - |
| dcs_decorate | concerto-core-test-data | 39.63 ms | 20.42 ms (rebuild 26.95 ms) | 0.52 (0.68) | 64.04 ms | 1.62 | 162.0 | 90% | core 77.2%, glue 8.9%, gc 6.3% | - |
| derives_from | synthetic-large | 0.46 us | 0.16 us | 0.35 | 0.69 us | 1.51 | 2.0 | 72% | core 55.3%, glue 20.7%, other 17.3% | - |
| add_cto_model | synthetic-large | 24.58 ms | 3.56 ms | 0.14 | 36.87 ms | 1.50 | 18.0 | 23% | cto-parser 61.5%, core 21.4%, gc 8.3% | - |
| dcs_validate | conformance | 15.56 ms | 5.26 ms (rebuild 6.48 ms) | 0.34 (0.42) | 21.64 ms | 1.39 | 191.0 | 84% | core 76.6%, gc 10.9%, glue 4% | - |
| dcs_decorate | conformance | 22.98 ms | 9.03 ms (rebuild 11.88 ms) | 0.39 (0.52) | 30.43 ms | 1.32 | 190.0 | 88% | core 74.3%, glue 9.1%, gc 6.3% | - |
| validate | concerto-core-test-data | 13.7 us | 6.13 us | 0.45 | 17.2 us | 1.26 | 1.0 | 51% | core 53.7%, ts-core 36.3%, other 4.4% | - |
| get_decorators | concerto-core-test-data | 0.13 us | 0.00 us | 0.03 | 0.16 us | 1.25 | 0.0 | 0% | other 98.5%, gc 1.1%, views 0.5% | - |
| dcs_validate | concerto-core-test-data | 27.20 ms | 10.16 ms (rebuild 12.32 ms) | 0.37 (0.45) | 33.05 ms | 1.22 | 163.0 | 89% | core 81.6%, gc 7.2%, glue 5.1% | - |
| get_decorators | synthetic-large | 0.02 us | 0.00 us | 0.22 | 0.02 us | 1.12 | 0.0 | 0% | other 99%, gc 0.9%, views 0.1% | - |
| get_decorators | conformance | 0.07 us | 0.00 us | 0.05 | 0.08 us | 1.09 | 0.0 | 0% | other 99.3%, gc 0.6%, views 0.1% | - |
| dcs_validate | synthetic-large | 44.58 ms | 18.26 ms (rebuild 20.99 ms) | 0.41 (0.47) | 47.77 ms | 1.07 | 31.0 | 90% | core 81.4%, gc 7%, glue 6.6% | - |
| from_json | synthetic-large | 22.1 us | 7.14 us | 0.32 | 20.5 us | 0.93 | 1.0 | 67% | core 63%, encode 26.3%, glue 4.8% | - |
| from_json | conformance | 19.1 us | 2.84 us | 0.15 | 17.6 us | 0.92 | 1.0 | 54% | core 52.6%, encode 27.2%, ts-core 9.1% | - |
| from_json | concerto-core-test-data | 63.6 us | 22.3 us | 0.35 | 56.8 us | 0.89 | 1.0 | 65% | core 62.3%, encode 24.9%, glue 4.3% | - |
| is_assignable_to | synthetic-large | 0.87 us | 0.22 us | 0.25 | 0.75 us | 0.87 | 2.0 | 72% | core 65.2%, other 19.5%, glue 9.5% | - |
