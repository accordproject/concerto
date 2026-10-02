p560-bundle.mjs at concerto 65538093d, concerto-rust bfa4a55 (engine built by concerto-wasm/build.sh, O3)
esbuild 0.27.7; KB = 1000 B
| entry | engine | keepNames | raw | gzip | brotli | runs | same output as v5 |
|---|---|---|---:|---:|---:|---|---|
| E1 | v5.0.0 | on | 387.9 | 94.3 | 67.7 | ok | - |
| E1 | rust | on | 4614.3 | 1535.3 | 1000.7 | ok | yes |
| E1 | v5.0.0 | off | 371.7 | 89.5 | 63.9 | ok | - |
| E1 | rust | off | 4586.4 | 1527.9 | 997.8 | ok | yes |
| E2 | v5.0.0 | on | 388.0 | 94.4 | 67.7 | ok | - |
| E2 | rust | on | 4614.3 | 1535.3 | 1000.5 | ok | yes |
| E2 | v5.0.0 | off | 371.7 | 89.6 | 64.0 | ok | - |
| E2 | rust | off | 4586.5 | 1528.0 | 997.9 | ok | yes |
| E3 | v5.0.0 | on | 386.2 | 94.2 | 67.5 | ok | - |
| E3 | rust | on | 4612.6 | 1535.1 | 1000.5 | ok | yes |
| E3 | v5.0.0 | off | 370.0 | 89.4 | 63.7 | ok | - |
| E3 | rust | off | 4584.7 | 1527.7 | 997.4 | ok | yes |
