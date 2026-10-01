Rounds: now 1, 2, 3, before 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).

### Model loading

| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 536.3 us | 0.02 | **0.00** | 1.36 | **1.46** | 783.8 us | 10.0 | 35% |
| modelfile_new | core-test-data | 50.3 us | 1.51 | **0.86** | 4.35 | **14.21** | 715.3 us | 3.0 | 91% |
| modelfile_new | conformance | 16.1 us | 2.30 | **1.37** | 9.02 | **21.71** | 350.6 us | 3.0 | 85% |
| modelfile_new | synthetic-large | 1.15 ms | 2.36 | **1.42** | 6.92 | **27.42** | 31.54 ms | 3.0 | 97% |
| add_model_file | core-test-data | 90.1 us | 3.79 | **0.76** | 7.17 | **8.86** | 797.6 us | 4.3 | 86% |
| add_model_file | conformance | 27.0 us | 7.54 | **1.09** | 22.32 | **19.45** | 524.8 us | 4.2 | 84% |
| add_model_file | synthetic-large | 2.97 ms | 1.81 | **0.98** | 4.40 | **14.24** | 42.26 ms | 14.0 | 94% |
| add_cto_model | core-test-data | 591.7 us | 0.58 | **0.12** | 3.06 | **3.00** | 1.77 ms | 4.3 | 46% |
| add_cto_model | conformance | 173.3 us | 1.17 | **0.17** | 5.20 | **4.56** | 790.2 us | 4.2 | 41% |
| add_cto_model | synthetic-large | 26.20 ms | 0.20 | **0.11** | 2.32 | **3.81** | 99.79 ms | 14.0 | 53% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.57 us | 0.22 | **0.17** | 7.52 | **0.97** | 0.56 us | 0.0 | 0% |
| get_type | conformance | 0.64 us | 0.16 | **0.16** | 5.04 | **1.13** | 0.73 us | 0.0 | 0% |
| get_type | synthetic-large | 0.67 us | 0.14 | **0.13** | 1.95 | **0.71** | 0.47 us | 0.0 | 0% |
| get_type_first | core-test-data | 0.57 us | - | - | 7.44 | **2.54** | 1.44 us | 1.0 | 53% |
| get_type_first | conformance | 0.91 us | - | - | 6.40 | **1.50** | 1.37 us | 1.0 | 47% |
| get_type_first | synthetic-large | 0.69 us | - | - | 1.95 | **2.84** | 1.96 us | 1.0 | 44% |
| resolve_type | core-test-data | 0.35 us | 0.21 | **0.28** | 7.32 | **0.39** | 0.13 us | 0.0 | 0% |
| resolve_type | conformance | 0.39 us | 0.17 | **0.24** | 7.60 | **0.46** | 0.18 us | 0.0 | 0% |
| resolve_type | synthetic-large | 0.47 us | 0.16 | **0.14** | 1.97 | **0.04** | 0.02 us | 0.0 | 0% |
| resolve_type_first | core-test-data | 0.42 us | - | - | 6.65 | **3.04** | 1.29 us | 1.0 | 41% |
| resolve_type_first | conformance | 0.69 us | - | - | 3.26 | **1.76** | 1.20 us | 1.0 | 67% |
| resolve_type_first | synthetic-large | 0.57 us | - | - | 1.54 | **1.52** | 0.87 us | 1.0 | 70% |
| get_namespaces | core-test-data | 1.42 us | 1.05 | **0.95** | 12.71 | **0.22** | 0.31 us | 0.0 | 0% |
| get_namespaces | conformance | 1.27 us | 1.37 | **1.25** | 9.29 | **0.22** | 0.28 us | 0.0 | 0% |
| get_namespaces | synthetic-large | 0.14 us | 0.58 | **0.54** | 12.91 | **2.02** | 0.28 us | 0.0 | 0% |
| get_namespaces_first | core-test-data | 0.83 us | - | - | 18.15 | **20.53** | 17.0 us | 1.0 | 93% |
| get_namespaces_first | conformance | 0.94 us | - | - | 13.86 | **28.18** | 26.4 us | 1.0 | 95% |
| get_namespaces_first | synthetic-large | 0.15 us | - | - | 8.77 | **22.11** | 3.36 us | 1.0 | 59% |
| derives_from | core-test-data | 1.08 us | 0.20 | **0.20** | 3.20 | **1.92** | 2.07 us | 1.0 | 73% |
| derives_from | conformance | 0.96 us | 0.21 | **0.23** | 2.78 | **0.76** | 0.73 us | 1.0 | 77% |
| derives_from | synthetic-large | 1.07 us | 0.31 | **0.27** | 0.93 | **0.97** | 1.03 us | 1.0 | 58% |
| is_assignable_to | core-test-data | 1.97 us | 0.14 | **0.15** | 2.24 | **0.56** | 1.09 us | 1.0 | 80% |
| is_assignable_to | conformance | 2.09 us | 0.16 | **0.17** | 1.91 | **0.43** | 0.89 us | 1.0 | 78% |
| is_assignable_to | synthetic-large | 2.00 us | 0.18 | **0.16** | 0.59 | **0.62** | 1.25 us | 1.0 | 59% |
| get_decorators | core-test-data | 0.19 us | 0.03 | **0.03** | 0.94 | **0.84** | 0.16 us | 0.0 | 0% |
| get_decorators | conformance | 0.09 us | 0.05 | **0.05** | 1.14 | **0.83** | 0.07 us | 0.0 | 0% |
| get_decorators | synthetic-large | 0.03 us | 0.17 | **0.17** | 0.95 | **1.14** | 0.03 us | 0.0 | 0% |
| dcs_decorate | core-test-data | 50.30 ms | 2.21 (rebuild 2.04) | **0.45** (rebuild 0.70) | 2.18 | **1.72** | 86.42 ms | 122.0 | 93% |
| dcs_decorate | conformance | 23.35 ms | 2.25 (rebuild 2.24) | **0.45** (rebuild 0.51) | 2.57 | **1.63** | 38.13 ms | 143.0 | 85% |
| dcs_decorate | synthetic-large | 78.37 ms | 0.81 (rebuild 0.99) | **0.55** (rebuild 0.73) | 1.42 | **1.64** | 128.63 ms | 23.0 | 98% |
| dcs_validate | core-test-data | 44.76 ms | 0.34 (rebuild 0.41) | **0.24** (rebuild 0.37) | 1.12 | **0.68** | 30.30 ms | 54.0 | 84% |
| dcs_validate | conformance | 23.33 ms | 0.34 (rebuild 0.44) | **0.22** (rebuild 0.27) | 1.53 | **0.77** | 17.89 ms | 61.0 | 75% |
| dcs_validate | synthetic-large | 79.80 ms | 0.28 (rebuild 0.48) | **0.22** (rebuild 0.34) | 0.87 | **0.65** | 52.19 ms | 21.0 | 88% |
| extract_decorators | core-test-data | 9.84 ms | 15.95 (rebuild 20.28) | **0.88** (rebuild 1.82) | 12.00 | **3.88** | 38.21 ms | 122.0 | 82% |
| extract_decorators | conformance | 3.20 ms | 21.85 (rebuild 23.24) | **1.19** (rebuild 2.18) | 18.72 | **6.64** | 21.28 ms | 143.0 | 74% |
| extract_decorators | synthetic-large | 16.94 ms | 2.77 (rebuild 3.01) | **0.87** (rebuild 1.43) | 4.29 | **3.46** | 58.62 ms | 23.0 | 91% |
| extract_vocabularies | core-test-data | 11.71 ms | 12.68 (rebuild 13.40) | **0.78** (rebuild 1.60) | 12.15 | **5.28** | 61.79 ms | 122.0 | 86% |
| extract_vocabularies | conformance | 4.39 ms | 17.01 (rebuild 16.82) | **1.09** (rebuild 1.29) | 13.37 | **6.61** | 29.04 ms | 143.0 | 77% |
| extract_vocabularies | synthetic-large | 12.19 ms | 3.69 (rebuild 4.50) | **1.22** (rebuild 2.07) | 7.95 | **9.18** | 111.96 ms | 23.0 | 96% |
| extract_cold | core-test-data | 9.07 ms | - | - | 17.60 | **5.18** | 47.01 ms | 122.0 | 81% |
| extract_cold | conformance | 4.26 ms | - | - | 17.87 | **6.21** | 26.46 ms | 143.0 | 78% |
| extract_cold | synthetic-large | 14.72 ms | - | - | 7.49 | **5.37** | 79.06 ms | 23.0 | 94% |
| extract_keep | core-test-data | 11.52 ms | - | - | 12.38 | **4.35** | 50.15 ms | 122.0 | 94% |
| extract_keep | conformance | 4.55 ms | - | - | 13.87 | **5.64** | 25.63 ms | 143.0 | 80% |
| extract_keep | synthetic-large | 14.79 ms | - | - | 8.13 | **12.14** | 179.52 ms | 23.0 | 98% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 85.8 us | 0.42 | **0.28** | 2.07 | **0.80** | 68.7 us | 1.0 | 58% |
| from_json | conformance | 25.1 us | 0.24 | **0.19** | 2.20 | **0.70** | 17.6 us | 1.0 | 51% |
| from_json | synthetic-large | 20.2 us | 0.64 | **0.63** | 4.39 | **1.71** | 34.6 us | 1.0 | 67% |
| to_json | core-test-data | 33.6 us | 0.92 | **0.94** | 3.12 | **2.94** | 98.8 us | 1.0 | 65% |
| to_json | conformance | 7.75 us | 0.75 | **0.76** | 4.75 | **3.69** | 28.6 us | 1.0 | 68% |
| to_json | synthetic-large | 9.70 us | 1.32 | **1.26** | 5.72 | **6.37** | 61.8 us | 1.0 | 72% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 6.91 us | - | - | 12.57 | **1.79** | 12.4 us | 4.6 | 32% |
| new_resource | conformance | 5.37 us | 0.29 | **0.30** | 13.34 | **1.91** | 10.3 us | 3.2 | 32% |
| new_resource | synthetic-large | 3.18 us | 0.59 | **0.52** | 6.90 | **1.69** | 5.38 us | 3.0 | 33% |

