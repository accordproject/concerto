// P5-40: the extract bindings give identical output on the base engine and
// the P5-40 engine: 3 bindings x 3 option sets x the 3 dumped inputs.
const fs = require('fs');
const W = '/home/user/wt/P5-40';
const a = require(`${W}/base-rust/concerto-wasm/pkg/concerto-engine.cjs`);
const b = require(`${W}/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs`);
let n = 0, diffs = 0;
for (const s of ['synthetic-large', 'conformance', 'concerto-core-test-data']) {
  const models = JSON.parse(fs.readFileSync(`${W}/p540/data/${s}.json`, 'utf8'));
  for (const op of ['decoratorManagerExtractDecorators', 'decoratorManagerExtractVocabularies', 'decoratorManagerExtractNonVocabDecorators']) {
    for (const opts of [{ removeDecoratorsFromModel: true, locale: 'en' }, { removeDecoratorsFromModel: false, locale: 'en' }, { removeDecoratorsFromModel: false, locale: 'fr' }]) {
      const x = JSON.stringify(a[op](models, opts)), y = JSON.stringify(b[op](models, opts));
      if (x !== y) { console.log('DIFF', s, op, JSON.stringify(opts)); diffs++; process.exitCode = 1; }
      n++;
    }
  }
}
console.log(`compared ${n}, ${diffs} differ`);
