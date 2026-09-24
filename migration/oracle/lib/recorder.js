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
 * Oracle recorder: a mocha `--require` hook (plan §2.2, task P0-05).
 *
 * It patches the public semantic boundary of concerto-core `src/` (see
 * lib/ops.js) and writes one raw record per *outermost* public call:
 *
 *   {source, source_test, op, inputs, outcome, env}
 *
 * Environment:
 *   ORACLE_SOURCE   label for the corpus source (unit | data | conformance | gaps)
 *   ORACLE_RAW_DIR  where raw records (<source>-<pid>.jsonl) and skip stats go
 *   ORACLE_BLOB_DIR content-addressed blob store (shared with the corpus)
 *
 * A call is recorded only when all of its inputs are plain data or handles
 * with a known recipe, and no concerto-core / collaborator function is stubbed
 * by sinon at the time of the call. Everything else is counted as a skip,
 * by op and reason.
 */

const fs = require('fs');
const path = require('path');
const { getSrcCore, SRC_ROOT, CORE_PKG_DIR } = require('./core');
const codec = require('./codec');
const { opTable } = require('./ops');
const { canonicalise } = require('./canon');
const { blobStore } = require('./store');
const { seededRandom, waitPastInputInstants } = require('./env');

const { NonPlain, newCtx, encodePlain, encodeError, isSinonStub } = codec;

const SOURCE = process.env.ORACLE_SOURCE || 'unit';
const RAW_DIR = process.env.ORACLE_RAW_DIR;
const BLOB_DIR = process.env.ORACLE_BLOB_DIR;
if (!RAW_DIR || !BLOB_DIR) {
    throw new Error('recorder: ORACLE_RAW_DIR and ORACLE_BLOB_DIR must be set');
}
fs.mkdirSync(RAW_DIR, { recursive: true });

const store = blobStore(BLOB_DIR);
const core = getSrcCore();

// Load every src module so the stub scan sees all of them.
(function loadAll(dir) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            loadAll(p);
        } else if (/\.ts$/.test(f) && !/\.d\.ts$/.test(f)) {
            require(p);
        }
    }
})(SRC_ROOT);

const ORIGINAL_DATE = Date;
const ORIGINAL_DATE_NOW = Date.now;
const ORIGINAL_RANDOM = Math.random;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
    depth: 0,
    suspended: 0,
    title: null,
    outer: null,
    created: null,
};

const mmRecipes = new WeakMap();
const mfRecipes = new WeakMap();
const tracker = {
    mmRecipe: (mm) => mmRecipes.get(mm) || null,
    mfRecipe: (mf) => mfRecipes.get(mf) || null,
};
const encodeIn = codec.makeInputEncoder(core, tracker);
const encodeOut = codec.makeOutputEncoder(core);

const stats = { source: SOURCE, pid: process.pid, recorded: {}, skipped: {}, tainted: {} };
stats.samples = {};
const bump = (obj, op, reason) => {
    obj[op] = obj[op] || {};
    obj[op][reason] = (obj[op][reason] || 0) + 1;
    const key = op + ' ' + reason;
    stats.samples[key] = stats.samples[key] || [];
    if (stats.samples[key].length < 3 && !stats.samples[key].includes(state.title)) {
        stats.samples[key].push(state.title);
    }
};

// ---------------------------------------------------------------------------
// Stub detection
// ---------------------------------------------------------------------------

