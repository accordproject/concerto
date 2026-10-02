| op | set | TS 5.0.0 | crate off | crate on | crate on/off | TS-API off | TS-API on | TS-API on/off |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| from_json | concerto-core-test-data | 63.2 us | 19.9 us | 15.6 us | -21.7% | 68.0 us | 60.4 us | -11.2% |
| from_json | conformance | 14.8 us | 3.56 us | 3.43 us | -3.7% | 17.0 us | 16.3 us | -4.5% |
| from_json | synthetic-large | 31.0 us | 10.5 us | 8.14 us | -22.4% | 28.9 us | 27.6 us | -4.6% |
| to_json | concerto-core-test-data | 52.8 us | 21.7 us | 19.4 us | -10.7% | 84.4 us | 81.2 us | -3.8% |
| to_json | conformance | 14.0 us | 3.71 us | 3.40 us | -8.4% | 25.5 us | 23.9 us | -6.1% |
| to_json | synthetic-large | 10.2 us | 10.5 us | 9.45 us | -10.3% | 46.5 us | 37.8 us | -18.7% |
| validate | concerto-core-test-data | 21.4 us | 7.12 us | 5.89 us | -17.3% | 30.7 us | 19.9 us | -35.0% |
| validate | conformance | 4.49 us | 1.61 us | 1.21 us | -24.6% | 8.04 us | 8.16 us | 1.5% |
| validate | synthetic-large | 6.68 us | 3.35 us | 3.02 us | -9.6% | 10.1 us | 7.14 us | -29.1% |
| new_resource | concerto-core-test-data | 10.6 us | - | - | - | 25.0 us | 14.0 us | -43.8% |
| new_resource | conformance | 4.83 us | 1.21 us | 1.13 us | -7.1% | 9.87 us | 7.16 us | -27.5% |
| new_resource | synthetic-large | 3.56 us | 1.42 us | 1.32 us | -7.7% | 5.59 us | 5.56 us | -0.6% |
| set_property_value | concerto-core-test-data | 2.59 us | 1.24 us | 1.05 us | -14.9% | 5.90 us | 4.58 us | -22.3% |
| set_property_value | conformance | 0.91 us | 0.51 us | 0.39 us | -23.4% | 3.84 us | 4.46 us | 16.2% |
| set_property_value | synthetic-large | 0.79 us | 0.70 us | 0.61 us | -12.0% | 2.48 us | 2.25 us | -9.0% |
| add_array_value | concerto-core-test-data | 22.0 us | 10.6 us | 9.62 us | -9.4% | 60.6 us | 57.6 us | -4.9% |
| add_array_value | conformance | 1.55 us | 0.88 us | 0.93 us | 6.0% | 5.74 us | 5.56 us | -3.0% |
| add_array_value | synthetic-large | 1.32 us | 1.02 us | 1.07 us | 4.5% | 3.40 us | 3.01 us | -11.5% |
| mm_new | conformance | 386.6 us | 1.64 us | 1.58 us | -4.1% | 316.8 us | 307.3 us | -3.0% |
| modelfile_new | concerto-core-test-data | 30.7 us | 30.1 us | 29.1 us | -3.5% | 142.5 us | 138.5 us | -2.8% |
| modelfile_new | conformance | 11.4 us | 10.1 us | 9.43 us | -6.7% | 71.6 us | 57.4 us | -19.9% |
| modelfile_new | synthetic-large | 813.8 us | 1.45 ms | 1.50 ms | 3.0% | 3.50 ms | 3.23 ms | -7.7% |
| dcs_decorate | concerto-core-test-data | 40.61 ms | 22.25 ms | 20.89 ms | -6.1% | 39.35 ms | 38.09 ms | -3.2% |
| dcs_decorate | conformance | 21.60 ms | 8.18 ms | 8.18 ms | -0.0% | 26.40 ms | 24.83 ms | -5.9% |
| dcs_decorate | synthetic-large | 60.31 ms | 40.17 ms | 37.36 ms | -7.0% | 84.96 ms | 83.31 ms | -1.9% |

| op | set | first pass off | first pass on | on/off | second pass off | second pass on | on/off |
|---|---|---:|---:|---:|---:|---:|---:|
| from_json | concerto-core-test-data | 4.08 ms | 3.91 ms | -4.2% | 2.16 ms | 1.99 ms | -8.0% |
| from_json | conformance | 766.9 us | 773.5 us | 0.9% | 221.9 us | 162.3 us | -26.9% |
| from_json | synthetic-large | 5.39 ms | 6.40 ms | 18.9% | 2.76 ms | 2.93 ms | 5.9% |
| to_json | concerto-core-test-data | 3.26 ms | 3.22 ms | -1.1% | 2.62 ms | 2.43 ms | -7.2% |
| to_json | conformance | 365.7 us | 406.9 us | 11.3% | 161.7 us | 156.9 us | -3.0% |
| to_json | synthetic-large | 3.11 ms | 3.44 ms | 10.5% | 2.89 ms | 3.34 ms | 15.9% |
| validate | concerto-core-test-data | 1.89 ms | 1.62 ms | -14.6% | 1.06 ms | 780.9 us | -26.3% |
| validate | conformance | 190.6 us | 325.7 us | 70.9% | 65.8 us | 62.4 us | -5.2% |
| validate | synthetic-large | 1.42 ms | 1.93 ms | 36.0% | 1.22 ms | 1.08 ms | -11.8% |
| new_resource | conformance | 561.9 us | 558.1 us | -0.7% | 54.2 us | 50.1 us | -7.6% |
| new_resource | synthetic-large | 2.78 ms | 3.27 ms | 17.4% | 435.4 us | 388.1 us | -10.9% |
| set_property_value | concerto-core-test-data | 1.58 ms | 1.61 ms | 2.0% | 838.0 us | 741.0 us | -11.6% |
| set_property_value | conformance | 218.9 us | 226.6 us | 3.5% | 42.9 us | 30.8 us | -28.2% |
| set_property_value | synthetic-large | 1.49 ms | 1.78 ms | 19.5% | 1.31 ms | 1.12 ms | -14.6% |
| add_array_value | concerto-core-test-data | 1.15 ms | 1.21 ms | 5.1% | 618.0 us | 509.9 us | -17.5% |
| add_array_value | conformance | 24.3 us | 24.2 us | -0.4% | 4.10 us | 2.50 us | -39.0% |
| add_array_value | synthetic-large | 797.7 us | 1.30 ms | 62.5% | 518.8 us | 395.9 us | -23.7% |
