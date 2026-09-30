// P5-61 (accordproject/concerto-rust#393, BR-09): TS->WASM crossings per model-load operation, with
// the strict AST shape check on (the R1 default) and off (`metamodelValidation: false`), and with the
// check off on a manager that has a decorator factory (the eager walk, where P5-61 adds a read of the
// AST so that an AST the engine cannot read is an error at construction).
// Usage (from the concerto root, after building packages/concerto-core):
//   node migration/bench/results/P5-61/count-load.cjs "$PWD"
// P515_REAL_ENGINE may name the engine to count (default: the linked @accordproject/concerto-engine).
const path = require('path');
const root = process.argv[2];
const bench = path.join(root, 'migration/bench');
process.env.P515_REAL_ENGINE = process.env.P515_REAL_ENGINE
    || require.resolve('@accordproject/concerto-engine', { paths: [path.join(root, 'packages/concerto-core')] });
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
  return Object.values(s).reduce((a, v) => a + v.calls, 0) / n;
}
const factory = { newDecorator: () => null };
const withFactory = (o) => { const mm = new core.ModelManager(o); mm.addDecoratorFactory(factory); return mm; };
const ops = [
  ['new ModelManager()', (o) => [() => o, (opts) => new core.ModelManager(opts)]],
  ['addCTOModel (one file)', (o) => [() => new core.ModelManager(o), (mm) => mm.addCTOModel(A, 'a.cto')]],
  ['new ModelFile + addModelFile (one file)', (o) => [() => new core.ModelManager(o), (mm) => mm.addModelFile(new core.ModelFile(mm, astA, A, 'a.cto'))]],
  ['addModelFiles (two files)', (o) => [() => new core.ModelManager(o), (mm) => mm.addModelFiles([A, B], ['a.cto', 'b.cto'])]],
  ['updateModelFile (string)', (o) => [() => { const mm = new core.ModelManager(o); mm.addCTOModel(A, 'a.cto'); return mm; }, (mm) => mm.updateModelFile(A + 'concept X {}\n', 'a.cto')]],
  ['fromAst (two models)', (o) => [() => new core.ModelManager(o), (mm) => mm.fromAst(models)]],
  ['new ModelFile + addModelFile, decorator factory', (o) => [() => withFactory(o), (mm) => mm.addModelFile(new core.ModelFile(mm, astA, A, 'a.cto'))]],
];
console.log(`${'operation'.padEnd(48)} ${'off'.padStart(6)} ${'on'.padStart(6)}`);
for (const [name, make] of ops) {
  const off = count(...make({ metamodelValidation: false }));
  const on = count(...make(undefined));
  console.log(`${name.padEnd(48)} ${off.toFixed(2).padStart(6)} ${on.toFixed(2).padStart(6)}`);
}
