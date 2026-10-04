Rounds: now 1, 2, 3, before 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS). "before" is P5-96's now heads.

## Rows at or below TS 5.0.0

| level | before | **now** |
|---|---:|---:|
| TS API, the 79 P5-96 rows (73 + validateInstance) | 35 | **41** |
| crate (of 63) | 58 | **59** |
| TS API, P5-106's subclass queries (of 6) | 0 | **6** |

## Geometric mean of x TS by category

"P5-96 rows" leaves out the subclass queries, so it is the row set of P5-96's categories (with validateInstance inside Validation).

| category | rows | TS API: before | **now** | crate: before | **now** | TS API, P5-96 rows: before | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 2.21 | **2.14** | 0.20 | **0.20** | 2.21 | **2.14** |
| Introspection (including decorators/DCS) | 51 | 1.36 | **0.59** | 0.32 | **0.25** | 0.88 | **0.80** |
| Serialisation | 6 | 1.88 | **1.19** | 0.46 | **0.24** | 1.88 | **1.19** |
| Instance creation | 3 | 1.66 | **1.34** | 0.29 | **0.28** | 1.66 | **1.34** |
| Validation | 15 | 1.49 | **1.10** | 0.37 | **0.25** | 1.49 | **1.10** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 419.7 us | 0.00 | **0.00** | 0.82 | **0.71** | 298.6 us | 3.0 | 3.0 | 6% | 5% |
| modelfile_new | core-test-data | 26.3 us | 0.58 | **0.57** | 3.47 | **3.52** | 92.3 us | 1.1 | 1.1 | 50% | 4% |
| modelfile_new | conformance | 8.91 us | 0.62 | **0.64** | 3.47 | **3.54** | 31.5 us | 1.0 | 1.0 | 50% | 8% |
| modelfile_new | synthetic-large | 692.1 us | 0.93 | **0.91** | 3.51 | **3.43** | 2.37 ms | 1.0 | 1.0 | 51% | 5% |
| add_model_file | core-test-data | 62.6 us | 0.60 | **0.58** | 1.94 | **1.56** | 97.5 us | 2.1 | 2.1 | 61% | 24% |
| add_model_file | conformance | 22.5 us | 0.47 | **0.46** | 1.93 | **1.90** | 42.6 us | 2.1 | 2.1 | 55% | 23% |
| add_model_file | synthetic-large | 2.19 ms | 0.72 | **0.71** | 2.96 | **2.92** | 6.39 ms | 5.0 | 5.0 | 69% | 17% |
| add_cto_model | core-test-data | 430.6 us | 0.09 | **0.08** | 2.15 | **2.22** | 957.6 us | 2.1 | 2.1 | 18% | 16% |
| add_cto_model | conformance | 136.7 us | 0.08 | **0.08** | 2.59 | **2.77** | 379.0 us | 2.1 | 2.1 | 18% | 13% |
| add_cto_model | synthetic-large | 20.56 ms | 0.08 | **0.08** | 1.29 | **1.23** | 25.27 ms | 5.0 | 5.0 | 13% | 8% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.40 us | 0.21 | **0.13** | 1.36 | **1.15** | 0.46 us | 0.0 | 0.0 | 0% | 1% |
| get_type | conformance | 0.51 us | 0.16 | **0.09** | 0.84 | **1.00** | 0.51 us | 0.0 | 0.0 | 0% | 1% |
| get_type | synthetic-large | 0.53 us | 0.15 | **0.11** | 0.82 | **0.76** | 0.40 us | 0.0 | 0.0 | 0% | 2% |
| get_type_first | core-test-data | 0.41 us | - | - | 2.86 | **3.19** | 1.30 us | 1.0 | 1.0 | 52% | 1% |
| get_type_first | conformance | 0.53 us | - | - | 2.31 | **2.31** | 1.23 us | 1.0 | 1.0 | 51% | 1% |
| get_type_first | synthetic-large | 0.54 us | - | - | 2.89 | **2.36** | 1.27 us | 1.0 | 1.0 | 47% | 1% |
| resolve_type | core-test-data | 0.30 us | 0.23 | **0.22** | 0.43 | **0.31** | 0.09 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | conformance | 0.39 us | 0.14 | **0.14** | 0.33 | **0.23** | 0.09 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | synthetic-large | 0.32 us | 0.21 | **0.20** | 0.29 | **0.27** | 0.09 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type_first | core-test-data | 0.30 us | - | - | 3.35 | **3.23** | 0.98 us | 1.0 | 1.0 | 76% | 1% |
| resolve_type_first | conformance | 0.39 us | - | - | 2.46 | **2.52** | 0.98 us | 1.0 | 1.0 | 81% | 1% |
| resolve_type_first | synthetic-large | 0.39 us | - | - | 2.07 | **2.00** | 0.78 us | 1.0 | 1.0 | 40% | 1% |
| get_namespaces | core-test-data | 0.81 us | 1.57 | **1.41** | 0.28 | **0.24** | 0.20 us | 0.0 | 0.0 | 0% | 8% |
| get_namespaces | conformance | 0.87 us | 1.39 | **1.41** | 0.21 | **0.20** | 0.18 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces | synthetic-large | 0.14 us | 0.51 | **0.52** | 1.30 | **1.82** | 0.26 us | 0.0 | 0.0 | 0% | 3% |
| get_namespaces_first | core-test-data | 0.85 us | - | - | 0.26 | **0.28** | 0.24 us | 0.0 | 0.0 | 0% | 8% |
| get_namespaces_first | conformance | 0.94 us | - | - | 0.22 | **0.25** | 0.23 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces_first | synthetic-large | 0.19 us | - | - | 1.11 | **1.18** | 0.22 us | 0.0 | 0.0 | 0% | 3% |
| derives_from | core-test-data | 0.76 us | 0.27 | **0.22** | 1.45 | **1.44** | 1.10 us | 1.0 | 1.0 | 45% | 0% |
| derives_from | conformance | 0.78 us | 0.23 | **0.19** | 1.33 | **1.11** | 0.87 us | 1.0 | 1.0 | 77% | 0% |
| derives_from | synthetic-large | 0.58 us | 0.34 | **0.31** | 1.30 | **1.24** | 0.72 us | 1.0 | 1.0 | 60% | 0% |
| is_assignable_to | core-test-data | 1.13 us | 0.24 | **0.19** | 0.97 | **0.93** | 1.06 us | 1.0 | 1.0 | 75% | 0% |
| is_assignable_to | conformance | 1.34 us | 0.19 | **0.15** | 0.72 | **0.67** | 0.90 us | 1.0 | 1.0 | 76% | 0% |
| is_assignable_to | synthetic-large | 1.19 us | 0.24 | **0.20** | 0.71 | **0.67** | 0.80 us | 1.0 | 1.0 | 91% | 0% |
| get_decorators | core-test-data | 0.15 us | 0.04 | **0.04** | 1.03 | **0.85** | 0.13 us | 0.0 | 0.0 | 0% | 1% |
| get_decorators | conformance | 0.09 us | 0.05 | **0.05** | 0.92 | **0.84** | 0.07 us | 0.0 | 0.0 | 0% | 0% |
| get_decorators | synthetic-large | 0.03 us | 0.20 | **0.21** | 1.00 | **0.98** | 0.03 us | 0.0 | 0.0 | 0% | 1% |
| dcs_decorate | core-test-data | 38.53 ms | 0.43 (rebuild 0.53) | **0.24** (rebuild 0.36) | 0.99 | **0.74** | 28.48 ms | 44.0 | 11.0 | 95% | 20% |
| dcs_decorate | conformance | 19.74 ms | 0.34 (rebuild 0.43) | **0.17** (rebuild 0.27) | 0.94 | **0.53** | 10.45 ms | 49.0 | 9.0 | 89% | 20% |
| dcs_decorate | synthetic-large | 61.23 ms | 0.43 (rebuild 0.56) | **0.26** (rebuild 0.41) | 0.94 | **0.64** | 39.43 ms | 9.0 | 9.0 | 97% | 14% |
| dcs_validate | core-test-data | 32.71 ms | 0.23 (rebuild 0.27) | **0.13** (rebuild 0.17) | 0.53 | **0.53** | 17.18 ms | 46.0 | 45.0 | 78% | 12% |
| dcs_validate | conformance | 17.18 ms | 0.20 (rebuild 0.24) | **0.09** (rebuild 0.12) | 0.70 | **0.68** | 11.68 ms | 53.0 | 52.0 | 68% | 16% |
| dcs_validate | synthetic-large | 51.38 ms | 0.23 (rebuild 0.26) | **0.15** (rebuild 0.18) | 0.55 | **0.52** | 26.71 ms | 13.0 | 12.0 | 85% | 12% |
| extract_decorators | core-test-data | 7.35 ms | 0.95 (rebuild 1.32) | **0.74** (rebuild 1.09) | 0.55 | **0.51** | 3.78 ms | 43.0 | 10.0 | 78% | 8% |
| extract_decorators | conformance | 2.49 ms | 0.96 (rebuild 1.34) | **0.79** (rebuild 1.19) | 0.69 | **0.65** | 1.61 ms | 48.0 | 8.0 | 62% | 10% |
| extract_decorators | synthetic-large | 8.62 ms | 1.36 (rebuild 1.92) | **1.09** (rebuild 1.58) | 0.58 | **0.56** | 4.80 ms | 8.0 | 8.0 | 87% | 7% |
| extract_vocabularies | core-test-data | 7.02 ms | 0.82 (rebuild 1.19) | **0.81** (rebuild 1.14) | 0.41 | **0.38** | 2.67 ms | 43.0 | 10.0 | 73% | 13% |
| extract_vocabularies | conformance | 2.56 ms | 0.80 (rebuild 1.19) | **0.76** (rebuild 1.18) | 0.81 | **0.51** | 1.31 ms | 48.0 | 8.0 | 58% | 12% |
| extract_vocabularies | synthetic-large | 8.73 ms | 1.17 (rebuild 1.67) | **1.13** (rebuild 1.66) | 0.45 | **0.41** | 3.57 ms | 8.0 | 8.0 | 85% | 10% |
| extract_cold | core-test-data | 6.56 ms | - | - | 2.14 | **1.60** | 10.48 ms | 43.0 | 10.0 | 91% | 36% |
| extract_cold | conformance | 2.46 ms | - | - | 2.47 | **2.52** | 6.20 ms | 48.0 | 8.0 | 85% | 24% |
| extract_cold | synthetic-large | 9.02 ms | - | - | 2.80 | **2.56** | 23.10 ms | 8.0 | 8.0 | 95% | 47% |
| extract_keep | core-test-data | 7.14 ms | - | - | 0.86 | **0.81** | 5.78 ms | 43.0 | 10.0 | 85% | 10% |
| extract_keep | conformance | 2.58 ms | - | - | 0.78 | **0.62** | 1.61 ms | 48.0 | 8.0 | 74% | 12% |
| extract_keep | synthetic-large | 8.82 ms | - | - | 0.91 | **0.69** | 6.06 ms | 8.0 | 8.0 | 93% | 9% |
| get_assignable_class_declarations | core-test-data | 30.3 us | - | - | 33.81 | **0.10** | 3.02 us | 1.0 | 1.0 | 57% | 2% |
| get_assignable_class_declarations | conformance | 16.6 us | - | - | 22.85 | **0.12** | 1.95 us | 1.0 | 1.0 | 19% | 2% |
| get_assignable_class_declarations | synthetic-large | 38.0 us | - | - | 48.70 | **0.04** | 1.62 us | 1.0 | 1.0 | 51% | 2% |
| get_direct_subclasses | core-test-data | 28.9 us | - | - | 35.20 | **0.04** | 1.23 us | 1.0 | 1.0 | 23% | 2% |
| get_direct_subclasses | conformance | 16.0 us | - | - | 22.42 | **0.05** | 0.88 us | 1.0 | 1.0 | 13% | 2% |
| get_direct_subclasses | synthetic-large | 37.6 us | - | - | 49.51 | **0.03** | 1.00 us | 1.0 | 1.0 | 43% | 2% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 54.0 us | 0.29 | **0.20** | 0.98 | **0.76** | 41.1 us | 1.0 | 1.0 | 58% | 1% |
| from_json | conformance | 13.2 us | 0.24 | **0.19** | 1.17 | **0.79** | 10.4 us | 1.0 | 1.0 | 69% | 1% |
| from_json | synthetic-large | 17.1 us | 0.45 | **0.36** | 1.28 | **1.08** | 18.4 us | 1.0 | 1.0 | 64% | 2% |
| to_json | core-test-data | 30.3 us | 0.65 | **0.23** | 2.37 | **1.46** | 44.3 us | 1.0 | 1.0 | 55% | 1% |
| to_json | conformance | 7.27 us | 0.45 | **0.16** | 2.99 | **1.39** | 10.1 us | 1.0 | 1.0 | 60% | 1% |
| to_json | synthetic-large | 8.39 us | 1.10 | **0.41** | 4.21 | **2.17** | 18.2 us | 1.0 | 1.0 | 60% | 1% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 6.28 us | - | - | 1.75 | **1.56** | 9.82 us | 4.6 | 2.5 | 18% | 1% |
| new_resource | conformance | 4.34 us | 0.24 | **0.23** | 1.50 | **1.14** | 4.96 us | 3.2 | 1.2 | 17% | 1% |
| new_resource | synthetic-large | 3.03 us | 0.36 | **0.35** | 1.73 | **1.35** | 4.09 us | 3.0 | 1.0 | 18% | 2% |

