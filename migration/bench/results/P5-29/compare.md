Before: P5-15 rounds 1, 2, 3. Now: rounds 1, 2, 3. x TS = Rust / TS 5.0.0 timed in the same sweep (> 1 = slower than TS). Ranked by x TS API now.

| op | set | family | TS 5.0.0 now | crate now | x TS crate before -> now | TS API now | x TS API before -> now | ratio change | crossings/item before -> now | TS-API stages now | crate alloc+free / clone / hash now |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| get_namespaces_first | concerto-core-test-data | introspect | 0.78 us | - | new: - | 13.9 us | 13.01 -> 17.94 | +38% | 2.0 -> 2.0 | other 37.5%, glue 23.8%, ts-core 20.4% | - |
| get_namespaces_first | conformance | introspect | 0.87 us | - | new: - | 15.4 us | 11.02 -> 17.66 | +60% | 2.0 -> 2.0 | other 37.1%, glue 24.7%, ts-core 19.8% | - |
| get_namespaces_first | synthetic-large | introspect | 0.16 us | - | new: - | 2.43 us | 6.62 -> 14.89 | +125% | 2.0 -> 2.0 | other 44.4%, glue 23%, core 15% | - |
| get_type_first | concerto-core-test-data | introspect | 0.38 us | - | new: - | 4.64 us | 5.87 -> 12.25 | +109% | 2.0 -> 2.0 | ts-core 53.8%, other 12.2%, views 11.8% | - |
| resolve_type_first | concerto-core-test-data | introspect | 0.24 us | - | new: - | 2.29 us | 7.01 -> 9.66 | +38% | 2.0 -> 2.0 | ts-core 60.6%, glue 13%, core 12.9% | - |
| resolve_type_first | conformance | introspect | 0.29 us | - | new: - | 2.49 us | 6.76 -> 8.63 | +28% | 2.0 -> 2.0 | ts-core 62.5%, glue 12.8%, core 11.6% | - |
| get_type_first | conformance | introspect | 0.45 us | - | new: - | 2.88 us | 5.31 -> 6.42 | +21% | 2.0 -> 2.0 | ts-core 58.5%, views 11.6%, other 9.7% | - |
| resolve_type_first | synthetic-large | introspect | 0.31 us | - | new: - | 1.02 us | 2.40 -> 3.25 | +35% | 2.0 -> 2.0 | glue 30.1%, ts-core 26.5%, core 26.3% | - |
| get_type_first | synthetic-large | introspect | 0.42 us | - | new: - | 1.09 us | 2.43 -> 2.63 | +8% | 2.0 -> 2.0 | views 27.8%, ts-core 20.2%, glue 19.1% | - |
| get_namespaces | synthetic-large | introspect | 0.13 us | - | new: - | 0.32 us | 10.86 -> 2.46 | -77% | 2.0 -> 0.0 | other 81.9%, ts-core 14.4%, gc 3.7% | - |
| get_type | conformance | introspect | 0.51 us | - | new: - | 0.62 us | 4.50 -> 1.21 | -73% | 2.0 -> 0.0 | views 50.8%, ts-core 42.1%, other 5.7% | - |
| get_type | synthetic-large | introspect | 0.45 us | - | new: - | 0.51 us | 2.59 -> 1.14 | -56% | 2.0 -> 0.0 | views 52.8%, ts-core 39.7%, other 5.7% | - |
| get_type | concerto-core-test-data | introspect | 0.68 us | - | new: - | 0.57 us | 8.47 -> 0.85 | -90% | 2.0 -> 0.0 | views 52.9%, ts-core 38.4%, other 7.1% | - |
| get_namespaces | concerto-core-test-data | introspect | 0.98 us | - | new: - | 0.49 us | 23.31 -> 0.50 | -98% | 2.0 -> 0.0 | other 66.6%, ts-core 23.9%, gc 9.5% | - |
| resolve_type | conformance | introspect | 0.30 us | - | new: - | 0.12 us | 6.02 -> 0.38 | -94% | 2.0 -> 0.0 | ts-core 57.5%, other 42.2%, gc 0.3% | - |
| resolve_type | concerto-core-test-data | introspect | 0.35 us | - | new: - | 0.11 us | 6.44 -> 0.32 | -95% | 2.0 -> 0.0 | ts-core 59.2%, other 40.5%, gc 0.2% | - |
| get_namespaces | conformance | introspect | 0.82 us | - | new: - | 0.24 us | 16.23 -> 0.30 | -98% | 2.0 -> 0.0 | other 64.7%, ts-core 24.1%, gc 11.3% | - |
| resolve_type | synthetic-large | introspect | 0.22 us | - | new: - | 0.03 us | 2.42 -> 0.11 | -95% | 2.0 -> 0.0 | ts-core 67.9%, other 31.7%, gc 0.4% | - |
