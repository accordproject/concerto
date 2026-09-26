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
 * Language-neutral encoding of op inputs and outcomes (see README.md,
 * "Value encoding").
 *
 * Plain JSON passes through unchanged. Anything else is written as an object
 * whose "@@oracle" key names the kind of value:
 *
 *   inputs  (decodable):  undefined, number, bigint, date, regexp, map, set,
 *                         dayjs, mm, mmref, self, mfref, mfnew, declref,
 *                         declnew, propref, factory, serializer, typed, blob,
 *                         predicate, decoratorfactory, visitor, errnew
 *   outputs (summaries):  the same scalar kinds plus ModelManager, ModelFile,
 *                         Declaration, Property, typed (without handles),
 *                         object, function
 *
 * Handles (model managers, model files, declarations, properties, factories,
 * serializers, resources) are encoded as *recipes*: the public API calls that
 * rebuild an equivalent object from plain data. A model manager's recipe is
 * its constructor options plus the ordered list of state-changing public
 * calls made on it (its "steps"), or the op whose result it was ("derived").
 */

const M = '@@oracle';
const encodable = require('./encodable');

/** Thrown when a value cannot be expressed as plain data. */
class NonPlain extends Error {
    /**
     * @param {string} reason short machine-readable reason
     */
    constructor(reason) {
        super(reason);
        this.reason = reason;
    }
}

/** Thrown by the decoder when the harness itself cannot build an input. */
class HarnessError extends Error {}

const TYPED_INTERNAL = new Set([
    '$modelManager', '$classDeclaration', '$namespace', '$type',
    '$identifierFieldName', '$identifier', '$timestamp', '$validator',
]);

/**
 * @param {*} fn value
 * @returns {boolean} true for any sinon spy/stub/fake
 */
function isSinonProxy(fn) {
    return typeof fn === 'function' && fn.isSinonProxy === true;
}

/**
 * @param {*} fn value
 * @returns {boolean} true for a sinon stub/fake that can change behaviour
 */
function isSinonStub(fn) {
    return isSinonProxy(fn) && typeof fn.returns === 'function';
}

/**
 * Own properties of an object that are sinon stubs.
 * @param {object} obj object
 * @returns {string|null} name of the first stubbed own property
 */
function ownStub(obj) {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
        return null;
    }
    const proto = Object.getPrototypeOf(obj);
    for (const k of Object.getOwnPropertyNames(obj)) {
        const d = Object.getOwnPropertyDescriptor(obj, k);
        if (!d || !('value' in d)) {
            continue;
        }
        if (isSinonStub(d.value)) {
            return k;
        }
        // a plain function assigned over a method (e.g. mm.getType = () => null)
        if (typeof d.value === 'function' && proto && typeof proto === 'object' && typeof proto[k] === 'function' &&
            proto[k] !== d.value && typeof obj !== 'function') {
            return k;
        }
    }
    return null;
}

/**
 * @param {*} v value
 * @returns {boolean} duck-typed dayjs instance
 */
function isDayjsLike(v) {
    return v && typeof v === 'object' && typeof v.isValid === 'function' &&
        typeof v.utcOffset === 'function' && typeof v.isBefore === 'function' && v.$d instanceof Date;
}

/**
 * @param {*} v value
 * @returns {boolean} plain object
 */
function isPlainObject(v) {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null;
}

/**
 * Scalars shared by both encodings. Returns undefined when v is not a
 * special scalar.
 * @param {*} v value
 * @returns {*} encoding or undefined
 */
function encodeScalar(v) {
    if (v === undefined) {
        return { [M]: 'undefined' };
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
        return { [M]: 'number', value: String(v) };
    }
    if (typeof v === 'number' && Object.is(v, -0)) {
        return { [M]: 'number', value: '-0' };
    }
    if (typeof v === 'bigint') {
        return { [M]: 'bigint', value: v.toString() };
    }
    if (v instanceof Date) {
        return { [M]: 'date', iso: Number.isNaN(v.getTime()) ? null : v.toISOString() };
    }
    if (v instanceof RegExp) {
        return { [M]: 'regexp', source: v.source, flags: v.flags };
    }
    if (isDayjsLike(v)) {
        const valid = v.isValid();
        return {
            [M]: 'dayjs',
            valid,
            iso: valid ? v.toISOString() : null,
            offset: valid ? v.utcOffset() : null,
            utc: typeof v.isUTC === 'function' ? v.isUTC() : false,
        };
    }
    return undefined;
}

