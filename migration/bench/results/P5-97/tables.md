#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.31 | 5.37 | 349 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 4.59 | 7.76 | 197 | 1.98 | 0.56 |
| 1 | head (b) filter | - | - | - | - | - |
| 1 | P5-97 (a) new + reload | 4.47 | 7.95 | 202 | 1.93 | 0.58 |
| 1 | P5-97 (b) filter | - | - | - | - | - |
| 1 | P5-97 (c) fork | 1.53 | 3.11 | 574 | 0.66 | 1.64 |
| 16 | TS 5.0.0 (a) | 43.8 | 62.0 | 344 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 78.5 | 116 | 194 | 1.79 | 0.56 |
| 16 | head (b) filter | - | - | - | - | - |
| 16 | P5-97 (a) new + reload | 74.2 | 113 | 201 | 1.69 | 0.58 |
| 16 | P5-97 (b) filter | - | - | - | - | - |
| 16 | P5-97 (c) fork | 26.5 | 34.8 | 609 | 0.60 | 1.77 |
| 64 | TS 5.0.0 (a) | 179 | 208 | 328 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 329 | 535 | 176 | 1.84 | 0.54 |
| 64 | head (b) filter | - | - | - | - | - |
| 64 | P5-97 (a) new + reload | 342 | 613 | 167 | 1.91 | 0.51 |
| 64 | P5-97 (b) filter | - | - | - | - | - |
| 64 | P5-97 (c) fork | 103 | 121 | 610 | 0.57 | 1.86 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.05 | 3.67 | 734 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 2.65 | 4.58 | 335 | 2.51 | 0.46 |
| 1 | head (b) filter | 6.61 | 11.5 | 131 | 6.27 | 0.18 |
| 1 | P5-97 (a) new + reload | 2.63 | 4.96 | 341 | 2.49 | 0.46 |
| 1 | P5-97 (b) filter | 2.30 | 3.21 | 400 | 2.19 | 0.55 |
| 1 | P5-97 (c) fork | 1.05 | 1.79 | 805 | 1.00 | 1.10 |
| 16 | TS 5.0.0 (a) | 19.9 | 32.2 | 719 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 47.9 | 63.1 | 327 | 2.40 | 0.45 |
| 16 | head (b) filter | 117 | 165 | 127 | 5.87 | 0.18 |
| 16 | P5-97 (a) new + reload | 44.3 | 59.4 | 343 | 2.22 | 0.48 |
| 16 | P5-97 (b) filter | 42.1 | 58.1 | 370 | 2.11 | 0.51 |
| 16 | P5-97 (c) fork | 16.1 | 24.3 | 909 | 0.81 | 1.26 |
| 64 | TS 5.0.0 (a) | 81.0 | 105 | 711 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 180 | 204 | 350 | 2.23 | 0.49 |
| 64 | head (b) filter | 512 | 726 | 118 | 6.32 | 0.17 |
| 64 | P5-97 (a) new + reload | 179 | 215 | 341 | 2.21 | 0.48 |
| 64 | P5-97 (b) filter | 151 | 170 | 393 | 1.86 | 0.55 |
| 64 | P5-97 (c) fork | 70.8 | 82.8 | 865 | 0.87 | 1.22 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.29 | 5.07 | 360 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 13.6 | 25.2 | 65 | 5.93 | 0.18 |
| 1 | head (b) filter | 21.8 | 44.1 | 40 | 9.54 | 0.11 |
| 1 | P5-97 (a) new + reload | 14.0 | 23.7 | 63 | 6.12 | 0.18 |
| 1 | P5-97 (b) filter | 9.41 | 15.7 | 96 | 4.11 | 0.27 |
| 1 | P5-97 (c) fork | 8.47 | 12.5 | 110 | 3.70 | 0.31 |
| 16 | TS 5.0.0 (a) | 43.6 | 67.3 | 309 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 242 | 382 | 61 | 5.54 | 0.20 |
| 16 | head (b) filter | 413 | 665 | 34 | 9.48 | 0.11 |
| 16 | P5-97 (a) new + reload | 250 | 382 | 61 | 5.73 | 0.20 |
| 16 | P5-97 (b) filter | 158 | 185 | 100 | 3.62 | 0.32 |
| 16 | P5-97 (c) fork | 143 | 157 | 109 | 3.29 | 0.35 |
| 64 | TS 5.0.0 (a) | 165 | 181 | 353 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 1056 | 1555 | 52 | 6.38 | 0.15 |
| 64 | head (b) filter | 1721 | 2291 | 31 | 10.40 | 0.09 |
| 64 | P5-97 (a) new + reload | 1069 | 1556 | 52 | 6.46 | 0.15 |
| 64 | P5-97 (b) filter | 594 | 657 | 99 | 3.59 | 0.28 |
| 64 | P5-97 (c) fork | 568 | 612 | 110 | 3.44 | 0.31 |

