Rounds: now 1, 2, 3, P5-72 1, 2, 3, pre-F1 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).

## Rows at or below TS 5.0.0

| level | pre-F1 | P5-72 | **now** |
|---|---:|---:|---:|
| TS API (of the 73 P5-72 rows) | 2 | 13 | **24** |
| crate (of 57) | 39 | 49 | **52** |
| TS API, validateInstance rows (of 6) | - | - | **4** |
| crate, validateInstance rows (of 6) | - | - | **6** |

## Geometric mean of x TS by category

| category | rows | TS API: pre-F1 | P5-72 | **now** | crate: pre-F1 | P5-72 | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 4.62 | 3.53 | **2.16** | 0.88 | 0.30 | **0.18** |
| Introspection (including decorators/DCS) | 45 | 4.75 | 1.71 | **0.89** | 0.60 | 0.34 | **0.33** |
| Serialisation | 6 | 3.00 | 1.87 | **1.84** | 0.52 | 0.45 | **0.42** |
| Instance creation | 3 | 7.27 | 1.62 | **1.59** | 0.35 | 0.33 | **0.29** |
| Validation | 9 | 2.38 | 2.18 | **2.11** | 0.63 | 0.57 | **0.51** |
| Validation (validateInstance, P5-89) | 6 | - | - | **0.94** | - | - | **0.20** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 393.0 us | 0.03 | 0.00 | **0.00** | 1.66 | 1.09 | **1.13** | 443.7 us | 3.0 | 10% | 7% |
| modelfile_new | core-test-data | 29.0 us | 1.64 | 1.11 | **0.53** | 7.02 | 5.09 | **3.65** | 105.8 us | 1.1 | 53% | 4% |
| modelfile_new | conformance | 10.3 us | 1.55 | 1.66 | **0.60** | 8.66 | 7.77 | **3.43** | 35.3 us | 1.0 | 47% | 7% |
| modelfile_new | synthetic-large | 750.6 us | 2.79 | 1.92 | **0.97** | 6.42 | 5.41 | **3.58** | 2.69 ms | 1.0 | 36% | 6% |
| add_model_file | core-test-data | 97.7 us | 2.76 | 0.56 | **0.37** | 4.44 | 3.35 | **1.25** | 122.6 us | 2.1 | 63% | 24% |
| add_model_file | conformance | 26.6 us | 5.01 | 0.81 | **0.39** | 15.68 | 8.14 | **1.99** | 52.9 us | 2.1 | 52% | 21% |
| add_model_file | synthetic-large | 2.62 ms | 1.56 | 0.90 | **0.64** | 4.89 | 4.12 | **3.05** | 8.01 ms | 5.0 | 67% | 17% |
| add_cto_model | core-test-data | 489.5 us | 0.55 | 0.11 | **0.07** | 2.93 | 2.56 | **2.23** | 1.09 ms | 2.1 | 17% | 16% |
| add_cto_model | conformance | 185.9 us | 0.72 | 0.12 | **0.06** | 3.58 | 2.79 | **2.05** | 380.3 us | 2.1 | 18% | 9% |
| add_cto_model | synthetic-large | 23.33 ms | 0.18 | 0.10 | **0.07** | 1.91 | 1.59 | **1.26** | 29.29 ms | 5.0 | 12% | 9% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.42 us | 0.20 | 0.21 | **0.24** | 6.72 | 2.52 | **1.37** | 0.58 us | 0.0 | 0% | 1% |
| get_type | conformance | 0.56 us | 0.17 | 0.17 | **0.18** | 5.21 | 0.83 | **0.75** | 0.42 us | 0.0 | 0% | 1% |
| get_type | synthetic-large | 0.57 us | 0.15 | 0.15 | **0.16** | 2.65 | 0.79 | **0.76** | 0.44 us | 0.0 | 0% | 2% |
| get_type_first | core-test-data | 0.42 us | - | - | - | 6.31 | 3.36 | **3.11** | 1.30 us | 1.0 | 51% | 2% |
| get_type_first | conformance | 0.53 us | - | - | - | 5.60 | 2.72 | **2.57** | 1.37 us | 1.0 | 48% | 1% |
| get_type_first | synthetic-large | 0.58 us | - | - | - | 2.51 | 2.56 | **2.43** | 1.40 us | 1.0 | 49% | 2% |
| resolve_type | core-test-data | 0.31 us | 0.23 | 0.22 | **0.24** | 8.49 | 0.43 | **0.32** | 0.10 us | 0.0 | 0% | 0% |
| resolve_type | conformance | 0.38 us | 0.17 | 0.18 | **0.16** | 6.54 | 0.35 | **0.25** | 0.10 us | 0.0 | 0% | 0% |
| resolve_type | synthetic-large | 0.38 us | 0.19 | 0.18 | **0.20** | 1.99 | 0.05 | **0.10** | 0.04 us | 0.0 | 0% | 0% |
| resolve_type_first | core-test-data | 0.31 us | - | - | - | 7.02 | 3.73 | **4.18** | 1.29 us | 1.0 | 69% | 2% |
| resolve_type_first | conformance | 0.39 us | - | - | - | 6.24 | 2.41 | **2.61** | 1.01 us | 1.0 | 68% | 2% |
| resolve_type_first | synthetic-large | 0.39 us | - | - | - | 2.29 | 2.45 | **2.25** | 0.87 us | 1.0 | 72% | 2% |
| get_namespaces | core-test-data | 0.85 us | 1.40 | 1.41 | **1.39** | 12.63 | 0.37 | **0.34** | 0.29 us | 0.0 | 0% | 7% |
| get_namespaces | conformance | 0.97 us | 1.22 | 1.19 | **1.20** | 12.52 | 0.30 | **0.26** | 0.25 us | 0.0 | 0% | 8% |
| get_namespaces | synthetic-large | 0.14 us | 0.40 | 0.43 | **0.43** | 9.17 | 2.01 | **1.60** | 0.23 us | 0.0 | 0% | 4% |
| get_namespaces_first | core-test-data | 0.89 us | - | - | - | 11.74 | 11.82 | **0.33** | 0.29 us | 0.0 | 0% | 8% |
| get_namespaces_first | conformance | 0.93 us | - | - | - | 12.57 | 12.97 | **0.27** | 0.25 us | 0.0 | 0% | 8% |
| get_namespaces_first | synthetic-large | 0.15 us | - | - | - | 9.02 | 15.85 | **2.66** | 0.39 us | 0.0 | 0% | 4% |
| derives_from | core-test-data | 0.74 us | 0.27 | 0.28 | **0.29** | 3.63 | 1.56 | **1.53** | 1.13 us | 1.0 | 80% | 0% |
| derives_from | conformance | 0.77 us | 0.25 | 0.26 | **0.25** | 3.09 | 1.20 | **1.19** | 0.92 us | 1.0 | 79% | 0% |
| derives_from | synthetic-large | 0.59 us | 0.34 | 0.35 | **0.40** | 1.62 | 1.38 | **1.40** | 0.83 us | 1.0 | 50% | 0% |
| is_assignable_to | core-test-data | 1.13 us | 0.24 | 0.23 | **0.26** | 2.20 | 1.00 | **1.14** | 1.29 us | 1.0 | 79% | 0% |
| is_assignable_to | conformance | 1.29 us | 0.21 | 0.23 | **0.22** | 1.83 | 0.64 | **0.63** | 0.81 us | 1.0 | 78% | 0% |
| is_assignable_to | synthetic-large | 1.21 us | 0.24 | 0.25 | **0.28** | 0.83 | 0.72 | **0.75** | 0.91 us | 1.0 | 81% | 0% |
| get_decorators | core-test-data | 0.15 us | 0.03 | 0.03 | **0.04** | 1.06 | 1.04 | **1.06** | 0.16 us | 0.0 | 0% | 1% |
| get_decorators | conformance | 0.09 us | 0.05 | 0.05 | **0.06** | 1.03 | 0.98 | **0.93** | 0.08 us | 0.0 | 0% | 1% |
| get_decorators | synthetic-large | 0.02 us | 0.20 | 0.21 | **0.24** | 0.98 | 1.04 | **1.03** | 0.03 us | 0.0 | 0% | 1% |
| dcs_decorate | core-test-data | 41.17 ms | 1.90 (rebuild 2.03) | 0.50 (rebuild 0.68) | **0.44** (rebuild 0.55) | 2.29 | 1.17 | **1.12** | 46.11 ms | 44.0 | 94% | 14% |
| dcs_decorate | conformance | 21.66 ms | 2.05 (rebuild 2.09) | 0.40 (rebuild 0.48) | **0.32** (rebuild 0.41) | 2.38 | 1.13 | **1.00** | 21.68 ms | 49.0 | 92% | 14% |
| dcs_decorate | synthetic-large | 65.55 ms | 0.76 (rebuild 0.92) | 0.55 (rebuild 0.78) | **0.49** (rebuild 0.67) | 1.52 | 1.17 | **1.08** | 70.92 ms | 9.0 | 98% | 11% |
| dcs_validate | core-test-data | 36.34 ms | 0.31 (rebuild 0.41) | 0.26 (rebuild 0.31) | **0.21** (rebuild 0.26) | 1.21 | 0.68 | **0.56** | 20.36 ms | 46.0 | 83% | 11% |
| dcs_validate | conformance | 19.56 ms | 0.34 (rebuild 0.39) | 0.22 (rebuild 0.26) | **0.17** (rebuild 0.21) | 1.53 | 0.78 | **0.75** | 14.74 ms | 53.0 | 74% | 13% |
| dcs_validate | synthetic-large | 57.07 ms | 0.34 (rebuild 0.41) | 0.27 (rebuild 0.34) | **0.24** (rebuild 0.28) | 1.08 | 0.69 | **0.57** | 32.56 ms | 13.0 | 85% | 11% |
| extract_decorators | core-test-data | 8.91 ms | 13.59 (rebuild 13.64) | 0.86 (rebuild 1.36) | **0.80** (rebuild 1.22) | 11.58 | 2.10 | **0.52** | 4.68 ms | 43.0 | 75% | 7% |
| extract_decorators | conformance | 3.01 ms | 17.76 (rebuild 18.67) | 0.88 (rebuild 1.45) | **0.77** (rebuild 1.08) | 16.75 | 3.81 | **0.64** | 1.91 ms | 48.0 | 48% | 11% |
| extract_decorators | synthetic-large | 10.08 ms | 3.69 (rebuild 4.77) | 1.45 (rebuild 2.53) | **1.33** (rebuild 2.30) | 7.27 | 2.57 | **0.58** | 5.80 ms | 8.0 | 87% | 7% |
| extract_vocabularies | core-test-data | 7.65 ms | 15.96 (rebuild 16.52) | 1.01 (rebuild 1.64) | **0.78** (rebuild 1.14) | 13.69 | 3.11 | **0.38** | 2.94 ms | 43.0 | 76% | 12% |
| extract_vocabularies | conformance | 2.70 ms | 20.01 (rebuild 20.77) | 0.97 (rebuild 1.78) | **0.75** (rebuild 1.04) | 18.97 | 4.44 | **0.58** | 1.58 ms | 48.0 | 54% | 13% |
| extract_vocabularies | synthetic-large | 10.47 ms | 3.79 (rebuild 4.38) | 1.29 (rebuild 2.51) | **1.09** (rebuild 1.77) | 7.56 | 4.21 | **0.43** | 4.53 ms | 8.0 | 86% | 10% |
| extract_cold | core-test-data | 7.16 ms | - | - | - | 14.98 | 4.23 | **1.94** | 13.87 ms | 43.0 | 91% | 38% |
| extract_cold | conformance | 2.83 ms | - | - | - | 19.08 | 6.32 | **2.21** | 6.25 ms | 48.0 | 84% | 19% |
| extract_cold | synthetic-large | 9.97 ms | - | - | - | 7.71 | 4.71 | **2.70** | 26.91 ms | 8.0 | 96% | 48% |
| extract_keep | core-test-data | 7.58 ms | - | - | - | 15.45 | 3.51 | **0.87** | 6.63 ms | 43.0 | 85% | 10% |
| extract_keep | conformance | 2.88 ms | - | - | - | 18.84 | 5.33 | **0.69** | 1.98 ms | 48.0 | 71% | 12% |
| extract_keep | synthetic-large | 11.57 ms | - | - | - | 8.43 | 4.18 | **0.85** | 9.84 ms | 8.0 | 92% | 9% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 59.9 us | 0.43 | 0.29 | **0.25** | 2.59 | 1.00 | **1.03** | 61.6 us | 1.0 | 57% | 1% |
| from_json | conformance | 15.4 us | 0.26 | 0.23 | **0.22** | 3.53 | 1.12 | **1.14** | 17.6 us | 1.0 | 52% | 1% |
| from_json | synthetic-large | 19.5 us | 0.54 | 0.46 | **0.41** | 3.09 | 1.33 | **1.30** | 25.3 us | 1.0 | 67% | 2% |
| to_json | core-test-data | 32.8 us | 0.66 | 0.64 | **0.59** | 2.34 | 2.26 | **2.26** | 74.1 us | 1.0 | 66% | 1% |
| to_json | conformance | 8.13 us | 0.45 | 0.42 | **0.40** | 2.72 | 2.78 | **2.71** | 22.0 us | 1.0 | 66% | 1% |
| to_json | synthetic-large | 9.09 us | 1.09 | 0.99 | **1.05** | 4.03 | 4.52 | **4.21** | 38.2 us | 1.0 | 71% | 1% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 6.72 us | - | - | - | 8.42 | 1.72 | **1.78** | 12.0 us | 4.6 | 31% | 1% |
| new_resource | conformance | 4.44 us | 0.28 | 0.26 | **0.24** | 10.78 | 1.53 | **1.37** | 6.07 us | 3.2 | 36% | 1% |
| new_resource | synthetic-large | 3.33 us | 0.44 | 0.41 | **0.35** | 4.23 | 1.61 | **1.65** | 5.49 us | 3.0 | 33% | 2% |