/**
 * Deep plain-JSON snapshot of a value that must not contain handles.
 * @param {*} v value
 * @param {Set} [stack] cycle guard
 * @returns {*} encoding
 */
function encodePlain(v, stack = new Set()) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') {
        return v;
    }
    const s = encodeScalar(v);
    if (s !== undefined) {
        return s;
    }
    if (typeof v === 'number') {
        return v;
    }
    if (typeof v === 'function') {
        throw new NonPlain(isSinonProxy(v) ? 'sinon-function' : 'function');
    }
    if (typeof v === 'symbol') {
        throw new NonPlain('symbol');
    }
    if (stack.has(v)) {
        throw new NonPlain('cycle');
    }
    stack.add(v);
    try {
        if (Array.isArray(v)) {
            const out = [];
            for (let i = 0; i < v.length; i++) {
                out.push(encodePlain(v[i], stack));
            }
            return out;
        }
        if (v instanceof Map) {
            return { [M]: 'map', entries: [...v.entries()].map(([k, x]) => [encodePlain(k, stack), encodePlain(x, stack)]) };
        }
        if (v instanceof Set) {
            return { [M]: 'set', values: [...v.values()].map((x) => encodePlain(x, stack)) };
        }
        if (isPlainObject(v)) {
            if (Object.prototype.hasOwnProperty.call(v, M)) {
                throw new NonPlain('marker-collision');
            }
            const out = {};
            for (const k of Object.keys(v)) {
                out[k] = encodePlain(v[k], stack);
            }
            return out;
        }
        throw new NonPlain('instance:' + ((v.constructor && v.constructor.name) || 'Object'));
    } finally {
        stack.delete(v);
    }
}

/**
 * Create an input encoder bound to one core module set and a tracker.
 *
 * The tracker supplies what was observed at construction time:
 *   tracker.mmRecipe(mm)  -> {kind, options, derived, steps, tainted} | null
 *   tracker.mfRecipe(mf)  -> {mm, ast, definitions, fileName} | null
 *   tracker.declRecipe(d) -> {cls, mf, ast} | null   (optional; declarations
 *                            built by a recorded constructor op)
 *   tracker.errRecipe(e)  -> {cls, args} | null      (optional, task P2-11b;
 *                            an exception built from plain arguments)
 *
 * @param {object} core module set (lib/core.js)
 * @param {object} tracker recorder tracker
 * @returns {function} encode(value, ctx)
 */
