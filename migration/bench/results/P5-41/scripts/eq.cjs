const fs = require('fs');
const a = require('/home/user/wt/P5-41/base-rust/concerto-wasm/pkg/concerto-engine.cjs');
const b = require('/home/user/wt/P5-41/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs');
let n = 0;
for (const s of ['synthetic-large', 'conformance', 'concerto-core-test-data']) {
  const models = JSON.parse(fs.readFileSync(`/home/user/wt/P5-41/p541/data/${s}.json`, 'utf8'));
  for (const op of ['decoratorManagerExtractDecorators', 'decoratorManagerExtractVocabularies', 'decoratorManagerExtractNonVocabDecorators']) {
    for (const opts of [{ removeDecoratorsFromModel: true, locale: 'en' }, { removeDecoratorsFromModel: false, locale: 'en' }, { removeDecoratorsFromModel: false, locale: 'fr' }]) {
      const x = JSON.stringify(a[op](models, opts)), y = JSON.stringify(b[op](models, opts));
      if (x !== y) { console.log('DIFF', s, op, JSON.stringify(opts)); process.exitCode = 1; }
      n++;
    }
  }
}
console.log('compared', n);
