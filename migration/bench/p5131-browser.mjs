#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): P5-45's row, the browser cost of
// loading the engine, headless (Playwright's Chromium). Measure only.
//
//   node migration/bench/p5131-browser.mjs --out FILE [--reps N] [--executable PATH]
//       [--playwright DIR]
//
// Environment: NOW_ENGINE_PKG (default the sibling concerto-rust's
// concerto-wasm/pkg) and BEFORE_ENGINE_PKG (P5-121's now head, whose browser
// loader inlines the .wasm as base64 and instantiates it synchronously at
// import). --playwright is the directory whose node_modules has Playwright
// (default: the sibling concerto-rust's concerto-wasm, a devDependency
// there); --executable a Chromium binary (default: Playwright's own).
//
// Every repetition (--reps, default 10) opens a fresh browser context (an
// empty cache) per case, the cases in a rotated order:
//   main-now     on the main thread: `import()` of now's browser loader,
//                `await init()` (fetches and compiles the raw .wasm), then
//                the first `new ModelManagerHandle()`;
//   main-before  `import()` of before's loader (base64 decode and a
//                synchronous compile inside the import), then the first
//                handle;
//   worker-now   the worker recipe (packages/concerto-engine/examples/worker,
//                built minified with its build.mjs): `new Worker()`, then
//                the first answer to a validate message (the worker's
//                `init()`, the first ModelManager, addCTOModel and fromJSON)
//                and a second answer (the same request, engine ready). The
//                init cost through the recipe is first - second.
// The files are served from 127.0.0.1 over HTTP.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createServer } from 'http';
import { createRequire } from 'module';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : d;
};
const OUT = path.resolve(opt('--out', 'p5131-browser.json'));
const REPS = Number(opt('--reps', 10));
const NOW_PKG = path.resolve(process.env.NOW_ENGINE_PKG || path.join(REPO_ROOT, '..', 'concerto-rust', 'concerto-wasm', 'pkg'));
const BEFORE_PKG = process.env.BEFORE_ENGINE_PKG ? path.resolve(process.env.BEFORE_ENGINE_PKG) : null;
const PW_DIR = path.resolve(opt('--playwright', path.join(REPO_ROOT, '..', 'concerto-rust', 'concerto-wasm')));
const EXECUTABLE = opt('--executable', undefined);
const { chromium } = createRequire(path.join(PW_DIR, 'package.json'))('playwright');

// The worker recipe, built minified next to a scratch page.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'p5131-browser-'));
const { build } = await import(url.pathToFileURL(path.join(REPO_ROOT, 'packages', 'concerto-engine', 'examples', 'worker', 'build.mjs')).href);
const workerDir = await build({ outDir: path.join(work, 'worker'), minify: true });
const workerBytes = fs.statSync(path.join(workerDir, 'worker.mjs')).size;

const ROOTS = { '/now/': NOW_PKG, '/worker/': workerDir, ...(BEFORE_PKG ? { '/before/': BEFORE_PKG } : {}) };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><meta charset="utf-8"><title>p5131</title><body>p5131</body>');
        return;
    }
    const prefix = Object.keys(ROOTS).find((r) => p.startsWith(r));
    const file = prefix ? path.normalize(path.join(ROOTS[prefix], p.slice(prefix.length))) : null;
    if (!file || !file.startsWith(ROOTS[prefix]) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- evaluated in the page ---------------------------------------------------
async function mainThread(loader) {
    const t0 = performance.now();
    const engine = await import(loader);
    const imported = performance.now();
    if (typeof engine.init === 'function') {
        await engine.init();
    }
    const ready = performance.now();
    new engine.ModelManagerHandle().free();
    const first = performance.now();
    return { importMs: imported - t0, initMs: ready - imported, firstMs: first - t0 };
}
async function workerRecipe() {
    const model = 'namespace org.example@1.0.0\nconcept Address {\n  o String street\n  o Integer number range=[1,]\n}';
    const instance = { $class: 'org.example@1.0.0.Address', street: 'High Street', number: 1 };
    const t0 = performance.now();
    const worker = new Worker('/worker/worker.mjs', { type: 'module' });
    const ask = (id) => new Promise((resolve) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.postMessage({ id, model, instance });
    });
    const a = await ask(0);
    const t1 = performance.now();
    const b = await ask(1);
    const t2 = performance.now();
    worker.terminate();
    return { ok: a.ok && b.ok, error: a.error || b.error, firstMs: t1 - t0, secondMs: t2 - t1, initMs: (t1 - t0) - (t2 - t1) };
}

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
const browserVersion = browser.version();
const cases = [
    { name: 'main-now', run: (page) => page.evaluate(mainThread, '/now/concerto-engine.mjs') },
    ...(BEFORE_PKG ? [{ name: 'main-before', run: (page) => page.evaluate(mainThread, '/before/concerto-engine.mjs') }] : []),
    { name: 'worker-now', run: (page) => page.evaluate(workerRecipe) },
];
const samples = Object.fromEntries(cases.map((c) => [c.name, []]));
for (let r = 0; r < REPS; r++) {
    for (let i = 0; i < cases.length; i++) {
        const c = cases[(i + r) % cases.length];
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`${origin}/`);
        samples[c.name].push(await c.run(page));
        await context.close();
    }
}
await browser.close();
server.close();

const median = (xs) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN;
};
const results = cases.map((c) => {
    const s = samples[c.name];
    const keys = Object.keys(s[0]).filter((k) => typeof s[0][k] === 'number');
    return { case: c.name, reps: s.length, ...Object.fromEntries(keys.map((k) => [k, median(s.map((x) => x[k]))])), errors: s.filter((x) => x.ok === false).map((x) => x.error), samples: s };
});
for (const r of results) {
    console.log(`${r.case.padEnd(12)} ${Object.entries(r).filter(([k, v]) => typeof v === 'number' && k !== 'reps').map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}${r.errors.length ? ` ERRORS ${JSON.stringify(r.errors)}` : ''}`);
}
fs.writeFileSync(OUT, JSON.stringify({ tool: 'p5131-browser', browser: browserVersion, chromium: EXECUTABLE ?? 'playwright default', reps: REPS,
    nowPkg: NOW_PKG, beforePkg: BEFORE_PKG, workerBundleBytes: workerBytes, cpu: os.cpus()[0].model, results }, null, 2));
fs.rmSync(work, { recursive: true, force: true });
