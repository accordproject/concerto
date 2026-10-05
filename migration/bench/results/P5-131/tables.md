Rounds: now 1, 2, 3, before 1, 2, 3. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS). "before" is P5-121's now heads.

## Rows at or below TS 5.0.0

| level | before | **now** |
|---|---:|---:|
| TS API, the 79 P5-96 rows (73 + validateInstance) | 39 | **39** |
| crate (of 63) | 60 | **60** |
| TS API, P5-106's subclass queries (of 6) | 6 | **6** |

## Geometric mean of x TS by category

"P5-96 rows" leaves out the subclass queries, so it is the row set of P5-96's categories. validateInstance (validate_instance, validate_instance_or_throw) is its own series, not blended into Validation.

| category | rows | TS API: before | **now** | crate: before | **now** | TS API, P5-96 rows: before | **now** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Model loading | 10 | 2.21 | **1.89** | 0.18 | **0.18** | 2.21 | **1.89** |
| Introspection (including decorators/DCS) | 51 | 0.59 | **0.58** | 0.20 | **0.21** | 0.79 | **0.78** |
| Serialisation | 6 | 1.11 | **1.18** | 0.25 | **0.28** | 1.11 | **1.18** |
| Instance creation | 3 | 1.13 | **0.99** | 0.34 | **0.32** | 1.13 | **0.99** |
| Validation | 9 | 1.56 | **1.57** | 0.38 | **0.38** | 1.56 | **1.57** |
| Validation: validateInstance | 6 | 0.72 | **0.75** | 0.18 | **0.18** | 0.72 | **0.75** |

### Model loading

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 566.2 us | 0.00 | **0.00** | 0.70 | **0.09** | 52.2 us | 3.0 | 1.0 | 14% | 33% |
| modelfile_new | core-test-data | 38.6 us | 0.43 | **0.52** | 3.72 | **2.55** | 98.5 us | 1.1 | 1.0 | 58% | 4% |
| modelfile_new | conformance | 9.87 us | 0.67 | **0.62** | 5.43 | **6.16** | 60.8 us | 1.0 | 1.0 | 58% | 7% |
| modelfile_new | synthetic-large | 769.6 us | 1.07 | **1.01** | 3.50 | **3.47** | 2.67 ms | 1.0 | 1.0 | 31% | 7% |
| add_model_file | core-test-data | 72.7 us | 0.58 | **0.57** | 1.97 | **2.64** | 192.1 us | 2.1 | 2.0 | 67% | 23% |
| add_model_file | conformance | 43.0 us | 0.28 | **0.28** | 1.20 | **1.72** | 73.8 us | 2.1 | 2.0 | 59% | 22% |
| add_model_file | synthetic-large | 2.89 ms | 0.64 | **0.68** | 3.20 | **3.18** | 9.19 ms | 5.0 | 3.0 | 74% | 18% |
| add_cto_model | core-test-data | 492.6 us | 0.09 | **0.08** | 2.50 | **2.42** | 1.19 ms | 2.1 | 2.0 | 17% | 16% |
| add_cto_model | conformance | 178.7 us | 0.07 | **0.07** | 2.37 | **2.51** | 448.5 us | 2.1 | 2.0 | 19% | 9% |
| add_cto_model | synthetic-large | 25.05 ms | 0.07 | **0.08** | 1.27 | **1.32** | 33.17 ms | 5.0 | 3.0 | 13% | 9% |

