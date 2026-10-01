Rounds: now 1, 2, 3, P5-60 1, 2, 3, pre-F1 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).

## Rows at or below TS 5.0.0

| level | pre-F1 | P5-60 | **now** |
|---|---:|---:|---:|
| TS API (of 73) | 5 | 17 | **19** |
| crate (of 57) | 38 | 45 | **45** |

## Geometric mean of x TS by category

| category | rows | TS API: pre-F1 | P5-60 | **now** | crate: pre-F1 | P5-60 | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 4.48 | 7.32 | **3.68** | 0.93 | 0.31 | **0.33** |
| Introspection (including decorators/DCS) | 45 | 4.56 | 1.87 | **1.48** | 0.55 | 0.30 | **0.31** |
| Serialisation | 6 | 3.10 | 2.04 | **1.84** | 0.59 | 0.52 | **0.53** |
| Instance creation | 3 | 7.06 | 1.72 | **1.68** | 0.35 | 0.36 | **0.35** |
| Validation | 9 | 2.55 | 2.10 | **2.05** | 0.63 | 0.61 | **0.57** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 448.5 us | 0.02 | 0.00 | **0.00** | 1.23 | 0.74 | **1.26** | 566.9 us | 10.0 | 37% |
| modelfile_new | core-test-data | 26.8 us | 1.79 | 1.13 | **1.28** | 8.42 | 18.79 | **5.37** | 143.8 us | 2.0 | 77% |
| modelfile_new | conformance | 9.33 us | 1.62 | 1.77 | **1.76** | 8.69 | 22.36 | **7.42** | 69.2 us | 2.0 | 66% |
| modelfile_new | synthetic-large | 745.8 us | 2.66 | 1.58 | **2.09** | 5.93 | 29.95 | **6.46** | 4.81 ms | 2.0 | 85% |
| add_model_file | core-test-data | 70.5 us | 3.83 | 0.78 | **0.90** | 5.65 | 9.17 | **4.93** | 348.0 us | 3.3 | 69% |
| add_model_file | conformance | 33.7 us | 4.33 | 0.69 | **0.65** | 10.80 | 11.47 | **5.78** | 195.0 us | 3.2 | 62% |
| add_model_file | synthetic-large | 2.57 ms | 1.64 | 0.83 | **0.96** | 3.96 | 12.28 | **3.33** | 8.56 ms | 13.0 | 80% |
| add_cto_model | core-test-data | 453.6 us | 0.60 | 0.12 | **0.14** | 3.18 | 3.23 | **2.91** | 1.32 ms | 3.3 | 26% |
| add_cto_model | conformance | 157.3 us | 0.93 | 0.15 | **0.14** | 4.45 | 3.84 | **3.02** | 475.2 us | 3.2 | 25% |
| add_cto_model | synthetic-large | 22.32 ms | 0.19 | 0.10 | **0.11** | 1.79 | 2.98 | **1.68** | 37.52 ms | 13.0 | 20% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.40 us | 0.19 | 0.19 | **0.20** | 6.36 | 2.19 | **1.37** | 0.55 us | 0.0 | 0% |
| get_type | conformance | 0.54 us | 0.17 | 0.16 | **0.15** | 4.97 | 1.32 | **0.80** | 0.43 us | 0.0 | 0% |
| get_type | synthetic-large | 0.53 us | 0.14 | 0.16 | **0.16** | 2.27 | 1.28 | **0.88** | 0.46 us | 0.0 | 0% |
| get_type_first | core-test-data | 0.40 us | - | - | - | 6.03 | 2.83 | **2.87** | 1.16 us | 1.0 | 38% |
| get_type_first | conformance | 0.54 us | - | - | - | 4.84 | 2.30 | **2.29** | 1.23 us | 1.0 | 50% |
| get_type_first | synthetic-large | 0.53 us | - | - | - | 2.65 | 2.78 | **2.41** | 1.27 us | 1.0 | 50% |
| resolve_type | core-test-data | 0.29 us | 0.20 | 0.21 | **0.20** | 7.67 | 0.45 | **0.43** | 0.13 us | 0.0 | 0% |
| resolve_type | conformance | 0.39 us | 0.16 | 0.16 | **0.16** | 6.02 | 0.34 | **0.35** | 0.13 us | 0.0 | 0% |
| resolve_type | synthetic-large | 0.29 us | 0.20 | 0.20 | **0.21** | 2.38 | 0.11 | **0.07** | 0.02 us | 0.0 | 0% |
| resolve_type_first | core-test-data | 0.31 us | - | - | - | 6.47 | 3.87 | **3.30** | 1.01 us | 1.0 | 64% |
| resolve_type_first | conformance | 0.37 us | - | - | - | 6.27 | 2.05 | **2.04** | 0.75 us | 1.0 | 38% |
| resolve_type_first | synthetic-large | 0.37 us | - | - | - | 3.39 | 2.11 | **2.11** | 0.79 us | 1.0 | 66% |
| get_namespaces | core-test-data | 0.84 us | 1.36 | 1.57 | **1.70** | 11.37 | 0.34 | **0.36** | 0.30 us | 0.0 | 0% |
| get_namespaces | conformance | 0.86 us | 1.46 | 1.39 | **1.41** | 12.05 | 0.31 | **0.33** | 0.29 us | 0.0 | 0% |
| get_namespaces | synthetic-large | 0.14 us | 0.52 | 0.49 | **0.51** | 7.36 | 1.91 | **1.94** | 0.27 us | 0.0 | 0% |
| get_namespaces_first | core-test-data | 1.45 us | - | - | - | 11.36 | 7.48 | **9.61** | 14.0 us | 1.0 | 95% |
| get_namespaces_first | conformance | 0.86 us | - | - | - | 22.20 | 13.62 | **13.49** | 11.6 us | 1.0 | 95% |
| get_namespaces_first | synthetic-large | 0.14 us | - | - | - | 14.14 | 13.88 | **14.00** | 1.98 us | 1.0 | 67% |
| derives_from | core-test-data | 0.94 us | 0.21 | 0.19 | **0.21** | 4.40 | 1.19 | **1.13** | 1.07 us | 1.0 | 78% |
| derives_from | conformance | 1.07 us | 0.17 | 0.17 | **0.17** | 3.83 | 0.65 | **0.80** | 0.85 us | 1.0 | 81% |
| derives_from | synthetic-large | 1.01 us | 0.19 | 0.19 | **0.20** | 1.66 | 0.89 | **0.72** | 0.73 us | 1.0 | 80% |
| is_assignable_to | core-test-data | 1.79 us | 0.14 | 0.14 | **0.14** | 2.19 | 0.92 | **0.69** | 1.23 us | 1.0 | 51% |
| is_assignable_to | conformance | 1.96 us | 0.14 | 0.13 | **0.14** | 1.11 | 0.39 | **0.37** | 0.73 us | 1.0 | 27% |
| is_assignable_to | synthetic-large | 1.80 us | 0.14 | 0.15 | **0.16** | 0.51 | 0.43 | **0.44** | 0.79 us | 1.0 | 80% |
| get_decorators | core-test-data | 0.14 us | 0.03 | 0.03 | **0.03** | 1.07 | 0.87 | **1.09** | 0.15 us | 0.0 | 0% |
| get_decorators | conformance | 0.08 us | 0.04 | 0.04 | **0.04** | 0.98 | 1.34 | **1.02** | 0.09 us | 0.0 | 0% |
| get_decorators | synthetic-large | 0.03 us | 0.16 | 0.17 | **0.16** | 1.06 | 1.00 | **1.05** | 0.03 us | 0.0 | 0% |
| dcs_decorate | core-test-data | 38.67 ms | 1.97 (rebuild 2.13) | 0.54 (rebuild 0.65) | **0.54** (rebuild 0.70) | 2.23 | 1.59 | **1.06** | 41.09 ms | 89.0 | 94% |
| dcs_decorate | conformance | 23.93 ms | 1.78 (rebuild 1.89) | 0.35 (rebuild 0.46) | **0.37** (rebuild 0.43) | 1.99 | 1.18 | **0.75** | 18.06 ms | 103.0 | 87% |
| dcs_decorate | synthetic-large | 62.00 ms | 0.72 (rebuild 0.92) | 0.50 (rebuild 0.68) | **0.53** (rebuild 0.68) | 1.41 | 1.62 | **1.15** | 71.32 ms | 23.0 | 99% |
| dcs_validate | core-test-data | 36.21 ms | 0.31 (rebuild 0.37) | 0.23 (rebuild 0.29) | **0.23** (rebuild 0.30) | 1.00 | 0.63 | **0.75** | 27.13 ms | 53.0 | 87% |
| dcs_validate | conformance | 20.70 ms | 0.30 (rebuild 0.39) | 0.20 (rebuild 0.28) | **0.22** (rebuild 0.25) | 1.27 | 0.69 | **0.65** | 13.55 ms | 60.0 | 75% |
| dcs_validate | synthetic-large | 54.00 ms | 0.31 (rebuild 0.40) | 0.24 (rebuild 0.29) | **0.26** (rebuild 0.31) | 0.94 | 0.61 | **0.84** | 45.40 ms | 20.0 | 89% |
| extract_decorators | core-test-data | 7.13 ms | 17.46 (rebuild 18.11) | 1.04 (rebuild 1.65) | **1.10** (rebuild 1.74) | 13.62 | 3.60 | **2.09** | 14.91 ms | 88.0 | 86% |
| extract_decorators | conformance | 3.18 ms | 17.65 (rebuild 18.53) | 0.94 (rebuild 1.52) | **0.88** (rebuild 1.48) | 14.40 | 6.18 | **3.02** | 9.61 ms | 102.0 | 71% |
| extract_decorators | synthetic-large | 8.98 ms | 4.16 (rebuild 5.01) | 1.41 (rebuild 2.34) | **1.31** (rebuild 2.25) | 6.98 | 5.10 | **2.27** | 20.35 ms | 22.0 | 91% |
| extract_vocabularies | core-test-data | 6.56 ms | 19.41 (rebuild 20.43) | 1.12 (rebuild 1.67) | **1.13** (rebuild 1.89) | 14.59 | 6.12 | **3.50** | 22.94 ms | 88.0 | 87% |
| extract_vocabularies | conformance | 2.54 ms | 21.79 (rebuild 22.43) | 1.16 (rebuild 1.65) | **1.12** (rebuild 1.85) | 18.24 | 7.21 | **4.03** | 10.25 ms | 102.0 | 77% |
| extract_vocabularies | synthetic-large | 8.87 ms | 4.11 (rebuild 5.26) | 1.37 (rebuild 2.10) | **1.39** (rebuild 2.33) | 7.94 | 8.29 | **3.33** | 29.54 ms | 22.0 | 95% |
| extract_cold | core-test-data | 7.78 ms | - | - | - | 12.67 | 3.96 | **3.60** | 27.97 ms | 88.0 | 91% |
| extract_cold | conformance | 3.84 ms | - | - | - | 13.17 | 4.67 | **3.58** | 13.74 ms | 102.0 | 64% |
| extract_cold | synthetic-large | 10.66 ms | - | - | - | 6.13 | 6.84 | **3.45** | 36.76 ms | 22.0 | 91% |
| extract_keep | core-test-data | 7.23 ms | - | - | - | 14.26 | 6.29 | **3.22** | 23.26 ms | 88.0 | 93% |
| extract_keep | conformance | 3.46 ms | - | - | - | 13.95 | 8.04 | **3.39** | 11.70 ms | 102.0 | 67% |
| extract_keep | synthetic-large | 9.28 ms | - | - | - | 9.10 | 12.37 | **4.72** | 43.78 ms | 22.0 | 98% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 50.9 us | 0.51 | 0.35 | **0.34** | 2.70 | 1.27 | **1.04** | 53.1 us | 1.0 | 61% |
| from_json | conformance | 13.7 us | 0.29 | 0.26 | **0.26** | 3.96 | 1.26 | **1.06** | 14.6 us | 1.0 | 43% |
| from_json | synthetic-large | 17.4 us | 0.61 | 0.49 | **0.52** | 3.04 | 1.42 | **1.31** | 22.7 us | 1.0 | 70% |
| to_json | core-test-data | 30.4 us | 0.78 | 0.82 | **0.71** | 2.49 | 2.51 | **2.34** | 71.1 us | 1.0 | 68% |
| to_json | conformance | 7.56 us | 0.46 | 0.47 | **0.50** | 2.88 | 2.85 | **2.69** | 20.3 us | 1.0 | 68% |
| to_json | synthetic-large | 8.60 us | 1.23 | 1.17 | **1.35** | 3.81 | 4.50 | **4.26** | 36.6 us | 1.0 | 76% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 6.06 us | - | - | - | 8.56 | 2.06 | **2.08** | 12.6 us | 4.6 | 33% |
| new_resource | conformance | 4.24 us | 0.27 | 0.28 | **0.30** | 10.62 | 1.44 | **1.29** | 5.47 us | 3.2 | 33% |
| new_resource | synthetic-large | 2.93 us | 0.47 | 0.47 | **0.41** | 3.87 | 1.72 | **1.75** | 5.14 us | 3.0 | 32% |

