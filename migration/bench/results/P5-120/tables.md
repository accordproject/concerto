#### conformance

| side | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |
|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| TS 5.0.0, new manager per request | 1200 | 850176 | 708 | 204.7 | 204.2 | -0.03 | 204.7 / 204.2 | 0.0 / 0.0 | 0.0 / 0.0 | 73.5 / 128.3 / 2.2 | 448 / 704 | plateau (pass) |
| Rust, new manager per request | 1200 | 442112 | 368 | 518.5 | 518.2 | 0.03 | 518.2 / 518.5 | 67.3 / 221.6 | 2.3 / 0.3 | 71.0 / 117.0 / 223.7 | 704 / 1216 | growth (fail) |
| Rust, fork() per request | 1200 | 1287872 | 1073 | 332.5 | 332.4 | 0.00 | 332.4 / 332.5 | 40.4 / 55.3 | 0.0 / 0.0 | 81.4 / 138.3 / 57.6 | 1024 / 1600 | plateau (pass) |

GC pauses, conformance (major = mark-compact plus incremental marking steps; minor = scavenges):

| side | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| TS 5.0.0, new manager per request | 44524 | 158.2 | 13.2% | 13.2% | 5.15 | 103.7 | 3074 / 9.7 | 41450 / 148.5 | 0 / 0.0 |
| Rust, new manager per request | 8490 | 66.9 | 5.6% | 5.5% | 14.87 | 161.1 | 1594 / 9.5 | 6896 / 57.4 | 0 / 0.0 |
| Rust, fork() per request | 20822 | 169.4 | 14.1% | 14.2% | 13.25 | 664.1 | 1794 / 21.4 | 19028 / 148.0 | 0 / 0.0 |

Curves, conformance (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):

| % of run | TS 5.0.0, new manager per request | Rust, new manager per request | Rust, fork() per request |
|---:|---|---|---|
| 0% | 199.6 / 0.0 / 118.6, 3136 | 293.4 / 67.3 / 46.7, 1472 | 285.8 / 40.4 / 84.9, 4736 |
| 10% | 204.1 / 0.0 / 37.1, 90816 | 514.7 / 219.1 / 109.8, 44672 | 332.4 / 55.3 / 115.4, 135936 |
| 20% | 204.1 / 0.0 / 49.2, 178560 | 515.7 / 219.1 / 100.7, 88448 | 332.4 / 55.3 / 42.7, 269824 |
| 30% | 204.2 / 0.0 / 40.7, 262272 | 518.2 / 221.4 / 93.5, 134912 | 332.4 / 55.3 / 89.8, 392000 |
| 40% | 204.7 / 0.0 / 76.7, 349248 | 518.2 / 221.4 / 88.6, 178176 | 332.4 / 55.3 / 74.3, 518848 |
| 50% | 204.7 / 0.0 / 88.2, 433536 | 518.2 / 221.4 / 33.8, 221888 | 332.4 / 55.3 / 42.6, 646272 |
| 60% | 204.2 / 0.0 / 92.6, 515648 | 518.2 / 221.4 / 56.5, 265664 | 332.4 / 55.3 / 74.2, 770496 |
| 70% | 204.0 / 0.0 / 91.8, 599488 | 518.2 / 221.4 / 70.6, 308608 | 332.4 / 55.3 / 70.5, 896896 |
| 80% | 204.1 / 0.0 / 46.7, 679680 | 518.2 / 221.4 / 110.1, 354624 | 332.4 / 55.3 / 54.2, 1019968 |
| 90% | 204.1 / 0.0 / 31.4, 765184 | 518.2 / 221.4 / 37.4, 398080 | 332.4 / 55.3 / 117.8, 1152832 |
| 100% | 204.1 / 0.0 / 95.5, 850176 | 518.5 / 221.6 / 104.7, 442112 | 332.5 / 55.3 / 34.5, 1287872 |

Charts: [conformance-rss](results/P5-120/charts/conformance-rss.svg), [conformance-wasm](results/P5-120/charts/conformance-wasm.svg), [conformance-heap](results/P5-120/charts/conformance-heap.svg).

#### synthetic-large

