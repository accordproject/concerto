// P5-56 (T2, F-A2): the engine at P556_REAL_ENGINE with the extract result
// memo off: every source-handle extract drops the handle's memo first
// (ModelManagerHandle.dropDcsMemo), so it never fills and each call runs in
// full, as on the integration head before this task.
'use strict';
const real = require(process.env.P556_REAL_ENGINE);
const proto = real.ModelManagerHandle.prototype;
for (const m of ['dcsExtractDecorators', 'dcsExtractVocabularies', 'dcsExtractNonVocabDecorators']) {
    const orig = proto[m];
    proto[m] = function (...args) {
        this.dropDcsMemo();
        return orig.apply(this, args);
    };
}
module.exports = real;
