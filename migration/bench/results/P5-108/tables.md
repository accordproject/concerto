#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.42 | 6.17 | 324 | 1.00 | 1.00 |
| 1 | P5-108 (b) filter(keepUserModels) | 3.53 | 6.10 | 259 | 1.46 | 0.80 |
| 1 | P5-108 (b) filter(() => true) | 3.66 | 6.66 | 246 | 1.51 | 0.76 |
| 1 | P5-108 (c) fork | 1.46 | 3.13 | 544 | 0.60 | 1.68 |
| 16 | TS 5.0.0 (a) | 44.3 | 68.0 | 332 | 1.00 | 1.00 |
| 16 | P5-108 (b) filter(keepUserModels) | 61.3 | 85.1 | 248 | 1.38 | 0.75 |
| 16 | P5-108 (b) filter(() => true) | 61.4 | 82.4 | 251 | 1.39 | 0.76 |
| 16 | P5-108 (c) fork | 27.1 | 46.3 | 573 | 0.61 | 1.73 |
| 64 | TS 5.0.0 (a) | 179 | 208 | 338 | 1.00 | 1.00 |
| 64 | P5-108 (b) filter(keepUserModels) | 239 | 274 | 255 | 1.34 | 0.76 |
| 64 | P5-108 (b) filter(() => true) | 244 | 279 | 251 | 1.37 | 0.74 |
| 64 | P5-108 (c) fork | 96.3 | 143 | 592 | 0.54 | 1.75 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.14 | 5.66 | 592 | 1.00 | 1.00 |
| 1 | P5-108 (b) filter(keepUserModels) | 2.40 | 5.62 | 342 | 2.09 | 0.58 |
| 1 | P5-108 (b) filter(() => true) | 2.43 | 5.89 | 331 | 2.13 | 0.56 |
| 1 | P5-108 (c) fork | 1.06 | 5.22 | 647 | 0.93 | 1.09 |
| 16 | TS 5.0.0 (a) | 21.0 | 40.3 | 656 | 1.00 | 1.00 |
| 16 | P5-108 (b) filter(keepUserModels) | 39.7 | 70.2 | 365 | 1.89 | 0.56 |
| 16 | P5-108 (b) filter(() => true) | 45.3 | 66.0 | 331 | 2.16 | 0.50 |
| 16 | P5-108 (c) fork | 18.1 | 34.2 | 773 | 0.86 | 1.18 |
| 64 | TS 5.0.0 (a) | 86.3 | 125 | 615 | 1.00 | 1.00 |
| 64 | P5-108 (b) filter(keepUserModels) | 169 | 204 | 354 | 1.95 | 0.58 |
| 64 | P5-108 (b) filter(() => true) | 164 | 209 | 349 | 1.90 | 0.57 |
| 64 | P5-108 (c) fork | 70.4 | 95.8 | 822 | 0.82 | 1.34 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.36 | 6.72 | 307 | 1.00 | 1.00 |
| 1 | P5-108 (b) filter(keepUserModels) | 7.73 | 13.4 | 114 | 3.28 | 0.37 |
| 1 | P5-108 (b) filter(() => true) | 7.80 | 13.9 | 116 | 3.31 | 0.38 |
| 1 | P5-108 (c) fork | 7.25 | 13.0 | 122 | 3.07 | 0.40 |
| 16 | TS 5.0.0 (a) | 46.0 | 73.0 | 310 | 1.00 | 1.00 |
| 16 | P5-108 (b) filter(keepUserModels) | 135 | 165 | 112 | 2.94 | 0.36 |
| 16 | P5-108 (b) filter(() => true) | 134 | 146 | 118 | 2.92 | 0.38 |
| 16 | P5-108 (c) fork | 120 | 148 | 126 | 2.60 | 0.41 |
| 64 | TS 5.0.0 (a) | 180 | 206 | 315 | 1.00 | 1.00 |
| 64 | P5-108 (b) filter(keepUserModels) | 512 | 574 | 113 | 2.85 | 0.36 |
| 64 | P5-108 (b) filter(() => true) | 541 | 575 | 110 | 3.01 | 0.35 |
| 64 | P5-108 (c) fork | 464 | 527 | 129 | 2.58 | 0.41 |

#### Memory per held manager (100 held, after a GC)

| set | side | WASM KB | RSS KB | JS heap KB |
|---|---|---:|---:|---:|
| concerto-core-test-data | TS 5.0.0 (a) | 0.0 | 433.4 | 303.1 |
| concerto-core-test-data | P5-108 (b) filter(keepUserModels) | 42.2 | 159.5 | 62.4 |
| concerto-core-test-data | P5-108 (b) filter(() => true) | 42.2 | 160.8 | 62.3 |
| concerto-core-test-data | P5-108 (c) fork | 35.8 | 138.8 | 60.5 |
| conformance | TS 5.0.0 (a) | 0.0 | 361.3 | 161.2 |
| conformance | P5-108 (b) filter(keepUserModels) | 32.6 | 166.0 | 71.8 |
| conformance | P5-108 (b) filter(() => true) | 32.6 | -45.8 | 71.7 |
| conformance | P5-108 (c) fork | 24.3 | 50.8 | 67.8 |
| synthetic-large | TS 5.0.0 (a) | 0.0 | 514.0 | 410.0 |
| synthetic-large | P5-108 (b) filter(keepUserModels) | 58.2 | 161.3 | 22.0 |
| synthetic-large | P5-108 (b) filter(() => true) | 58.2 | 166.4 | 21.9 |
| synthetic-large | P5-108 (c) fork | 42.2 | 39.7 | 18.8 |
