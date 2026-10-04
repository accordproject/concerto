Rounds: now 1, 2, 3, P5-60 1, 2, 3, pre-F1 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).

## Rows at or below TS 5.0.0

| level | pre-F1 | P5-60 | **now** |
|---|---:|---:|---:|
| TS API (of 73) | 15 | 16 | **14** |
| crate (of 57) | 45 | 45 | **49** |

## Geometric mean of x TS by category

| category | rows | TS API: pre-F1 | P5-60 | **now** | crate: pre-F1 | P5-60 | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 3.34 | 3.50 | **2.87** | 0.31 | 0.31 | **0.26** |
| Introspection (including decorators/DCS) | 45 | 1.60 | 1.57 | **1.59** | 0.34 | 0.34 | **0.34** |
| Serialisation | 6 | 1.90 | 2.09 | **1.87** | 0.45 | 0.45 | **0.45** |
| Instance creation | 3 | 1.56 | 1.58 | **1.53** | 0.31 | 0.31 | **0.32** |
| Validation | 9 | 2.46 | 2.31 | **2.24** | 0.61 | 0.60 | **0.61** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 536.8 us | 0.00 | 0.00 | **0.00** | 0.50 | 0.52 | **0.56** | 300.4 us | 8.0 | 30% |
| modelfile_new | core-test-data | 27.5 us | 1.19 | 1.20 | **1.01** | 5.47 | 5.57 | **4.95** | 136.0 us | 2.0 | 67% |
| modelfile_new | conformance | 9.78 us | 1.59 | 1.58 | **0.92** | 7.59 | 7.55 | **7.25** | 70.9 us | 2.0 | 62% |
| modelfile_new | synthetic-large | 733.5 us | 1.95 | 2.04 | **1.92** | 5.39 | 5.87 | **4.48** | 3.28 ms | 2.0 | 80% |
| add_model_file | core-test-data | 72.7 us | 0.75 | 0.76 | **0.67** | 4.46 | 4.61 | **2.11** | 153.6 us | 3.2 | 62% |
| add_model_file | conformance | 27.4 us | 0.81 | 0.81 | **0.56** | 6.92 | 7.78 | **3.62** | 99.2 us | 3.2 | 54% |
| add_model_file | synthetic-large | 2.42 ms | 1.00 | 0.98 | **0.96** | 4.09 | 4.34 | **3.84** | 9.31 ms | 11.0 | 80% |
| add_cto_model | core-test-data | 473.1 us | 0.11 | 0.12 | **0.10** | 2.55 | 2.71 | **2.60** | 1.23 ms | 3.2 | 20% |
| add_cto_model | conformance | 169.4 us | 0.13 | 0.13 | **0.09** | 2.87 | 3.12 | **3.07** | 519.8 us | 3.2 | 20% |
| add_cto_model | synthetic-large | 23.45 ms | 0.10 | 0.10 | **0.10** | 1.69 | 1.63 | **1.78** | 41.68 ms | 11.0 | 17% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.42 us | 0.22 | 0.21 | **0.22** | 1.35 | 1.34 | **1.33** | 0.56 us | 0.0 | 0% |
| get_type | conformance | 0.54 us | 0.18 | 0.18 | **0.18** | 0.84 | 0.83 | **0.84** | 0.46 us | 0.0 | 0% |
| get_type | synthetic-large | 0.56 us | 0.15 | 0.15 | **0.16** | 0.71 | 0.72 | **0.74** | 0.41 us | 0.0 | 0% |
| get_type_first | core-test-data | 0.41 us | - | - | - | 3.19 | 3.33 | **3.15** | 1.30 us | 1.0 | 50% |
| get_type_first | conformance | 0.53 us | - | - | - | 2.78 | 2.70 | **2.72** | 1.45 us | 1.0 | 47% |
| get_type_first | synthetic-large | 0.54 us | - | - | - | 2.62 | 2.69 | **2.63** | 1.43 us | 1.0 | 50% |
| resolve_type | core-test-data | 0.30 us | 0.23 | 0.23 | **0.22** | 0.30 | 0.32 | **0.32** | 0.10 us | 0.0 | 0% |
| resolve_type | conformance | 0.39 us | 0.18 | 0.17 | **0.18** | 0.26 | 0.25 | **0.25** | 0.10 us | 0.0 | 0% |
| resolve_type | synthetic-large | 0.31 us | 0.22 | 0.22 | **0.23** | 0.07 | 0.07 | **0.08** | 0.02 us | 0.0 | 0% |
| resolve_type_first | core-test-data | 0.31 us | - | - | - | 3.84 | 3.82 | **4.01** | 1.22 us | 1.0 | 63% |
| resolve_type_first | conformance | 0.38 us | - | - | - | 2.40 | 2.32 | **2.21** | 0.85 us | 1.0 | 75% |
| resolve_type_first | synthetic-large | 0.37 us | - | - | - | 2.57 | 2.41 | **2.22** | 0.82 us | 1.0 | 68% |
| get_namespaces | core-test-data | 0.92 us | 1.30 | 1.26 | **1.28** | 0.38 | 0.35 | **0.36** | 0.33 us | 0.0 | 0% |
| get_namespaces | conformance | 0.94 us | 1.27 | 1.21 | **1.27** | 0.31 | 0.30 | **0.32** | 0.30 us | 0.0 | 0% |
| get_namespaces | synthetic-large | 0.15 us | 0.39 | 0.38 | **0.40** | 1.81 | 1.93 | **1.86** | 0.28 us | 0.0 | 0% |
| get_namespaces_first | core-test-data | 0.88 us | - | - | - | 12.16 | 12.98 | **12.07** | 10.6 us | 1.0 | 93% |
| get_namespaces_first | conformance | 1.00 us | - | - | - | 12.76 | 12.31 | **12.16** | 12.2 us | 1.0 | 91% |
| get_namespaces_first | synthetic-large | 0.15 us | - | - | - | 13.20 | 16.43 | **12.41** | 1.85 us | 1.0 | 78% |
| derives_from | core-test-data | 0.73 us | 0.26 | 0.27 | **0.27** | 1.51 | 1.55 | **1.52** | 1.11 us | 1.0 | 78% |
| derives_from | conformance | 0.77 us | 0.26 | 0.26 | **0.26** | 1.22 | 0.99 | **1.17** | 0.90 us | 1.0 | 80% |
| derives_from | synthetic-large | 0.60 us | 0.34 | 0.35 | **0.35** | 1.39 | 1.37 | **1.52** | 0.92 us | 1.0 | 37% |
| is_assignable_to | core-test-data | 1.13 us | 0.24 | 0.24 | **0.25** | 1.81 | 1.02 | **1.00** | 1.13 us | 1.0 | 77% |
| is_assignable_to | conformance | 1.30 us | 0.22 | 0.23 | **0.23** | 1.11 | 0.64 | **0.65** | 0.85 us | 1.0 | 75% |
| is_assignable_to | synthetic-large | 1.20 us | 0.25 | 0.26 | **0.26** | 0.75 | 0.74 | **0.75** | 0.90 us | 1.0 | 47% |
| get_decorators | core-test-data | 0.16 us | 0.03 | 0.03 | **0.03** | 0.70 | 0.71 | **1.01** | 0.16 us | 0.0 | 0% |
| get_decorators | conformance | 0.09 us | 0.05 | 0.05 | **0.04** | 0.77 | 0.73 | **0.74** | 0.07 us | 0.0 | 0% |
| get_decorators | synthetic-large | 0.02 us | 0.20 | 0.20 | **0.21** | 1.04 | 1.02 | **1.01** | 0.02 us | 0.0 | 0% |
| dcs_decorate | core-test-data | 42.62 ms | 0.49 (rebuild 0.61) | 0.49 (rebuild 0.69) | **0.48** (rebuild 0.63) | 1.08 | 1.13 | **1.14** | 48.55 ms | 85.0 | 92% |
| dcs_decorate | conformance | 21.81 ms | 0.38 (rebuild 0.48) | 0.39 (rebuild 0.48) | **0.35** (rebuild 0.45) | 1.00 | 1.02 | **1.04** | 22.69 ms | 99.0 | 87% |
| dcs_decorate | synthetic-large | 67.23 ms | 0.55 (rebuild 0.74) | 0.53 (rebuild 0.75) | **0.56** (rebuild 0.74) | 1.15 | 1.12 | **1.11** | 74.81 ms | 19.0 | 98% |
| dcs_validate | core-test-data | 35.81 ms | 0.25 (rebuild 0.31) | 0.27 (rebuild 0.32) | **0.25** (rebuild 0.31) | 0.70 | 0.71 | **0.65** | 23.24 ms | 51.0 | 83% |
| dcs_validate | conformance | 18.94 ms | 0.21 (rebuild 0.27) | 0.22 (rebuild 0.28) | **0.21** (rebuild 0.25) | 0.80 | 0.83 | **0.86** | 16.24 ms | 58.0 | 63% |
| dcs_validate | synthetic-large | 55.53 ms | 0.29 (rebuild 0.35) | 0.29 (rebuild 0.35) | **0.29** (rebuild 0.36) | 0.66 | 0.75 | **0.69** | 38.40 ms | 18.0 | 85% |
| extract_decorators | core-test-data | 7.99 ms | 0.98 (rebuild 1.63) | 1.09 (rebuild 1.70) | **0.97** (rebuild 1.46) | 2.21 | 2.23 | **2.28** | 18.24 ms | 84.0 | 81% |
| extract_decorators | conformance | 2.73 ms | 0.98 (rebuild 1.62) | 0.98 (rebuild 1.62) | **0.89** (rebuild 1.35) | 3.98 | 3.91 | **4.11** | 11.24 ms | 98.0 | 83% |
| extract_decorators | synthetic-large | 9.48 ms | 1.52 (rebuild 2.68) | 1.45 (rebuild 2.72) | **1.50** (rebuild 2.51) | 2.73 | 2.53 | **2.72** | 25.76 ms | 18.0 | 90% |
| extract_vocabularies | core-test-data | 7.50 ms | 1.03 (rebuild 1.67) | 1.01 (rebuild 1.74) | **0.95** (rebuild 1.45) | 3.06 | 3.29 | **3.37** | 25.30 ms | 84.0 | 84% |
| extract_vocabularies | conformance | 2.49 ms | 1.05 (rebuild 1.77) | 1.02 (rebuild 1.74) | **0.88** (rebuild 1.37) | 4.56 | 4.45 | **4.77** | 11.86 ms | 98.0 | 76% |
| extract_vocabularies | synthetic-large | 9.88 ms | 1.39 (rebuild 2.62) | 1.43 (rebuild 2.42) | **1.30** (rebuild 2.26) | 3.65 | 4.00 | **4.16** | 41.12 ms | 18.0 | 96% |
| extract_cold | core-test-data | 6.81 ms | - | - | - | 3.75 | 3.69 | **3.86** | 26.28 ms | 84.0 | 88% |
| extract_cold | conformance | 2.67 ms | - | - | - | 5.54 | 5.40 | **6.32** | 16.88 ms | 98.0 | 70% |
| extract_cold | synthetic-large | 9.48 ms | - | - | - | 4.25 | 4.01 | **3.80** | 36.00 ms | 18.0 | 85% |
| extract_keep | core-test-data | 7.57 ms | - | - | - | 1.92 | 1.92 | **1.99** | 15.05 ms | 84.0 | 74% |
| extract_keep | conformance | 3.06 ms | - | - | - | 3.00 | 3.29 | **2.79** | 8.53 ms | 98.0 | 79% |
| extract_keep | synthetic-large | 11.43 ms | - | - | - | 2.20 | 3.05 | **2.62** | 29.96 ms | 18.0 | 96% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 58.9 us | 0.30 | 0.29 | **0.29** | 0.97 | 1.03 | **1.02** | 60.0 us | 1.0 | 60% |
| from_json | conformance | 14.9 us | 0.24 | 0.23 | **0.23** | 1.18 | 1.88 | **1.20** | 17.8 us | 1.0 | 53% |
| from_json | synthetic-large | 18.9 us | 0.46 | 0.45 | **0.47** | 1.45 | 1.47 | **1.35** | 25.4 us | 1.0 | 66% |
| to_json | core-test-data | 32.6 us | 0.63 | 0.66 | **0.63** | 2.27 | 2.34 | **2.31** | 75.3 us | 1.0 | 65% |
| to_json | conformance | 8.05 us | 0.42 | 0.43 | **0.40** | 2.79 | 2.82 | **2.73** | 21.9 us | 1.0 | 67% |
| to_json | synthetic-large | 9.46 us | 1.01 | 1.00 | **1.01** | 4.43 | 4.39 | **4.18** | 39.5 us | 1.0 | 72% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 7.65 us | - | - | - | 1.45 | 1.58 | **1.60** | 12.2 us | 4.6 | 31% |
| new_resource | conformance | 4.46 us | 0.25 | 0.25 | **0.27** | 1.64 | 1.48 | **1.40** | 6.24 us | 3.2 | 34% |
| new_resource | synthetic-large | 3.51 us | 0.37 | 0.38 | **0.38** | 1.58 | 1.69 | **1.61** | 5.66 us | 3.0 | 32% |

