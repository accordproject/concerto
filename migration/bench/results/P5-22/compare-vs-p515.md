Before: the P5-15 sweep (#309, developer laptop, before-p515.json), rounds 1, 2, 3. Now: rounds 1, 2, 3. x TS = Rust / TS 5.0.0 timed in the same sweep (> 1 = slower than TS). Ranked by x TS API now.

| op | set | family | TS 5.0.0 now | crate now | x TS crate before -> now | TS API now | x TS API before -> now | ratio change | crossings/item before -> now | TS-API stages now | crate alloc+free / clone / hash now |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| add_model_file | conformance | load | 19.5 us | 40.3 us | 10.54 -> 2.06 | 276.1 us | 13.64 -> 14.15 | +4% | 5.3 -> 5.3 | core 50.1%, gc 22.3%, glue 13.4% | - |
| get_namespaces | concerto-core-test-data | introspect | 0.67 us | 1.12 us | 5.29 -> 1.67 | 8.87 us | 15.92 -> 13.28 | -17% | 2.0 -> 2.0 | other 40.5%, glue 22.2%, ts-core 19.5% | - |
| get_namespaces | conformance | introspect | 0.78 us | 1.03 us | 5.56 -> 1.33 | 10.1 us | 14.90 -> 13.03 | -13% | 2.0 -> 2.0 | other 40.1%, glue 21.4%, ts-core 19.4% | - |
| resolve_type | concerto-core-test-data | introspect | 0.24 us | 0.05 us | 0.49 -> 0.22 | 2.76 us | 8.34 -> 11.70 | +40% | 2.0 -> 2.0 | ts-core 63.8%, core 13.1%, glue 11.2% | - |
| get_namespaces | synthetic-large | introspect | 0.12 us | 0.06 us | 2.69 -> 0.46 | 1.31 us | 9.67 -> 10.88 | +12% | 2.0 -> 2.0 | other 50.4%, glue 24%, core 16.2% | - |
| extract_vocabularies | conformance | decorator | 2.31 ms | 4.56 ms | 43.95 -> 1.98 | 22.89 ms | 22.61 -> 9.92 | -56% | 356.0 -> 190.0 | core 64.8%, glue 11.9%, gc 8.3% | - |
| get_type | concerto-core-test-data | introspect | 0.35 us | 0.07 us | 0.38 -> 0.20 | 3.26 us | 5.39 -> 9.42 | +75% | 3.0 -> 2.0 | ts-core 57.1%, views 11.4%, glue 10.2% | - |
| modelfile_new | conformance | load | 7.13 us | 11.5 us | 4.26 -> 1.61 | 65.0 us | 8.90 -> 9.11 | +2% | 3.0 -> 3.0 | core 39.9%, glue 29.5%, views 17% | - |
| modelfile_new | concerto-core-test-data | load | 25.0 us | 51.1 us | 2.54 -> 2.05 | 227.2 us | 3.94 -> 9.10 | +131% | 3.1 -> 3.0 | core 54.9%, glue 21.5%, views 15.5% | - |
| resolve_type | conformance | introspect | 0.29 us | 0.05 us | 0.39 -> 0.17 | 2.61 us | 7.74 -> 8.94 | +16% | 2.0 -> 2.0 | ts-core 64%, glue 12.5%, core 11.7% | - |
| extract_vocabularies | synthetic-large | decorator | 8.17 ms | 21.11 ms | 9.12 -> 2.58 | 70.64 ms | 10.98 -> 8.64 | -21% | 36.0 -> 30.0 | core 75.5%, glue 7.8%, gc 7.3% | - |
| extract_decorators | synthetic-large | decorator | 8.87 ms | 17.88 ms | 8.38 -> 2.02 | 70.48 ms | 8.20 -> 7.95 | -3% | 36.0 -> 30.0 | core 74.9%, glue 9.1%, other 7.3% | - |
| extract_decorators | conformance | decorator | 3.12 ms | 4.07 ms | 40.32 -> 1.31 | 21.31 ms | 19.96 -> 6.84 | -66% | 356.0 -> 190.0 | core 64.6%, glue 12.1%, gc 8.2% | - |
| modelfile_new | synthetic-large | load | 629.1 us | 1.72 ms | 4.28 -> 2.74 | 4.00 ms | 4.42 -> 6.36 | +44% | 3.0 -> 3.0 | core 66.6%, views 14%, glue 12.5% | - |
| extract_vocabularies | concerto-core-test-data | decorator | 7.60 ms | 11.74 ms | 38.59 -> 1.54 | 45.69 ms | 17.56 -> 6.01 | -66% | 302.0 -> 162.0 | core 71%, glue 9.8%, gc 7.5% | - |
| add_cto_model | conformance | load | 121.8 us | 40.3 us | 2.35 -> 0.33 | 710.6 us | 4.65 -> 5.84 | +26% | 5.3 -> 5.3 | cto-parser 37.9%, core 24.9%, gc 14.8% | - |
| extract_decorators | concerto-core-test-data | decorator | 6.88 ms | 11.13 ms | 36.81 -> 1.62 | 40.11 ms | 14.83 -> 5.83 | -61% | 302.0 -> 162.0 | core 69.5%, glue 11.1%, other 7.4% | - |
| add_model_file | synthetic-large | load | 1.87 ms | 3.56 ms | 3.28 -> 1.91 | 10.29 ms | 4.03 -> 5.52 | +37% | 19.0 -> 18.0 | core 67.8%, gc 15.9%, views 8.9% | - |
| add_model_file | concerto-core-test-data | load | 52.9 us | 94.2 us | 7.50 -> 1.78 | 279.5 us | 5.40 -> 5.28 | -2% | 5.5 -> 5.4 | core 51.7%, gc 21.8%, glue 12.8% | - |
| get_type | conformance | introspect | 0.41 us | 0.10 us | 0.31 -> 0.24 | 2.13 us | 4.59 -> 5.22 | +14% | 3.0 -> 2.0 | ts-core 57.2%, views 12.1%, glue 10.3% | - |
| set_property_value | conformance | instance | 0.50 us | 0.36 us | new: 0.73 | 2.48 us | new: 5.00 | - | 1.2 | ts-core 37.9%, core 23%, glue 9.6% | - |
| to_json | synthetic-large | serializer | 6.54 us | 10.3 us | 2.05 -> 1.57 | 29.2 us | 3.89 -> 4.46 | +15% | 1.0 -> 1.0 | core 69.2%, encode 17.9%, decode 5.8% | - |
| add_array_value | conformance | instance | 0.97 us | 0.84 us | new: 0.87 | 4.29 us | new: 4.42 | - | 1.0 | ts-core 41%, encode 20.8%, core 17.3% | - |
| derives_from | concerto-core-test-data | introspect | 0.57 us | 0.15 us | 0.63 -> 0.27 | 2.46 us | 4.60 -> 4.31 | -6% | 2.0 -> 2.0 | ts-core 56.2%, core 25.6%, glue 10.4% | - |
| add_array_value | synthetic-large | instance | 0.69 us | 1.02 us | new: 1.47 | 2.89 us | new: 4.18 | - | 1.0 | core 32.2%, glue 20.8%, ts-core 19.6% | - |
| new_resource | conformance | serializer | 3.40 us | 0.97 us | 0.77 -> 0.29 | 14.0 us | 12.72 -> 4.10 | -68% | 12.9 -> 7.5 | ts-core 43.6%, views 25.2%, glue 14.2% | - |
| add_array_value | concerto-core-test-data | instance | 14.2 us | 9.52 us | new: 0.67 | 52.7 us | new: 3.71 | - | 32.0 | ts-core 45.1%, views 14.6%, glue 12.3% | - |
| to_json | conformance | serializer | 6.04 us | 2.86 us | 1.21 -> 0.47 | 18.9 us | 3.70 -> 3.13 | -15% | 1.0 -> 1.0 | core 60%, encode 22.2%, ts-core 5.9% | - |
| get_type | synthetic-large | introspect | 0.39 us | 0.06 us | 0.26 -> 0.16 | 1.17 us | 1.74 -> 3.01 | +73% | 3.0 -> 2.0 | views 29.7%, glue 19.3%, core 17.2% | - |
| new_resource | concerto-core-test-data | serializer | 5.79 us | 1.29 us | 0.61 -> 0.22 | 17.2 us | 10.77 -> 2.97 | -72% | 17.6 -> 11.4 | ts-core 43%, views 25.4%, glue 13.2% | - |
| set_property_value | synthetic-large | instance | 0.57 us | 0.69 us | new: 1.22 | 1.65 us | new: 2.91 | - | 1.0 | ts-core 33.2%, core 31.9%, views 12.2% | - |
| derives_from | conformance | introspect | 0.61 us | 0.18 us | 0.47 -> 0.29 | 1.75 us | 4.46 -> 2.84 | -36% | 2.0 -> 2.0 | ts-core 59.5%, core 21.8%, glue 10.5% | - |
| add_cto_model | concerto-core-test-data | load | 487.3 us | 94.2 us | 1.24 -> 0.19 | 1.36 ms | 3.12 -> 2.79 | -10% | 5.5 -> 5.4 | cto-parser 40.4%, core 28.2%, gc 15.4% | - |
| new_resource | synthetic-large | serializer | 2.56 us | 1.29 us | 1.23 -> 0.50 | 6.40 us | 7.44 -> 2.50 | -66% | 13.0 -> 7.0 | views 33.2%, glue 22.5%, ts-core 22.3% | - |
| to_json | concerto-core-test-data | serializer | 31.4 us | 20.5 us | 1.14 -> 0.65 | 72.1 us | 2.16 -> 2.30 | +7% | 1.0 -> 1.0 | core 64.6%, encode 20.3%, decode 6% | - |
| resolve_type | synthetic-large | introspect | 0.27 us | 0.05 us | 0.32 -> 0.20 | 0.61 us | 2.47 -> 2.24 | -9% | 2.0 -> 2.0 | glue 35.1%, core 31.6%, other 22.6% | - |
| is_assignable_to | concerto-core-test-data | introspect | 0.94 us | 0.21 us | 0.53 -> 0.22 | 2.02 us | 2.89 -> 2.14 | -26% | 2.0 -> 2.0 | ts-core 53.9%, core 29.6%, other 9.8% | - |
| validate | conformance | instance | 2.90 us | 1.19 us | new: 0.41 | 6.16 us | new: 2.13 | - | 1.0 | ts-core 55.6%, core 36.8%, glue 4.7% | - |
| set_property_value | concerto-core-test-data | instance | 1.70 us | 1.14 us | new: 0.67 | 3.41 us | new: 2.01 | - | 1.2 | ts-core 35.1%, core 30.8%, views 13.1% | - |
| mm_new | conformance | load | 404.8 us | 9.63 us | 0.13 -> 0.02 | 797.7 us | 2.37 -> 1.97 | -17% | 14.0 -> 13.0 | views 29.6%, core 28.5%, gc 22.5% | - |
| validate | synthetic-large | instance | 4.15 us | 2.62 us | new: 0.63 | 7.94 us | new: 1.91 | - | 1.0 | core 60.1%, ts-core 30.7%, glue 5.2% | - |
| dcs_decorate | synthetic-large | decorator | 53.85 ms | 35.58 ms | 1.57 -> 0.66 | 98.06 ms | 1.40 -> 1.82 | +30% | 36.0 -> 30.0 | core 82.6%, glue 7%, gc 4.8% | - |
| is_assignable_to | conformance | introspect | 1.00 us | 0.21 us | 0.41 -> 0.21 | 1.80 us | 2.53 -> 1.80 | -29% | 2.0 -> 2.0 | ts-core 55.7%, core 28%, other 8.6% | - |
| dcs_decorate | concerto-core-test-data | decorator | 39.63 ms | 20.42 ms | 3.95 -> 0.52 | 64.04 ms | 2.18 -> 1.62 | -26% | 302.0 -> 162.0 | core 77.2%, glue 8.9%, gc 6.3% | - |
| derives_from | synthetic-large | introspect | 0.46 us | 0.16 us | 0.47 -> 0.35 | 0.69 us | 1.68 -> 1.51 | -11% | 2.0 -> 2.0 | core 55.3%, glue 20.7%, other 17.3% | - |
| add_cto_model | synthetic-large | load | 24.58 ms | 3.56 ms | 0.35 -> 0.14 | 36.87 ms | 1.71 -> 1.50 | -12% | 19.0 -> 18.0 | cto-parser 61.5%, core 21.4%, gc 8.3% | - |
| dcs_validate | conformance | decorator | 15.56 ms | 5.26 ms | 0.75 -> 0.34 | 21.64 ms | 1.69 -> 1.39 | -18% | 317.0 -> 191.0 | core 76.6%, gc 10.9%, glue 4% | - |
| dcs_decorate | conformance | decorator | 22.98 ms | 9.03 ms | 4.27 -> 0.39 | 30.43 ms | 2.33 -> 1.32 | -43% | 356.0 -> 190.0 | core 74.3%, glue 9.1%, gc 6.3% | - |
| validate | concerto-core-test-data | instance | 13.7 us | 6.13 us | new: 0.45 | 17.2 us | new: 1.26 | - | 1.0 | core 53.7%, ts-core 36.3%, other 4.4% | - |
| get_decorators | concerto-core-test-data | introspect | 0.13 us | 0.00 us | 0.07 -> 0.03 | 0.16 us | 1.04 -> 1.25 | +20% | 0.0 -> 0.0 | other 98.5%, gc 1.1%, views 0.5% | - |
| dcs_validate | concerto-core-test-data | decorator | 27.20 ms | 10.16 ms | 0.61 -> 0.37 | 33.05 ms | 1.25 -> 1.22 | -3% | 268.0 -> 163.0 | core 81.6%, gc 7.2%, glue 5.1% | - |
| get_decorators | synthetic-large | introspect | 0.02 us | 0.00 us | 0.13 -> 0.22 | 0.02 us | 1.13 -> 1.12 | -1% | 0.0 -> 0.0 | other 99%, gc 0.9%, views 0.1% | - |
| get_decorators | conformance | introspect | 0.07 us | 0.00 us | 0.10 -> 0.05 | 0.08 us | 1.09 -> 1.09 | +0% | 0.0 -> 0.0 | other 99.3%, gc 0.6%, views 0.1% | - |
| dcs_validate | synthetic-large | decorator | 44.58 ms | 18.26 ms | 0.61 -> 0.41 | 47.77 ms | 1.11 -> 1.07 | -3% | 37.0 -> 31.0 | core 81.4%, gc 7%, glue 6.6% | - |
| from_json | synthetic-large | serializer | 22.1 us | 7.14 us | 1.01 -> 0.32 | 20.5 us | 3.03 -> 0.93 | -69% | 15.0 -> 1.0 | core 63%, encode 26.3%, glue 4.8% | - |
| from_json | conformance | serializer | 19.1 us | 2.84 us | 0.63 -> 0.15 | 17.6 us | 3.44 -> 0.92 | -73% | 8.6 -> 1.0 | core 52.6%, encode 27.2%, ts-core 9.1% | - |
| from_json | concerto-core-test-data | serializer | 63.6 us | 22.3 us | 0.78 -> 0.35 | 56.8 us | 2.57 -> 0.89 | -65% | 16.7 -> 1.0 | core 62.3%, encode 24.9%, glue 4.3% | - |
| is_assignable_to | synthetic-large | introspect | 0.87 us | 0.22 us | 0.39 -> 0.25 | 0.75 us | 0.97 -> 0.87 | -10% | 2.0 -> 2.0 | core 65.2%, other 19.5%, glue 9.5% | - |
