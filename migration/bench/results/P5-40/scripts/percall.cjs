// P5-41 scratch (reused by P5-40): the engine at P541_REAL_ENGINE with DcsManagerHandle hidden,
// so the views take the per-call decoratorManager* bindings; optionally dumps
// the first extract input (P530_DUMP), as the P5-30 dump shim does.
'use strict';
const fs = require('fs');
const real = require(process.env.P541_REAL_ENGINE);
const out = Object.create(real);
out.DcsManagerHandle = undefined;
let dumped = false;
out.decoratorManagerExtractDecorators = function (models, options) {
    if (!dumped && process.env.P530_DUMP) {
        fs.writeFileSync(process.env.P530_DUMP, JSON.stringify(models));
        dumped = true;
    }
    return real.decoratorManagerExtractDecorators(models, options);
};
module.exports = out;