### Validation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 24.5 us | 0.28 | 0.30 | **0.31** | 1.03 | 0.82 | **0.72** | 17.6 us | 1.0 | 44% |
| validate | conformance | 6.09 us | 0.23 | 0.24 | **0.22** | 0.92 | 1.36 | **0.94** | 5.73 us | 1.0 | 22% |
| validate | synthetic-large | 8.10 us | 0.50 | 0.38 | **0.38** | 1.29 | 0.84 | **0.79** | 6.40 us | 1.0 | 61% |
| set_property_value | core-test-data | 1.96 us | 0.76 | 0.65 | **0.61** | 1.86 | 1.76 | **1.78** | 3.49 us | 1.1 | 36% |
| set_property_value | conformance | 0.61 us | 0.81 | 0.87 | **0.70** | 4.93 | 4.74 | **7.50** | 4.58 us | 1.1 | 17% |
| set_property_value | synthetic-large | 0.73 us | 1.04 | 0.87 | **0.97** | 3.41 | 2.51 | **2.43** | 1.78 us | 1.0 | 38% |
| add_array_value | core-test-data | 15.7 us | 0.67 | 0.69 | **0.67** | 6.03 | 2.61 | **2.61** | 41.1 us | 15.7 | 33% |
| add_array_value | conformance | 1.05 us | 0.85 | 0.77 | **0.88** | 6.87 | 4.93 | **4.90** | 5.16 us | 1.0 | 21% |
| add_array_value | synthetic-large | 0.91 us | 1.39 | 1.57 | **1.05** | 2.95 | 3.14 | **2.83** | 2.57 us | 1.0 | 43% |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.