### Validation

| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 19.0 us | 0.50 | **0.50** | 1.52 | **1.54** | 29.4 us | 1.0 | 45% |
| validate | conformance | 4.02 us | 0.58 | **0.56** | 2.68 | **2.64** | 10.6 us | 1.0 | 40% |
| validate | synthetic-large | 6.04 us | 0.95 | **0.61** | 1.92 | **1.27** | 7.68 us | 1.0 | 58% |
| set_property_value | core-test-data | 2.38 us | 0.73 | **0.66** | 3.55 | **2.08** | 4.94 us | 1.1 | 34% |
| set_property_value | conformance | 0.60 us | 1.09 | **0.94** | 9.72 | **9.73** | 5.87 us | 1.1 | 25% |
| set_property_value | synthetic-large | 0.76 us | 1.38 | **1.35** | 4.20 | **3.14** | 2.38 us | 1.0 | 36% |
| add_array_value | core-test-data | 17.1 us | 0.95 | **0.71** | 9.05 | **2.87** | 49.2 us | 15.7 | 34% |
| add_array_value | conformance | 1.13 us | 1.15 | **1.17** | 6.93 | **4.50** | 5.09 us | 1.0 | 18% |
| add_array_value | synthetic-large | 0.91 us | 1.81 | **1.22** | 4.98 | **3.95** | 3.61 us | 1.0 | 42% |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.

