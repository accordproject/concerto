esbuild 0.27.7; KB = 1000 B
| entry | engine | keepNames | raw | gzip | brotli | runs | same output as v5 |
|---|---|---|---:|---:|---:|---|---|
| E1 | v5.0.0 | on | 387.9 | 94.3 | 67.7 | ok | - |
| E1 | rust | on | 5733.3 | 1914.8 | 1236.9 | ok | yes |
| E1 | v5.0.0 | off | 371.7 | 89.5 | 63.9 | ok | - |
| E1 | rust | off | 5704.7 | 1906.1 | 1231.1 | ok | yes |
| E2 | v5.0.0 | on | 388.0 | 94.4 | 67.7 | ok | - |
| E2 | rust | on | 5733.3 | 1914.8 | 1237.0 | ok | yes |
| E2 | v5.0.0 | off | 371.7 | 89.6 | 64.0 | ok | - |
| E2 | rust | off | 5704.7 | 1906.1 | 1230.7 | ok | yes |
| E3 | v5.0.0 | on | 386.2 | 94.2 | 67.5 | ok | - |
| E3 | rust | on | 5731.5 | 1914.6 | 1236.9 | ok | yes |
| E3 | v5.0.0 | off | 370.0 | 89.4 | 63.7 | ok | - |
| E3 | rust | off | 5703.0 | 1905.9 | 1230.3 | ok | yes |

JS without the engine package (E1, keepNames): 507.6 / 124.2 / 83.5; without keepNames 484.4 / 117.2 / 78.2
.wasm 3871.3 / 1223.7 / 793.4; base64 5161.8 / 1780.3 / 1144.7; concerto-engine.mjs 5162.6 / 1780.8 / 1147.2; concerto-engine.cjs raw 5373.2