### Introspection (including decorators/DCS)

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.44 us | 0.16 | **0.18** | 1.19 | **1.11** | 0.49 us | 0.0 | 0.0 | 0% | 1% |
| get_type | conformance | 0.56 us | 0.11 | **0.12** | 0.74 | **0.94** | 0.52 us | 0.0 | 0.0 | 0% | 2% |
| get_type | synthetic-large | 1.10 us | 0.06 | **0.07** | 0.39 | **0.43** | 0.47 us | 0.0 | 0.0 | 0% | 2% |
| get_type_first | core-test-data | 0.43 us | - | - | 5.53 | **3.68** | 1.60 us | 1.0 | 1.0 | 48% | 2% |
| get_type_first | conformance | 0.55 us | - | - | 3.47 | **2.85** | 1.57 us | 1.0 | 1.0 | 47% | 2% |
| get_type_first | synthetic-large | 0.57 us | - | - | 2.86 | **2.89** | 1.64 us | 1.0 | 1.0 | 53% | 2% |
| resolve_type | core-test-data | 0.59 us | 0.14 | **0.14** | 0.14 | **0.20** | 0.11 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | conformance | 0.69 us | 0.10 | **0.11** | 0.14 | **0.19** | 0.13 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type | synthetic-large | 0.59 us | 0.15 | **0.14** | 0.15 | **0.17** | 0.10 us | 0.0 | 0.0 | 0% | 0% |
| resolve_type_first | core-test-data | 0.31 us | - | - | 3.84 | **3.72** | 1.16 us | 1.0 | 1.0 | 76% | 2% |
| resolve_type_first | conformance | 0.38 us | - | - | 3.07 | **2.78** | 1.07 us | 1.0 | 1.0 | 82% | 2% |
| resolve_type_first | synthetic-large | 0.38 us | - | - | 3.04 | **3.33** | 1.27 us | 1.0 | 1.0 | 53% | 2% |
| get_namespaces | core-test-data | 0.87 us | 1.48 | **1.45** | 0.47 | **0.35** | 0.30 us | 0.0 | 0.0 | 0% | 12% |
| get_namespaces | conformance | 0.95 us | 1.36 | **1.43** | 0.30 | **0.23** | 0.22 us | 0.0 | 0.0 | 0% | 14% |
| get_namespaces | synthetic-large | 0.15 us | 0.41 | **0.44** | 2.02 | **1.80** | 0.27 us | 0.0 | 0.0 | 0% | 7% |
| get_namespaces_first | core-test-data | 0.88 us | - | - | 0.25 | **0.31** | 0.28 us | 0.0 | 0.0 | 0% | 12% |
| get_namespaces_first | conformance | 0.98 us | - | - | 0.24 | **0.27** | 0.26 us | 0.0 | 0.0 | 0% | 13% |
| get_namespaces_first | synthetic-large | 0.17 us | - | - | 1.30 | **1.47** | 0.24 us | 0.0 | 0.0 | 0% | 7% |
| derives_from | core-test-data | 0.74 us | 0.13 | **0.14** | 1.38 | **1.37** | 1.01 us | 1.0 | 1.0 | 42% | 0% |
| derives_from | conformance | 0.77 us | 0.11 | **0.12** | 1.54 | **0.97** | 0.74 us | 1.0 | 1.0 | 70% | 0% |
| derives_from | synthetic-large | 0.72 us | 0.15 | **0.15** | 0.82 | **1.15** | 0.83 us | 1.0 | 1.0 | 50% | 0% |
| is_assignable_to | core-test-data | 1.31 us | 0.12 | **0.13** | 0.83 | **1.53** | 2.00 us | 1.0 | 1.0 | 78% | 0% |
| is_assignable_to | conformance | 1.33 us | 0.12 | **0.13** | 0.80 | **1.25** | 1.66 us | 1.0 | 1.0 | 74% | 0% |
| is_assignable_to | synthetic-large | 1.22 us | 0.15 | **0.15** | 0.62 | **1.30** | 1.59 us | 1.0 | 1.0 | 51% | 0% |
| get_decorators | core-test-data | 0.20 us | 0.03 | **0.03** | 0.54 | **0.55** | 0.11 us | 0.0 | 0.0 | 0% | 2% |
| get_decorators | conformance | 0.13 us | 0.04 | **0.04** | 0.85 | **0.54** | 0.07 us | 0.0 | 0.0 | 0% | 1% |
| get_decorators | synthetic-large | 0.03 us | 0.25 | **0.23** | 1.79 | **0.97** | 0.02 us | 0.0 | 0.0 | 0% | 1% |
| dcs_decorate | core-test-data | 46.40 ms | 0.24 (rebuild 0.36) | **0.24** (rebuild 0.34) | 0.86 | **0.80** | 37.22 ms | 8.0 | 4.0 | 97% | 17% |
| dcs_decorate | conformance | 22.98 ms | 0.16 (rebuild 0.26) | **0.15** (rebuild 0.26) | 0.57 | **0.60** | 13.81 ms | 6.0 | 4.0 | 93% | 21% |
| dcs_decorate | synthetic-large | 71.35 ms | 0.28 (rebuild 0.54) | **0.26** (rebuild 0.44) | 0.67 | **0.78** | 55.34 ms | 6.0 | 4.0 | 97% | 15% |
| dcs_validate | core-test-data | 40.05 ms | 0.12 (rebuild 0.19) | **0.13** (rebuild 0.18) | 0.59 | **0.56** | 22.45 ms | 45.0 | 41.0 | 79% | 13% |
| dcs_validate | conformance | 20.04 ms | 0.08 (rebuild 0.12) | **0.08** (rebuild 0.12) | 0.82 | **0.72** | 14.44 ms | 52.0 | 48.0 | 88% | 15% |
| dcs_validate | synthetic-large | 59.18 ms | 0.16 (rebuild 0.24) | **0.19** (rebuild 0.23) | 0.65 | **0.64** | 37.71 ms | 12.0 | 8.0 | 95% | 12% |
| extract_decorators | core-test-data | 9.69 ms | 0.48 (rebuild 0.84) | **0.44** (rebuild 0.80) | 0.44 | **0.45** | 4.38 ms | 7.0 | 3.0 | 83% | 8% |
| extract_decorators | conformance | 4.42 ms | 0.30 (rebuild 0.52) | **0.39** (rebuild 0.58) | 0.35 | **0.35** | 1.57 ms | 5.0 | 3.0 | 66% | 13% |
| extract_decorators | synthetic-large | 10.80 ms | 0.82 (rebuild 1.54) | **0.75** (rebuild 1.43) | 0.70 | **0.52** | 5.63 ms | 5.0 | 3.0 | 90% | 8% |
| extract_vocabularies | core-test-data | 8.85 ms | 0.55 (rebuild 1.03) | **0.53** (rebuild 0.92) | 0.37 | **0.36** | 3.20 ms | 7.0 | 3.0 | 79% | 13% |
| extract_vocabularies | conformance | 3.33 ms | 0.42 (rebuild 0.73) | **0.45** (rebuild 0.75) | 0.38 | **0.40** | 1.34 ms | 5.0 | 3.0 | 65% | 16% |
| extract_vocabularies | synthetic-large | 10.96 ms | 0.80 (rebuild 1.60) | **0.79** (rebuild 1.47) | 0.42 | **0.39** | 4.24 ms | 5.0 | 3.0 | 91% | 11% |
| extract_cold | core-test-data | 8.66 ms | - | - | 1.61 | **2.06** | 17.87 ms | 7.0 | 3.0 | 93% | 40% |
| extract_cold | conformance | 2.77 ms | - | - | 1.92 | **1.71** | 4.74 ms | 5.0 | 3.0 | 87% | 26% |
| extract_cold | synthetic-large | 13.85 ms | - | - | 1.67 | **1.48** | 20.47 ms | 5.0 | 3.0 | 96% | 57% |
| extract_keep | core-test-data | 8.10 ms | - | - | 0.79 | **0.61** | 4.95 ms | 7.0 | 3.0 | 90% | 11% |
| extract_keep | conformance | 4.67 ms | - | - | 0.54 | **0.29** | 1.38 ms | 5.0 | 3.0 | 78% | 14% |
| extract_keep | synthetic-large | 12.29 ms | - | - | 0.56 | **0.55** | 6.70 ms | 5.0 | 3.0 | 97% | 11% |
| get_assignable_class_declarations | core-test-data | 54.4 us | - | - | 0.06 | **0.06** | 3.24 us | 1.0 | 1.0 | 71% | 3% |
| get_assignable_class_declarations | conformance | 19.1 us | - | - | 0.18 | **0.12** | 2.37 us | 1.0 | 1.0 | 72% | 4% |
| get_assignable_class_declarations | synthetic-large | 46.3 us | - | - | 0.06 | **0.05** | 2.17 us | 1.0 | 1.0 | 45% | 4% |
| get_direct_subclasses | core-test-data | 37.3 us | - | - | 0.06 | **0.04** | 1.67 us | 1.0 | 1.0 | 45% | 3% |
| get_direct_subclasses | conformance | 18.2 us | - | - | 0.09 | **0.07** | 1.33 us | 1.0 | 1.0 | 48% | 4% |
| get_direct_subclasses | synthetic-large | 42.6 us | - | - | 0.03 | **0.05** | 2.10 us | 1.0 | 1.0 | 45% | 3% |

### Serialisation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 64.0 us | 0.21 | **0.27** | 0.78 | **0.77** | 49.0 us | 1.0 | 1.0 | 59% | 1% |
| from_json | conformance | 18.0 us | 0.18 | **0.20** | 0.67 | **0.81** | 14.6 us | 1.0 | 1.0 | 37% | 2% |
| from_json | synthetic-large | 22.3 us | 0.36 | **0.40** | 1.03 | **1.04** | 23.2 us | 1.0 | 1.0 | 60% | 2% |
| to_json | core-test-data | 35.3 us | 0.26 | **0.28** | 1.61 | **1.19** | 42.2 us | 1.0 | 1.0 | 65% | 1% |
| to_json | conformance | 8.25 us | 0.21 | **0.23** | 1.38 | **2.18** | 18.0 us | 1.0 | 1.0 | 64% | 1% |
| to_json | synthetic-large | 14.2 us | 0.35 | **0.35** | 1.53 | **1.58** | 22.5 us | 1.0 | 1.0 | 65% | 1% |

### Instance creation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new_resource | core-test-data | 7.21 us | - | - | 1.24 | **1.17** | 8.44 us | 0.8 | 0.1 | 2% | 2% |
| new_resource | conformance | 4.86 us | 0.25 | **0.26** | 1.05 | **0.88** | 4.29 us | 0.1 | 0.0 | 0% | 3% |
| new_resource | synthetic-large | 3.52 us | 0.47 | **0.38** | 1.10 | **0.95** | 3.33 us | 0.0 | 0.0 | 0% | 2% |

### Validation

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate | core-test-data | 18.2 us | 0.16 | **0.17** | 0.93 | **0.94** | 17.1 us | 1.0 | 1.0 | 53% | 1% |
| validate | conformance | 4.11 us | 0.22 | **0.22** | 1.06 | **1.13** | 4.65 us | 1.0 | 1.0 | 24% | 2% |
| validate | synthetic-large | 6.62 us | 0.30 | **0.30** | 1.30 | **1.25** | 8.26 us | 1.0 | 1.0 | 61% | 2% |
| set_property_value | core-test-data | 2.22 us | 0.43 | **0.41** | 1.06 | **1.23** | 2.74 us | 0.2 | 0.2 | 34% | 2% |
| set_property_value | conformance | 0.65 us | 0.70 | **0.67** | 2.82 | **2.66** | 1.73 us | 0.2 | 0.2 | 23% | 3% |
| set_property_value | synthetic-large | 0.86 us | 0.71 | **0.73** | 1.53 | **1.51** | 1.30 us | 0.2 | 0.2 | 30% | 2% |
| add_array_value | core-test-data | 18.9 us | 0.17 | **0.18** | 1.71 | **1.68** | 31.8 us | 4.3 | 0.6 | 4% | 1% |
| add_array_value | conformance | 1.22 us | 0.52 | **0.52** | 2.21 | **2.15** | 2.61 us | 1.0 | 1.0 | 7% | 2% |
| add_array_value | synthetic-large | 1.03 us | 0.83 | **0.75** | 2.53 | **2.49** | 2.57 us | 1.0 | 1.0 | 34% | 2% |

