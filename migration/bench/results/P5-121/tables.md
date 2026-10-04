Rounds: now 1, 2, 3, before 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS). "before" is P5-109's now heads.

## Rows at or below TS 5.0.0

| level | before | **now** |
|---|---:|---:|
| TS API, the 79 P5-96 rows (73 + validateInstance) | 42 | **43** |
| crate (of 63) | 58 | **60** |
| TS API, P5-106's subclass queries (of 6) | 6 | **6** |

## Geometric mean of x TS by category

"P5-96 rows" leaves out the subclass queries, so it is the row set of P5-96's categories. validateInstance (validate_instance, validate_instance_or_throw) is its own series, not blended into Validation.

| category | rows | TS API: before | **now** | crate: before | **now** | TS API, P5-96 rows: before | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 2.22 | **2.54** | 0.19 | **0.19** | 2.22 | **2.54** |
| Introspection (including decorators/DCS) | 51 | 0.59 | **0.57** | 0.25 | **0.21** | 0.81 | **0.78** |
| Serialisation | 6 | 1.19 | **1.20** | 0.21 | **0.27** | 1.19 | **1.20** |
| Instance creation | 3 | 1.38 | **1.12** | 0.28 | **0.33** | 1.38 | **1.12** |
| Validation | 9 | 1.50 | **1.59** | 0.29 | **0.37** | 1.50 | **1.59** |
| Validation: validateInstance | 6 | 0.74 | **0.83** | 0.20 | **0.20** | 0.74 | **0.83** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 421.4 us | 0.00 | **0.00** | 0.92 | **1.01** | 427.5 us | 3.0 | 3.0 | 5% | 6% |
| modelfile_new | core-test-data | 29.5 us | 0.53 | **0.54** | 3.47 | **5.47** | 161.4 us | 1.1 | 1.1 | 53% | 4% |
| modelfile_new | conformance | 9.77 us | 0.62 | **0.60** | 3.70 | **4.89** | 47.7 us | 1.0 | 1.0 | 49% | 8% |
| modelfile_new | synthetic-large | 728.7 us | 1.05 | **1.09** | 3.59 | **3.52** | 2.56 ms | 1.0 | 1.0 | 53% | 6% |
| add_model_file | core-test-data | 74.3 us | 0.49 | **0.54** | 1.60 | **1.71** | 127.0 us | 2.1 | 2.1 | 68% | 23% |
| add_model_file | conformance | 27.5 us | 0.39 | **0.41** | 1.81 | **1.85** | 50.8 us | 2.1 | 2.1 | 52% | 22% |
| add_model_file | synthetic-large | 2.58 ms | 0.68 | **0.69** | 3.12 | **3.98** | 10.26 ms | 5.0 | 5.0 | 71% | 20% |
| add_cto_model | core-test-data | 480.4 us | 0.08 | **0.08** | 2.51 | **2.57** | 1.24 ms | 2.1 | 2.1 | 18% | 15% |
| add_cto_model | conformance | 166.6 us | 0.06 | **0.07** | 2.32 | **2.77** | 462.3 us | 2.1 | 2.1 | 18% | 8% |
| add_cto_model | synthetic-large | 24.75 ms | 0.07 | **0.07** | 1.29 | **1.33** | 32.92 ms | 5.0 | 5.0 | 13% | 9% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.42 us | 0.15 | **0.16** | 1.17 | **0.79** | 0.33 us | 0.0 | 0.0 | 0% | 1% |
| get_type | conformance | 0.53 us | 0.10 | **0.12** | 0.79 | **0.74** | 0.40 us | 0.0 | 0.0 | 0% | 1% |
| get_type | synthetic-large | 0.58 us | 0.11 | **0.12** | 0.72 | **0.73** | 0.42 us | 0.0 | 0.0 | 0% | 2% |
| get_type_first | core-test-data | 0.42 us | - | - | 4.09 | **3.30** | 1.39 us | 1.0 | 1.0 | 49% | 2% |
| get_type_first | conformance | 0.54 us | - | - | 2.88 | **2.69** | 1.44 us | 1.0 | 1.0 | 48% | 1% |
| get_type_first | synthetic-large | 0.55 us | - | - | 2.41 | **2.59** | 1.44 us | 1.0 | 1.0 | 48% | 2% |
| resolve_type | core-test-data | 0.30 us | 0.26 | **0.26** | 0.30 | **0.28** | 0.08 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | conformance | 0.38 us | 0.17 | **0.18** | 0.23 | **0.23** | 0.09 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | synthetic-large | 0.32 us | 0.24 | **0.24** | 0.27 | **0.28** | 0.09 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type_first | core-test-data | 0.31 us | - | - | 3.79 | **3.64** | 1.12 us | 1.0 | 1.0 | 74% | 2% |
| resolve_type_first | conformance | 0.38 us | - | - | 3.01 | **2.48** | 0.95 us | 1.0 | 1.0 | 82% | 2% |
| resolve_type_first | synthetic-large | 0.37 us | - | - | 2.41 | **2.36** | 0.88 us | 1.0 | 1.0 | 45% | 2% |
| get_namespaces | core-test-data | 1.09 us | 1.10 | **1.03** | 0.26 | **0.21** | 0.23 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces | conformance | 0.97 us | 1.25 | **1.18** | 0.19 | **0.20** | 0.19 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces | synthetic-large | 0.14 us | 0.42 | **0.43** | 1.25 | **1.17** | 0.17 us | 0.0 | 0.0 | 0% | 6% |
| get_namespaces_first | core-test-data | 0.90 us | - | - | 0.32 | **0.38** | 0.34 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces_first | conformance | 0.95 us | - | - | 0.27 | **0.33** | 0.32 us | 0.0 | 0.0 | 0% | 9% |
| get_namespaces_first | synthetic-large | 0.16 us | - | - | 1.47 | **2.70** | 0.44 us | 0.0 | 0.0 | 0% | 5% |
| derives_from | core-test-data | 0.73 us | 0.27 | **0.13** | 1.67 | **2.19** | 1.61 us | 1.0 | 1.0 | 67% | 0% |
| derives_from | conformance | 0.78 us | 0.22 | **0.12** | 1.34 | **0.96** | 0.75 us | 1.0 | 1.0 | 67% | 0% |
| derives_from | synthetic-large | 1.03 us | 0.20 | **0.10** | 0.87 | **0.57** | 0.58 us | 1.0 | 1.0 | 76% | 0% |
| is_assignable_to | core-test-data | 2.13 us | 0.11 | **0.07** | 0.55 | **0.53** | 1.13 us | 1.0 | 1.0 | 79% | 0% |
| is_assignable_to | conformance | 2.34 us | 0.10 | **0.06** | 0.34 | **0.37** | 0.86 us | 1.0 | 1.0 | 79% | 0% |
| is_assignable_to | synthetic-large | 1.19 us | 0.23 | **0.14** | 0.71 | **0.72** | 0.85 us | 1.0 | 1.0 | 56% | 0% |
| get_decorators | core-test-data | 0.21 us | 0.03 | **0.03** | 0.86 | **0.55** | 0.11 us | 0.0 | 0.0 | 0% | 1% |
| get_decorators | conformance | 0.09 us | 0.06 | **0.05** | 0.79 | **0.75** | 0.06 us | 0.0 | 0.0 | 0% | 1% |
| get_decorators | synthetic-large | 0.03 us | 0.22 | **0.23** | 0.97 | **0.95** | 0.02 us | 0.0 | 0.0 | 0% | 1% |
| dcs_decorate | core-test-data | 44.15 ms | 0.25 (rebuild 0.38) | **0.25** (rebuild 0.36) | 0.80 | **0.76** | 33.58 ms | 11.0 | 8.0 | 93% | 17% |
| dcs_decorate | conformance | 23.76 ms | 0.16 (rebuild 0.24) | **0.15** (rebuild 0.24) | 0.56 | **0.58** | 13.67 ms | 9.0 | 6.0 | 93% | 20% |
| dcs_decorate | synthetic-large | 73.39 ms | 0.30 (rebuild 0.48) | **0.26** (rebuild 0.47) | 0.71 | **0.69** | 50.37 ms | 9.0 | 6.0 | 98% | 15% |
| dcs_validate | core-test-data | 35.98 ms | 0.13 (rebuild 0.18) | **0.13** (rebuild 0.20) | 0.61 | **0.63** | 22.83 ms | 45.0 | 45.0 | 74% | 10% |
| dcs_validate | conformance | 20.13 ms | 0.07 (rebuild 0.12) | **0.08** (rebuild 0.12) | 0.75 | **0.77** | 15.44 ms | 52.0 | 52.0 | 67% | 14% |
| dcs_validate | synthetic-large | 57.73 ms | 0.17 (rebuild 0.23) | **0.17** (rebuild 0.23) | 0.56 | **0.67** | 38.48 ms | 12.0 | 12.0 | 83% | 12% |
| extract_decorators | core-test-data | 9.04 ms | 0.66 (rebuild 1.06) | **0.47** (rebuild 0.91) | 0.54 | **0.50** | 4.50 ms | 10.0 | 7.0 | 78% | 7% |
| extract_decorators | conformance | 2.88 ms | 0.68 (rebuild 1.13) | **0.46** (rebuild 0.80) | 0.67 | **0.59** | 1.71 ms | 8.0 | 5.0 | 60% | 14% |
| extract_decorators | synthetic-large | 10.49 ms | 1.34 (rebuild 1.85) | **0.83** (rebuild 1.50) | 0.64 | **0.68** | 7.12 ms | 8.0 | 5.0 | 88% | 7% |
| extract_vocabularies | core-test-data | 8.43 ms | 0.78 (rebuild 1.10) | **0.54** (rebuild 0.88) | 0.47 | **0.37** | 3.11 ms | 10.0 | 7.0 | 77% | 12% |
| extract_vocabularies | conformance | 3.16 ms | 0.63 (rebuild 0.99) | **0.45** (rebuild 0.76) | 0.45 | **0.46** | 1.47 ms | 8.0 | 5.0 | 62% | 15% |
| extract_vocabularies | synthetic-large | 10.78 ms | 1.31 (rebuild 1.88) | **0.75** (rebuild 1.35) | 0.46 | **0.45** | 4.87 ms | 8.0 | 5.0 | 85% | 10% |
| extract_cold | core-test-data | 8.24 ms | - | - | 1.92 | **1.68** | 13.85 ms | 10.0 | 7.0 | 92% | 39% |
| extract_cold | conformance | 3.02 ms | - | - | 2.04 | **2.05** | 6.18 ms | 8.0 | 5.0 | 84% | 23% |
| extract_cold | synthetic-large | 11.02 ms | - | - | 3.01 | **2.55** | 28.08 ms | 8.0 | 5.0 | 95% | 52% |
| extract_keep | core-test-data | 8.92 ms | - | - | 0.84 | **0.83** | 7.42 ms | 10.0 | 7.0 | 86% | 11% |
| extract_keep | conformance | 2.99 ms | - | - | 0.57 | **0.54** | 1.62 ms | 8.0 | 5.0 | 76% | 12% |
| extract_keep | synthetic-large | 11.10 ms | - | - | 0.68 | **0.61** | 6.81 ms | 8.0 | 5.0 | 94% | 10% |
| get_assignable_class_declarations | core-test-data | 34.7 us | - | - | 0.09 | **0.09** | 3.21 us | 1.0 | 1.0 | 66% | 3% |
| get_assignable_class_declarations | conformance | 18.6 us | - | - | 0.10 | **0.10** | 1.92 us | 1.0 | 1.0 | 16% | 3% |
| get_assignable_class_declarations | synthetic-large | 41.9 us | - | - | 0.04 | **0.04** | 1.84 us | 1.0 | 1.0 | 51% | 4% |
| get_direct_subclasses | core-test-data | 32.8 us | - | - | 0.04 | **0.04** | 1.44 us | 1.0 | 1.0 | 20% | 3% |
| get_direct_subclasses | conformance | 18.8 us | - | - | 0.06 | **0.06** | 1.05 us | 1.0 | 1.0 | 53% | 3% |
| get_direct_subclasses | synthetic-large | 41.1 us | - | - | 0.02 | **0.03** | 1.07 us | 1.0 | 1.0 | 46% | 4% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 62.3 us | 0.16 | **0.21** | 0.82 | **0.83** | 51.7 us | 1.0 | 1.0 | 58% | 1% |
| from_json | conformance | 15.2 us | 0.17 | **0.20** | 0.73 | **0.79** | 12.0 us | 1.0 | 1.0 | 60% | 1% |
| from_json | synthetic-large | 20.1 us | 0.32 | **0.40** | 1.07 | **1.27** | 25.5 us | 1.0 | 1.0 | 62% | 2% |
| to_json | core-test-data | 36.1 us | 0.19 | **0.24** | 1.18 | **1.27** | 45.8 us | 1.0 | 1.0 | 62% | 1% |
| to_json | conformance | 7.88 us | 0.16 | **0.23** | 1.64 | **1.33** | 10.5 us | 1.0 | 1.0 | 65% | 1% |
| to_json | synthetic-large | 10.00 us | 0.35 | **0.45** | 2.21 | **2.10** | 21.0 us | 1.0 | 1.0 | 63% | 2% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 6.86 us | - | - | 1.93 | **1.38** | 9.45 us | 2.5 | 0.8 | 7% | 2% |
| new_resource | conformance | 4.51 us | 0.23 | **0.27** | 1.07 | **1.03** | 4.66 us | 1.2 | 0.1 | 2% | 2% |
| new_resource | synthetic-large | 3.36 us | 0.35 | **0.40** | 1.26 | **0.99** | 3.35 us | 1.0 | 0.0 | 0% | 3% |

