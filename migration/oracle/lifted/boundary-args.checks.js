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

module.exports = checks;
