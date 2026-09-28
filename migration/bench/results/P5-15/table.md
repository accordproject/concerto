Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| extract_vocabularies | conformance | 2.49 ms | 109.57 ms (rebuild 116.37 ms) | 43.95 (46.68) | 56.36 ms | 22.61 | 356.0 | 94% | core 89.1%, glue 3.5%, views 3% | 59% / 22% / 31% |
| extract_decorators | conformance | 2.72 ms | 109.50 ms (rebuild 110.85 ms) | 40.32 (40.82) | 54.20 ms | 19.96 | 356.0 | 93% | core 88.7%, glue 3.8%, views 2.9% | 59% / 20% / 31% |
| extract_vocabularies | concerto-core-test-data | 6.47 ms | 249.72 ms (rebuild 257.66 ms) | 38.59 (39.82) | 113.62 ms | 17.56 | 302.0 | 96% | core 90.2%, glue 3.4%, other 2.7% | 59% / 22% / 31% (conformance) |
| get_namespaces | concerto-core-test-data | 0.87 us | 4.62 us | 5.29 | 13.9 us | 15.92 | 2.0 | 75% | other 44.5%, glue 25.7%, ts-core 17.8% | 73% / 0% / 0% (conformance) |
| get_namespaces | conformance | 0.97 us | 5.42 us | 5.56 | 14.5 us | 14.90 | 2.0 | 82% | other 43%, glue 25.1%, ts-core 17.3% | 73% / 0% / 0% |
| extract_decorators | concerto-core-test-data | 6.88 ms | 253.11 ms (rebuild 260.14 ms) | 36.81 (37.83) | 101.98 ms | 14.83 | 302.0 | 96% | core 90.8%, glue 3.7%, other 3% | 63% / 23% / 31% |
| add_model_file | conformance | 25.3 us | 266.2 us | 10.54 | 344.5 us | 13.64 | 5.3 | 82% | core 67.9%, gc 12.1%, views 10.2% | 59% / 28% / 15% |
| new_resource | conformance | 4.30 us | 3.31 us | 0.77 | 54.8 us | 12.72 | 12.9 | 81% | glue 48.4%, ts-core 19.5%, other 16.8% | 51% / 6% / 10% |
| extract_vocabularies | synthetic-large | 9.13 ms | 83.22 ms (rebuild 98.82 ms) | 9.12 (10.83) | 100.19 ms | 10.98 | 36.0 | 93% | core 78.3%, glue 6.9%, gc 6.4% | 59% / 22% / 31% (conformance) |
| new_resource | concerto-core-test-data | 6.84 us | 4.14 us | 0.61 | 73.7 us | 10.77 | 17.6 | 82% | glue 47.7%, ts-core 18.9%, other 16.7% | 50% / 6% / 10% |
| get_namespaces | synthetic-large | 0.15 us | 0.40 us | 2.69 | 1.44 us | 9.67 | 2.0 | 77% | other 50.4%, glue 28.7%, core 11.7% | 73% / 0% / 0% (conformance) |
| modelfile_new | conformance | 7.44 us | 31.7 us | 4.26 | 66.2 us | 8.90 | 3.0 | 73% | core 45.9%, views 23%, glue 16.8% | 51% / 8% / 17% |
| resolve_type | concerto-core-test-data | 0.31 us | 0.15 us | 0.49 | 2.56 us | 8.34 | 2.0 | 36% | ts-core 60.8%, glue 14.1%, other 13.3% | 36% / 0% / 0% (conformance) |
| extract_decorators | synthetic-large | 9.46 ms | 79.30 ms (rebuild 92.97 ms) | 8.38 (9.83) | 77.57 ms | 8.20 | 36.0 | 93% | core 78.4%, glue 8.2%, other 6.5% | 62% / 23% / 31% |
| resolve_type | conformance | 0.37 us | 0.15 us | 0.39 | 2.89 us | 7.74 | 2.0 | 34% | ts-core 63.7%, glue 14.6%, other 10.8% | 36% / 0% / 0% |
| new_resource | synthetic-large | 3.18 us | 3.92 us | 1.23 | 23.7 us | 7.44 | 13.0 | 82% | glue 55.5%, other 18.1%, views 11.1% | 51% / 6% / 9% |
| add_model_file | concerto-core-test-data | 63.8 us | 478.3 us | 7.50 | 344.7 us | 5.40 | 5.5 | 85% | core 72.3%, gc 12.1%, views 7.4% | 57% / 31% / 9% |
| get_type | concerto-core-test-data | 0.44 us | 0.17 us | 0.38 | 2.38 us | 5.39 | 3.0 | 18% | ts-core 67.3%, views 13.7%, glue 8.8% | 25% / 0% / 0% (conformance) |
| add_cto_model | conformance | 113.4 us | 266.2 us | 2.35 | 527.5 us | 4.65 | 5.3 | 57% | core 45.7%, cto-parser 25.6%, gc 13% | 59% / 28% / 15% |
| derives_from | concerto-core-test-data | 0.55 us | 0.35 us | 0.63 | 2.52 us | 4.60 | 2.0 | 38% | ts-core 57%, core 24.8%, glue 13.1% | 13% / 0% / 0% (conformance) |
| get_type | conformance | 0.53 us | 0.16 us | 0.31 | 2.43 us | 4.59 | 3.0 | 20% | ts-core 69.1%, views 13.4%, glue 8.5% | 25% / 0% / 0% |
| derives_from | conformance | 0.62 us | 0.30 us | 0.47 | 2.78 us | 4.46 | 2.0 | 33% | ts-core 62.3%, core 21.3%, glue 11.9% | 13% / 0% / 0% |
| modelfile_new | synthetic-large | 871.6 us | 3.73 ms | 4.28 | 3.85 ms | 4.42 | 3.0 | 84% | core 64.1%, views 16.9%, glue 15% | 47% / 10% / 20% |
| add_model_file | synthetic-large | 2.50 ms | 8.21 ms | 3.28 | 10.08 ms | 4.03 | 19.0 | 88% | core 71.6%, gc 14.4%, views 7.4% | 53% / 10% / 12% |
| modelfile_new | concerto-core-test-data | 35.1 us | 89.4 us | 2.54 | 138.3 us | 3.94 | 3.1 | 74% | core 58.5%, views 18.1%, glue 15% | 50% / 10% / 18% |
| to_json | synthetic-large | 9.76 us | 20.1 us | 2.05 | 37.9 us | 3.89 | 1.0 | 70% | core 64.2%, encode 20.3%, glue 6.4% | 53% / 28% / 39% |
| to_json | conformance | 7.41 us | 8.95 us | 1.21 | 27.4 us | 3.70 | 1.0 | 61% | core 56.6%, encode 21.6%, ts-core 8.1% | 53% / 25% / 38% |
| from_json | conformance | 16.0 us | 10.1 us | 0.63 | 55.1 us | 3.44 | 8.6 | 65% | core 39%, glue 18.7%, ts-core 14.5% | 46% / 10% / 29% |
| add_cto_model | concerto-core-test-data | 385.5 us | 478.3 us | 1.24 | 1.20 ms | 3.12 | 5.5 | 49% | core 43.7%, cto-parser 33.7%, gc 12.9% | 57% / 31% / 9% |
| from_json | synthetic-large | 20.4 us | 20.5 us | 1.01 | 61.6 us | 3.03 | 15.0 | 69% | core 55.9%, encode 14.9%, glue 11.1% | 47% / 10% / 26% |
| is_assignable_to | concerto-core-test-data | 0.94 us | 0.50 us | 0.53 | 2.71 us | 2.89 | 2.0 | 45% | ts-core 55.9%, core 29.8%, glue 9.5% | 18% / 0% / 0% (conformance) |
| from_json | concerto-core-test-data | 54.5 us | 42.2 us | 0.78 | 139.8 us | 2.57 | 16.7 | 69% | core 50.3%, glue 13.7%, encode 11.6% | 41% / 8% / 23% |
| is_assignable_to | conformance | 1.15 us | 0.47 us | 0.41 | 2.91 us | 2.53 | 2.0 | 35% | ts-core 58.8%, core 27.6%, glue 8.7% | 18% / 0% / 0% |
| resolve_type | synthetic-large | 0.37 us | 0.12 us | 0.32 | 0.91 us | 2.47 | 2.0 | 70% | glue 41.2%, core 27.1%, other 23.1% | 36% / 0% / 0% (conformance) |
| mm_new | conformance | 227.8 us | 29.9 us | 0.13 | 539.5 us | 2.37 | 14.0 | 60% | core 42.1%, views 27.3%, gc 16.7% | 65% / 45% / 32% |
| dcs_decorate | conformance | 20.79 ms | 88.83 ms (rebuild 94.53 ms) | 4.27 (4.55) | 48.36 ms | 2.33 | 356.0 | 94% | core 88.5%, glue 4.1%, views 2.7% | 58% / 23% / 34% |
| dcs_decorate | concerto-core-test-data | 41.17 ms | 162.60 ms (rebuild 173.87 ms) | 3.95 (4.22) | 89.55 ms | 2.18 | 302.0 | 93% | core 88.3%, glue 4.7%, gc 2.3% | 59% / 24% / 34% |
| to_json | concerto-core-test-data | 34.0 us | 38.8 us | 1.14 | 73.4 us | 2.16 | 1.0 | 63% | core 62.5%, encode 20.7%, decode 6.7% | 52% / 27% / 38% |
| get_type | synthetic-large | 0.54 us | 0.14 us | 0.26 | 0.94 us | 1.74 | 3.0 | 38% | views 45%, glue 23.8%, ts-core 15.6% | 25% / 0% / 0% (conformance) |
| add_cto_model | synthetic-large | 23.34 ms | 8.21 ms | 0.35 | 40.00 ms | 1.71 | 19.0 | 24% | cto-parser 66.7%, core 21.1%, gc 5.7% | 53% / 10% / 12% |
| dcs_validate | conformance | 18.20 ms | 13.72 ms (rebuild 16.24 ms) | 0.75 (0.89) | 30.69 ms | 1.69 | 317.0 | 86% | core 78.6%, gc 7.3%, glue 4.2% | 51% / 12% / 27% |
| derives_from | synthetic-large | 0.64 us | 0.30 us | 0.47 | 1.08 us | 1.68 | 2.0 | 77% | core 55.9%, glue 33.9%, ts-core 5.7% | 12% / 0% / 0% |
| dcs_decorate | synthetic-large | 64.09 ms | 100.31 ms (rebuild 121.44 ms) | 1.57 (1.89) | 89.74 ms | 1.40 | 36.0 | 95% | core 84.3%, glue 6.7%, gc 4.1% | 56% / 24% / 34% |
| dcs_validate | concerto-core-test-data | 35.65 ms | 21.88 ms (rebuild 26.80 ms) | 0.61 (0.75) | 44.67 ms | 1.25 | 268.0 | 91% | core 81%, gc 6.7%, glue 4.9% | 50% / 12% / 24% |
| get_decorators | synthetic-large | 0.04 us | 0.01 us | 0.13 | 0.05 us | 1.13 | 0.0 | 0% | other 99.8%, gc 0.2%, views 0% | 0% / 0% / 0% (conformance) |
| dcs_validate | synthetic-large | 58.48 ms | 35.77 ms (rebuild 44.75 ms) | 0.61 (0.77) | 64.92 ms | 1.11 | 37.0 | 93% | core 81.9%, glue 6.5%, gc 5.7% | 50% / 14% / 27% |
| get_decorators | conformance | 0.04 us | 0.00 us | 0.10 | 0.05 us | 1.09 | 0.0 | 0% | other 99.8%, gc 0.2%, views 0% | 0% / 0% / 0% |
| get_decorators | concerto-core-test-data | 0.07 us | 0.01 us | 0.07 | 0.08 us | 1.04 | 0.0 | 0% | other 99.8%, gc 0.2%, views 0% | 0% / 0% / 0% (conformance) |
| is_assignable_to | synthetic-large | 1.18 us | 0.46 us | 0.39 | 1.14 us | 0.97 | 2.0 | 78% | core 67.2%, glue 23.5%, ts-core 4.8% | 18% / 0% / 0% (conformance) |
