#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): tables and charts of the
// targeted re-soak (p5131-soak-run.sh), next to P5-120's
// (results/P5-120/soak), with P5-120's columns. Measure only.
//
//   node migration/bench/p5131-soak-table.mjs [results/P5-131/soak] [--p5120 results/P5-120/soak]
//
// Per set and side, for both runs: peak RSS, the steady-state RSS (median
// after a 20% warm-up), the RSS slope after warm-up (linear fit, MB/min) and
// in the second half of it, WASM growth in the first and second half of the
// post-warm-up window, throughput, the unfinalised managers, the GC pauses,
// and P5-120's plateau rule (no WASM growth in the second half, and the
// second half's peak RSS within 5% of the first half's), with P5-97's
// strict form (no WASM growth after warm-up at all). A run longer than
// P5-120's 1,200 s (now-a, 2,400 s) is also judged with P5-120's 240 s
// warm-up, like for like. Then every step of the WASM memory after warm-up
// on the Rust sides, with the unfinalised managers at that sample and their
// peak until then. The curves go in a table at every 10% of the run and in
// one SVG chart per set and metric (OUT/charts/), P5-120's now-a dashed.

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const OUT = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(__dirname, 'results', 'P5-131', 'soak'));
const P5120 = path.resolve(argv.includes('--p5120') ? argv[argv.indexOf('--p5120') + 1] : path.join(__dirname, 'results', 'P5-120', 'soak'));
const REL = path.relative(path.join(__dirname), OUT).split(path.sep).join('/');
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
const mb = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '-' : (x / MB).toFixed(1));
const median = (xs) => {
    const s = xs.slice().sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const wasm = (p) => p.wasmBytes || 0; // null on TS 5.0.0: no engine memory
const slopeOf = (pts) => {
    const n = pts.length;
    const mt = pts.reduce((a, p) => a + p.t, 0) / n;
    const mr = pts.reduce((a, p) => a + p.rss, 0) / n;
    return pts.reduce((a, p) => a + (p.t - mt) * (p.rss - mr), 0) / pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
};

/**
 * P5-120's analysis of one soak, with the warm-up `warmS` seconds (default
 * 20% of the run).
 * @param {object} s the soak JSON
 * @param {number} [warmS] the warm-up in seconds
 * @return {object} the figures
 */
function analyse(s, warmS) {
    const tl = s.timeline;
    const end = tl[tl.length - 1].t;
    const warmAt = warmS ?? end * 0.2;
    const warm = tl.filter((p) => p.t >= warmAt);
    const n = warm.length;
    const half = Math.floor(n / 2);
    const maxRss = (xs) => Math.max(...xs.map((p) => p.rss));
    const rssHalves = [maxRss(warm.slice(0, half)), maxRss(warm.slice(half))];
    const wasmHalves = [wasm(warm[half]) - wasm(warm[0]), wasm(warm[n - 1]) - wasm(warm[half])];
    const wasmGrows = wasm(warm[n - 1]) > wasm(warm[0]);
    const plateau = wasmHalves[1] <= 0 && rssHalves[1] <= rssHalves[0] * 1.05;
    const unfin = tl.map((p) => p.unfinalized).filter((x) => typeof x === 'number');
    const gcWarm = (warm[n - 1].gcTotalMs - warm[0].gcTotalMs) / ((warm[n - 1].t - warm[0].t) * 1000);
    // Every step of the WASM memory after warm-up, with the unfinalised
    // managers at that sample and their peak over the run until then.
    const steps = [];
    let peakUnfin = 0;
    for (let i = 1; i < tl.length; i++) {
        peakUnfin = Math.max(peakUnfin, tl[i - 1].unfinalized ?? 0);
        const d = wasm(tl[i]) - wasm(tl[i - 1]);
        if (d > 0 && tl[i].t >= warmAt) {
            steps.push({ t: tl[i].t, deltaBytes: d, wasmAfter: wasm(tl[i]), unfinalized: tl[i].unfinalized, peakUnfinalizedBefore: peakUnfin,
                newUnfinalizedPeak: (tl[i].unfinalized ?? 0) > peakUnfin, done: tl[i].done });
        }
    }
    const warmupSteps = tl.filter((p, i) => i > 0 && p.t < warmAt && wasm(p) > wasm(tl[i - 1])).length;
    return {
        seconds: s.seconds, wallS: end, warmupS: warmAt, requests: s.requests, throughputPerS: s.throughputPerS,
        peakRss: Math.max(...tl.map((p) => p.rss)), steadyRss: median(warm.map((p) => p.rss)),
        slopeMbPerMin: (slopeOf(warm) * 60) / MB, slopeSecondHalfMbPerMin: (slopeOf(warm.slice(half)) * 60) / MB,
        rssHalves, wasmHalves, wasmGrows, plateau,
        wasmStart: wasm(tl[0]), wasmEnd: wasm(tl[tl.length - 1]), wasmPeak: Math.max(...tl.map(wasm)),
        peakHeapUsed: Math.max(...tl.map((p) => p.heapUsed)), steadyHeapUsed: median(warm.map((p) => p.heapUsed)),
        steadyHeapTotal: median(warm.map((p) => p.heapTotal)), steadyExternal: median(warm.map((p) => p.external)),
        steadyArrayBuffers: median(warm.map((p) => p.arrayBuffers)),
        unfinalizedMedian: median(unfin), unfinalizedMax: Math.max(...unfin),
        unfinalizedMaxAt: tl.find((p) => p.unfinalized === Math.max(...unfin))?.t,
        gc: s.gc, gcShareAfterWarmup: gcWarm, samples: tl.length, steps, warmupSteps,
    };
}

function chart(set, metric, title, get, runs) {
    const W = 720, H = 300, L = 60, R = 16, T = 28, B = 40;
    const all = runs.flatMap((r) => r.s.timeline);
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
    runs.forEach((r, i) => {
        const pts = r.s.timeline.map((p) => `${x(p.t).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');
        parts.push(`<polyline fill="none" stroke="${r.color}" stroke-width="1.5"${r.dashed ? ' stroke-dasharray="5,3"' : ''} points="${pts}"/>`);
        // Two legend entries per line, under the axis labels.
        const lx = L + (i % 2) * 330;
        const ly = H - 13 + Math.floor(i / 2) * 11;
        parts.push(`<rect x="${lx}" y="${ly - 4}" width="10" height="3" fill="${r.color}"/><text x="${lx + 14}" y="${ly}">${r.label}</text>`);
    });
    parts.push('</svg>');
    fs.mkdirSync(path.join(OUT, 'charts'), { recursive: true });
    const file = path.join('charts', `${set}-${metric}.svg`);
    fs.writeFileSync(path.join(OUT, file), parts.join('\n') + '\n');
    return file;
}

const HEADER = '| side | run | seconds | requests | req/s | peak RSS MB | steady RSS MB (median after warm-up) | RSS slope after warm-up (MB/min) | RSS slope, 2nd half (MB/min) | RSS peak 1st / 2nd half (MB) | WASM MB start / end | WASM growth after warm-up, 1st / 2nd half (MB) | steady heapUsed / heapTotal / external MB | unfinalised managers median / max | plateau verdict |';
const verdict = (a) => `${a.plateau ? 'plateau (pass)' : 'growth (fail)'}${a.plateau && a.wasmGrows ? ' (P5-97 strict form, no WASM growth after warm-up at all: fail)' : ''}${!a.plateau || a.wasmGrows ? '' : ' (strict form: pass)'}`;
const rowOf = (label, run, a) => `| ${label} | ${run} | ${a.wallS.toFixed(0)} | ${a.requests} | ${a.throughputPerS.toFixed(0)} | ${mb(a.peakRss)} | ${mb(a.steadyRss)} | ${a.slopeMbPerMin.toFixed(2)} | ${a.slopeSecondHalfMbPerMin.toFixed(2)} | ${mb(a.rssHalves[0])} / ${mb(a.rssHalves[1])} | ${mb(a.wasmStart)} / ${mb(a.wasmEnd)} | ${mb(a.wasmHalves[0])} / ${mb(a.wasmHalves[1])} | ${mb(a.steadyHeapUsed)} / ${mb(a.steadyHeapTotal)} / ${mb(a.steadyExternal)} | ${a.unfinalizedMedian} / ${a.unfinalizedMax} | ${verdict(a)} |`;

const tables = {};
const lines = [];
for (const set of SETS) {
    const runs = [];
    for (const [key, label, color] of SIDES) {
        const now = read(path.join(OUT, 'soak', `${key}-${set}-n64.json`));
        const old = read(path.join(P5120, `${key}-${set}-n64.json`));
        if (old) {
            runs.push({ key, run: 'P5-120', label, color, s: old, a: analyse(old) });
        }
        if (now) {
            runs.push({ key, run: 'P5-131', label, color, s: now, a: analyse(now) });
        }
    }
    if (!runs.some((r) => r.run === 'P5-131')) {
        continue;
    }
    tables[set] = {};
    for (const r of runs) {
        tables[set][`${r.run}/${r.key}`] = r.a;
        if (r.run === 'P5-131' && r.a.wallS > 1300) {
            tables[set][`${r.run}/${r.key}/warm240`] = analyse(r.s, 240);
        }
    }
    lines.push(`#### ${set}`, '');
    lines.push('Warm-up: 20% of each run (240 s of 1,200 s, 480 s of 2,400 s). The 2,400 s run is also judged with P5-120\'s 240 s warm-up (the "240 s warm-up" row).', '');
    lines.push(HEADER);
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|');
    for (const [key, label] of SIDES) {
        for (const r of runs.filter((x) => x.key === key)) {
            lines.push(rowOf(label, r.run, r.a));
            const w = tables[set][`${r.run}/${r.key}/warm240`];
            if (w) {
                lines.push(rowOf(label, `${r.run}, 240 s warm-up`, w));
            }
        }
    }
    lines.push('');
    lines.push(`GC pauses, ${set} (major = mark-compact plus incremental marking steps; minor = scavenges):`, '');
    lines.push('| side | run | pauses | total pause s | share of wall | share after warm-up | p95 ms | max ms | major count / total s | minor count / total s | weak-callback count / total s |');
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|---|---|---|');
    for (const [key, label] of SIDES) {
        for (const r of runs.filter((x) => x.key === key)) {
            const a = r.a;
            const k = a.gc.byKind;
            const pair = (...ks) => {
                const c = ks.reduce((s, x) => s + (k[x] ? k[x].count : 0), 0);
                const t = ks.reduce((s, x) => s + (k[x] ? k[x].totalMs : 0), 0);
                return `${c} / ${(t / 1000).toFixed(1)}`;
            };
            lines.push(`| ${label} | ${r.run} | ${a.gc.all.count} | ${(a.gc.all.totalMs / 1000).toFixed(1)} | ${((a.gc.all.totalMs / 1000 / a.wallS) * 100).toFixed(1)}% | ${(a.gcShareAfterWarmup * 100).toFixed(1)}% | ${a.gc.all.p95Ms.toFixed(2)} | ${a.gc.all.maxMs.toFixed(1)} | ${pair('major', 'incremental')} | ${pair('minor')} | ${pair('weakcb')} |`);
        }
    }
    lines.push('');
    const mine = runs.filter((r) => r.run === 'P5-131');
    lines.push(`Curves, ${set}, P5-131 (RSS / WASM / heapUsed MB, and requests done, at every 10% of the run):`, '');
    lines.push(`| % of run | ${mine.map((r) => `${r.label} (${r.a.wallS.toFixed(0)} s)`).join(' | ')} |`);
    lines.push(`|---:|${mine.map(() => '---').join('|')}|`);
    for (let f = 0; f <= 10; f++) {
        const cells = mine.map((r) => {
            const tl = r.s.timeline;
            const p = tl[Math.min(tl.length - 1, Math.max(0, Math.round(((tl.length - 1) * f) / 10)))];
            return `${mb(p.rss)} / ${mb(wasm(p))} / ${mb(p.heapUsed)}, ${p.done}`;
        });
        lines.push(`| ${f * 10}% | ${cells.join(' | ')} |`);
    }
    lines.push('');
    lines.push(`WASM steps after warm-up, ${set} (every 5 s sample where the engine's linear memory grew; "peak before" is the most unfinalised managers seen at any earlier sample; "new peak" means this sample's count is above it):`, '');
    lines.push('| side | run | warm-up steps | t (s) | step MB | WASM MB after | unfinalised at the step | peak before | new peak | requests done |');
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|---|---:|');
    for (const r of runs.filter((x) => x.key !== 'ts5-a')) {
        if (!r.a.steps.length) {
            lines.push(`| ${r.label} | ${r.run} | ${r.a.warmupSteps} | none | - | ${mb(r.a.wasmEnd)} | - | ${r.a.unfinalizedMax} (max) | - | - |`);
        }
        for (const st of r.a.steps) {
            lines.push(`| ${r.label} | ${r.run} | ${r.a.warmupSteps} | ${st.t.toFixed(0)} | ${mb(st.deltaBytes)} | ${mb(st.wasmAfter)} | ${st.unfinalized} | ${st.peakUnfinalizedBefore} | ${st.newUnfinalizedPeak ? 'yes' : 'no'} | ${st.done} |`);
        }
    }
    lines.push('');
    const chartRuns = [
        ...mine.map((r) => ({ ...r, label: `${r.label} (P5-131)` })),
        ...runs.filter((r) => r.run === 'P5-120' && r.key === 'now-a').map((r) => ({ ...r, label: `${r.label} (P5-120)`, color: '#555', dashed: true })),
    ];
    const charts = [
        chart(set, 'rss', 'RSS (MB)', (p) => p.rss, chartRuns),
        chart(set, 'wasm', 'WASM linear memory (MB; 0 for TS)', wasm, chartRuns),
        chart(set, 'heap', 'V8 heapUsed (MB)', (p) => p.heapUsed, chartRuns),
    ];
    lines.push(`Charts: ${charts.map((c) => `[${path.basename(c, '.svg')}](${REL}/${c.split(path.sep).join('/')})`).join(', ')}.`, '');
}

const md = lines.join('\n');
fs.writeFileSync(path.join(OUT, 'tables.md'), md);
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2));
process.stdout.write(md + '\n');
