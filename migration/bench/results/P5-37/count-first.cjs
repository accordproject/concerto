// P5-37 (accordproject/concerto-rust#347): TS->WASM crossings for the first
// Serializer.toJSON / fromJSON / Resource.validate after a model change, and
// for a repeat call. Counts only, no timings.
// Usage (from the concerto root, after building packages/concerto-core):
//   node migration/bench/results/P5-37/count-first.cjs "$PWD"
const path = require('path');
const root = process.argv[2];
const bench = path.join(root, 'migration/bench');
process.env.P515_REAL_ENGINE = require.resolve('@accordproject/concerto-engine', { paths: [path.join(root, 'packages/concerto-core')] });
process.env.CONCERTO_ENGINE_MODULE = path.join(bench, 'lib/p515-engine-counter.cjs');
const core = require(path.join(root, 'packages/concerto-core'));
const stats = () => globalThis.__p515Crossings;
const A = 'namespace org.acme.a@1.0.0\nconcept Shape { o String name }\nconcept Sq extends Shape { o Integer side }\n';
const B = 'namespace org.acme.b@1.0.0\nimport org.acme.a@1.0.0.{Sq}\nasset Thing identified by id { o String id o Sq sq }\n';
const JSON_THING = { $class: 'org.acme.b@1.0.0.Thing', id: 't1', sq: { $class: 'org.acme.a@1.0.0.Sq', name: 'n', side: 3 } };
function measure(name, setup, op, n = 50) {
  const ctxs = [];
  for (let i = 0; i < n; i++) ctxs.push(setup());
  for (const k of Object.keys(stats() || {})) delete stats()[k];
  for (const c of ctxs) op(c);
  const s = stats() || {};
  const total = Object.values(s).reduce((a, v) => a + v.calls, 0) / n;
  const top = Object.entries(s).sort((a, b) => b[1].calls - a[1].calls).map(([k, v]) => `${k} x${(v.calls / n).toFixed(2)}`).join(', ');
  console.log(`${name.padEnd(52)} ${total.toFixed(2).padStart(6)}  ${top}`);
}
// A manager with both files, plus a Serializer and a populated resource.
function ctx() {
  const mm = new core.ModelManager();
  mm.addCTOModel(A, 'a.cto');
  mm.addCTOModel(B, 'b.cto');
  const factory = new core.Factory(mm);
  const serializer = new core.Serializer(factory, mm);
  return { mm, serializer };
}
const fresh = () => { const c = ctx(); c.resource = null; return c; };
measure('fromJSON (first after a model change)', () => { const c = ctx(); c.serializer.fromJSON(JSON_THING); c.mm.updateModelFile(A + 'concept Extra {}\n', 'a.cto'); return c; }, (c) => c.serializer.fromJSON(JSON_THING));
measure('fromJSON (first on a new manager)', fresh, (c) => c.serializer.fromJSON(JSON_THING));
measure('fromJSON (repeat)', () => { const c = ctx(); c.serializer.fromJSON(JSON_THING); return c; }, (c) => c.serializer.fromJSON(JSON_THING));
// For toJSON/validate the resource is built before the change is measured:
// fromJSON primes the cache, then the model changes, then a factory-built
// resource (no engine serializer call) is the measured input.
const primedThenChanged = () => {
  const c = ctx();
  c.serializer.fromJSON(JSON_THING);
  c.mm.updateModelFile(A + 'concept Extra {}\n', 'a.cto');
  const f = new core.Factory(c.mm);
  const sq = f.newConcept('org.acme.a@1.0.0', 'Sq');
  sq.name = 'n'; sq.side = 3;
  const t = f.newResource('org.acme.b@1.0.0', 'Thing', 't1');
  t.sq = sq;
  c.resource = t;
  return c;
};
measure('toJSON (first after a model change)', primedThenChanged, (c) => c.serializer.toJSON(c.resource));
measure('toJSON (repeat)', () => { const c = primedThenChanged(); c.serializer.toJSON(c.resource); return c; }, (c) => c.serializer.toJSON(c.resource));
measure('Resource.validate (first after a model change)', primedThenChanged, (c) => c.resource.validate());
measure('Resource.validate (repeat)', () => { const c = primedThenChanged(); c.resource.validate(); return c; }, (c) => c.resource.validate());