### Validation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 15.3 us | 0.39 | **0.12** | 1.15 | **0.99** | 15.2 us | 1.0 | 1.0 | 55% | 1% |
| validate | conformance | 3.68 us | 0.30 | **0.17** | 1.60 | **1.01** | 3.71 us | 1.0 | 1.0 | 26% | 1% |
| validate | synthetic-large | 5.74 us | 0.48 | **0.23** | 1.17 | **1.15** | 6.62 us | 1.0 | 1.0 | 66% | 1% |
| set_property_value | core-test-data | 2.37 us | 0.43 | **0.28** | 1.36 | **0.93** | 2.21 us | 1.1 | 0.2 | 34% | 1% |
| set_property_value | conformance | 0.86 us | 0.44 | **0.37** | 3.72 | **1.71** | 1.47 us | 1.1 | 0.3 | 25% | 1% |
| set_property_value | synthetic-large | 0.73 us | 0.76 | **0.58** | 2.31 | **1.48** | 1.09 us | 1.0 | 0.2 | 31% | 2% |
| add_array_value | core-test-data | 16.4 us | 0.57 | **0.14** | 2.57 | **1.67** | 27.5 us | 15.7 | 6.4 | 21% | 1% |
| add_array_value | conformance | 1.10 us | 0.78 | **0.41** | 4.69 | **2.80** | 3.07 us | 1.0 | 1.0 | 32% | 2% |
| add_array_value | synthetic-large | 1.07 us | 0.83 | **0.51** | 2.39 | **2.17** | 2.32 us | 1.0 | 1.0 | 37% | 2% |
| validate_instance | core-test-data | 60.3 us | 0.21 | **0.23** | 0.63 | **0.59** | 35.8 us | 1.0 | 1.0 | 75% | 2% |
| validate_instance | conformance | 15.8 us | 0.17 | **0.17** | 0.84 | **0.64** | 10.1 us | 1.0 | 1.0 | 46% | 5% |
| validate_instance | synthetic-large | 22.2 us | 0.28 | **0.28** | 0.81 | **0.78** | 17.3 us | 1.0 | 1.0 | 76% | 3% |
| validate_instance_or_throw | core-test-data | 62.6 us | 0.21 | **0.20** | 0.89 | **0.69** | 43.1 us | 1.0 | 1.0 | 55% | 2% |
| validate_instance_or_throw | conformance | 16.1 us | 0.16 | **0.16** | 1.14 | **0.73** | 11.8 us | 1.0 | 1.0 | 36% | 4% |
| validate_instance_or_throw | synthetic-large | 22.2 us | 0.27 | **0.27** | 1.20 | **0.96** | 21.2 us | 1.0 | 1.0 | 57% | 4% |