function makeInputEncoder(core, tracker) {
    const encMM = (mm, ctx) => {
        if (ctx.self === mm) {
            return { [M]: 'self' };
        }
        if (ctx.mmIds.has(mm)) {
            return { [M]: 'mmref', id: ctx.mmIds.get(mm) };
        }
        const recipe = tracker.mmRecipe(mm);
        if (!recipe) {
            throw new NonPlain('untracked-modelmanager');
        }
        if (recipe.tainted) {
            throw new NonPlain('tainted-modelmanager:' + recipe.tainted);
        }
        const stub = ownStub(mm);
        if (stub) {
            throw new NonPlain('stubbed-instance:ModelManager.' + stub);
        }
        const id = ctx.mmIds.size;
        ctx.mmIds.set(mm, id);
        const node = { [M]: 'mm', id, kind: recipe.kind };
        if (recipe.derived) {
            node.derived = recipe.derived;
        } else {
            node.options = recipe.options;
        }
        node.steps = recipe.steps.map((s) => s.enc);
        return node;
    };

    const encMF = (mf, ctx) => {
        const stub = ownStub(mf);
        if (stub) {
            throw new NonPlain('stubbed-instance:ModelFile.' + stub);
        }
        const mm = mf.modelManager;
        if (mm && typeof mm.getModelFile === 'function' && tracker.mmRecipe(mm)) {
            let ns;
            try {
                ns = mf.getNamespace();
            } catch (e) {
                ns = undefined;
            }
            if (ns !== undefined && mm.modelFiles && mm.modelFiles[ns] === mf) {
                return { [M]: 'mfref', mm: encMM(mm, ctx), ns };
            }
        }
        const r = tracker.mfRecipe(mf);
        if (!r) {
            throw new NonPlain('untracked-modelfile');
        }
        if (r.nonplain) {
            throw new NonPlain(r.nonplain);
        }
        return { [M]: 'mfnew', mm: encMM(r.mm, ctx), ast: r.ast, definitions: r.definitions, fileName: r.fileName };
    };

    const encDecl = (d, ctx) => {
        const stub = ownStub(d);
        if (stub) {
            throw new NonPlain('stubbed-instance:Declaration.' + stub);
        }
        const mf = d.modelFile;
        if (!mf || typeof mf.getAllDeclarations !== 'function') {
            throw new NonPlain('declaration-without-modelfile');
        }
        const all = mf.getAllDeclarations();
        const idx = Array.isArray(all) ? all.indexOf(d) : -1;
        if (idx < 0) {
            // A declaration built by a recorded constructor op (task
            // accordproject/concerto-rust#94: ScalarDeclaration.new) is
            // rebuilt from its model file and AST.
            const r = typeof tracker.declRecipe === 'function' ? tracker.declRecipe(d) : null;
            if (r && r.mf === mf) {
                return { [M]: 'declnew', cls: r.cls, mf: encMF(mf, ctx), ast: r.ast };
            }
            throw new NonPlain('declaration-not-in-modelfile');
        }
        return { [M]: 'declref', mf: encMF(mf, ctx), index: idx, name: d.getName() };
    };

    const encProp = (p, ctx) => {
        const stub = ownStub(p);
        if (stub) {
            throw new NonPlain('stubbed-instance:Property.' + stub);
        }
        const parent = p.parent;
        if (!parent || !(parent instanceof core.Declaration)) {
            throw new NonPlain('property-without-parent');
        }
        if (p instanceof core.MapKeyType) {
            if (parent.getKey() !== p) {
                throw new NonPlain('mapkey-not-in-parent');
            }
            return { [M]: 'propref', decl: encDecl(parent, ctx), part: 'key' };
        }
        if (p instanceof core.MapValueType) {
            if (parent.getValue() !== p) {
                throw new NonPlain('mapvalue-not-in-parent');
            }
            return { [M]: 'propref', decl: encDecl(parent, ctx), part: 'value' };
        }
        const props = typeof parent.getOwnProperties === 'function' ? parent.getOwnProperties() : [];
        const idx = Array.isArray(props) ? props.indexOf(p) : -1;
        if (idx < 0) {
            throw new NonPlain('property-not-in-parent');
        }
        return { [M]: 'propref', decl: encDecl(parent, ctx), index: idx, name: p.getName() };
    };

    // An instance is snapshotted structurally: its class, its handles
    // ($modelManager, $classDeclaration, $validator) and every other own
    // property in insertion order. Decoding rebuilds exactly that state without
    // re-running constructors, so the snapshot does not depend on the model
    // manager still being able to resolve its type.
    const encTyped = (t, ctx, enc) => {
        const stub = ownStub(t);
        if (stub) {
            throw new NonPlain('stubbed-instance:Typed.' + stub);
        }
        const ctorName = t.constructor && t.constructor.name;
        if (!['Resource', 'ValidatedResource', 'Relationship'].includes(ctorName)) {
            throw new NonPlain('typed-class:' + ctorName);
        }
        const node = {
            [M]: 'typed',
            ctor: ctorName,
            mm: encMM(t.$modelManager, ctx),
            decl: encDecl(t.$classDeclaration, ctx),
        };
        if ('$validator' in t) {
            const v = t.$validator;
            if (!v || !v.constructor || v.constructor.name !== 'ResourceValidator' || ownStub(v)) {
                throw new NonPlain('validator');
            }
            node.validatorOptions = enc(v.options);
        }
        const keys = Object.keys(t);
        const fields = {};
        for (const k of keys) {
            if (k !== '$modelManager' && k !== '$classDeclaration' && k !== '$validator') {
                fields[k] = enc(t[k]);
            }
        }
        node.keys = keys;
        node.fields = fields;
        return node;
    };

    /**
     * @param {*} v value
     * @param {object} ctx encoding session {mmIds: Map, self?: mm, stack: Set}
     * @returns {*} encoding
     */
    function encode(v, ctx) {
        if (v === null || typeof v === 'boolean' || typeof v === 'string') {
            return v;
        }
        const s = encodeScalar(v);
        if (s !== undefined) {
            return s;
        }
        if (typeof v === 'number') {
            return v;
        }
        if (typeof v === 'function') {
            // A predicate built by lib/encodable.js (task
            // accordproject/concerto-rust#94); any other function is code.
            const enc = encodable.encodingOf(v);
            if (enc && enc[M] === 'predicate') {
                return enc;
            }
            throw new NonPlain(isSinonProxy(v) ? 'sinon-function' : 'function');
        }
        if (typeof v === 'symbol') {
            throw new NonPlain('symbol');
        }
        if (ctx.stack.has(v)) {
            throw new NonPlain('cycle');
        }
        ctx.stack.add(v);
        const enc = (x) => encode(x, ctx);
        try {
            if (Array.isArray(v)) {
                const out = [];
                for (let i = 0; i < v.length; i++) {
                    out.push(enc(v[i]));
                }
                return out;
            }
            // A visitor built by lib/encodable.js (task P2-11b); any other
            // visitor is code, and fails below as a function or instance.
            const encV = encodable.encodingOf(v);
            if (encV && encV[M] === 'visitor') {
                return encV;
            }
            if (isPlainObject(v)) {
                if (Object.prototype.hasOwnProperty.call(v, M)) {
                    throw new NonPlain('marker-collision');
                }
                const out = {};
                for (const k of Object.keys(v)) {
                    out[k] = enc(v[k]);
                }
                return out;
            }
            if (v instanceof Map) {
                return { [M]: 'map', entries: [...v.entries()].map(([k, x]) => [enc(k), enc(x)]) };
            }
            if (v instanceof Set) {
                return { [M]: 'set', values: [...v.values()].map(enc) };
            }
            if (v instanceof core.Typed) {
                return encTyped(v, ctx, enc);
            }
            if (v instanceof Error) {
                // An exception as an input (task P2-11b: the receiver of
                // TypeNotFoundException.getTypeName) is rebuilt by its
                // constructor from the plain arguments it was built with.
                const r = typeof tracker.errRecipe === 'function' ? tracker.errRecipe(v) : null;
                if (!r || ownStub(v)) {
                    throw new NonPlain('error:' + ((v.constructor && v.constructor.name) || 'Error'));
                }
                return { [M]: 'errnew', cls: r.cls, args: r.args };
            }
            if (v instanceof core.BaseModelManager) {
                return encMM(v, ctx);
            }
            if (v instanceof core.ModelFile) {
                return encMF(v, ctx);
            }
            if (v instanceof core.Declaration) {
                return encDecl(v, ctx);
            }
            if (v instanceof core.Property || v instanceof core.MapKeyType || v instanceof core.MapValueType) {
                return encProp(v, ctx);
            }
            if (v instanceof core.Decorator) {
                if (ownStub(v)) {
                    throw new NonPlain('stubbed-instance:Decorator');
                }
                const parent = v.parent;
                const list = parent && typeof parent.getDecorators === 'function' ? parent.getDecorators() : [];
                const idx = Array.isArray(list) ? list.indexOf(v) : -1;
                if (idx < 0) {
                    throw new NonPlain('decorator-not-in-parent');
                }
                return { [M]: 'decoref', parent: enc(parent), index: idx };
            }
            if (v instanceof core.Validator) {
                if (ownStub(v)) {
                    throw new NonPlain('stubbed-instance:Validator');
                }
                const owner = v.field;
                if (!owner || typeof owner !== 'object') {
                    throw new NonPlain('validator-without-owner');
                }
                let part = null;
                if (typeof owner.getValidator === 'function' && owner.getValidator() === v) {
                    part = 'validator';
                } else if (typeof owner.getSizeValidator === 'function' && owner.getSizeValidator() === v) {
                    part = 'size';
                }
                if (!part) {
                    throw new NonPlain('validator-not-in-owner');
                }
                return { [M]: 'validatorref', owner: enc(owner), part };
            }
            if (v instanceof core.Introspector) {
                if (ownStub(v)) {
                    throw new NonPlain('stubbed-instance:Introspector');
                }
                return { [M]: 'introspector', mm: encMM(v.modelManager, ctx) };
            }
            if (v instanceof core.Factory) {
                if (ownStub(v)) {
                    throw new NonPlain('stubbed-instance:Factory');
                }
                return { [M]: 'factory', mm: encMM(v.modelManager, ctx) };
            }
            if (v instanceof core.Serializer) {
                if (ownStub(v)) {
                    throw new NonPlain('stubbed-instance:Serializer');
                }
                if (!(v.factory instanceof core.Factory)) {
                    throw new NonPlain('serializer-factory');
                }
                return {
                    [M]: 'serializer',
                    mm: encMM(v.modelManager, ctx),
                    factory: enc(v.factory),
                    defaultOptions: enc(v.defaultOptions),
                };
            }
            if (core.DecoratorFactory && v instanceof core.DecoratorFactory) {
                // task accordproject/concerto-rust#94: a factory built by
                // lib/encodable.js, or the exported base class itself.
                const encF = encodable.encodingOf(v);
                if (encF && encF[M] === 'decoratorfactory') {
                    return encF;
                }
                if (Object.getPrototypeOf(v) === core.DecoratorFactory.prototype && Object.getOwnPropertyNames(v).length === 0) {
                    return { [M]: 'decoratorfactory', kind: 'base' };
                }
                throw new NonPlain('decoratorfactory:' + ((v.constructor && v.constructor.name) || 'Object'));
            }
            throw new NonPlain('instance:' + ((v.constructor && v.constructor.name) || 'Object'));
        } finally {
            ctx.stack.delete(v);
        }
    }
    return encode;
}