### Validation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 17.6 us | 0.41 | 0.40 | **0.40** | 1.14 | 1.13 | **1.07** | 18.9 us | 1.0 | 47% |
| validate | conformance | 4.06 us | 0.33 | 0.32 | **0.33** | 2.42 | 1.53 | **1.47** | 5.98 us | 1.0 | 40% |
| validate | synthetic-large | 5.87 us | 0.55 | 0.53 | **0.54** | 1.28 | 1.31 | **1.31** | 7.67 us | 1.0 | 60% |
| set_property_value | core-test-data | 2.16 us | 0.56 | 0.57 | **0.59** | 1.66 | 1.67 | **1.73** | 3.72 us | 1.1 | 41% |
| set_property_value | conformance | 0.65 us | 0.71 | 0.69 | **0.70** | 4.90 | 4.67 | **4.66** | 3.04 us | 1.1 | 36% |
| set_property_value | synthetic-large | 0.74 us | 0.85 | 0.87 | **0.86** | 2.69 | 2.69 | **2.66** | 1.97 us | 1.0 | 38% |
| add_array_value | core-test-data | 15.5 us | 0.65 | 0.64 | **0.64** | 2.92 | 2.78 | **2.91** | 45.1 us | 15.7 | 33% |
| add_array_value | conformance | 1.21 us | 0.67 | 0.67 | **0.70** | 4.64 | 4.44 | **3.53** | 4.28 us | 1.0 | 27% |
| add_array_value | synthetic-large | 0.93 us | 1.04 | 1.04 | **1.04** | 3.13 | 3.25 | **3.10** | 2.88 us | 1.0 | 43% |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.

