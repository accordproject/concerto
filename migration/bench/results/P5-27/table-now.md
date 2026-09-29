Rounds: 1, 2, 3. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).

| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| extract_vocabularies | conformance | 2.49 ms | - | - | 13.75 ms | 5.52 | 107.0 | 92% | core 60.9%, gc 21.7%, views 7.5% | - |
| extract_decorators | conformance | 2.42 ms | - | - | 13.04 ms | 5.39 | 107.0 | 91% | core 62.5%, gc 20.5%, views 7.1% | - |
| extract_vocabularies | concerto-core-test-data | 6.93 ms | - | - | 33.02 ms | 4.77 | 93.0 | 92% | core 67.5%, gc 22.3%, glue 4.6% | - |
| extract_vocabularies | synthetic-large | 10.14 ms | - | - | 46.38 ms | 4.57 | 27.0 | 98% | core 66.1%, gc 26.6%, glue 5% | - |
| extract_decorators | concerto-core-test-data | 7.97 ms | - | - | 26.55 ms | 3.33 | 93.0 | 94% | core 64.7%, gc 18.8%, glue 9.2% | - |
| extract_decorators | synthetic-large | 10.53 ms | - | - | 34.00 ms | 3.23 | 27.0 | 97% | core 76.6%, gc 12.8%, glue 5.9% | - |
| dcs_validate | conformance | 14.84 ms | - | - | 25.33 ms | 1.71 | 191.0 | 83% | core 76.6%, gc 10.7%, glue 3.7% | - |
| dcs_decorate | synthetic-large | 48.03 ms | - | - | 69.86 ms | 1.45 | 27.0 | 99% | core 81%, gc 11.3%, glue 5.4% | - |
| dcs_validate | concerto-core-test-data | 25.94 ms | - | - | 37.24 ms | 1.44 | 163.0 | 86% | core 80.2%, gc 7.1%, glue 5.3% | - |
| dcs_decorate | conformance | 16.91 ms | - | - | 20.91 ms | 1.24 | 107.0 | 93% | core 77.5%, gc 9.3%, views 5.5% | - |
| dcs_validate | synthetic-large | 42.85 ms | - | - | 49.74 ms | 1.16 | 31.0 | 90% | core 81.1%, glue 7.4%, gc 6.7% | - |
| dcs_decorate | concerto-core-test-data | 43.47 ms | - | - | 34.62 ms | 0.80 | 93.0 | 96% | core 78.3%, gc 10.5%, glue 7.3% | - |
