## after-add_model_file-concerto-core-test-data.cpuprofile: 3815 samples in the measured loop, 75.1% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 60.9% | 45.7% |
| concerto-core logic | 11.5% | 8.7% |
| JSON decode (serde_json de, typed AST read) | 9.6% | 7.2% |
| other WASM | 4.7% | 3.5% |
| memcpy/memmove/memcmp | 3.1% | 2.3% |
| IndexMap/HashMap tables | 2.5% | 1.9% |
| string building (fmt, format!) | 2.4% | 1.8% |
| hashing (SipHash, FxHash) | 2.3% | 1.7% |
| Value build/encode (serde_json ser, to_value) | 1.3% | 1.0% |
| drop (destructors) | 0.6% | 0.4% |
| regex / identifier checks | 0.6% | 0.4% |
| clone | 0.5% | 0.4% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 10.9% |
| register (add_model_file / insert) | 1.6% |
| header JSON (stageModelFileWithHeader encode) | 0.9% |

## after-add_model_file-conformance.cpuprofile: 3845 samples in the measured loop, 66.2% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 60.1% | 39.8% |
| JSON decode (serde_json de, typed AST read) | 10.4% | 6.9% |
| concerto-core logic | 8.8% | 5.9% |
| other WASM | 5.9% | 3.9% |
| string building (fmt, format!) | 3.1% | 2.1% |
| Value build/encode (serde_json ser, to_value) | 3.0% | 2.0% |
| IndexMap/HashMap tables | 2.9% | 2.0% |
| memcpy/memmove/memcmp | 2.3% | 1.5% |
| hashing (SipHash, FxHash) | 2.0% | 1.3% |
| drop (destructors) | 0.5% | 0.3% |
| regex / identifier checks | 0.5% | 0.3% |
| clone | 0.4% | 0.3% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 6.4% |
| register (add_model_file / insert) | 1.5% |
| header JSON (stageModelFileWithHeader encode) | 2.1% |

## after-add_model_file-synthetic-large.cpuprofile: 3988 samples in the measured loop, 76.1% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 50.5% | 38.4% |
| concerto-core logic | 19.6% | 14.9% |
| JSON decode (serde_json de, typed AST read) | 15.0% | 11.4% |
| memcpy/memmove/memcmp | 5.4% | 4.1% |
| string building (fmt, format!) | 2.8% | 2.1% |
| hashing (SipHash, FxHash) | 2.3% | 1.8% |
| other WASM | 2.0% | 1.5% |
| IndexMap/HashMap tables | 1.7% | 1.3% |
| drop (destructors) | 0.4% | 0.3% |
| Value build/encode (serde_json ser, to_value) | 0.1% | 0.1% |
| regex / identifier checks | 0.1% | 0.1% |
| clone | 0.1% | 0.1% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 14.6% |
| register (add_model_file / insert) | 1.0% |
| header JSON (stageModelFileWithHeader encode) | 0.0% |

## after-modelfile_new-concerto-core-test-data.cpuprofile: 6491 samples in the measured loop, 65.6% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| JSON decode (serde_json de, typed AST read) | 26.0% | 17.0% |
| allocator (dlmalloc malloc/free/realloc) | 23.8% | 15.6% |
| concerto-core logic | 12.0% | 7.9% |
| drop (destructors) | 9.6% | 6.3% |
| other WASM | 7.3% | 4.8% |
| IndexMap/HashMap tables | 6.9% | 4.5% |
| memcpy/memmove/memcmp | 3.5% | 2.3% |
| hashing (SipHash, FxHash) | 3.0% | 2.0% |
| Value build/encode (serde_json ser, to_value) | 2.9% | 1.9% |
| string building (fmt, format!) | 2.1% | 1.4% |
| regex / identifier checks | 1.5% | 1.0% |
| clone | 1.4% | 0.9% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| header JSON (stageModelFileWithHeader encode) | 1.2% |

## after-modelfile_new-conformance.cpuprofile: 6181 samples in the measured loop, 58.2% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| JSON decode (serde_json de, typed AST read) | 23.6% | 13.7% |
| allocator (dlmalloc malloc/free/realloc) | 22.6% | 13.2% |
| other WASM | 11.3% | 6.6% |
| concerto-core logic | 9.9% | 5.7% |
| IndexMap/HashMap tables | 7.6% | 4.4% |
| drop (destructors) | 7.3% | 4.2% |
| Value build/encode (serde_json ser, to_value) | 5.8% | 3.3% |
| string building (fmt, format!) | 4.7% | 2.7% |
| hashing (SipHash, FxHash) | 3.1% | 1.8% |
| memcpy/memmove/memcmp | 2.0% | 1.2% |
| regex / identifier checks | 1.1% | 0.6% |
| clone | 0.9% | 0.5% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| header JSON (stageModelFileWithHeader encode) | 1.9% |