### Validation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 17.7 us | 0.12 | **0.16** | 0.93 | **0.98** | 17.4 us | 1.0 | 1.0 | 57% | 1% |
| validate | conformance | 4.07 us | 0.16 | **0.21** | 0.98 | **1.06** | 4.33 us | 1.0 | 1.0 | 24% | 1% |
| validate | synthetic-large | 7.09 us | 0.21 | **0.27** | 1.10 | **1.14** | 8.05 us | 1.0 | 1.0 | 57% | 1% |
| set_property_value | core-test-data | 2.22 us | 0.30 | **0.40** | 1.00 | **1.00** | 2.21 us | 0.2 | 0.2 | 29% | 1% |
| set_property_value | conformance | 0.63 us | 0.53 | **0.65** | 2.52 | **2.63** | 1.65 us | 0.3 | 0.2 | 22% | 2% |
| set_property_value | synthetic-large | 0.80 us | 0.61 | **0.73** | 1.51 | **2.01** | 1.62 us | 0.2 | 0.2 | 28% | 3% |
| add_array_value | core-test-data | 17.3 us | 0.15 | **0.18** | 1.72 | **1.65** | 28.6 us | 6.4 | 4.3 | 14% | 1% |
| add_array_value | conformance | 1.20 us | 0.38 | **0.52** | 2.02 | **2.06** | 2.46 us | 1.0 | 1.0 | 32% | 2% |
| add_array_value | synthetic-large | 0.83 us | 0.70 | **0.85** | 2.97 | **3.10** | 2.58 us | 1.0 | 1.0 | 33% | 3% |