| # | op | set | category | x TS API | P5-60 | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | get_namespaces_first | synthetic-large | Introspection | 14.00 | 13.88 | - | 1.98 us | 0.14 us | 1.0 | 1.40 us (67%) | 0.67 us | - | ModelManagerHandle.getNamespaces x1.0 | other 50.6%, glue 25.3%, core 13.6%, ts-core 6.8% |
| 2 | get_namespaces_first | conformance | Introspection | 13.49 | 13.62 | - | 11.6 us | 0.86 us | 1.0 | 11.9 us (95%) | 0.60 us | - | ModelManagerHandle.getNamespaces x1.0 | other 50%, glue 27.7%, core 19.3%, gc 2.1% |
| 3 | get_namespaces_first | core-test-data | Introspection | 9.61 | 7.48 | - | 14.0 us | 1.45 us | 1.0 | 20.5 us (95%) | 1.03 us | - | ModelManagerHandle.getNamespaces x1.0 | other 51.6%, glue 27%, core 18.4%, gc 2% |
| 4 | set_property_value | conformance | Validation | 7.50 | 4.74 | 0.70 | 4.58 us | 0.61 us | 1.1 | 1.92 us (17%) | 9.27 us | 0.43 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileGetTypeName x0.0 | ts-core 39.9%, core 24.3%, glue 10.9%, encode 10.2% |
| 5 | modelfile_new | conformance | Model | 7.42 | 22.36 | 1.76 | 69.2 us | 9.33 us | 2.0 | 72.2 us (66%) | 37.1 us | 16.4 us | ModelManagerHandle.stageModelFileChecked x1.0, modelFileIsCompatibleVersion x1.0 | core 57.1%, views 26.3%, glue 9.3%, gc 5.8% |
| 6 | modelfile_new | synthetic-large | Model | 6.46 | 29.95 | 2.09 | 4.81 ms | 745.8 us | 2.0 | 3.70 ms (85%) | 646.8 us | 1.56 ms | ModelManagerHandle.stageModelFileChecked x1.0, modelFileIsCompatibleVersion x1.0 | core 62.5%, glue 13.8%, views 12.5%, gc 10.9% |
| 7 | add_model_file | conformance | Model | 5.78 | 11.47 | 0.65 | 195.0 us | 33.7 us | 3.2 | 79.9 us (62%) | 48.0 us | 22.1 us | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | core 49.6%, gc 21.9%, views 20.7%, glue 5.1% |
| 8 | modelfile_new | core-test-data | Model | 5.37 | 18.79 | 1.28 | 143.8 us | 26.8 us | 2.0 | 165.0 us (77%) | 50.6 us | 34.3 us | ModelManagerHandle.stageModelFileChecked x1.0, modelFileIsCompatibleVersion x1.0 | core 62.2%, views 21.7%, glue 10.9%, gc 3.8% |
| 9 | add_model_file | core-test-data | Model | 4.93 | 9.17 | 0.90 | 348.0 us | 70.5 us | 3.3 | 152.9 us (69%) | 69.5 us | 63.4 us | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | core 51.3%, gc 26%, views 15.5%, glue 5.1% |
| 10 | add_array_value | conformance | Validation | 4.90 | 4.93 | 0.88 | 5.16 us | 1.05 us | 1.0 | 1.30 us (21%) | 4.76 us | 0.93 us | ModelManagerHandle.validatePropertyBinary x1.0 | ts-core 40.4%, encode 21.2%, core 16.5%, glue 13.3% |
| 11 | extract_keep | synthetic-large | Introspection | 4.72 | 12.37 | - | 43.78 ms | 9.28 ms | 22.0 | 34.82 ms (98%) | 697.1 us | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 49.9%, gc 27.6%, glue 14.2%, other 5.8% |
| 12 | to_json | synthetic-large | Serialisation | 4.26 | 4.50 | 1.35 | 36.6 us | 8.60 us | 1.0 | 29.9 us (76%) | 9.65 us | 11.6 us | ModelManagerHandle.serializerToJson x1.0 | core 69.2%, encode 16.7%, glue 6%, decode 5.5% |
| 13 | extract_vocabularies | conformance | Introspection | 4.03 | 7.21 | 1.12 | 10.25 ms | 2.54 ms | 102.0 | 8.51 ms (77%) | 2.60 ms | 2.84 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, modelFileIsCompatibleVersion x46.0 | core 53.1%, gc 27.8%, views 10.9%, glue 4.4% |
| 14 | extract_cold | core-test-data | Introspection | 3.60 | 3.96 | - | 27.97 ms | 7.78 ms | 88.0 | 14.10 ms (91%) | 1.41 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, modelFileIsCompatibleVersion x39.0 | core 55.6%, gc 33.7%, glue 5.2%, views 3.6% |
| 15 | extract_cold | conformance | Introspection | 3.58 | 4.67 | - | 13.74 ms | 3.84 ms | 102.0 | 5.97 ms (64%) | 3.31 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, modelFileIsCompatibleVersion x46.0 | core 64%, gc 20.8%, views 7.4%, glue 5.5% |
| 16 | extract_vocabularies | core-test-data | Introspection | 3.50 | 6.12 | 1.13 | 22.94 ms | 6.56 ms | 88.0 | 18.08 ms (87%) | 2.70 ms | 7.40 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 63.7%, gc 21.4%, glue 6.8%, views 5.3% |
| 17 | extract_cold | synthetic-large | Introspection | 3.45 | 6.84 | - | 36.76 ms | 10.66 ms | 22.0 | 18.49 ms (91%) | 1.81 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 48.5%, gc 44.5%, glue 4%, views 1.5% |
| 18 | extract_keep | conformance | Introspection | 3.39 | 8.04 | - | 11.70 ms | 3.46 ms | 102.0 | 6.17 ms (67%) | 2.97 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, modelFileIsCompatibleVersion x46.0 | core 37.9%, gc 26%, views 17.2%, glue 11.7% |
| 19 | add_model_file | synthetic-large | Model | 3.33 | 12.28 | 0.96 | 8.56 ms | 2.57 ms | 13.0 | 5.01 ms (80%) | 1.28 ms | 2.47 ms | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.stageModelFileWithHeader x2.0 | core 60%, gc 20.6%, views 11.5%, glue 6.8% |
| 20 | extract_vocabularies | synthetic-large | Introspection | 3.33 | 8.29 | 1.39 | 29.54 ms | 8.87 ms | 22.0 | 29.00 ms (95%) | 1.58 ms | 12.29 ms | ModelManagerHandle.dcsExtractVocabularies x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 66.6%, gc 23.1%, glue 6.6%, views 2.1% |
| 21 | resolve_type_first | core-test-data | Introspection | 3.30 | 3.87 | - | 1.01 us | 0.31 us | 1.0 | 0.98 us (64%) | 0.56 us | - | ModelManagerHandle.resolveType x1.0 | glue 32.9%, core 28.6%, other 26.5%, ts-core 10.9% |
| 22 | extract_keep | core-test-data | Introspection | 3.22 | 6.29 | - | 23.26 ms | 7.23 ms | 88.0 | 14.85 ms (93%) | 1.11 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 41.9%, glue 23.5%, gc 21.4%, other 7.4% |
| 23 | add_cto_model | conformance | Model | 3.02 | 3.84 | 0.14 | 475.2 us | 157.3 us | 3.2 | 76.8 us (25%) | 225.0 us | 22.1 us | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | cto-parser 43.9%, core 24%, gc 13.7%, views 12.4% |
| 24 | extract_decorators | conformance | Introspection | 3.02 | 6.18 | 0.88 | 9.61 ms | 3.18 ms | 102.0 | 6.08 ms (71%) | 2.54 ms | 2.81 ms | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x41.0 | core 52.2%, gc 24%, views 11%, glue 8.7% |
| 25 | add_cto_model | core-test-data | Model | 2.91 | 3.23 | 0.14 | 1.32 ms | 453.6 us | 3.3 | 165.4 us (26%) | 478.9 us | 63.4 us | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x1.1 | cto-parser 44.4%, core 25.3%, gc 17.8%, views 8.1% |
| 26 | get_type_first | core-test-data | Introspection | 2.87 | 2.83 | - | 1.16 us | 0.40 us | 1.0 | 0.82 us (38%) | 1.33 us | - | ModelManagerHandle.getTypeName x1.0 | views 23.4%, ts-core 20%, glue 19.4%, other 18.5% |
| 27 | add_array_value | synthetic-large | Validation | 2.83 | 3.14 | 1.05 | 2.57 us | 0.91 us | 1.0 | 1.49 us (43%) | 1.94 us | 0.96 us | ModelManagerHandle.validatePropertyBinary x1.0 | core 32.8%, glue 26.2%, ts-core 23.2%, views 8.7% |
| 28 | to_json | conformance | Serialisation | 2.69 | 2.85 | 0.50 | 20.3 us | 7.56 us | 1.0 | 19.9 us (68%) | 9.32 us | 3.75 us | ModelManagerHandle.serializerToJson x1.0 | core 60.9%, encode 17.9%, ts-core 8.2%, glue 6.1% |
| 29 | add_array_value | core-test-data | Validation | 2.61 | 2.61 | 0.67 | 41.1 us | 15.7 us | 15.7 | 17.1 us (33%) | 34.1 us | 10.5 us | modelUtilIsAssignableTo x1.5, resourceValidatorPrimitiveValid x7.2, ModelManagerHandle.modelFileGetTypeName x2.1 | ts-core 32.6%, views 17.1%, glue 16.3%, encode 14% |
| 30 | set_property_value | synthetic-large | Validation | 2.43 | 2.51 | 0.97 | 1.78 us | 0.73 us | 1.0 | 0.79 us (38%) | 1.26 us | 0.71 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8 | ts-core 34.6%, core 33.2%, glue 13.2%, views 11.9% |
| 31 | get_type_first | synthetic-large | Introspection | 2.41 | 2.78 | - | 1.27 us | 0.53 us | 1.0 | 0.82 us (50%) | 0.82 us | - | ModelManagerHandle.getTypeName x1.0 | views 30.5%, glue 20.3%, ts-core 18%, core 15.4% |
| 32 | to_json | core-test-data | Serialisation | 2.34 | 2.51 | 0.71 | 71.1 us | 30.4 us | 1.0 | 47.4 us (68%) | 22.7 us | 21.6 us | ModelManagerHandle.serializerToJson x1.0 | core 65.2%, encode 19.8%, decode 6.3%, glue 3.9% |
| 33 | get_type_first | conformance | Introspection | 2.29 | 2.30 | - | 1.23 us | 0.54 us | 1.0 | 0.70 us (50%) | 0.71 us | - | ModelManagerHandle.getTypeName x1.0 | views 26%, ts-core 24.3%, glue 19.1%, core 17% |
| 34 | extract_decorators | synthetic-large | Introspection | 2.27 | 5.10 | 1.31 | 20.35 ms | 8.98 ms | 22.0 | 21.24 ms (91%) | 1.99 ms | 11.77 ms | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x1.0 | core 68%, glue 14.5%, gc 10.9%, views 4% |
| 35 | resolve_type_first | synthetic-large | Introspection | 2.11 | 2.11 | - | 0.79 us | 0.37 us | 1.0 | 0.81 us (66%) | 0.42 us | - | ModelManagerHandle.resolveType x1.0 | glue 36.7%, core 26.5%, other 23.1%, ts-core 12.4% |
| 36 | extract_decorators | core-test-data | Introspection | 2.09 | 3.60 | 1.10 | 14.91 ms | 7.13 ms | 88.0 | 11.71 ms (86%) | 1.93 ms | 7.87 ms | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0, ModelManagerHandle.commitStagedModelFile x34.0 | core 63.9%, glue 11.9%, gc 11.8%, views 9% |
| 37 | new_resource | core-test-data | Instance | 2.08 | 2.06 | - | 12.6 us | 6.06 us | 4.6 | 6.63 us (33%) | 13.3 us | - | ModelManagerHandle.modelFileGetTypeName x1.7, classDeclarationIsKind x1.9, ModelManagerHandle.modelFileResolveType x0.7 | ts-core 31.3%, views 25%, glue 20.9%, core 11.7% |
| 38 | resolve_type_first | conformance | Introspection | 2.04 | 2.05 | - | 0.75 us | 0.37 us | 1.0 | 1.25 us (38%) | 2.05 us | - | ModelManagerHandle.resolveType x1.0 | glue 31.4%, core 30.4%, other 18.9%, ts-core 18% |
| 39 | get_namespaces | synthetic-large | Introspection | 1.94 | 1.91 | 0.51 | 0.27 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.27 us | 0.07 us |  | other 83.2%, ts-core 13.8%, gc 3%, glue 0% |
| 40 | set_property_value | core-test-data | Validation | 1.78 | 1.76 | 0.61 | 3.49 us | 1.96 us | 1.1 | 2.47 us (36%) | 4.33 us | 1.19 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileGetTypeName x0.0 | ts-core 33.7%, core 31.7%, views 12.8%, other 8.3% |
| 41 | new_resource | synthetic-large | Instance | 1.75 | 1.72 | 0.41 | 5.14 us | 2.93 us | 3.0 | 2.16 us (32%) | 4.50 us | 1.22 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.0 | ts-core 37.9%, glue 23.8%, views 20.9%, core 10.3% |
| 42 | add_cto_model | synthetic-large | Model | 1.68 | 2.98 | 0.11 | 37.52 ms | 22.32 ms | 13.0 | 7.01 ms (20%) | 27.62 ms | 2.47 ms | ModelManagerHandle.stageModelFileChecked x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.stageModelFileWithHeader x2.0 | cto-parser 66.1%, core 16.3%, gc 9.6%, views 4.7% |
| 43 | get_type | core-test-data | Introspection | 1.37 | 2.19 | 0.20 | 0.55 us | 0.40 us | 0.0 | 0.00 us (0%) | 1.39 us | 0.08 us |  | views 54.3%, ts-core 37.3%, other 7.3%, gc 1% |
| 44 | from_json | synthetic-large | Serialisation | 1.31 | 1.42 | 0.52 | 22.7 us | 17.4 us | 1.0 | 16.7 us (70%) | 7.24 us | 8.99 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 64.4%, encode 24.6%, glue 5.5%, other 1.8% |
| 45 | new_resource | conformance | Instance | 1.29 | 1.44 | 0.30 | 5.47 us | 4.24 us | 3.2 | 2.83 us (33%) | 5.81 us | 1.28 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 | views 29.3%, glue 26.2%, ts-core 25.2%, core 10.7% |
| 46 | mm_new | (system) | Model | 1.26 | 0.74 | 0.00 | 566.9 us | 448.5 us | 10.0 | 232.5 us (37%) | 390.7 us | 1.28 us | ModelManagerHandle.stageModelFileWithHeader x2.0, new ModelManagerHandle x1.0, modelFileIsCompatibleVersion x3.0 | views 57.2%, core 20.6%, gc 8.7%, ts-core 7% |
| 47 | dcs_decorate | synthetic-large | Introspection | 1.15 | 1.62 | 0.53 | 71.32 ms | 62.00 ms | 23.0 | 60.77 ms (99%) | 862.4 us | 33.00 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 82.4%, gc 10%, glue 5.1%, views 1.4% |
| 48 | derives_from | core-test-data | Introspection | 1.13 | 1.19 | 0.21 | 1.07 us | 0.94 us | 1.0 | 0.93 us (78%) | 0.26 us | 0.20 us | ModelManagerHandle.derivesFrom x1.0 | core 61.3%, glue 20%, other 18.3%, gc 0.3% |
| 49 | get_decorators | core-test-data | Introspection | 1.09 | 0.87 | 0.03 | 0.15 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.13 us | 0.00 us |  | other 98.9%, gc 0.9%, views 0.2% |
| 50 | dcs_decorate | core-test-data | Introspection | 1.06 | 1.59 | 0.54 | 41.09 ms | 38.67 ms | 89.0 | 37.84 ms (94%) | 2.56 ms | 20.70 ms | ModelManagerHandle.dcsDecorateModels x1.0, modelFileIsCompatibleVersion x39.0, ModelManagerHandle.checkAstShape x1.0 | core 80.9%, gc 9.5%, glue 5.5%, views 2.4% |
| 51 | from_json | conformance | Serialisation | 1.06 | 1.26 | 0.26 | 14.6 us | 13.7 us | 1.0 | 10.5 us (43%) | 13.9 us | 3.58 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 52.6%, encode 27.6%, ts-core 8.6%, glue 5.2% |
| 52 | get_decorators | synthetic-large | Introspection | 1.05 | 1.00 | 0.16 | 0.03 us | 0.03 us | 0.0 | 0.00 us (0%) | 0.11 us | 0.00 us |  | other 99.6%, gc 0.4%, views 0% |
| 53 | from_json | core-test-data | Serialisation | 1.04 | 1.27 | 0.34 | 53.1 us | 50.9 us | 1.0 | 35.7 us (61%) | 22.7 us | 17.2 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 61%, encode 26.6%, glue 4.4%, ts-core 2.6% |
| 54 | get_decorators | conformance | Introspection | 1.02 | 1.34 | 0.04 | 0.09 us | 0.08 us | 0.0 | 0.00 us (0%) | 0.20 us | 0.00 us |  | other 99.1%, gc 0.7%, views 0.2% |