## after-modelfile_new-synthetic-large.cpuprofile: 5594 samples in the measured loop, 67.7% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| JSON decode (serde_json de, typed AST read) | 39.2% | 26.5% |
| allocator (dlmalloc malloc/free/realloc) | 22.8% | 15.5% |
| concerto-core logic | 16.9% | 11.5% |
| drop (destructors) | 6.8% | 4.6% |
| IndexMap/HashMap tables | 4.3% | 2.9% |
| memcpy/memmove/memcmp | 3.7% | 2.5% |
| hashing (SipHash, FxHash) | 2.6% | 1.7% |
| other WASM | 2.1% | 1.4% |
| string building (fmt, format!) | 0.9% | 0.6% |
| regex / identifier checks | 0.6% | 0.4% |
| Value build/encode (serde_json ser, to_value) | 0.2% | 0.1% |
| clone | 0.0% | 0.0% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| header JSON (stageModelFileWithHeader encode) | 0.1% |

## after-add_cto_model-concerto-core-test-data.cpuprofile: 4436 samples in the measured loop, 31.0% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 54.6% | 16.9% |
| concerto-core logic | 14.0% | 4.3% |
| JSON decode (serde_json de, typed AST read) | 11.8% | 3.7% |
| other WASM | 6.2% | 1.9% |
| IndexMap/HashMap tables | 3.4% | 1.0% |
| memcpy/memmove/memcmp | 3.1% | 1.0% |
| string building (fmt, format!) | 2.0% | 0.6% |
| Value build/encode (serde_json ser, to_value) | 2.0% | 0.6% |
| hashing (SipHash, FxHash) | 1.2% | 0.4% |
| regex / identifier checks | 0.8% | 0.2% |
| drop (destructors) | 0.7% | 0.2% |
| clone | 0.4% | 0.1% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 4.2% |
| register (add_model_file / insert) | 0.7% |
| header JSON (stageModelFileWithHeader encode) | 0.5% |

## after-add_cto_model-conformance.cpuprofile: 4618 samples in the measured loop, 31.5% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 49.2% | 15.5% |
| concerto-core logic | 16.0% | 5.0% |
| JSON decode (serde_json de, typed AST read) | 9.6% | 3.0% |
| other WASM | 9.1% | 2.9% |
| IndexMap/HashMap tables | 3.7% | 1.2% |
| Value build/encode (serde_json ser, to_value) | 3.1% | 1.0% |
| string building (fmt, format!) | 2.9% | 0.9% |
| memcpy/memmove/memcmp | 1.6% | 0.5% |
| hashing (SipHash, FxHash) | 1.6% | 0.5% |
| drop (destructors) | 1.4% | 0.5% |
| clone | 1.2% | 0.4% |
| regex / identifier checks | 0.5% | 0.2% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 3.9% |
| register (add_model_file / insert) | 0.7% |
| header JSON (stageModelFileWithHeader encode) | 1.4% |

## after-add_cto_model-synthetic-large.cpuprofile: 4995 samples in the measured loop, 17.2% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 42.1% | 7.2% |
| concerto-core logic | 23.4% | 4.0% |
| JSON decode (serde_json de, typed AST read) | 17.6% | 3.0% |
| memcpy/memmove/memcmp | 5.2% | 0.9% |
| hashing (SipHash, FxHash) | 2.7% | 0.5% |
| other WASM | 2.6% | 0.4% |
| string building (fmt, format!) | 2.4% | 0.4% |
| IndexMap/HashMap tables | 1.7% | 0.3% |
| drop (destructors) | 1.0% | 0.2% |
| Value build/encode (serde_json ser, to_value) | 0.8% | 0.1% |
| regex / identifier checks | 0.5% | 0.1% |
| clone | 0.0% | 0.0% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| in-place validation (validate_and_add_model_file) | 3.7% |
| register (add_model_file / insert) | 0.2% |
| header JSON (stageModelFileWithHeader encode) | 0.1% |

## after-mm_new-conformance.cpuprofile: 5257 samples in the measured loop, 25.1% in WASM
| WASM self-time bucket | share of WASM | share of all |
|---|---:|---:|
| allocator (dlmalloc malloc/free/realloc) | 34.4% | 8.6% |
| JSON decode (serde_json de, typed AST read) | 13.8% | 3.5% |
| concerto-core logic | 13.6% | 3.4% |
| other WASM | 11.3% | 2.8% |
| IndexMap/HashMap tables | 7.0% | 1.8% |
| string building (fmt, format!) | 6.0% | 1.5% |
| Value build/encode (serde_json ser, to_value) | 4.6% | 1.2% |
| hashing (SipHash, FxHash) | 3.9% | 1.0% |
| drop (destructors) | 2.9% | 0.7% |
| memcpy/memmove/memcmp | 1.8% | 0.5% |
| clone | 0.4% | 0.1% |
| regex / identifier checks | 0.3% | 0.1% |

| stage (inclusive, WASM frames) | share of all |
|---|---:|
| register (add_model_file / insert) | 1.1% |
| header JSON (stageModelFileWithHeader encode) | 0.6% |