### Validation: validateInstance

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate_instance | core-test-data | 67.7 us | 0.21 | **0.20** | 0.55 | **0.63** | 42.8 us | 1.0 | 1.0 | 70% | 4% |
| validate_instance | conformance | 18.1 us | 0.16 | **0.16** | 0.63 | **0.71** | 12.9 us | 1.0 | 1.0 | 52% | 9% |
| validate_instance | synthetic-large | 24.9 us | 0.28 | **0.28** | 0.82 | **0.87** | 21.7 us | 1.0 | 1.0 | 69% | 6% |
| validate_instance_or_throw | core-test-data | 69.1 us | 0.17 | **0.19** | 0.77 | **0.80** | 55.2 us | 1.0 | 1.0 | 53% | 2% |
| validate_instance_or_throw | conformance | 18.1 us | 0.15 | **0.15** | 0.73 | **0.85** | 15.4 us | 1.0 | 1.0 | 49% | 4% |
| validate_instance_or_throw | synthetic-large | 26.0 us | 0.28 | **0.25** | 1.04 | **1.19** | 31.0 us | 1.0 | 1.0 | 52% | 3% |

## P5-109 rows (the `p5109` pseudo-set, TS API only)

| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_json_map | fromJSON, 1,000-entry String map | 404.3 us | 1.21 ms | **1.29 ms** | 1.06 | 2.99 | **3.18** | 1.00 | 1.00 | 1% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_relmap | fromJSON, 1,000-entry relationship map | - | 8.47 ms | **6.57 ms** | 0.78 | - | - | 1001.00 | 1.00 | 2% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| to_json_map | toJSON, 1,000-entry String map | 748.2 us | 1.78 ms | **978.3 us** | 0.55 | 2.39 | **1.31** | 1.00 | 1.00 | 2% | ModelManagerHandle.serializerToJsonBytes x1.0 |
| to_json_relmap | toJSON, 1,000-entry relationship map | - | 6.32 ms | **5.83 ms** | 0.92 | - | - | 1.00 | 1.00 | 1% | ModelManagerHandle.serializerToJsonBytes x1.0 |
| validate_instance_collect_all | validateInstance, collectAll, 6 errors | 53.1 us | 38.8 us | **43.0 us** | 1.11 | 0.73 | **0.81** | 1.00 | 1.00 | 3% | ModelManagerHandle.validateInstanceBytes x1.0 |
| validate_instance_first_error | validateInstance, collectAll:false | 52.4 us | 14.8 us | **17.0 us** | 1.15 | 0.28 | **0.32** | 1.00 | 1.00 | 4% | ModelManagerHandle.validateInstanceBytes x1.0 |
| get_type_p5109 | getType, nothing changed | 0.49 us | 0.35 us | **0.60 us** | 1.68 | 0.72 | **1.21** | 0.00 | 0.00 | 2% | - |
| get_type_after_update | getType after updateModelFile of the supertype file | 0.42 us | 1.21 us | **1.21 us** | 1.00 | 2.91 | **2.90** | 1.00 | 1.00 | - | ModelManagerHandle.getTypeName x1.0 |
| get_type_other_mutated | getType while a second manager changes | 0.41 us | 0.32 us | **0.33 us** | 1.01 | 0.79 | **0.80** | 0.00 | 0.00 | - | - |
| resolve_type_p5109 | resolveType, nothing changed | 0.30 us | 0.09 us | **0.09 us** | 1.02 | 0.30 | **0.30** | 0.00 | 0.00 | 0% | - |
| resolve_type_after_update | resolveType after updateModelFile of the supertype file | 0.25 us | 0.70 us | **0.80 us** | 1.14 | 2.81 | **3.21** | 1.00 | 1.00 | - | ModelManagerHandle.resolveType x1.0 |
| resolve_type_other_mutated | resolveType while a second manager changes | 0.25 us | 0.02 us | **0.02 us** | 0.88 | 0.09 | **0.08** | 0.00 | 0.00 | - | - |

## P5-121 rows (the `p5121` pseudo-set, TS API only)

| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_json_numkeys | fromJSON, 100,000 numeric-string map keys (1 document) | 76.02 ms | 33567.41 ms | **160.65 ms** | 0.00 | 441.53 | **2.11** | 1.00 | 1.00 | 4% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_strkeys | fromJSON, 100,000 non-numeric map keys (1 document, reference) | 165.35 ms | 262.88 ms | **171.43 ms** | 0.65 | 1.59 | **1.04** | 1.00 | 1.00 | 4% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_deep | fromJSON, 200-deep nested instance | 3.41 ms | - | **3.22 ms** | - | - | **0.95** | - | 401.00 | 4% | ModelManagerHandle.validateResourceBinary x1.0, ModelManagerHandle.serializerFromJsonCompact x1.0, ModelManagerHandle.modelFileResolveType x399.0 |
| to_json_deep | toJSON, 200-deep nested instance | 2.12 ms | - | **3.01 ms** | - | - | **1.42** | - | 1195.00 | 3% | ModelManagerHandle.serializerToJson x1.0, ModelManagerHandle.modelFileGetFullyQualifiedTypeName x398.0, ModelManagerHandle.modelFileResolveType x398.0 |
| validate_instance_deep | validateInstance, 200-deep nested instance | 4.77 ms | - | **3.62 ms** | - | - | **0.76** | - | 402.00 | 4% | ModelManagerHandle.validateResourceBinary x1.0, ModelManagerHandle.validateInstance x1.0, ModelManagerHandle.serializerFromJsonCompact x1.0 |

## Introspection, now against before (P5-110's flagged rows)

now / before of the median time per item (> 1 = now slower). `*` marks a ratio over 1.05.

| op | set | crate before | crate now | **crate now / before** | TS API before | TS API now | **TS API now / before** |
|---|---|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.06 us | 0.07 us | **1.09** * | 0.49 us | 0.33 us | **0.68** |
| get_type | conformance | 0.06 us | 0.06 us | **1.15** * | 0.42 us | 0.40 us | **0.94** |
| get_type | synthetic-large | 0.07 us | 0.07 us | **1.06** * | 0.41 us | 0.42 us | **1.02** |
| get_type_first | core-test-data | - | - | - | 1.72 us | 1.39 us | **0.81** |
| get_type_first | conformance | - | - | - | 1.55 us | 1.44 us | **0.93** |
| get_type_first | synthetic-large | - | - | - | 1.34 us | 1.44 us | **1.07** * |
| resolve_type | core-test-data | 0.08 us | 0.08 us | **0.98** | 0.09 us | 0.08 us | **0.92** |
| resolve_type | conformance | 0.06 us | 0.07 us | **1.05** | 0.09 us | 0.09 us | **1.03** |
| resolve_type | synthetic-large | 0.08 us | 0.08 us | **1.03** | 0.09 us | 0.09 us | **1.04** |
| resolve_type_first | core-test-data | - | - | - | 1.16 us | 1.12 us | **0.96** |
| resolve_type_first | conformance | - | - | - | 1.15 us | 0.95 us | **0.83** |
| resolve_type_first | synthetic-large | - | - | - | 0.90 us | 0.88 us | **0.98** |
| get_namespaces | core-test-data | 1.19 us | 1.12 us | **0.94** | 0.28 us | 0.23 us | **0.82** |
| get_namespaces | conformance | 1.22 us | 1.15 us | **0.94** | 0.19 us | 0.19 us | **1.03** |
| get_namespaces | synthetic-large | 0.06 us | 0.06 us | **1.02** | 0.18 us | 0.17 us | **0.94** |
| get_namespaces_first | core-test-data | - | - | - | 0.29 us | 0.34 us | **1.18** * |
| get_namespaces_first | conformance | - | - | - | 0.25 us | 0.32 us | **1.25** * |
| get_namespaces_first | synthetic-large | - | - | - | 0.24 us | 0.44 us | **1.83** * |
| derives_from | core-test-data | 0.20 us | 0.09 us | **0.48** | 1.23 us | 1.61 us | **1.31** * |
| derives_from | conformance | 0.17 us | 0.09 us | **0.55** | 1.05 us | 0.75 us | **0.72** |
| derives_from | synthetic-large | 0.21 us | 0.10 us | **0.48** | 0.89 us | 0.58 us | **0.66** |
| is_assignable_to | core-test-data | 0.23 us | 0.15 us | **0.65** | 1.17 us | 1.13 us | **0.96** |
| is_assignable_to | conformance | 0.22 us | 0.15 us | **0.65** | 0.78 us | 0.86 us | **1.10** * |
| is_assignable_to | synthetic-large | 0.27 us | 0.17 us | **0.62** | 0.84 us | 0.85 us | **1.01** |
| get_decorators | core-test-data | 0.01 us | 0.01 us | **0.98** | 0.18 us | 0.11 us | **0.63** |
| get_decorators | conformance | 0.01 us | 0.00 us | **0.91** | 0.07 us | 0.06 us | **0.95** |
| get_decorators | synthetic-large | 0.01 us | 0.01 us | **1.02** | 0.02 us | 0.02 us | **0.98** |
| dcs_decorate | core-test-data | 10.97 ms | 11.09 ms | **1.01** | 35.22 ms | 33.58 ms | **0.95** |
| dcs_decorate | conformance | 3.80 ms | 3.54 ms | **0.93** | 13.42 ms | 13.67 ms | **1.02** |
| dcs_decorate | synthetic-large | 21.76 ms | 18.85 ms | **0.87** | 51.84 ms | 50.37 ms | **0.97** |
| dcs_validate | core-test-data | 4.54 ms | 4.79 ms | **1.06** * | 21.86 ms | 22.83 ms | **1.04** |
| dcs_validate | conformance | 1.47 ms | 1.60 ms | **1.08** * | 15.18 ms | 15.44 ms | **1.02** |
| dcs_validate | synthetic-large | 9.78 ms | 9.92 ms | **1.01** | 32.32 ms | 38.48 ms | **1.19** * |
| extract_decorators | core-test-data | 6.00 ms | 4.22 ms | **0.70** | 4.92 ms | 4.50 ms | **0.91** |
| extract_decorators | conformance | 1.96 ms | 1.33 ms | **0.68** | 1.92 ms | 1.71 ms | **0.89** |
| extract_decorators | synthetic-large | 14.03 ms | 8.70 ms | **0.62** | 6.74 ms | 7.12 ms | **1.06** * |
| extract_vocabularies | core-test-data | 6.56 ms | 4.58 ms | **0.70** | 3.99 ms | 3.11 ms | **0.78** |
| extract_vocabularies | conformance | 2.00 ms | 1.42 ms | **0.71** | 1.42 ms | 1.47 ms | **1.04** |
| extract_vocabularies | synthetic-large | 14.15 ms | 8.07 ms | **0.57** | 4.93 ms | 4.87 ms | **0.99** |
| extract_cold | core-test-data | - | - | - | 15.85 ms | 13.85 ms | **0.87** |
| extract_cold | conformance | - | - | - | 6.15 ms | 6.18 ms | **1.00** |
| extract_cold | synthetic-large | - | - | - | 33.15 ms | 28.08 ms | **0.85** |
| extract_keep | core-test-data | - | - | - | 7.51 ms | 7.42 ms | **0.99** |
| extract_keep | conformance | - | - | - | 1.72 ms | 1.62 ms | **0.95** |
| extract_keep | synthetic-large | - | - | - | 7.59 ms | 6.81 ms | **0.90** |
| get_assignable_class_declarations | core-test-data | - | - | - | 3.11 us | 3.21 us | **1.03** |
| get_assignable_class_declarations | conformance | - | - | - | 1.89 us | 1.92 us | **1.02** |
| get_assignable_class_declarations | synthetic-large | - | - | - | 1.81 us | 1.84 us | **1.02** |
| get_direct_subclasses | core-test-data | - | - | - | 1.47 us | 1.44 us | **0.98** |
| get_direct_subclasses | conformance | - | - | - | 1.06 us | 1.05 us | **0.99** |
| get_direct_subclasses | synthetic-large | - | - | - | 0.97 us | 1.07 us | **1.10** * |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector's share of the V8 profile of the TS-API loop; "native crate" is the crate row (the same engine work, native).

