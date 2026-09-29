Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| get_namespaces_first | concerto-core-test-data | 0.78 us | - | - | 13.9 us | 17.94 | 2.0 | 73% | other 37.5%, glue 23.8%, ts-core 20.4% | - |
| get_namespaces_first | conformance | 0.87 us | - | - | 15.4 us | 17.66 | 2.0 | 72% | other 37.1%, glue 24.7%, ts-core 19.8% | - |
| get_namespaces_first | synthetic-large | 0.16 us | - | - | 2.43 us | 14.89 | 2.0 | 53% | other 44.4%, glue 23%, core 15% | - |
| get_type_first | concerto-core-test-data | 0.38 us | - | - | 4.64 us | 12.25 | 2.0 | 30% | ts-core 53.8%, other 12.2%, views 11.8% | - |
| resolve_type_first | concerto-core-test-data | 0.24 us | - | - | 2.29 us | 9.66 | 2.0 | 44% | ts-core 60.6%, glue 13%, core 12.9% | - |
| resolve_type_first | conformance | 0.29 us | - | - | 2.49 us | 8.63 | 2.0 | 43% | ts-core 62.5%, glue 12.8%, core 11.6% | - |
| get_type_first | conformance | 0.45 us | - | - | 2.88 us | 6.42 | 2.0 | 28% | ts-core 58.5%, views 11.6%, other 9.7% | - |
| resolve_type_first | synthetic-large | 0.31 us | - | - | 1.02 us | 3.25 | 2.0 | 61% | glue 30.1%, ts-core 26.5%, core 26.3% | - |
| get_type_first | synthetic-large | 0.42 us | - | - | 1.09 us | 2.63 | 2.0 | 59% | views 27.8%, ts-core 20.2%, glue 19.1% | - |
| get_namespaces | synthetic-large | 0.13 us | - | - | 0.32 us | 2.46 | 0.0 | 0% | other 81.9%, ts-core 14.4%, gc 3.7% | - |
| get_type | conformance | 0.51 us | - | - | 0.62 us | 1.21 | 0.0 | 0% | views 50.8%, ts-core 42.1%, other 5.7% | - |
| get_type | synthetic-large | 0.45 us | - | - | 0.51 us | 1.14 | 0.0 | 0% | views 52.8%, ts-core 39.7%, other 5.7% | - |
| get_type | concerto-core-test-data | 0.68 us | - | - | 0.57 us | 0.85 | 0.0 | 0% | views 52.9%, ts-core 38.4%, other 7.1% | - |
| get_namespaces | concerto-core-test-data | 0.98 us | - | - | 0.49 us | 0.50 | 0.0 | 0% | other 66.6%, ts-core 23.9%, gc 9.5% | - |
| resolve_type | conformance | 0.30 us | - | - | 0.12 us | 0.38 | 0.0 | 0% | ts-core 57.5%, other 42.2%, gc 0.3% | - |
| resolve_type | concerto-core-test-data | 0.35 us | - | - | 0.11 us | 0.32 | 0.0 | 0% | ts-core 59.2%, other 40.5%, gc 0.2% | - |
| get_namespaces | conformance | 0.82 us | - | - | 0.24 us | 0.30 | 0.0 | 0% | other 64.7%, ts-core 24.1%, gc 11.3% | - |
| resolve_type | synthetic-large | 0.22 us | - | - | 0.03 us | 0.11 | 0.0 | 0% | ts-core 67.9%, other 31.7%, gc 0.4% | - |