### Validation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 17.5 us | 0.40 | 0.41 | **0.33** | 1.05 | 1.07 | **1.01** | 17.7 us | 1.0 | 44% | 1% |
| validate | conformance | 3.97 us | 0.37 | 0.33 | **0.30** | 1.54 | 1.60 | **1.46** | 5.77 us | 1.0 | 37% | 2% |
| validate | synthetic-large | 6.03 us | 0.60 | 0.56 | **0.48** | 1.31 | 1.24 | **1.22** | 7.38 us | 1.0 | 54% | 1% |
| set_property_value | core-test-data | 2.09 us | 0.63 | 0.56 | **0.47** | 1.69 | 1.69 | **1.55** | 3.23 us | 1.1 | 34% | 2% |
| set_property_value | conformance | 0.62 us | 0.88 | 0.74 | **0.62** | 5.01 | 5.05 | **5.07** | 3.14 us | 1.1 | 15% | 2% |
| set_property_value | synthetic-large | 0.75 us | 1.07 | 0.85 | **0.74** | 2.67 | 2.70 | **2.49** | 1.86 us | 1.0 | 35% | 3% |
| add_array_value | core-test-data | 17.2 us | 0.59 | 0.58 | **0.51** | 5.82 | 2.58 | **2.69** | 46.4 us | 15.7 | 33% | 1% |
| add_array_value | conformance | 1.21 us | 0.71 | 0.65 | **0.70** | 4.34 | 4.40 | **4.57** | 5.52 us | 1.0 | 23% | 2% |
| add_array_value | synthetic-large | 1.52 us | 0.75 | 0.67 | **0.59** | 2.07 | 1.97 | **1.94** | 2.95 us | 1.0 | 42% | 2% |

