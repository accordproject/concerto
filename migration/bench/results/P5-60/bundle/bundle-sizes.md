esbuild 0.27.7; KB = 1000 B
| entry | engine | keepNames | raw | gzip | brotli | runs | same output as v5 |
|---|---|---|---:|---:|---:|---|---|
| E1 | v5.0.0 | on | 387.9 | 94.3 | 67.7 | ok | - |
| E1 | rust | on | 4483.7 | 1482.6 | 959.6 | ok | yes |
| E1 | v5.0.0 | off | 371.7 | 89.5 | 63.9 | ok | - |
| E1 | rust | off | 4456.4 | 1474.9 | 953.5 | ok | yes |
| E2 | v5.0.0 | on | 388.0 | 94.4 | 67.7 | ok | - |
| E2 | rust | on | 4483.8 | 1482.6 | 959.7 | ok | yes |
| E2 | v5.0.0 | off | 371.7 | 89.6 | 64.0 | ok | - |
| E2 | rust | off | 4456.4 | 1474.9 | 953.7 | ok | yes |
| E3 | v5.0.0 | on | 386.2 | 94.2 | 67.5 | ok | - |
| E3 | rust | on | 4482.0 | 1482.4 | 959.1 | ok | yes |
| E3 | v5.0.0 | off | 370.0 | 89.4 | 63.7 | ok | - |
| E3 | rust | off | 4454.6 | 1474.7 | 953.5 | ok | yes |

JS without the engine package (E1, keepNames): 491.4 / 118.9 / 79.3; without keepNames 469.4 / 112.0 / 74.3
.wasm 2950.1 / 945.1 / 611.9; base64 3933.4 / 1353.9 / 870.4; concerto-engine.mjs 3934.3 / 1354.7 / 871.1; concerto-engine.cjs raw 4124.0