## checkAstShape share of the TS-API wall time (count run)

The `ModelManagerHandle.checkAstShape` binding per item and its share of the count run's wall time, at the P5-60 head and now. Rows where neither side calls it are left out.

| op | set | P5-60 calls/item | P5-60 us/item | P5-60 share | now calls/item | now us/item | now share |
|---|---|---:|---:|---:|---:|---:|---:|
| modelfile_new | core-test-data | 1.0 | 385.8 us | 70% | 0.0 | 0.00 us | 0% |
| modelfile_new | conformance | 1.0 | 143.4 us | 61% | 0.0 | 0.00 us | 0% |
| modelfile_new | synthetic-large | 1.0 | 19.25 ms | 88% | 0.0 | 0.00 us | 0% |
| add_model_file | core-test-data | 1.0 | 321.5 us | 62% | 0.0 | 0.00 us | 0% |
| add_model_file | conformance | 1.0 | 153.1 us | 58% | 0.0 | 0.00 us | 0% |
| add_model_file | synthetic-large | 1.0 | 19.35 ms | 83% | 0.0 | 0.00 us | 0% |
| add_cto_model | core-test-data | 1.0 | 367.7 us | 35% | 0.0 | 0.00 us | 0% |
| add_cto_model | conformance | 1.0 | 91.2 us | 23% | 0.0 | 0.00 us | 0% |
| add_cto_model | synthetic-large | 1.0 | 25.08 ms | 43% | 0.0 | 0.00 us | 0% |
| dcs_decorate | core-test-data | 34.0 | 19.86 ms | 31% | 1.0 | 853.1 us | 2% |
| dcs_decorate | conformance | 41.0 | 9.49 ms | 30% | 1.0 | 394.1 us | 2% |
| dcs_decorate | synthetic-large | 1.0 | 31.87 ms | 34% | 1.0 | 1.84 ms | 3% |
| dcs_validate | core-test-data | 1.0 | 419.5 us | 2% | 0.0 | 0.00 us | 0% |
| dcs_validate | conformance | 1.0 | 438.3 us | 3% | 0.0 | 0.00 us | 0% |
| dcs_validate | synthetic-large | 1.0 | 383.6 us | 1% | 0.0 | 0.00 us | 0% |
| extract_decorators | core-test-data | 34.0 | 10.99 ms | 40% | 0.0 | 0.00 us | 0% |
| extract_decorators | conformance | 41.0 | 5.37 ms | 35% | 0.0 | 0.00 us | 0% |
| extract_decorators | synthetic-large | 1.0 | 19.70 ms | 50% | 0.0 | 0.00 us | 0% |
| extract_vocabularies | core-test-data | 34.0 | 14.97 ms | 43% | 0.0 | 0.00 us | 0% |
| extract_vocabularies | conformance | 41.0 | 7.44 ms | 38% | 0.0 | 0.00 us | 0% |
| extract_vocabularies | synthetic-large | 1.0 | 39.50 ms | 66% | 0.0 | 0.00 us | 0% |
| extract_cold | core-test-data | 34.0 | 9.61 ms | 39% | 0.0 | 0.00 us | 0% |
| extract_cold | conformance | 41.0 | 5.19 ms | 38% | 0.0 | 0.00 us | 0% |
| extract_cold | synthetic-large | 1.0 | 20.08 ms | 49% | 0.0 | 0.00 us | 0% |
| extract_keep | core-test-data | 34.0 | 17.98 ms | 59% | 0.0 | 0.00 us | 0% |
| extract_keep | conformance | 41.0 | 8.12 ms | 48% | 0.0 | 0.00 us | 0% |
| extract_keep | synthetic-large | 1.0 | 79.50 ms | 83% | 0.0 | 0.00 us | 0% |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | P5-60 x TS on | crossings on / off | checkAstShape us/item |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 448.5 us | 566.9 us | 449.8 us | 117.1 us | 1.26 | 1.26 | 1.00 | 0.74 | 10.0 / 10.0 | - |
| modelfile_new | core-test-data | 26.8 us | 143.8 us | 129.4 us | 14.3 us | 1.11 | 5.37 | 4.83 | 18.79 | 2.0 / 2.0 | - |
| modelfile_new | conformance | 9.33 us | 69.2 us | 62.2 us | 7.03 us | 1.11 | 7.42 | 6.67 | 22.36 | 2.0 / 2.0 | - |
| modelfile_new | synthetic-large | 745.8 us | 4.81 ms | 3.87 ms | 947.6 us | 1.25 | 6.46 | 5.18 | 29.95 | 2.0 / 2.0 | - |
| add_model_file | core-test-data | 70.5 us | 348.0 us | 332.8 us | 15.1 us | 1.05 | 4.93 | 4.72 | 9.17 | 3.3 / 3.3 | - |
| add_model_file | conformance | 33.7 us | 195.0 us | 204.9 us | -9.88 us | 0.95 | 5.78 | 6.07 | 11.47 | 3.2 / 3.2 | - |
| add_model_file | synthetic-large | 2.57 ms | 8.56 ms | 10.91 ms | -2344.72 us | 0.79 | 3.33 | 4.24 | 12.28 | 13.0 / 13.0 | - |
| add_cto_model | core-test-data | 453.6 us | 1.32 ms | 1.36 ms | -37.49 us | 0.97 | 2.91 | 2.99 | 3.23 | 3.3 / 3.3 | - |
| add_cto_model | conformance | 157.3 us | 475.2 us | 526.8 us | -51.61 us | 0.90 | 3.02 | 3.35 | 3.84 | 3.2 / 3.2 | - |
| add_cto_model | synthetic-large | 22.32 ms | 37.52 ms | 37.98 ms | -456.31 us | 0.99 | 1.68 | 1.70 | 2.98 | 13.0 / 13.0 | - |
