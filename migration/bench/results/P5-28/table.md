| op | set | TS 5.0.0 | before | now | x TS before -> now | change | crossings/item before -> now | in-engine us/item before -> now |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| mm_new | conformance | 383 us | 536 us | 444 us | 1.40 -> 1.16 | -17% | 13.0 -> 10.0 | 473.0 -> 224.0 |
| modelfile_new | concerto-core-test-data | 28.4 us | 178 us | 189 us | 6.27 -> 6.64 | +6% | 3.0 -> 2.0 | 367.5 -> 160.7 |
| modelfile_new | conformance | 8.11 us | 76.1 us | 80.7 us | 9.38 -> 9.95 | +6% | 3.0 -> 2.0 | 75.0 -> 56.4 |
| modelfile_new | synthetic-large | 787 us | 4.15 ms | 4.14 ms | 5.26 -> 5.25 | -0% | 3.0 -> 2.0 | 3958.6 -> 4709.3 |
| add_model_file | concerto-core-test-data | 79.3 us | 227 us | 241 us | 2.87 -> 3.04 | +6% | 5.4 -> 4.3 | 211.3 -> 236.2 |
| add_model_file | conformance | 36.5 us | 290 us | 283 us | 7.94 -> 7.75 | -2% | 5.3 -> 4.2 | 131.5 -> 96.8 |
| add_model_file | synthetic-large | 3.17 ms | 11.40 ms | 11.72 ms | 3.60 -> 3.70 | +3% | 18.0 -> 14.0 | 9219.9 -> 6103.5 |
| add_cto_model | concerto-core-test-data | 438 us | 1.74 ms | 1.51 ms | 3.97 -> 3.44 | -13% | 5.4 -> 4.3 | 275.3 -> 231.7 |
| add_cto_model | conformance | 135 us | 783 us | 757 us | 5.81 -> 5.62 | -3% | 5.3 -> 4.2 | 134.1 -> 108.7 |
| add_cto_model | synthetic-large | 20.33 ms | 42.85 ms | 36.50 ms | 2.11 -> 1.80 | -15% | 18.0 -> 14.0 | 7617.7 -> 7990.6 |
