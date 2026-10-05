## Concertino: `./validate` and `./runtime` against concerto-core

us per item, the median of three rounds' medians, each side in its own process. "engine" is this integration head's concerto-core over the Rust engine; TS 5.0.0 the published concerto-core. Validation reads the same documents everywhere: the p515 instances `./validate` accepts (the count below), populated and validated; `./validate` `validate(m, json)` against `Serializer.fromJSON` (which validates) and `ModelManager.validateInstance`.

| set | instances | `./validate` | engine fromJSON | engine validateInstance | TS 5.0.0 fromJSON | `./validate` x engine fromJSON | `./validate` x TS 5.0.0 | engine fromJSON x TS 5.0.0 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| core-test-data | 120 of 120 | 27.4 us | 59.8 us | 48.6 us | 64.7 us | 0.46 | 0.42 | 0.93 |
| conformance | 44 of 44 | 3.19 us | 17.0 us | 24.3 us | 25.2 us | 0.19 | 0.13 | 0.68 |
| synthetic-large | 300 of 300 | 6.33 us | 26.3 us | 21.9 us | 22.0 us | 0.24 | 0.29 | 1.20 |

Introspection over each set's `pairs` (P5-96's introspection items): `./runtime` getType, derivesFrom, isAssignableTo and getProperties on the loaded document, against `ModelManager.getType`, `derivesFrom`, `isAssignableTo` and `getType(fqn).getProperties()`.

| op | set | items | `./runtime` | engine | TS 5.0.0 | `./runtime` x engine | `./runtime` x TS 5.0.0 | engine x TS 5.0.0 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| get_type | core-test-data | 154 | 0.07 us | 0.68 us | 0.83 us | 0.11 | 0.09 | 0.81 |
| get_type | conformance | 52 | 0.05 us | 1.03 us | 0.94 us | 0.05 | 0.06 | 1.09 |
| get_type | synthetic-large | 301 | 0.06 us | 0.42 us | 0.56 us | 0.13 | 0.10 | 0.76 |
| derives_from | core-test-data | 154 | 0.35 us | 1.15 us | 1.24 us | 0.30 | 0.28 | 0.92 |
| derives_from | conformance | 52 | 0.28 us | 0.75 us | 1.32 us | 0.37 | 0.21 | 0.57 |
| derives_from | synthetic-large | 301 | 0.26 us | 0.75 us | 0.71 us | 0.34 | 0.36 | 1.06 |
| is_assignable_to | core-test-data | 154 | 0.41 us | 1.16 us | 1.98 us | 0.36 | 0.21 | 0.59 |
| is_assignable_to | conformance | 52 | 0.29 us | 0.92 us | 2.26 us | 0.32 | 0.13 | 0.41 |
| is_assignable_to | synthetic-large | 301 | 0.29 us | 0.87 us | 1.61 us | 0.33 | 0.18 | 0.54 |
| get_properties | core-test-data | 154 | 0.15 us | 1.27 us | 3.27 us | 0.12 | 0.05 | 0.39 |
| get_properties | conformance | 52 | 0.13 us | 1.60 us | 2.41 us | 0.08 | 0.05 | 0.66 |
| get_properties | synthetic-large | 301 | 0.09 us | 0.64 us | 1.31 us | 0.14 | 0.07 | 0.49 |

`ModelManager.toConcertino()` of a manager of each set's models (P5-129), and `./runtime` `load` of the document it gives:

| set | model files | document bytes | declarations | toConcertino per set | per model file | `load` per document |
|---|---:|---:|---:|---:|---:|---:|
| core-test-data | 35 | 94,289 | 164 | 4.66 ms | 133.2 us | 85.4 us |
| conformance | 41 | 15,169 | 58 | 1.43 ms | 35.0 us | 14.2 us |
| synthetic-large | 1 | 199,008 | 303 | 5.88 ms | 5.88 ms | 76.6 us |

## Concertino browser bundles (packages/concertino/scripts/bundleSizes.js)

Every export of the subpath's browser build, bundled with esbuild (ESM, browser, minified, es2022); KB = 1000 B, gzip -9. No engine and no concerto-core in any of them.

| bundle | raw KB | gzip KB | `new Function` |
|---|---:|---:|---|
| `.` | 159.9 | 18.5 | no |
| `./schema` | 141.2 | 13.3 | no |
| `./runtime` | 5.7 | 2.2 | no |
| `./validate` | 20.1 | 6.7 | no |
| `./resolve` | 6.1 | 2.3 | no |
| `./validate + { load }` | 20.3 | 6.8 | no |
| `CTO pipeline: concerto-cto Parser + ./resolve + convertToConcertino` | 173.5 | 39.7 | no |
| `CTO pipeline + load + validate (CTO and JSON in, validated instance out)` | 192.6 | 45.4 | no |

