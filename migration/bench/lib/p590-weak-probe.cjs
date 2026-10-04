// P5-90 (accordproject/concerto-rust#436): the WeakMap-stall probe. A
// `node --require` preload that replaces WeakMap and WeakSet with
// subclasses timing every get/set/has/delete/add, by the collection's
// creation site (file:line of the `new WeakMap()`), as P5-73 measured
// `stages.set` by wrapping WeakMap.prototype.set. Measure only.
//
//   P590_WEAK_OUT=<file.json> node --require ./lib/p590-weak-probe.cjs ...
//
// Per site and op: calls, total us, the slowest call, and the calls over
// 20 us and over 100 us (a stall). The wrapper itself adds two clock reads
// per call (performance.now), so totals are only for comparison; the slow-call counts are
// what the stall question needs. The JSON is written at exit.

'use strict';

const fs = require('fs');

const stats = {};
// performance.now() returns a double: no BigInt allocated per call, so the
// probe itself does not feed the young generation the stall depends on.
const { performance } = require('perf_hooks');
const now = () => performance.now();

function siteOf() {
    const lines = (new Error().stack || '').split('\n').slice(3);
    for (const l of lines) {
        const m = /\(?((?:file:\/\/)?\/[^():]+):(\d+):\d+\)?$/.exec(l.trim());
        if (m && !/p590-weak-probe/.test(m[1])) {
            const file = m[1].replace(/^file:\/\//, '');
        let name = '';
        try {
            name = (/const (\w+)/.exec(fs.readFileSync(file, 'utf8').split('\n')[Number(m[2]) - 1]) || [])[1] || '';
        } catch (e) {
            // no source: the site alone
        }
        return `${file.split('/').slice(-2).join('/')}:${m[2]}${name ? ` ${name}` : ''}`;
        }
    }
    return '?';
}

function record(site, op, ns) {
    const k = `${site} ${op}`;
    const s = stats[k] || (stats[k] = { calls: 0, ns: 0, maxNs: 0, over20us: 0, over100us: 0 });
    s.calls++;
    s.ns += ns;
    if (ns > s.maxNs) {
        s.maxNs = ns;
    }
    if (ns > 20000) {
        s.over20us++;
    }
    if (ns > 100000) {
        s.over100us++;
    }
}

function probe(Base, ops) {
    const sites = new WeakMapReal();
    class Probed extends Base {
        constructor(iterable) {
            super(iterable);
            sites.set(this, siteOf());
        }
    }
    for (const op of ops) {
        const real = Base.prototype[op];
        Probed.prototype[op] = function (...args) {
            const t0 = now();
            const r = real.apply(this, args);
            record(sites.get(this) || '?', op, (now() - t0) * 1e6);
            return r;
        };
    }
    Object.defineProperty(Probed, 'name', { value: Base.name });
    return Probed;
}

const WeakMapReal = WeakMap;
globalThis.WeakMap = probe(WeakMapReal, ['get', 'set', 'has', 'delete']);
globalThis.WeakSet = probe(WeakSet, ['add', 'has', 'delete']);

process.on('exit', () => {
    const out = process.env.P590_WEAK_OUT;
    const rows = Object.entries(stats)
        .map(([k, s]) => ({ key: k, calls: s.calls, totalUs: s.ns / 1000, maxUs: s.maxNs / 1000, over20us: s.over20us, over100us: s.over100us }))
        .sort((a, b) => b.totalUs - a.totalUs);
    if (out) {
        fs.writeFileSync(out, JSON.stringify(rows, null, 2));
    } else {
        for (const r of rows.slice(0, 20)) {
            process.stderr.write(`${r.key}: ${r.calls} calls ${r.totalUs.toFixed(0)} us max ${r.maxUs.toFixed(0)} us >20us ${r.over20us} >100us ${r.over100us}\n`);
        }
    }
});
