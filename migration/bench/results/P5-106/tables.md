Rounds: 1, 2, 3. x TS = TS-API / TS 5.0.0 in the same round (> 1 = slower than TS), median over rounds.

| op | set | TS 5.0.0 | x TS before | **x TS after** | before | after | crossings/item before | after |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| add_array_value | concerto-core-test-data | 18.73 us | 2.31 | **1.91** | 43.51 us | 35.77 us | 6.3 | 6.4 |
| add_array_value | conformance | 1.51 us | 2.57 | **3.03** | 3.87 us | 4.57 us | 1.0 | 1.0 |
| add_array_value | synthetic-large | 0.83 us | 3.03 | **2.92** | 2.52 us | 2.49 us | 1.0 | 1.0 |
| set_property_value | concerto-core-test-data | 2.27 us | 1.13 | **1.09** | 2.56 us | 2.45 us | 0.2 | 0.2 |
| set_property_value | conformance | 0.81 us | 2.26 | **2.21** | 1.83 us | 1.79 us | 0.3 | 0.3 |
| set_property_value | synthetic-large | 0.77 us | 1.55 | **1.63** | 1.19 us | 1.25 us | 0.2 | 0.2 |
| new_resource | concerto-core-test-data | 8.35 us | 1.19 | **1.15** | 9.94 us | 9.86 us | 2.5 | 2.5 |
| new_resource | conformance | 4.89 us | 1.04 | **1.07** | 5.07 us | 5.09 us | 1.2 | 1.2 |
| new_resource | synthetic-large | 3.44 us | 1.18 | **1.22** | 4.41 us | 4.23 us | 1.0 | 1.0 |
| get_assignable_class_declarations | concerto-core-test-data | 34.25 us | 30.31 | **0.09** | 1.04 ms | 3.10 us | 1.0 | 1.0 |
| get_assignable_class_declarations | conformance | 17.62 us | 21.61 | **0.12** | 380.78 us | 2.11 us | 1.0 | 1.0 |
| get_assignable_class_declarations | synthetic-large | 44.20 us | 42.73 | **0.04** | 1.88 ms | 1.73 us | 1.0 | 1.0 |
| get_direct_subclasses | concerto-core-test-data | 33.20 us | 31.40 | **0.04** | 1.04 ms | 1.39 us | 1.0 | 1.0 |
| get_direct_subclasses | conformance | 16.68 us | 22.52 | **0.06** | 375.80 us | 1.09 us | 1.0 | 1.0 |
| get_direct_subclasses | synthetic-large | 43.10 us | 46.43 | **0.02** | 2.00 ms | 1.01 us | 1.0 | 1.0 |