| # | op | set | category | x TS API | P5-60 | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | get_namespaces_first | synthetic-large | Introspection | 12.41 | 16.43 | - | 1.85 us | 0.15 us | 1.0 | 1.94 us (78%) | 0.53 us | - | ModelManagerHandle.getNamespaces x1.0 | other 47.1%, glue 24.8%, core 16.3%, ts-core 7.5% |
| 2 | get_namespaces_first | conformance | Introspection | 12.16 | 12.31 | - | 12.2 us | 1.00 us | 1.0 | 12.4 us (91%) | 1.21 us | - | ModelManagerHandle.getNamespaces x1.0 | other 48.6%, glue 30.4%, core 17.2%, gc 2.8% |
| 3 | get_namespaces_first | core-test-data | Introspection | 12.07 | 12.98 | - | 10.6 us | 0.88 us | 1.0 | 12.0 us (93%) | 0.85 us | - | ModelManagerHandle.getNamespaces x1.0 | other 50.9%, glue 28.7%, core 16.1%, gc 3% |
| 4 | modelfile_new | conformance | Model | 7.25 | 7.55 | 0.92 | 70.9 us | 9.78 us | 2.0 | 48.6 us (62%) | 30.4 us | 9.03 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, modelFileIsCompatibleVersion x1.0 | core 43.9%, views 37.8%, gc 10.3%, glue 5% |
| 5 | extract_cold | conformance | Introspection | 6.32 | 5.40 | - | 16.88 ms | 2.67 ms | 98.0 | 7.22 ms (70%) | 3.14 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x46.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 61.4%, gc 19.8%, views 9.7%, glue 5.6% |
| 6 | modelfile_new | core-test-data | Model | 4.95 | 5.57 | 1.01 | 136.0 us | 27.5 us | 2.0 | 88.6 us (67%) | 43.7 us | 27.8 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, modelFileIsCompatibleVersion x1.0 | core 58.3%, views 30%, gc 6.3%, glue 3.6% |
| 7 | extract_vocabularies | conformance | Introspection | 4.77 | 4.45 | 0.88 | 11.86 ms | 2.49 ms | 98.0 | 8.36 ms (76%) | 2.71 ms | 2.19 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, modelFileIsCompatibleVersion x46.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 50.4%, gc 26.1%, views 11.4%, glue 7.8% |
| 8 | set_property_value | conformance | Validation | 4.66 | 4.67 | 0.70 | 3.04 us | 0.65 us | 1.1 | 1.41 us (36%) | 2.53 us | 0.46 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileResolveType x0.0 | ts-core 37.7%, core 23.7%, glue 10.5%, views 10.3% |
| 9 | modelfile_new | synthetic-large | Model | 4.48 | 5.87 | 1.92 | 3.28 ms | 733.5 us | 2.0 | 2.82 ms (80%) | 711.3 us | 1.41 ms | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, modelFileIsCompatibleVersion x1.0 | core 73.1%, views 17%, gc 7.8%, other 1.2% |
| 10 | to_json | synthetic-large | Serialisation | 4.18 | 4.39 | 1.01 | 39.5 us | 9.46 us | 1.0 | 29.2 us (72%) | 11.4 us | 9.60 us | ModelManagerHandle.serializerToJson x1.0 | core 64.9%, encode 19.7%, decode 6.4%, glue 5.8% |
| 11 | extract_vocabularies | synthetic-large | Introspection | 4.16 | 4.00 | 1.30 | 41.12 ms | 9.88 ms | 18.0 | 33.21 ms (96%) | 1.38 ms | 12.85 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, ModelManagerHandle.commitStagedModelFile x1.0, modelFileIsCompatibleVersion x6.0 | core 69.3%, gc 20.8%, glue 6.1%, views 1.9% |
| 12 | extract_decorators | conformance | Introspection | 4.11 | 3.91 | 0.89 | 11.24 ms | 2.73 ms | 98.0 | 7.69 ms (83%) | 1.54 ms | 2.42 ms | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x46.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 46%, gc 22%, views 13.9%, glue 12.5% |
| 13 | resolve_type_first | core-test-data | Introspection | 4.01 | 3.82 | - | 1.22 us | 0.31 us | 1.0 | 1.09 us (63%) | 0.63 us | - | ModelManagerHandle.resolveType x1.0 | glue 32.6%, core 27.9%, other 27.5%, ts-core 10.4% |
| 14 | extract_cold | core-test-data | Introspection | 3.86 | 3.69 | - | 26.28 ms | 6.81 ms | 84.0 | 14.94 ms (88%) | 2.08 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 56.3%, gc 32.2%, glue 5%, views 4.6% |
| 15 | add_model_file | synthetic-large | Model | 3.84 | 4.34 | 0.96 | 9.31 ms | 2.42 ms | 11.0 | 3.78 ms (80%) | 960.1 us | 2.34 ms | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x4.0 | core 62.2%, gc 22.2%, views 12.7%, ts-core 1.2% |
| 16 | extract_cold | synthetic-large | Introspection | 3.80 | 4.01 | - | 36.00 ms | 9.48 ms | 18.0 | 23.39 ms (85%) | 4.06 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x1.0, modelFileIsCompatibleVersion x6.0 | gc 47.6%, core 45.5%, glue 4.1%, views 1.6% |
| 17 | add_model_file | conformance | Model | 3.62 | 7.78 | 0.56 | 99.2 us | 27.4 us | 3.2 | 60.9 us (54%) | 51.5 us | 15.3 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, modelFileIsCompatibleVersion x1.1, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 45.4%, views 24.1%, gc 23.8%, glue 3.3% |
| 18 | add_array_value | conformance | Validation | 3.53 | 4.44 | 0.70 | 4.28 us | 1.21 us | 1.0 | 1.30 us (27%) | 3.53 us | 0.85 us | ModelManagerHandle.validatePropertyBinary x1.0 | ts-core 40.1%, encode 20%, core 18%, glue 11.9% |
| 19 | extract_vocabularies | core-test-data | Introspection | 3.37 | 3.29 | 0.95 | 25.30 ms | 7.50 ms | 84.0 | 21.92 ms (84%) | 4.32 ms | 7.13 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 62.6%, gc 20.9%, glue 8.6%, views 5.1% |
| 20 | get_type_first | core-test-data | Introspection | 3.15 | 3.33 | - | 1.30 us | 0.41 us | 1.0 | 0.84 us (50%) | 0.84 us | - | ModelManagerHandle.getTypeName x1.0 | ts-core 24.5%, views 22.1%, glue 20.4%, core 17.6% |
| 21 | add_array_value | synthetic-large | Validation | 3.10 | 3.25 | 1.04 | 2.88 us | 0.93 us | 1.0 | 1.61 us (43%) | 2.10 us | 0.96 us | ModelManagerHandle.validatePropertyBinary x1.0 | core 33.4%, glue 25.4%, ts-core 19%, views 8.2% |
| 22 | add_cto_model | conformance | Model | 3.07 | 3.12 | 0.09 | 519.8 us | 169.4 us | 3.2 | 52.5 us (20%) | 208.5 us | 15.3 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | cto-parser 47.7%, core 18.9%, views 15.6%, gc 11% |
| 23 | add_array_value | core-test-data | Validation | 2.91 | 2.78 | 0.64 | 45.1 us | 15.5 us | 15.7 | 23.0 us (33%) | 46.2 us | 9.93 us | modelUtilIsAssignableTo x1.5, resourceValidatorPrimitiveValid x7.2, ModelManagerHandle.modelFileGetTypeName x2.1 | ts-core 32.1%, glue 16.9%, views 15.8%, encode 14.7% |
| 24 | extract_keep | conformance | Introspection | 2.79 | 3.29 | - | 8.53 ms | 3.06 ms | 98.0 | 6.54 ms (79%) | 1.76 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x46.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 38%, gc 26.8%, views 16%, glue 12% |
| 25 | to_json | conformance | Serialisation | 2.73 | 2.82 | 0.40 | 21.9 us | 8.05 us | 1.0 | 15.7 us (67%) | 7.75 us | 3.24 us | ModelManagerHandle.serializerToJson x1.0 | core 58.6%, encode 20.7%, ts-core 7.2%, glue 5.6% |
| 26 | get_type_first | conformance | Introspection | 2.72 | 2.70 | - | 1.45 us | 0.53 us | 1.0 | 0.80 us (47%) | 0.90 us | - | ModelManagerHandle.getTypeName x1.0 | views 24.8%, ts-core 23.4%, glue 20.5%, core 17.1% |
| 27 | extract_decorators | synthetic-large | Introspection | 2.72 | 2.53 | 1.50 | 25.76 ms | 9.48 ms | 18.0 | 22.63 ms (90%) | 2.59 ms | 14.24 ms | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x1.0, modelFileIsCompatibleVersion x6.0 | core 70%, glue 13.2%, gc 11.7%, views 2.8% |
| 28 | set_property_value | synthetic-large | Validation | 2.66 | 2.69 | 0.86 | 1.97 us | 0.74 us | 1.0 | 0.93 us (38%) | 1.52 us | 0.64 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8 | ts-core 35.2%, core 32%, glue 12.6%, views 11% |
| 29 | get_type_first | synthetic-large | Introspection | 2.63 | 2.69 | - | 1.43 us | 0.54 us | 1.0 | 0.94 us (50%) | 0.94 us | - | ModelManagerHandle.getTypeName x1.0 | views 27.4%, glue 22.2%, ts-core 18.9%, core 15.7% |
| 30 | extract_keep | synthetic-large | Introspection | 2.62 | 3.05 | - | 29.96 ms | 11.43 ms | 18.0 | 23.11 ms (96%) | 841.7 us | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.commitStagedModelFile x1.0, ModelManagerHandle.systemModelFileHeader x4.0 | core 45.7%, gc 28.7%, glue 19.4%, other 3.3% |
| 31 | add_cto_model | core-test-data | Model | 2.60 | 2.71 | 0.10 | 1.23 ms | 473.1 us | 3.2 | 127.3 us (20%) | 517.2 us | 48.9 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | cto-parser 47.3%, core 23.1%, gc 16.3%, views 9.6% |
| 32 | to_json | core-test-data | Serialisation | 2.31 | 2.34 | 0.63 | 75.3 us | 32.6 us | 1.0 | 52.0 us (65%) | 27.7 us | 20.7 us | ModelManagerHandle.serializerToJson x1.0 | core 63.7%, encode 21.2%, decode 6.9%, glue 3.5% |
| 33 | extract_decorators | core-test-data | Introspection | 2.28 | 2.23 | 0.97 | 18.24 ms | 7.99 ms | 84.0 | 15.12 ms (81%) | 3.53 ms | 7.73 ms | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 64.6%, gc 11.3%, glue 11.3%, views 9.1% |
| 34 | resolve_type_first | synthetic-large | Introspection | 2.22 | 2.41 | - | 0.82 us | 0.37 us | 1.0 | 0.89 us (68%) | 0.41 us | - | ModelManagerHandle.resolveType x1.0 | glue 36.2%, core 26.2%, other 22.7%, ts-core 13.2% |
| 35 | resolve_type_first | conformance | Introspection | 2.21 | 2.32 | - | 0.85 us | 0.38 us | 1.0 | 1.23 us (75%) | 0.41 us | - | ModelManagerHandle.resolveType x1.0 | glue 34.3%, core 29.2%, other 19%, ts-core 16% |
| 36 | add_model_file | core-test-data | Model | 2.11 | 4.61 | 0.67 | 153.6 us | 72.7 us | 3.2 | 104.9 us (62%) | 63.7 us | 48.9 us | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | core 52.3%, gc 26.9%, views 16.2%, glue 2.4% |
| 37 | extract_keep | core-test-data | Introspection | 1.99 | 1.92 | - | 15.05 ms | 7.57 ms | 84.0 | 9.36 ms (74%) | 3.29 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 37.3%, glue 28.9%, gc 22.8%, views 7% |
| 38 | get_namespaces | synthetic-large | Introspection | 1.86 | 1.93 | 0.40 | 0.28 us | 0.15 us | 0.0 | 0.00 us (0%) | 0.25 us | 0.06 us |  | other 81.3%, ts-core 14%, gc 4.6% |
| 39 | add_cto_model | synthetic-large | Model | 1.78 | 1.63 | 0.10 | 41.68 ms | 23.45 ms | 11.0 | 4.82 ms (17%) | 23.97 ms | 2.34 ms | ModelManagerHandle.stageModelFileCheckedUtf8 x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x4.0 | cto-parser 63.2%, core 19.7%, gc 11.7%, views 3.7% |
| 40 | set_property_value | core-test-data | Validation | 1.73 | 1.67 | 0.59 | 3.72 us | 2.16 us | 1.1 | 2.86 us (41%) | 4.14 us | 1.28 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, classDeclarationIsKind x0.0 | ts-core 31.9%, core 31.6%, views 12.7%, other 10.3% |
| 41 | new_resource | synthetic-large | Instance | 1.61 | 1.69 | 0.38 | 5.66 us | 3.51 us | 3.0 | 2.27 us (32%) | 4.83 us | 1.33 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.0 | views 33%, ts-core 25.8%, glue 22.9%, core 9% |
| 42 | new_resource | core-test-data | Instance | 1.60 | 1.58 | - | 12.2 us | 7.65 us | 4.6 | 5.52 us (31%) | 12.1 us | - | ModelManagerHandle.modelFileGetTypeName x1.7, classDeclarationIsKind x1.9, ModelManagerHandle.modelFileResolveType x0.7 | ts-core 31.4%, views 25.8%, glue 19.4%, core 12.4% |
| 43 | derives_from | synthetic-large | Introspection | 1.52 | 1.37 | 0.35 | 0.92 us | 0.60 us | 1.0 | 1.24 us (37%) | 2.16 us | 0.21 us | ModelManagerHandle.derivesFrom x1.0 | core 62%, glue 31.6%, other 6.1%, gc 0.3% |
| 44 | derives_from | core-test-data | Introspection | 1.52 | 1.55 | 0.27 | 1.11 us | 0.73 us | 1.0 | 1.03 us (78%) | 0.29 us | 0.19 us | ModelManagerHandle.derivesFrom x1.0 | core 63.2%, glue 29.5%, other 7%, gc 0.2% |
| 45 | validate | conformance | Validation | 1.47 | 1.53 | 0.33 | 5.98 us | 4.06 us | 1.0 | 2.88 us (40%) | 4.27 us | 1.34 us | ModelManagerHandle.validateResourceBinary x1.0 | ts-core 54.6%, core 38.1%, glue 4.3%, gc 1.6% |
| 46 | new_resource | conformance | Instance | 1.40 | 1.48 | 0.27 | 6.24 us | 4.46 us | 3.2 | 2.86 us (34%) | 5.57 us | 1.18 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 | views 28.7%, glue 25.7%, ts-core 25.3%, core 10.6% |
| 47 | from_json | synthetic-large | Serialisation | 1.35 | 1.47 | 0.47 | 25.4 us | 18.9 us | 1.0 | 18.1 us (66%) | 9.19 us | 8.83 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 60.4%, encode 28.8%, glue 4.3%, decode 2.2% |
| 48 | get_type | core-test-data | Introspection | 1.33 | 1.34 | 0.22 | 0.56 us | 0.42 us | 0.0 | 0.00 us (0%) | 0.73 us | 0.09 us |  | other 45.3%, ts-core 38.6%, views 14.7%, gc 1.2% |
| 49 | validate | synthetic-large | Validation | 1.31 | 1.31 | 0.54 | 7.67 us | 5.87 us | 1.0 | 5.36 us (60%) | 3.56 us | 3.16 us | ModelManagerHandle.validateResourceBinary x1.0 | core 62.9%, ts-core 29.4%, glue 5.1%, other 1.2% |
| 50 | from_json | conformance | Serialisation | 1.20 | 1.88 | 0.23 | 17.8 us | 14.9 us | 1.0 | 11.4 us (53%) | 10.2 us | 3.46 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 52.3%, encode 24.3%, ts-core 11.6%, glue 5.5% |
| 51 | derives_from | conformance | Introspection | 1.17 | 0.99 | 0.26 | 0.90 us | 0.77 us | 1.0 | 1.23 us (80%) | 0.31 us | 0.20 us | ModelManagerHandle.derivesFrom x1.0 | core 61.7%, glue 31.3%, other 6.7%, gc 0.2% |
| 52 | dcs_decorate | core-test-data | Introspection | 1.14 | 1.13 | 0.48 | 48.55 ms | 42.62 ms | 85.0 | 46.01 ms (92%) | 4.12 ms | 20.44 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, modelFileIsCompatibleVersion x39.0 | core 80.6%, gc 8.4%, glue 6.4%, views 2.8% |
| 53 | dcs_decorate | synthetic-large | Introspection | 1.11 | 1.12 | 0.56 | 74.81 ms | 67.23 ms | 19.0 | 74.69 ms (98%) | 1.52 ms | 37.51 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 83.9%, gc 8.5%, glue 5.1%, views 1.4% |
| 54 | validate | core-test-data | Validation | 1.07 | 1.13 | 0.40 | 18.9 us | 17.6 us | 1.0 | 11.3 us (47%) | 12.8 us | 7.05 us | ModelManagerHandle.validateResourceBinary x1.0 | core 55.7%, ts-core 34.8%, encode 4%, other 3.7% |
| 55 | dcs_decorate | conformance | Introspection | 1.04 | 1.02 | 0.35 | 22.69 ms | 21.81 ms | 99.0 | 18.03 ms (87%) | 2.73 ms | 7.72 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, modelFileIsCompatibleVersion x46.0 | core 75.6%, gc 9.5%, glue 7.2%, views 5.5% |
| 56 | from_json | core-test-data | Serialisation | 1.02 | 1.03 | 0.29 | 60.0 us | 58.9 us | 1.0 | 43.4 us (60%) | 29.4 us | 17.0 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 57.2%, encode 27.1%, glue 4.2%, ts-core 3.2% |
| 57 | get_decorators | core-test-data | Introspection | 1.01 | 0.71 | 0.03 | 0.16 us | 0.16 us | 0.0 | 0.00 us (0%) | 0.11 us | 0.00 us |  | other 98.9%, gc 0.8%, views 0.3% |
| 58 | get_decorators | synthetic-large | Introspection | 1.01 | 1.02 | 0.21 | 0.02 us | 0.02 us | 0.0 | 0.00 us (0%) | 0.12 us | 0.01 us |  | other 99.1%, gc 0.7%, views 0.1% |
| 59 | is_assignable_to | core-test-data | Introspection | 1.00 | 1.02 | 0.25 | 1.13 us | 1.13 us | 1.0 | 1.30 us (77%) | 0.39 us | 0.28 us | ModelManagerHandle.isAssignableTo x1.0 | core 71.2%, other 27.1%, glue 1.4%, gc 0.2% |

