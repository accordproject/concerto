// P5-34 (accordproject/concerto-rust#344): TS->WASM crossings per operation for ops p515-sweep.mjs does not cover.
// Usage (from the concerto root, after building packages/concerto-core): node migration/bench/results/P5-34/count-extra.cjs "$PWD"
// '1st read' = the first read after a model change (every manager's model change drops the P5-29 read memo).
const path = require('path');
const root = process.argv[2];
const bench = path.join(root, 'migration/bench');
process.env.P515_REAL_ENGINE = require.resolve('@accordproject/concerto-engine', { paths: [path.join(root, 'packages/concerto-core')] });
process.env.CONCERTO_ENGINE_MODULE = path.join(bench, 'lib/p515-engine-counter.cjs');
const core = require(path.join(root, 'packages/concerto-core'));
const stats = () => globalThis.__p515Crossings;
const A = 'namespace org.acme.a@1.0.0\nconcept Shape {}\nconcept Sq extends Shape {}\n';
const B = 'namespace org.acme.b@1.0.0\nimport org.acme.a@1.0.0.{Shape}\nconcept Local { o Shape s }\n';
function measure(name, setup, op, n = 50) {
  const ctxs = [];
  for (let i = 0; i < n; i++) ctxs.push(setup());
  for (const k of Object.keys(stats() || {})) delete stats()[k];
  for (const c of ctxs) op(c);
  const s = stats() || {};
  const total = Object.values(s).reduce((a, v) => a + v.calls, 0) / n;
  const top = Object.entries(s).sort((a, b) => b[1].calls - a[1].calls).map(([k, v]) => `${k} x${(v.calls / n).toFixed(2)}`).join(', ');
  console.log(`${name.padEnd(44)} ${total.toFixed(2).padStart(6)}  ${top}`);
}
const warm = () => { const mm = new core.ModelManager(); mm.addCTOModel(A, 'a.cto'); mm.addCTOModel(B, 'b.cto'); return mm; };
measure('new ModelManager()', () => null, () => new core.ModelManager());
measure('addCTOModel (one file)', () => { const mm = new core.ModelManager(); return mm; }, (mm) => mm.addCTOModel(A, 'a.cto'));
measure('addModelFile (validated, one file)', () => { const mm = new core.ModelManager(); const ast = new core.ModelManager().addCTOModel(A, 'a.cto').getAst(); return { mm, mf: new core.ModelFile(mm, ast, A, 'a.cto') }; }, (c) => c.mm.addModelFile(c.mf));
measure('addModelFiles (two files)', () => new core.ModelManager(), (mm) => mm.addModelFiles([A, B], ['a.cto', 'b.cto']));
measure('updateModelFile (string)', warm, (mm) => mm.updateModelFile(A + 'concept X {}\n', 'a.cto'));
measure('deleteModelFile', warm, (mm) => mm.deleteModelFile('org.acme.b@1.0.0'));
measure('validateModelFiles', warm, (mm) => mm.validateModelFiles());
const reads = (name, op) => measure(name, () => { const mm = warm(); op(mm); return mm; }, op);
reads('MM.getType (1st read)', (mm) => mm.getType('org.acme.a@1.0.0.Sq'));
reads('MM.resolveType (1st read)', (mm) => mm.resolveType('x', 'org.acme.a@1.0.0.Sq'));
reads('MM.derivesFrom', (mm) => mm.derivesFrom('org.acme.a@1.0.0.Sq', 'org.acme.a@1.0.0.Shape'));
reads('MM.isAssignableTo', (mm) => mm.isAssignableTo('org.acme.a@1.0.0.Sq', 'org.acme.a@1.0.0.Shape'));
reads('MM.getNamespaces (1st read)', (mm) => mm.getNamespaces());
reads('MM.getModelFileByFileName', (mm) => mm.getModelFileByFileName('b.cto'));
reads('MF.getType (registered)', (mm) => mm.getModelFile('org.acme.b@1.0.0').getType('Shape'));
reads('MF.isLocalType (registered)', (mm) => mm.getModelFile('org.acme.b@1.0.0').isLocalType('Local'));
reads('MF.getFullyQualifiedTypeName (registered)', (mm) => mm.getModelFile('org.acme.b@1.0.0').getFullyQualifiedTypeName('Shape'));
reads('MF.getVersion (registered)', (mm) => mm.getModelFile('org.acme.b@1.0.0').getVersion());
reads('MF.getImports (registered)', (mm) => mm.getModelFile('org.acme.b@1.0.0').getImports());
