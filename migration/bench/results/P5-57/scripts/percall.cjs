// P5-57 scratch (P5-41/P5-40's percall.cjs): the engine at P541_REAL_ENGINE
// with DcsManagerHandle hidden, so the views take the per-call
// decoratorManager* bindings.
'use strict';
const real = require(process.env.P541_REAL_ENGINE);
const out = Object.create(real);
out.DcsManagerHandle = undefined;
module.exports = out;
