Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| extract_vocabularies | conformance | 2.31 ms | 58.20 ms (rebuild 64.47 ms) | 25.22 (27.94) | 56.05 ms | 24.29 | 190.0 | 92% | core 86.6%, glue 4.5%, views 3.2% | - |
| add_model_file | conformance | 19.5 us | 132.9 us | 6.81 | 395.1 us | 20.24 | 5.3 | 86% | core 60.1%, gc 15.7%, glue 11% | - |
| extract_vocabularies | concerto-core-test-data | 7.60 ms | 138.00 ms (rebuild 142.90 ms) | 18.15 (18.80) | 116.66 ms | 15.34 | 162.0 | 96% | core 88.5%, glue 4.2%, other 3% | - |
| extract_decorators | conformance | 3.12 ms | 54.44 ms (rebuild 63.74 ms) | 17.47 (20.46) | 45.26 ms | 14.53 | 190.0 | 93% | core 85.9%, glue 5.3%, other 3% | - |
| new_resource | conformance | 3.40 us | 1.13 us | 0.33 | 47.8 us | 14.05 | 10.5 | 76% | glue 46.2%, ts-core 22%, other 14% | - |
| extract_decorators | concerto-core-test-data | 6.88 ms | 132.61 ms (rebuild 137.88 ms) | 19.27 (20.04) | 93.95 ms | 13.66 | 162.0 | 95% | core 88.8%, glue 4.3%, other 3% | - |
| get_namespaces | concerto-core-test-data | 0.67 us | 1.03 us | 1.55 | 8.75 us | 13.10 | 2.0 | 68% | other 39.1%, ts-core 22.3%, glue 22.1% | - |
| resolve_type | concerto-core-test-data | 0.24 us | 0.05 us | 0.22 | 3.02 us | 12.80 | 2.0 | 40% | ts-core 61.8%, core 12.7%, other 12.3% | - |
| get_namespaces | conformance | 0.78 us | 1.07 us | 1.38 | 9.93 us | 12.75 | 2.0 | 84% | other 36%, ts-core 23.9%, glue 23% | - |
| extract_vocabularies | synthetic-large | 8.17 ms | 38.33 ms (rebuild 50.09 ms) | 4.69 (6.13) | 88.98 ms | 10.89 | 30.0 | 93% | core 78.3%, gc 7.2%, glue 6.7% | - |
| resolve_type | conformance | 0.29 us | 0.05 us | 0.18 | 3.00 us | 10.30 | 2.0 | 37% | ts-core 62.3%, glue 13.4%, core 12.5% | - |
| modelfile_new | conformance | 7.13 us | 12.7 us | 1.78 | 72.1 us | 10.11 | 3.0 | 83% | core 43.1%, glue 27.8%, views 15.9% | - |
| new_resource | concerto-core-test-data | 5.79 us | 1.35 us | 0.23 | 56.4 us | 9.76 | 14.4 | 69% | glue 45.2%, ts-core 20.4%, other 14.3% | - |
| get_type | concerto-core-test-data | 0.35 us | 0.10 us | 0.28 | 2.93 us | 8.47 | 2.0 | 29% | ts-core 57.4%, views 11.9%, core 10.5% | - |
| get_type | conformance | 0.41 us | 0.07 us | 0.18 | 3.30 us | 8.07 | 2.0 | 25% | ts-core 58.4%, other 16.5%, glue 9.9% | - |
| add_model_file | concerto-core-test-data | 52.9 us | 267.2 us | 5.05 | 410.9 us | 7.77 | 5.4 | 84% | core 62.1%, gc 16.5%, views 9.2% | - |
| modelfile_new | concerto-core-test-data | 25.0 us | 38.9 us | 1.56 | 184.5 us | 7.39 | 3.0 | 75% | core 56.4%, glue 20.5%, views 15.4% | - |
| get_namespaces | synthetic-large | 0.12 us | 0.06 us | 0.51 | 0.85 us | 7.08 | 2.0 | 74% | other 50.6%, glue 24.9%, core 15.3% | - |
| extract_decorators | synthetic-large | 8.87 ms | 38.73 ms (rebuild 47.12 ms) | 4.37 (5.31) | 61.83 ms | 6.97 | 30.0 | 92% | core 78.6%, glue 7.7%, other 6.3% | - |
| add_cto_model | conformance | 121.8 us | 132.9 us | 1.09 | 844.2 us | 6.93 | 5.3 | 50% | core 39.1%, cto-parser 32.7%, glue 9.4% | - |
| add_array_value | synthetic-large | 0.69 us | 1.38 us | 2.00 | 4.17 us | 6.03 | 1.0 | 37% | core 31.3%, ts-core 22.6%, glue 18.1% | - |
| add_array_value | concerto-core-test-data | 14.2 us | 10.5 us | 0.74 | 82.8 us | 5.83 | 34.6 | 53% | ts-core 31.7%, glue 30.1%, views 10.3% | - |
| add_model_file | synthetic-large | 1.87 ms | 3.95 ms | 2.12 | 10.53 ms | 5.65 | 18.0 | 86% | core 68.6%, gc 15.4%, views 8.5% | - |
| set_property_value | conformance | 0.50 us | 0.46 us | 0.93 | 2.75 us | 5.55 | 1.2 | 12% | ts-core 44.6%, core 22.7%, glue 9.3% | - |
| to_json | synthetic-large | 6.54 us | 9.81 us | 1.50 | 35.2 us | 5.38 | 1.0 | 73% | core 66.5%, encode 18.4%, glue 6.5% | - |
| modelfile_new | synthetic-large | 629.1 us | 1.73 ms | 2.75 | 3.26 ms | 5.18 | 3.0 | 84% | core 66.3%, views 14%, glue 12.9% | - |
| new_resource | synthetic-large | 2.56 us | 1.33 us | 0.52 | 12.5 us | 4.89 | 10.0 | 62% | glue 43.9%, views 17.6%, ts-core 13.8% | - |
| add_array_value | conformance | 0.97 us | 0.72 us | 0.74 | 4.46 us | 4.60 | 1.0 | 12% | ts-core 53.7%, core 15.5%, glue 11.1% | - |
| get_type | synthetic-large | 0.39 us | 0.07 us | 0.17 | 1.59 us | 4.08 | 2.0 | 50% | views 29.5%, glue 23.4%, core 17.3% | - |
| derives_from | concerto-core-test-data | 0.57 us | 0.15 us | 0.27 | 2.01 us | 3.51 | 2.0 | 42% | ts-core 56.8%, core 25.2%, glue 10.2% | - |
| resolve_type | synthetic-large | 0.27 us | 0.06 us | 0.22 | 0.89 us | 3.26 | 2.0 | 54% | glue 34.8%, core 30.8%, other 23.3% | - |
| add_cto_model | concerto-core-test-data | 487.3 us | 267.2 us | 0.55 | 1.56 ms | 3.20 | 5.4 | 47% | core 37.9%, cto-parser 35.9%, gc 10.4% | - |
| to_json | conformance | 6.04 us | 3.32 us | 0.55 | 19.1 us | 3.17 | 1.0 | 39% | core 61.3%, encode 19.7%, ts-core 6.9% | - |
| set_property_value | synthetic-large | 0.57 us | 0.77 us | 1.36 | 1.73 us | 3.05 | 1.0 | 35% | ts-core 33.5%, core 31.1%, views 13.3% | - |
| derives_from | conformance | 0.61 us | 0.16 us | 0.26 | 1.78 us | 2.89 | 2.0 | 37% | ts-core 59.3%, core 22.3%, glue 12.8% | - |
| from_json | synthetic-large | 22.1 us | 8.45 us | 0.38 | 50.1 us | 2.27 | 13.0 | 72% | core 58.1%, encode 13.3%, glue 10.2% | - |
| dcs_decorate | concerto-core-test-data | 39.63 ms | 82.26 ms (rebuild 73.80 ms) | 2.08 (1.86) | 89.59 ms | 2.26 | 162.0 | 94% | core 87%, glue 5.4%, gc 2.5% | - |
| from_json | conformance | 19.1 us | 3.69 us | 0.19 | 42.8 us | 2.24 | 7.5 | 65% | core 40.9%, glue 17.5%, ts-core 15% | - |
| to_json | concerto-core-test-data | 31.4 us | 22.8 us | 0.73 | 68.2 us | 2.17 | 1.0 | 68% | core 64.6%, encode 20.5%, decode 6.5% | - |
| dcs_decorate | conformance | 22.98 ms | 40.97 ms (rebuild 45.37 ms) | 1.78 (1.97) | 45.89 ms | 2.00 | 190.0 | 91% | core 86%, glue 5.1%, views 3% | - |
| set_property_value | concerto-core-test-data | 1.70 us | 1.34 us | 0.79 | 3.38 us | 1.99 | 1.2 | 35% | ts-core 33.8%, core 30.1%, views 12.1% | - |
| is_assignable_to | concerto-core-test-data | 0.94 us | 0.21 us | 0.22 | 1.87 us | 1.99 | 2.0 | 45% | ts-core 53.4%, core 29.7%, other 9.7% | - |
| from_json | concerto-core-test-data | 63.6 us | 23.5 us | 0.37 | 118.8 us | 1.87 | 14.4 | 70% | core 51.8%, glue 13.2%, encode 12.1% | - |
| is_assignable_to | conformance | 1.00 us | 0.23 us | 0.23 | 1.87 us | 1.86 | 2.0 | 39% | ts-core 56.8%, core 27.1%, other 8.8% | - |
| dcs_validate | conformance | 15.56 ms | 5.94 ms (rebuild 8.11 ms) | 0.38 (0.52) | 27.08 ms | 1.74 | 191.0 | 85% | core 76.5%, gc 9.8%, glue 4.2% | - |
| validate | conformance | 2.90 us | 1.54 us | 0.53 | 5.01 us | 1.73 | 1.0 | 17% | ts-core 54.3%, core 37.3%, glue 3.8% | - |
| add_cto_model | synthetic-large | 24.58 ms | 3.95 ms | 0.16 | 39.52 ms | 1.61 | 18.0 | 24% | cto-parser 59.5%, core 24.3%, gc 8% | - |
| validate | synthetic-large | 4.15 us | 3.62 us | 0.87 | 6.62 us | 1.59 | 1.0 | 54% | core 58.7%, ts-core 31.2%, glue 3.7% | - |
| dcs_decorate | synthetic-large | 53.85 ms | 46.11 ms (rebuild 54.37 ms) | 0.86 (1.01) | 80.05 ms | 1.49 | 30.0 | 95% | core 83.7%, glue 6.7%, gc 4.4% | - |
| derives_from | synthetic-large | 0.46 us | 0.16 us | 0.35 | 0.67 us | 1.48 | 2.0 | 73% | core 58.3%, glue 27.9%, other 7.7% | - |
| dcs_validate | concerto-core-test-data | 27.20 ms | 10.49 ms (rebuild 12.44 ms) | 0.39 (0.46) | 39.02 ms | 1.43 | 163.0 | 90% | core 80.9%, gc 7.2%, glue 5.3% | - |
| validate | concerto-core-test-data | 13.7 us | 6.14 us | 0.45 | 17.5 us | 1.28 | 1.0 | 48% | core 52.1%, ts-core 39.6%, other 5% | - |
| mm_new | conformance | 404.8 us | 9.19 us | 0.02 | 506.5 us | 1.25 | 13.0 | 58% | core 29.7%, views 28%, gc 21% | - |
| get_decorators | concerto-core-test-data | 0.13 us | 0.00 us | 0.03 | 0.14 us | 1.10 | 0.0 | 0% | other 99.1%, gc 0.8%, views 0.1% | - |
| get_decorators | synthetic-large | 0.02 us | 0.00 us | 0.26 | 0.02 us | 1.10 | 0.0 | 0% | other 99.4%, gc 0.5%, views 0% | - |
| dcs_validate | synthetic-large | 44.58 ms | 16.89 ms (rebuild 21.00 ms) | 0.38 (0.47) | 49.15 ms | 1.10 | 31.0 | 90% | core 81.6%, glue 7%, gc 5.8% | - |
| get_decorators | conformance | 0.07 us | 0.00 us | 0.06 | 0.07 us | 1.02 | 0.0 | 0% | other 99.1%, gc 0.8%, views 0.2% | - |
| is_assignable_to | synthetic-large | 0.87 us | 0.22 us | 0.25 | 0.76 us | 0.87 | 2.0 | 74% | core 65.8%, glue 15.5%, other 13.4% | - |