### Validation: validateInstance

| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| validate_instance | core-test-data | 87.1 us | 0.17 | **0.17** | 0.50 | **0.62** | 53.7 us | 1.0 | 1.0 | 67% | 4% |
| validate_instance | conformance | 30.4 us | 0.10 | **0.10** | 0.47 | **0.58** | 17.6 us | 1.0 | 1.0 | 40% | 9% |
| validate_instance | synthetic-large | 26.6 us | 0.29 | **0.29** | 0.86 | **0.97** | 25.7 us | 1.0 | 1.0 | 67% | 6% |
| validate_instance_or_throw | core-test-data | 74.2 us | 0.18 | **0.19** | 0.72 | **0.72** | 53.2 us | 1.0 | 1.0 | 59% | 3% |
| validate_instance_or_throw | conformance | 21.3 us | 0.13 | **0.14** | 0.81 | **0.64** | 13.7 us | 1.0 | 1.0 | 34% | 6% |
| validate_instance_or_throw | synthetic-large | 27.1 us | 0.27 | **0.27** | 1.15 | **1.10** | 29.8 us | 1.0 | 1.0 | 55% | 3% |

## P5-109 rows (the `p5109` pseudo-set, TS API only)

| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_json_map | fromJSON, 1,000-entry String map | 543.1 us | 1.32 ms | **1.27 ms** | 0.96 | 2.43 | **2.33** | 1.00 | 1.00 | 1% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_relmap | fromJSON, 1,000-entry relationship map | - | 6.74 ms | **6.78 ms** | 1.01 | - | - | 1.00 | 1.00 | 2% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| to_json_map | toJSON, 1,000-entry String map | 787.9 us | 1.10 ms | **903.5 us** | 0.82 | 1.39 | **1.15** | 1.00 | 1.00 | 2% | ModelManagerHandle.serializerToJsonBytes x1.0 |
| to_json_relmap | toJSON, 1,000-entry relationship map | - | 6.25 ms | **6.22 ms** | 0.99 | - | - | 1.00 | 1.00 | 1% | ModelManagerHandle.serializerToJsonBytes x1.0 |
| validate_instance_collect_all | validateInstance, collectAll, 6 errors | 67.7 us | 43.7 us | **43.3 us** | 0.99 | 0.65 | **0.64** | 1.00 | 1.00 | 3% | ModelManagerHandle.validateInstanceBytes x1.0 |
| validate_instance_first_error | validateInstance, collectAll:false | 58.7 us | 17.9 us | **17.0 us** | 0.95 | 0.31 | **0.29** | 1.00 | 1.00 | 4% | ModelManagerHandle.validateInstanceBytes x1.0 |
| get_type_p5109 | getType, nothing changed | 0.50 us | 1.13 us | **0.69 us** | 0.61 | 2.27 | **1.39** | 0.00 | 0.00 | 2% | - |
| get_type_after_update | getType after updateModelFile of the supertype file | 0.47 us | 1.61 us | **1.37 us** | 0.85 | 3.41 | **2.91** | 1.00 | 1.00 | - | ModelManagerHandle.getTypeName x1.0 |
| get_type_other_mutated | getType while a second manager changes | 0.42 us | 0.54 us | **0.33 us** | 0.60 | 1.29 | **0.78** | 0.00 | 0.00 | - | - |
| resolve_type_p5109 | resolveType, nothing changed | 0.30 us | 0.14 us | **0.10 us** | 0.72 | 0.47 | **0.34** | 0.00 | 0.00 | 1% | - |
| resolve_type_after_update | resolveType after updateModelFile of the supertype file | 0.26 us | 1.39 us | **1.03 us** | 0.74 | 5.43 | **4.01** | 1.00 | 1.00 | - | ModelManagerHandle.resolveType x1.0 |
| resolve_type_other_mutated | resolveType while a second manager changes | 0.25 us | 0.04 us | **0.03 us** | 0.91 | 0.15 | **0.14** | 0.00 | 0.00 | - | - |

## P5-121 rows (the `p5121` pseudo-set, TS API only)

| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_json_numkeys | fromJSON, 100,000 numeric-string map keys (1 document) | 74.94 ms | 173.14 ms | **176.34 ms** | 1.02 | 2.31 | **2.35** | 1.00 | 1.00 | 4% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_strkeys | fromJSON, 100,000 non-numeric map keys (1 document, reference) | 190.28 ms | 188.91 ms | **204.47 ms** | 1.08 | 0.99 | **1.07** | 1.00 | 1.00 | 5% | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| from_json_deep | fromJSON, 200-deep nested instance | 3.90 ms | 3.13 ms | **3.00 ms** | 0.96 | 0.80 | **0.77** | 401.00 | 2.00 | 4% | ModelManagerHandle.validateResourceBinary x1.0, ModelManagerHandle.serializerFromJsonCompact x1.0 |
| to_json_deep | toJSON, 200-deep nested instance | 2.80 ms | 3.11 ms | **2.91 ms** | 0.94 | 1.11 | **1.04** | 1195.00 | 399.00 | 3% | ModelManagerHandle.serializerToJson x1.0, ModelManagerHandle.modelUtilIsEnum x199.0, ModelManagerHandle.modelUtilIsMap x199.0 |
| validate_instance_deep | validateInstance, 200-deep nested instance | 5.09 ms | 3.56 ms | **3.69 ms** | 1.04 | 0.70 | **0.73** | 402.00 | 3.00 | 4% | ModelManagerHandle.validateResourceBinary x1.0, ModelManagerHandle.validateInstance x1.0, ModelManagerHandle.serializerFromJsonCompact x1.0 |

## P5-131 rows (TS API only)

| op | what | set | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| from_ast_fresh | fromAst on a fresh manager (P5-124), per model file | core-test-data | 66.5 us | 305.3 us | **324.2 us** | 1.06 | 4.59 | **4.87** | 2.26 | 1.11 | 23% | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateModelFiles x0.0, ModelManagerHandle.commitStagedModelFiles x0.0 |
| from_ast_fresh | fromAst on a fresh manager (P5-124), per model file | conformance | 42.9 us | 93.2 us | **76.7 us** | 0.82 | 2.17 | **1.79** | 2.17 | 1.10 | 22% | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateModelFiles x0.0, ModelManagerHandle.commitStagedModelFiles x0.0 |
| from_ast_fresh | fromAst on a fresh manager (P5-124), per model file | synthetic-large | 3.90 ms | 10.69 ms | **12.90 ms** | 1.21 | 2.74 | **3.31** | 9.00 | 5.00 | 19% | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateModelFiles x1.0, ModelManagerHandle.commitStagedModelFile x1.0 |
| get_ast | getAst(true) (P5-125 item 13), per model file | core-test-data | - | - | **-** | - | - | - | - | - | 78% | - |
| get_ast | getAst(true) (P5-125 item 13), per model file | conformance | 23.8 us | 15.8 us | **14.2 us** | 0.89 | 0.67 | **0.59** | 0.00 | 0.00 | 2% | - |
| get_ast | getAst(true) (P5-125 item 13), per model file | synthetic-large | 1.84 ms | 2.90 ms | **3.05 ms** | 1.05 | 1.58 | **1.66** | 0.00 | 0.00 | 5% | - |

## P5-125's rows: crossings per item and x TS, before and now

