// P5-15 (accordproject/concerto-rust#309): a CONCERTO_ENGINE_MODULE shim
// that loads the real engine and wraps every binding (free functions, class
// constructors and prototype methods) to count TS->WASM crossings and time
// spent inside them. Measure only; nothing in concerto-core uses it.
//
//   P515_REAL_ENGINE=<path to concerto-engine.cjs>  (the real module)
//
// Stats live on globalThis.__p515Crossings: { name: { calls, ns } }. The
// timing adds two hrtime reads per crossing (~0.1 us), so the time column
// is only used for shares; counts are exact.

'use strict';

const real = require(process.env.P515_REAL_ENGINE);
const stats = (globalThis.__p515Crossings = globalThis.__p515Crossings || {});
let depth = 0;

function record(name, t0) {
    const s = stats[name] || (stats[name] = { calls: 0, ns: 0 });
    s.calls++;
    s.ns += Number(process.hrtime.bigint() - t0);
}

function wrapFn(name, fn) {
    return function (...args) {
        if (depth > 0) {
            return fn.apply(this, args);
        }
        depth++;
        const t0 = process.hrtime.bigint();
        try {
            return fn.apply(this, args);
        } finally {
            depth--;
            record(name, t0);
        }
    };
}

function isClass(fn) {
    return typeof fn === 'function' && /^class\b/.test(Function.prototype.toString.call(fn));
}

const out = {};
for (const key of Object.keys(real)) {
    const v = real[key];
    if (key === 'setHost') {
        out[key] = v;
    } else if (isClass(v)) {
        const proto = v.prototype;
        for (const m of Object.getOwnPropertyNames(proto)) {
            const d = Object.getOwnPropertyDescriptor(proto, m);
            if (m === 'constructor' || typeof d.value !== 'function' || m === 'free' || m.startsWith('__')) {
                continue;
            }
            proto[m] = wrapFn(`${key}.${m}`, d.value);
        }
        out[key] = new Proxy(v, {
            construct(target, args, newTarget) {
                if (depth > 0) {
                    return Reflect.construct(target, args, newTarget);
                }
                depth++;
                const t0 = process.hrtime.bigint();
                try {
                    return Reflect.construct(target, args, newTarget);
                } finally {
                    depth--;
                    record(`new ${key}`, t0);
                }
            },
        });
    } else if (typeof v === 'function') {
        out[key] = wrapFn(key, v);
    } else {
        out[key] = v;
    }
}
module.exports = out;
