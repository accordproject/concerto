/**
 * Mocha `--require` hook (P0-02 part A, runtime half of the B/W/M tagging).
 *
 * Wraps sinon (used as `sinon.stub/spy/createStubInstance` and via
 * `sinon.createSandbox()`) so that, while the real concerto-core unit suite
 * runs, we record which tests actually created a stub/spy touching a
 * concerto-core internal (as opposed to an external collaborator such as
 * the concerto-cto Parser, FileDownloader, uuid or dayjs).
 *
 * This is reconciled by tag-tests.mjs against its own static (acorn) pass:
 * the static pass can be fooled by indirection (a stub built in a helper
 * function, a class captured in a variable under a different name); this
 * runtime pass observes what actually happened, so any test it flags is
 * upgraded to W even if the static pass missed it.
 *
 * Output: migration/tags/runtime-stub-trace.json
 *   { "<test full title>": { file, internal: [reasons...], external: [reasons...] }, ... }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sinon = require('sinon');

const OUT_FILE = path.join(__dirname, 'runtime-stub-trace.json');
const CORE_SRC = path.resolve(__dirname, '..', '..', 'packages', 'concerto-core', 'src');

// Lazily computed the first time we need it (requires the .mjs helper via
// dynamic import since this hook file is CJS).
let internalClassNamesPromise = null;
function internalClassNames() {
    if (!internalClassNamesPromise) {
        internalClassNamesPromise = import('./internal-classes.mjs').then((m) =>
            m.computeInternalClassNames(CORE_SRC)
        );
    }
    return internalClassNamesPromise;
}
// Kick it off immediately; by the time any test runs (async describe/it
// registration + mocha's own startup), this has almost certainly resolved.
// We still guard every use with a fallback empty set so nothing throws if
// it hasn't.
let INTERNAL_NAMES = new Set();
internalClassNames().then((s) => { INTERNAL_NAMES = s; }).catch(() => {});

const EXTERNAL_NAMES = new Set([
    'Parser', 'FileDownloader', 'uuid', 'Uuid', 'UUID',
    'dayjs', 'Dayjs', 'DayJS', 'Globalize',
]);

let currentTitle = null;
const results = Object.create(null);

function record(kind, reason) {
    if (!currentTitle) {
        return;
    }
    const entry = results[currentTitle] || (results[currentTitle] = { internal: [], external: [] });
    const bucket = kind === 'internal' ? entry.internal : entry.external;
    if (!bucket.includes(reason)) {
        bucket.push(reason);
    }
}

/**
 * Best-effort classification of the thing being stubbed/spied on:
 * a constructor function/class, or a plain object instance.
 */
function classify(target) {
    if (typeof target === 'function') {
        const name = target.name;
        if (EXTERNAL_NAMES.has(name)) {
            return { kind: 'external', name };
        }
        if (INTERNAL_NAMES.has(name)) {
            return { kind: 'internal', name };
        }
        return { kind: 'unknown', name };
    }
    if (target && typeof target === 'object') {
        const ctorName = target.constructor && target.constructor.name;
        if (ctorName && EXTERNAL_NAMES.has(ctorName)) {
            return { kind: 'external', name: ctorName };
        }
        if (ctorName && INTERNAL_NAMES.has(ctorName)) {
            return { kind: 'internal', name: ctorName };
        }
        return { kind: 'unknown', name: ctorName || '(object)' };
    }
    return { kind: 'unknown', name: String(target) };
}

function wrap(proto, methodName, describe) {
    const orig = proto[methodName];
    if (typeof orig !== 'function' || orig.__migrationWrapped) {
        return;
    }
    const wrapped = function (...args) {
        try {
            const target = args[0];
            const { kind, name } = classify(target);
            // `Factory.newId` stubbing: stubbing a *method named* newId
            // never counts as internal, regardless of receiver, per plan
            // §2.1 ("Factory.newId still counts as B").
            const methodArg = typeof args[1] === 'string' ? args[1] : null;
            if (methodArg === 'newId') {
                record('external', `${describe}(<Factory-like>.newId)`);
            } else if (kind === 'internal') {
                record('internal', `${describe}(${name}${methodArg ? '.' + methodArg : ''})`);
            } else if (kind === 'external') {
                record('external', `${describe}(${name}${methodArg ? '.' + methodArg : ''})`);
            }
            // kind === 'unknown': say nothing at runtime; the static pass
            // (which can see the source-level variable name) is the one
            // that gets a chance to classify these.
        } catch (e) {
            // Never let instrumentation break the actual test run.
        }
        return orig.apply(this, args);
    };
    wrapped.__migrationWrapped = true;
    proto[methodName] = wrapped;
}

// NOTE: in the installed sinon, `createSandbox()` assigns stub/spy/
// createStubInstance etc. as *own* properties of each sandbox instance
// (hasOwnProperty(sandbox, 'stub') is true; Sandbox.prototype carries none
// of them), so patching Sandbox.prototype is a no-op — confirmed by
// inspecting a sandbox created after this hook loads. To cover
// `sandbox.stub(...)` / `sandbox.spy(...)` / `sandbox.createStubInstance(...)`
// (~21 test files build a sandbox via `sinon.createSandbox()` and call
// through it, e.g. `sandbox.spy(factory, 'newResource')` in factory.js), we
// wrap the *instance* methods of every sandbox as it is created, by
// patching `sinon.createSandbox` itself.
function wrapSandboxInstance(sandbox) {
    if (!sandbox || sandbox.__migrationWrapped) {
        return sandbox;
    }
    wrap(sandbox, 'stub', 'stub');
    wrap(sandbox, 'spy', 'spy');
    wrap(sandbox, 'createStubInstance', 'createStubInstance');
    sandbox.__migrationWrapped = true;
    return sandbox;
}

// Also cover the top-level sinon.* (sinon.stub/spy/createStubInstance used
// directly, without an explicit sandbox) and Sandbox.prototype in case a
// different sinon build *does* route the default instance through it.
const defaultSandbox = sinon.createSandbox();
const SandboxProto = Object.getPrototypeOf(defaultSandbox);
wrap(SandboxProto, 'stub', 'stub');
wrap(SandboxProto, 'spy', 'spy');
wrap(SandboxProto, 'createStubInstance', 'createStubInstance');
wrapSandboxInstance(defaultSandbox);
wrap(sinon, 'stub', 'stub');
wrap(sinon, 'spy', 'spy');
wrap(sinon, 'createStubInstance', 'createStubInstance');

// Patch sinon.createSandbox so every sandbox a test creates (the common
// `const sandbox = sinon.createSandbox();` pattern, usually in beforeEach)
// gets its own-property stub/spy/createStubInstance wrapped before the test
// body runs.
if (typeof sinon.createSandbox === 'function' && !sinon.createSandbox.__migrationWrapped) {
    const origCreateSandbox = sinon.createSandbox;
    const wrappedCreateSandbox = function (...args) {
        const sb = origCreateSandbox.apply(this, args);
        return wrapSandboxInstance(sb);
    };
    wrappedCreateSandbox.__migrationWrapped = true;
    sinon.createSandbox = wrappedCreateSandbox;
}

exports.mochaHooks = {
    beforeEach() {
        currentTitle = this.currentTest && this.currentTest.fullTitle();
    },
    afterEach() {
        currentTitle = null;
    },
};

function flush() {
    try {
        fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
        fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
    } catch (e) {
        // best effort
    }
}

process.on('exit', flush);
