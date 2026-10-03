#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.47 | 6.19 | 313 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 4.82 | 9.56 | 175 | 1.95 | 0.56 |
| 1 | before (b) filter(keepUserModels) | - | - | - | - | - |
| 1 | now (a) new ModelManager | 4.59 | 8.47 | 189 | 1.86 | 0.60 |
| 1 | now (b) filter(() => true) | 3.69 | 6.27 | 251 | 1.49 | 0.80 |
| 1 | now (c) fork | 1.41 | 2.29 | 648 | 0.57 | 2.07 |
| 16 | TS 5.0.0 (a) | 44.8 | 62.4 | 336 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 80.1 | 126 | 187 | 1.79 | 0.56 |
| 16 | before (b) filter(keepUserModels) | - | - | - | - | - |
| 16 | now (a) new ModelManager | 72.5 | 116 | 195 | 1.62 | 0.58 |
| 16 | now (b) filter(() => true) | 62.6 | 81.7 | 246 | 1.40 | 0.73 |
| 16 | now (c) fork | 22.7 | 31.5 | 692 | 0.51 | 2.06 |
| 64 | TS 5.0.0 (a) | 170 | 208 | 354 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 343 | 599 | 162 | 2.01 | 0.46 |
| 64 | before (b) filter(keepUserModels) | - | - | - | - | - |
| 64 | now (a) new ModelManager | 338 | 544 | 170 | 1.99 | 0.48 |
| 64 | now (b) filter(() => true) | 238 | 259 | 262 | 1.40 | 0.74 |
| 64 | now (c) fork | 103 | 129 | 610 | 0.61 | 1.72 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.06 | 3.54 | 749 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 2.52 | 4.24 | 346 | 2.38 | 0.46 |
| 1 | before (b) filter(keepUserModels) | 6.86 | 11.8 | 124 | 6.47 | 0.17 |
| 1 | now (a) new ModelManager | 2.49 | 4.71 | 343 | 2.35 | 0.46 |
| 1 | now (b) filter(() => true) | 2.36 | 3.91 | 384 | 2.22 | 0.51 |
| 1 | now (c) fork | 1.01 | 1.59 | 847 | 0.95 | 1.13 |
| 16 | TS 5.0.0 (a) | 20.0 | 33.0 | 693 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 44.5 | 64.1 | 342 | 2.23 | 0.49 |
| 16 | before (b) filter(keepUserModels) | 119 | 171 | 127 | 5.94 | 0.18 |
| 16 | now (a) new ModelManager | 44.1 | 59.8 | 340 | 2.21 | 0.49 |
| 16 | now (b) filter(() => true) | 42.1 | 55.0 | 363 | 2.11 | 0.52 |
| 16 | now (c) fork | 15.5 | 22.4 | 948 | 0.77 | 1.37 |
| 64 | TS 5.0.0 (a) | 101 | 133 | 590 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 203 | 246 | 309 | 2.01 | 0.52 |
| 64 | before (b) filter(keepUserModels) | 532 | 804 | 112 | 5.26 | 0.19 |
| 64 | now (a) new ModelManager | 180 | 236 | 344 | 1.78 | 0.58 |
| 64 | now (b) filter(() => true) | 158 | 172 | 385 | 1.56 | 0.65 |
| 64 | now (c) fork | 64.8 | 80.3 | 942 | 0.64 | 1.60 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.39 | 5.54 | 340 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 13.8 | 24.5 | 63 | 5.77 | 0.19 |
| 1 | before (b) filter(keepUserModels) | 23.0 | 44.9 | 38 | 9.59 | 0.11 |
| 1 | now (a) new ModelManager | 12.4 | 21.1 | 70 | 5.19 | 0.21 |
| 1 | now (b) filter(() => true) | 7.87 | 12.4 | 114 | 3.28 | 0.33 |
| 1 | now (c) fork | 7.00 | 11.6 | 131 | 2.92 | 0.39 |
| 16 | TS 5.0.0 (a) | 46.1 | 61.2 | 313 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 259 | 471 | 57 | 5.61 | 0.18 |
| 16 | before (b) filter(keepUserModels) | 417 | 610 | 36 | 9.06 | 0.12 |
| 16 | now (a) new ModelManager | 224 | 396 | 61 | 4.86 | 0.20 |
| 16 | now (b) filter(() => true) | 137 | 155 | 116 | 2.97 | 0.37 |
| 16 | now (c) fork | 121 | 145 | 129 | 2.64 | 0.41 |
| 64 | TS 5.0.0 (a) | 188 | 208 | 315 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 1178 | 1710 | 47 | 6.27 | 0.15 |
| 64 | before (b) filter(keepUserModels) | 1962 | 3055 | 27 | 10.44 | 0.08 |
| 64 | now (a) new ModelManager | 1030 | 1623 | 54 | 5.48 | 0.17 |
| 64 | now (b) filter(() => true) | 507 | 552 | 114 | 2.70 | 0.36 |
| 64 | now (c) fork | 466 | 506 | 132 | 2.48 | 0.42 |
