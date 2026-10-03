#### concerto-core-test-data

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.33 | 4.31 | 381 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 4.55 | 7.86 | 201 | 1.95 | 0.53 |
| 1 | head (b) filter | - | - | - | - | - |
| 1 | P5-97 (a) new + reload | 4.33 | 6.90 | 209 | 1.86 | 0.55 |
| 1 | P5-97 (b) filter | - | - | - | - | - |
| 1 | P5-97 (c) fork | 1.48 | 2.49 | 616 | 0.63 | 1.62 |
| 16 | TS 5.0.0 (a) | 42.9 | 66.9 | 335 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 79.2 | 108 | 191 | 1.84 | 0.57 |
| 16 | head (b) filter | - | - | - | - | - |
| 16 | P5-97 (a) new + reload | 77.4 | 118 | 191 | 1.80 | 0.57 |
| 16 | P5-97 (b) filter | - | - | - | - | - |
| 16 | P5-97 (c) fork | 24.7 | 33.3 | 637 | 0.58 | 1.90 |
| 64 | TS 5.0.0 (a) | 166 | 197 | 362 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 332 | 570 | 172 | 1.99 | 0.47 |
| 64 | head (b) filter | - | - | - | - | - |
| 64 | P5-97 (a) new + reload | 350 | 578 | 165 | 2.11 | 0.46 |
| 64 | P5-97 (b) filter | - | - | - | - | - |
| 64 | P5-97 (c) fork | 106 | 120 | 619 | 0.64 | 1.71 |

#### conformance

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 1.02 | 1.90 | 842 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 2.46 | 4.28 | 354 | 2.41 | 0.42 |
| 1 | head (b) filter | 6.68 | 9.79 | 135 | 6.55 | 0.16 |
| 1 | P5-97 (a) new + reload | 2.49 | 3.68 | 360 | 2.44 | 0.43 |
| 1 | P5-97 (b) filter | 2.36 | 4.22 | 376 | 2.31 | 0.45 |
| 1 | P5-97 (c) fork | 1.03 | 1.87 | 808 | 1.01 | 0.96 |
| 16 | TS 5.0.0 (a) | 19.8 | 33.3 | 724 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 44.5 | 62.0 | 347 | 2.24 | 0.48 |
| 16 | head (b) filter | 113 | 164 | 130 | 5.72 | 0.18 |
| 16 | P5-97 (a) new + reload | 51.9 | 65.1 | 301 | 2.62 | 0.42 |
| 16 | P5-97 (b) filter | 38.6 | 49.9 | 404 | 1.95 | 0.56 |
| 16 | P5-97 (c) fork | 16.0 | 21.9 | 965 | 0.81 | 1.33 |
| 64 | TS 5.0.0 (a) | 76.6 | 112 | 697 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 181 | 228 | 334 | 2.37 | 0.48 |
| 64 | head (b) filter | 510 | 716 | 117 | 6.66 | 0.17 |
| 64 | P5-97 (a) new + reload | 180 | 222 | 344 | 2.35 | 0.49 |
| 64 | P5-97 (b) filter | 162 | 183 | 389 | 2.11 | 0.56 |
| 64 | P5-97 (c) fork | 67.4 | 85.9 | 926 | 0.88 | 1.33 |

#### synthetic-large

| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |
|---:|---|---:|---:|---:|---:|---:|
| 1 | TS 5.0.0 (a) | 2.23 | 4.51 | 381 | 1.00 | 1.00 |
| 1 | head (a) new + reload | 13.8 | 24.0 | 64 | 6.17 | 0.17 |
| 1 | head (b) filter | 22.9 | 45.6 | 39 | 10.24 | 0.10 |
| 1 | P5-97 (a) new + reload | 14.0 | 21.7 | 64 | 6.26 | 0.17 |
| 1 | P5-97 (b) filter | 9.20 | 13.7 | 101 | 4.12 | 0.27 |
| 1 | P5-97 (c) fork | 8.49 | 12.5 | 111 | 3.80 | 0.29 |
| 16 | TS 5.0.0 (a) | 43.0 | 62.8 | 325 | 1.00 | 1.00 |
| 16 | head (a) new + reload | 247 | 405 | 58 | 5.76 | 0.18 |
| 16 | head (b) filter | 411 | 615 | 36 | 9.56 | 0.11 |
| 16 | P5-97 (a) new + reload | 249 | 384 | 57 | 5.80 | 0.18 |
| 16 | P5-97 (b) filter | 153 | 167 | 103 | 3.57 | 0.32 |
| 16 | P5-97 (c) fork | 140 | 158 | 113 | 3.25 | 0.35 |
| 64 | TS 5.0.0 (a) | 163 | 178 | 360 | 1.00 | 1.00 |
| 64 | head (a) new + reload | 1065 | 1621 | 51 | 6.54 | 0.14 |
| 64 | head (b) filter | 1709 | 2367 | 31 | 10.49 | 0.09 |
| 64 | P5-97 (a) new + reload | 1032 | 1573 | 53 | 6.34 | 0.15 |
| 64 | P5-97 (b) filter | 586 | 648 | 103 | 3.60 | 0.29 |
| 64 | P5-97 (c) fork | 556 | 586 | 112 | 3.41 | 0.31 |

#### Memory per held manager (100 held, after a GC)

| set | side | WASM KB | RSS KB | JS heap KB |
|---|---|---:|---:|---:|
| concerto-core-test-data | TS 5.0.0 (a) | 0.0 | 527.0 | 303.6 |
| concerto-core-test-data | head (a) new + reload | 393.0 | 435.9 | 3.1 |
| concerto-core-test-data | P5-97 (a) new + reload | 404.5 | 451.8 | 2.7 |
| concerto-core-test-data | P5-97 (c) fork | 41.0 | 135.7 | 54.9 |
| conformance | TS 5.0.0 (a) | 0.0 | 386.3 | 160.7 |
| conformance | head (a) new + reload | 124.8 | 258.7 | 73.4 |
| conformance | head (b) filter | 494.1 | 654.6 | 85.9 |
| conformance | P5-97 (a) new + reload | 128.0 | 98.2 | 73.4 |
| conformance | P5-97 (b) filter | 32.0 | 166.4 | 64.9 |
| conformance | P5-97 (c) fork | 24.3 | 163.8 | 60.6 |
| synthetic-large | TS 5.0.0 (a) | 0.0 | 520.8 | 410.9 |
| synthetic-large | head (a) new + reload | 537.0 | 495.0 | -41.2 |
| synthetic-large | head (b) filter | 2495.4 | 2674.2 | 255.3 |
| synthetic-large | P5-97 (a) new + reload | 583.0 | 537.2 | -41.5 |
| synthetic-large | P5-97 (b) filter | 48.0 | 140.8 | 21.5 |
| synthetic-large | P5-97 (c) fork | 44.8 | 41.0 | 18.5 |

#### GC share of the V8 profile (TS-API loop, 6 s)

| op | set | head (before) | P5-97 (after) |
|---|---|---:|---:|
| extract_cold | concerto-core-test-data | 33.9% | 34.5% |
| extract_cold | conformance | 19.1% | 18.8% |
| extract_cold | synthetic-large | 44.2% | 42.6% |
| add_model_file | concerto-core-test-data | 24.7% | 24.6% |
| add_model_file | conformance | 23.5% | 22.9% |
| add_model_file | synthetic-large | 18% | 17.3% |

#### Soak: fork per request at N=64

| set | seconds | requests | WASM MB at 10% / 50% / end | RSS MB at 10% / 50% / end | RSS slope after warm-up (MB/min) | WASM grows after warm-up | verdict |
|---|---:|---:|---|---|---:|---|---|
| conformance | 1200 | 1697280 | 62.5 / 62.8 / 71.0 | 387.7 / 387.9 / 417.5 | 0.26 | yes | growth (fail) |
| synthetic-large | 600 | 68800 | 33.0 / 33.0 / 33.0 | 333.3 / 330.5 / 335.6 | 0.43 | no | plateau (pass) |
