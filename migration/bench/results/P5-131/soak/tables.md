#### conformance

Warm-up: 20% of each run (240 s of 1,200 s, 480 s of 2,400 s). The 2,400 s run is also judged with P5-120's 240 s warm-up (the "240 s warm-up" row).

| side | run | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS slope, 2nd half (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| TS 5.0.0, new manager per request | P5-120 | 1200 | 850176 | 708 | 204.7 | 204.2 | -0.03 | 0.01 | 204.7 / 204.2 | 0.0 / 0.0 | 0.0 / 0.0 | 73.5 / 128.3 / 2.2 | 448 / 704 | plateau (pass) (strict form: pass) |
| TS 5.0.0, new manager per request | P5-131 | 1200 | 790976 | 659 | 203.0 | 202.3 | 0.07 | 0.08 | 202.3 / 203.0 | 0.0 / 0.0 | 0.0 / 0.0 | 76.6 / 124.5 / 2.2 | 512 / 704 | plateau (pass) (strict form: pass) |
| Rust, new manager per request | P5-120 | 1200 | 442112 | 368 | 518.5 | 518.2 | 0.03 | 0.03 | 518.2 / 518.5 | 67.3 / 221.6 | 2.3 / 0.3 | 71.0 / 117.0 / 223.7 | 704 / 1216 | growth (fail) |
| Rust, new manager per request | P5-131 | 2400 | 933696 | 389 | 414.3 | 414.3 | 0.06 | 0.00 | 414.3 / 414.3 | 68.2 / 175.6 | 1.0 / 0.0 | 51.9 / 98.5 / 177.9 | 576 / 960 | plateau (pass) (P5-97 strict form, no WASM growth after warm-up at all: fail) |
| Rust, new manager per request | P5-131, 240 s warm-up | 2400 | 933696 | 389 | 414.3 | 413.9 | 0.07 | 0.01 | 413.9 / 414.3 | 68.2 / 175.6 | 0.7 / 0.3 | 51.9 / 98.0 / 177.5 | 576 / 960 | growth (fail) |
| Rust, fork() per request | P5-120 | 1200 | 1287872 | 1073 | 332.5 | 332.4 | 0.00 | 0.00 | 332.4 / 332.5 | 40.4 / 55.3 | 0.0 / 0.0 | 81.4 / 138.3 / 57.6 | 1024 / 1600 | plateau (pass) (strict form: pass) |
| Rust, fork() per request | P5-131 | 1200 | 1830400 | 1525 | 273.4 | 271.9 | 0.19 | 0.17 | 271.9 / 273.4 | 47.4 / 54.4 | 0.0 / 0.6 | 43.7 / 85.8 / 56.0 | 960 / 1664 | growth (fail) |

GC pauses, conformance (major = mark-compact plus incremental marking steps; minor = scavenges):

| side | run | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| TS 5.0.0, new manager per request | P5-120 | 44524 | 158.2 | 13.2% | 13.2% | 5.15 | 103.7 | 3074 / 9.7 | 41450 / 148.5 | 0 / 0.0 |
| TS 5.0.0, new manager per request | P5-131 | 41517 | 152.5 | 12.7% | 12.7% | 5.33 | 143.4 | 2932 / 9.3 | 38585 / 143.2 | 0 / 0.0 |
| Rust, new manager per request | P5-120 | 8490 | 66.9 | 5.6% | 5.5% | 14.87 | 161.1 | 1594 / 9.5 | 6896 / 57.4 | 0 / 0.0 |
| Rust, new manager per request | P5-131 | 16885 | 130.6 | 5.4% | 5.4% | 12.70 | 73.5 | 2956 / 18.6 | 13929 / 112.0 | 0 / 0.0 |
| Rust, fork() per request | P5-120 | 20822 | 169.4 | 14.1% | 14.2% | 13.25 | 664.1 | 1794 / 21.4 | 19028 / 148.0 | 0 / 0.0 |
| Rust, fork() per request | P5-131 | 16595 | 81.2 | 6.8% | 6.8% | 7.43 | 23.6 | 2584 / 10.7 | 14011 / 70.5 | 0 / 0.0 |

Curves, conformance, P5-131 (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):

| % of run | TS 5.0.0, new manager per request (1200 s) | Rust, new manager per request (2400 s) | Rust, fork() per request (1200 s) |
|---:|---|---|---|
| 0% | 199.1 / 0.0 / 41.5, 3136 | 253.7 / 68.2 / 29.0, 1280 | 261.7 / 47.4 / 59.0, 6336 |
| 10% | 200.7 / 0.0 / 92.6, 82752 | 412.0 / 174.6 / 72.7, 89152 | 270.0 / 53.8 / 49.7, 188608 |
| 20% | 202.0 / 0.0 / 66.7, 160768 | 412.7 / 174.6 / 40.8, 182464 | 270.0 / 53.8 / 43.3, 368832 |
| 30% | 202.0 / 0.0 / 105.8, 245056 | 412.9 / 174.6 / 56.2, 274944 | 270.3 / 53.8 / 66.7, 560064 |
| 40% | 202.0 / 0.0 / 36.9, 328384 | 413.2 / 174.6 / 61.8, 369856 | 271.9 / 53.8 / 58.8, 741632 |
| 50% | 202.3 / 0.0 / 53.9, 409984 | 413.9 / 175.3 / 40.6, 465792 | 271.9 / 53.8 / 43.4, 915072 |
| 60% | 202.3 / 0.0 / 99.0, 485120 | 414.3 / 175.6 / 26.7, 560512 | 271.9 / 53.8 / 14.7, 1090176 |
| 70% | 202.6 / 0.0 / 37.6, 562368 | 414.3 / 175.6 / 56.7, 655168 | 272.7 / 53.8 / 65.8, 1271168 |
| 80% | 202.6 / 0.0 / 102.5, 641024 | 414.3 / 175.6 / 73.4, 751808 | 272.7 / 53.8 / 62.7, 1440832 |
| 90% | 203.0 / 0.0 / 41.4, 715648 | 414.3 / 175.6 / 29.3, 841344 | 273.3 / 54.4 / 52.9, 1627264 |
| 100% | 203.0 / 0.0 / 61.4, 790976 | 414.3 / 175.6 / 34.2, 933696 | 273.4 / 54.4 / 43.5, 1830400 |

WASM steps after warm-up, conformance (every 5 s sample where the engine's linear memory grew; "peak before" is the most unfinalised managers seen at any earlier sample; "new peak" means this sample's count is above it):

| side | run | warm-up steps | t (s) | step MB | WASM MB after | unfinalised at the step | peak before | new peak | requests done |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| Rust, new manager per request | P5-120 | 17 | 259 | 2.3 | 221.4 | 256 | 1216 | no | 94208 |
| Rust, new manager per request | P5-120 | 17 | 1122 | 0.3 | 221.6 | 704 | 1216 | no | 412736 |
| Rust, new manager per request | P5-131 | 15 | 1076 | 0.7 | 175.3 | 512 | 960 | no | 414784 |
| Rust, new manager per request | P5-131 | 15 | 1386 | 0.3 | 175.6 | 832 | 960 | no | 538368 |
| Rust, fork() per request | P5-120 | 1 | none | - | 55.3 | - | 1600 (max) | - | - |
| Rust, fork() per request | P5-131 | 4 | 1074 | 0.6 | 54.4 | 1280 | 1664 | no | 1610112 |

Charts: [conformance-rss](results/P5-131/soak/charts/conformance-rss.svg), [conformance-wasm](results/P5-131/soak/charts/conformance-wasm.svg), [conformance-heap](results/P5-131/soak/charts/conformance-heap.svg).

#### synthetic-large

Warm-up: 20% of each run (240 s of 1,200 s, 480 s of 2,400 s). The 2,400 s run is also judged with P5-120's 240 s warm-up (the "240 s warm-up" row).

| side | run | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS slope, 2nd half (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| TS 5.0.0, new manager per request | P5-120 | 1200 | 412736 | 344 | 289.1 | 288.2 | 0.07 | 0.09 | 288.2 / 289.1 | 0.0 / 0.0 | 0.0 / 0.0 | 115.7 / 184.3 / 2.2 | 320 / 512 | plateau (pass) (strict form: pass) |
| TS 5.0.0, new manager per request | P5-131 | 1200 | 330880 | 276 | 287.9 | 287.6 | 0.07 | 0.04 | 287.6 / 287.9 | 0.0 / 0.0 | 0.0 / 0.0 | 115.7 / 183.0 / 2.2 | 320 / 512 | plateau (pass) (strict form: pass) |
| Rust, new manager per request | P5-120 | 1202 | 69952 | 58 | 944.9 | 940.5 | 1.67 | -0.01 | 943.9 / 944.9 | 360.8 / 681.4 | 18.8 / 0.0 | 49.4 / 98.3 / 683.9 | 208 / 327 | plateau (pass) (P5-97 strict form, no WASM growth after warm-up at all: fail) |
| Rust, new manager per request | P5-131 | 2402 | 142016 | 59 | 783.0 | 781.7 | -0.01 | 0.01 | 782.9 / 783.0 | 360.8 / 569.0 | 0.0 / 0.0 | 38.9 / 85.1 / 571.4 | 192.5 / 257 | plateau (pass) (strict form: pass) |
| Rust, new manager per request | P5-131, 240 s warm-up | 2402 | 142016 | 59 | 783.0 | 781.7 | -0.01 | 0.00 | 782.9 / 783.0 | 360.8 / 569.0 | 0.0 / 0.0 | 38.9 / 85.1 / 571.4 | 192.5 / 257 | plateau (pass) (strict form: pass) |
| Rust, fork() per request | P5-120 | 1201 | 129344 | 108 | 306.4 | 304.4 | 0.00 | -0.00 | 306.4 / 306.3 | 25.8 / 28.1 | 0.0 / 0.0 | 68.1 / 113.0 / 30.6 | 256 / 328 | plateau (pass) (strict form: pass) |
| Rust, fork() per request | P5-131 | 1201 | 113664 | 95 | 332.4 | 329.2 | -0.00 | -0.01 | 332.4 / 330.0 | 35.1 / 39.6 | 0.0 / 0.0 | 62.6 / 86.6 / 42.0 | 192 / 449 | plateau (pass) (strict form: pass) |

GC pauses, synthetic-large (major = mark-compact plus incremental marking steps; minor = scavenges):

| side | run | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| TS 5.0.0, new manager per request | P5-120 | 42449 | 154.0 | 12.8% | 12.8% | 4.89 | 198.2 | 2400 / 7.2 | 40049 / 146.8 | 0 / 0.0 |
| TS 5.0.0, new manager per request | P5-131 | 34093 | 147.4 | 12.3% | 12.3% | 6.12 | 103.8 | 1998 / 6.7 | 32095 / 140.7 | 0 / 0.0 |
| Rust, new manager per request | P5-120 | 6275 | 29.7 | 2.5% | 2.4% | 7.68 | 81.1 | 2124 / 3.6 | 4151 / 26.1 | 0 / 0.0 |
| Rust, new manager per request | P5-131 | 11047 | 55.9 | 2.3% | 2.3% | 7.81 | 77.2 | 3286 / 6.4 | 7761 / 49.5 | 0 / 0.0 |
| Rust, fork() per request | P5-120 | 8838 | 51.3 | 4.3% | 4.3% | 7.97 | 187.2 | 1351 / 3.4 | 7487 / 47.9 | 0 / 0.0 |
| Rust, fork() per request | P5-131 | 7980 | 52.1 | 4.3% | 4.5% | 10.29 | 132.5 | 1743 / 4.6 | 6237 / 47.5 | 0 / 0.0 |

Curves, synthetic-large, P5-131 (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):

| % of run | TS 5.0.0, new manager per request (1200 s) | Rust, new manager per request (2402 s) | Rust, fork() per request (1201 s) |
|---:|---|---|---|
| 0% | 257.8 / 0.0 / 173.4, 1088 | 546.3 / 360.8 / 10.4, 256 | 321.5 / 35.1 / 166.1, 448 |
| 10% | 283.7 / 0.0 / 116.7, 33216 | 781.9 / 569.0 / 63.2, 14592 | 329.0 / 39.6 / 62.8, 11136 |
| 20% | 287.1 / 0.0 / 73.3, 68160 | 782.0 / 569.0 / 63.1, 28800 | 329.9 / 39.6 / 63.7, 22592 |
| 30% | 287.1 / 0.0 / 118.3, 101056 | 782.8 / 569.0 / 64.4, 43008 | 329.8 / 39.6 / 63.7, 33152 |
| 40% | 287.1 / 0.0 / 165.4, 135360 | 782.4 / 569.0 / 63.8, 57088 | 332.4 / 39.6 / 92.6, 45120 |
| 50% | 287.1 / 0.0 / 90.2, 168640 | 781.7 / 569.0 / 38.7, 71488 | 329.5 / 39.6 / 63.0, 57152 |
| 60% | 287.6 / 0.0 / 115.8, 199552 | 781.4 / 569.0 / 38.4, 85440 | 329.2 / 39.6 / 63.0, 68800 |
| 70% | 287.6 / 0.0 / 99.8, 232768 | 781.9 / 569.0 / 63.0, 99840 | 329.9 / 39.6 / 63.7, 81024 |
| 80% | 287.8 / 0.0 / 139.2, 265472 | 781.7 / 569.0 / 63.1, 113920 | 328.8 / 39.6 / 38.4, 92352 |
| 90% | 287.8 / 0.0 / 66.7, 298624 | 781.0 / 569.0 / 37.8, 128320 | 329.2 / 39.6 / 38.9, 103424 |
| 100% | 287.9 / 0.0 / 89.8, 330880 | 781.7 / 569.0 / 37.4, 142016 | 329.0 / 39.6 / 38.1, 113664 |

WASM steps after warm-up, synthetic-large (every 5 s sample where the engine's linear memory grew; "peak before" is the most unfinalised managers seen at any earlier sample; "new peak" means this sample's count is above it):

| side | run | warm-up steps | t (s) | step MB | WASM MB after | unfinalised at the step | peak before | new peak | requests done |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| Rust, new manager per request | P5-120 | 6 | 546 | 18.8 | 681.4 | 257 | 281 | no | 31680 |
| Rust, new manager per request | P5-131 | 4 | none | - | 569.0 | - | 257 (max) | - | - |
| Rust, fork() per request | P5-120 | 4 | none | - | 28.1 | - | 328 (max) | - | - |
| Rust, fork() per request | P5-131 | 1 | none | - | 39.6 | - | 449 (max) | - | - |

Charts: [synthetic-large-rss](results/P5-131/soak/charts/synthetic-large-rss.svg), [synthetic-large-wasm](results/P5-131/soak/charts/synthetic-large-wasm.svg), [synthetic-large-heap](results/P5-131/soak/charts/synthetic-large-heap.svg).
