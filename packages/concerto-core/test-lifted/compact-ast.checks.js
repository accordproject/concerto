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
 * P5-92 lifted checks (accordproject/concerto-rust#438): a property test
 * feeding the same ASTs through both of the engine's staging paths.
 *
 * The `ModelFile` constructor writes an AST that exists as a JS object
 * straight into the engine's compact binary layout (src/engine/ast-codec.ts,
 * `rustHandle.stageModelFileCheckedCompact`/`...WithHeaderCompact`), where it
 * used to send `JSON.stringify(ast)` (`stageModelFileChecked`/
 * `...WithHeader`). Each AST here is loaded twice in a fresh manager, with
 * BC-19's shape check on and with the `metamodelValidation: false` opt-out:
 * once as is, and once with the compact bindings hidden on the manager's
 * rustHandle, so that the text path runs. Both must give the same outcome:
 * the constructor's result (the namespace and every declaration's and
 * property's name, which builds the lazy views) or the class of the error
 * it threw, then `addModelFile`'s, then the AST `getAst()` returns.
 *
 * The ASTs are three CTO models' parser output, each as it is and after
 * seeded random mutations (one, or two every third time): a key dropped,
 * `$class` moved last, an unknown key, an array item doubled (a shared
 * reference), or a value replaced, among others by what `JSON.stringify` treats in its own way (`undefined`,
 * a function, a symbol, `NaN`, `-0`, `Infinity`, an integer past 2^53, a
 * `Date`, a `Map`, a class instance, an object with `toJSON`, a lone
 * surrogate, a BigInt, a sparse array, a nesting deeper than the engine's
 * JSON reader allows, a cycle). The check returns the cases whose outcomes
 * differ, so it expects none; on the src core it also fails unless the
 * compact path ran (on the reference, which has no engine, both loads are
 * the same TS load). Run by fallbacks.spec.js.
 */

const MODELS = [
    `namespace org.acme.a@1.0.0
@Term("A thing")
abstract concept Base identified by id {
  o String id regex=/^[a-z]+$/ length=[1,20]
}
@Deco(1, -2.5, "x", true)
asset Thing extends Base {
  o Integer count default=5 range=[0,100] optional
  o Double ratio range=[-1.5,100.25] optional
  o Long big default=9007199254740991 optional
  o DateTime when optional
  o String[] tags optional
  --> Other other optional
  o Kind kind default="ONE"
}
participant Other identified by email {
  o String email
}
enum Kind {
  o ONE
  @Deco2
  o TWO
}
event Happened {
  o String what
}
transaction Act {
  o Double amount
}`,
    `namespace org.acme.b@1.0.0
import org.acme.a@1.0.0.{Thing, Kind}
scalar Ssn extends String regex=/\\d{3}-\\d{2}-\\d{4}/
scalar Pct extends Double range=[0.0, 1.0]
map Index {
  o String
  o Thing
}
concept Holder {
  o Ssn ssn
  o Pct pct optional
  o Kind kind optional
  o Index index optional
}`,
    `namespace org.acme.c@1.0.0
concept Empty {}
concept Unicode {
  o String café optional
}`,
];

/** The outcome of `fn`: its value, or the class of the error it threw. */
function probe(fn) {
    try {
        return { ok: fn() };
    } catch (e) {
        return { throws: e && e.constructor ? e.constructor.name : typeof e };
    }
}

/**
 * A seeded xorshift32 generator.
 * @param {number} seed the seed
 * @returns {Function} the next value in [0, 1)
 */
function random(seed) {
    let x = seed >>> 0 || 1;
    return () => {
        x ^= x << 13;
        x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5;
        x >>>= 0;
        return x / 0x100000000;
    };
}

/** A class whose instances `JSON.stringify` writes as plain objects. */
class Point {
    constructor() {
        this.$class = 'concerto.metamodel@1.0.0.TypeIdentifier';
        this.name = 'Thing';
    }
}

/**
 * The replacement values the mutations pick from (fresh each time, so no
 * two places share one unless a mutation means them to).
 * @returns {Array} the values
 */
function replacements() {
    let deep = null;
    for (let i = 0; i < 130; i++) {
        deep = [deep];
    }
    const cyclic = { $class: 'concerto.metamodel@1.0.0.TypeIdentifier' };
    cyclic.self = cyclic;
    const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
    return [
        null, true, false, 0, -1, 1.5, -0, NaN, Infinity, 2 ** 31, 2 ** 60, 1e21, 2 ** 53 + 2,
        '', 'x', '\ud800', '😀', 'café',
        'concerto.metamodel@1.0.0.StringProperty', 'concerto.metamodel@1.0.0.ConceptDeclaration',
        [], {}, { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Thing' },
        undefined, () => 1, Symbol('s'), new Date(0), new Map([['a', 1]]), new Point(),
        { toJSON: () => 'json' }, 10n, sparse, deep, cyclic, Object.create(null),
    ];
}

/**
 * Every [parent, key] slot of `value` (an object property or array item).
 * @param {*} value the AST or a part of it
 * @param {Array} out the slots so far
 * @returns {Array} the slots
 */
function slots(value, out = []) {
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            out.push([value, key]);
            slots(value[key], out);
        }
    }
    return out;
}

