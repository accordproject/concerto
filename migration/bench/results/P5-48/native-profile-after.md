## after-add-conf.cg: 463,170,238 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 30.5% |
| JSON decode (serde_json de, typed AST read) | 27.7% |
| concerto-core logic | 10.3% |
| memcpy/memmove/memcmp | 8.8% |
| IndexMap/HashMap tables | 6.7% |
| other | 5.5% |
| hashing (SipHash, FxHash) | 4.4% |
| string building (fmt, format!) | 3.7% |
| clone | 0.8% |
| regex / identifier checks | 0.7% |
| drop (destructors) | 0.6% |
| Value build/encode (serde_json ser, to_value) | 0.2% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 49.0% |
| ModelFile build after decode (ModelFile::load) | 22.1% |
|   declaration/property construction (Declaration::from_typed) | 11.6% |
|   Value-path declarations (Declaration::from_model_json) | 6.9% |
|   namespace/import parse (parse_namespace_with) | 3.1% |
|   check_imports | 5.6% |
|   declaration checks (Declaration::validate) | 14.3% |
|   check_unique_field_names | 4.9% |
|   super_type_fqn | 2.5% |
| in-place validate and register (validate_and_add_model_file, P5-48) | 24.7% |
| ModelManager::new | 0.6% |

## after-add-ctd.cg: 741,872,527 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 27.4% |
| JSON decode (serde_json de, typed AST read) | 23.3% |
| memcpy/memmove/memcmp | 14.2% |
| concerto-core logic | 13.0% |
| IndexMap/HashMap tables | 7.2% |
| hashing (SipHash, FxHash) | 4.5% |
| string building (fmt, format!) | 4.2% |
| other | 3.4% |
| clone | 0.9% |
| regex / identifier checks | 0.9% |
| drop (destructors) | 0.7% |
| Value build/encode (serde_json ser, to_value) | 0.2% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 53.8% |
| ModelFile build after decode (ModelFile::load) | 10.8% |
|   declaration/property construction (Declaration::from_typed) | 6.4% |
|   Value-path declarations (Declaration::from_model_json) | 3.0% |
|   namespace/import parse (parse_namespace_with) | 0.9% |
|   check_imports | 1.8% |
|   declaration checks (Declaration::validate) | 27.6% |
|   check_unique_field_names | 9.3% |
|   super_type_fqn | 5.2% |
| in-place validate and register (validate_and_add_model_file, P5-48) | 33.6% |
| ModelManager::new | 0.3% |

## after-add-syn.cg: 600,787,015 Ir
| self-cost bucket | share |
|---|---:|
| JSON decode (serde_json de, typed AST read) | 27.6% |
| allocator (malloc/free/realloc) | 20.7% |
| memcpy/memmove/memcmp | 20.2% |
| concerto-core logic | 15.7% |
| IndexMap/HashMap tables | 4.8% |
| string building (fmt, format!) | 4.5% |
| hashing (SipHash, FxHash) | 3.2% |
| other | 1.8% |
| regex / identifier checks | 0.9% |
| drop (destructors) | 0.3% |
| clone | 0.2% |
| Value build/encode (serde_json ser, to_value) | 0.1% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 53.1% |
| ModelFile build after decode (ModelFile::load) | 5.8% |
|   declaration/property construction (Declaration::from_typed) | 4.0% |
|   Value-path declarations (Declaration::from_model_json) | 0.2% |
|   namespace/import parse (parse_namespace_with) | 0.0% |
|   check_imports | 0.0% |
|   declaration checks (Declaration::validate) | 36.2% |
|   check_unique_field_names | 5.6% |
|   super_type_fqn | 3.6% |
| in-place validate and register (validate_and_add_model_file, P5-48) | 39.9% |
| ModelManager::new | 0.1% |

## after-mmnew.cg: 30,974,498 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 61.5% |
| string building (fmt, format!) | 17.6% |
| concerto-core logic | 9.8% |
| memcpy/memmove/memcmp | 4.5% |
| other | 2.7% |
| IndexMap/HashMap tables | 2.3% |
| drop (destructors) | 1.4% |
| hashing (SipHash, FxHash) | 0.0% |
| clone | 0.0% |
| JSON decode (serde_json de, typed AST read) | 0.0% |
| Value build/encode (serde_json ser, to_value) | 0.0% |
| regex / identifier checks | 0.0% |

| stage (inclusive) | share |
|---|---:|
| ModelManager::new | 86.1% |

