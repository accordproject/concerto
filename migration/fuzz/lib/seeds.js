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
 * Seed fixtures for the fuzz harness: real, recorded oracle fixtures read
 * (never modified — see migration/fuzz/README.md) from the canonical corpus.
 * Each seed names the op and the JSON path within its raw `inputs` (still
 * `@@oracle`-encoded, before `store.unpack`) that carries the plain document
 * (model AST or instance JSON) that lib/mutate.js mutates. Everything else in
 * the fixture (the model-manager/serializer/factory recipe) is replayed
 * unchanged, so a mutated case still exercises real machinery instead of a
 * hand-built one.
 */

const fs = require('fs');
const path = require('path');
const { blobStore } = require(path.join(__dirname, '..', '..', 'oracle', 'lib', 'store'));

// Ops fuzzed, and where their plain document lives, as a lens (array of
// keys/indices) rooted at the fixture's `inputs` object. Every lens must
// land on a plain sub-document — never on a node that itself carries an
// `@@oracle` marker — since lib/mutate.js edits JSON shape generically and
// would otherwise happily corrupt the recipe scaffolding instead of the
// model/instance content (mutating the wrong thing produces harness errors,
// not divergences). `Resource.validate`'s target is a `typed` recipe whose
// `fields` map is the resource's own (plain) property values, so that is
// the lens, not the whole target. `ModelManager.addModelFile`'s single arg
// is itself an `@@oracle: 'mfnew'` recipe node (its `mm` and `ast` fields
// are the actual model-manager-ref and model AST); the lens has to reach
// past that marker to `args[0].ast`, or `mutate.js`'s refusal to recurse
// into an `@@oracle`-marked node leaves zero mutable slots and every case
// replays the corpus fixture unchanged.
const TARGETS = [
    { op: 'ModelManager.fromAst', path: ['args', 0], kind: 'model' },
    { op: 'ModelManager.addModelFile', path: ['args', 0, 'ast'], kind: 'model' },
    { op: 'Serializer.fromJSON', path: ['args', 0], kind: 'instance' },
    { op: 'Resource.validate', path: ['target', 'fields'], kind: 'instance' },
];

/**
 * @param {*} obj value
 * @param {Array<string|number>} lens keys/indices
 * @returns {*} obj[lens[0]][lens[1]]...
 */
function getAt(obj, lens) {
    let v = obj;
    for (const k of lens) {
        if (v == null) { return undefined; }
        v = v[k];
    }
    return v;
}

/**
 * @param {*} obj value (mutated in place)
 * @param {Array<string|number>} lens keys/indices
 * @param {*} value replacement
 */
function setAt(obj, lens, value) {
    if (lens.length === 0) {
        throw new Error('setAt: empty lens');
    }
    let v = obj;
    for (let i = 0; i < lens.length - 1; i++) {
        v = v[lens[i]];
    }
    v[lens[lens.length - 1]] = value;
}

/**
 * A fixture is usable as a seed only when its target document is plain JSON
 * (no `@@oracle` marker of its own) — a handful of ops record the whole
 * fixture as one JSON value but keep it a plain, string-keyed model/instance
 * document; anything with a marker at the mutation point is skipped, since
 * mutate.js does not understand recipes.
 * @param {*} v candidate value
 * @returns {boolean} true if plain-enough to mutate generically
 */
function looksPlain(v) {
    return v !== null && typeof v === 'object';
}

/**
 * Load up to `limit` usable seeds per target op from the corpus.
 *
 * A fixture is rejected up front (not merely skipped as unusable-for-lens)
 * when `store.facts()` cannot resolve its blob references: a handful of
 * corpus fixtures reference a blob that is not in `fixtures/blobs` (a
 * pre-existing corpus gap, not something this harness may fix — see
 * migration/fuzz/README.md). Filtering here means every case this run
 * actually generates can produce a real pass or a real divergence, never a
 * `store.facts` harness error unrelated to the mutation.
 * @param {string} fixturesDir absolute path to migration/oracle/fixtures
 * @param {number} limit max seeds per op
 * @returns {Array<object>} seeds: {op, path, kind, file, raw}
 */
function loadSeeds(fixturesDir, limit = 25) {
    const store = blobStore(fixturesDir);
    const seeds = [];
    for (const t of TARGETS) {
        const dirs = ['data', 'conformance', 'unit', 'gaps', 'lifted']
            .map((src) => path.join(fixturesDir, src, t.op))
            .filter((d) => fs.existsSync(d));
        let found = 0;
        for (const dir of dirs) {
            if (found >= limit) { break; }
            const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
            for (const f of files) {
                if (found >= limit) { break; }
                const full = path.join(dir, f);
                let raw;
                try {
                    raw = JSON.parse(fs.readFileSync(full, 'utf8'));
                } catch (e) {
                    continue;
                }
                const doc = getAt(raw.inputs, t.path);
                if (!looksPlain(doc)) {
                    continue;
                }
                try {
                    store.facts(raw.inputs);
                } catch (e) {
                    continue; // pre-existing corpus gap (missing blob) — not a seed we can use
                }
                seeds.push({ op: t.op, path: t.path, kind: t.kind, file: full, raw });
                found++;
            }
        }
    }
    return seeds;
}

/**
 * Apply a mutated document back into a deep clone of a seed's raw inputs.
 * @param {object} seed one entry from loadSeeds()
 * @param {*} mutatedDoc the mutated document
 * @returns {object} a new raw `inputs` object, still `@@oracle`-encoded
 */
function withMutatedDoc(seed, mutatedDoc) {
    const inputs = JSON.parse(JSON.stringify(seed.raw.inputs));
    setAt(inputs, seed.path, mutatedDoc);
    return inputs;
}

module.exports = { loadSeeds, getAt, setAt, withMutatedDoc, TARGETS };
