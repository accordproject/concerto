TS API (the TS views on the engine), median of the three rounds' medians:

| op | set | TS 5.0.0 | derived | table | x TS derived | x TS table | table / derived | per-round range |
|---|---|---:|---:|---:|---:|---:|---:|---|
| modelfile_new | core-test-data | 30.7 us | 128.4 us | 134.1 us | 4.19 | 4.37 | **1.04** | 0.98-1.20 |
| modelfile_new | conformance | 10.9 us | 58.2 us | 64.4 us | 5.34 | 5.90 | **1.11** | 1.00-1.13 |
| modelfile_new | synthetic-large | 774.4 us | 3.28 ms | 3.97 ms | 4.23 | 5.12 | **1.21** | 1.19-1.21 |
| add_model_file | core-test-data | 96.7 us | 190.1 us | 191.7 us | 1.97 | 1.98 | **1.01** | 1.01-1.06 |
| add_model_file | conformance | 35.7 us | 78.3 us | 85.5 us | 2.19 | 2.40 | **1.09** | 0.91-1.13 |
| add_model_file | synthetic-large | 2.60 ms | 5.42 ms | 5.94 ms | 2.09 | 2.28 | **1.10** | 1.04-1.78 |
| add_cto_model | core-test-data | 525.9 us | 619.1 us | 642.2 us | 1.18 | 1.22 | **1.04** | 1.00-1.19 |
| add_cto_model | conformance | 178.7 us | 266.0 us | 308.4 us | 1.49 | 1.73 | **1.16** | 0.81-1.45 |
| add_cto_model | synthetic-large | 24.49 ms | 28.14 ms | 33.07 ms | 1.15 | 1.35 | **1.18** | 1.06-1.36 |
| mm_new | conformance | 419.9 us | 407.8 us | 318.7 us | 0.97 | 0.76 | **0.78** | 0.45-1.21 |
| dcs_decorate | core-test-data | 44.66 ms | 38.87 ms | 40.62 ms | 0.87 | 0.91 | **1.05** | 0.99-1.10 |
| dcs_decorate | conformance | 21.38 ms | 23.34 ms | 23.83 ms | 1.09 | 1.11 | **1.02** | 0.95-1.09 |
| dcs_decorate | synthetic-large | 61.87 ms | 78.97 ms | 78.84 ms | 1.28 | 1.27 | **1.00** | 0.90-1.11 |

Crate level (criterion, native), same rounds:

| op | set | derived | table | x TS derived | x TS table | table / derived | per-round range |
|---|---|---:|---:|---:|---:|---:|---|
| modelfile_new | core-test-data | 29.9 us | 36.2 us | 0.98 | 1.18 | **1.21** | 1.18-1.50 |
| modelfile_new | conformance | 9.94 us | 10.1 us | 0.91 | 0.92 | **1.01** | 0.99-1.14 |
| modelfile_new | synthetic-large | 1.56 ms | 1.78 ms | 2.02 | 2.30 | **1.14** | 0.93-1.22 |
| add_model_file | core-test-data | 51.5 us | 58.1 us | 0.53 | 0.60 | **1.13** | 1.12-1.23 |
| add_model_file | conformance | 15.2 us | 16.4 us | 0.43 | 0.46 | **1.08** | 0.93-1.18 |
| add_model_file | synthetic-large | 2.44 ms | 2.83 ms | 0.94 | 1.09 | **1.16** | 1.11-1.19 |
| mm_new | conformance | 1.39 us | 1.43 us | 0.00 | 0.00 | **1.03** | 1.00-1.03 |
| dcs_decorate | core-test-data | 23.72 ms | 22.74 ms | 0.53 | 0.51 | **0.96** | 0.92-1.06 |
| dcs_decorate | conformance | 8.00 ms | 7.67 ms | 0.37 | 0.36 | **0.96** | 0.92-1.15 |
| dcs_decorate | synthetic-large | 39.41 ms | 40.12 ms | 0.64 | 0.65 | **1.02** | 1.00-1.04 |