#### Memory per held manager (100 held, after a GC)

| set | side | WASM KB | RSS KB | JS heap KB |
|---|---|---:|---:|---:|
| concerto-core-test-data | TS 5.0.0 (a) | 0.0 | 397.0 | 303.1 |
| concerto-core-test-data | head (a) new + reload | 393.0 | 417.3 | 3.1 |
| concerto-core-test-data | P5-97 (a) new + reload | 405.8 | 451.6 | 3.0 |
| concerto-core-test-data | P5-97 (c) fork | 35.8 | 128.2 | 55.1 |
| conformance | TS 5.0.0 (a) | 0.0 | 360.6 | 160.6 |
| conformance | head (a) new + reload | 124.8 | 243.8 | 73.5 |
| conformance | head (b) filter | 494.1 | 636.6 | 86.2 |
| conformance | P5-97 (a) new + reload | 128.6 | 266.2 | 73.6 |
| conformance | P5-97 (b) filter | 32.6 | 168.4 | 65.1 |
| conformance | P5-97 (c) fork | 23.7 | 234.9 | 60.7 |
| synthetic-large | TS 5.0.0 (a) | 0.0 | 508.4 | 409.9 |
| synthetic-large | head (a) new + reload | 537.0 | 491.2 | -41.1 |
| synthetic-large | head (b) filter | 2492.8 | 2636.7 | 255.4 |
| synthetic-large | P5-97 (a) new + reload | 586.2 | 551.7 | -41.3 |
| synthetic-large | P5-97 (b) filter | 51.2 | 143.4 | 21.6 |
| synthetic-large | P5-97 (c) fork | 35.8 | 32.0 | 18.5 |

#### GC share of the V8 profile (TS-API loop, 6 s)

| op | set | head (before) | P5-97 (after) |
|---|---|---:|---:|
| extract_cold | concerto-core-test-data | 33.6% | 34.7% |
| extract_cold | conformance | 19.7% | 20.2% |
| extract_cold | synthetic-large | 43.7% | 43.8% |
| add_model_file | concerto-core-test-data | 24.5% | 25.1% |
| add_model_file | conformance | 23.3% | 22.5% |
| add_model_file | synthetic-large | 17.1% | 17.4% |

#### Soak: fork per request at N=64

| set | seconds | requests | WASM MB at 10% / 50% / end | RSS MB at 10% / 50% / end | RSS slope after warm-up (MB/min) | WASM growth after warm-up, 1st / 2nd half (MB) | unfinalized managers median / max | verdict |
|---|---:|---:|---|---|---:|---|---|---|
| conformance | 2400 | 3343040 | 60.8 / 62.6 / 63.7 | 382.6 / 388.5 / 389.7 | 0.07 | 1.9 / 0.0 | 1152 / 2048 | growth (fail) |
| synthetic-large | 1200 | 137664 | 28.3 / 28.3 / 28.3 | 310.3 / 308.6 / 308.2 | -0.02 | 0.0 / 0.0 | 256 / 384 | plateau (pass) |