Crossings are from each side's count run (`summary/crossings.json`), per item.

| op | set | crossings/item before | **now** | now - before | x TS API before | **now** | TS API before | now | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| validate_instance_or_throw | core-test-data | 1.00 | **1.00** | 0.00 | 0.72 | **0.72** | 53.4 us | 53.2 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| validate_instance_or_throw | conformance | 1.00 | **1.00** | 0.00 | 0.81 | **0.64** | 17.3 us | 13.7 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| validate_instance_or_throw | synthetic-large | 1.00 | **1.00** | 0.00 | 1.15 | **1.10** | 31.3 us | 29.8 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| new_resource | core-test-data | 0.76 | **0.07** | -0.69 | 1.24 | **1.17** | 8.97 us | 8.44 us | ModelManagerHandle.validatePropertyById x0.1 |
| new_resource | conformance | 0.09 | **0.00** | -0.09 | 1.05 | **0.88** | 5.09 us | 4.29 us | - |
| new_resource | synthetic-large | 0.00 | **0.00** | 0.00 | 1.10 | **0.95** | 3.87 us | 3.33 us | - |
| add_array_value | core-test-data | 4.27 | **0.62** | -3.65 | 1.71 | **1.68** | 32.4 us | 31.8 us | ModelManagerHandle.validatePropertyById x0.6, ModelManagerHandle.modelUtilIsAssignableTo x0.0 |
| add_array_value | conformance | 1.00 | **1.00** | 0.00 | 2.21 | **2.15** | 2.69 us | 2.61 us | ModelManagerHandle.validatePropertyById x1.0 |
| add_array_value | synthetic-large | 1.00 | **1.00** | 0.00 | 2.53 | **2.49** | 2.61 us | 2.57 us | ModelManagerHandle.validatePropertyById x1.0 |
| to_json_deep | p5121 | 1195.00 | **399.00** | -796.00 | 1.11 | **1.04** | 3.11 ms | 2.91 ms | ModelManagerHandle.serializerToJson x1.0, ModelManagerHandle.modelUtilIsEnum x199.0, ModelManagerHandle.modelUtilIsMap x199.0 |
| extract_cold | core-test-data | 7.00 | **3.00** | -4.00 | 1.61 | **2.06** | 13.93 ms | 17.87 ms | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 |
| extract_cold | conformance | 5.00 | **3.00** | -2.00 | 1.92 | **1.71** | 5.33 ms | 4.74 ms | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 |
| extract_cold | synthetic-large | 5.00 | **3.00** | -2.00 | 1.67 | **1.48** | 23.06 ms | 20.47 ms | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, new ModelManagerHandle x1.0 |
| dcs_validate | core-test-data | 45.00 | **41.00** | -4.00 | 0.59 | **0.56** | 23.62 ms | 22.45 ms | ModelManagerHandle.dcsValidate x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x2.0, ModelManagerHandle.addModelWithDefinitions x34.0 |
| dcs_validate | conformance | 52.00 | **48.00** | -4.00 | 0.82 | **0.72** | 16.49 ms | 14.44 ms | ModelManagerHandle.dcsValidate x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x2.0, ModelManagerHandle.addModelWithDefinitions x41.0 |
| dcs_validate | synthetic-large | 12.00 | **8.00** | -4.00 | 0.65 | **0.64** | 38.59 ms | 37.71 ms | ModelManagerHandle.dcsValidate x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x2.0, ModelManagerHandle.addModelWithDefinitions x1.0 |
| dcs_decorate | core-test-data | 8.00 | **4.00** | -4.00 | 0.86 | **0.80** | 39.92 ms | 37.22 ms | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, ModelManagerHandle.commitStagedModelFiles x1.0 |
| dcs_decorate | conformance | 6.00 | **4.00** | -2.00 | 0.57 | **0.60** | 13.13 ms | 13.81 ms | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, ModelManagerHandle.commitStagedModelFiles x1.0 |
| dcs_decorate | synthetic-large | 6.00 | **4.00** | -2.00 | 0.67 | **0.78** | 47.95 ms | 55.34 ms | ModelManagerHandle.dcsDecorateModels x1.0, checkAstShape x1.0, ModelManagerHandle.commitStagedModelFile x1.0 |
| get_ast | core-test-data | - | **-** | - | - | - | - | - | - |
| get_ast | conformance | 0.00 | **0.00** | 0.00 | 0.67 | **0.59** | 15.8 us | 14.2 us | - |
| get_ast | synthetic-large | 0.00 | **0.00** | 0.00 | 1.58 | **1.66** | 2.90 ms | 3.05 ms | - |

## Introspection, now against before

now / before of the median time per item (> 1 = now slower). `*` marks a ratio over 1.05.