const holders = [];
const seenHolders = new Set();
const addHolder = (label, obj) => {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function') || seenHolders.has(obj)) {
        return;
    }
    if (obj === Object.prototype || obj === Function.prototype) {
        return;
    }
    seenHolders.add(obj);
    holders.push([label, obj]);
    if (typeof obj === 'function' && obj.prototype) {
        let p = obj.prototype;
        while (p && p !== Object.prototype) {
            if (!seenHolders.has(p)) {
                seenHolders.add(p);
                holders.push([label + '.prototype', p]);
            }
            p = Object.getPrototypeOf(p);
        }
    }
};
const addModule = (label, mod) => {
    addHolder(label, mod);
    for (const k of Object.keys(mod || {})) {
        const d = Object.getOwnPropertyDescriptor(mod, k);
        if (d && 'value' in d) {
            addHolder(label + '.' + k, d.value);
            if (d.value && typeof d.value === 'object') {
                for (const k2 of Object.keys(d.value)) {
                    const d2 = Object.getOwnPropertyDescriptor(d.value, k2);
                    if (d2 && 'value' in d2 && typeof d2.value === 'function') {
                        addHolder(label + '.' + k + '.' + k2, d2.value);
                    }
                }
            }
        }
    }
};
for (const [file, mod] of Object.entries(require.cache)) {
    if (file.startsWith(SRC_ROOT + path.sep)) {
        addModule(path.relative(SRC_ROOT, file), mod.exports);
    }
}
for (const ext of ['@accordproject/concerto-cto', '@accordproject/concerto-util', '@accordproject/concerto-metamodel', 'uuid', 'dayjs']) {
    try {
        const resolved = require.resolve(ext, { paths: [path.join(SRC_ROOT, 'introspect'), CORE_PKG_DIR] });
        addModule(ext, require(resolved));
    } catch (e) {
        // not resolvable from src: not a collaborator
    }
}
addHolder('Math', Math);
addHolder('JSON', JSON);

/**
 * @returns {string|null} the first stubbed collaborator, if any
 */
