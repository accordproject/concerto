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
 *
 * An async op (lib/ops.js `async`, task accordproject/concerto-rust#94) is
 * recorded when its promise settles. Calls it makes after an await are
 * nested, like the calls it makes synchronously: an AsyncLocalStorage scope
 * marks everything that runs on its behalf. Its environment goes into the
 * fixture inputs: the files it reads (`fs`, relative paths only) and the HTTP
 * responses it fetched (`net`).
 */

// Freeze the clock for the whole run before anything else loads, so that
// every module, driver and test file of this process sees the frozen Date
// (lib/env.js freezeClock, accordproject/concerto-rust#131). ORIGINAL_DATE
// below is therefore the frozen Date: a test that swaps in its own (sinon
// fake timers) is still detected as a stub.
require('./env').freezeClock();

const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const { getSrcCore, SRC_ROOT, CORE_PKG_DIR, REPO_DIR } = require('./core');
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
const declRecipes = new WeakMap();
const tracker = {
    mmRecipe: (mm) => mmRecipes.get(mm) || null,
    mfRecipe: (mf) => mfRecipes.get(mf) || null,
    declRecipe: (d) => declRecipes.get(d) || null,
};

// The async op (if any) on whose behalf the current code runs.
const asyncScope = new AsyncLocalStorage();

/**
 * @returns {object|null} the recorded op the current call is nested in:
 * {spec, target, created}, or null for an outermost call
 */
function currentOp() {
    // Inside an async op's scope the op is the outer one, even in a nested
    // call made after an await (state.outer no longer names it by then).
    const scoped = asyncScope.getStore();
    if (scoped) {
        return scoped;
    }
    return state.depth > 0 ? state.outer : null;
}

/**
 * A model manager an async op creates cannot be a derived recipe (a replayed
 * recipe cannot await), but it is rebuilt from its constructor and the
 * state-changing calls the op makes on it, exactly as if the op's own code had
 * made them at the top level: each such call becomes a step of its recipe.
 * Calls made inside one of those steps are that step's own business.
 * @param {object} spec op spec of the nested call
 * @param {object} mm receiver
 * @param {Array} args arguments
 * @param {function} call performs the real call
 * @returns {object} {handled, owned, value}: handled is true when the call
 * was made here (value is its result; a throw propagates), owned when the
 * model manager is one the current async op is building
 */
function asyncBuildStep(spec, mm, args, call) {
    const r = isMM(mm) ? mmRecipes.get(mm) : null;
    if (!r || !r.asyncBuild || r.asyncBuild !== currentOp()) {
        return { handled: false };
    }
    if (r.tainted || r.inStep) {
        return { handled: false, owned: true };
    }
    if (spec.taint) {
        r.tainted = 'called:' + spec.op;
        bump(stats.tainted, spec.op, r.tainted);
        return { handled: false, owned: true };
    }
    let enc = null;
    state.suspended++;
    try {
        enc = { method: spec.method, args: portableStepArgs(spec.method, args).map((a) => store.pack(encodeIn(a, newCtx(mm)))) };
    } catch (e) {
        r.tainted = e instanceof NonPlain ? 'step-nonplain:' + e.reason : 'step-encoder-error:' + String(e && e.message).slice(0, 60);
        bump(stats.tainted, spec.op, r.tainted);
    } finally {
        state.suspended--;
    }
    if (!enc) {
        return { handled: false, owned: true };
    }
    r.inStep = true;
    state.depth++;
    let value;
    try {
        value = call();
    } catch (e) {
        r.steps.push({ enc: Object.assign(enc, { status: 'error', errorClass: errClass(e) }) });
        throw e;
    } finally {
        state.depth--;
        r.inStep = false;
    }
    r.steps.push({ enc: Object.assign(enc, { status: 'ok', errorClass: null }) });
    return { handled: true, value };
}
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
    const outer = currentOp();
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
                    stepEnc = { method: spec.method, args: portableStepArgs(spec.method, args).map((a) => store.pack(encodeIn(a, newCtx(mmTarget)))) };
                } catch (e) {
                    stepTaint = e instanceof NonPlain ? 'step-nonplain:' + e.reason : 'step-encoder-error:' + String(e && e.message).slice(0, 60);
                } finally {
                    state.suspended--;
                }
            }
        }
    }

    // The environment of an async op: the files it reads.
    let envFiles = null;
    if (!skip && spec.envFiles) {
        const r = captureFiles(spec.envFiles(args));
        if (r.skip) {
            skip = r.skip;
        } else {
            envFiles = r.files;
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
    const opCtx = { spec, target, created: [] };
    state.outer = opCtx;
    state.created = opCtx.created;
    const rnd = seededRandom();
    const net = spec.async ? captureNetwork() : null;
    let result;
    let error;
    let threw = false;
    const start = Date.now();
    state.depth++;
    try {
        result = spec.async ? asyncScope.run(opCtx, invoke) : invoke();
    } catch (e) {
        threw = true;
        error = e;
    } finally {
        state.depth--;
    }
    state.outer = savedOuter;
    state.created = savedCreated;

    /**
     * Record the call once it has finished (for an async op: settled).
     * @param {boolean} failed the call threw, or its promise rejected
     * @param {*} value result or error
     * @param {number} end ms when it finished
     * @returns {*} value (or throws it)
     */
    const finish = (failed, value, end) => {
        const randomUsed = rnd.restore();
        const netResult = net ? net.stop() : null;
        const res = failed ? undefined : value;
        const created = opCtx.created;

        let stepTaintNow = stepTaint;
        if (!failed && res && typeof res.then === 'function') {
            skip = skip || 'async-result';
            if (mmTarget) {
                stepTaintNow = stepTaintNow || 'async';
            }
        }
        if (!skip && netResult && netResult.error) {
            skip = 'network-error';
        }

        for (const mm of created) {
            const r = mmRecipes.get(mm);
            if (!r || !r.pending) {
                continue;
            }
            r.pending = false;
            if (r.asyncBuild === opCtx) {
                // rebuilt from its constructor and the steps recorded while
                // the async op ran (asyncBuildStep); never derived
                r.asyncBuild = null;
                continue;
            }
            // a replayed recipe cannot await, so an async op never derives one
            const where = failed || spec.async ? null : findPath(res, mm);
            if (where && !skip && spec.kind !== 'ctor') {
                r.derived = { op, inputs: packedInputs };
                if (where.length > 0) {
                    r.derived.path = where;
                }
            } else if (!(spec.kind === 'ctor' && res === mm)) {
                r.tainted = r.tainted || ('created-inside:' + op);
                bump(stats.tainted, op, r.tainted);
            }
        }

        if (mmTarget) {
            const r = mmRecipes.get(mmTarget);
            if (r && !r.tainted) {
                if (stepTaintNow) {
                    r.tainted = stepTaintNow;
                    bump(stats.tainted, op, stepTaintNow);
                } else if (stepEnc) {
                    r.steps.push({
                        enc: {
                            method: stepEnc.method,
                            args: stepEnc.args,
                            status: failed ? 'error' : 'ok',
                            errorClass: failed ? errClass(value) : null,
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
                let recInputs = packedInputs;
                let recFacts = facts;
                if (spec.async) {
                    const withEnv = Object.assign({}, inputs);
                    if (envFiles) {
                        withEnv.fs = envFiles;
                    }
                    if (netResult && Object.keys(netResult.net).length > 0) {
                        withEnv.net = netResult.net;
                    }
                    recInputs = store.pack(withEnv, { root: false });
                    recFacts = store.facts(recInputs);
                }
                const outcome = failed ? { error: encodeError(value) } : { ok: encodeOut(res) };
                const effects = {};
                if (spec.mutatesTarget && (target instanceof core.Typed || target instanceof core.BaseModelManager)) {
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
                const canonical = canonicalise(outcome, recFacts, { start, end });
                const rec = {
                    source: SOURCE,
                    source_test: state.title,
                    op,
                    inputs: recInputs,
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

        if (failed) {
            throw value;
        }
        return value;
    };

    if (spec.async && !threw && result && typeof result.then === 'function') {
        return Promise.resolve(result).then(
            (v) => finish(false, v, Date.now()),
            (e) => finish(true, e, Date.now()));
    }
    return finish(threw, threw ? error : result, Date.now());
}

/**
 * Read the files an async op will read (lib/ops.js `envFiles`), for
 * inputs.fs. Only relative paths inside the working directory are portable.
 * A path that does not exist is left out: the op's own error is the outcome.
 * @param {string[]} paths paths as the op receives them
 * @returns {object} {files: contents by path, or null} or {skip: reason}
 */
function captureFiles(paths) {
    const files = {};
    for (const p of paths) {
        if (p === '' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) {
            return { skip: 'nonportable-path' };
        }
        let content;
        try {
            content = fs.readFileSync(p, 'utf8');
        } catch (e) {
            continue;
        }
        files[p] = content;
    }
    return { files: Object.keys(files).length > 0 ? files : null };
}

/**
 * Capture every HTTP response an async op fetches, for inputs.net. The
 * current global.fetch is wrapped for the duration of the op, so a
 * driver may serve its own responses; a fetch that fails (no response at
 * all) makes the call unrecordable ('network-error').
 * @returns {object} {stop()}: stop() restores fetch and returns {net, error}
 */
function captureNetwork() {
    const prev = global.fetch;
    const net = {};
    let error = null;
    global.fetch = async function (url, options) {
        const key = String(url && typeof url === 'object' && 'href' in url ? url.href : (url && typeof url === 'object' && 'url' in url ? url.url : url));
        let res;
        try {
            res = await prev.call(this, url, options);
        } catch (e) {
            error = error || String(e && e.message || e);
            throw e;
        }
        try {
            net[key] = { status: res.status, body: await res.clone().text() };
        } catch (e) {
            error = error || 'unreadable body: ' + String(e && e.message || e);
        }
        return res;
    };
    return {
        stop() {
            global.fetch = prev;
            return { net, error };
        },
    };
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
        if (state.depth > 0 || asyncScope.getStore()) {
            if (spec.step || spec.taint) {
                const b = asyncBuildStep(spec, this, args, () => orig.apply(this, args));
                if (b.handled) {
                    return b.value;
                }
                if (!b.owned) {
                    noteNestedMutation(this);
                }
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

// Checkout roots a recorded fileName may fall under. An absolute path is not
// portable across machines or worktrees (task accordproject/concerto-rust#113:
// two independent recordings of the same commit landed in different
// worktrees, so an absolute fileName baked one worktree's path into the
// fixture content and its id). CONFORMANCE_DIR matches the env var
// drivers/conformance.spec.js reads, so both agree on the checkout location.
const CONFORMANCE_DIR = process.env.CONFORMANCE_DIR || '/home/user/concerto-conformance';
const PORTABLE_ROOTS = [
    { label: 'repo', dir: REPO_DIR },
    { label: 'conformance', dir: CONFORMANCE_DIR },
];

/**
 * Make a `fileName` constructor argument portable: a relative path is
 * already portable and passes through unchanged; an absolute path under a
 * known checkout root is rewritten relative to that root as `<label>/...`
 * (forward slashes, so it is also stable across POSIX/Windows). An absolute
 * path outside every known root cannot be made portable.
 * @param {*} fileName the raw fileName argument (usually a string, or undefined)
 * @returns {*} a portable fileName, unchanged when it is not an absolute path
 * @throws {NonPlain} 'nonportable-path' when an absolute path matches no known root
 */
function portableFileName(fileName) {
    if (typeof fileName !== 'string' || !path.isAbsolute(fileName)) {
        return fileName;
    }
    for (const { label, dir } of PORTABLE_ROOTS) {
        const rel = path.relative(dir, fileName);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
            return `<${label}>/${rel.split(path.sep).join('/')}`;
        }
    }
    throw new NonPlain('nonportable-path');
}

// Argument positions that may carry a fileName string, for the model-manager
// step methods that take one. Mostly the same call shapes as
// bin/build-cto-cache.js's CTO_ENTRY_POINTS (which does not need
// `addModelFile` since it never hands a string to the CTO parser); but
// `addModelFile(modelFile, cto?, fileName?, disableValidation?)` still takes
// a plain fileName as its third argument, purely for record-keeping, and
// that leaked an absolute path into a fixture too (task
// accordproject/concerto-rust#113: `ModelLoader.loadModelManager` passes the
// caller's own absolute path straight through to `addModelFile`).
const FILENAME_ARG_INDEX = { addCTOModel: 1, addModel: 2, addModelFile: 2, updateModelFile: 1, validateModelFile: 1 };

/**
 * Make a model-manager step's arguments portable: rewrite the fileName
 * argument (if the method takes one, and a string was given) the same way
 * a ModelFile constructor's is (`portableFileName`), so a step recorded into
 * a ModelManager's recipe (and later embedded verbatim in any fixture whose
 * input is that manager) never bakes in an absolute, machine-specific path.
 * @param {string} method the ModelManager method name (spec.method)
 * @param {Array} args the raw call arguments
 * @returns {Array} args, copied only when a rewrite is needed
 * @throws {NonPlain} propagated from portableFileName for a nonportable path
 */
function portableStepArgs(method, args) {
    if (method === 'addModelFiles' && Array.isArray(args[1])) {
        const out = args.slice();
        out[1] = args[1].map((f) => portableFileName(f));
        return out;
    }
    const idx = FILENAME_ARG_INDEX[method];
    if (idx === undefined || typeof args[idx] !== 'string') {
        return args;
    }
    const out = args.slice();
    out[idx] = portableFileName(args[idx]);
    return out;
}

/**
 * Snapshot what a constructor needs to attach a recipe.
 * @param {string} cls class name
 * @param {Array} args ctor args
 * @param {boolean} [nested] constructed inside another op
 * @returns {object} snapshot
 */
function ctorSnapshot(cls, args, nested) {
    if (cls === 'Serializer' || cls === 'TypeNotFoundException') {
        // Neither carries a recipe: a Serializer is encoded from its model
        // manager, factory and default options whenever it is an input, and
        // an exception is only ever an outcome.
        return null;
    }
    if (cls === 'ScalarDeclaration') {
        // Only a declaration built by the recorded constructor op carries a
        // recipe (declnew); one a model file builds is found in its model file.
        if (nested) {
            return null;
        }
        state.suspended++;
        try {
            return { cls, mf: args[0], ast: store.pack(encodePlain(args[1])) };
        } catch (e) {
            return null;
        } finally {
            state.suspended--;
        }
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
                    fileName: encodePlain(portableFileName(args[3])),
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
    if (cls === 'ScalarDeclaration') {
        if (!subclass) {
            declRecipes.set(obj, snap);
        }
        return;
    }
    const r = { kind: snap.kind, options: snap.options, steps: [], tainted: snap.tainted, pending: nested, derived: null };
    if (subclass) {
        r.tainted = r.tainted || 'subclass';
    }
    mmRecipes.set(obj, r);
    const outer = nested ? currentOp() : null;
    if (outer) {
        outer.created.push(obj);
        if (outer.spec.async) {
            r.asyncBuild = outer;
        }
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
            if (state.depth > 0 || asyncScope.getStore()) {
                const snap = ctorSnapshot(cls, args, true);
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
proxyClass(core.req('introspect/scalardeclaration'), 'ScalarDeclaration', ops.get('ScalarDeclaration.new'));

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