| op | set | crate before | crate now | **crate now / before** | TS API before | TS API now | **TS API now / before** |
|---|---|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 0.07 us | 0.08 us | **1.14** * | 0.52 us | 0.49 us | **0.93** |
| get_type | conformance | 0.06 us | 0.07 us | **1.10** * | 0.42 us | 0.52 us | **1.26** * |
| get_type | synthetic-large | 0.07 us | 0.07 us | **1.06** * | 0.43 us | 0.47 us | **1.10** * |
| get_type_first | core-test-data | - | - | - | 2.40 us | 1.60 us | **0.67** |
| get_type_first | conformance | - | - | - | 1.91 us | 1.57 us | **0.82** |
| get_type_first | synthetic-large | - | - | - | 1.63 us | 1.64 us | **1.01** |
| resolve_type | core-test-data | 0.08 us | 0.08 us | **0.97** | 0.08 us | 0.11 us | **1.37** * |
| resolve_type | conformance | 0.07 us | 0.07 us | **1.06** * | 0.10 us | 0.13 us | **1.33** * |
| resolve_type | synthetic-large | 0.09 us | 0.08 us | **0.90** | 0.09 us | 0.10 us | **1.14** * |
| resolve_type_first | core-test-data | - | - | - | 1.19 us | 1.16 us | **0.97** |
| resolve_type_first | conformance | - | - | - | 1.18 us | 1.07 us | **0.91** |
| resolve_type_first | synthetic-large | - | - | - | 1.16 us | 1.27 us | **1.10** * |
| get_namespaces | core-test-data | 1.29 us | 1.26 us | **0.98** | 0.41 us | 0.30 us | **0.73** |
| get_namespaces | conformance | 1.29 us | 1.36 us | **1.06** * | 0.29 us | 0.22 us | **0.75** |
| get_namespaces | synthetic-large | 0.06 us | 0.07 us | **1.07** * | 0.30 us | 0.27 us | **0.89** |
| get_namespaces_first | core-test-data | - | - | - | 0.22 us | 0.28 us | **1.24** * |
| get_namespaces_first | conformance | - | - | - | 0.24 us | 0.26 us | **1.09** * |
| get_namespaces_first | synthetic-large | - | - | - | 0.21 us | 0.24 us | **1.13** * |
| derives_from | core-test-data | 0.09 us | 0.10 us | **1.08** * | 1.02 us | 1.01 us | **0.99** |
| derives_from | conformance | 0.09 us | 0.09 us | **1.04** | 1.18 us | 0.74 us | **0.63** |
| derives_from | synthetic-large | 0.11 us | 0.11 us | **1.00** | 0.59 us | 0.83 us | **1.40** * |
| is_assignable_to | core-test-data | 0.16 us | 0.17 us | **1.05** * | 1.09 us | 2.00 us | **1.84** * |
| is_assignable_to | conformance | 0.16 us | 0.17 us | **1.10** * | 1.06 us | 1.66 us | **1.57** * |
| is_assignable_to | synthetic-large | 0.18 us | 0.18 us | **1.00** | 0.76 us | 1.59 us | **2.10** * |
| get_decorators | core-test-data | 0.01 us | 0.01 us | **1.01** | 0.11 us | 0.11 us | **1.02** |
| get_decorators | conformance | 0.01 us | 0.01 us | **0.98** | 0.11 us | 0.07 us | **0.64** |
| get_decorators | synthetic-large | 0.01 us | 0.01 us | **0.93** | 0.05 us | 0.02 us | **0.54** |
| dcs_decorate | core-test-data | 11.06 ms | 11.26 ms | **1.02** | 39.92 ms | 37.22 ms | **0.93** |
| dcs_decorate | conformance | 3.72 ms | 3.54 ms | **0.95** | 13.13 ms | 13.81 ms | **1.05** * |
| dcs_decorate | synthetic-large | 20.27 ms | 18.67 ms | **0.92** | 47.95 ms | 55.34 ms | **1.15** * |
| dcs_validate | core-test-data | 4.94 ms | 5.15 ms | **1.04** | 23.62 ms | 22.45 ms | **0.95** |
| dcs_validate | conformance | 1.63 ms | 1.65 ms | **1.02** | 16.49 ms | 14.44 ms | **0.88** |
| dcs_validate | synthetic-large | 9.70 ms | 11.23 ms | **1.16** * | 38.59 ms | 37.71 ms | **0.98** |
| extract_decorators | core-test-data | 4.63 ms | 4.29 ms | **0.93** | 4.27 ms | 4.38 ms | **1.03** |
| extract_decorators | conformance | 1.34 ms | 1.70 ms | **1.27** * | 1.55 ms | 1.57 ms | **1.01** |
| extract_decorators | synthetic-large | 8.83 ms | 8.11 ms | **0.92** | 7.56 ms | 5.63 ms | **0.75** |
| extract_vocabularies | core-test-data | 4.91 ms | 4.74 ms | **0.96** | 3.24 ms | 3.20 ms | **0.99** |
| extract_vocabularies | conformance | 1.41 ms | 1.49 ms | **1.06** * | 1.27 ms | 1.34 ms | **1.05** * |
| extract_vocabularies | synthetic-large | 8.78 ms | 8.65 ms | **0.99** | 4.64 ms | 4.24 ms | **0.91** |
| extract_cold | core-test-data | - | - | - | 13.93 ms | 17.87 ms | **1.28** * |
| extract_cold | conformance | - | - | - | 5.33 ms | 4.74 ms | **0.89** |
| extract_cold | synthetic-large | - | - | - | 23.06 ms | 20.47 ms | **0.89** |
| extract_keep | core-test-data | - | - | - | 6.37 ms | 4.95 ms | **0.78** |
| extract_keep | conformance | - | - | - | 2.50 ms | 1.38 ms | **0.55** |
| extract_keep | synthetic-large | - | - | - | 6.93 ms | 6.70 ms | **0.97** |
| get_assignable_class_declarations | core-test-data | - | - | - | 3.20 us | 3.24 us | **1.01** |
| get_assignable_class_declarations | conformance | - | - | - | 3.47 us | 2.37 us | **0.68** |
| get_assignable_class_declarations | synthetic-large | - | - | - | 2.58 us | 2.17 us | **0.84** |
| get_direct_subclasses | core-test-data | - | - | - | 2.22 us | 1.67 us | **0.75** |
| get_direct_subclasses | conformance | - | - | - | 1.63 us | 1.33 us | **0.82** |
| get_direct_subclasses | synthetic-large | - | - | - | 1.18 us | 2.10 us | **1.77** * |

## Remaining gaps (TS API slower than TS 5.0.0), ranked

"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector's share of the V8 profile of the TS-API loop; "native crate" is the crate row (the same engine work, native).

