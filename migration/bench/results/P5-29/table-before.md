Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| get_namespaces | concerto-core-test-data | 0.98 us | - | - | 22.8 us | 23.31 | 2.0 | 83% | other 60.1%, glue 22.4%, core 15% | - |
| get_namespaces | conformance | 0.82 us | - | - | 13.4 us | 16.23 | 2.0 | 79% | other 58.9%, glue 22.6%, core 16% | - |
| get_namespaces_first | concerto-core-test-data | 0.78 us | - | - | 10.1 us | 13.01 | 2.0 | 74% | other 59.3%, glue 22.2%, core 16.2% | - |
| get_namespaces_first | conformance | 0.87 us | - | - | 9.61 us | 11.02 | 2.0 | 78% | other 59%, glue 22.9%, core 15.9% | - |
| get_namespaces | synthetic-large | 0.13 us | - | - | 1.41 us | 10.86 | 2.0 | 63% | other 56.3%, glue 24.1%, core 16% | - |
| get_type | concerto-core-test-data | 0.68 us | - | - | 5.73 us | 8.47 | 2.0 | 29% | other 79.4%, core 10.2%, glue 8.8% | - |
| resolve_type_first | concerto-core-test-data | 0.24 us | - | - | 1.66 us | 7.01 | 2.0 | 35% | other 72.4%, glue 13.5%, core 12.4% | - |
| resolve_type_first | conformance | 0.29 us | - | - | 1.95 us | 6.76 | 2.0 | 10% | other 73.2%, glue 13.3%, core 11.8% | - |
| get_namespaces_first | synthetic-large | 0.16 us | - | - | 1.08 us | 6.62 | 2.0 | 76% | other 55.5%, glue 24.8%, core 16.1% | - |
| resolve_type | concerto-core-test-data | 0.35 us | - | - | 2.28 us | 6.44 | 2.0 | 45% | other 70.8%, glue 14.3%, core 13.2% | - |
| resolve_type | conformance | 0.30 us | - | - | 1.82 us | 6.02 | 2.0 | 36% | other 72.1%, glue 13.7%, core 12.4% | - |
| get_type_first | concerto-core-test-data | 0.38 us | - | - | 2.23 us | 5.87 | 2.0 | 30% | other 78.5%, core 10%, glue 9.9% | - |
| get_type_first | conformance | 0.45 us | - | - | 2.39 us | 5.31 | 2.0 | 26% | other 80.4%, core 9.3%, glue 8.9% | - |
| get_type | conformance | 0.51 us | - | - | 2.29 us | 4.50 | 2.0 | 28% | other 79.4%, glue 10.2%, core 8.8% | - |
| get_type | synthetic-large | 0.45 us | - | - | 1.16 us | 2.59 | 2.0 | 48% | other 58.9%, glue 22.5%, core 16.7% | - |
| get_type_first | synthetic-large | 0.42 us | - | - | 1.01 us | 2.43 | 2.0 | 45% | other 57.3%, glue 22.8%, core 17.9% | - |
| resolve_type | synthetic-large | 0.22 us | - | - | 0.54 us | 2.42 | 2.0 | 68% | other 47%, core 30.4%, glue 20.5% | - |
| resolve_type_first | synthetic-large | 0.31 us | - | - | 0.75 us | 2.40 | 2.0 | 89% | glue 33.9%, other 32.7%, core 31.4% | - |