## P5-109 rows (the `p5109` pseudo-set, TS API only)

| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_json_map | fromJSON, 1,000-entry String map | 370.1 us | 4.85 ms | **1.01 ms** | 0.21 | 13.10 | **2.72** | 1.00 | 1.00 | 2% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_relmap | fromJSON, 1,000-entry relationship map | - | 11.89 ms | **6.58 ms** | 0.55 | - | - | 1001.00 | 1001.00 | 2% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0, ModelManagerHandle.modelFileGetTypeName x1000.0 |
| validate_instance_collect_all | validateInstance, collectAll, 6 errors | 41.9 us | 39.6 us | **34.3 us** | 0.87 | 0.95 | **0.82** | 1.00 | 1.00 | 1% | ModelManagerHandle.validateInstance x1.0 |
| validate_instance_first_error | validateInstance, collectAll:false | 42.3 us | 21.9 us | **13.0 us** | 0.60 | 0.52 | **0.31** | 1.00 | 1.00 | 1% | ModelManagerHandle.validateInstance x1.0 |
| get_type_p5109 | getType, nothing changed | 0.50 us | 0.37 us | **0.33 us** | 0.90 | 0.74 | **0.66** | 0.00 | 0.00 | 1% | - |
| get_type_after_update | getType after updateModelFile of the supertype file | 0.47 us | 1.07 us | **0.96 us** | 0.90 | 2.28 | **2.04** | 1.00 | 1.00 | - | ModelManagerHandle.getTypeName x1.0 |
| get_type_other_mutated | getType while a second manager changes | 0.47 us | 1.02 us | **0.26 us** | 0.26 | 2.14 | **0.55** | 1.00 | 0.00 | - | - |
| resolve_type_p5109 | resolveType, nothing changed | 0.32 us | 0.08 us | **0.07 us** | 0.90 | 0.24 | **0.22** | 0.00 | 0.00 | 0% | - |
| resolve_type_after_update | resolveType after updateModelFile of the supertype file | 0.27 us | 0.69 us | **0.64 us** | 0.93 | 2.53 | **2.36** | 1.00 | 1.00 | - | ModelManagerHandle.resolveType x1.0 |
| resolve_type_other_mutated | resolveType while a second manager changes | 0.26 us | 0.72 us | **0.02 us** | 0.02 | 2.76 | **0.07** | 1.00 | 0.00 | - | - |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector's share of the V8 profile of the TS-API loop; "native crate" is the crate row (the same engine work, native).

