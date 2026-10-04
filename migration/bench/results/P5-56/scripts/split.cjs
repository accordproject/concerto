// P5-56 (T2, F-A2): where a repeated DecoratorManager.extractDecorators
// (removeDecoratorsFromModel: false) spends its time through the TS API:
// the source-handle engine call (ModelManagerHandle.dcsExtractDecorators,
// where the memo acts) and the P5-49 strict AST shape check the result
// adoption runs on every result model file (ModelManagerHandle.
// checkAstShape), against the whole call. Each timed call follows a gc()
// and two event-loop turns, so the finalizers of the previous results'
// handles run between calls, as in an application.
//
// Usage: node --expose-gc split.cjs <set> <samples> <warmup>
//   CONCERTO_ENGINE_MODULE=<concerto-engine.cjs> (required)
//   P556_NOMEMO=1: drop the handle's memo before every call (the "before" path)
// Prints one JSON line of medians (ms).
'use strict';
const path = require('path');
const { performance } = require('perf_hooks');
const eng = require(process.env.CONCERTO_ENGINE_MODULE);
const CORE = path.resolve(__dirname, '../../../../../packages/concerto-core/dist');
const FIX = path.resolve(__dirname, '../../../fixtures/p515');
const [set, samples = '30', warmup = '5'] = process.argv.slice(2);
const proto = eng.ModelManagerHandle.prototype;
let engineMs = 0;
let checkMs = 0;
const extract = proto.dcsExtractDecorators;
proto.dcsExtractDecorators = function (...args) {
    if (process.env.P556_NOMEMO === '1') {
        this.dropDcsMemo();
    }
    const s = performance.now();
    try {
        return extract.apply(this, args);
    } finally {
        engineMs += performance.now() - s;
    }
};
const check = proto.checkAstShape;
proto.checkAstShape = function (...args) {
    const s = performance.now();
    try {
        return check.apply(this, args);
    } finally {
        checkMs += performance.now() - s;
    }
};
const { ModelManager, ModelFile, DecoratorManager } = require(CORE);
const data = require(path.join(FIX, `${set}.json`));
for (const { ast } of data.models) {
    for (const decl of ast.declarations || []) {
        if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
            delete decl.isAbstract; // as p515-sweep.mjs loadSet (P5-56)
        }
    }
}
const mm0 = new ModelManager();
for (const { name, ast } of data.models.filter((m) => data.dcsModels.includes(m.name))) {
    mm0.addModelFile(new ModelFile(mm0, ast, undefined, name));
}
const mm = DecoratorManager.decorateModels(mm0, data.dcs, { validate: true });
const opts = { removeDecoratorsFromModel: false, locale: 'en' };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const turn = () => new Promise((r) => setImmediate(r));
(async () => {
    for (let i = 0; i < +warmup; i++) {
        DecoratorManager.extractDecorators(mm, opts);
    }
    const total = [];
    const engine = [];
    const shape = [];
    for (let i = 0; i < +samples; i++) {
        global.gc();
        await turn();
        await turn();
        engineMs = 0;
        checkMs = 0;
        const s = performance.now();
        DecoratorManager.extractDecorators(mm, opts);
        total.push(performance.now() - s);
        engine.push(engineMs);
        shape.push(checkMs);
    }
    const r = (x) => +median(x).toFixed(2);
    console.log(JSON.stringify({ set, nomemo: process.env.P556_NOMEMO === '1', samples: +samples, total_ms: r(total), engine_call_ms: r(engine), check_ast_shape_ms: r(shape), rest_ms: r(total.map((t, i) => t - engine[i] - shape[i])) }));
})();