| # | op | set | category | x TS API | before | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | modelfile_new | core-test-data | Model | 5.47 | 3.47 | 0.54 | 161.4 us | 29.5 us | 1.1 | 66.4 us (53%) | 58.0 us | 4% | 16.1 us | ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 | core 56.8%, ts-core 21.2%, views 14.1%, gc 4.4% |
| 2 | modelfile_new | conformance | Model | 4.89 | 3.70 | 0.60 | 47.7 us | 9.77 us | 1.0 | 33.3 us (49%) | 34.4 us | 8% | 5.88 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 45.4%, views 22.9%, ts-core 19.7%, gc 7.9% |
| 3 | add_model_file | synthetic-large | Model | 3.98 | 3.12 | 0.69 | 10.26 ms | 2.58 ms | 5.0 | 3.80 ms (71%) | 1.55 ms | 20% | 1.79 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 | core 53%, ts-core 21.5%, gc 19.7%, views 3.2% |
| 4 | resolve_type_first | core-test-data | Introspection | 3.64 | 3.79 | - | 1.12 us | 0.31 us | 1.0 | 1.27 us (74%) | 0.45 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 31.7%, core 30.6%, other 26.2%, ts-core 9.7% |
| 5 | modelfile_new | synthetic-large | Model | 3.52 | 3.59 | 1.09 | 2.56 ms | 728.7 us | 1.0 | 2.72 ms (53%) | 2.38 ms | 6% | 790.8 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 54.3%, ts-core 35.9%, gc 6.4%, views 2% |
| 6 | get_type_first | core-test-data | Introspection | 3.30 | 4.09 | - | 1.39 us | 0.42 us | 1.0 | 1.01 us (49%) | 1.07 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | ts-core 23.4%, views 21.8%, core 19.8%, glue 17.9% |
| 7 | add_array_value | synthetic-large | Validation | 3.10 | 2.97 | 0.85 | 2.58 us | 0.83 us | 1.0 | 1.34 us (33%) | 2.71 us | 3% | 0.71 us | ModelManagerHandle.validatePropertyById x1.0 | core 27.3%, ts-core 27.2%, glue 25.5%, views 11.3% |
| 8 | add_cto_model | conformance | Model | 2.77 | 2.32 | 0.07 | 462.3 us | 166.6 us | 2.1 | 43.6 us (18%) | 196.7 us | 8% | 11.2 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 | cto-parser 53.5%, core 19.6%, views 9%, gc 8.4% |
| 9 | get_namespaces_first | synthetic-large | Introspection | 2.70 | 1.47 | - | 0.44 us | 0.16 us | 0.0 | 0.00 us (0%) | 0.60 us | 5% | - |  | other 82.7%, ts-core 12.2%, gc 5.1% |
| 10 | get_type_first | conformance | Introspection | 2.69 | 2.88 | - | 1.44 us | 0.54 us | 1.0 | 0.92 us (48%) | 0.99 us | 1% | - | ModelManagerHandle.getTypeName x1.0 | views 26.2%, ts-core 21.4%, glue 19.5%, core 17.3% |
| 11 | set_property_value | conformance | Validation | 2.63 | 2.52 | 0.65 | 1.65 us | 0.63 us | 0.2 | 0.39 us (22%) | 1.39 us | 2% | 0.41 us | ModelManagerHandle.validatePropertyById x0.2, ModelManagerHandle.modelFileResolveType x0.0 | ts-core 31%, core 23.5%, views 18.6%, other 12.8% |
| 12 | get_type_first | synthetic-large | Introspection | 2.59 | 2.41 | - | 1.44 us | 0.55 us | 1.0 | 0.98 us (48%) | 1.07 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | other 26.8%, glue 23%, core 19.3%, ts-core 16.7% |
| 13 | add_cto_model | core-test-data | Model | 2.57 | 2.51 | 0.08 | 1.24 ms | 480.4 us | 2.1 | 137.1 us (18%) | 644.1 us | 15% | 39.9 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 | cto-parser 52.9%, core 21.3%, gc 14.9%, ts-core 5% |
| 14 | extract_cold | synthetic-large | Introspection | 2.55 | 3.01 | - | 28.08 ms | 11.02 ms | 5.0 | 16.98 ms (95%) | 834.7 us | 52% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | gc 51.6%, core 38.5%, glue 6.4%, ts-core 1.6% |
| 15 | resolve_type_first | conformance | Introspection | 2.48 | 3.01 | - | 0.95 us | 0.38 us | 1.0 | 1.36 us (82%) | 0.30 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 35%, core 29.1%, other 19.5%, ts-core 14.8% |
| 16 | resolve_type_first | synthetic-large | Introspection | 2.36 | 2.41 | - | 0.88 us | 0.37 us | 1.0 | 1.11 us (45%) | 1.35 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 35%, core 30.5%, other 22.2%, ts-core 10.5% |
| 17 | derives_from | core-test-data | Introspection | 2.19 | 1.67 | 0.13 | 1.61 us | 0.73 us | 1.0 | 0.87 us (67%) | 0.43 us | 0% | 0.09 us | ModelManagerHandle.derivesFrom x1.0 | core 48.7%, glue 25.9%, ts-core 21.9%, other 3.3% |
| 18 | to_json | synthetic-large | Serialisation | 2.10 | 2.21 | 0.45 | 21.0 us | 10.00 us | 1.0 | 15.4 us (63%) | 9.00 us | 2% | 4.50 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 63.9%, encode 23.5%, ts-core 6.1%, glue 2.3% |
| 19 | add_array_value | conformance | Validation | 2.06 | 2.02 | 0.52 | 2.46 us | 1.20 us | 1.0 | 1.10 us (32%) | 2.29 us | 2% | 0.63 us | ModelManagerHandle.validatePropertyById x1.0 | ts-core 31.7%, core 28.4%, glue 20%, other 9.4% |
| 20 | extract_cold | conformance | Introspection | 2.05 | 2.04 | - | 6.18 ms | 3.02 ms | 5.0 | 4.94 ms (84%) | 929.6 us | 23% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 | core 54.5%, gc 23.2%, views 8.4%, glue 8% |
| 21 | set_property_value | synthetic-large | Validation | 2.01 | 1.51 | 0.73 | 1.62 us | 0.80 us | 0.2 | 0.60 us (28%) | 1.52 us | 3% | 0.59 us | ModelManagerHandle.validatePropertyById x0.2 | ts-core 29.2%, core 29.2%, views 16%, glue 11.8% |
| 22 | add_model_file | conformance | Model | 1.85 | 1.81 | 0.41 | 50.8 us | 27.5 us | 2.1 | 47.9 us (52%) | 44.6 us | 22% | 11.2 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 | core 48.2%, gc 21.5%, ts-core 14.1%, views 13.5% |
| 23 | add_model_file | core-test-data | Model | 1.71 | 1.60 | 0.54 | 127.0 us | 74.3 us | 2.1 | 210.5 us (68%) | 100.9 us | 23% | 39.9 us | ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 | core 55.4%, gc 22.9%, ts-core 11.2%, views 7.4% |
| 24 | extract_cold | core-test-data | Introspection | 1.68 | 1.92 | - | 13.85 ms | 8.24 ms | 7.0 | 12.93 ms (92%) | 1.11 ms | 39% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, modelFileIsCompatibleVersion x2.0 | core 47.1%, gc 39.3%, glue 6.5%, views 3.7% |
| 25 | add_array_value | core-test-data | Validation | 1.65 | 1.72 | 0.18 | 28.6 us | 17.3 us | 4.3 | 6.91 us (14%) | 41.5 us | 1% | 3.13 us | ModelManagerHandle.modelFileGetFullyQualifiedTypeName x2.7, ModelManagerHandle.modelFileResolveType x1.0, ModelManagerHandle.validatePropertyById x0.6 | ts-core 53.4%, views 23.1%, core 9.1%, glue 7% |
| 26 | new_resource | core-test-data | Instance | 1.38 | 1.93 | - | 9.45 us | 6.86 us | 0.8 | 1.47 us (7%) | 18.2 us | 2% | - | ModelManagerHandle.modelFileResolveType x0.7, ModelManagerHandle.validatePropertyById x0.1 | views 40.1%, ts-core 36.5%, glue 8.8%, other 8% |
| 27 | to_json | conformance | Serialisation | 1.33 | 1.64 | 0.23 | 10.5 us | 7.88 us | 1.0 | 8.01 us (65%) | 4.36 us | 1% | 1.82 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 61.1%, encode 22.5%, ts-core 6.1%, glue 4.7% |
| 28 | add_cto_model | synthetic-large | Model | 1.33 | 1.29 | 0.07 | 32.92 ms | 24.75 ms | 5.0 | 3.94 ms (13%) | 26.04 ms | 9% | 1.79 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 | cto-parser 69.4%, core 13.6%, gc 8.5%, ts-core 6.3% |
| 29 | to_json | core-test-data | Serialisation | 1.27 | 1.18 | 0.24 | 45.8 us | 36.1 us | 1.0 | 30.4 us (62%) | 18.3 us | 1% | 8.76 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 63.5%, encode 25.8%, ts-core 3.7%, other 3.1% |
| 30 | from_json | synthetic-large | Serialisation | 1.27 | 1.07 | 0.40 | 25.5 us | 20.1 us | 1.0 | 17.4 us (62%) | 10.9 us | 2% | 8.11 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 | core 61.1%, encode 29.4%, glue 2.3%, other 2% |
| 31 | validate_instance_or_throw | synthetic-large | Validation: | 1.19 | 1.04 | 0.25 | 31.0 us | 26.0 us | 1.0 | 16.5 us (52%) | 15.5 us | 3% | 6.59 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 | core 49.2%, encode 34.2%, ts-core 7.7%, gc 3.3% |
| 32 | get_namespaces | synthetic-large | Introspection | 1.17 | 1.25 | 0.43 | 0.17 us | 0.14 us | 0.0 | 0.00 us (0%) | 0.23 us | 6% | 0.06 us |  | other 81.2%, ts-core 13.4%, gc 5.5% |
| 33 | validate | synthetic-large | Validation | 1.14 | 1.10 | 0.27 | 8.05 us | 7.09 us | 1.0 | 6.21 us (57%) | 4.74 us | 1% | 1.91 us | ModelManagerHandle.validateResourceBinary x1.0 | core 62.5%, ts-core 28.7%, glue 4.8%, other 2.1% |
| 34 | validate | conformance | Validation | 1.06 | 0.98 | 0.21 | 4.33 us | 4.07 us | 1.0 | 3.10 us (24%) | 9.82 us | 1% | 0.85 us | ModelManagerHandle.validateResourceBinary x1.0 | core 56.9%, ts-core 30.2%, glue 7.3%, other 2.9% |
| 35 | new_resource | conformance | Instance | 1.03 | 1.07 | 0.27 | 4.66 us | 4.51 us | 0.1 | 0.17 us (2%) | 6.48 us | 2% | 1.21 us | ModelManagerHandle.modelFileResolveType x0.1 | views 46.4%, ts-core 42.6%, other 5.9%, glue 2.6% |
| 36 | mm_new | (system) | Model | 1.01 | 0.92 | 0.00 | 427.5 us | 421.4 us | 3.0 | 53.6 us (5%) | 1.03 ms | 6% | 1.46 us | new ModelManagerHandle x1.0, ModelManagerHandle.setDecoratorValidation x1.0, ModelManagerHandle.setDangerouslyAllowReservedSystemTypeNamesInUserModels x1.0 | ts-core 58.1%, views 29.9%, gc 6.1%, core 3.8% |