| # | op | set | category | x TS API | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | get_namespaces_first | conformance | Introspection | 28.18 | - | 26.4 us | 0.94 us | 1.0 | 12.6 us (95%) | 0.65 us | - | ModelManagerHandle.getNamespaces x1.0 | other 47.7%, glue 29%, core 19.9%, gc 2% |
| 2 | modelfile_new | synthetic-large | Model | 27.42 | 1.42 | 31.54 ms | 1.15 ms | 3.0 | 34.07 ms (97%) | 1.16 ms | 1.64 ms | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.0, modelFileIsCompatibleVersion x1.0 | core 83.6%, gc 9.6%, glue 4.2%, views 2.5% |
| 3 | get_namespaces_first | synthetic-large | Introspection | 22.11 | - | 3.36 us | 0.15 us | 1.0 | 1.84 us (59%) | 1.28 us | - | ModelManagerHandle.getNamespaces x1.0 | other 51%, glue 24.4%, core 13.5%, ts-core 7.4% |
| 4 | modelfile_new | conformance | Model | 21.71 | 1.37 | 350.6 us | 16.1 us | 3.0 | 247.0 us (85%) | 44.3 us | 22.1 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.0, modelFileIsCompatibleVersion x1.0 | core 79.7%, views 13.4%, glue 4%, gc 1.7% |
| 5 | get_namespaces_first | core-test-data | Introspection | 20.53 | - | 17.0 us | 0.83 us | 1.0 | 12.2 us (93%) | 0.86 us | - | ModelManagerHandle.getNamespaces x1.0 | other 49.8%, glue 27.7%, core 18.8%, gc 2% |
| 6 | add_model_file | conformance | Model | 19.45 | 1.09 | 524.8 us | 27.0 us | 4.2 | 247.2 us (84%) | 48.3 us | 29.3 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 72.9%, views 12.8%, gc 7.5%, glue 4.5% |
| 7 | add_model_file | synthetic-large | Model | 14.24 | 0.98 | 42.26 ms | 2.97 ms | 14.0 | 27.27 ms (94%) | 1.80 ms | 2.90 ms | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x3.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 82.4%, gc 9.7%, glue 3.8%, views 3.6% |
| 8 | modelfile_new | core-test-data | Model | 14.21 | 0.86 | 715.3 us | 50.3 us | 3.0 | 550.8 us (91%) | 55.8 us | 43.1 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.0, modelFileIsCompatibleVersion x1.0 | core 84%, views 10.3%, glue 3.7%, other 1% |
| 9 | extract_keep | synthetic-large | Introspection | 12.14 | - | 179.52 ms | 14.79 ms | 23.0 | 155.68 ms (98%) | 2.42 ms | - | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 66%, gc 24.6%, glue 6%, views 2.2% |
| 10 | set_property_value | conformance | Validation | 9.73 | 0.94 | 5.87 us | 0.60 us | 1.1 | 0.95 us (25%) | 2.84 us | 0.57 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileResolveType x0.0 | ts-core 38.8%, core 23.7%, glue 10.6%, views 9.8% |
| 11 | extract_vocabularies | synthetic-large | Introspection | 9.18 | 1.22 | 111.96 ms | 12.19 ms | 23.0 | 91.06 ms (96%) | 3.96 ms | 14.84 ms | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.dcsExtractVocabularies x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 78.5%, gc 13.7%, glue 4.7%, views 2.4% |
| 12 | add_model_file | core-test-data | Model | 8.86 | 0.76 | 797.6 us | 90.1 us | 4.3 | 535.0 us (86%) | 84.7 us | 68.5 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.1, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 75.9%, views 10%, gc 7.4%, glue 4.3% |
| 13 | extract_decorators | conformance | Introspection | 6.64 | 1.19 | 21.28 ms | 3.20 ms | 143.0 | 14.24 ms (74%) | 4.97 ms | 3.82 ms | ModelManagerHandle.checkAstShape x41.0, ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x46.0 | core 69.9%, views 10.4%, gc 9.9%, glue 6.5% |
| 14 | extract_vocabularies | conformance | Introspection | 6.61 | 1.09 | 29.04 ms | 4.39 ms | 143.0 | 16.31 ms (77%) | 4.92 ms | 4.77 ms | ModelManagerHandle.checkAstShape x41.0, ModelManagerHandle.dcsExtractVocabularies x1.0, modelFileIsCompatibleVersion x46.0 | core 72.3%, gc 12.1%, views 9.7%, glue 3.7% |
| 15 | to_json | synthetic-large | Serialisation | 6.37 | 1.26 | 61.8 us | 9.70 us | 1.0 | 33.9 us (72%) | 13.1 us | 12.2 us | ModelManagerHandle.serializerToJson x1.0 | core 64.7%, encode 20.3%, decode 5.7%, glue 5.4% |
| 16 | extract_cold | conformance | Introspection | 6.21 | - | 26.46 ms | 4.26 ms | 143.0 | 19.55 ms (78%) | 5.46 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.checkAstShape x41.0, modelFileIsCompatibleVersion x46.0 | core 73.9%, gc 11.2%, views 7.7%, glue 5.2% |
| 17 | extract_keep | conformance | Introspection | 5.64 | - | 25.63 ms | 4.55 ms | 143.0 | 19.38 ms (80%) | 4.94 ms | - | ModelManagerHandle.checkAstShape x41.0, ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x46.0 | core 68.5%, gc 10.3%, views 10%, glue 8% |
| 18 | extract_cold | synthetic-large | Introspection | 5.37 | - | 79.06 ms | 14.72 ms | 23.0 | 64.75 ms (94%) | 4.46 ms | - | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | gc 47.5%, core 46.5%, glue 3.5%, views 1.7% |
| 19 | extract_vocabularies | core-test-data | Introspection | 5.28 | 0.78 | 61.79 ms | 11.71 ms | 122.0 | 49.05 ms (86%) | 7.80 ms | 9.11 ms | ModelManagerHandle.checkAstShape x34.0, ModelManagerHandle.dcsExtractVocabularies x1.0, modelFileIsCompatibleVersion x39.0 | core 77.7%, gc 8.7%, views 6.2%, glue 5.5% |
| 20 | extract_cold | core-test-data | Introspection | 5.18 | - | 47.01 ms | 9.07 ms | 122.0 | 35.89 ms (81%) | 8.30 ms | - | ModelManagerHandle.checkAstShape x34.0, ModelManagerHandle.dcsExtractDecorators x1.0, modelFileIsCompatibleVersion x39.0 | core 57%, gc 33.4%, views 4.8%, glue 3.5% |
| 21 | add_cto_model | conformance | Model | 4.56 | 0.17 | 790.2 us | 173.3 us | 4.2 | 207.6 us (41%) | 299.4 us | 29.3 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 40.5%, cto-parser 36.8%, views 12.1%, gc 4% |
| 22 | add_array_value | conformance | Validation | 4.50 | 1.17 | 5.09 us | 1.13 us | 1.0 | 2.51 us (18%) | 11.7 us | 1.33 us | ModelManagerHandle.validatePropertyBinary x1.0 | ts-core 40.9%, encode 19.5%, core 17.2%, glue 12.4% |
| 23 | extract_keep | core-test-data | Introspection | 4.35 | - | 50.15 ms | 11.52 ms | 122.0 | 50.15 ms (94%) | 3.18 ms | - | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.checkAstShape x34.0, modelFileIsCompatibleVersion x39.0 | core 72%, glue 12%, gc 8.1%, views 5.8% |
| 24 | add_array_value | synthetic-large | Validation | 3.95 | 1.22 | 3.61 us | 0.91 us | 1.0 | 2.48 us (42%) | 3.47 us | 1.11 us | ModelManagerHandle.validatePropertyBinary x1.0 | core 32.6%, glue 27.4%, ts-core 22.4%, views 9.3% |
| 25 | extract_decorators | core-test-data | Introspection | 3.88 | 0.88 | 38.21 ms | 9.84 ms | 122.0 | 26.56 ms (82%) | 5.95 ms | 8.61 ms | ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.checkAstShape x34.0, modelFileIsCompatibleVersion x39.0 | core 76.9%, glue 7.8%, views 7.1%, gc 5.6% |
| 26 | add_cto_model | synthetic-large | Model | 3.81 | 0.11 | 99.79 ms | 26.20 ms | 14.0 | 42.65 ms (53%) | 38.17 ms | 2.90 ms | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x3.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 45.4%, cto-parser 42.3%, gc 6.5%, views 3% |
| 27 | to_json | conformance | Serialisation | 3.69 | 0.76 | 28.6 us | 7.75 us | 1.0 | 21.1 us (68%) | 10.2 us | 5.87 us | ModelManagerHandle.serializerToJson x1.0 | core 58.1%, encode 20.7%, ts-core 7.6%, glue 5.7% |
| 28 | extract_decorators | synthetic-large | Introspection | 3.46 | 0.87 | 58.62 ms | 16.94 ms | 23.0 | 46.70 ms (91%) | 4.58 ms | 14.80 ms | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.dcsExtractDecorators x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 79.4%, glue 8.1%, gc 6.6%, views 3.9% |
| 29 | set_property_value | synthetic-large | Validation | 3.14 | 1.35 | 2.38 us | 0.76 us | 1.0 | 1.13 us (36%) | 2.04 us | 1.02 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8 | ts-core 34.8%, core 31.6%, glue 13%, views 10% |
| 30 | resolve_type_first | core-test-data | Introspection | 3.04 | - | 1.29 us | 0.42 us | 1.0 | 1.99 us (41%) | 2.92 us | - | ModelManagerHandle.resolveType x1.0 | glue 30.7%, core 29.2%, other 28.4%, ts-core 10.1% |
| 31 | add_cto_model | core-test-data | Model | 3.00 | 0.12 | 1.77 ms | 591.7 us | 4.3 | 591.4 us (46%) | 683.0 us | 68.5 us | ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x1.1, ModelManagerHandle.validateAndCommitStagedModelFile x1.0 | core 44.7%, cto-parser 34.5%, gc 8.7%, views 6.7% |
| 32 | to_json | core-test-data | Serialisation | 2.94 | 0.94 | 98.8 us | 33.6 us | 1.0 | 59.0 us (65%) | 31.4 us | 31.6 us | ModelManagerHandle.serializerToJson x1.0 | core 62.3%, encode 21.9%, decode 6.6%, glue 3.8% |
| 33 | add_array_value | core-test-data | Validation | 2.87 | 0.71 | 49.2 us | 17.1 us | 15.7 | 32.7 us (34%) | 63.7 us | 12.1 us | modelUtilIsAssignableTo x1.5, resourceValidatorPrimitiveValid x7.2, ModelManagerHandle.modelFileGetTypeName x2.1 | ts-core 32.4%, views 17.1%, glue 16.1%, encode 13.7% |
| 34 | get_type_first | synthetic-large | Introspection | 2.84 | - | 1.96 us | 0.69 us | 1.0 | 1.22 us (44%) | 1.56 us | - | ModelManagerHandle.getTypeName x1.0 | views 26.6%, glue 20.2%, ts-core 19.7%, other 16.3% |
| 35 | validate | conformance | Validation | 2.64 | 0.56 | 10.6 us | 4.02 us | 1.0 | 2.81 us (40%) | 4.20 us | 2.24 us | ModelManagerHandle.validateResourceBinary x1.0 | ts-core 43.3%, core 39.4%, encode 12.7%, glue 1.6% |
| 36 | get_type_first | core-test-data | Introspection | 2.54 | - | 1.44 us | 0.57 us | 1.0 | 0.82 us (53%) | 0.72 us | - | ModelManagerHandle.getTypeName x1.0 | ts-core 24.8%, views 23.6%, core 17.8%, glue 16.5% |
| 37 | set_property_value | core-test-data | Validation | 2.08 | 0.66 | 4.94 us | 2.38 us | 1.1 | 2.36 us (34%) | 4.51 us | 1.56 us | ModelManagerHandle.validatePropertyBinary x0.2, resourceValidatorPrimitiveValid x0.8, ModelManagerHandle.modelFileGetTypeName x0.0 | core 31.6%, ts-core 31.5%, views 12.8%, other 10.7% |
| 38 | get_namespaces | synthetic-large | Introspection | 2.02 | 0.54 | 0.28 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.35 us | 0.08 us |  | other 82.9%, ts-core 13.5%, gc 3.5%, glue 0% |
| 39 | derives_from | core-test-data | Introspection | 1.92 | 0.20 | 2.07 us | 1.08 us | 1.0 | 1.04 us (73%) | 0.39 us | 0.21 us | ModelManagerHandle.derivesFrom x1.0 | core 61.4%, other 19.2%, glue 19%, gc 0.3% |
| 40 | new_resource | conformance | Instance | 1.91 | 0.30 | 10.3 us | 5.37 us | 3.2 | 4.09 us (32%) | 8.75 us | 1.60 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 | views 28.4%, ts-core 27.5%, glue 23.6%, core 10.2% |
| 41 | new_resource | core-test-data | Instance | 1.79 | - | 12.4 us | 6.91 us | 4.6 | 8.34 us (32%) | 17.9 us | - | ModelManagerHandle.modelFileGetTypeName x1.7, classDeclarationIsKind x1.9, ModelManagerHandle.modelFileResolveType x0.7 | views 29%, ts-core 26.7%, glue 19.7%, core 12.1% |
| 42 | resolve_type_first | conformance | Introspection | 1.76 | - | 1.20 us | 0.69 us | 1.0 | 4.35 us (67%) | 2.11 us | - | ModelManagerHandle.resolveType x1.0 | glue 30.7%, other 29.9%, core 29.8%, ts-core 8.4% |
| 43 | dcs_decorate | core-test-data | Introspection | 1.72 | 0.45 | 86.42 ms | 50.30 ms | 122.0 | 84.69 ms (93%) | 6.13 ms | 22.74 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x34.0, modelFileIsCompatibleVersion x39.0 | core 86.2%, glue 4.6%, gc 4.1%, views 3.9% |
| 44 | from_json | synthetic-large | Serialisation | 1.71 | 0.63 | 34.6 us | 20.2 us | 1.0 | 19.6 us (67%) | 9.62 us | 12.7 us | ModelManagerHandle.serializerFromJsonCompact x1.0 | core 62.3%, encode 26%, glue 4.9%, decode 2.3% |
| 45 | new_resource | synthetic-large | Instance | 1.69 | 0.52 | 5.38 us | 3.18 us | 3.0 | 4.17 us (33%) | 8.55 us | 1.65 us | classDeclarationIsKind x2.0, ModelManagerHandle.modelFileGetTypeName x1.0 | views 30%, ts-core 27.8%, glue 23.9%, core 9.4% |
| 46 | dcs_decorate | synthetic-large | Introspection | 1.64 | 0.55 | 128.63 ms | 78.37 ms | 23.0 | 144.74 ms (98%) | 3.37 ms | 43.43 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x1.0, ModelManagerHandle.stageModelFileWithHeader x4.0 | core 87.1%, gc 5.8%, glue 4.6%, views 1.7% |
| 47 | dcs_decorate | conformance | Introspection | 1.63 | 0.45 | 38.13 ms | 23.35 ms | 143.0 | 28.80 ms (85%) | 5.21 ms | 10.39 ms | ModelManagerHandle.dcsDecorateModels x1.0, ModelManagerHandle.checkAstShape x41.0, modelFileIsCompatibleVersion x46.0 | core 81.4%, views 6.9%, glue 4.9%, gc 4.8% |
| 48 | validate | core-test-data | Validation | 1.54 | 0.50 | 29.4 us | 19.0 us | 1.0 | 12.7 us (45%) | 15.7 us | 9.59 us | ModelManagerHandle.validateResourceBinary x1.0 | core 53.2%, ts-core 36.1%, other 4.5%, encode 4.2% |
| 49 | resolve_type_first | synthetic-large | Introspection | 1.52 | - | 0.87 us | 0.57 us | 1.0 | 1.25 us (70%) | 0.54 us | - | ModelManagerHandle.resolveType x1.0 | glue 30.9%, other 27.4%, core 26.9%, ts-core 13.1% |
| 50 | get_type_first | conformance | Introspection | 1.50 | - | 1.37 us | 0.91 us | 1.0 | 1.08 us (47%) | 1.21 us | - | ModelManagerHandle.getTypeName x1.0 | views 22.8%, other 20.7%, ts-core 20.1%, core 17.8% |
| 51 | mm_new | (system) | Model | 1.46 | 0.00 | 783.8 us | 536.3 us | 10.0 | 176.1 us (35%) | 333.1 us | 1.55 us | ModelManagerHandle.stageModelFileWithHeader x2.0, new ModelManagerHandle x1.0, modelFileIsCompatibleVersion x3.0 | views 53.9%, core 23.3%, ts-core 7.3%, gc 6.8% |
| 52 | validate | synthetic-large | Validation | 1.27 | 0.61 | 7.68 us | 6.04 us | 1.0 | 7.00 us (58%) | 5.06 us | 3.68 us | ModelManagerHandle.validateResourceBinary x1.0 | core 59.8%, ts-core 33.6%, glue 2.2%, other 2% |
| 53 | get_decorators | synthetic-large | Introspection | 1.14 | 0.17 | 0.03 us | 0.03 us | 0.0 | 0.00 us (0%) | 0.13 us | 0.01 us |  | other 99.4%, gc 0.5%, views 0.1% |
| 54 | get_type | conformance | Introspection | 1.13 | 0.16 | 0.73 us | 0.64 us | 0.0 | 0.00 us (0%) | 0.69 us | 0.11 us |  | other 49%, ts-core 38.8%, views 11.1%, gc 1% |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | crossings on / off | checkAstShape us/item |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 536.3 us | 783.8 us | 680.0 us | 103.8 us | 1.15 | 1.46 | 1.27 | 10.0 / 10.0 | - |
| modelfile_new | core-test-data | 50.3 us | 715.3 us | 161.6 us | 553.7 us | 4.43 | 14.21 | 3.21 | 3.0 / 2.0 | 407.8 us |
| modelfile_new | conformance | 16.1 us | 350.6 us | 80.1 us | 270.4 us | 4.37 | 21.71 | 4.96 | 3.0 / 2.0 | 173.6 us |
| modelfile_new | synthetic-large | 1.15 ms | 31.54 ms | 4.38 ms | 27.16 ms | 7.20 | 27.42 | 3.81 | 3.0 / 2.0 | 30.74 ms |
| add_model_file | core-test-data | 90.1 us | 797.6 us | 248.3 us | 549.2 us | 3.21 | 8.86 | 2.76 | 4.3 / 3.3 | 382.1 us |
| add_model_file | conformance | 27.0 us | 524.8 us | 215.0 us | 309.8 us | 2.44 | 19.45 | 7.97 | 4.2 / 3.2 | 171.0 us |
| add_model_file | synthetic-large | 2.97 ms | 42.26 ms | 9.93 ms | 32.33 ms | 4.26 | 14.24 | 3.35 | 14.0 / 13.0 | 23.39 ms |
| add_cto_model | core-test-data | 591.7 us | 1.77 ms | 1.41 ms | 363.7 us | 1.26 | 3.00 | 2.38 | 4.3 / 3.3 | 419.9 us |
| add_cto_model | conformance | 173.3 us | 790.2 us | 604.5 us | 185.7 us | 1.31 | 4.56 | 3.49 | 4.2 / 3.2 | 118.1 us |
| add_cto_model | synthetic-large | 26.20 ms | 99.79 ms | 54.34 ms | 45.45 ms | 1.84 | 3.81 | 2.07 | 14.0 / 13.0 | 37.95 ms |
