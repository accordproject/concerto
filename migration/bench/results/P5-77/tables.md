Target (every extract* op at 2x TS or better through the TS API): 9 of 12 op/set rows meet it.

| op | set | TS 5.0.0 | before | **now** | x TS before | **x TS now** | now / before | GC share before | **GC share now** |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| extract_decorators | core-test-data | 9.62 ms | 12.34 ms | **4.81 ms** | 1.28 | **0.50** | 0.39 | 14% | **8%** |
| extract_decorators | conformance | 3.23 ms | 6.29 ms | **2.50 ms** | 1.95 | **0.77** | 0.40 | 23% | **12%** |
| extract_decorators | synthetic-large | 10.29 ms | 24.96 ms | **5.83 ms** | 2.43 | **0.57** | 0.23 | 13% | **7%** |
| extract_vocabularies | core-test-data | 9.48 ms | 12.99 ms | **3.73 ms** | 1.37 | **0.39** | 0.29 | 20% | **13%** |
| extract_vocabularies | conformance | 3.11 ms | 9.91 ms | **2.20 ms** | 3.19 | **0.71** | 0.22 | 22% | **15%** |
| extract_vocabularies | synthetic-large | 10.20 ms | 37.10 ms | **4.53 ms** | 3.64 | **0.44** | 0.12 | 20% | **11%** |
| extract_cold | core-test-data | 8.40 ms | 23.34 ms | **19.21 ms** | 2.78 | **2.29** | 0.82 | 35% | **43%** |
| extract_cold | conformance | 2.92 ms | 13.19 ms | **6.78 ms** | 4.52 | **2.32** | 0.51 | 24% | **19%** |
| extract_cold | synthetic-large | 10.65 ms | 40.15 ms | **27.27 ms** | 3.77 | **2.56** | 0.68 | 47% | **51%** |
| extract_keep | core-test-data | 9.94 ms | 9.82 ms | **5.85 ms** | 0.99 | **0.59** | 0.60 | 23% | **15%** |
| extract_keep | conformance | 3.16 ms | 7.49 ms | **2.76 ms** | 2.37 | **0.87** | 0.37 | 31% | **17%** |
| extract_keep | synthetic-large | 10.16 ms | 23.57 ms | **7.27 ms** | 2.32 | **0.72** | 0.31 | 30% | **11%** |
| dcs_decorate | core-test-data | 39.99 ms | 38.94 ms | **35.31 ms** | 0.97 | **0.88** | 0.91 | 12% | **14%** |
| dcs_decorate | conformance | 19.67 ms | 19.81 ms | **23.45 ms** | 1.01 | **1.19** | 1.18 | 12% | **18%** |
| dcs_decorate | synthetic-large | 59.89 ms | 74.67 ms | **76.53 ms** | 1.25 | **1.28** | 1.02 | 13% | **12%** |
| dcs_validate | core-test-data | 32.27 ms | 17.73 ms | **18.31 ms** | 0.55 | **0.57** | 1.03 | 15% | **14%** |
| dcs_validate | conformance | 17.21 ms | 10.21 ms | **10.01 ms** | 0.59 | **0.58** | 0.98 | 19% | **15%** |
| dcs_validate | synthetic-large | 51.57 ms | 37.47 ms | **36.13 ms** | 0.73 | **0.70** | 0.96 | 16% | **13%** |

Crate level (criterion, the same engine work natively), x TS 5.0.0; `rebuild` adds the per-call manager rebuild of the old per-call bindings. `extract_cold` and `extract_keep` have no crate row (TS-API scenarios).

| op | set | crate before | crate now | x TS crate before | x TS crate now |
|---|---|---:|---:|---:|---:|
| extract_decorators | core-test-data | 7.57 ms | 7.94 ms | 0.79 (rebuild 1.32) | 0.83 (rebuild 1.28) |
| extract_decorators | conformance | 2.68 ms | 2.70 ms | 0.83 (rebuild 1.35) | 0.84 (rebuild 1.35) |
| extract_decorators | synthetic-large | 13.84 ms | 13.87 ms | 1.35 (rebuild 2.57) | 1.35 (rebuild 2.39) |
| extract_vocabularies | core-test-data | 7.79 ms | 7.82 ms | 0.82 (rebuild 1.34) | 0.83 (rebuild 1.40) |
| extract_vocabularies | conformance | 2.54 ms | 2.62 ms | 0.82 (rebuild 1.40) | 0.84 (rebuild 1.44) |
| extract_vocabularies | synthetic-large | 13.22 ms | 13.69 ms | 1.30 (rebuild 2.30) | 1.34 (rebuild 2.45) |
| dcs_decorate | core-test-data | 19.38 ms | 19.91 ms | 0.48 (rebuild 0.66) | 0.50 (rebuild 0.65) |
| dcs_decorate | conformance | 8.24 ms | 8.21 ms | 0.42 (rebuild 0.54) | 0.42 (rebuild 0.54) |
| dcs_decorate | synthetic-large | 38.01 ms | 38.33 ms | 0.63 (rebuild 0.86) | 0.64 (rebuild 0.81) |
| dcs_validate | core-test-data | 9.14 ms | 9.00 ms | 0.28 (rebuild 0.35) | 0.28 (rebuild 0.35) |
| dcs_validate | conformance | 4.06 ms | 4.08 ms | 0.24 (rebuild 0.31) | 0.24 (rebuild 0.30) |
| dcs_validate | synthetic-large | 16.03 ms | 15.70 ms | 0.31 (rebuild 0.39) | 0.30 (rebuild 0.37) |

