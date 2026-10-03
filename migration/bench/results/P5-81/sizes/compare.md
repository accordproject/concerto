
### o3: shipped .wasm (KB = 1000 B)

| variant | raw | gzip | brotli | vs derived raw / gz / br |
|---|---:|---:|---:|---|
| base | 3051.8 | 976.9 | 636.4 | -0.1% / +0.0% / -0.1% |
| derived | 3055.3 | 976.8 | 637.1 | +0.0% / +0.0% / +0.0% |
| table | 2449.0 | 824.2 | 543.1 | -19.8% / -15.6% / -14.7% |
| altvalue | 2840.1 | 912.1 | 597.4 | -7.0% / -6.6% / -6.2% |
| altdeny | 3022.0 | 968.1 | 634.7 | -1.1% / -0.9% / -0.4% |

### o3: code bytes by area (named v0 build, KB)

| area | base | derived | table | table - derived |
|---|---:|---:|---:|---:|
| typed-AST deserialisation | 765.3 | 765.1 | 208.3 | -556.8 |
| other serde deserialisation | 136.8 | 136.7 | 126.8 | -9.9 |
| serde serialisation | 93.5 | 93.5 | 93.4 | -0.1 |
| regress | 249.2 | 249.2 | 249.0 | -0.2 |
| else: concerto_core | 640.5 | 640.9 | 588.7 | -52.2 |
| else: concerto_wasm | 356.1 | 356.1 | 352.4 | -3.7 |
| else: concerto_core_js | 105.0 | 105.0 | 104.8 | -0.2 |
| else: Debug/Display | 59.0 | 59.0 | 59.0 | -0.0 |
| else: drop glue | 20.8 | 20.8 | 31.7 | 10.9 |
| else: other | 125.5 | 125.5 | 126.0 | 0.5 |
| code section | 2551.8 | 2552.0 | 1940.2 | -611.8 |
| data section | 489.3 | 489.3 | 497.2 | 7.9 |
| functions | 1698 | 1693 | 1616 | -77 |

### z: shipped .wasm (KB = 1000 B)

| variant | raw | gzip | brotli | vs derived raw / gz / br |
|---|---:|---:|---:|---|
| base | 1814.9 | 642.6 | 461.5 | -0.0% / +0.0% / +0.1% |
| derived | 1814.9 | 642.5 | 461.1 | +0.0% / +0.0% / +0.0% |
| table | 1446.5 | 538.0 | 392.0 | -20.3% / -16.3% / -15.0% |
| altvalue | 1675.7 | 602.8 | 433.2 | -7.7% / -6.2% / -6.0% |
| altdeny | 1797.3 | 638.8 | 458.4 | -1.0% / -0.6% / -0.6% |

### z: code bytes by area (named v0 build, KB)

| area | base | derived | table | table - derived |
|---|---:|---:|---:|---:|
| typed-AST deserialisation | 425.0 | 425.0 | 117.0 | -308.0 |
| other serde deserialisation | 64.6 | 64.6 | 49.4 | -15.2 |
| serde serialisation | 31.4 | 31.4 | 31.4 | -0.0 |
| regress | 101.5 | 101.5 | 101.5 | -0.0 |
| else: concerto_core | 322.9 | 322.9 | 278.6 | -44.2 |
| else: concerto_wasm | 178.1 | 178.1 | 178.2 | 0.1 |
| else: concerto_core_js | 53.2 | 53.2 | 53.2 | -0.0 |
| else: Debug/Display | 7.2 | 7.2 | 7.2 | 0.0 |
| else: drop glue | 5.6 | 5.6 | 5.6 | 0.0 |
| else: other | 137.0 | 137.0 | 128.3 | -8.7 |
| code section | 1326.4 | 1326.5 | 950.4 | -376.0 |
| data section | 474.8 | 474.8 | 482.6 | 7.7 |
| functions | 3050 | 3052 | 2776 | -276 |