| # | op | set | category | x TS API | before | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | modelfile_new | conformance | Model | 6.16 | 5.43 | 0.62 | 60.8 us | 9.87 us | 1.0 | 28.4 us (58%) | 20.9 us | 7% | 6.12 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 46.4%, views 23.4%, ts-core 18.8%, gc 7% |
| 2 | resolve_type_first | core-test-data | Introspection | 3.72 | 3.84 | - | 1.16 us | 0.31 us | 1.0 | 1.17 us (76%) | 0.37 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 32.6%, core 32.5%, other 18.6%, ts-core 14.6% |
| 3 | get_type_first | core-test-data | Introspection | 3.68 | 5.53 | - | 1.60 us | 0.43 us | 1.0 | 0.90 us (48%) | 0.98 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | ts-core 21.8%, views 21.4%, core 20.8%, glue 19.1% |
| 4 | modelfile_new | synthetic-large | Model | 3.47 | 3.50 | 1.01 | 2.67 ms | 769.6 us | 1.0 | 2.09 ms (31%) | 4.76 ms | 7% | 775.6 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 52.5%, ts-core 36.7%, gc 7.1%, views 2.2% |
| 5 | resolve_type_first | synthetic-large | Introspection | 3.33 | 3.04 | - | 1.27 us | 0.38 us | 1.0 | 1.26 us (53%) | 1.14 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 34.4%, core 29.9%, other 17.4%, ts-core 16.5% |
| 6 | add_model_file | synthetic-large | Model | 3.18 | 3.20 | 0.68 | 9.19 ms | 2.89 ms | 3.0 | 3.19 ms (74%) | 1.13 ms | 18% | 1.97 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 | core 57.8%, ts-core 20.5%, gc 17.8%, views 2% |
| 7 | get_type_first | synthetic-large | Introspection | 2.89 | 2.86 | - | 1.64 us | 0.57 us | 1.0 | 1.01 us (53%) | 0.90 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | views 28.1%, ts-core 21.1%, core 19.5%, glue 18.1% |
| 8 | get_type_first | conformance | Introspection | 2.85 | 3.47 | - | 1.57 us | 0.55 us | 1.0 | 0.87 us (47%) | 0.97 us | 2% | - | ModelManagerHandle.getTypeName x1.0 | views 24.3%, ts-core 21.7%, glue 20.2%, core 17.3% |
| 9 | resolve_type_first | conformance | Introspection | 2.78 | 3.07 | - | 1.07 us | 0.38 us | 1.0 | 1.31 us (82%) | 0.29 us | 2% | - | ModelManagerHandle.resolveType x1.0 | glue 32%, core 29.5%, other 21.6%, ts-core 14.8% |
| 10 | set_property_value | conformance | Validation | 2.66 | 2.82 | 0.67 | 1.73 us | 0.65 us | 0.2 | 0.44 us (23%) | 1.44 us | 3% | 0.44 us | ModelManagerHandle.validatePropertyById x0.2 | ts-core 30.3%, core 24.2%, views 16.9%, other 14.6% |
| 11 | add_model_file | core-test-data | Model | 2.64 | 1.97 | 0.57 | 192.1 us | 72.7 us | 2.0 | 90.6 us (67%) | 45.3 us | 23% | 41.6 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | core 54.7%, gc 22.8%, ts-core 11.6%, views 8.5% |
| 12 | modelfile_new | core-test-data | Model | 2.55 | 3.72 | 0.52 | 98.5 us | 38.6 us | 1.0 | 64.8 us (58%) | 47.3 us | 4% | 20.1 us | ModelManagerHandle.stageModelFileBytes x1.0 | core 57.3%, ts-core 21.5%, views 14.1%, gc 4.1% |
| 13 | add_cto_model | conformance | Model | 2.51 | 2.37 | 0.07 | 448.5 us | 178.7 us | 2.0 | 51.9 us (19%) | 219.2 us | 9% | 12.0 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | cto-parser 54.6%, core 19.7%, views 8.9%, gc 8.5% |
| 14 | add_array_value | synthetic-large | Validation | 2.49 | 2.53 | 0.75 | 2.57 us | 1.03 us | 1.0 | 1.62 us (34%) | 3.18 us | 2% | 0.77 us | ModelManagerHandle.validatePropertyById x1.0 | ts-core 26.2%, core 25.2%, glue 24.2%, other 11.1% |
| 15 | add_cto_model | core-test-data | Model | 2.42 | 2.50 | 0.08 | 1.19 ms | 492.6 us | 2.0 | 141.5 us (17%) | 690.4 us | 16% | 41.6 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | cto-parser 54.1%, core 19.1%, gc 16.1%, ts-core 5.2% |
| 16 | to_json | conformance | Serialisation | 2.18 | 1.38 | 0.23 | 18.0 us | 8.25 us | 1.0 | 7.73 us (64%) | 4.34 us | 1% | 1.92 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 62.2%, encode 22.5%, ts-core 6.2%, glue 4.5% |
| 17 | add_array_value | conformance | Validation | 2.15 | 2.21 | 0.52 | 2.61 us | 1.22 us | 1.0 | 1.69 us (7%) | 23.4 us | 2% | 0.63 us | ModelManagerHandle.validatePropertyById x1.0 | ts-core 28.1%, core 27.7%, glue 21.9%, other 10.9% |
| 18 | extract_cold | core-test-data | Introspection | 2.06 | 1.61 | - | 17.87 ms | 8.66 ms | 3.0 | 13.42 ms (93%) | 1.06 ms | 40% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 | core 46.6%, gc 40.1%, glue 6.7%, views 3.7% |
| 19 | get_namespaces | synthetic-large | Introspection | 1.80 | 2.02 | 0.44 | 0.27 us | 0.15 us | 0.0 | 0.00 us (0%) | 0.28 us | 7% | 0.07 us |  | other 83.1%, ts-core 10.4%, gc 6.5% |
| 20 | add_model_file | conformance | Model | 1.72 | 1.20 | 0.28 | 73.8 us | 43.0 us | 2.0 | 37.5 us (59%) | 25.8 us | 22% | 12.0 us | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 | core 49.7%, gc 21.6%, views 13.5%, ts-core 12.1% |
| 21 | extract_cold | conformance | Introspection | 1.71 | 1.92 | - | 4.74 ms | 2.77 ms | 3.0 | 6.24 ms (87%) | 942.5 us | 26% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 | core 55%, gc 25.6%, views 8.3%, glue 6.7% |
| 22 | add_array_value | core-test-data | Validation | 1.68 | 1.71 | 0.18 | 31.8 us | 18.9 us | 0.6 | 1.52 us (4%) | 35.0 us | 1% | 3.49 us | ModelManagerHandle.validatePropertyById x0.6, ModelManagerHandle.modelUtilIsAssignableTo x0.0 | ts-core 63.7%, views 25.7%, core 3.6%, other 3.5% |
| 23 | to_json | synthetic-large | Serialisation | 1.58 | 1.53 | 0.35 | 22.5 us | 14.2 us | 1.0 | 14.1 us (65%) | 7.77 us | 1% | 4.90 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 65.2%, encode 23.2%, ts-core 5.8%, other 2.3% |
| 24 | is_assignable_to | core-test-data | Introspection | 1.53 | 0.83 | 0.13 | 2.00 us | 1.31 us | 1.0 | 1.14 us (78%) | 0.33 us | 0% | 0.17 us | ModelManagerHandle.isAssignableTo x1.0 | core 60.2%, glue 20.6%, ts-core 16.8%, other 2.2% |
| 25 | set_property_value | synthetic-large | Validation | 1.51 | 1.53 | 0.73 | 1.30 us | 0.86 us | 0.2 | 0.50 us (30%) | 1.15 us | 2% | 0.63 us | ModelManagerHandle.validatePropertyById x0.2 | core 28.4%, ts-core 27.9%, views 15.4%, other 13.7% |
| 26 | extract_cold | synthetic-large | Introspection | 1.48 | 1.67 | - | 20.47 ms | 13.85 ms | 3.0 | 25.25 ms (96%) | 937.2 us | 57% | - | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, new ModelManagerHandle x1.0 | gc 56.6%, core 34.5%, glue 6%, ts-core 1.2% |
| 27 | get_namespaces_first | synthetic-large | Introspection | 1.47 | 1.30 | - | 0.24 us | 0.17 us | 0.0 | 0.00 us (0%) | 0.70 us | 7% | - |  | other 81%, ts-core 12.1%, gc 6.8% |
| 28 | derives_from | core-test-data | Introspection | 1.37 | 1.38 | 0.14 | 1.01 us | 0.74 us | 1.0 | 1.71 us (42%) | 2.41 us | 0% | 0.10 us | ModelManagerHandle.derivesFrom x1.0 | core 49.8%, glue 25%, ts-core 22.1%, other 2.9% |
| 29 | add_cto_model | synthetic-large | Model | 1.32 | 1.27 | 0.08 | 33.17 ms | 25.05 ms | 3.0 | 4.21 ms (13%) | 28.20 ms | 9% | 1.97 ms | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 | cto-parser 70.4%, core 13.1%, gc 9.3%, ts-core 5.6% |
| 30 | is_assignable_to | synthetic-large | Introspection | 1.30 | 0.62 | 0.15 | 1.59 us | 1.22 us | 1.0 | 1.22 us (51%) | 1.16 us | 0% | 0.18 us | ModelManagerHandle.isAssignableTo x1.0 | core 58.9%, glue 33.9%, other 6.8%, gc 0.3% |
| 31 | is_assignable_to | conformance | Introspection | 1.25 | 0.80 | 0.13 | 1.66 us | 1.33 us | 1.0 | 1.32 us (74%) | 0.46 us | 0% | 0.17 us | ModelManagerHandle.isAssignableTo x1.0 | core 58.9%, glue 32.9%, other 8%, gc 0.3% |
| 32 | validate | synthetic-large | Validation | 1.25 | 1.30 | 0.30 | 8.26 us | 6.62 us | 1.0 | 6.75 us (61%) | 4.30 us | 2% | 1.97 us | ModelManagerHandle.validateResourceBinary x1.0 | core 61.8%, ts-core 32.2%, glue 2%, gc 1.7% |
| 33 | set_property_value | core-test-data | Validation | 1.23 | 1.06 | 0.41 | 2.74 us | 2.22 us | 0.2 | 1.75 us (34%) | 3.43 us | 2% | 0.91 us | ModelManagerHandle.validatePropertyById x0.2 | core 34.8%, ts-core 31.3%, views 15.9%, other 11.7% |
| 34 | to_json | core-test-data | Serialisation | 1.19 | 1.61 | 0.28 | 42.2 us | 35.3 us | 1.0 | 28.2 us (65%) | 15.5 us | 1% | 9.76 us | ModelManagerHandle.serializerToJsonBytes x1.0 | core 64.5%, encode 25.9%, ts-core 4%, other 3.2% |
| 35 | new_resource | core-test-data | Instance | 1.17 | 1.24 | - | 8.44 us | 7.21 us | 0.1 | 0.23 us (2%) | 10.1 us | 2% | - | ModelManagerHandle.validatePropertyById x0.1 | ts-core 43.4%, views 43%, other 9%, gc 1.6% |
| 36 | derives_from | synthetic-large | Introspection | 1.15 | 0.82 | 0.15 | 0.83 us | 0.72 us | 1.0 | 1.37 us (50%) | 1.38 us | 0% | 0.11 us | ModelManagerHandle.derivesFrom x1.0 | core 47.1%, glue 43.3%, other 9%, gc 0.4% |
| 37 | validate | conformance | Validation | 1.13 | 1.06 | 0.22 | 4.65 us | 4.11 us | 1.0 | 4.14 us (24%) | 13.5 us | 2% | 0.92 us | ModelManagerHandle.validateResourceBinary x1.0 | core 57.4%, ts-core 36.2%, glue 2.2%, gc 1.5% |
| 38 | get_type | core-test-data | Introspection | 1.11 | 1.19 | 0.18 | 0.49 us | 0.44 us | 0.0 | 0.00 us (0%) | 0.88 us | 1% | 0.08 us |  | other 45.1%, ts-core 37.3%, views 16%, gc 1.4% |
| 39 | validate_instance_or_throw | synthetic-large | Validation: | 1.10 | 1.15 | 0.27 | 29.8 us | 27.1 us | 1.0 | 18.0 us (55%) | 14.8 us | 3% | 7.33 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 | core 52.8%, encode 33.7%, ts-core 3.4%, gc 3.3% |
| 40 | from_json | synthetic-large | Serialisation | 1.04 | 1.03 | 0.40 | 23.2 us | 22.3 us | 1.0 | 16.0 us (60%) | 10.6 us | 2% | 8.99 us | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 | core 59.6%, encode 30.4%, glue 2.7%, other 2.1% |