V8 stage split of the 6-second loop profiles (p515-cpuprof.mjs), and the count run (instrumented, so slower than the timed run).

| op | set | stages before | stages now | crossings/item before / now | in-engine before / now |
|---|---|---|---|---:|---:|
| extract_decorators | core-test-data | core 65.1%, gc 14.1%, glue 10.5%, other 10.2% | core 34.7%, glue 31.4%, views 15.4%, other 8.2% | 84.0 / 84.0 | 89% / 75% |
| extract_decorators | conformance | core 59%, gc 23%, other 11.4%, glue 6.5% | views 27.4%, core 25.1%, glue 24.8%, gc 12.1% | 98.0 / 98.0 | 60% / 53% |
| extract_decorators | synthetic-large | core 68.2%, gc 13.3%, other 9.8%, glue 8.8% | core 40.8%, glue 33.6%, other 9.1%, views 7.8% | 18.0 / 18.0 | 90% / 79% |
| extract_vocabularies | core-test-data | core 66.7%, gc 20.4%, other 6.7%, glue 6.2% | core 31.2%, glue 26.9%, views 17.9%, gc 12.6% | 84.0 / 84.0 | 89% / 72% |
| extract_vocabularies | conformance | core 57.4%, gc 21.9%, other 13.6%, glue 7% | views 29.8%, glue 22.3%, core 21.7%, gc 14.7% | 98.0 / 98.0 | 83% / 47% |
| extract_vocabularies | synthetic-large | core 69.9%, gc 20.3%, glue 5.7%, other 4% | core 38.2%, glue 32.5%, gc 11%, views 8.5% | 18.0 / 18.0 | 96% / 86% |
| extract_cold | core-test-data | core 55.6%, gc 35%, other 4.9%, glue 4.5% | core 47.7%, gc 43.3%, glue 4.3%, views 3.4% | 84.0 / 84.0 | 90% / 74% |
| extract_cold | conformance | core 62.7%, gc 24.3%, other 7.9%, glue 5.1% | core 65.2%, gc 18.9%, views 7.5%, glue 6% | 98.0 / 98.0 | 74% / 79% |
| extract_cold | synthetic-large | core 47.5%, gc 46.6%, glue 3.5%, other 2.4% | gc 50.9%, core 43.3%, glue 3.6%, views 1.4% | 18.0 / 18.0 | 97% / 89% |
| extract_keep | core-test-data | core 50.1%, gc 23.2%, glue 13.8%, other 12.9% | glue 35.3%, core 28.2%, gc 14.6%, views 11.3% | 84.0 / 84.0 | 95% / 84% |
| extract_keep | conformance | core 40.6%, gc 31.1%, other 16.7%, glue 11.6% | glue 24.1%, views 22.7%, core 21.6%, gc 17.4% | 98.0 / 98.0 | 84% / 64% |
| extract_keep | synthetic-large | core 55.6%, gc 29.5%, glue 10.8%, other 4.1% | glue 38.7%, core 35.5%, gc 11.2%, other 9% | 18.0 / 18.0 | 99% / 92% |
| dcs_decorate | core-test-data | core 78.8%, gc 12.1%, glue 4.7%, other 4.3% | core 77.2%, gc 14.2%, glue 4.7%, views 2.3% | 85.0 / 85.0 | 97% / 91% |
| dcs_decorate | conformance | core 77.6%, gc 11.5%, other 6.4%, glue 4.4% | core 71.9%, gc 17.8%, views 4.3%, glue 4.2% | 99.0 / 99.0 | 92% / 88% |
| dcs_decorate | synthetic-large | core 82.3%, gc 12.5%, glue 3.3%, other 1.9% | core 80.6%, gc 11.8%, glue 5.1%, views 1.2% | 19.0 / 19.0 | 98% / 99% |
| dcs_validate | core-test-data | core 69.4%, gc 14.8%, cto-parser 8.8%, glue 3.6% | core 71.3%, gc 13.9%, cto-parser 6.9%, glue 4.1% | 51.0 / 51.0 | 78% / 80% |
| dcs_validate | conformance | core 60.9%, gc 18.5%, cto-parser 11.3%, other 5.9% | core 66.8%, gc 15.3%, cto-parser 5.7%, glue 5.1% | 58.0 / 58.0 | 72% / 79% |
| dcs_validate | synthetic-large | core 70.8%, gc 15.8%, cto-parser 5.4%, glue 4.5% | core 74.6%, gc 13.4%, glue 5.6%, ts-core 3% | 18.0 / 18.0 | 85% / 87% |