| # | op | set | category | x TS API | before | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | modelfile_new | conformance | Model | 3.54 | 3.47 | 0.64 | 31.5 us | 8.91 us | 1.0 | 31.5 us (50%) | 31.8 us | 8% | 5.69 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 46.6%, views 21.1%, ts-core 21%, gc 7.6% |
| 2 | modelfile_new | core-test-data | Model | 3.52 | 3.47 | 0.57 | 92.3 us | 26.3 us | 1.1 | 52.6 us (50%) | 52.6 us | 4% | 14.8 us | ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 | core 56.4%, ts-core 23.2%, views 12.7%, gc 4.2% |
| 3 | modelfile_new | synthetic-large | Model | 3.43 | 3.51 | 0.91 | 2.37 ms | 692.1 us | 1.0 | 1.90 ms (51%) | 1.82 ms | 5% | 630.6 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 52.6%, ts-core 39.9%, gc 4.7%, views 1.6% |
| 4 | resolve_type_first | core-test-data | Introspection | 3.23 | 3.35 | - | 0.98 us | 0.30 us | 1.0 | 0.98 us (76%) | 0.30 us | 1% | - | ModelManagerHandle.resolveType x1.0 | glue 31.5%, core 30.1%, other 26.6%, ts-core 10.5% |
| 5 | get_type_first | core-test-data | Introspection | 3.19 | 2.86 | - | 1.30 us | 0.41 us | 1.0 | 0.95 us (52%) | 0.88 us | 1% | - | ModelManagerHandle.getTypeName x1.0 | ts-core 23.9%, views 22%, glue 19.4%, core 18.3% |
| 6 | add_model_file | synthetic-large | Model | 2.92 | 2.96 | 0.71 | 6.39 ms | 2.19 ms | 5.0 | 2.59 ms (69%) | 1.15 ms | 17% | 1.55 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | core 54.1%, ts-core 22.3%, gc 17.3%, views 3.2% |
| 7 | add_array_value | conformance | Validation | 2.80 | 4.69 | 0.41 | 3.07 us | 1.10 us | 1.0 | 0.90 us (32%) | 1.94 us | 2% | 0.45 us | ModelManagerHandle.validatePropertyById x1.0 | ts-core 33.2%, core 29.1%, glue 22.2%, other 7.4% |
| 8 | add_cto_model | conformance | Model | 2.77 | 2.59 | 0.08 | 379.0 us | 136.7 us | 2.1 | 32.7 us (18%) | 151.7 us | 13% | 10.3 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 | cto-parser 53.2%, core 19.3%, gc 12.6%, views 7% |
| 9 | extract_cold | synthetic-large | Introspection | 2.56 | 2.80 | - | 23.10 ms | 9.02 ms | 8.0 | 14.38 ms (95%) | 721.2 us | 47% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, new ModelManagerHandle x2.0 | gc 46.9%, core 42.6%, glue 6.7%, ts-core 1.5% |
| 10 | extract_cold | conformance | Introspection | 2.52 | 2.47 | - | 6.20 ms | 2.46 ms | 8.0 | 6.75 ms (85%) | 1.21 ms | 24% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x2.0 | core 50.8%, gc 23.8%, glue 11.3%, views 6.8% |
| 11 | resolve_type_first | conformance | Introspection | 2.52 | 2.46 | - | 0.98 us | 0.39 us | 1.0 | 1.05 us (81%) | 0.25 us | 1% | - | ModelManagerHandle.resolveType x1.0 | glue 35%, core 31.2%, other 24.5%, ts-core 8.2% |
| 12 | get_type_first | synthetic-large | Introspection | 2.36 | 2.89 | - | 1.27 us | 0.54 us | 1.0 | 0.76 us (47%) | 0.85 us | 1% | - | ModelManagerHandle.getTypeName x1.0 | views 27%, glue 20.7%, ts-core 18.9%, core 16.4% |
| 13 | get_type_first | conformance | Introspection | 2.31 | 2.31 | - | 1.23 us | 0.53 us | 1.0 | 0.91 us (51%) | 0.87 us | 1% | - | ModelManagerHandle.getTypeName x1.0 | views 25.8%, ts-core 22.6%, glue 19.9%, core 16.7% |
| 14 | add_cto_model | core-test-data | Model | 2.22 | 2.15 | 0.08 | 957.6 us | 430.6 us | 2.1 | 105.7 us (18%) | 485.4 us | 16% | 36.6 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 | cto-parser 51.7%, core 22.1%, gc 16.3%, ts-core 4.9% |
| 15 | add_array_value | synthetic-large | Validation | 2.17 | 2.39 | 0.51 | 2.32 us | 1.07 us | 1.0 | 1.10 us (37%) | 1.91 us | 2% | 0.55 us | ModelManagerHandle.validatePropertyById x1.0 | ts-core 31.2%, glue 26.5%, core 26.3%, views 9.9% |
| 16 | to_json | synthetic-large | Serialisation | 2.17 | 4.21 | 0.41 | 18.2 us | 8.39 us | 1.0 | 11.3 us (60%) | 7.61 us | 1% | 3.41 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 55.8%, encode 22.3%, decode 10.6%, ts-core 5.6% |
| 17 | resolve_type_first | synthetic-large | Introspection | 2.00 | 2.07 | - | 0.78 us | 0.39 us | 1.0 | 0.94 us (40%) | 1.40 us | 1% | - | ModelManagerHandle.resolveType x1.0 | glue 34.9%, core 28.3%, other 24%, ts-core 11.7% |
| 18 | add_model_file | conformance | Model | 1.90 | 1.93 | 0.46 | 42.6 us | 22.5 us | 2.1 | 28.2 us (55%) | 23.4 us | 23% | 10.3 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | core 45.1%, gc 22.6%, ts-core 15.3%, views 14.4% |
| 19 | get_namespaces | synthetic-large | Introspection | 1.82 | 1.30 | 0.52 | 0.26 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.20 us | 3% | 0.07 us |  | other 89.8%, ts-core 7.3%, gc 2.9% |
| 20 | set_property_value | conformance | Validation | 1.71 | 3.72 | 0.37 | 1.47 us | 0.86 us | 0.3 | 0.52 us (25%) | 1.53 us | 1% | 0.32 us | ModelManagerHandle.validatePropertyById x0.2, ModelManagerHandle.modelFileGetTypeName x0.0, ModelManagerHandle.modelFileResolveType x0.0 | ts-core 29.4%, core 23.4%, views 19.1%, other 13.2% |
| 21 | add_array_value | core-test-data | Validation | 1.67 | 2.57 | 0.14 | 27.5 us | 16.4 us | 6.4 | 8.73 us (21%) | 33.1 us | 1% | 2.35 us | ModelManagerHandle.modelFileGetFullyQualifiedTypeName x2.7, ModelManagerHandle.modelFileResolveType x1.0, ModelManagerHandle.validatePropertyById x0.6 | ts-core 51.1%, views 22.8%, core 9.2%, glue 8.7% |
| 22 | extract_cold | core-test-data | Introspection | 1.60 | 2.14 | - | 10.48 ms | 6.56 ms | 10.0 | 9.89 ms (91%) | 925.9 us | 36% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, modelFileIsCompatibleVersion x2.0 | core 49.9%, gc 36.2%, glue 6.6%, views 3.4% |
| 23 | new_resource | core-test-data | Instance | 1.56 | 1.75 | - | 9.82 us | 6.28 us | 2.5 | 2.78 us (18%) | 13.0 us | 1% | - | ModelManagerHandle.modelFileGetTypeName x1.7, ModelManagerHandle.modelFileResolveType x0.7, ModelManagerHandle.validatePropertyById x0.1 | views 35%, ts-core 27.4%, glue 15.2%, other 12% |
| 24 | add_model_file | core-test-data | Model | 1.56 | 1.94 | 0.58 | 97.5 us | 62.6 us | 2.1 | 74.0 us (61%) | 46.7 us | 24% | 36.6 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 | core 54.6%, gc 24%, ts-core 11.1%, views 7.5% |
| 25 | set_property_value | synthetic-large | Validation | 1.48 | 2.31 | 0.58 | 1.09 us | 0.73 us | 0.2 | 0.45 us (31%) | 0.98 us | 2% | 0.42 us | ModelManagerHandle.validatePropertyById x0.2 | core 29.8%, ts-core 29.1%, views 16.6%, glue 14.1% |
| 26 | to_json | core-test-data | Serialisation | 1.46 | 2.37 | 0.23 | 44.3 us | 30.3 us | 1.0 | 27.7 us (55%) | 22.6 us | 1% | 6.84 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 56.9%, encode 22.7%, decode 11.7%, ts-core 3.4% |
| 27 | derives_from | core-test-data | Introspection | 1.44 | 1.45 | 0.22 | 1.10 us | 0.76 us | 1.0 | 1.05 us (45%) | 1.27 us | 0% | 0.17 us | ModelManagerHandle.derivesFrom x1.0 | core 63.4%, glue 29.3%, other 7%, gc 0.2% |
| 28 | to_json | conformance | Serialisation | 1.39 | 2.99 | 0.16 | 10.1 us | 7.27 us | 1.0 | 7.11 us (60%) | 4.81 us | 1% | 1.19 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 55%, encode 22%, decode 8.6%, ts-core 5.7% |
| 29 | new_resource | synthetic-large | Instance | 1.35 | 1.73 | 0.35 | 4.09 us | 3.03 us | 1.0 | 0.93 us (18%) | 4.21 us | 2% | 1.06 us | ModelManagerHandle.modelFileGetTypeName x1.0 | ts-core 36.5%, views 34.5%, glue 11.2%, other 8.9% |
| 30 | derives_from | synthetic-large | Introspection | 1.24 | 1.30 | 0.31 | 0.72 us | 0.58 us | 1.0 | 1.07 us (60%) | 0.72 us | 0% | 0.18 us | ModelManagerHandle.derivesFrom x1.0 | core 60.6%, glue 32.9%, other 6.2%, gc 0.3% |
| 31 | add_cto_model | synthetic-large | Model | 1.23 | 1.29 | 0.08 | 25.27 ms | 20.56 ms | 5.0 | 3.16 ms (13%) | 20.60 ms | 8% | 1.55 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | cto-parser 70.8%, core 13.4%, gc 8.2%, ts-core 6% |
| 32 | get_namespaces_first | synthetic-large | Introspection | 1.18 | 1.11 | - | 0.22 us | 0.19 us | 0.0 | 0.00 us (0%) | 0.30 us | 3% | - |  | other 89.6%, ts-core 7.6%, gc 2.8% |
| 33 | get_type | core-test-data | Introspection | 1.15 | 1.36 | 0.13 | 0.46 us | 0.40 us | 0.0 | 0.00 us (0%) | 0.49 us | 1% | 0.05 us |  | other 44.3%, ts-core 41.2%, views 13.1%, gc 1.1% |
| 34 | validate | synthetic-large | Validation | 1.15 | 1.17 | 0.23 | 6.62 us | 5.74 us | 1.0 | 5.58 us (66%) | 2.91 us | 1% | 1.35 us | ModelManagerHandle.validateResourceBinary x1.0 | core 60.5%, ts-core 30.2%, glue 6.4%, gc 1.4% |
| 35 | new_resource | conformance | Instance | 1.14 | 1.50 | 0.23 | 4.96 us | 4.34 us | 1.2 | 1.00 us (17%) | 4.83 us | 1% | 1.00 us | ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 | views 37.7%, ts-core 30.1%, glue 12.8%, other 10.1% |
| 36 | derives_from | conformance | Introspection | 1.11 | 1.33 | 0.19 | 0.87 us | 0.78 us | 1.0 | 1.10 us (77%) | 0.33 us | 0% | 0.15 us | ModelManagerHandle.derivesFrom x1.0 | core 61.4%, glue 31.2%, other 7.2%, gc 0.1% |
| 37 | from_json | synthetic-large | Serialisation | 1.08 | 1.28 | 0.36 | 18.4 us | 17.1 us | 1.0 | 12.4 us (64%) | 6.98 us | 2% | 6.13 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 | core 60.2%, encode 29.6%, glue 2.9%, other 2.1% |
| 38 | validate | conformance | Validation | 1.01 | 1.60 | 0.17 | 3.71 us | 3.68 us | 1.0 | 2.75 us (26%) | 7.83 us | 1% | 0.62 us | ModelManagerHandle.validateResourceBinary x1.0 | core 55.9%, ts-core 31.3%, glue 8.1%, other 2.7% |

