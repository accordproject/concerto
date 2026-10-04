#!/usr/bin/env node
// P5-120 (accordproject/concerto-rust#495): tables and charts for the
// three-side memory soak (p5120-run.sh). Measure only.
//
//   node migration/bench/p5120-table.mjs [results/P5-120]
//
// Per set and side: peak RSS, the steady-state RSS (median after a 20%
// warm-up), the RSS slope after warm-up (linear fit, MB/min), WASM growth in
// the first and second half of the post-warm-up window, throughput, the
// unfinalised managers, the GC pauses, and P5-97's plateau rule (no WASM
// growth after warm-up, and the second half's peak RSS within 5% of the
// first half's). The curves go in a table at every 10% of the run and in
// one SVG chart per set and metric (results/P5-120/charts/).

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'results', 'P5-120'));
const SETS = ['conformance', 'synthetic-large'];
const SIDES = [
    ['ts5-a', 'TS 5.0.0, new manager per request', '#d1495b'],
    ['now-a', 'Rust, new manager per request', '#00798c'],
    ['now-c', 'Rust, fork() per request', '#edae49'],
];

function read(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}
const MB = 1048576;
const mb = (x) => (x === null || x === undefined ? '-' : (x / MB).toFixed(1));
const median = (xs) => {
    const s = xs.slice().sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const wasm = (p) => p.wasmBytes || 0; // null on TS 5.0.0: no engine memory

function analyse(s) {
    const tl = s.timeline;
    const end = tl[tl.length - 1].t;
    const warm = tl.filter((p) => p.t >= end * 0.2);
    const n = warm.length;
    const mt = warm.reduce((a, p) => a + p.t, 0) / n;
    const mr = warm.reduce((a, p) => a + p.rss, 0) / n;
    const slope = warm.reduce((a, p) => a + (p.t - mt) * (p.rss - mr), 0) / warm.reduce((a, p) => a + (p.t - mt) ** 2, 0);
    const half = Math.floor(n / 2);
    const maxRss = (xs) => Math.max(...xs.map((p) => p.rss));
    const rssHalves = [maxRss(warm.slice(0, half)), maxRss(warm.slice(half))];
    const wasmHalves = [wasm(warm[half]) - wasm(warm[0]), wasm(warm[n - 1]) - wasm(warm[half])];
    const wasmGrows = wasm(warm[n - 1]) > wasm(warm[0]);
    // P5-97's rule; the second half's WASM growth is what the issue names,
    // and it implies the whole post-warm-up rule when the first half is 0.
    const plateau = wasmHalves[1] <= 0 && rssHalves[1] <= rssHalves[0] * 1.05;
    const unfin = tl.map((p) => p.unfinalized).filter((x) => typeof x === 'number');
    const gcWarm = (warm[n - 1].gcTotalMs - warm[0].gcTotalMs) / ((warm[n - 1].t - warm[0].t) * 1000);
    return {
        seconds: s.seconds, wallS: end, requests: s.requests, throughputPerS: s.throughputPerS,
        peakRss: Math.max(...tl.map((p) => p.rss)), steadyRss: median(warm.map((p) => p.rss)),
        slopeMbPerMin: (slope * 60) / MB, rssHalves, wasmHalves, wasmGrows, plateau,
        wasmStart: wasm(tl[0]), wasmEnd: wasm(tl[tl.length - 1]), wasmPeak: Math.max(...tl.map(wasm)),
        peakHeapUsed: Math.max(...tl.map((p) => p.heapUsed)), steadyHeapUsed: median(warm.map((p) => p.heapUsed)),
        steadyHeapTotal: median(warm.map((p) => p.heapTotal)), steadyExternal: median(warm.map((p) => p.external)),
        steadyArrayBuffers: median(warm.map((p) => p.arrayBuffers)),
        unfinalizedMedian: median(unfin), unfinalizedMax: Math.max(...unfin),
        gc: s.gc, gcShareAfterWarmup: gcWarm, samples: tl.length,
    };
}

function chart(set, metric, title, get, runs) {
    const W = 720, H = 300, L = 60, R = 16, T = 28, B = 40;
    const all = runs.flatMap(([, , , s]) => s.timeline);
    const tMax = Math.max(...all.map((p) => p.t));
    const yMax = Math.max(1, ...all.map(get)) * 1.05;
    const x = (t) => L + (t / tMax) * (W - L - R);
    const y = (v) => T + (1 - v / yMax) * (H - T - B);
    const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="11">`,
        `<rect width="${W}" height="${H}" fill="#fff"/>`,
        `<text x="${L}" y="16" font-size="13">${set}: ${title}</text>`,
    ];
    for (let i = 0; i <= 4; i++) {
        const v = (yMax * i) / 4;
        parts.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/>`);
        parts.push(`<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${(v / MB).toFixed(0)}</text>`);
        const t = (tMax * i) / 4;
        parts.push(`<text x="${x(t)}" y="${H - B + 16}" text-anchor="middle">${t.toFixed(0)} s</text>`);
    }
    parts.push(`<text x="12" y="${T + (H - T - B) / 2}" transform="rotate(-90 12 ${T + (H - T - B) / 2})" text-anchor="middle">MB</text>`);
    runs.forEach(([, label, color, s], i) => {
        const pts = s.timeline.map((p) => `${x(p.t).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');
        parts.push(`<polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/>`);
        parts.push(`<rect x="${L + i * 220}" y="${H - 14}" width="10" height="3" fill="${color}"/><text x="${L + i * 220 + 14}" y="${H - 10}">${label}</text>`);
    });
    parts.push('</svg>');
    fs.mkdirSync(path.join(OUT, 'charts'), { recursive: true });
    const file = path.join('charts', `${set}-${metric}.svg`);
    fs.writeFileSync(path.join(OUT, file), parts.join('\n') + '\n');
    return file;
}

const tables = {};
const lines = [];
for (const set of SETS) {
    const runs = SIDES.map(([key, label, color]) => [key, label, color, read(path.join(OUT, 'soak', `${key}-${set}-n64.json`))]).filter((r) => r[3]);
    if (!runs.length) {
        continue;
    }
    tables[set] = {};
    for (const [key, , , s] of runs) {
        tables[set][key] = analyse(s);
    }
    const A = tables[set];
    lines.push(`#### ${set}`, '');
    lines.push('| side | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|');
    for (const [key, label] of runs) {
        const a = A[key];
        lines.push(`| ${label} | ${a.wallS.toFixed(0)} | ${a.requests} | ${a.throughputPerS.toFixed(0)} | ${mb(a.peakRss)} | ${mb(a.steadyRss)} | ${a.slopeMbPerMin.toFixed(2)} | ${mb(a.rssHalves[0])} / ${mb(a.rssHalves[1])} | ${mb(a.wasmStart)} / ${mb(a.wasmEnd)} | ${mb(a.wasmHalves[0])} / ${mb(a.wasmHalves[1])} | ${mb(a.steadyHeapUsed)} / ${mb(a.steadyHeapTotal)} / ${mb(a.steadyExternal)} | ${a.unfinalizedMedian} / ${a.unfinalizedMax} | ${a.plateau ? 'plateau (pass)' : 'growth (fail)'}${a.plateau && a.wasmGrows ? ' (P5-97 strict form, no WASM growth after warm-up at all: fail)' : ''} |`);
    }
    lines.push('');
    lines.push(`GC pauses, ${set} (major = mark-compact plus incremental marking steps; minor = scavenges):`, '');
    lines.push('| side | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---|---|---|');
    for (const [key, label] of runs) {
        const a = A[key];
        const k = a.gc.byKind;
        const pair = (...ks) => {
            const c = ks.reduce((s, x) => s + (k[x] ? k[x].count : 0), 0);
            const t = ks.reduce((s, x) => s + (k[x] ? k[x].totalMs : 0), 0);
            return `${c} / ${(t / 1000).toFixed(1)}`;
        };
        lines.push(`| ${label} | ${a.gc.all.count} | ${(a.gc.all.totalMs / 1000).toFixed(1)} | ${((a.gc.all.totalMs / 1000 / a.wallS) * 100).toFixed(1)}% | ${(a.gcShareAfterWarmup * 100).toFixed(1)}% | ${a.gc.all.p95Ms.toFixed(2)} | ${a.gc.all.maxMs.toFixed(1)} | ${pair('major', 'incremental')} | ${pair('minor')} | ${pair('weakcb')} |`);
    }
    lines.push('');
    lines.push(`Curves, ${set} (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):`, '');
    lines.push(`| % of run | ${runs.map((r) => r[1]).join(' | ')} |`);
    lines.push(`|---:|${runs.map(() => '---').join('|')}|`);
    for (let f = 0; f <= 10; f++) {
        const cells = runs.map(([, , , s]) => {
            const tl = s.timeline;
            const p = tl[Math.min(tl.length - 1, Math.max(0, Math.round(((tl.length - 1) * f) / 10)))];
            return `${mb(p.rss)} / ${mb(wasm(p))} / ${mb(p.heapUsed)}, ${p.done}`;
        });
        lines.push(`| ${f * 10}% | ${cells.join(' | ')} |`);
    }
    lines.push('');
    const charts = [
        chart(set, 'rss', 'RSS (MB)', (p) => p.rss, runs),
        chart(set, 'wasm', 'WASM linear memory (MB; 0 for TS)', wasm, runs),
        chart(set, 'heap', 'V8 heapUsed (MB)', (p) => p.heapUsed, runs),
    ];
    lines.push(`Charts: ${charts.map((c) => `[${path.basename(c, '.svg')}](results/P5-120/${c})`).join(', ')}.`, '');
}

const md = lines.join('\n');
fs.writeFileSync(path.join(OUT, 'tables.md'), md);
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2));
process.stdout.write(md + '\n');
