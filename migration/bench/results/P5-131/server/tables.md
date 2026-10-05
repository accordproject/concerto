#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) | WASM MB at end |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.91 | 7.12 | 280 | 1.00 | 1.00 | - |
| 1 | before (a) new ModelManager | 6.32 | 10.3 | 142 | 2.17 | 0.51 | 37.3 |
| 1 | before (b) filter(() => true) | 18.0 | 29.4 | 50 | 6.19 | 0.18 | 31.0 |
| 1 | before (c) fork | 1.59 | 3.40 | 520 | 0.54 | 1.86 | 17.9 |
| 1 | now (a) new ModelManager | 5.28 | 9.96 | 165 | 1.81 | 0.59 | 37.9 |
| 1 | now (b) filter(() => true) | 2.42 | 5.88 | 348 | 0.83 | 1.24 | 13.7 |
| 1 | now (c) fork | 1.48 | 3.08 | 594 | 0.51 | 2.12 | 13.7 |
| 16 | TS 5.0.0 (a) | 57.7 | 88.4 | 259 | 1.00 | 1.00 | - |
| 16 | before (a) new ModelManager | 101 | 156 | 153 | 1.75 | 0.59 | 63.6 |
| 16 | before (b) filter(() => true) | 300 | 389 | 52 | 5.20 | 0.20 | 49.6 |
| 16 | before (c) fork | 28.3 | 42.9 | 543 | 0.49 | 2.10 | 18.5 |
| 16 | now (a) new ModelManager | 90.2 | 148 | 161 | 1.56 | 0.62 | 62.5 |
| 16 | now (b) filter(() => true) | 47.3 | 73.3 | 328 | 0.82 | 1.27 | 18.4 |
| 16 | now (c) fork | 26.7 | 39.8 | 579 | 0.46 | 2.24 | 13.5 |
| 64 | TS 5.0.0 (a) | 244 | 281 | 248 | 1.00 | 1.00 | - |
| 64 | before (a) new ModelManager | 470 | 784 | 123 | 1.93 | 0.49 | 105.3 |
| 64 | before (b) filter(() => true) | 1322 | 1637 | 46 | 5.42 | 0.19 | 80.4 |
| 64 | before (c) fork | 114 | 134 | 533 | 0.47 | 2.15 | 22.1 |
| 64 | now (a) new ModelManager | 464 | 750 | 129 | 1.90 | 0.52 | 105.3 |
| 64 | now (b) filter(() => true) | 172 | 212 | 353 | 0.71 | 1.42 | 19.9 |
| 64 | now (c) fork | 94.7 | 118 | 650 | 0.39 | 2.62 | 20.7 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) | WASM MB at end |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.27 | 5.00 | 554 | 1.00 | 1.00 | - |
| 1 | before (a) new ModelManager | 2.83 | 6.37 | 299 | 2.23 | 0.54 | 26.4 |
| 1 | before (b) filter(() => true) | 2.18 | 4.45 | 408 | 1.72 | 0.74 | 15.1 |
| 1 | before (c) fork | 1.07 | 2.18 | 753 | 0.84 | 1.36 | 14.3 |
| 1 | now (a) new ModelManager | 2.71 | 6.87 | 294 | 2.14 | 0.53 | 15.0 |
| 1 | now (b) filter(() => true) | 1.70 | 3.85 | 482 | 1.34 | 0.87 | 10.9 |
| 1 | now (c) fork | 0.98 | 1.91 | 822 | 0.77 | 1.48 | 9.4 |
| 16 | TS 5.0.0 (a) | 27.1 | 41.5 | 531 | 1.00 | 1.00 | - |
| 16 | before (a) new ModelManager | 60.3 | 103 | 243 | 2.22 | 0.46 | 35.8 |
| 16 | before (b) filter(() => true) | 36.2 | 51.3 | 418 | 1.33 | 0.79 | 16.1 |
| 16 | before (c) fork | 23.0 | 33.7 | 660 | 0.85 | 1.24 | 14.3 |
| 16 | now (a) new ModelManager | 58.0 | 91.2 | 260 | 2.14 | 0.49 | 34.7 |
| 16 | now (b) filter(() => true) | 38.7 | 50.5 | 414 | 1.42 | 0.78 | 13.7 |
| 16 | now (c) fork | 18.2 | 28.6 | 835 | 0.67 | 1.57 | 14.3 |
| 64 | TS 5.0.0 (a) | 111 | 153 | 501 | 1.00 | 1.00 | - |
| 64 | before (a) new ModelManager | 231 | 290 | 258 | 2.07 | 0.51 | 44.3 |
| 64 | before (b) filter(() => true) | 134 | 161 | 439 | 1.21 | 0.88 | 18.7 |
| 64 | before (c) fork | 82.0 | 99.3 | 725 | 0.74 | 1.45 | 14.3 |
| 64 | now (a) new ModelManager | 216 | 265 | 281 | 1.94 | 0.56 | 37.8 |
| 64 | now (b) filter(() => true) | 141 | 179 | 416 | 1.27 | 0.83 | 13.7 |
| 64 | now (c) fork | 68.7 | 92.2 | 877 | 0.62 | 1.75 | 14.3 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) | WASM MB at end |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.98 | 7.44 | 262 | 1.00 | 1.00 | - |
| 1 | before (a) new ModelManager | 16.9 | 28.8 | 51 | 5.67 | 0.19 | 74.5 |
| 1 | before (b) filter(() => true) | 11.5 | 17.5 | 79 | 3.87 | 0.30 | 9.8 |
| 1 | before (c) fork | 9.62 | 16.2 | 92 | 3.23 | 0.35 | 8.5 |
| 1 | now (a) new ModelManager | 16.6 | 30.6 | 52 | 5.58 | 0.20 | 75.7 |
| 1 | now (b) filter(() => true) | 11.7 | 18.7 | 76 | 3.93 | 0.29 | 9.6 |
| 1 | now (c) fork | 10.2 | 16.6 | 85 | 3.43 | 0.33 | 8.4 |
| 16 | TS 5.0.0 (a) | 69.3 | 87.9 | 224 | 1.00 | 1.00 | - |
| 16 | before (a) new ModelManager | 303 | 493 | 46 | 4.37 | 0.21 | 120.8 |
| 16 | before (b) filter(() => true) | 190 | 256 | 80 | 2.75 | 0.36 | 11.3 |
| 16 | before (c) fork | 161 | 221 | 91 | 2.32 | 0.41 | 9.9 |
| 16 | now (a) new ModelManager | 299 | 494 | 47 | 4.32 | 0.21 | 120.7 |
| 16 | now (b) filter(() => true) | 195 | 232 | 81 | 2.81 | 0.36 | 10.9 |
| 16 | now (c) fork | 159 | 218 | 94 | 2.30 | 0.42 | 11.9 |
| 64 | TS 5.0.0 (a) | 222 | 282 | 241 | 1.00 | 1.00 | - |
| 64 | before (a) new ModelManager | 1353 | 2164 | 40 | 6.08 | 0.16 | 213.4 |
| 64 | before (b) filter(() => true) | 681 | 755 | 86 | 3.06 | 0.36 | 16.8 |
| 64 | before (c) fork | 622 | 711 | 97 | 2.80 | 0.40 | 13.3 |
| 64 | now (a) new ModelManager | 1327 | 2033 | 41 | 5.97 | 0.17 | 213.3 |
| 64 | now (b) filter(() => true) | 648 | 711 | 93 | 2.92 | 0.39 | 15.7 |
| 64 | now (c) fork | 611 | 693 | 96 | 2.75 | 0.40 | 13.1 |