### Validation (validateInstance, P5-89)

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate_instance | core-test-data | 67.9 us | - | - | **0.19** | - | - | **0.62** | 42.1 us | 1.0 | 66% | 3% |
| validate_instance | conformance | 18.2 us | - | - | **0.16** | - | - | **0.82** | 15.0 us | 1.0 | 50% | 5% |
| validate_instance | synthetic-large | 24.8 us | - | - | **0.26** | - | - | **0.90** | 22.4 us | 1.0 | 73% | 4% |
| validate_instance_or_throw | core-test-data | 63.6 us | - | - | **0.19** | - | - | **0.99** | 63.2 us | 1.0 | 51% | 3% |
| validate_instance_or_throw | conformance | 17.3 us | - | - | **0.16** | - | - | **1.09** | 18.9 us | 1.0 | 33% | 4% |
| validate_instance_or_throw | synthetic-large | 24.3 us | - | - | **0.27** | - | - | **1.39** | 33.7 us | 1.0 | 54% | 4% |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector's share of the V8 profile of the TS-API loop; "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.

| # | op | set | category | x TS API | P5-72 | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | set_property_value | conformance | Validation | 5.07 | 5.05 | 0.62 | 3.14 us | 0.62 us | 1.1 | 1.34 us (15%) | 7.78 us | 2% | 0.38 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileGetTypeName x0.0 | ts-core 38.1%, core 20.4%, glue 13.3%, encode 10.1% |
| 2 | add_array_value | conformance | Validation | 4.57 | 4.40 | 0.70 | 5.52 us | 1.21 us | 1.0 | 1.35 us (23%) | 4.46 us | 2% | 0.85 us | ModelManagerHandle.validatePropertyBinary x1.0 | ts-core 41.9%, encode 19.4%, core 18.1%, glue 12.8% |
| 3 | to_json | synthetic-large | Serialisation | 4.21 | 4.52 | 1.05 | 38.2 us | 9.09 us | 1.0 | 34.5 us (71%) | 14.1 us | 1% | 9.52 us | ModelManagerHandle.serializerToJson x1.0 | core 63.9%, encode 19.7%, decode 6.6%, glue 6.4% |
| 4 | resolve_type_first | core-test-data | Introspection | 4.18 | 3.73 | - | 1.29 us | 0.31 us | 1.0 | 1.13 us (69%) | 0.51 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 29.9%, core 28.7%, other 21.5%, ts-core 18.1% |
| 5 | modelfile_new | core-test-data | Model | 3.65 | 5.09 | 0.53 | 105.8 us | 29.0 us | 1.1 | 53.6 us (53%) | 47.7 us | 4% | 15.5 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, modelFileIsCompatibleVersion x0.1 | core 55.6%, ts-core 24.1%, views 13.1%, gc 3.5% |
| 6 | modelfile_new | synthetic-large | Model | 3.58 | 5.41 | 0.97 | 2.69 ms | 750.6 us | 1.0 | 2.11 ms (36%) | 3.73 ms | 6% | 729.6 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0 | core 50.8%, ts-core 40.5%, gc 6%, views 1.5% |
| 7 | modelfile_new | conformance | Model | 3.43 | 7.77 | 0.60 | 35.3 us | 10.3 us | 1.0 | 26.8 us (47%) | 30.1 us | 7% | 6.14 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0 | core 47.4%, ts-core 21.8%, views 19.8%, gc 6.8% |
| 8 | get_type_first | core-test-data | Introspection | 3.11 | 3.36 | - | 1.30 us | 0.42 us | 1.0 | 1.80 us (51%) | 1.75 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | ts-core 23.8%, views 21.7%, glue 19.3%, core 18.4% |
| 9 | add_model_file | synthetic-large | Model | 3.05 | 4.12 | 0.64 | 8.01 ms | 2.62 ms | 5.0 | 2.96 ms (67%) | 1.48 ms | 17% | 1.67 ms | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | core 50.8%, ts-core 26.3%, gc 17.4%, views 3.6% |
| 10 | to_json | conformance | Serialisation | 2.71 | 2.78 | 0.40 | 22.0 us | 8.13 us | 1.0 | 15.3 us (66%) | 7.78 us | 1% | 3.24 us | ModelManagerHandle.serializerToJson x1.0 | core 57.1%, encode 23.1%, ts-core 5.9%, glue 5.4% |
| 11 | extract_cold | synthetic-large | Introspection | 2.70 | 4.71 | - | 26.91 ms | 9.97 ms | 8.0 | 21.48 ms (96%) | 945.0 us | 48% | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x2.0 | gc 47.6%, core 45.1%, glue 4.5%, ts-core 1.3% |
| 12 | add_array_value | core-test-data | Validation | 2.69 | 2.58 | 0.51 | 46.4 us | 17.2 us | 15.7 | 20.0 us (33%) | 39.9 us | 1% | 8.86 us | modelUtilIsAssignableTo x1.5, resourceValidatorPrimitiveValid x7.2, ModelManagerHandle.modelFileGetTypeName x2.1 | ts-core 32.2%, glue 16.5%, views 15.2%, encode 14.9% |
| 13 | get_namespaces_first | synthetic-large | Introspection | 2.66 | 15.85 | - | 0.39 us | 0.15 us | 0.0 | 0.00 us (0%) | 0.96 us | 4% | - |  | other 81%, ts-core 14.6%, gc 4.4%, views 0% |
| 14 | resolve_type_first | conformance | Introspection | 2.61 | 2.41 | - | 1.01 us | 0.39 us | 1.0 | 1.27 us (68%) | 0.59 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 31.4%, core 28.6%, other 21.1%, ts-core 17.4% |
| 15 | get_type_first | conformance | Introspection | 2.57 | 2.72 | - | 1.37 us | 0.53 us | 1.0 | 1.42 us (48%) | 1.54 us | 1% | - | ModelManagerHandle.getTypeName x1.0 | ts-core 24.2%, views 23.9%, glue 19.6%, core 16.6% |
| 16 | set_property_value | synthetic-large | Validation | 2.49 | 2.70 | 0.74 | 1.86 us | 0.75 us | 1.0 | 0.91 us (35%) | 1.68 us | 3% | 0.55 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8 | ts-core 36.7%, core 28.9%, glue 15.7%, views 7.8% |
| 17 | get_type_first | synthetic-large | Introspection | 2.43 | 2.56 | - | 1.40 us | 0.58 us | 1.0 | 1.28 us (49%) | 1.34 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | views 26.2%, ts-core 22.7%, glue 20.6%, core 17.3% |
| 18 | to_json | core-test-data | Serialisation | 2.26 | 2.26 | 0.59 | 74.1 us | 32.8 us | 1.0 | 55.6 us (66%) | 28.8 us | 1% | 19.2 us | ModelManagerHandle.serializerToJson x1.0 | core 60.7%, encode 22.1%, decode 7.3%, glue 4% |
| 19 | resolve_type_first | synthetic-large | Introspection | 2.25 | 2.45 | - | 0.87 us | 0.39 us | 1.0 | 1.08 us (72%) | 0.43 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 35.7%, core 27.8%, other 23%, ts-core 11.7% |
| 20 | add_cto_model | core-test-data | Model | 2.23 | 2.56 | 0.07 | 1.09 ms | 489.5 us | 2.1 | 118.0 us (17%) | 588.8 us | 16% | 36.6 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 | cto-parser 53.7%, core 19.6%, gc 16.1%, ts-core 5.1% |
| 21 | extract_cold | conformance | Introspection | 2.21 | 6.32 | - | 6.25 ms | 2.83 ms | 48.0 | 5.88 ms (84%) | 1.15 ms | 19% | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x41.0, new ModelManagerHandle x2.0 | core 61%, gc 19.1%, glue 6.8%, views 6.3% |
| 22 | add_cto_model | conformance | Model | 2.05 | 2.79 | 0.06 | 380.3 us | 185.9 us | 2.1 | 43.6 us (18%) | 193.5 us | 9% | 10.4 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 | cto-parser 54.8%, core 18.8%, views 8.8%, gc 8.5% |
| 23 | add_model_file | conformance | Model | 1.99 | 8.14 | 0.39 | 52.9 us | 26.6 us | 2.1 | 30.6 us (52%) | 28.3 us | 21% | 10.4 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | core 46.7%, gc 21%, ts-core 15.1%, views 14.3% |
| 24 | add_array_value | synthetic-large | Validation | 1.94 | 1.97 | 0.59 | 2.95 us | 1.52 us | 1.0 | 1.60 us (42%) | 2.21 us | 2% | 0.91 us | ModelManagerHandle.validatePropertyBinary x1.0 | core 33.5%, glue 25%, ts-core 24.3%, views 7% |
| 25 | extract_cold | core-test-data | Introspection | 1.94 | 4.23 | - | 13.87 ms | 7.16 ms | 43.0 | 12.78 ms (91%) | 1.29 ms | 38% | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x34.0, modelFileIsCompatibleVersion x2.0 | core 49.7%, gc 38.4%, glue 6%, views 2.7% |
| 26 | new_resource | core-test-data | Instance | 1.78 | 1.72 | - | 12.0 us | 6.72 us | 4.6 | 6.32 us (31%) | 14.0 us | 1% | - | ModelManagerHandle.modelFileGetTypeName x1.7, classDeclarationIsKind x1.9, ModelManagerHandle.modelFileResolveType x0.7 | ts-core 27.3%, views 26.7%, glue 20.8%, core 12.7% |
| 27 | new_resource | synthetic-large | Instance | 1.65 | 1.61 | 0.35 | 5.49 us | 3.33 us | 3.0 | 2.44 us (33%) | 4.87 us | 2% | 1.17 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.0 | views 29.9%, glue 25.5%, ts-core 24.8%, core 10.5% |
| 28 | get_namespaces | synthetic-large | Introspection | 1.60 | 2.01 | 0.43 | 0.23 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.39 us | 4% | 0.06 us |  | other 82.3%, ts-core 13.4%, gc 4.3% |
| 29 | set_property_value | core-test-data | Validation | 1.55 | 1.69 | 0.47 | 3.23 us | 2.09 us | 1.1 | 1.82 us (34%) | 3.47 us | 2% | 0.99 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileGetTypeName x0.0 | ts-core 39.8%, core 28.4%, views 9.9%, other 8.1% |
| 30 | derives_from | core-test-data | Introspection | 1.53 | 1.56 | 0.29 | 1.13 us | 0.74 us | 1.0 | 1.19 us (80%) | 0.30 us | 0% | 0.22 us | ModelManagerHandle.derivesFrom x1.0 | core 63.4%, glue 28.8%, other 7.5%, gc 0.2% |
| 31 | validate | conformance | Validation | 1.46 | 1.60 | 0.30 | 5.77 us | 3.97 us | 1.0 | 2.66 us (37%) | 4.44 us | 2% | 1.20 us | ModelManagerHandle.validateResourceBinary x1.0 | ts-core 55%, core 37.4%, glue 4.3%, gc 1.7% |
| 32 | derives_from | synthetic-large | Introspection | 1.40 | 1.38 | 0.40 | 0.83 us | 0.59 us | 1.0 | 1.44 us (50%) | 1.45 us | 0% | 0.24 us | ModelManagerHandle.derivesFrom x1.0 | core 62.1%, glue 31.1%, other 6.2%, gc 0.4% |
| 33 | validate_instance_or_throw | synthetic-large | Validation | 1.39 | - | 0.27 | 33.7 us | 24.3 us | 1.0 | 18.5 us (54%) | 16.1 us | 4% | 6.46 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 48.6%, encode 30.9%, ts-core 7.1%, other 4.2% |
| 34 | get_type | core-test-data | Introspection | 1.37 | 2.52 | 0.24 | 0.58 us | 0.42 us | 0.0 | 0.00 us (0%) | 0.76 us | 1% | 0.10 us |  | views 51.4%, ts-core 38.1%, other 8.9%, gc 1.3% |
| 35 | new_resource | conformance | Instance | 1.37 | 1.53 | 0.24 | 6.07 us | 4.44 us | 3.2 | 3.09 us (36%) | 5.59 us | 1% | 1.08 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 | views 29.8%, glue 25.1%, ts-core 23.7%, core 10.8% |
| 36 | from_json | synthetic-large | Serialisation | 1.30 | 1.33 | 0.41 | 25.3 us | 19.5 us | 1.0 | 24.2 us (67%) | 12.1 us | 2% | 8.00 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 57.6%, encode 30.2%, glue 5.5%, decode 2.3% |
| 37 | add_cto_model | synthetic-large | Model | 1.26 | 1.59 | 0.07 | 29.29 ms | 23.33 ms | 5.0 | 3.42 ms (12%) | 24.66 ms | 9% | 1.67 ms | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | cto-parser 69.5%, core 13.2%, gc 8.6%, ts-core 6.8% |
| 38 | add_model_file | core-test-data | Model | 1.25 | 3.35 | 0.37 | 122.6 us | 97.7 us | 2.1 | 81.8 us (63%) | 49.0 us | 24% | 36.6 us | ModelManagerHandle.stageModelFileCheckedCompactFlat x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 | core 55.1%, gc 23.6%, ts-core 11.7%, views 6.7% |
| 39 | validate | synthetic-large | Validation | 1.22 | 1.24 | 0.48 | 7.38 us | 6.03 us | 1.0 | 8.76 us (54%) | 7.38 us | 1% | 2.92 us | ModelManagerHandle.validateResourceBinary x1.0 | core 61.4%, ts-core 30.1%, glue 5.5%, gc 1.4% |
| 40 | derives_from | conformance | Introspection | 1.19 | 1.20 | 0.25 | 0.92 us | 0.77 us | 1.0 | 1.35 us (79%) | 0.35 us | 0% | 0.19 us | ModelManagerHandle.derivesFrom x1.0 | core 61.4%, glue 22.3%, ts-core 13.6%, other 2.4% |
| 41 | from_json | conformance | Serialisation | 1.14 | 1.12 | 0.22 | 17.6 us | 15.4 us | 1.0 | 12.0 us (52%) | 11.3 us | 1% | 3.31 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 50%, encode 26%, ts-core 11.1%, glue 5.9% |
| 42 | is_assignable_to | core-test-data | Introspection | 1.14 | 1.00 | 0.26 | 1.29 us | 1.13 us | 1.0 | 1.51 us (79%) | 0.40 us | 0% | 0.29 us | ModelManagerHandle.isAssignableTo x1.0 | core 72.4%, other 26.3%, glue 1%, gc 0.3% |
| 43 | mm_new | (system) | Model | 1.13 | 1.09 | 0.00 | 443.7 us | 393.0 us | 3.0 | 49.7 us (10%) | 464.4 us | 7% | 1.36 us | ModelManagerHandle.setDecoratorValidation x1.0, new ModelManagerHandle x1.0, ModelManagerHandle.setDangerouslyAllowReservedSystemTypeNamesInUserModels x1.0 | ts-core 59.9%, views 27.8%, gc 6.6%, core 3.5% |
| 44 | dcs_decorate | core-test-data | Introspection | 1.12 | 1.17 | 0.44 | 46.11 ms | 41.17 ms | 44.0 | 51.51 ms (94%) | 3.46 ms | 14% | 18.19 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 75.9%, gc 14.1%, glue 5.9%, views 1.9% |
| 45 | validate_instance_or_throw | conformance | Validation | 1.09 | - | 0.16 | 18.9 us | 17.3 us | 1.0 | 10.2 us (33%) | 20.9 us | 4% | 2.70 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 39%, encode 28.7%, ts-core 15.9%, other 6.1% |
| 46 | dcs_decorate | synthetic-large | Introspection | 1.08 | 1.17 | 0.49 | 70.92 ms | 65.55 ms | 9.0 | 66.90 ms (98%) | 1.07 ms | 11% | 31.94 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 80.7%, gc 11.1%, glue 5.6%, views 1.1% |
| 47 | get_decorators | core-test-data | Introspection | 1.06 | 1.04 | 0.04 | 0.16 us | 0.15 us | 0.0 | 0.00 us (0%) | 0.19 us | 1% | 0.01 us |  | other 98.7%, gc 1.1%, views 0.2% |
| 48 | from_json | core-test-data | Serialisation | 1.03 | 1.00 | 0.25 | 61.6 us | 59.9 us | 1.0 | 50.9 us (57%) | 37.9 us | 1% | 14.8 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 55%, encode 30.3%, glue 4.7%, ts-core 3.2% |
| 49 | get_decorators | synthetic-large | Introspection | 1.03 | 1.04 | 0.24 | 0.03 us | 0.02 us | 0.0 | 0.00 us (0%) | 0.25 us | 1% | 0.01 us |  | other 99.5%, gc 0.5%, views 0% |
| 50 | validate | core-test-data | Validation | 1.01 | 1.07 | 0.33 | 17.7 us | 17.5 us | 1.0 | 9.79 us (44%) | 12.7 us | 1% | 5.71 us | ModelManagerHandle.validateResourceBinary x1.0 | core 51.2%, ts-core 38.7%, encode 4.2%, other 4% |
| 51 | dcs_decorate | conformance | Introspection | 1.00 | 1.13 | 0.32 | 21.68 ms | 21.66 ms | 49.0 | 20.80 ms (92%) | 1.77 ms | 14% | 6.91 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 73.3%, gc 13.8%, glue 6%, views 3.4% |

