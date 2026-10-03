# P5-100 benchmark: TS-API x TS 5.0.0, before and after

accordproject/concerto-rust#454 (per-manager EngineState and the boundary placement rule).
Driver: the P5-96 sweep (`migration/bench/p515-sweep.mjs`), run by `migration/bench/p5100-run.sh`;
tables by `migration/bench/p5100-table.mjs`. One machine, one run: TS 5.0.0 (the oracle
reference), **before** (the integration heads, concerto c95928f68 dist with concerto-rust
7c196a0's engine) and **after** (this branch), 30 samples per row, 3 rounds with the order
reversed every other round. Crossings per item from the count mode (10 samples).

The `*_first` rows move the manager's model version before each pass (`mm._engine.version`
after P5-100, `invalidatePropertyLookups(mm)` before; the driver used to call it without a
manager, which P5-97's per-manager epoch no longer accepts).

## The P5-96 gap rows

| op | set | x TS before | **x TS after** | crossings/item before | after |
|---|---|---:|---:|---:|---:|
| new_resource | concerto-core-test-data | 1.60 | **1.49** | 4.6 | 2.5 |
| new_resource | conformance | 1.44 | **1.09** | 3.2 | 1.2 |
| new_resource | synthetic-large | 1.72 | **1.29** | 3.0 | 1.0 |
| set_property_value | concerto-core-test-data | 1.61 | **1.15** | 1.1 | 0.2 |
| set_property_value | conformance | 4.93 | **2.91** | 1.1 | 0.3 |
| set_property_value | synthetic-large | 2.40 | **1.53** | 1.0 | 0.2 |
| add_array_value | concerto-core-test-data | 2.69 | **1.95** | 15.7 | 6.3 |
| add_array_value | conformance | 4.58 | **2.27** | 1.0 | 1.0 |
| add_array_value | synthetic-large | 3.04 | **2.65** | 1.0 | 1.0 |
| get_type_first | concerto-core-test-data | 3.00 | **3.11** | 1.0 | 1.0 |
| get_type_first | conformance | 2.32 | **2.17** | 1.0 | 1.0 |
| get_type_first | synthetic-large | 2.47 | **2.23** | 1.0 | 1.0 |
| resolve_type_first | concerto-core-test-data | 3.39 | **3.07** | 1.0 | 1.0 |
| resolve_type_first | conformance | 2.50 | **2.36** | 1.0 | 1.0 |
| resolve_type_first | synthetic-large | 2.24 | **1.99** | 1.0 | 1.0 |

The introspection rows (getType, resolveType, getNamespaces, getDecorators, derivesFrom,
isAssignableTo, DCS and the extract ops) are in the full table below. `resolve_type`
on synthetic-large reads 0.13 before and 0.29 after: 0.04 us against 0.09 us per item, with
the before side bimodal across rounds (0.037, 0.092, 0.029 us; CV 0.8-1.0) and the after side
steady (0.086-0.093 us); both stay well under TS 5.0.0.

## Every row

Rounds: 1, 2, 3. x TS = TS-API / TS 5.0.0 in the same round (> 1 = slower than TS), median over rounds.

| op | set | TS 5.0.0 | x TS before | **x TS after** | before | after | crossings/item before | after |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| mm_new | conformance | 369.74 us | 0.94 | **0.87** | 339.84 us | 339.11 us | 3.0 | 3.0 |
| modelfile_new | concerto-core-test-data | 25.36 us | 3.73 | **3.79** | 94.68 us | 96.12 us | 1.1 | 1.1 |
| modelfile_new | conformance | 8.61 us | 3.79 | **3.28** | 32.63 us | 29.70 us | 1.0 | 1.0 |
| modelfile_new | synthetic-large | 638.91 us | 3.63 | **3.57** | 2.30 ms | 2.36 ms | 1.0 | 1.0 |
| add_model_file | concerto-core-test-data | 66.07 us | 1.68 | **1.47** | 101.68 us | 97.70 us | 2.1 | 2.1 |
| add_model_file | conformance | 22.40 us | 2.02 | **1.95** | 42.72 us | 41.92 us | 2.1 | 2.1 |
| add_model_file | synthetic-large | 2.10 ms | 3.08 | **2.92** | 6.47 ms | 6.15 ms | 5.0 | 5.0 |
| add_cto_model | concerto-core-test-data | 428.11 us | 2.38 | **2.27** | 986.18 us | 914.90 us | 2.1 | 2.1 |
| add_cto_model | conformance | 135.29 us | 2.75 | **2.62** | 372.23 us | 354.80 us | 2.1 | 2.1 |
| add_cto_model | synthetic-large | 20.01 ms | 1.24 | **1.26** | 25.08 ms | 25.42 ms | 5.0 | 5.0 |
| from_json | concerto-core-test-data | 51.50 us | 0.99 | **0.95** | 50.46 us | 48.85 us | 1.0 | 1.0 |
| from_json | conformance | 13.38 us | 1.13 | **0.90** | 14.45 us | 12.07 us | 1.0 | 1.0 |
| from_json | synthetic-large | 16.70 us | 1.26 | **1.25** | 20.97 us | 21.11 us | 1.0 | 1.0 |
| to_json | concerto-core-test-data | 29.96 us | 2.31 | **2.30** | 69.68 us | 69.13 us | 1.0 | 1.0 |
| to_json | conformance | 7.22 us | 2.74 | **2.61** | 19.58 us | 18.32 us | 1.0 | 1.0 |
| to_json | synthetic-large | 8.26 us | 4.01 | **4.04** | 33.15 us | 34.59 us | 1.0 | 1.0 |
| new_resource | concerto-core-test-data | 6.42 us | 1.60 | **1.49** | 10.33 us | 9.06 us | 4.6 | 2.5 |
| new_resource | conformance | 4.26 us | 1.44 | **1.09** | 5.86 us | 4.66 us | 3.2 | 1.2 |
| new_resource | synthetic-large | 3.10 us | 1.72 | **1.29** | 5.31 us | 3.82 us | 3.0 | 1.0 |
| validate | concerto-core-test-data | 15.81 us | 1.16 | **1.05** | 18.35 us | 16.59 us | 1.0 | 1.0 |
| validate | conformance | 3.73 us | 1.62 | **0.92** | 6.04 us | 3.45 us | 1.0 | 1.0 |
| validate | synthetic-large | 5.27 us | 1.27 | **1.17** | 6.64 us | 6.31 us | 1.0 | 1.0 |
| set_property_value | concerto-core-test-data | 1.93 us | 1.61 | **1.15** | 3.16 us | 2.22 us | 1.1 | 0.2 |
| set_property_value | conformance | 0.65 us | 4.93 | **2.91** | 2.94 us | 1.74 us | 1.1 | 0.3 |
| set_property_value | synthetic-large | 0.72 us | 2.40 | **1.53** | 1.74 us | 1.10 us | 1.0 | 0.2 |
| add_array_value | concerto-core-test-data | 14.60 us | 2.69 | **1.95** | 39.92 us | 28.48 us | 15.7 | 6.3 |
| add_array_value | conformance | 1.12 us | 4.58 | **2.27** | 5.17 us | 2.43 us | 1.0 | 1.0 |
| add_array_value | synthetic-large | 0.89 us | 3.04 | **2.65** | 2.60 us | 2.35 us | 1.0 | 1.0 |
| validate_instance | concerto-core-test-data | 61.30 us | 0.62 | **0.55** | 37.40 us | 32.82 us | 1.0 | 1.0 |
| validate_instance | conformance | 16.53 us | 0.76 | **0.57** | 12.61 us | 9.33 us | 1.0 | 1.0 |
| validate_instance | synthetic-large | 22.12 us | 0.78 | **0.75** | 17.28 us | 16.70 us | 1.0 | 1.0 |
| validate_instance_or_throw | concerto-core-test-data | 59.38 us | 0.91 | **0.86** | 53.10 us | 50.23 us | 1.0 | 1.0 |
| validate_instance_or_throw | conformance | 16.33 us | 1.04 | **0.90** | 15.77 us | 13.26 us | 1.0 | 1.0 |
| validate_instance_or_throw | synthetic-large | 21.69 us | 1.19 | **1.17** | 26.04 us | 25.20 us | 1.0 | 1.0 |
| dcs_decorate | concerto-core-test-data | 38.27 ms | 0.96 | **0.96** | 36.68 ms | 36.68 ms | 44.0 | 44.0 |
| dcs_decorate | conformance | 20.49 ms | 0.86 | **0.86** | 17.52 ms | 16.83 ms | 49.0 | 49.0 |
| dcs_decorate | synthetic-large | 58.52 ms | 0.94 | **0.92** | 54.95 ms | 53.75 ms | 9.0 | 9.0 |
| dcs_validate | concerto-core-test-data | 32.25 ms | 0.54 | **0.53** | 17.02 ms | 17.07 ms | 46.0 | 46.0 |
| dcs_validate | conformance | 17.11 ms | 0.68 | **0.68** | 11.37 ms | 11.36 ms | 53.0 | 53.0 |
| dcs_validate | synthetic-large | 52.08 ms | 0.49 | **0.49** | 25.77 ms | 25.46 ms | 13.0 | 13.0 |
| extract_decorators | concerto-core-test-data | 6.87 ms | 0.54 | **0.54** | 3.71 ms | 3.71 ms | 43.0 | 43.0 |
| extract_decorators | conformance | 2.40 ms | 0.74 | **0.70** | 1.77 ms | 1.76 ms | 48.0 | 48.0 |
| extract_decorators | synthetic-large | 8.52 ms | 0.54 | **0.55** | 4.64 ms | 4.65 ms | 8.0 | 8.0 |
| extract_vocabularies | concerto-core-test-data | 6.36 ms | 0.43 | **0.42** | 2.72 ms | 2.67 ms | 43.0 | 43.0 |
| extract_vocabularies | conformance | 2.29 ms | 0.62 | **0.57** | 1.43 ms | 1.31 ms | 48.0 | 48.0 |
| extract_vocabularies | synthetic-large | 8.53 ms | 0.41 | **0.42** | 3.52 ms | 3.53 ms | 8.0 | 8.0 |
| extract_cold | concerto-core-test-data | 6.49 ms | 1.95 | **1.70** | 12.64 ms | 10.45 ms | 43.0 | 43.0 |
| extract_cold | conformance | 2.51 ms | 2.05 | **2.11** | 5.16 ms | 5.25 ms | 48.0 | 48.0 |
| extract_cold | synthetic-large | 9.24 ms | 1.85 | **1.65** | 15.55 ms | 15.19 ms | 8.0 | 8.0 |
| extract_keep | concerto-core-test-data | 6.88 ms | 0.64 | **0.63** | 4.28 ms | 4.33 ms | 43.0 | 43.0 |
| extract_keep | conformance | 2.49 ms | 0.71 | **0.70** | 1.77 ms | 1.71 ms | 48.0 | 48.0 |
| extract_keep | synthetic-large | 8.79 ms | 0.61 | **0.60** | 5.43 ms | 5.24 ms | 8.0 | 8.0 |
| get_type | concerto-core-test-data | 0.40 us | 1.43 | **1.18** | 0.55 us | 0.46 us | 0.0 | 0.0 |
| get_type | conformance | 0.54 us | 0.84 | **0.70** | 0.46 us | 0.40 us | 0.0 | 0.0 |
| get_type | synthetic-large | 0.52 us | 0.77 | **0.75** | 0.40 us | 0.40 us | 0.0 | 0.0 |
| resolve_type | concerto-core-test-data | 0.30 us | 0.34 | **0.32** | 0.10 us | 0.09 us | 0.0 | 0.0 |
| resolve_type | conformance | 0.41 us | 0.25 | **0.24** | 0.10 us | 0.10 us | 0.0 | 0.0 |
| resolve_type | synthetic-large | 0.31 us | 0.13 | **0.29** | 0.04 us | 0.09 us | 0.0 | 0.0 |
| get_decorators | concerto-core-test-data | 0.15 us | 1.06 | **1.06** | 0.16 us | 0.15 us | 0.0 | 0.0 |
| get_decorators | conformance | 0.08 us | 0.96 | **0.99** | 0.08 us | 0.08 us | 0.0 | 0.0 |
| get_decorators | synthetic-large | 0.03 us | 0.94 | **0.93** | 0.03 us | 0.03 us | 0.0 | 0.0 |
| get_namespaces | concerto-core-test-data | 0.80 us | 0.27 | **0.23** | 0.22 us | 0.18 us | 0.0 | 0.0 |
| get_namespaces | conformance | 0.86 us | 0.22 | **0.19** | 0.18 us | 0.16 us | 0.0 | 0.0 |
| get_namespaces | synthetic-large | 0.15 us | 1.21 | **1.07** | 0.18 us | 0.16 us | 0.0 | 0.0 |
| get_type_first | concerto-core-test-data | 0.41 us | 3.00 | **3.11** | 1.32 us | 1.28 us | 1.0 | 1.0 |
| get_type_first | conformance | 0.53 us | 2.32 | **2.17** | 1.27 us | 1.18 us | 1.0 | 1.0 |
| get_type_first | synthetic-large | 0.56 us | 2.47 | **2.23** | 1.45 us | 1.24 us | 1.0 | 1.0 |
| resolve_type_first | concerto-core-test-data | 0.30 us | 3.39 | **3.07** | 1.03 us | 0.93 us | 1.0 | 1.0 |
| resolve_type_first | conformance | 0.39 us | 2.50 | **2.36** | 0.97 us | 0.92 us | 1.0 | 1.0 |
| resolve_type_first | synthetic-large | 0.39 us | 2.24 | **1.99** | 0.87 us | 0.77 us | 1.0 | 1.0 |
| get_namespaces_first | concerto-core-test-data | 0.88 us | 0.27 | **0.27** | 0.23 us | 0.22 us | 0.0 | 0.0 |
| get_namespaces_first | conformance | 0.91 us | 0.24 | **0.23** | 0.22 us | 0.21 us | 0.0 | 0.0 |
| get_namespaces_first | synthetic-large | 0.16 us | 1.42 | **1.29** | 0.23 us | 0.21 us | 0.0 | 0.0 |
| derives_from | concerto-core-test-data | 0.71 us | 1.65 | **1.48** | 1.17 us | 1.11 us | 1.0 | 1.0 |
| derives_from | conformance | 0.83 us | 1.04 | **1.08** | 0.86 us | 0.89 us | 1.0 | 1.0 |
| derives_from | synthetic-large | 0.66 us | 1.08 | **1.04** | 0.73 us | 0.74 us | 1.0 | 1.0 |
| is_assignable_to | concerto-core-test-data | 1.14 us | 0.96 | **0.92** | 1.10 us | 1.09 us | 1.0 | 1.0 |
| is_assignable_to | conformance | 1.37 us | 0.68 | **0.65** | 0.90 us | 0.89 us | 1.0 | 1.0 |
| is_assignable_to | synthetic-large | 1.24 us | 0.63 | **0.63** | 0.78 us | 0.77 us | 1.0 | 1.0 |