/**
 * @param {object} [self] model manager bound to the "self" marker
 * @returns {object} a fresh encoding session
 */
function newCtx(self) {
    return { mmIds: new Map(), self, stack: new Set() };
}

/**
 * Output (result) encoding: summaries of handles, full dumps of instances.
 * @param {object} core module set
 * @returns {function} encodeOut(value)
 */
function makeOutputEncoder(core) {
    const encodeOut = (v, stack = new Set()) => {
        if (v === null || typeof v === 'boolean' || typeof v === 'string') {
            return v;
        }
        const s = encodeScalar(v);
        if (s !== undefined) {
            return s;
        }
        if (typeof v === 'number') {
            return v;
        }
        if (typeof v === 'function') {
            return { [M]: 'function' };
        }
        if (typeof v === 'symbol') {
            return { [M]: 'symbol', value: String(v) };
        }
        if (stack.has(v)) {
            return { [M]: 'cycle' };
        }
        stack.add(v);
        const enc = (x) => encodeOut(x, stack);
        try {
            if (Array.isArray(v)) {
                const out = [];
                for (let i = 0; i < v.length; i++) {
                    out.push(enc(v[i]));
                }
                return out;
            }
            if (isPlainObject(v)) {
                const out = {};
                for (const k of Object.keys(v)) {
                    out[k] = enc(v[k]);
                }
                return out;
            }
            if (v instanceof Map) {
                return { [M]: 'map', entries: [...v.entries()].map(([k, x]) => [enc(k), enc(x)]) };
            }
            if (v instanceof Set) {
                return { [M]: 'set', values: [...v.values()].map(enc) };
            }
            if (v instanceof core.Typed) {
                const node = {
                    [M]: 'typed',
                    ctor: v.constructor.name,
                    fqn: safe(() => v.getFullyQualifiedType()),
                    ns: enc(v.$namespace),
                    type: enc(v.$type),
                    id: enc(v.$identifier),
                    timestamp: enc(v.$timestamp),
                };
                const fields = {};
                for (const k of Object.keys(v)) {
                    if (!TYPED_INTERNAL.has(k)) {
                        fields[k] = enc(v[k]);
                    }
                }
                node.fields = fields;
                return node;
            }
            if (v instanceof core.BaseModelManager) {
                return {
                    [M]: 'ModelManager',
                    ctor: v.constructor.name,
                    namespaces: safe(() => v.getNamespaces()),
                    ast: safe(() => enc(v.getAst(false, true))),
                };
            }
            if (v instanceof core.ModelFile) {
                return {
                    [M]: 'ModelFile',
                    namespace: safe(() => v.getNamespace()),
                    name: safe(() => enc(v.getName())),
                    ast: safe(() => enc(v.getAst())),
                };
            }
            if (v instanceof core.Declaration) {
                return { [M]: 'Declaration', ctor: v.constructor.name, fqn: safe(() => v.getFullyQualifiedName()) };
            }
            if (v instanceof core.Property) {
                return { [M]: 'Property', ctor: v.constructor.name, fqn: safe(() => v.getFullyQualifiedName()) };
            }
            if (v instanceof core.MapKeyType || v instanceof core.MapValueType) {
                return { [M]: 'Property', ctor: v.constructor.name, type: safe(() => v.getType()) };
            }
            if (v instanceof core.Decorator) {
                return { [M]: 'Decorator', name: safe(() => v.getName()), arguments: safe(() => enc(v.getArguments())) };
            }
            if (v instanceof core.Validator) {
                return { [M]: 'Validator', ctor: v.constructor.name };
            }
            if (v instanceof core.Introspector) {
                return { [M]: 'Introspector' };
            }
            if (v instanceof Error) {
                return { [M]: 'error', error: encodeError(v) };
            }
            return { [M]: 'object', ctor: (v.constructor && v.constructor.name) || 'Object' };
        } finally {
            stack.delete(v);
        }
    };
    return encodeOut;
}

