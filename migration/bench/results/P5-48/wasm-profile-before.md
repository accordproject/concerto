## before-add_model_file-concerto-core-test-data.cpuprofile: 3510 samples in the measured loop, 80.1% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 60.3% | 48.3% |
| concerto-core logic | 11.8% | 9.5% |
| JSON decode (serde_json de, typed AST read) | 8.7% | 7.0% |
| other WASM | 3.8% | 3.1% |
| string building (fmt, format!) | 3.6% | 2.8% |
| clone | 2.5% | 2.0% |
| IndexMap/HashMap tables | 2.5% | 2.0% |
| hashing (SipHash, FxHash) | 2.1% | 1.7% |
| memcpy/memmove/memcmp | 1.7% | 1.3% |
| drop (destructors) | 1.5% | 1.2% |
| Value build/encode (serde_json ser, to_value) | 1.0% | 0.8% |
| regex / identifier checks | 0.4% | 0.3% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 32.5% |
|   scratch manager (with_model_file_registered) | 21.9% |
| register (add_model_file / insert) | 10.6% |
| header JSON (stageModelFileWithHeader encode) | 0.4% |

## before-add_model_file-conformance.cpuprofile: 3868 samples in the measured loop, 78.5% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 55.4% | 43.5% |
| concerto-core logic | 8.4% | 6.6% |
| JSON decode (serde_json de, typed AST read) | 7.5% | 5.9% |
| IndexMap/HashMap tables | 6.9% | 5.4% |
| Value build/encode (serde_json ser, to_value) | 5.9% | 4.6% |
| other WASM | 5.2% | 4.1% |
| hashing (SipHash, FxHash) | 2.9% | 2.3% |
| string building (fmt, format!) | 2.9% | 2.3% |
| clone | 2.0% | 1.6% |
| drop (destructors) | 1.5% | 1.2% |
| memcpy/memmove/memcmp | 1.1% | 0.9% |
| regex / identifier checks | 0.4% | 0.3% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 35.9% |
|   scratch manager (with_model_file_registered) | 12.2% |
| error locations built eagerly (location_value) | 4.4% |
| register (add_model_file / insert) | 8.5% |
| header JSON (stageModelFileWithHeader encode) | 1.6% |

## before-add_model_file-synthetic-large.cpuprofile: 3309 samples in the measured loop, 82.3% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 49.0% | 40.3% |
| concerto-core logic | 21.7% | 17.9% |
| JSON decode (serde_json de, typed AST read) | 10.0% | 8.3% |
| string building (fmt, format!) | 5.4% | 4.5% |
| memcpy/memmove/memcmp | 3.5% | 2.9% |
| IndexMap/HashMap tables | 2.8% | 2.3% |
| clone | 2.2% | 1.8% |
| hashing (SipHash, FxHash) | 1.9% | 1.6% |
| other WASM | 1.9% | 1.5% |
| drop (destructors) | 1.0% | 0.8% |
| regex / identifier checks | 0.4% | 0.3% |
| Value build/encode (serde_json ser, to_value) | 0.2% | 0.2% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 31.8% |
|   scratch manager (with_model_file_registered) | 15.4% |
| register (add_model_file / insert) | 3.1% |

## before-modelfile_new-concerto-core-test-data.cpuprofile: 5695 samples in the measured loop, 66.8% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| JSON decode (serde_json de, typed AST read) | 24.2% | 16.2% |
| allocator (dlmalloc malloc/free/realloc) | 23.9% | 15.9% |
| concerto-core logic | 12.9% | 8.6% |
| IndexMap/HashMap tables | 8.0% | 5.3% |
| drop (destructors) | 7.3% | 4.9% |
| other WASM | 7.2% | 4.8% |
| string building (fmt, format!) | 4.6% | 3.1% |
| hashing (SipHash, FxHash) | 3.1% | 2.1% |
| Value build/encode (serde_json ser, to_value) | 3.0% | 2.0% |
| memcpy/memmove/memcmp | 2.8% | 1.9% |
| regex / identifier checks | 1.7% | 1.2% |
| clone | 1.2% | 0.8% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| header JSON (stageModelFileWithHeader encode) | 1.1% |

## before-modelfile_new-conformance.cpuprofile: 5580 samples in the measured loop, 61.6% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 24.0% | 14.8% |
| JSON decode (serde_json de, typed AST read) | 19.9% | 12.3% |
| concerto-core logic | 11.2% | 6.9% |
| other WASM | 10.4% | 6.4% |
| IndexMap/HashMap tables | 9.2% | 5.7% |
| drop (destructors) | 6.2% | 3.8% |
| string building (fmt, format!) | 5.8% | 3.6% |
| Value build/encode (serde_json ser, to_value) | 5.4% | 3.3% |
| hashing (SipHash, FxHash) | 3.7% | 2.3% |
| memcpy/memmove/memcmp | 2.4% | 1.5% |
| clone | 0.9% | 0.6% |
| regex / identifier checks | 0.8% | 0.5% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| header JSON (stageModelFileWithHeader encode) | 1.9% |

