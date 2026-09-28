/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * P5-03 #262 lifted checks: non-string arguments to the members whose
 * catch-all fallback #262 removed. Extended by #294 (audit of the other
 * string-taking concerto-wasm bindings) to add `isAssignableTo`, the one
 * other de-fallbacked member the audit found unguarded, and then again
 * (review follow-up) to add `deleteModelFile` and the `updateModelFile` ->
 * `_rustMirrorUpdate` delete path.
 *
 * The WASM bindings behind `BaseModelManager.getModelFileByFileName`,
 * `derivesFrom`, `resolveType`, `isAssignableTo` and `ModelFile.isLocalType`
 * take `&str` or `Option<String>`. A JS number, object or boolean passed to
 * one of them traps the engine (`RuntimeError: memory access out of
 * bounds`), and a JS null becomes `None`. The catch-all used to hide this by
 * running the TS body; with it gone, each wrapper sends only a string (or
 * `undefined`, where the binding takes `Option<String>`) to Rust and runs
 * the TS body for any other argument. `expect` is the frozen v5.0.0
 * reference's outcome. Run by fallbacks.spec.js.
 *
 * `deleteModelFile` and `_rustMirrorUpdate` are a different shape: the ODD
 * loop below never reaches their `rustHandle.deleteModelFile` call, because
 * that call only runs when `this.modelFiles[namespace]` (or
 * `modelFile.getNamespace()`) already resolved to a loaded namespace, and
 * none of `undefined`/`null`/`123`/`{}`/`true` coerce (via the object-key
 * lookup both use) to one. v5.0.0 lets a non-string whose *string form* is a
 * loaded namespace delete cleanly (plain-object coercion); the WASM mirror
 * traps on the same non-string. See the `COERCE_CALLS` block below.
 */

const ODD = { undefined: undefined, null: null, number: 123, object: {}, boolean: true };

/**
 * A manager holding `test@1.0.0` (no file name; `A`, and `B extends A`) and
 * `n@1.0.0` (file name `x.cto`, importing `A`).
 * @param {object} core the core under test
 * @returns {object} the ModelManager
 */
function manager(core) {
    const mm = new core.ModelManager({ strict: true });
    mm.addCTOModel('namespace test@1.0.0\nconcept A{}\nconcept B extends A{}');
    mm.addCTOModel('namespace n@1.0.0\nimport test@1.0.0.{A}\nconcept C{}', 'x.cto');
    return mm;
}

/**
 * A ModelFile (or a missing one) as a comparable value.
 * @param {object} mf the ModelFile or undefined
 * @returns {string} its namespace, or '<none>'
 */
function ns(mf) {
    return mf ? mf.getNamespace() : '<none>';
}

const CALLS = {
    'getModelFileByFileName(x)': (core, x) => ns(manager(core).getModelFileByFileName(x)),
    'derivesFrom(x, A)': (core, x) => manager(core).derivesFrom(x, 'test@1.0.0.A'),
    'derivesFrom(B, x)': (core, x) => manager(core).derivesFrom('test@1.0.0.B', x),
    'resolveType(n, x)': (core, x) => manager(core).resolveType('n@1.0.0', x),
    'resolveType(x, A)': (core, x) => manager(core).resolveType(x, 'A'),
    'isLocalType(x)': (core, x) => manager(core).getModelFile('n@1.0.0').isLocalType(x),
    'isAssignableTo(x, A)': (core, x) => manager(core).isAssignableTo(x, 'test@1.0.0.A'),
    'isAssignableTo(B, x)': (core, x) => manager(core).isAssignableTo('test@1.0.0.B', x),
};

const EXPECT = require('./boundary-args.expect.json');

const checks = [];
let n = 0;
for (const [call, run] of Object.entries(CALLS)) {
    for (const [kind, value] of Object.entries(ODD)) {
        n++;
        const id = `BOUNDARY-ARG-${String(n).padStart(3, '0')}`;
        checks.push({
            id,
            covers: `${call.replace('x', kind)}`,
            run: (core) => run(core, value),
            expect: EXPECT[id],
        });
    }
}

/**
 * A duck-typed "modelFile" for `updateModelFile`'s non-string API path:
 * `getNamespace()` is not a plain string but coerces (via `toString`) to an
 * existing namespace, the way an object-key lookup does. `getVersion()` is
 * truthy so it clears `updateModelFile`'s version guard.
 * @param {*} nsObj the non-string namespace value
 * @returns {object} a fake ModelFile
 */
function fakeModelFile(nsObj) {
    return {
        getNamespace: () => nsObj,
        getVersion: () => '1.0.1',
        validate: () => {},
        getAst: () => ({ $class: 'concerto.metamodel@1.0.0.Model', namespace: 'test@1.0.1', declarations: [] }),
        getDefinitions: () => undefined,
        getName: () => undefined,
    };
}

// Non-ODD non-string values whose string form ('test@1.0.0') is a loaded
// namespace, so the object-key lookups in deleteModelFile/_rustMirrorUpdate
// find it and the rustHandle mirror call is reached.
const COERCE = {
    'toString-object': { toString() { return 'test@1.0.0'; } },
    'single-element array': ['test@1.0.0'],
};

