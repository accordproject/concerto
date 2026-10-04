| op | set | TS 5.0.0 | before | now | now (mmv off) | x TS before | x TS now | x TS now (off) | now / before |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| add_model_file | concerto-core-test-data | 56.2 us | 312.4 us | **306.5 us** | 302.0 us | 5.56 | **5.46** | 5.38 | 0.98 |
| add_model_file | conformance | 20.8 us | 158.7 us | **162.0 us** | 170.5 us | 7.63 | **7.79** | 8.20 | 1.02 |
| add_model_file | synthetic-large | 2.19 ms | 8.95 ms | **9.14 ms** | 8.97 ms | 4.09 | **4.17** | 4.10 | 1.02 |
| mm_new | (system models) | 110.4 us | 314.1 us | **193.3 us** | 199.8 us | 2.85 | **1.75** | 1.81 | 0.62 |
| modelfile_new | concerto-core-test-data | 17.3 us | 104.0 us | **105.1 us** | 95.3 us | 6.02 | **6.08** | 5.52 | 1.01 |
| modelfile_new | conformance | 5.1 us | 57.2 us | **54.9 us** | 60.9 us | 11.23 | **10.79** | 11.96 | 0.96 |
| modelfile_new | synthetic-large | 564.3 us | 7.82 ms | **7.75 ms** | 7.52 ms | 13.86 | **13.74** | 13.33 | 0.99 |

Count run (instrumented, so slower than the timed run): crossings and in-engine time per item.

| op | set | before: crossings / in-engine | now: crossings / in-engine | now top bindings |
|---|---|---:|---:|---|
| add_model_file | concerto-core-test-data | 3.29 / 132.3 us | 3.23 / 136.5 us | ModelManagerHandle.stageModelFileChecked x1, ModelManagerHandle.validateAndCommitStagedModelFile x1, modelFileIsCompatibleVersion x1.0857142857142856, new ModelManagerHandle x0.02857142857142857 |
| add_model_file | conformance | 3.24 / 64.9 us | 3.20 / 80.6 us | ModelManagerHandle.stageModelFileChecked x1, ModelManagerHandle.validateAndCommitStagedModelFile x1, modelFileIsCompatibleVersion x1.0731707317073171, new ModelManagerHandle x0.024390243902439025 |
| add_model_file | synthetic-large | 13.00 / 4.86 ms | 11.00 / 4.77 ms | ModelManagerHandle.stageModelFileChecked x1, ModelManagerHandle.validateAndCommitStagedModelFile x1, modelFileIsCompatibleVersion x4, new ModelManagerHandle x1 |
| mm_new | (system models) | 10.00 / 188.4 us | 8.00 / 65.0 us | modelFileIsCompatibleVersion x3, new ModelManagerHandle x1, ModelManagerHandle.systemModelFileHeader x2, ModelManagerHandle.setDecoratorValidation x1 |
| modelfile_new | concerto-core-test-data | 2.00 / 131.1 us | 2.00 / 206.4 us | ModelManagerHandle.stageModelFileChecked x1, modelFileIsCompatibleVersion x1 |
| modelfile_new | conformance | 2.00 / 72.0 us | 2.00 / 52.3 us | ModelManagerHandle.stageModelFileChecked x1, modelFileIsCompatibleVersion x1 |
| modelfile_new | synthetic-large | 2.00 / 3.24 ms | 2.00 / 3.06 ms | ModelManagerHandle.stageModelFileChecked x1, modelFileIsCompatibleVersion x1 |