/**
 * Evaluate, turning a throw into a marker.
 * @param {function} f thunk
 * @returns {*} value or {"@@oracle":"throws"}
 */
function safe(f) {
    try {
        return f();
    } catch (e) {
        return { [M]: 'throws', class: e && e.constructor ? e.constructor.name : typeof e, message: e && e.message };
    }
}

/**
 * The error part of an outcome.
 * @param {*} err thrown value
 * @returns {object} {class, message, location, component}
 */
function encodeError(err) {
    if (!(err instanceof Error)) {
        return { class: typeof err, message: String(err), location: null, component: null };
    }
    let location = err.fileLocation;
    if (location === undefined && typeof err.getFileLocation === 'function') {
        location = err.getFileLocation();
    }
    return {
        class: err.constructor ? err.constructor.name : 'Error',
        message: err.message,
        location: location === undefined ? null : encodePlainSafe(location),
        component: err.component === undefined ? null : err.component,
    };
}

/**
 * @param {*} v value
 * @returns {*} encodePlain or a marker
 */
function encodePlainSafe(v) {
    try {
        return encodePlain(v);
    } catch (e) {
        return { [M]: 'object' };
    }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * Create a decoder for one engine core.
 * @param {object} core module set
 * @param {function} runDerived (op, inputs) -> raw result, used for derived model managers
 * @returns {function} decode(value, dctx)
 */
function makeDecoder(core, runDerived) {
    // Every call below into the engine's own public API (a constructor or
    // accessor of `core`) goes through engineCall(): an error it throws is
    // tagged `decodeConstruct = true` and rethrown unchanged (same object,
    // class and message), so a caller that wants to treat an engine
    // rejection raised while the inputs are being decoded as part of the
    // op's outcome (task P5-05's fuzz worker, whose mutated documents reach
    // these calls) can tell it apart from a genuine harness failure — a
    // HarnessError or a replay "state divergence", which are never tagged.
    // Callers that don't look for the tag see exactly the previous
    // behaviour: the same error, thrown the same way.
    const engineCall = (f) => {
        try {
            return f();
        } catch (e) {
            if (e instanceof Error && !(e instanceof HarnessError) && !e.divergence) {
                e.decodeConstruct = true;
            }
            throw e;
        }
    };

    const decodeMM = (node, dctx) => {
        let mm;
        if (node.derived) {
            mm = runDerived(node.derived.op, node.derived.inputs);
            for (const k of node.derived.path || []) {
                mm = mm === null || mm === undefined ? mm : mm[k];
            }
            if (!mm || typeof mm.isModelManager !== 'function') {
                throw new HarnessError('derived model manager: op ' + node.derived.op + ' did not return a model manager');
            }
        } else {
            const Cls = { ModelManager: core.ModelManager, BaseModelManager: core.BaseModelManager, AstModelManager: core.AstModelManager }[node.kind];
            if (!Cls) {
                throw new HarnessError('unknown model manager kind ' + node.kind);
            }
            const options = node.options === undefined ? undefined : decode(node.options, { mms: new Map() });
            mm = engineCall(() => (node.options === undefined ? new Cls() : new Cls(options)));
        }
        dctx.mms.set(node.id, mm);
        for (const step of node.steps || []) {
            const sctx = { mms: new Map(), self: mm };
            const args = step.args.map((a) => decode(a, sctx));
            let status = 'ok';
            let errClass = null;
            try {
                mm[step.method](...args);
            } catch (e) {
                status = 'error';
                errClass = e && e.constructor ? e.constructor.name : typeof e;
            }
            if (status !== step.status || (status === 'error' && errClass !== step.errorClass)) {
                const err = new Error(`state divergence: step ${step.method} recorded ${step.status}${step.errorClass ? '(' + step.errorClass + ')' : ''}, replayed ${status}${errClass ? '(' + errClass + ')' : ''}`);
                err.divergence = true;
                throw err;
            }
        }
        return mm;
    };

    const decodeMF = (node, dctx) => {
        const mm = decode(node.mm, dctx);
        if (node[M] === 'mfref') {
            const mf = engineCall(() => mm.getModelFile(node.ns));
            if (!mf) {
                const err = new Error('state divergence: model file ' + node.ns + ' not registered after replay');
                err.divergence = true;
                throw err;
            }
            return mf;
        }
        const ast = decode(node.ast, dctx);
        const defs = decode(node.definitions, dctx);
        const fileName = decode(node.fileName, dctx);
        // `new ModelFile(...)` can itself reject a malformed AST (this is a
        // real, comparable engine behaviour, not just a decode-time mishap:
        // task P5-05 fuzzes mutated model ASTs that feed straight into this
        // constructor via an `mfnew` recipe node). See engineCall().
        return engineCall(() => new core.ModelFile(mm, ast, defs, fileName));
    };

    const decodeDecl = (node, dctx) => {
        if (node && node[M] === 'declnew') {
            const Cls = { ScalarDeclaration: core.ScalarDeclaration }[node.cls];
            if (!Cls) {
                throw new HarnessError('unknown declnew class ' + node.cls);
            }
            const mf = decodeMF(node.mf, dctx);
            const ast = decode(node.ast, dctx);
            return engineCall(() => new Cls(mf, ast));
        }
        const mf = decodeMF(node.mf, dctx);
        const d = engineCall(() => mf.getAllDeclarations())[node.index];
        if (!d || d.getName() !== node.name) {
            const err = new Error('state divergence: declaration ' + node.name + ' not found');
            err.divergence = true;
            throw err;
        }
        return d;
    };

    const decodeTyped = (node, dctx) => {
        const Ctor = { Relationship: core.Relationship, Resource: core.Resource, ValidatedResource: core.ValidatedResource }[node.ctor];
        if (!Ctor || !Array.isArray(node.keys)) {
            throw new HarnessError('malformed typed node');
        }
        const mm = decode(node.mm, dctx);
        const decl = decodeDecl(node.decl, dctx);
        const t = Object.create(Ctor.prototype);
        for (const k of node.keys) {
            if (k === '$modelManager') {
                t[k] = mm;
            } else if (k === '$classDeclaration') {
                t[k] = decl;
            } else if (k === '$validator') {
                const validatorOptions = decode(node.validatorOptions, dctx);
                t[k] = engineCall(() => new core.ResourceValidator(validatorOptions));
            } else {
                t[k] = decode(node.fields[k], dctx);
            }
        }
        return t;
    };

    /**
     * @param {*} v encoded value
     * @param {object} dctx decoding session {mms: Map, self?: mm}
     * @returns {*} live value
     */
    function decode(v, dctx) {
        if (v === null || typeof v !== 'object') {
            return v;
        }
        if (Array.isArray(v)) {
            return v.map((x) => decode(x, dctx));
        }
        const kind = v[M];
        if (kind === undefined) {
            const out = {};
            for (const k of Object.keys(v)) {
                out[k] = decode(v[k], dctx);
            }
            return out;
        }
        switch (kind) {
        case 'undefined': return undefined;
        case 'number': return v.value === '-0' ? -0 : Number(v.value);
        case 'bigint': return BigInt(v.value);
        case 'date': return new Date(v.iso === null ? NaN : v.iso);
        case 'regexp': return new RegExp(v.source, v.flags);
        case 'map': return new Map(v.entries.map(([k, x]) => [decode(k, dctx), decode(x, dctx)]));
        case 'set': return new Set(v.values.map((x) => decode(x, dctx)));
        case 'dayjs': {
            const dayjs = core.dayjs;
            if (!v.valid) {
                return dayjs('not a date');
            }
            if (v.utc) {
                return v.offset === 0 ? dayjs.utc(v.iso) : dayjs.utc(v.iso).utcOffset(v.offset);
            }
            const local = dayjs(v.iso);
            return local.utcOffset() === v.offset ? local : local.utcOffset(v.offset);
        }
        case 'self':
            if (!dctx.self) {
                throw new HarnessError('"self" outside a model manager step');
            }
            return dctx.self;
        case 'mm': return decodeMM(v, dctx);
        case 'mmref': {
            if (!dctx.mms.has(v.id)) {
                throw new HarnessError('dangling mmref ' + v.id);
            }
            return dctx.mms.get(v.id);
        }
        case 'mfref':
        case 'mfnew':
            return decodeMF(v, dctx);
        case 'declref':
        case 'declnew':
            return decodeDecl(v, dctx);
        case 'predicate': return encodable.buildPredicate(v);
        case 'decoratorfactory': return encodable.buildDecoratorFactory(core, v);
        case 'visitor': return encodable.buildVisitor(v);
        case 'errnew': {
            const Cls = { TypeNotFoundException: core.TypeNotFoundException, SecurityException: core.SecurityException }[v.cls];
            if (!Cls || !Array.isArray(v.args)) {
                throw new HarnessError('malformed errnew node');
            }
            const args = v.args.map((a) => decode(a, dctx));
            return engineCall(() => new Cls(...args));
        }
        case 'propref': {
            const decl = decodeDecl(v.decl, dctx);
            if (v.part === 'key') {
                return engineCall(() => decl.getKey());
            }
            if (v.part === 'value') {
                return engineCall(() => decl.getValue());
            }
            const p = engineCall(() => decl.getOwnProperties())[v.index];
            if (!p || p.getName() !== v.name) {
                const err = new Error('state divergence: property ' + v.name + ' not found');
                err.divergence = true;
                throw err;
            }
            return p;
        }
        case 'decoref': {
            const parent = decode(v.parent, dctx);
            const d = engineCall(() => parent.getDecorators())[v.index];
            if (!d) {
                const err = new Error('state divergence: decorator ' + v.index + ' not found');
                err.divergence = true;
                throw err;
            }
            return d;
        }
        case 'validatorref': {
            const owner = decode(v.owner, dctx);
            const val = engineCall(() => (v.part === 'size' ? owner.getSizeValidator() : owner.getValidator()));
            if (!val) {
                const err = new Error('state divergence: validator not found');
                err.divergence = true;
                throw err;
            }
            return val;
        }
        case 'introspector': {
            const mm = decode(v.mm, dctx);
            return engineCall(() => new core.Introspector(mm));
        }
        case 'factory': {
            const mm = decode(v.mm, dctx);
            return engineCall(() => new core.Factory(mm));
        }
        case 'serializer': {
            const mm = decode(v.mm, dctx);
            const factory = decode(v.factory, dctx);
            const defaultOptions = decode(v.defaultOptions, dctx);
            return engineCall(() => new core.Serializer(factory, mm, defaultOptions));
        }
        case 'typed': return decodeTyped(v, dctx);
        case 'blob':
            throw new HarnessError('unresolved blob ' + v.sha256);
        default:
            throw new HarnessError('unknown encoded kind ' + kind);
        }
    }
    return decode;
}

module.exports = {
    M, NonPlain, HarnessError, TYPED_INTERNAL,
    isSinonProxy, isSinonStub, ownStub, isDayjsLike, isPlainObject,
    encodePlain, makeInputEncoder, newCtx, makeOutputEncoder, encodeError, makeDecoder,
};
