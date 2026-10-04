| op | set | rounds | TS 5.0.0 | before | now | before x TS | **now x TS** | now / before |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| get_namespaces_first | concerto-core-test-data | 3 | 1.00 us | 23.27 us | 0.47 us | 23.34 | **0.47** | 0.02 |
| get_namespaces_first | conformance | 3 | 0.81 us | 24.16 us | 0.25 us | 29.86 | **0.31** | 0.01 |
| get_namespaces_first | synthetic-large | 3 | 0.14 us | 1.80 us | 0.24 us | 12.92 | **1.72** | 0.13 |
| get_namespaces_after_change | concerto-core-test-data | 3 | 3.00 us | 34.19 us | 2.50 us | 11.38 | **0.83** | 0.07 |
| get_namespaces_after_change | conformance | 3 | 1.42 us | 26.16 us | 0.62 us | 18.46 | **0.44** | 0.02 |
| get_namespaces_after_change | synthetic-large | 3 | 1.91 us | 8.70 us | 1.48 us | 4.55 | **0.77** | 0.17 |
| get_namespaces | concerto-core-test-data | 3 | 0.75 us | 0.27 us | 0.25 us | 0.36 | **0.33** | 0.92 |
| get_namespaces | conformance | 3 | 0.91 us | 0.27 us | 0.23 us | 0.29 | **0.25** | 0.85 |
| get_namespaces | synthetic-large | 3 | 0.15 us | 0.25 us | 0.22 us | 1.67 | **1.45** | 0.87 |
| add_model_file | concerto-core-test-data | 3 | 55.68 us | 141.63 us | 143.95 us | 2.54 | **2.59** | 1.02 |
| add_model_file | conformance | 3 | 17.42 us | 72.10 us | 73.93 us | 4.14 | **4.25** | 1.03 |
| add_model_file | synthetic-large | 3 | 1.73 ms | 7.06 ms | 7.38 ms | 4.09 | **4.27** | 1.04 |
| mm_new | (system models) | 3 | 77.17 us | 141.83 us | 143.65 us | 1.84 | **1.86** | 1.01 |
