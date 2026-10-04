// P5-55 (T1, F-A1): the engine at P555_REAL_ENGINE with the source-handle
// DCS operations (ModelManagerHandle.dcsDecorateModels/dcsExtract*) hidden,
// so the views take the resident DcsManagerHandle path, as on the
// integration head before this task.
'use strict';
const real = require(process.env.P555_REAL_ENGINE);
const proto = real.ModelManagerHandle.prototype;
for (const m of ['dcsDecorateModels', 'dcsExtractDecorators', 'dcsExtractVocabularies', 'dcsExtractNonVocabDecorators']) {
    proto[m] = undefined;
}
module.exports = real;