const COERCE_CALLS = {
    'deleteModelFile(x)': (core, x) => {
        const mm = manager(core);
        mm.deleteModelFile(x);
        try {
            return mm.getModelFile('test@1.0.0') ? 'present' : 'absent';
        } catch (e) {
            return `absent:${e.constructor.name}`;
        }
    },
    'updateModelFile({getNamespace: () => x})': (core, x) => {
        const mm = manager(core);
        mm.updateModelFile(fakeModelFile(x));
        return mm.getModelFile('test@1.0.0').getVersion();
    },
};

for (const [call, run] of Object.entries(COERCE_CALLS)) {
    for (const [kind, value] of Object.entries(COERCE)) {
        n++;
        const id = `BOUNDARY-ARG-${String(n).padStart(3, '0')}`;
        checks.push({
            id,
            covers: `${call.replace('x', kind)}`,
            run: (core) => run(core, value),
            expect: EXPECT[id],
        });
    }
}

/**
 * #294 review follow-up: the `ModelFile` constructor only rejects a
 * *truthy* non-string `definitions`/`fileName`
 * (`if (definitions && typeof definitions !== 'string') throw ...`,
 * introspect/modelfile.ts) -- a falsy non-string (`0`, `false`, `NaN`) is
 * stored as-is. `BaseModelManager`/`ModelFile` forwarded that raw value to
 * several wasm `Option<String>` params via `x ?? undefined` (which maps
 * only null/undefined), trapping the engine at each of: `stageModelFile`
 * (engine/views.ts, run by the `ModelFile` constructor itself),
 * `_rustMirrorAdd`'s and `_rustMirrorUpdate`'s `addModelWithDefinitions`/
 * `updateModelFile` calls, `ModelFile#validate()`'s
 * `modelFileValidateDetached` fallback, and `BaseModelManager#validateAst`
 * (reachable via `options.metamodelValidation`). Each now forwards only a
 * genuine string, matching v5.0.0 (no wasm call at all).
 */
const FALSY_NONSTRING = { zero: 0, false: false, nan: NaN };

const TEST_CTO = 'namespace test@1.0.0\nconcept A{}';
const TEST_CTO_V2 = 'namespace test@1.0.0\nconcept A{}\nconcept D{}';

/**
 * The AST for a CTO string, via a throwaway ModelManager's own processFile.
 * @param {object} core the core under test
 * @param {string} cto the CTO source
 * @returns {object} the AST
 */
function astFor(core, cto) {
    return new core.ModelManager({ strict: true }).processFile(null, cto).ast;
}

const FALSY_CALLS = {
    'addCTOModel(cto, x)': (core, x) => {
        const mm = new core.ModelManager({ strict: true });
        const mf = mm.addCTOModel(TEST_CTO, x);
        return [ns(mf), mf.getName()];
    },
    'addCTOModel(cto, x) [metamodelValidation]': (core, x) => {
        const mm = new core.ModelManager({ strict: true, metamodelValidation: true });
        const mf = mm.addCTOModel(TEST_CTO, x);
        return [ns(mf), mf.getName()];
    },
    'addModelFile(new ModelFile(mm, ast, cto, x))': (core, x) => {
        const mm = new core.ModelManager({ strict: true });
        const mf = new core.ModelFile(mm, astFor(core, TEST_CTO), TEST_CTO, x);
        mm.addModelFile(mf);
        return [ns(mf), mf.getName()];
    },
    'addModelFile(new ModelFile(mm, ast, x, "a.cto"))': (core, x) => {
        const mm = new core.ModelManager({ strict: true });
        const mf = new core.ModelFile(mm, astFor(core, TEST_CTO), x, 'a.cto');
        mm.addModelFile(mf);
        return [ns(mf), mf.getDefinitions()];
    },
    'addModelFiles([new ModelFile(mm, ast, cto, x)])': (core, x) => {
        const mm = new core.ModelManager({ strict: true });
        const mf = new core.ModelFile(mm, astFor(core, TEST_CTO), TEST_CTO, x);
        mm.addModelFiles([mf]);
        return [ns(mf), mf.getName()];
    },
    'updateModelFile(new ModelFile(mm, ast2, cto2, x))': (core, x) => {
        const mm = new core.ModelManager({ strict: true });
        mm.addCTOModel(TEST_CTO);
        const mf2 = new core.ModelFile(mm, astFor(core, TEST_CTO_V2), TEST_CTO_V2, x);
        mm.updateModelFile(mf2);
        return [mm.getModelFile('test@1.0.0') === mf2, mf2.getName()];
    },
};

for (const [call, run] of Object.entries(FALSY_CALLS)) {
    for (const [kind, value] of Object.entries(FALSY_NONSTRING)) {
        n++;
        const id = `BOUNDARY-ARG-${String(n).padStart(3, '0')}`;
        checks.push({
            id,
            covers: `${call.replace('x', kind)}`,
            run: (core) => run(core, value),
            expect: EXPECT[id],
        });
    }
}

module.exports = checks;
