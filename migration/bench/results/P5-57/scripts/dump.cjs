// P5-57: every DecoratorManager extract result through the TS API, on the
// engine CONCERTO_ENGINE_MODULE names, as one JSON line per case; eq.sh runs
// it on the base and the P5-57 engine and compares the output. The resident
// path (DcsManagerHandle) is taken on the second call of each case, the
// per-call bindings through percall.cjs.
'use strict';
const fs = require('fs');
const { ModelManager, DecoratorManager } = require(process.argv[2]);
const D = process.argv[3];
for (const s of ['synthetic-large', 'conformance', 'concerto-core-test-data']) {
  const models = JSON.parse(fs.readFileSync(`${D}/${s}.json`, 'utf8'));
  const ast = { $class: 'concerto.metamodel@1.0.0.Models', models };
  for (const op of ['extractDecorators', 'extractVocabularies', 'extractNonVocabDecorators']) {
    for (const opts of [{}, { removeDecoratorsFromModel: true, locale: 'en' }, { removeDecoratorsFromModel: false, locale: 'fr' }]) {
      const mm = new ModelManager(); mm.fromAst(ast);
      for (const call of ['first', 'repeat']) {
        let out;
        try {
          const r = DecoratorManager[op](mm, opts);
          out = { ast: r.modelManager.getAst(), decoratorCommandSet: r.decoratorCommandSet, vocabularies: r.vocabularies };
        } catch (e) { out = { error: e.constructor.name }; }
        console.log(JSON.stringify({ s, op, opts, call, out }));
      }
    }
  }
}