## checkAstShape share of the TS-API wall time (count run)

The `ModelManagerHandle.checkAstShape` binding per item and its share of the count run's wall time, at the P5-60 head and now. Rows where neither side calls it are left out.

| op | set | P5-60 calls/item | P5-60 us/item | P5-60 share | now calls/item | now us/item | now share |
|---|---|---:|---:|---:|---:|---:|---:|
| dcs_decorate | core-test-data | 1.0 | 1.14 ms | 2% | 1.0 | 1.29 ms | 3% |
| dcs_decorate | conformance | 1.0 | 466.2 us | 2% | 1.0 | 448.6 us | 2% |
| dcs_decorate | synthetic-large | 1.0 | 2.61 ms | 3% | 1.0 | 2.64 ms | 3% |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | P5-60 x TS on | crossings on / off | checkAstShape us/item |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 536.8 us | 300.4 us | 333.6 us | -33.25 us | 0.90 | 0.56 | 0.62 | 0.52 | 8.0 / 8.0 | - |
| modelfile_new | core-test-data | 27.5 us | 136.0 us | 124.9 us | 11.1 us | 1.09 | 4.95 | 4.54 | 5.57 | 2.0 / 2.0 | - |
| modelfile_new | conformance | 9.78 us | 70.9 us | 53.5 us | 17.4 us | 1.33 | 7.25 | 5.47 | 7.55 | 2.0 / 2.0 | - |
| modelfile_new | synthetic-large | 733.5 us | 3.28 ms | 2.95 ms | 337.8 us | 1.11 | 4.48 | 4.02 | 5.87 | 2.0 / 2.0 | - |
| add_model_file | core-test-data | 72.7 us | 153.6 us | 139.7 us | 14.0 us | 1.10 | 2.11 | 1.92 | 4.61 | 3.2 / 3.2 | - |
| add_model_file | conformance | 27.4 us | 99.2 us | 81.2 us | 18.0 us | 1.22 | 3.62 | 2.96 | 7.78 | 3.2 / 3.2 | - |
| add_model_file | synthetic-large | 2.42 ms | 9.31 ms | 9.06 ms | 252.4 us | 1.03 | 3.84 | 3.73 | 4.34 | 11.0 / 11.0 | - |
| add_cto_model | core-test-data | 473.1 us | 1.23 ms | 1.14 ms | 89.9 us | 1.08 | 2.60 | 2.41 | 2.71 | 3.2 / 3.2 | - |
| add_cto_model | conformance | 169.4 us | 519.8 us | 504.8 us | 15.1 us | 1.03 | 3.07 | 2.98 | 3.12 | 3.2 / 3.2 | - |
| add_cto_model | synthetic-large | 23.45 ms | 41.68 ms | 30.33 ms | 11.35 ms | 1.37 | 1.78 | 1.29 | 1.63 | 11.0 / 11.0 | - |
