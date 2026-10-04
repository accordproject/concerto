#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.67 | 7.50 | 275 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 4.92 | 8.63 | 178 | 1.84 | 0.65 |
| 1 | before (b) filter(() => true) | 4.19 | 7.82 | 212 | 1.57 | 0.77 |
| 1 | before (c) fork | 1.49 | 3.02 | 580 | 0.56 | 2.11 |
| 1 | now (a) new ModelManager | 5.02 | 10.0 | 171 | 1.88 | 0.62 |
| 1 | now (b) filter(() => true) | 16.9 | 26.6 | 54 | 6.32 | 0.20 |
| 1 | now (c) fork | 1.60 | 3.35 | 535 | 0.60 | 1.94 |
| 16 | TS 5.0.0 (a) | 53.1 | 74.2 | 277 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 85.2 | 155 | 168 | 1.60 | 0.61 |
| 16 | before (b) filter(() => true) | 70.6 | 94.6 | 216 | 1.33 | 0.78 |
| 16 | before (c) fork | 26.6 | 43.0 | 554 | 0.50 | 2.00 |
| 16 | now (a) new ModelManager | 87.2 | 137 | 170 | 1.64 | 0.61 |
| 16 | now (b) filter(() => true) | 282 | 335 | 56 | 5.31 | 0.20 |
| 16 | now (c) fork | 28.5 | 42.3 | 550 | 0.54 | 1.99 |
| 64 | TS 5.0.0 (a) | 217 | 266 | 276 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 440 | 673 | 143 | 2.03 | 0.52 |
| 64 | before (b) filter(() => true) | 287 | 326 | 215 | 1.32 | 0.78 |
| 64 | before (c) fork | 104 | 132 | 588 | 0.48 | 2.13 |
| 64 | now (a) new ModelManager | 408 | 707 | 147 | 1.88 | 0.53 |
| 64 | now (b) filter(() => true) | 1196 | 1462 | 53 | 5.52 | 0.19 |
| 64 | now (c) fork | 111 | 132 | 557 | 0.51 | 2.02 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.27 | 4.59 | 585 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 2.83 | 6.17 | 284 | 2.22 | 0.49 |
| 1 | before (b) filter(() => true) | 2.59 | 4.75 | 340 | 2.04 | 0.58 |
| 1 | before (c) fork | 1.05 | 1.81 | 761 | 0.83 | 1.30 |
| 1 | now (a) new ModelManager | 2.75 | 6.14 | 294 | 2.16 | 0.50 |
| 1 | now (b) filter(() => true) | 1.74 | 3.69 | 459 | 1.37 | 0.78 |
| 1 | now (c) fork | 1.08 | 1.85 | 741 | 0.85 | 1.27 |
| 16 | TS 5.0.0 (a) | 24.8 | 36.4 | 593 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 51.4 | 73.8 | 295 | 2.07 | 0.50 |
| 16 | before (b) filter(() => true) | 43.8 | 58.9 | 348 | 1.76 | 0.59 |
| 16 | before (c) fork | 17.6 | 27.0 | 822 | 0.71 | 1.39 |
| 16 | now (a) new ModelManager | 47.5 | 81.1 | 297 | 1.91 | 0.50 |
| 16 | now (b) filter(() => true) | 35.8 | 54.1 | 436 | 1.44 | 0.74 |
| 16 | now (c) fork | 20.7 | 27.7 | 774 | 0.83 | 1.30 |
| 64 | TS 5.0.0 (a) | 110 | 125 | 567 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 208 | 257 | 293 | 1.88 | 0.52 |
| 64 | before (b) filter(() => true) | 210 | 257 | 295 | 1.90 | 0.52 |
| 64 | before (c) fork | 71.5 | 91.5 | 834 | 0.65 | 1.47 |
| 64 | now (a) new ModelManager | 219 | 271 | 281 | 1.99 | 0.50 |
| 64 | now (b) filter(() => true) | 132 | 160 | 448 | 1.19 | 0.79 |
| 64 | now (c) fork | 75.7 | 90.8 | 826 | 0.69 | 1.46 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 3.35 | 7.89 | 247 | 1.00 | 1.00 |
| 1 | before (a) new ModelManager | 14.7 | 25.9 | 60 | 4.40 | 0.24 |
| 1 | before (b) filter(() => true) | 9.81 | 16.2 | 92 | 2.93 | 0.37 |
| 1 | before (c) fork | 8.96 | 14.9 | 99 | 2.68 | 0.40 |
| 1 | now (a) new ModelManager | 15.2 | 27.5 | 56 | 4.55 | 0.23 |
| 1 | now (b) filter(() => true) | 10.2 | 16.2 | 88 | 3.05 | 0.35 |
| 1 | now (c) fork | 9.37 | 15.5 | 94 | 2.80 | 0.38 |
| 16 | TS 5.0.0 (a) | 53.8 | 74.1 | 269 | 1.00 | 1.00 |
| 16 | before (a) new ModelManager | 269 | 478 | 51 | 5.00 | 0.19 |
| 16 | before (b) filter(() => true) | 168 | 213 | 92 | 3.13 | 0.34 |
| 16 | before (c) fork | 156 | 178 | 98 | 2.89 | 0.37 |
| 16 | now (a) new ModelManager | 297 | 415 | 49 | 5.53 | 0.18 |
| 16 | now (b) filter(() => true) | 178 | 213 | 87 | 3.31 | 0.32 |
| 16 | now (c) fork | 159 | 192 | 99 | 2.95 | 0.37 |
| 64 | TS 5.0.0 (a) | 201 | 226 | 277 | 1.00 | 1.00 |
| 64 | before (a) new ModelManager | 1159 | 1858 | 46 | 5.75 | 0.16 |
| 64 | before (b) filter(() => true) | 645 | 727 | 92 | 3.20 | 0.33 |
| 64 | before (c) fork | 606 | 642 | 101 | 3.01 | 0.37 |
| 64 | now (a) new ModelManager | 1195 | 1838 | 44 | 5.93 | 0.16 |
| 64 | now (b) filter(() => true) | 651 | 773 | 92 | 3.23 | 0.33 |
| 64 | now (c) fork | 645 | 700 | 97 | 3.20 | 0.35 |

