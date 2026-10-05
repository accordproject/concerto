#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): P5-44's and P5-45's rows, the
// engine's load cost and shipped size. Measure only.
//
//   node migration/bench/p5131-load.mjs --mode node  --out FILE [--reps N]
//   node migration/bench/p5131-load.mjs --mode sizes --out FILE
//
// Sides (environment): NOW_CORE_DIST and NOW_ENGINE_PKG (default: this
// checkout's concerto-core dist and the sibling concerto-rust's
// concerto-wasm/pkg: the raw .wasm, P5-44), BEFORE_CORE_DIST and
// BEFORE_ENGINE_PKG (P5-121's now heads: the .wasm inlined as base64), and
// TS 5.0.0 (migration/oracle/reference) for the concerto-core rows.
//
// --mode node   engine load time in Node, each figure from a fresh process
//               (`node <this file> --child ...`), the sides interleaved and
//               their order rotated every repetition (--reps, default 20):
//                 core-require  require(concerto-core) to the first
//                               `new ModelManager()` returning (CommonJS,
//                               the engine through concerto-engine.cjs);
//                 core-import   the same through `await import()` of the
//                               ESM build (dist/esm/index.mjs);
//                 engine-require  require(pkg/concerto-engine.cjs) to the
//                               first `new ModelManagerHandle()`;
//                 engine-import   `await import()` of the Node ESM loader
//                               (now pkg/concerto-engine.node.mjs, before
//                               pkg/concerto-engine.mjs) to the same.
//               Each child also gives the time to the end of the load alone,
//               and the process's own start-up (performance.timeOrigin to
//               the first line), which is the same on every side.
// --mode sizes  the shipped engine files of both sides, raw, gzip -9 and
//               brotli q11 (KB = 1000 B), and the .wasm as base64.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(REPO_ROOT, 'migration', 'oracle', 'reference', 'node_modules', '@accordproject', 'concerto-core', 'dist');
const NOW_CORE = path.resolve(process.env.NOW_CORE_DIST || path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'));
const NOW_PKG = path.resolve(process.env.NOW_ENGINE_PKG || path.join(REPO_ROOT, '..', 'concerto-rust', 'concerto-wasm', 'pkg'));
const BEFORE_CORE = process.env.BEFORE_CORE_DIST ? path.resolve(process.env.BEFORE_CORE_DIST) : null;
const BEFORE_PKG = process.env.BEFORE_ENGINE_PKG ? path.resolve(process.env.BEFORE_ENGINE_PKG) : null;

const argv = process.argv.slice(2);
const opt = (k, d) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : d;
};

// ---- child: one measurement in a fresh process -----------------------------
if (argv[0] === '--child') {
    const [, kind, target] = argv;
    const { performance } = await import('perf_hooks');
    const startup = performance.now();
    const t0 = performance.now();
    let loaded;
    let first;
    if (kind === 'core-require') {
        const core = require(path.join(target, 'index.js'));
        loaded = performance.now();
        new core.ModelManager();
        first = performance.now();
    } else if (kind === 'core-import') {
        const core = await import(url.pathToFileURL(path.join(target, 'esm', 'index.mjs')).href);
        loaded = performance.now();
        new core.ModelManager();
        first = performance.now();
    } else if (kind === 'engine-require') {
        const engine = require(target);
        loaded = performance.now();
        new engine.ModelManagerHandle().free();
        first = performance.now();
    } else if (kind === 'engine-import') {
        const engine = await import(url.pathToFileURL(target).href);
        if (typeof engine.init === 'function') {
            await engine.init();
        }
        loaded = performance.now();
        new engine.ModelManagerHandle().free();
        first = performance.now();
    } else {
        throw new Error(`unknown kind ${kind}`);
    }
    process.stdout.write(JSON.stringify({ startupMs: startup, loadMs: loaded - t0, firstMs: first - t0 }));
    process.exit(0);
}

const median = (xs) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN;
};
const OUT = path.resolve(opt('--out', 'p5131-load.json'));
const mode = opt('--mode', 'node');