function findEnvStub() {
    if (Date !== ORIGINAL_DATE) {
        return 'Date(fake-timers)';
    }
    if (Date.now !== ORIGINAL_DATE_NOW) {
        return 'Date.now';
    }
    for (const [label, obj] of holders) {
        for (const k of Object.getOwnPropertyNames(obj)) {
            const d = Object.getOwnPropertyDescriptor(obj, k);
            if (d && 'value' in d && isSinonStub(d.value)) {
                return label + '.' + k;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

let rawFd = null;
const rawFile = path.join(RAW_DIR, `${SOURCE}-${process.pid}.jsonl`);
let buffer = [];
const flush = () => {
    if (buffer.length === 0) {
        return;
    }
    if (rawFd === null) {
        rawFd = fs.openSync(rawFile, 'a');
    }
    fs.writeSync(rawFd, buffer.join(''));
    buffer = [];
};

/**
 * @param {*} e error
 * @returns {string} class name
 */
const errClass = (e) => (e && e.constructor ? e.constructor.name : typeof e);

/**
 * @param {*} v value
 * @returns {boolean} is a model manager
 */
const isMM = (v) => v instanceof core.BaseModelManager;

/**
 * Where a value sits inside an op result (plain objects/arrays, depth <= 3).
 * @param {*} result op result
 * @param {object} needle value to find
 * @param {number} [depth] remaining depth
 * @returns {Array|null} key path, [] for the result itself, null if absent
 */
function findPath(result, needle, depth = 3) {
    if (result === needle) {
        return [];
    }
    if (depth === 0 || !result || typeof result !== 'object' || !(Array.isArray(result) || codec.isPlainObject(result))) {
        return null;
    }
    for (const k of Object.keys(result)) {
        const sub = findPath(result[k], needle, depth - 1);
        if (sub) {
            return [Array.isArray(result) ? Number(k) : k, ...sub];
        }
    }
    return null;
}

/**
 * Called for state-changing model manager calls made *inside* another op.
 * @param {object} mm receiver
 */
function noteNestedMutation(mm) {
    if (!isMM(mm)) {
        return;
    }
    const r = mmRecipes.get(mm);
    if (!r || r.tainted || r.pending) {
        return;
    }
    const outer = state.outer;
    if (outer && outer.target === mm && outer.spec.step) {
        return;
    }
    r.tainted = 'mutated-inside:' + (outer ? outer.spec.op : '?');
    bump(stats.tainted, outer ? outer.spec.op : '?', r.tainted);
}

/**
 * @param {object} spec op spec
 * @param {*} target receiver (method ops)
 * @param {Array} args arguments
 * @param {function} invoke performs the real call
 * @returns {*} the call's result
 */
function recordCall(spec, target, args, invoke) {
    const op = spec.op;
    let skip = findEnvStub();
    if (skip) {
        skip = 'env-stubbed:' + skip;
    } else if (spec.skipIf) {
        skip = spec.skipIf(args);
    }
    let inputs = null;
    let plainBefore = null;
    state.suspended++;
    try {
        if (!skip) {
            try {
                const ctx = newCtx();
                inputs = {};
                if (spec.kind === 'method') {
                    inputs.target = encodeIn(target, ctx);
                }
                inputs.args = args.map((a) => encodeIn(a, ctx));
            } catch (e) {
                skip = e instanceof NonPlain ? 'nonplain:' + e.reason : 'encoder-error:' + String(e && e.message).slice(0, 60);
                inputs = null;
            }
        }
        if (!skip) {
            plainBefore = args.map((a) => {
                try {
                    return JSON.stringify(encodePlain(a));
                } catch (e) {
                    return null;
                }
            });
        }
    } finally {
        state.suspended--;
    }

    // Model manager step bookkeeping.
    const mmTarget = (spec.step || spec.taint) && isMM(target) ? target : null;
    let stepEnc = null;
    let stepTaint = null;
    if (mmTarget) {
        const r = mmRecipes.get(mmTarget);
        if (r && !r.tainted) {
            if (spec.taint) {
                stepTaint = 'called:' + op;
            } else if (skip && skip.startsWith('env-stubbed')) {
                stepTaint = skip;
            } else {
                state.suspended++;
                try {
                    stepEnc = { method: spec.method, args: args.map((a) => store.pack(encodeIn(a, newCtx(mmTarget)))) };
                } catch (e) {
                    stepTaint = e instanceof NonPlain ? 'step-nonplain:' + e.reason : 'step-encoder-error:' + String(e && e.message).slice(0, 60);
                } finally {
                    state.suspended--;
                }
            }
        }
    }

    let packedInputs = null;
    let facts = null;
    if (!skip) {
        state.suspended++;
        try {
            packedInputs = store.pack(inputs, { root: false });
            facts = store.facts(packedInputs);
            waitPastInputInstants(facts);
        } finally {
            state.suspended--;
        }
    }

    const savedOuter = state.outer;
    const savedCreated = state.created;
    state.outer = { spec, target };
    state.created = [];
    const rnd = seededRandom();
    let result;
    let error;
    let threw = false;
    const start = Date.now();
    state.depth++;
    try {
        result = invoke();
    } catch (e) {
        threw = true;
        error = e;
    } finally {
        state.depth--;
    }
    const end = Date.now();
    const randomUsed = rnd.restore();
    const created = state.created;
    state.outer = savedOuter;
    state.created = savedCreated;

    if (!threw && result && typeof result.then === 'function') {
        skip = skip || 'async-result';
        if (mmTarget) {
            stepTaint = stepTaint || 'async';
        }
    }

    for (const mm of created) {
        const r = mmRecipes.get(mm);
        if (!r || !r.pending) {
            continue;
        }
        r.pending = false;
        const where = threw ? null : findPath(result, mm);
        if (where && !skip && spec.kind !== 'ctor') {
            r.derived = { op, inputs: packedInputs };
            if (where.length > 0) {
                r.derived.path = where;
            }
        } else if (!(spec.kind === 'ctor' && result === mm)) {
            r.tainted = r.tainted || ('created-inside:' + op);
            bump(stats.tainted, op, r.tainted);
        }
    }

    if (mmTarget) {
        const r = mmRecipes.get(mmTarget);
        if (r && !r.tainted) {
            if (stepTaint) {
                r.tainted = stepTaint;
                bump(stats.tainted, op, stepTaint);
            } else if (stepEnc) {
                r.steps.push({
                    enc: {
                        method: stepEnc.method,
                        args: stepEnc.args,
                        status: threw ? 'error' : 'ok',
                        errorClass: threw ? errClass(error) : null,
                    },
                });
            }
        }
    }

    if (skip) {
        bump(stats.skipped, op, skip);
    } else {
        state.suspended++;
        try {
            const outcome = threw ? { error: encodeError(error) } : { ok: encodeOut(result) };
            const effects = {};
            if (spec.mutatesTarget && target instanceof core.Typed) {
                effects.target = encodeOut(target);
            }
            args.forEach((a, i) => {
                if (plainBefore[i] === null) {
                    return;
                }
                let after = null;
                try {
                    after = JSON.stringify(encodePlain(a));
                } catch (e) {
                    after = null;
                }
                if (after !== plainBefore[i]) {
                    effects.args = effects.args || {};
                    effects.args[i] = after === null ? { [codec.M]: 'nonplain-after' } : JSON.parse(after);
                }
            });
            if (Object.keys(effects).length > 0) {
                outcome.effects = effects;
            }
            const canonical = canonicalise(outcome, facts, { start, end });
            const rec = {
                source: SOURCE,
                source_test: state.title,
                op,
                inputs: packedInputs,
                outcome: store.pack(canonical, { root: false }),
                env: { random: randomUsed > 0 },
            };
            buffer.push(JSON.stringify(rec) + '\n');
            if (buffer.length >= 200) {
                flush();
            }
            stats.recorded[op] = (stats.recorded[op] || 0) + 1;
        } catch (e) {
            if (e instanceof NonPlain) {
                bump(stats.skipped, op, 'nonplain-outcome:' + e.reason);
            } else {
                bump(stats.skipped, op, 'recorder-error:' + e.message.slice(0, 80));
            }
        } finally {
            state.suspended--;
        }
    }

    if (threw) {
        throw error;
    }
    return result;
}

/**
 * Wrap a method/static function.
 * @param {object} spec op spec
 * @param {function} orig original
 * @returns {function} wrapper
 */
function wrapFunction(spec, orig) {
    const wrapper = function (...args) {
        if (state.suspended > 0) {
            return orig.apply(this, args);
        }
        if (state.depth > 0) {
            if (spec.step || spec.taint) {
                noteNestedMutation(this);
            }
            state.depth++;
            try {
                return orig.apply(this, args);
            } finally {
                state.depth--;
            }
        }
        return recordCall(spec, this, args, () => orig.apply(this, args));
    };
    Object.defineProperty(wrapper, 'name', { value: orig.name });
    wrapper.__oracleOriginal = orig;
    return wrapper;
}

/**
 * Snapshot what a constructor needs to attach a recipe.
 * @param {string} cls class name
 * @param {Array} args ctor args
 * @returns {object} snapshot
 */
function ctorSnapshot(cls, args) {
    if (cls === 'Serializer' || cls === 'TypeNotFoundException') {
        // Neither carries a recipe: a Serializer is encoded from its model
        // manager, factory and default options whenever it is an input, and
        // an exception is only ever an outcome.
        return null;
    }
    state.suspended++;
    try {
        if (cls === 'ModelFile') {
            const mm = args[0];
            const r = mm && mmRecipes.get(mm);
            if (!r) {
                return null;
            }
            try {
                return {
                    mm,
                    ast: store.pack(encodePlain(args[1])),
                    definitions: encodePlain(args[2]),
                    fileName: encodePlain(args[3]),
                };
            } catch (e) {
                return { nonplain: 'modelfile-args:' + (e instanceof NonPlain ? e.reason : 'encoder-error') };
            }
        }
        let options;
        let tainted = null;
        try {
            options = args.length === 0 ? undefined : store.pack(encodePlain(args[0]));
        } catch (e) {
            tainted = 'options-nonplain:' + (e instanceof NonPlain ? e.reason : 'encoder-error');
        }
        if (args.length > 1 && args[1] !== undefined) {
            tainted = tainted || 'custom-processFile';
        }
        return { kind: cls, options, tainted };
    } finally {
        state.suspended--;
    }
}

/**
 * @param {string} cls class name
 * @param {object} obj constructed instance
 * @param {object} snap ctorSnapshot()
 * @param {boolean} nested constructed inside another op
 * @param {boolean} subclass constructed through a subclass
 */
function attachRecipe(cls, obj, snap, nested, subclass) {
    if (!snap) {
        return;
    }
    if (cls === 'ModelFile') {
        mfRecipes.set(obj, snap);
        return;
    }
    const r = { kind: snap.kind, options: snap.options, steps: [], tainted: snap.tainted, pending: nested, derived: null };
    if (subclass) {
        r.tainted = r.tainted || 'subclass';
    }
    mmRecipes.set(obj, r);
    if (nested && state.created) {
        state.created.push(obj);
    }
}

/**
 * Replace a class export by a construct-trapping Proxy.
 * @param {object} mod module exports
 * @param {string} cls class name
 * @param {object} spec op spec for "<cls>.new"
 */
function proxyClass(mod, cls, spec) {
    const Orig = mod[cls];
    const proxy = new Proxy(Orig, {
        construct(target, args, newTarget) {
            const subclass = newTarget !== proxy && newTarget !== target;
            if (state.suspended > 0) {
                return Reflect.construct(target, args, newTarget);
            }
            if (state.depth > 0) {
                const snap = ctorSnapshot(cls, args);
                state.depth++;
                let obj;
                try {
                    obj = Reflect.construct(target, args, newTarget);
                } finally {
                    state.depth--;
                }
                attachRecipe(cls, obj, snap, true, subclass);
                return obj;
            }
            return recordCall(spec, undefined, args, () => {
                const snap = ctorSnapshot(cls, args);
                const obj = Reflect.construct(target, args, newTarget);
                attachRecipe(cls, obj, snap, false, subclass);
                return obj;
            });
        },
    });
    mod[cls] = proxy;
    if (mod.default === Orig) {
        mod.default = proxy;
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

const ops = opTable(core);
for (const spec of ops.values()) {
    if (spec.kind === 'ctor') {
        continue;
    }
    for (const { holder, key } of spec.patch) {
        if (!Object.prototype.hasOwnProperty.call(holder, key) || typeof holder[key] !== 'function') {
            continue;
        }
        holder[key] = wrapFunction(spec, holder[key]);
    }
}
proxyClass(core.req('basemodelmanager'), 'BaseModelManager', ops.get('BaseModelManager.new'));
proxyClass(core.req('modelmanager'), 'ModelManager', ops.get('ModelManager.new'));
proxyClass(core.req('astmodelmanager'), 'AstModelManager', ops.get('AstModelManager.new'));
proxyClass(core.modelFileModule, 'ModelFile', ops.get('ModelFile.new'));
proxyClass(core.req('serializer'), 'Serializer', ops.get('Serializer.new'));
proxyClass(core.req('typenotfoundexception'), 'TypeNotFoundException', ops.get('TypeNotFoundException.new'));

// Test titles: every mocha runnable (test or hook) sets the current title.
try {
    const Runnable = require(require.resolve('mocha/lib/runnable', { paths: [CORE_PKG_DIR] }));
    const run = Runnable.prototype.run;
    Runnable.prototype.run = function (fn) {
        try {
            state.title = this.fullTitle();
        } catch (e) {
            state.title = this.title;
        }
        return run.call(this, fn);
    };
} catch (e) {
    // not under mocha
}

process.on('exit', () => {
    flush();
    if (rawFd !== null) {
        fs.closeSync(rawFd);
    }
    fs.writeFileSync(path.join(RAW_DIR, `${SOURCE}-${process.pid}.stats.json`), JSON.stringify(stats, null, 1));
});

module.exports = { state, stats, core, ORIGINAL_RANDOM };