## Crossings per item of P5-109's gap rows

P5-109's ranked gap rows (TS API slower than TS 5.0.0 in P5-109), with the crossings per item P5-109 recorded, this run's before-side (the same heads) and now, and the now x TS.

| op | set | P5-109 x TS API | P5-109 crossings/item | before | **now** | now - before | x TS API now | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---|
| modelfile_new | conformance | 3.54 | 1.00 | 1.00 | **1.00** | 0.00 | 4.89 | ModelManagerHandle.stageModelFileBytes x1.0 |
| modelfile_new | core-test-data | 3.52 | 1.06 | 1.06 | **1.06** | 0.00 | 5.47 | ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 |
| modelfile_new | synthetic-large | 3.43 | 1.00 | 1.00 | **1.00** | 0.00 | 3.52 | ModelManagerHandle.stageModelFileBytes x1.0 |
| resolve_type_first | core-test-data | 3.23 | 1.00 | 1.00 | **1.00** | 0.00 | 3.64 | ModelManagerHandle.resolveType x1.0 |
| get_type_first | core-test-data | 3.19 | 1.00 | 1.00 | **1.00** | 0.00 | 3.30 | ModelManagerHandle.getTypeName x1.0 |
| add_model_file | synthetic-large | 2.92 | 5.00 | 5.00 | **5.00** | 0.00 | 3.98 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 |
| add_array_value | conformance | 2.80 | 1.00 | 1.00 | **1.00** | 0.00 | 2.06 | ModelManagerHandle.validatePropertyById x1.0 |
| add_cto_model | conformance | 2.77 | 2.07 | 2.07 | **2.07** | 0.00 | 2.77 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 |
| extract_cold | synthetic-large | 2.56 | 8.00 | 8.00 | **5.00** | -3.00 | 2.55 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 |
| extract_cold | conformance | 2.52 | 8.00 | 8.00 | **5.00** | -3.00 | 2.05 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 |
| resolve_type_first | conformance | 2.52 | 1.00 | 1.00 | **1.00** | 0.00 | 2.48 | ModelManagerHandle.resolveType x1.0 |
| get_type_first | synthetic-large | 2.36 | 1.00 | 1.00 | **1.00** | 0.00 | 2.59 | ModelManagerHandle.getTypeName x1.0 |
| get_type_first | conformance | 2.31 | 1.00 | 1.00 | **1.00** | 0.00 | 2.69 | ModelManagerHandle.getTypeName x1.0 |
| add_cto_model | core-test-data | 2.22 | 2.14 | 2.14 | **2.14** | 0.00 | 2.57 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, modelFileIsCompatibleVersion x0.1 |
| add_array_value | synthetic-large | 2.17 | 1.00 | 1.00 | **1.00** | 0.00 | 3.10 | ModelManagerHandle.validatePropertyById x1.0 |
| to_json | synthetic-large | 2.17 | 1.00 | 1.00 | **1.00** | 0.00 | 2.10 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| resolve_type_first | synthetic-large | 2.00 | 1.00 | 1.00 | **1.00** | 0.00 | 2.36 | ModelManagerHandle.resolveType x1.0 |
| add_model_file | conformance | 1.90 | 2.07 | 2.07 | **2.07** | 0.00 | 1.85 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x0.0 |
| get_namespaces | synthetic-large | 1.82 | 0.00 | 0.00 | **0.00** | 0.00 | 1.17 |  |
| set_property_value | conformance | 1.71 | 0.27 | 0.27 | **0.23** | -0.03 | 2.63 | ModelManagerHandle.validatePropertyById x0.2, ModelManagerHandle.modelFileResolveType x0.0 |
| add_array_value | core-test-data | 1.67 | 6.38 | 6.38 | **4.27** | -2.11 | 1.65 | ModelManagerHandle.modelFileGetFullyQualifiedTypeName x2.7, ModelManagerHandle.modelFileResolveType x1.0, ModelManagerHandle.validatePropertyById x0.6 |
| extract_cold | core-test-data | 1.60 | 10.00 | 10.00 | **7.00** | -3.00 | 1.68 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, modelFileIsCompatibleVersion x2.0 |
| new_resource | core-test-data | 1.56 | 2.49 | 2.49 | **0.76** | -1.73 | 1.38 | ModelManagerHandle.modelFileResolveType x0.7, ModelManagerHandle.validatePropertyById x0.1 |
| add_model_file | core-test-data | 1.56 | 2.14 | 2.14 | **2.14** | 0.00 | 1.71 | ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.stageModelFileBytes x1.0, modelFileIsCompatibleVersion x0.1 |
| set_property_value | synthetic-large | 1.48 | 0.20 | 0.20 | **0.20** | 0.00 | 2.01 | ModelManagerHandle.validatePropertyById x0.2 |
| to_json | core-test-data | 1.46 | 1.00 | 1.00 | **1.00** | 0.00 | 1.27 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| derives_from | core-test-data | 1.44 | 1.00 | 1.00 | **1.00** | 0.00 | 2.19 | ModelManagerHandle.derivesFrom x1.0 |
| to_json | conformance | 1.39 | 1.00 | 1.00 | **1.00** | 0.00 | 1.33 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| new_resource | synthetic-large | 1.35 | 1.00 | 1.00 | **0.00** | -1.00 | 0.99 |  |
| derives_from | synthetic-large | 1.24 | 1.00 | 1.00 | **1.00** | 0.00 | 0.57 | ModelManagerHandle.derivesFrom x1.0 |
| add_cto_model | synthetic-large | 1.23 | 5.00 | 5.00 | **5.00** | 0.00 | 1.33 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, ModelManagerHandle.setDecoratorValidation x1.0 |
| get_namespaces_first | synthetic-large | 1.18 | 0.00 | 0.00 | **0.00** | 0.00 | 2.70 |  |
| get_type | core-test-data | 1.15 | 0.00 | 0.00 | **0.00** | 0.00 | 0.79 |  |
| validate | synthetic-large | 1.15 | 1.00 | 1.00 | **1.00** | 0.00 | 1.14 | ModelManagerHandle.validateResourceBinary x1.0 |
| new_resource | conformance | 1.14 | 1.18 | 1.18 | **0.09** | -1.09 | 1.03 | ModelManagerHandle.modelFileResolveType x0.1 |
| derives_from | conformance | 1.11 | 1.00 | 1.00 | **1.00** | 0.00 | 0.96 | ModelManagerHandle.derivesFrom x1.0 |
| from_json | synthetic-large | 1.08 | 1.00 | 1.00 | **1.00** | 0.00 | 1.27 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| validate | conformance | 1.01 | 1.00 | 1.00 | **1.00** | 0.00 | 1.06 | ModelManagerHandle.validateResourceBinary x1.0 |

