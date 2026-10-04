// P5-49 (accordproject/concerto-rust#370, BC-19): TS->WASM crossings per model-load operation,
// with the strict AST shape check on (the R1 default) and off (`metamodelValidation: false`, which
// runs exactly the code path of the integration head before P5-49: the check is the only change).
// Usage (from the concerto root, after building packages/concerto-core):
//   node migration/bench/results/P5-49/count-load.cjs "$PWD"
const path = require('path');
const root = process.argv[2];
const bench = path.join(root, 'migration/bench');
process.env.P515_REAL_ENGINE = require.resolve('@accordproject/concerto-engine', { paths: [path.join(root, 'packages/concerto-core')] });
process.env.CONCERTO_ENGINE_MODULE = path.join(bench, 'lib/p515-engine-counter.cjs');
const core = require(path.join(root, 'packages/concerto-core'));
const stats = () => globalThis.__p515Crossings;
const A = 'namespace org.acme.a@1.0.0\nconcept Shape {}\nconcept Sq extends Shape {}\n';
const B = 'namespace org.acme.b@1.0.0\nimport org.acme.a@1.0.0.{Shape}\nconcept Local { o Shape s }\n';
const astA = new core.ModelManager().addCTOModel(A, 'a.cto').getAst();
const models = (() => { const mm = new core.ModelManager(); mm.addModelFiles([A, B], ['a.cto', 'b.cto']); return mm.getAst(); })();
function count(setup, op, n = 50) {
  const ctxs = [];
  for (let i = 0; i < n; i++) ctxs.push(setup());
  for (const k of Object.keys(stats() || {})) delete stats()[k];
  for (const c of ctxs) op(c);
  const s = stats() || {};
  return {
    total: Object.values(s).reduce((a, v) => a + v.calls, 0) / n,
    shape: Object.entries(s).filter(([k]) => k.includes('checkAstShape')).reduce((a, [, v]) => a + v.calls, 0) / n,
  };
}
const ops = [
  ['new ModelManager()', (o) => [() => o, (opts) => new core.ModelManager(opts)]],
  ['addCTOModel (one file)', (o) => [() => new core.ModelManager(o), (mm) => mm.addCTOModel(A, 'a.cto')]],
  ['new ModelFile + addModelFile (one file)', (o) => [() => new core.ModelManager(o), (mm) => mm.addModelFile(new core.ModelFile(mm, astA, A, 'a.cto'))]],
  ['addModelFiles (two files)', (o) => [() => new core.ModelManager(o), (mm) => mm.addModelFiles([A, B], ['a.cto', 'b.cto'])]],
  ['updateModelFile (string)', (o) => [() => { const mm = new core.ModelManager(o); mm.addCTOModel(A, 'a.cto'); return mm; }, (mm) => mm.updateModelFile(A + 'concept X {}\n', 'a.cto')]],
  ['fromAst (two models)', (o) => [() => new core.ModelManager(o), (mm) => mm.fromAst(models)]],
];
console.log(`${'operation'.padEnd(42)} ${'off'.padStart(6)} ${'on'.padStart(6)}  checkAstShape`);
for (const [name, make] of ops) {
  const off = count(...make({ metamodelValidation: false }));
  const on = count(...make(undefined));
  console.log(`${name.padEnd(42)} ${off.total.toFixed(2).padStart(6)} ${on.total.toFixed(2).padStart(6)}  ${on.shape.toFixed(2)}`);
}