## before-modelfile_new-synthetic-large.cpuprofile: 5144 samples in the measured loop, 71.1% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 31.9% | 22.7% |
| JSON decode (serde_json de, typed AST read) | 27.0% | 19.2% |
| concerto-core logic | 20.1% | 14.3% |
| string building (fmt, format!) | 4.3% | 3.1% |
| IndexMap/HashMap tables | 3.9% | 2.8% |
| drop (destructors) | 3.7% | 2.6% |
| memcpy/memmove/memcmp | 3.3% | 2.3% |
| other WASM | 2.3% | 1.6% |
| hashing (SipHash, FxHash) | 1.4% | 1.0% |
| clone | 1.1% | 0.8% |
| regex / identifier checks | 0.8% | 0.6% |
| Value build/encode (serde_json ser, to_value) | 0.1% | 0.1% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|

## before-add_cto_model-concerto-core-test-data.cpuprofile: 3418 samples in the measured loop, 34.8% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 43.6% | 15.2% |
| concerto-core logic | 17.0% | 5.9% |
| JSON decode (serde_json de, typed AST read) | 11.5% | 4.0% |
| other WASM | 5.3% | 1.8% |
| IndexMap/HashMap tables | 5.1% | 1.8% |
| string building (fmt, format!) | 4.3% | 1.5% |
| clone | 3.2% | 1.1% |
| memcpy/memmove/memcmp | 2.9% | 1.0% |
| hashing (SipHash, FxHash) | 2.6% | 0.9% |
| drop (destructors) | 1.9% | 0.6% |
| Value build/encode (serde_json ser, to_value) | 1.8% | 0.6% |
| regex / identifier checks | 0.8% | 0.3% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 13.0% |
|   scratch manager (with_model_file_registered) | 6.0% |
| register (add_model_file / insert) | 2.7% |
| header JSON (stageModelFileWithHeader encode) | 0.3% |

## before-add_cto_model-conformance.cpuprofile: 4085 samples in the measured loop, 40.5% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 50.1% | 20.3% |
| concerto-core logic | 13.1% | 5.3% |
| other WASM | 8.8% | 3.5% |
| JSON decode (serde_json de, typed AST read) | 8.1% | 3.3% |
| IndexMap/HashMap tables | 4.3% | 1.8% |
| string building (fmt, format!) | 3.7% | 1.5% |
| Value build/encode (serde_json ser, to_value) | 3.0% | 1.2% |
| drop (destructors) | 2.5% | 1.0% |
| clone | 2.2% | 0.9% |
| hashing (SipHash, FxHash) | 1.7% | 0.7% |
| memcpy/memmove/memcmp | 1.4% | 0.6% |
| regex / identifier checks | 1.0% | 0.4% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 15.1% |
|   scratch manager (with_model_file_registered) | 9.0% |
| register (add_model_file / insert) | 6.0% |
| header JSON (stageModelFileWithHeader encode) | 1.5% |

## before-add_cto_model-synthetic-large.cpuprofile: 3820 samples in the measured loop, 33.0% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 40.0% | 13.2% |
| concerto-core logic | 27.0% | 8.9% |
| JSON decode (serde_json de, typed AST read) | 10.9% | 3.6% |
| string building (fmt, format!) | 5.5% | 1.8% |
| clone | 5.2% | 1.7% |
| memcpy/memmove/memcmp | 2.6% | 0.9% |
| IndexMap/HashMap tables | 2.4% | 0.8% |
| other WASM | 2.1% | 0.7% |
| hashing (SipHash, FxHash) | 1.9% | 0.6% |
| drop (destructors) | 1.6% | 0.5% |
| regex / identifier checks | 0.6% | 0.2% |
| Value build/encode (serde_json ser, to_value) | 0.2% | 0.1% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| detached validation (validate_detached_model_file) | 12.1% |
|   scratch manager (with_model_file_registered) | 5.7% |
| register (add_model_file / insert) | 1.1% |

## before-mm_new-conformance.cpuprofile: 4799 samples in the measured loop, 48.7% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 64.8% | 31.6% |
| concerto-core logic | 6.8% | 3.3% |
| other WASM | 6.8% | 3.3% |
| JSON decode (serde_json de, typed AST read) | 5.6% | 2.8% |
| IndexMap/HashMap tables | 3.4% | 1.7% |
| clone | 3.3% | 1.6% |
| string building (fmt, format!) | 3.2% | 1.6% |
| Value build/encode (serde_json ser, to_value) | 1.9% | 0.9% |
| drop (destructors) | 1.8% | 0.9% |
| hashing (SipHash, FxHash) | 1.2% | 0.6% |
| memcpy/memmove/memcmp | 0.6% | 0.3% |
| regex / identifier checks | 0.5% | 0.2% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| register (add_model_file / insert) | 0.5% |
| header JSON (stageModelFileWithHeader encode) | 1.4% |