## Engine load time in Node (P5-44: raw .wasm against the base64 inline)

Each figure is the median of 20 fresh processes (the cases interleaved, the order rotated every repetition), from the first require/import to the first `new ModelManager()` (concerto-core) or `new ModelManagerHandle()` (the engine alone) returning; "load" stops when the require/import (and, for the ESM engine loader, `init()`) returns. Node v22.22.2. Before is P5-121's now heads (the .wasm inlined as base64 in concerto-engine.cjs and .mjs).

| case | before: first (load) ms | **now: first (load) ms** | now / before | now min-max ms | TS 5.0.0 first (load) ms | now x TS 5.0.0 |
|---|---:|---:|---:|---|---:|---:|
| `require` concerto-core, first ModelManager | 212.9 (175.6) | **193.4 (158.5)** | 0.91 | 159.4-240.2 | 134.1 (129.2) | 1.44 |
| `import` concerto-core (ESM), first ModelManager | 264.6 (225.6) | **225.8 (194.1)** | 0.85 | 192.0-297.7 | 187.3 (179.9) | 1.21 |
| `require` concerto-engine.cjs, first handle | 77.5 (59.4) | **45.8 (24.1)** | 0.59 | 40.3-61.4 | - | - |
| `import` the Node ESM loader, first handle | 85.5 (65.1) | **45.7 (24.2)** | 0.53 | 42.0-65.6 | - | - |

## Shipped engine files (concerto-wasm/pkg)

KB = 1000 B; gzip -9, brotli q11. Before is P5-121's now head.

| file | before raw / gz / br | **now raw / gz / br** |
|---|---|---|
| `concerto-engine.cjs` | 4,926.8 / 1,687.9 / 1,091.5 | **154.4 / 22.2 / 18.6** |
| `concerto-engine.mjs` | 4,771.9 / 1,666.6 / 1,076.9 | **1.0 / 0.5 / 0.4** |
| `concerto-engine.node.mjs` | - | **0.4 / 0.2 / 0.2** |
| `concerto_wasm.wasm` | 3,578.3 / 1,145.4 / 747.5 | **3,590.3 / 1,150.8 / 749.0** |
| `package.json` | 0.4 / 0.2 / 0.2 | **0.5 / 0.3 / 0.2** |
| `web/concerto_wasm.d.ts` | 60.1 / 14.4 / 12.7 | **60.0 / 14.3 / 12.7** |
| `web/concerto_wasm.js` | 155.6 / 22.4 / 18.9 | **154.3 / 22.3 / 18.8** |
| `web/concerto_wasm_bg.wasm` | 3,906.0 / 1,166.3 / 735.5 | **-** |
| `web/concerto_wasm_bg.wasm.d.ts` | 13.3 / 1.4 / 1.3 | **-** |
| `web/package.json` | 0.0 / 0.0 / 0.0 | **0.0 / 0.0 / 0.0** |
| all files but .d.ts and package.json | 17,338.6 / 5,688.7 / 3,670.3 | **3,900.4 / 1,196.1 / 787.1** |
| what Node loads (concerto-engine.cjs, plus the .wasm now) | 4,926.8 / 1,687.9 / 1,091.5 | **3,744.7 / 1,173.0 / 767.7** |
| what a browser fetches (before: concerto-engine.mjs; now: the loader, the glue and the .wasm) | 4,771.9 / 1,666.6 / 1,076.9 | **3,745.6 / 1,173.6 / 768.2** |

## Browser engine load, headless Chromium (P5-45)

Chromium 141.0.7390.37 (Playwright's headless shell), 10 fresh browser contexts per case (empty cache), the cases interleaved; ms, medians. Files served from 127.0.0.1 with no caching, so network time is near zero.

| case | import | init() | first handle / answer | total |
|---|---:|---:|---:|---:|
| main thread, before: `import` (base64 decode and synchronous compile inside it), first ModelManagerHandle | 81.4 | - | 23.0 | 104.4 |
| main thread, now: `import` the loader, `await init()` (fetch and compile the raw .wasm), first ModelManagerHandle | 11.5 | 33.3 | 23.6 | **68.5** |
| the worker recipe, now (bundle 584.4 KB minified): `new Worker` to the first answer (init(), first ModelManager, addCTOModel, fromJSON) | - | 162.3 (first - second) | second answer 2.4 | **164.6** |