#### Approach (b), `filter(() => true)`: p50 ms (x TS 5.0.0 (a) of the same run)

P5-109 and P5-121 are those tasks' own runs (their now heads; each against its own TS 5.0.0 rounds); before and now are this run's. WASM MB is the engine's linear memory at the end of the N = 64 run.

| set | N | P5-109 now | P5-121 now | P5-131 before | **P5-131 now** | now / P5-109 | WASM MB end N = 64: P5-109 / P5-121 / before / **now** |
|---|---:|---:|---:|---:|---:|---:|---|
| concerto-core-test-data | 1 | 3.69 (1.49) | 16.9 (6.32) | 18.0 (6.19) | **2.42 (0.83)** | 0.66 |  |
| concerto-core-test-data | 16 | 62.6 (1.40) | 282 (5.31) | 300 (5.20) | **47.3 (0.82)** | 0.75 |  |
| concerto-core-test-data | 64 | 238 (1.40) | 1196 (5.52) | 1322 (5.42) | **172 (0.71)** | 0.72 | 14.7 / 80.1 / 80.4 / **19.9** |
| conformance | 1 | 2.36 (2.22) | 1.74 (1.37) | 2.18 (1.72) | **1.70 (1.34)** | 0.72 |  |
| conformance | 16 | 42.1 (2.11) | 35.8 (1.44) | 36.2 (1.33) | **38.7 (1.42)** | 0.92 |  |
| conformance | 64 | 158 (1.56) | 132 (1.19) | 134 (1.21) | **141 (1.27)** | 0.89 | 12.1 / 18.7 / 18.7 / **13.7** |
| synthetic-large | 1 | 7.87 (3.28) | 10.2 (3.05) | 11.5 (3.87) | **11.7 (3.93)** | 1.49 |  |
| synthetic-large | 16 | 137 (2.97) | 178 (3.31) | 190 (2.75) | **195 (2.81)** | 1.43 |  |
| synthetic-large | 64 | 507 (2.70) | 651 (3.23) | 681 (3.06) | **648 (2.92)** | 1.28 | 16.3 / 16.8 / 16.8 / **15.7** |

#### Files one `filter(() => true)` shares, per set

shared = the unchanged file shared into the new manager; engine-staged = a filtered file the engine staged (P5-125); re-staged = returned as an AST and rebuilt through `new ModelFile`.

| set | files | before: shared / engine-staged / re-staged | **now: shared / engine-staged / re-staged** |
|---|---:|---|---|
| concerto-core-test-data | 35 | 18 / 0 / 15 | **33 / 0 / 0** |
| conformance | 41 | 41 / 0 / 0 | **41 / 0 / 0** |
| synthetic-large | 1 | 1 / 0 / 0 | **1 / 0 / 0** |