## Crossings per item of P5-96's gap rows

P5-96's ranked gap rows (TS API slower than TS 5.0.0 in P5-96), with the crossings per item P5-96 recorded, this run's before-side (the same heads) and now, and the now x TS.

| op | set | P5-96 x TS API | P5-96 crossings/item | before | **now** | now - before | x TS API now | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---|
| set_property_value | conformance | 5.07 | 1.05 | 1.05 | **0.27** | -0.78 | 1.71 | ModelManagerHandle.validatePropertyById x0.2, ModelManagerHandle.modelFileGetTypeName x0.0, ModelManagerHandle.modelFileResolveType x0.0 |
| add_array_value | conformance | 4.57 | 1.00 | 1.00 | **1.00** | 0.00 | 2.80 | ModelManagerHandle.validatePropertyById x1.0 |
| to_json | synthetic-large | 4.21 | 1.00 | 1.00 | **1.00** | 0.00 | 2.17 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| resolve_type_first | core-test-data | 4.18 | 1.00 | 1.00 | **1.00** | 0.00 | 3.23 | ModelManagerHandle.resolveType x1.0 |
| modelfile_new | core-test-data | 3.65 | 1.06 | 1.06 | **1.06** | 0.00 | 3.52 | ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 |
| modelfile_new | synthetic-large | 3.58 | 1.00 | 1.00 | **1.00** | 0.00 | 3.43 | ModelManagerHandle.stageModelFileBytes x1.0 |
| modelfile_new | conformance | 3.43 | 1.00 | 1.00 | **1.00** | 0.00 | 3.54 | ModelManagerHandle.stageModelFileBytes x1.0 |
| get_type_first | core-test-data | 3.11 | 1.00 | 1.00 | **1.00** | 0.00 | 3.19 | ModelManagerHandle.getTypeName x1.0 |
| add_model_file | synthetic-large | 3.05 | 5.00 | 5.00 | **5.00** | 0.00 | 2.92 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 |
| to_json | conformance | 2.71 | 1.00 | 1.00 | **1.00** | 0.00 | 1.39 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| extract_cold | synthetic-large | 2.70 | 8.00 | 8.00 | **8.00** | 0.00 | 2.56 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, new ModelManagerHandle x2.0 |
| add_array_value | core-test-data | 2.69 | 15.75 | 15.75 | **6.38** | -9.36 | 1.67 | ModelManagerHandle.modelFileGetFullyQualifiedTypeName x2.7, ModelManagerHandle.modelFileResolveType x1.0, ModelManagerHandle.validatePropertyById x0.6 |
| get_namespaces_first | synthetic-large | 2.66 | 0.00 | 0.00 | **0.00** | 0.00 | 1.18 |  |
| resolve_type_first | conformance | 2.61 | 1.00 | 1.00 | **1.00** | 0.00 | 2.52 | ModelManagerHandle.resolveType x1.0 |
| get_type_first | conformance | 2.57 | 1.00 | 1.00 | **1.00** | 0.00 | 2.31 | ModelManagerHandle.getTypeName x1.0 |
| set_property_value | synthetic-large | 2.49 | 1.00 | 1.00 | **0.20** | -0.80 | 1.48 | ModelManagerHandle.validatePropertyById x0.2 |
| get_type_first | synthetic-large | 2.43 | 1.00 | 1.00 | **1.00** | 0.00 | 2.36 | ModelManagerHandle.getTypeName x1.0 |
| to_json | core-test-data | 2.26 | 1.00 | 1.00 | **1.00** | 0.00 | 1.46 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| resolve_type_first | synthetic-large | 2.25 | 1.00 | 1.00 | **1.00** | 0.00 | 2.00 | ModelManagerHandle.resolveType x1.0 |
| add_cto_model | core-test-data | 2.23 | 2.14 | 2.14 | **2.14** | 0.00 | 2.22 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 |
| extract_cold | conformance | 2.21 | 48.00 | 48.00 | **8.00** | -40.00 | 2.52 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x2.0 |
| add_cto_model | conformance | 2.05 | 2.07 | 2.07 | **2.07** | 0.00 | 2.77 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 |
| add_model_file | conformance | 1.99 | 2.07 | 2.07 | **2.07** | 0.00 | 1.90 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 |
| add_array_value | synthetic-large | 1.94 | 1.00 | 1.00 | **1.00** | 0.00 | 2.17 | ModelManagerHandle.validatePropertyById x1.0 |
| extract_cold | core-test-data | 1.94 | 43.00 | 43.00 | **10.00** | -33.00 | 1.60 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, modelFileIsCompatibleVersion x2.0 |
| new_resource | core-test-data | 1.78 | 4.56 | 4.56 | **2.49** | -2.07 | 1.56 | ModelManagerHandle.modelFileGetTypeName x1.7, ModelManagerHandle.modelFileResolveType x0.7, ModelManagerHandle.validatePropertyById x0.1 |
| new_resource | synthetic-large | 1.65 | 3.00 | 3.00 | **1.00** | -2.00 | 1.35 | ModelManagerHandle.modelFileGetTypeName x1.0 |
| get_namespaces | synthetic-large | 1.60 | 0.00 | 0.00 | **0.00** | 0.00 | 1.82 |  |
| set_property_value | core-test-data | 1.55 | 1.08 | 1.08 | **0.24** | -0.84 | 0.93 | ModelManagerHandle.validatePropertyById x0.2, ModelManagerHandle.modelFileGetTypeName x0.0, ModelManagerHandle.modelFileResolveType x0.0 |
| derives_from | core-test-data | 1.53 | 1.00 | 1.00 | **1.00** | 0.00 | 1.44 | ModelManagerHandle.derivesFrom x1.0 |
| validate | conformance | 1.46 | 1.00 | 1.00 | **1.00** | 0.00 | 1.01 | ModelManagerHandle.validateResourceBinary x1.0 |
| derives_from | synthetic-large | 1.40 | 1.00 | 1.00 | **1.00** | 0.00 | 1.24 | ModelManagerHandle.derivesFrom x1.0 |
| validate_instance_or_throw | synthetic-large | 1.39 | 1.00 | 1.00 | **1.00** | 0.00 | 0.96 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| get_type | core-test-data | 1.37 | 0.00 | 0.00 | **0.00** | 0.00 | 1.15 |  |
| new_resource | conformance | 1.37 | 3.18 | 3.18 | **1.18** | -2.00 | 1.14 | ModelManagerHandle.modelFileGetTypeName x1.1, ModelManagerHandle.modelFileResolveType x0.1 |
| from_json | synthetic-large | 1.30 | 1.00 | 1.00 | **1.00** | 0.00 | 1.08 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| add_cto_model | synthetic-large | 1.26 | 5.00 | 5.00 | **5.00** | 0.00 | 1.23 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 |
| add_model_file | core-test-data | 1.25 | 2.14 | 2.14 | **2.14** | 0.00 | 1.56 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 |
| validate | synthetic-large | 1.22 | 1.00 | 1.00 | **1.00** | 0.00 | 1.15 | ModelManagerHandle.validateResourceBinary x1.0 |
| derives_from | conformance | 1.19 | 1.00 | 1.00 | **1.00** | 0.00 | 1.11 | ModelManagerHandle.derivesFrom x1.0 |
| from_json | conformance | 1.14 | 1.00 | 1.00 | **1.00** | 0.00 | 0.79 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| is_assignable_to | core-test-data | 1.14 | 1.00 | 1.00 | **1.00** | 0.00 | 0.93 | ModelManagerHandle.isAssignableTo x1.0 |
| mm_new | (system) | 1.13 | 3.00 | 3.00 | **3.00** | 0.00 | 0.71 | ModelManagerHandle.setDecoratorValidation x1.0, new ModelManagerHandle x1.0, ModelManagerHandle.setDangerouslyAllowReservedSystemTypeNamesInUserModels x1.0 |
| dcs_decorate | core-test-data | 1.12 | 44.00 | 44.00 | **11.00** | -33.00 | 0.74 | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, modelFileIsCompatibleVersion x2.0 |
| validate_instance_or_throw | conformance | 1.09 | 1.00 | 1.00 | **1.00** | 0.00 | 0.73 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| dcs_decorate | synthetic-large | 1.08 | 9.00 | 9.00 | **9.00** | 0.00 | 0.64 | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x1.0 |
| get_decorators | core-test-data | 1.06 | 0.00 | 0.00 | **0.00** | 0.00 | 0.85 |  |
| from_json | core-test-data | 1.03 | 1.00 | 1.00 | **1.00** | 0.00 | 0.76 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| get_decorators | synthetic-large | 1.03 | 0.00 | 0.00 | **0.00** | 0.00 | 0.98 |  |
| validate | core-test-data | 1.01 | 1.00 | 1.00 | **1.00** | 0.00 | 0.99 | ModelManagerHandle.validateResourceBinary x1.0 |
| dcs_decorate | conformance | 1.00 | 49.00 | 49.00 | **9.00** | -40.00 | 0.53 | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, ModelManagerHandle.commitStagedModelFiles x1.0 |

