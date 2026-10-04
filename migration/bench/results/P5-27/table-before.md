Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| extract_vocabularies | conformance | 2.49 ms | - | - | 20.59 ms | 8.26 | 190.0 | 84% | core 61.8%, glue 12.2%, gc 10.2% | - |
| extract_decorators | conformance | 2.42 ms | - | - | 18.24 ms | 7.55 | 190.0 | 77% | core 62.4%, glue 14.4%, gc 8.6% | - |
| extract_vocabularies | synthetic-large | 10.14 ms | - | - | 71.74 ms | 7.08 | 30.0 | 92% | core 76.9%, glue 7.9%, gc 6.8% | - |
| extract_decorators | synthetic-large | 10.53 ms | - | - | 64.61 ms | 6.14 | 30.0 | 91% | core 75.4%, glue 8.9%, other 7.2% | - |
| extract_vocabularies | concerto-core-test-data | 6.93 ms | - | - | 35.46 ms | 5.12 | 162.0 | 88% | core 69.6%, glue 9.7%, gc 8% | - |
| extract_decorators | concerto-core-test-data | 7.97 ms | - | - | 39.12 ms | 4.91 | 162.0 | 89% | core 67.6%, glue 11.3%, other 8.3% | - |
| dcs_validate | conformance | 14.84 ms | - | - | 24.15 ms | 1.63 | 191.0 | 84% | core 74.9%, gc 11.4%, cto-parser 4.2% | - |
| dcs_decorate | synthetic-large | 48.03 ms | - | - | 74.04 ms | 1.54 | 30.0 | 94% | core 82.6%, glue 7.2%, gc 4.5% | - |
| dcs_validate | concerto-core-test-data | 25.94 ms | - | - | 34.67 ms | 1.34 | 163.0 | 89% | core 79.9%, gc 7.9%, glue 4.2% | - |
| dcs_decorate | conformance | 16.91 ms | - | - | 20.44 ms | 1.21 | 190.0 | 87% | core 74.1%, glue 9.3%, gc 6.1% | - |
| dcs_validate | synthetic-large | 42.85 ms | - | - | 48.80 ms | 1.14 | 31.0 | 90% | core 79.3%, gc 10.3%, glue 5.5% | - |
| dcs_decorate | concerto-core-test-data | 43.47 ms | - | - | 39.14 ms | 0.90 | 162.0 | 91% | core 76.5%, glue 8.5%, gc 6.9% | - |
