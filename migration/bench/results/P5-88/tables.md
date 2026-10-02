| op | set | TS 5.0.0 | crate before | crate now | crate now/before | spike crate on/off | TS-API before | TS-API now | TS-API now/before | spike TS-API on/off |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| from_json | core-test-data | 61.7 us | 17.0 us | 15.2 us | -10.7% | -21.7% | 63.4 us | 55.3 us | -12.8% | -11.2% |
| from_json | conformance | 14.7 us | 3.74 us | 3.52 us | -6.0% | -3.7% | 20.1 us | 17.5 us | -12.9% | -4.5% |
| from_json | synthetic-large | 20.0 us | 9.24 us | 9.29 us | +0.5% | -22.4% | 28.6 us | 26.6 us | -6.8% | -4.6% |
| to_json | core-test-data | 38.3 us | 22.1 us | 20.7 us | -6.5% | -10.7% | 94.0 us | 80.1 us | -14.7% | -3.8% |
| to_json | conformance | 9.40 us | 3.57 us | 3.40 us | -5.0% | -8.4% | 27.1 us | 28.2 us | +4.1% | -6.1% |
| to_json | synthetic-large | 9.27 us | 10.4 us | 9.42 us | -9.6% | -10.3% | 42.0 us | 40.6 us | -3.4% | -18.7% |
| validate | core-test-data | 17.9 us | 7.61 us | 5.82 us | -23.5% | -17.3% | 22.1 us | 32.6 us | +47.9% | -35.0% |
| validate | conformance | 4.50 us | 1.46 us | 1.26 us | -13.5% | -24.6% | 8.02 us | 12.3 us | +53.9% | +1.5% |
| validate | synthetic-large | 6.38 us | 3.51 us | 2.96 us | -15.8% | -9.6% | 7.82 us | 7.41 us | -5.2% | -29.1% |
| new_resource | core-test-data | 10.1 us | - | - | - | - | 21.5 us | 14.8 us | -30.9% | -43.8% |
| new_resource | conformance | 5.17 us | 1.19 us | 1.08 us | -9.0% | -7.1% | 7.76 us | 7.46 us | -3.9% | -27.5% |
| new_resource | synthetic-large | 3.58 us | 1.36 us | 1.26 us | -7.1% | -7.7% | 6.48 us | 6.63 us | +2.3% | -0.6% |
| set_property_value | core-test-data | 2.47 us | 1.39 us | 1.03 us | -25.9% | -14.9% | 4.53 us | 4.77 us | +5.2% | -22.3% |
| set_property_value | conformance | 0.88 us | 0.48 us | 0.44 us | -9.1% | -23.4% | 3.83 us | 4.07 us | +6.3% | +16.2% |
| set_property_value | synthetic-large | 0.83 us | 0.69 us | 0.66 us | -5.1% | -12.0% | 2.57 us | 2.36 us | -8.1% | -9.0% |
| add_array_value | core-test-data | 24.7 us | 10.6 us | 9.43 us | -11.3% | -9.4% | 61.2 us | 65.5 us | +7.0% | -4.9% |
| add_array_value | conformance | 1.63 us | 0.95 us | 0.89 us | -6.1% | +6.0% | 5.73 us | 5.69 us | -0.7% | -3.0% |
| add_array_value | synthetic-large | 0.94 us | 1.00 us | 0.98 us | -2.4% | +4.5% | 3.13 us | 3.35 us | +6.9% | -11.5% |

x TS 5.0.0 through the TS API (lower is better; 1.00 is parity).

| op | set | before | now |
|---|---|---:|---:|
| from_json | core-test-data | 1.03 | 0.90 |
| from_json | conformance | 1.37 | 1.19 |
| from_json | synthetic-large | 1.43 | 1.33 |
| to_json | core-test-data | 2.45 | 2.09 |
| to_json | conformance | 2.88 | 3.00 |
| to_json | synthetic-large | 4.53 | 4.38 |
| validate | core-test-data | 1.23 | 1.82 |
| validate | conformance | 1.78 | 2.74 |
| validate | synthetic-large | 1.23 | 1.16 |
| new_resource | core-test-data | 2.14 | 1.48 |
| new_resource | conformance | 1.50 | 1.44 |
| new_resource | synthetic-large | 1.81 | 1.85 |
| set_property_value | core-test-data | 1.83 | 1.93 |
| set_property_value | conformance | 4.36 | 4.63 |
| set_property_value | synthetic-large | 3.08 | 2.83 |
| add_array_value | core-test-data | 2.48 | 2.65 |
| add_array_value | conformance | 3.53 | 3.50 |
| add_array_value | synthetic-large | 3.32 | 3.55 |