## mm_new, absolute (us per manager, each round's median)

| side | round 1 | round 2 | round 3 | median |
|---|---:|---:|---:|---:|
| TS 5.0.0 | 419.7 | 380.6 | 535.5 | 419.7 |
| before (P5-96 now heads) | 363.4 | 342.4 | 328.2 | 342.4 |
| now | 241.6 | 385.5 | 298.6 | 298.6 |
| now, metamodelValidation:false | 177.1 | 192.7 | 200.3 | 192.7 |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | before x TS on | crossings on / off |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 419.7 us | 298.6 us | 192.7 us | 105.9 us | 1.55 | 0.71 | 0.46 | 0.82 | 3.0 / 3.0 |
| modelfile_new | core-test-data | 26.3 us | 92.3 us | 78.8 us | 13.5 us | 1.17 | 3.52 | 3.00 | 3.47 | 1.1 / 1.1 |
| modelfile_new | conformance | 8.91 us | 31.5 us | 42.7 us | -11.18 us | 0.74 | 3.54 | 4.79 | 3.47 | 1.0 / 1.0 |
| modelfile_new | synthetic-large | 692.1 us | 2.37 ms | 2.26 ms | 113.6 us | 1.05 | 3.43 | 3.26 | 3.51 | 1.0 / 1.0 |
| add_model_file | core-test-data | 62.6 us | 97.5 us | 96.3 us | 1.24 us | 1.01 | 1.56 | 1.54 | 1.94 | 2.1 / 2.1 |
| add_model_file | conformance | 22.5 us | 42.6 us | 41.0 us | 1.66 us | 1.04 | 1.90 | 1.82 | 1.93 | 2.1 / 2.1 |
| add_model_file | synthetic-large | 2.19 ms | 6.39 ms | 6.16 ms | 225.3 us | 1.04 | 2.92 | 2.82 | 2.96 | 5.0 / 5.0 |
| add_cto_model | core-test-data | 430.6 us | 957.6 us | 976.0 us | -18.34 us | 0.98 | 2.22 | 2.27 | 2.15 | 2.1 / 2.1 |
| add_cto_model | conformance | 136.7 us | 379.0 us | 354.6 us | 24.4 us | 1.07 | 2.77 | 2.59 | 2.59 | 2.1 / 2.1 |
| add_cto_model | synthetic-large | 20.56 ms | 25.27 ms | 26.72 ms | -1449.31 us | 0.95 | 1.23 | 1.30 | 1.29 | 5.0 / 5.0 |