| side | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |
|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| TS 5.0.0, new manager per request | 1200 | 412736 | 344 | 289.1 | 288.2 | 0.07 | 288.2 / 289.1 | 0.0 / 0.0 | 0.0 / 0.0 | 115.7 / 184.3 / 2.2 | 320 / 512 | plateau (pass) |
| Rust, new manager per request | 1202 | 69952 | 58 | 944.9 | 940.5 | 1.67 | 943.9 / 944.9 | 360.8 / 681.4 | 18.8 / 0.0 | 49.4 / 98.3 / 683.9 | 208 / 327 | plateau (pass) (P5-97 strict form, no WASM growth after warm-up at all: fail) |
| Rust, fork() per request | 1201 | 129344 | 108 | 306.4 | 304.4 | 0.00 | 306.4 / 306.3 | 25.8 / 28.1 | 0.0 / 0.0 | 68.1 / 113.0 / 30.6 | 256 / 328 | plateau (pass) |

GC pauses, synthetic-large (major = mark-compact plus incremental marking steps; minor = scavenges):

| side | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| TS 5.0.0, new manager per request | 42449 | 154.0 | 12.8% | 12.8% | 4.89 | 198.2 | 2400 / 7.2 | 40049 / 146.8 | 0 / 0.0 |
| Rust, new manager per request | 6275 | 29.7 | 2.5% | 2.4% | 7.68 | 81.1 | 2124 / 3.6 | 4151 / 26.1 | 0 / 0.0 |
| Rust, fork() per request | 8838 | 51.3 | 4.3% | 4.3% | 7.97 | 187.2 | 1351 / 3.4 | 7487 / 47.9 | 0 / 0.0 |

Curves, synthetic-large (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):

| % of run | TS 5.0.0, new manager per request | Rust, new manager per request | Rust, fork() per request |
|---:|---|---|---|
| 0% | 284.1 / 0.0 / 197.0, 1536 | 559.7 / 360.8 / 15.0, 256 | 297.5 / 25.8 / 48.1, 512 |
| 10% | 287.7 / 0.0 / 90.5, 43520 | 923.1 / 662.6 / 74.1, 7168 | 305.2 / 28.0 / 73.0, 13440 |
| 20% | 287.7 / 0.0 / 165.1, 83392 | 920.0 / 662.6 / 68.8, 14208 | 303.8 / 28.1 / 42.8, 25792 |
| 30% | 287.7 / 0.0 / 117.6, 125440 | 921.3 / 662.6 / 50.3, 21312 | 303.9 / 28.1 / 43.0, 38848 |
| 40% | 288.1 / 0.0 / 99.3, 165056 | 921.0 / 662.6 / 49.3, 28160 | 305.1 / 28.1 / 92.4, 51456 |
| 50% | 288.2 / 0.0 / 117.8, 207360 | 940.7 / 681.4 / 49.2, 35200 | 304.6 / 28.1 / 92.0, 64128 |
| 60% | 288.2 / 0.0 / 166.1, 247360 | 940.5 / 681.4 / 50.8, 42240 | 306.1 / 28.1 / 72.5, 77120 |
| 70% | 288.2 / 0.0 / 68.0, 289344 | 939.8 / 681.4 / 49.0, 49216 | 304.6 / 28.1 / 91.7, 90240 |
| 80% | 288.5 / 0.0 / 167.9, 330304 | 940.4 / 681.4 / 44.9, 56192 | 303.9 / 28.1 / 43.1, 103744 |
| 90% | 288.7 / 0.0 / 119.8, 372800 | 940.9 / 681.4 / 21.3, 63232 | 303.6 / 28.1 / 20.9, 116736 |
| 100% | 289.1 / 0.0 / 62.5, 412736 | 941.3 / 681.4 / 42.2, 69952 | 304.5 / 28.1 / 67.4, 129344 |

Charts: [synthetic-large-rss](results/P5-120/charts/synthetic-large-rss.svg), [synthetic-large-wasm](results/P5-120/charts/synthetic-large-wasm.svg), [synthetic-large-heap](results/P5-120/charts/synthetic-large-heap.svg).