## Crossings per item of P5-121's gap rows

P5-121's ranked gap rows (TS API slower than TS 5.0.0 in P5-121), with the crossings per item P5-121 recorded, this run's before-side (the same heads) and now, and the now x TS.

| op | set | P5-121 x TS API | P5-121 crossings/item | before | **now** | now - before | x TS API now | top bindings now |
|---|---|---:|---:|---:|---:|---:|---:|---|
| modelfile_new | core-test-data | 5.47 | 1.06 | 1.06 | **1.00** | -0.06 | 2.55 | ModelManagerHandle.stageModelFileBytes x1.0 |
| modelfile_new | conformance | 4.89 | 1.00 | 1.00 | **1.00** | 0.00 | 6.16 | ModelManagerHandle.stageModelFileBytes x1.0 |
| add_model_file | synthetic-large | 3.98 | 5.00 | 5.00 | **3.00** | -2.00 | 3.18 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 |
| resolve_type_first | core-test-data | 3.64 | 1.00 | 1.00 | **1.00** | 0.00 | 3.72 | ModelManagerHandle.resolveType x1.0 |
| modelfile_new | synthetic-large | 3.52 | 1.00 | 1.00 | **1.00** | 0.00 | 3.47 | ModelManagerHandle.stageModelFileBytes x1.0 |
| get_type_first | core-test-data | 3.30 | 1.00 | 1.00 | **1.00** | 0.00 | 3.68 | ModelManagerHandle.getTypeName x1.0 |
| add_array_value | synthetic-large | 3.10 | 1.00 | 1.00 | **1.00** | 0.00 | 2.49 | ModelManagerHandle.validatePropertyById x1.0 |
| add_cto_model | conformance | 2.77 | 2.07 | 2.07 | **2.02** | -0.05 | 2.51 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 |
| get_namespaces_first | synthetic-large | 2.70 | 0.00 | 0.00 | **0.00** | 0.00 | 1.47 |  |
| get_type_first | conformance | 2.69 | 1.00 | 1.00 | **1.00** | 0.00 | 2.85 | ModelManagerHandle.getTypeName x1.0 |
| set_property_value | conformance | 2.63 | 0.23 | 0.23 | **0.22** | -0.02 | 2.66 | ModelManagerHandle.validatePropertyById x0.2 |
| get_type_first | synthetic-large | 2.59 | 1.00 | 1.00 | **1.00** | 0.00 | 2.89 | ModelManagerHandle.getTypeName x1.0 |
| add_cto_model | core-test-data | 2.57 | 2.14 | 2.14 | **2.03** | -0.11 | 2.42 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 |
| extract_cold | synthetic-large | 2.55 | 5.00 | 5.00 | **3.00** | -2.00 | 1.48 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFile x1.0, new ModelManagerHandle x1.0 |
| resolve_type_first | conformance | 2.48 | 1.00 | 1.00 | **1.00** | 0.00 | 2.78 | ModelManagerHandle.resolveType x1.0 |
| resolve_type_first | synthetic-large | 2.36 | 1.00 | 1.00 | **1.00** | 0.00 | 3.33 | ModelManagerHandle.resolveType x1.0 |
| derives_from | core-test-data | 2.19 | 1.00 | 1.00 | **1.00** | 0.00 | 1.37 | ModelManagerHandle.derivesFrom x1.0 |
| to_json | synthetic-large | 2.10 | 1.00 | 1.00 | **1.00** | 0.00 | 1.58 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| add_array_value | conformance | 2.06 | 1.00 | 1.00 | **1.00** | 0.00 | 2.15 | ModelManagerHandle.validatePropertyById x1.0 |
| extract_cold | conformance | 2.05 | 5.00 | 5.00 | **3.00** | -2.00 | 1.71 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 |
| set_property_value | synthetic-large | 2.01 | 0.20 | 0.20 | **0.20** | 0.00 | 1.51 | ModelManagerHandle.validatePropertyById x0.2 |
| add_model_file | conformance | 1.85 | 2.07 | 2.07 | **2.02** | -0.05 | 1.72 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 |
| add_model_file | core-test-data | 1.71 | 2.14 | 2.14 | **2.03** | -0.11 | 2.64 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x0.0 |
| extract_cold | core-test-data | 1.68 | 7.00 | 7.00 | **3.00** | -4.00 | 2.06 | ModelManagerHandle.dcsExtract x1.0, ModelManagerHandle.commitStagedModelFiles x1.0, new ModelManagerHandle x1.0 |
| add_array_value | core-test-data | 1.65 | 4.27 | 4.27 | **0.62** | -3.65 | 1.68 | ModelManagerHandle.validatePropertyById x0.6, ModelManagerHandle.modelUtilIsAssignableTo x0.0 |
| new_resource | core-test-data | 1.38 | 0.76 | 0.76 | **0.07** | -0.69 | 1.17 | ModelManagerHandle.validatePropertyById x0.1 |
| to_json | conformance | 1.33 | 1.00 | 1.00 | **1.00** | 0.00 | 2.18 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| add_cto_model | synthetic-large | 1.33 | 5.00 | 5.00 | **3.00** | -2.00 | 1.32 | ModelManagerHandle.stageModelFileBytes x1.0, ModelManagerHandle.validateAndCommitStagedModelFile x1.0, new ModelManagerHandle x1.0 |
| to_json | core-test-data | 1.27 | 1.00 | 1.00 | **1.00** | 0.00 | 1.19 | ModelManagerHandle.serializerToJsonBytes x1.0 |
| from_json | synthetic-large | 1.27 | 1.00 | 1.00 | **1.00** | 0.00 | 1.04 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| validate_instance_or_throw | synthetic-large | 1.19 | 1.00 | 1.00 | **1.00** | 0.00 | 1.10 | ModelManagerHandle.serializerFromJsonCompactBytes x1.0 |
| get_namespaces | synthetic-large | 1.17 | 0.00 | 0.00 | **0.00** | 0.00 | 1.80 |  |
| validate | synthetic-large | 1.14 | 1.00 | 1.00 | **1.00** | 0.00 | 1.25 | ModelManagerHandle.validateResourceBinary x1.0 |
| validate | conformance | 1.06 | 1.00 | 1.00 | **1.00** | 0.00 | 1.13 | ModelManagerHandle.validateResourceBinary x1.0 |
| new_resource | conformance | 1.03 | 0.09 | 0.09 | **0.00** | -0.09 | 0.88 |  |
| mm_new | (system) | 1.01 | 3.00 | 3.00 | **1.00** | -2.00 | 0.09 | new ModelManagerHandle x1.0 |

## mm_new, absolute (us per manager, each round's median)

