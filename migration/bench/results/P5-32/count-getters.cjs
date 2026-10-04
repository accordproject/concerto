// P5-32 (accordproject/concerto-rust#342): TS->WASM crossings per call of the
// ModelFile header getters, on a registered file and on a detached one.
// Usage (from the concerto root): node migration/bench/results/P5-32/count-getters.cjs <concerto-core dist dir>
// The real engine is CONCERTO_ENGINE_MODULE when set, else the one the dist resolves.
// '1st call' = the first call on that ModelFile object; 'repeat' = every later call.
'use strict';
const path = require('path');
const dist = path.resolve(process.argv[2]);
const bench = path.resolve(__dirname, '..', '..');
process.env.P515_REAL_ENGINE = process.env.CONCERTO_ENGINE_MODULE || require.resolve('@accordproject/concerto-engine', { paths: [dist] });
process.env.CONCERTO_ENGINE_MODULE = path.join(bench, 'lib/p515-engine-counter.cjs');
const core = require(dist);
const stats = () => globalThis.__p515Crossings || {};
const A = 'namespace org.acme.a@1.0.0\nconcept Shape {}\nconcept Sq extends Shape {}\n';
const B = 'namespace org.acme.b@1.0.0\nimport org.acme.a@1.0.0.{Shape} from https://example.com/a.cto\nconcept Local { o Shape s }\n';
function measure(name, setup, op, n = 50) {
    const ctxs = [];
    for (let i = 0; i < n; i++) ctxs.push(setup());
    for (const k of Object.keys(stats())) delete stats()[k];
    for (const c of ctxs) op(c);
    const s = stats();
    const total = Object.values(s).reduce((a, v) => a + v.calls, 0) / n;
    const top = Object.entries(s).sort((a, b) => b[1].calls - a[1].calls).map(([k, v]) => `${k} x${(v.calls / n).toFixed(2)}`).join(', ');
    console.log(`${name.padEnd(48)} ${total.toFixed(2).padStart(6)}  ${top}`);
}
const registered = () => {
    const mm = new core.ModelManager({ strict: true });
    mm.addCTOModel(A, 'a.cto');
    mm.addCTOModel(B, 'b.cto', true);
    return mm.getModelFile('org.acme.b@1.0.0');
};
const detached = () => {
    const mm = new core.ModelManager({ strict: true });
    mm.addCTOModel(A, 'a.cto');
    const ast = mm.getModelFile('org.acme.a@1.0.0').getAst();
    return new core.ModelFile(mm, ast, A, 'copy.cto');
};
const getters = ['getVersion', 'isSystemModelFile', 'getImports', 'getExternalImports'];
for (const g of getters) {
    measure(`MF.${g} (registered, 1st call)`, registered, (mf) => mf[g]());
    measure(`MF.${g} (registered, repeat)`, () => { const mf = registered(); mf[g](); return mf; }, (mf) => mf[g]());
}
for (const g of getters) {
    measure(`MF.${g} (detached, 1st call)`, detached, (mf) => mf[g]());
    measure(`MF.${g} (detached, repeat)`, () => { const mf = detached(); mf[g](); return mf; }, (mf) => mf[g]());
}