## Typed read allocations (P5-90 method)

| set | input bytes | allocs | reallocs | bytes requested | P5-96 (allocs / bytes) | native read | WASM stage | WASM drop | WASM / native | TS 5.0.0 new ModelFile | native / TS |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| concerto-core-test-data | 3,259 | 34 | 2 | 18,593 | 33 / 18,579 | 17.40 us | 25.30 us | 1.90 us | 1.45 | 26.3 us | 0.66 |
| conformance | 1,300 | 14 | 1 | 5,936 | 15 / 5,967 | 5.78 us | 10.91 us | 0.36 us | 1.89 | 8.9 us | 0.65 |
| synthetic-large | 229,584 | 284 | 1 | 1,109,717 | 284 / 1,109,717 | 669.48 us | 973.84 us | 23.29 us | 1.45 | 692.1 us | 0.97 |

## Web bundle size (P5-39 method)

KB = 1000 B; gzip -9, brotli q11.

| entry | v5.0.0 raw / gz / br | engine raw / gz / br | engine x v5 (raw / gz / br) | P5-96 engine raw / gz / br |
|---|---|---|---|---|
| E1, `keepNames` | 387.9 / 94.3 / 67.7 | 5,652.2 / 1,903.1 / 1,235.5 | 14.6 / 20.2 / 18.3 | 5,733.3 / 1,914.8 / 1,236.9 |
| E2, `keepNames` | 388.0 / 94.4 / 67.7 | 5,652.3 / 1,903.1 / 1,235.2 | 14.6 / 20.2 / 18.2 | 5,733.3 / 1,914.8 / 1,237.0 |
| E3, `keepNames` | 386.2 / 94.2 / 67.5 | 5,650.5 / 1,902.9 / 1,234.7 | 14.6 / 20.2 / 18.3 | 5,731.5 / 1,914.6 / 1,236.9 |
| E1, no `keepNames` | 371.7 / 89.5 / 63.9 | 5,625.7 / 1,895.7 / 1,230.1 | 15.1 / 21.2 / 19.3 | 5,704.7 / 1,906.1 / 1,231.1 |
| E2, no `keepNames` | 371.7 / 89.6 / 64.0 | 5,625.7 / 1,895.8 / 1,230.2 | 15.1 / 21.2 / 19.2 | 5,704.7 / 1,906.1 / 1,230.7 |
| E3, no `keepNames` | 370.0 / 89.4 / 63.7 | 5,623.9 / 1,895.5 / 1,229.8 | 15.2 / 21.2 / 19.3 | 5,703.0 / 1,905.9 / 1,230.3 |

| part | raw / gz / br | P5-96 raw / gz / br |
|---|---|---|
| `.wasm` | 3,871.5 / 1,224.2 / 789.4 | 3,871.3 / 1,223.7 / 793.4 |
| the same as base64 | 5,162.0 / 1,780.9 / 1,144.8 | 5,161.8 / 1,780.3 / 1,144.7 |
| `concerto-engine.mjs` (glue + base64) | 5,162.8 / 1,781.4 / 1,144.6 | 5,162.6 / 1,780.8 / 1,147.2 |
| JS without the engine package (E1, keepNames) | 436.4 / 110.4 / 82.5 | 507.6 / 124.2 / 83.5 |
| `concerto-engine.cjs` (Node), raw | 5,341.7 | 5,373.2 |

Errors:
- from_json_relmap/p5109: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