if (mode === 'node') {
    const reps = Number(opt('--reps', 20));
    const nodeMjs = (pkg) => (fs.existsSync(path.join(pkg, 'concerto-engine.node.mjs')) ? path.join(pkg, 'concerto-engine.node.mjs') : path.join(pkg, 'concerto-engine.mjs'));
    const cases = [];
    const side = (name, core, pkg) => {
        if (core) {
            cases.push({ side: name, kind: 'core-require', target: core, env: pkg ? { CONCERTO_ENGINE_MODULE: path.join(pkg, 'concerto-engine.cjs') } : { CONCERTO_ENGINE_MODULE: '' } });
            if (fs.existsSync(path.join(core, 'esm', 'index.mjs'))) {
                cases.push({ side: name, kind: 'core-import', target: core, env: pkg ? { CONCERTO_ENGINE_MODULE: path.join(pkg, 'concerto-engine.cjs') } : { CONCERTO_ENGINE_MODULE: '' } });
            }
        }
        if (pkg) {
            cases.push({ side: name, kind: 'engine-require', target: path.join(pkg, 'concerto-engine.cjs'), env: {} });
            cases.push({ side: name, kind: 'engine-import', target: nodeMjs(pkg), env: {} });
        }
    };
    side('now', NOW_CORE, NOW_PKG);
    if (BEFORE_CORE || BEFORE_PKG) {
        side('before', BEFORE_CORE, BEFORE_PKG);
    }
    side('ts5', REF, null);
    const runs = cases.map((c) => ({ ...c, samples: [] }));
    for (let r = 0; r < reps; r++) {
        // Rotate the order every repetition, so no side always runs first.
        const order = runs.map((_, i) => runs[(i + r) % runs.length]);
        for (const c of order) {
            const out = execFileSync(process.execPath, [__filename, '--child', c.kind, c.target], { env: { ...process.env, ...c.env }, encoding: 'utf8' });
            c.samples.push(JSON.parse(out));
        }
    }
    const results = runs.map((c) => ({ side: c.side, kind: c.kind, target: c.target, reps: c.samples.length,
        firstMs: median(c.samples.map((s) => s.firstMs)), loadMs: median(c.samples.map((s) => s.loadMs)), startupMs: median(c.samples.map((s) => s.startupMs)),
        firstMsMin: Math.min(...c.samples.map((s) => s.firstMs)), firstMsMax: Math.max(...c.samples.map((s) => s.firstMs)), samples: c.samples }));
    for (const r of results) {
        console.log(`${r.side.padEnd(7)} ${r.kind.padEnd(15)} first ${r.firstMs.toFixed(1).padStart(7)} ms (load ${r.loadMs.toFixed(1)} ms; min ${r.firstMsMin.toFixed(1)}, max ${r.firstMsMax.toFixed(1)}); start-up ${r.startupMs.toFixed(1)} ms`);
    }
    fs.writeFileSync(OUT, JSON.stringify({ tool: 'p5131-load', mode, node: process.version, cpu: os.cpus()[0].model, loadavgEnd: os.loadavg(), reps,
        sides: { now: { core: NOW_CORE, pkg: NOW_PKG }, before: { core: BEFORE_CORE, pkg: BEFORE_PKG }, ts5: { core: REF } }, results }, null, 2));
} else if (mode === 'sizes') {
    const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
    const br = (b) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } }).length;
    const sizes = (b) => ({ raw: b.length, gzip: gz(b), brotli: br(b) });
    const pkgSizes = (pkg) => {
        if (!pkg) {
            return null;
        }
        const files = {};
        const walk = (dir) => {
            for (const f of fs.readdirSync(dir)) {
                const p = path.join(dir, f);
                if (fs.statSync(p).isDirectory()) {
                    walk(p);
                } else {
                    files[path.relative(pkg, p)] = sizes(fs.readFileSync(p));
                }
            }
        };
        walk(pkg);
        const wasm = fs.readFileSync(path.join(pkg, 'concerto_wasm.wasm'));
        return { pkg, files, wasmBase64: sizes(Buffer.from(wasm.toString('base64'))) };
    };
    const out = { tool: 'p5131-load', mode, now: pkgSizes(NOW_PKG), before: pkgSizes(BEFORE_PKG) };
    const kb = (x) => (x / 1000).toFixed(1);
    for (const s of ['now', 'before']) {
        if (!out[s]) {
            continue;
        }
        for (const [f, x] of Object.entries(out[s].files)) {
            console.log(`${s.padEnd(7)} ${f.padEnd(36)} ${kb(x.raw).padStart(9)} / ${kb(x.gzip).padStart(8)} / ${kb(x.brotli).padStart(8)} KB`);
        }
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
} else {
    throw new Error(`unknown mode ${mode}`);
}