## mm_new, absolute (us per manager, each round's median)

| side | round 1 | round 2 | round 3 | median |
|---|---:|---:|---:|---:|
| TS 5.0.0 | 421.4 | 449.0 | 401.2 | 421.4 |
| before (P5-109 now heads) | 414.2 | 380.6 | 387.5 | 387.5 |
| now | 427.5 | 720.8 | 408.6 | 427.5 |
| now, metamodelValidation:false | 231.2 | 166.6 | 180.3 | 180.3 |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | before x TS on | crossings on / off |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 421.4 us | 427.5 us | 180.3 us | 247.2 us | 2.37 | 1.01 | 0.43 | 0.92 | 3.0 / 3.0 |
| modelfile_new | core-test-data | 29.5 us | 161.4 us | 86.0 us | 75.4 us | 1.88 | 5.47 | 2.91 | 3.47 | 1.1 / 1.1 |
| modelfile_new | conformance | 9.77 us | 47.7 us | 53.9 us | -6.18 us | 0.89 | 4.89 | 5.52 | 3.70 | 1.0 / 1.0 |
| modelfile_new | synthetic-large | 728.7 us | 2.56 ms | 2.55 ms | 11.8 us | 1.00 | 3.52 | 3.50 | 3.59 | 1.0 / 1.0 |
| add_model_file | core-test-data | 74.3 us | 127.0 us | 123.3 us | 3.72 us | 1.03 | 1.71 | 1.66 | 1.60 | 2.1 / 2.1 |
| add_model_file | conformance | 27.5 us | 50.8 us | 48.4 us | 2.38 us | 1.05 | 1.85 | 1.76 | 1.81 | 2.1 / 2.1 |
| add_model_file | synthetic-large | 2.58 ms | 10.26 ms | 8.68 ms | 1.58 ms | 1.18 | 3.98 | 3.37 | 3.12 | 5.0 / 5.0 |
| add_cto_model | core-test-data | 480.4 us | 1.24 ms | 1.18 ms | 51.5 us | 1.04 | 2.57 | 2.46 | 2.51 | 2.1 / 2.1 |
| add_cto_model | conformance | 166.6 us | 462.3 us | 470.3 us | -8.05 us | 0.98 | 2.77 | 2.82 | 2.32 | 2.1 / 2.1 |
| add_cto_model | synthetic-large | 24.75 ms | 32.92 ms | 31.15 ms | 1.77 ms | 1.06 | 1.33 | 1.26 | 1.29 | 5.0 / 5.0 |