## mm_new, absolute (us per manager, each round's median)

| side | round 1 | round 2 | round 3 | median |
|---|---:|---:|---:|---:|
| TS 5.0.0 | 393.4 | 393.0 | 388.1 | 393.0 |
| pre-F1 | 650.8 | 612.2 | 689.9 | 650.8 |
| P5-72 head | 453.8 | 407.0 | 427.1 | 427.1 |
| now | 443.7 | 335.2 | 635.8 | 443.7 |
| now, metamodelValidation:false | 158.6 | 174.3 | 293.2 | 174.3 |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | P5-72 x TS on | crossings on / off |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 393.0 us | 443.7 us | 174.3 us | 269.4 us | 2.55 | 1.13 | 0.44 | 1.09 | 3.0 / 3.0 |
| modelfile_new | core-test-data | 29.0 us | 105.8 us | 106.5 us | -0.79 us | 0.99 | 3.65 | 3.68 | 5.09 | 1.1 / 1.1 |
| modelfile_new | conformance | 10.3 us | 35.3 us | 35.7 us | -0.32 us | 0.99 | 3.43 | 3.46 | 7.77 | 1.0 / 1.0 |
| modelfile_new | synthetic-large | 750.6 us | 2.69 ms | 2.63 ms | 53.3 us | 1.02 | 3.58 | 3.51 | 5.41 | 1.0 / 1.0 |
| add_model_file | core-test-data | 97.7 us | 122.6 us | 113.7 us | 8.86 us | 1.08 | 1.25 | 1.16 | 3.35 | 2.1 / 2.1 |
| add_model_file | conformance | 26.6 us | 52.9 us | 45.4 us | 7.52 us | 1.17 | 1.99 | 1.71 | 8.14 | 2.1 / 2.1 |
| add_model_file | synthetic-large | 2.62 ms | 8.01 ms | 8.14 ms | -131.70 us | 0.98 | 3.05 | 3.10 | 4.12 | 5.0 / 5.0 |
| add_cto_model | core-test-data | 489.5 us | 1.09 ms | 1.06 ms | 32.7 us | 1.03 | 2.23 | 2.16 | 2.56 | 2.1 / 2.1 |
| add_cto_model | conformance | 185.9 us | 380.3 us | 385.7 us | -5.39 us | 0.99 | 2.05 | 2.07 | 2.79 | 2.1 / 2.1 |
| add_cto_model | synthetic-large | 23.33 ms | 29.29 ms | 30.06 ms | -760.53 us | 0.97 | 1.26 | 1.29 | 1.59 | 5.0 / 5.0 |

Errors (the heads before P5-89 have no validateInstance):
- validate_instance/concerto-core-test-data: Error: ModelManager.validateInstance is not in this dist
- validate_instance/conformance: Error: ModelManager.validateInstance is not in this dist
- validate_instance/synthetic-large: Error: ModelManager.validateInstance is not in this dist
- validate_instance_or_throw/concerto-core-test-data: Error: ModelManager.validateInstanceOrThrow is not in this dist
- validate_instance_or_throw/conformance: Error: ModelManager.validateInstanceOrThrow is not in this dist
- validate_instance_or_throw/synthetic-large: Error: ModelManager.validateInstanceOrThrow is not in this dist