| side | round 1 | round 2 | round 3 | median |
|---|---:|---:|---:|---:|
| TS 5.0.0 | 660.7 | 375.0 | 566.2 | 566.2 |
| before (P5-121 now heads) | 394.5 | 753.8 | 374.1 | 394.5 |
| now | 57.5 | 52.2 | 39.1 | 52.2 |
| now, metamodelValidation:false | 37.0 | 63.7 | 42.7 | 42.7 |

## BC-19: default on against metamodelValidation:false (TS API, same run)

| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | before x TS on | crossings on / off |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mm_new | (system models) | 566.2 us | 52.2 us | 42.7 us | 9.52 us | 1.22 | 0.09 | 0.08 | 0.70 | 1.0 / 1.0 |
| modelfile_new | core-test-data | 38.6 us | 98.5 us | 138.6 us | -40.05 us | 0.71 | 2.55 | 3.59 | 3.72 | 1.0 / 1.1 |
| modelfile_new | conformance | 9.87 us | 60.8 us | 51.6 us | 9.25 us | 1.18 | 6.16 | 5.23 | 5.43 | 1.0 / 1.0 |
| modelfile_new | synthetic-large | 769.6 us | 2.67 ms | 3.43 ms | -761.71 us | 0.78 | 3.47 | 4.46 | 3.50 | 1.0 / 1.0 |
| add_model_file | core-test-data | 72.7 us | 192.1 us | 138.5 us | 53.6 us | 1.39 | 2.64 | 1.91 | 1.97 | 2.0 / 2.1 |
| add_model_file | conformance | 43.0 us | 73.8 us | 55.0 us | 18.8 us | 1.34 | 1.72 | 1.28 | 1.20 | 2.0 / 2.0 |
| add_model_file | synthetic-large | 2.89 ms | 9.19 ms | 9.98 ms | -785.29 us | 0.92 | 3.18 | 3.45 | 3.20 | 3.0 / 3.0 |
| add_cto_model | core-test-data | 492.6 us | 1.19 ms | 1.46 ms | -262.42 us | 0.82 | 2.42 | 2.96 | 2.50 | 2.0 / 2.1 |
| add_cto_model | conformance | 178.7 us | 448.5 us | 459.8 us | -11.32 us | 0.98 | 2.51 | 2.57 | 2.37 | 2.0 / 2.0 |
| add_cto_model | synthetic-large | 25.05 ms | 33.17 ms | 33.64 ms | -463.82 us | 0.99 | 1.32 | 1.34 | 1.27 | 3.0 / 3.0 |
| from_ast_fresh | core-test-data | 66.5 us | 324.2 us | 249.4 us | 74.8 us | 1.30 | 4.87 | 3.75 | 4.59 | 1.1 / 1.2 |
| from_ast_fresh | conformance | 42.9 us | 76.7 us | 100.7 us | -23.98 us | 0.76 | 1.79 | 2.35 | 2.17 | 1.1 / 1.1 |
| from_ast_fresh | synthetic-large | 3.90 ms | 12.90 ms | 9.35 ms | 3.55 ms | 1.38 | 3.31 | 2.40 | 2.74 | 5.0 / 5.0 |

## Typed read allocations (P5-90 method)

| set | input bytes | allocs | reallocs | bytes requested | P5-121 (allocs / bytes) | native read | WASM stage | WASM drop | WASM / native | TS 5.0.0 new ModelFile | native / TS |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| concerto-core-test-data | 3,259 | 32 | 2 | 18,559 | 32 / 18,559 | 26.22 us | 37.67 us | 2.10 us | 1.44 | 38.6 us | 0.68 |
| conformance | 1,300 | 14 | 1 | 5,896 | 14 / 5,896 | 10.24 us | 13.59 us | 0.43 us | 1.33 | 9.9 us | 1.04 |
| synthetic-large | 229,584 | 271 | 1 | 1,109,251 | 271 / 1,109,251 | 1306.31 us | 1301.20 us | 25.67 us | 1.00 | 769.6 us | 1.70 |

## Web bundle size (P5-39 method)

KB = 1000 B; gzip -9, brotli q11. "engine JS" is the bundle the app ships; "shipped" adds the `.wasm` the loader fetches (P5-121's engine bundle had it inline as base64, so its bundle is its shipped total).

| entry | v5.0.0 raw / gz / br | engine JS raw / gz / br | **shipped (JS + .wasm) raw / gz / br** | shipped x v5 (raw / gz / br) | P5-121 engine (base64 inline) raw / gz / br | shipped / P5-121 (raw / gz / br) |
|---|---|---|---|---|---|---|
| E1, `keepNames` | 387.9 / 94.3 / 67.7 | 618.9 / 158.1 / 123.3 | **4,209.2 / 1,308.9 / 872.3** | 10.85 / 13.88 / 12.89 | 5,265.4 / 1,788.4 / 1,166.3 | 0.80 / 0.73 / 0.75 |
| E2, `keepNames` | 388.0 / 94.4 / 67.7 | 618.9 / 158.2 / 123.4 | **4,209.2 / 1,309.0 / 872.4** | 10.85 / 13.87 / 12.89 | 5,265.4 / 1,788.5 / 1,166.0 | 0.80 / 0.73 / 0.75 |
| E3, `keepNames` | 386.2 / 94.2 / 67.5 | 617.2 / 158.0 / 123.2 | **4,207.4 / 1,308.8 / 872.3** | 10.89 / 13.90 / 12.92 | 5,263.7 / 1,788.2 / 1,165.2 | 0.80 / 0.73 / 0.75 |
| E1, no `keepNames` | 371.7 / 89.5 / 63.9 | 586.0 / 149.1 / 115.6 | **4,176.3 / 1,299.9 / 864.6** | 11.24 / 14.52 / 13.53 | 5,238.5 / 1,780.5 / 1,159.4 | 0.80 / 0.73 / 0.75 |
| E2, no `keepNames` | 371.7 / 89.6 / 64.0 | 586.1 / 149.1 / 115.5 | **4,176.3 / 1,299.9 / 864.6** | 11.24 / 14.51 / 13.50 | 5,238.5 / 1,780.6 / 1,159.5 | 0.80 / 0.73 / 0.75 |
| E3, no `keepNames` | 370.0 / 89.4 / 63.7 | 584.3 / 148.9 / 115.5 | **4,174.6 / 1,299.7 / 864.5** | 11.28 / 14.54 / 13.57 | 5,236.7 / 1,780.4 / 1,159.2 | 0.80 / 0.73 / 0.75 |

| part | raw / gz / br | P5-121 raw / gz / br |
|---|---|---|
| `.wasm` | 3,590.3 / 1,150.8 / 749.0 | 3,577.7 / 1,145.0 / 745.9 |
| the same as base64 (P5-121 shipped this, inside the loader) | 4,787.0 / 1,674.4 / 1,080.5 | 4,770.3 / 1,665.1 / 1,073.2 |
| `concerto-engine.mjs` (now: the loader; P5-121: glue + base64) | 1.0 / 0.5 / 0.4 | 4,771.2 / 1,665.8 / 1,073.4 |
| `web/concerto_wasm.js` (now: the wasm-bindgen glue) | 154.3 / 22.3 / 18.8 | - |
| JS without the engine package (E1, keepNames) | 564.9 / 150.3 / 116.4 | 441.5 / 112.1 / 83.4 |
| `concerto-engine.cjs` (Node), raw | 154.4 | 4,926.1 |

Errors:
- from_json_relmap/p5109: now: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36; before: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
- to_json_relmap/p5109: now: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36; before: ValidationException: Unexpected properties for type p5109.maps@1.0.0.Person: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36
- get_ast/concerto-core-test-data: now: Error: Name Missing not found; before: Error: Name Missing not found
