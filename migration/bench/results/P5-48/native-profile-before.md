## before-add-conf.cg: 1,273,642,195 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 37.1% |
| IndexMap/HashMap tables | 10.7% |
| JSON decode (serde_json de, typed AST read) | 10.2% |
| hashing (SipHash, FxHash) | 10.0% |
| other | 6.4% |
| memcpy/memmove/memcmp | 5.8% |
| Value build/encode (serde_json ser, to_value) | 5.4% |
| concerto-core logic | 4.9% |
| string building (fmt, format!) | 4.4% |
| drop (destructors) | 2.9% |
| clone | 1.8% |
| regex / identifier checks | 0.4% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 19.5% |
| ModelFile build after decode (ModelFile::load) | 11.4% |
|   declaration/property construction (Declaration::from_typed) | 4.8% |
|   Value-path declarations (Declaration::from_model_json) | 2.4% |
|   namespace/import parse (parse_namespace_with) | 6.4% |
| detached validation (validate_detached_model_file) | 64.6% |
|   scratch manager (with_model_file_registered) | 7.3% |
|   ModelFile clone | 4.4% |
|   check_imports | 9.4% |
|   declaration checks (Declaration::validate) | 44.5% |
|   check_unique_field_names | 12.0% |
|   ModelManager::properties (super-chain property lists) | 13.4% |
|   super_type_fqn | 12.2% |
|   error locations built eagerly (location_value) | 13.5% |
| register (add_model_file) | 1.6% |
| ModelManager::new | 1.6% |

## before-add-ctd.cg: 1,243,691,289 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 39.4% |
| JSON decode (serde_json de, typed AST read) | 14.0% |
| memcpy/memmove/memcmp | 11.1% |
| concerto-core logic | 9.2% |
| string building (fmt, format!) | 8.3% |
| hashing (SipHash, FxHash) | 4.7% |
| IndexMap/HashMap tables | 4.5% |
| other | 3.9% |
| clone | 2.5% |
| drop (destructors) | 1.5% |
| regex / identifier checks | 0.6% |
| Value build/encode (serde_json ser, to_value) | 0.2% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 35.4% |
| ModelFile build after decode (ModelFile::load) | 11.9% |
|   declaration/property construction (Declaration::from_typed) | 7.8% |
|   Value-path declarations (Declaration::from_model_json) | 1.8% |
|   namespace/import parse (parse_namespace_with) | 3.3% |
| detached validation (validate_detached_model_file) | 48.0% |
|   scratch manager (with_model_file_registered) | 9.1% |
|   ModelFile clone | 6.8% |
|   check_imports | 5.0% |
|   declaration checks (Declaration::validate) | 29.9% |
|   check_unique_field_names | 9.2% |
|   ModelManager::properties (super-chain property lists) | 7.6% |
|   super_type_fqn | 3.1% |
| register (add_model_file) | 2.3% |
| ModelManager::new | 1.3% |

## before-add-syn.cg: 1,011,300,251 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 35.5% |
| JSON decode (serde_json de, typed AST read) | 16.5% |
| memcpy/memmove/memcmp | 14.9% |
| concerto-core logic | 10.3% |
| string building (fmt, format!) | 9.5% |
| IndexMap/HashMap tables | 3.3% |
| hashing (SipHash, FxHash) | 3.3% |
| other | 3.2% |
| clone | 2.0% |
| drop (destructors) | 1.0% |
| regex / identifier checks | 0.6% |
| Value build/encode (serde_json ser, to_value) | 0.1% |

| stage (inclusive) | share |
|---|---:|
| typed-AST decode (typed_ast::parse) | 37.5% |
| ModelFile build after decode (ModelFile::load) | 10.1% |
|   declaration/property construction (Declaration::from_typed) | 9.3% |
|   Value-path declarations (Declaration::from_model_json) | 0.1% |
|   namespace/import parse (parse_namespace_with) | 0.1% |
| detached validation (validate_detached_model_file) | 49.6% |
|   scratch manager (with_model_file_registered) | 7.0% |
|   ModelFile clone | 5.6% |
|   check_imports | 0.1% |
|   declaration checks (Declaration::validate) | 38.9% |
|   check_unique_field_names | 7.4% |
|   ModelManager::properties (super-chain property lists) | 8.3% |
|   super_type_fqn | 2.0% |
| register (add_model_file) | 1.8% |
| ModelManager::new | 0.3% |

## before-mmnew.cg: 213,387,868 Ir
| self-cost bucket | share |
|---|---:|
| allocator (malloc/free/realloc) | 66.2% |
| clone | 9.1% |
| memcpy/memmove/memcmp | 6.2% |
| other | 5.7% |
| drop (destructors) | 4.9% |
| IndexMap/HashMap tables | 3.8% |
| string building (fmt, format!) | 2.6% |
| concerto-core logic | 1.5% |
| hashing (SipHash, FxHash) | 0.0% |
| JSON decode (serde_json de, typed AST read) | 0.0% |
| Value build/encode (serde_json ser, to_value) | 0.0% |
| regex / identifier checks | 0.0% |

| stage (inclusive) | share |
|---|---:|
|   ModelFile clone | 60.6% |
| ModelManager::new | 74.9% |

