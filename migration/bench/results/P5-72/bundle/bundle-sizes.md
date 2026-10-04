esbuild 0.27.7; KB = 1000 B
| entry | engine | keepNames | raw | gzip | brotli | runs | same output as v5 |
|---|---|---|---:|---:|---:|---|---|
| E1 | v5.0.0 | on | 387.9 | 94.3 | 67.7 | ok | - |
| E1 | rust | on | 4622.5 | 1536.0 | 989.2 | ok | yes |
| E1 | v5.0.0 | off | 371.7 | 89.5 | 63.9 | ok | - |
| E1 | rust | off | 4595.0 | 1528.9 | 984.1 | ok | yes |
| E2 | v5.0.0 | on | 388.0 | 94.4 | 67.7 | ok | - |
| E2 | rust | on | 4622.5 | 1536.0 | 989.3 | ok | yes |
| E2 | v5.0.0 | off | 371.7 | 89.6 | 64.0 | ok | - |
| E2 | rust | off | 4595.0 | 1528.9 | 983.6 | ok | yes |
| E3 | v5.0.0 | on | 386.2 | 94.2 | 67.5 | ok | - |
| E3 | rust | on | 4620.8 | 1535.8 | 989.2 | ok | yes |
| E3 | v5.0.0 | off | 370.0 | 89.4 | 63.7 | ok | - |
| E3 | rust | off | 4593.2 | 1528.7 | 983.5 | ok | yes |

JS without the engine package (E1, keepNames): 493.6 / 119.5 / 79.9; without keepNames 471.4 / 112.7 / 74.9
.wasm 3052.1 / 973.2 / 626.4; base64 4069.4 / 1408.9 / 900.4; concerto-engine.mjs 4070.3 / 1409.5 / 900.9; concerto-engine.cjs raw 4263.2