## Typed read allocations (P5-90 method)

| set | input bytes | allocs | reallocs | bytes requested | P5-109 (allocs / bytes) | native read | WASM stage | WASM drop | WASM / native | TS 5.0.0 new ModelFile | native / TS |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| concerto-core-test-data | 3,259 | 32 | 2 | 18,559 | 34 / 18,593 | 16.09 us | 29.79 us | 1.70 us | 1.85 | 29.5 us | 0.54 |
| conformance | 1,300 | 14 | 1 | 5,896 | 14 / 5,936 | 6.50 us | 12.30 us | 0.36 us | 1.89 | 9.8 us | 0.67 |
| synthetic-large | 229,584 | 271 | 1 | 1,109,251 | 284 / 1,109,717 | 738.83 us | 1175.07 us | 23.81 us | 1.59 | 728.7 us | 1.01 |

## Web bundle size (P5-39 method)

KB = 1000 B; gzip -9, brotli q11.

| entry | v5.0.0 raw / gz / br | engine raw / gz / br | engine x v5 (raw / gz / br) | P5-109 engine raw / gz / br |
|---|---|---|---|---|
| E1, `keepNames` | 387.9 / 94.3 / 67.7 | 5,265.4 / 1,788.4 / 1,166.3 | 13.6 / 19.0 / 17.2 | 5,652.2 / 1,903.1 / 1,235.5 |
| E2, `keepNames` | 388.0 / 94.4 / 67.7 | 5,265.4 / 1,788.5 / 1,166.0 | 13.6 / 19.0 / 17.2 | 5,652.3 / 1,903.1 / 1,235.2 |
| E3, `keepNames` | 386.2 / 94.2 / 67.5 | 5,263.7 / 1,788.2 / 1,165.2 | 13.6 / 19.0 / 17.3 | 5,650.5 / 1,902.9 / 1,234.7 |
| E1, no `keepNames` | 371.7 / 89.5 / 63.9 | 5,238.5 / 1,780.5 / 1,159.4 | 14.1 / 19.9 / 18.1 | 5,625.7 / 1,895.7 / 1,230.1 |
| E2, no `keepNames` | 371.7 / 89.6 / 64.0 | 5,238.5 / 1,780.6 / 1,159.5 | 14.1 / 19.9 / 18.1 | 5,625.7 / 1,895.8 / 1,230.2 |
| E3, no `keepNames` | 370.0 / 89.4 / 63.7 | 5,236.7 / 1,780.4 / 1,159.2 | 14.2 / 19.9 / 18.2 | 5,623.9 / 1,895.5 / 1,229.8 |

| part | raw / gz / br | P5-109 raw / gz / br |
|---|---|---|
| `.wasm` | 3,577.7 / 1,145.0 / 745.9 | 3,871.5 / 1,224.2 / 789.4 |
| the same as base64 | 4,770.3 / 1,665.1 / 1,073.2 | 5,162.0 / 1,780.9 / 1,144.8 |
| `concerto-engine.mjs` (glue + base64) | 4,771.2 / 1,665.8 / 1,073.4 | 5,162.8 / 1,781.4 / 1,144.6 |
| JS without the engine package (E1, keepNames) | 441.5 / 112.1 / 83.4 | 436.4 / 110.4 / 82.5 |
| `concerto-engine.cjs` (Node), raw | 4,926.1 | 5,341.7 |

Errors:
- from_json_relmap/p5109: now: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36; before: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
- to_json_relmap/p5109: now: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36; before: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
- from_json_deep/p5121: before: SyntaxError: recursion limit exceeded at line 1 column 6241
- to_json_deep/p5121: before: SyntaxError: recursion limit exceeded at line 1 column 6241
- validate_instance_deep/p5121: before: SyntaxError: recursion limit exceeded at line 1 column 6241