/**
 * One random change to a random part of `ast`.
 * @param {object} ast the AST, changed in place
 * @param {Function} next the generator
 */
function mutate(ast, next) {
    const all = slots(ast);
    const [parent, key] = all[Math.floor(next() * all.length)];
    const node = parent[key];
    const pick = (items) => items[Math.floor(next() * items.length)];
    const op = Math.floor(next() * 6);
    if (op === 0) {
        delete parent[key];
    } else if (op === 1 && node && typeof node === 'object' && !Array.isArray(node) && '$class' in node) {
        const $class = node.$class;
        delete node.$class;
        node.$class = $class;
    } else if (op === 2 && node && typeof node === 'object' && !Array.isArray(node)) {
        node.unknownKey = pick(replacements());
    } else if (op === 3 && Array.isArray(node) && node.length > 0) {
        node.push(pick(node));
    } else {
        parent[key] = pick(replacements());
    }
}

/**
 * Loads `ast` in a fresh manager built with `options`, with the compact
 * staging bindings hidden when `textOnly`, and reports what happened.
 * @param {object} core the core under test
 * @param {object} options the manager options
 * @param {Function} makeAst builds the AST (a fresh copy per load)
 * @param {boolean} textOnly whether to hide the compact bindings
 * @param {object} counter counts the compact binding calls
 * @returns {Array} the constructor's outcome, `addModelFile`'s, and the AST read back
 */
function load(core, options, makeAst, textOnly, counter) {
    const mm = new core.ModelManager(options);
    const handle = mm.rustHandle;
    if (handle) {
        for (const binding of ['stageModelFileCheckedCompact', 'stageModelFileWithHeaderCompact']) {
            const original = handle[binding];
            handle[binding] = textOnly || typeof original !== 'function' ? undefined : function (...args) {
                counter.calls++;
                return original.apply(this, args);
            };
        }
    }
    let file;
    const constructed = probe(() => {
        file = new core.ModelFile(mm, makeAst(), undefined, 'test.json');
        return [file.getNamespace(), file.getAllDeclarations().map((d) =>
            [d.getName(), (d.getProperties ? d.getProperties() : []).map((p) => p.getName())])];
    });
    const added = file ? probe(() => {
        mm.addModelFile(file, undefined, 'test.json');
        return 'added';
    }) : null;
    const ast = file ? probe(() => JSON.stringify(file.getAst())) : null;
    return [constructed, added, ast];
}

/**
 * The property test (module doc).
 * @param {object} core the core under test
 * @param {number} seed the generator's seed
 * @param {number} rounds the mutated copies per model
 * @returns {Array} the cases whose two loads differ
 */
function compare(core, seed, rounds) {
    const parser = new core.ModelManager({ strict: true });
    const bases = MODELS.map((cto) => parser.addCTOModel(cto, undefined, true).getAst());
    const next = random(seed);
    const counter = { calls: 0 };
    const mismatches = [];
    bases.forEach((base, b) => {
        for (let round = 0; round < rounds; round++) {
            // The same mutations for every load of this case: replayed from
            // a saved state of the generator.
            const state = Math.floor(next() * 0x100000000);
            // The model as it is once, then one mutation, or two every third time.
            const mutations = round === 0 ? 0 : 1 + (round % 3 === 0 ? 1 : 0);
            const makeAst = () => {
                const ast = JSON.parse(JSON.stringify(base));
                const replay = random(state);
                for (let i = 0; i < mutations; i++) {
                    mutate(ast, replay);
                }
                return ast;
            };
            for (const options of [{}, { metamodelValidation: false }]) {
                const compact = load(core, options, makeAst, false, counter);
                const text = load(core, options, makeAst, true, counter);
                if (JSON.stringify(compact) !== JSON.stringify(text)) {
                    mismatches.push({ base: b, round, options, compact, text });
                }
            }
        }
    });
    if (new core.ModelManager().rustHandle && counter.calls === 0) {
        throw new Error('the compact staging path never ran');
    }
    return mismatches;
}

module.exports = [
    {
        id: 'P592-COMPACT-001',
        covers: 'P5-92: the same ASTs, as is and mutated, through the compact and the text staging paths, with and without BC-19\'s shape check',
        run: (core) => compare(core, 0x5092, 80),
        expect: { ok: [] },
    },
];
