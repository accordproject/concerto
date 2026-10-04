#!/usr/bin/env node
// P5-15 (accordproject/concerto-rust#309): the per-stage split of a TS-API
// op, from a V8 CPU profile of `p515-sweep.mjs --mode loop` (node --cpu-prof).
//
//   node migration/bench/p515-cpuprof.mjs <file.cpuprofile> [--json]
//
// Every sample is put in one stage, by its leaf frame, walking up through
// native builtins (no URL) to the first frame with a source:
//   encode      JSON.stringify, and the serializer codec's encode side
//   glue        the wasm-bindgen JS glue (concerto-engine.cjs): string
//               copies in and out of WASM memory, object conversion
//   core        WASM code (the Rust engine, and the glue compiled into it)
//   decode      JSON.parse, and the serializer codec's decode side
//   views       view materialisation: engine/views*.js and introspect/*
//   ts-core     every other concerto-core dist/ module (TS logic that runs
//               on both engines)
//   cto-parser  concerto-cto (addCTOModel's parse, TS on both engines)
//   gc          the garbage collector
//   other       node internals, the harness, (program)/(idle)

import fs from 'fs';

const file = process.argv[2];
const asJson = process.argv.includes('--json');
const prof = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of prof.nodes) {
    for (const c of n.children || []) {
        parent.set(c, n.id);
    }
}

// Only samples under the measured loop count (not module loading or setup).
function measured(id) {
    for (let n = byId.get(id); n; n = byId.get(parent.get(n.id))) {
        if (n.callFrame.functionName === 'p515MeasuredLoop') {
            return true;
        }
    }
    return false;
}

function stageOf(id) {
    let node = byId.get(id);
    const leaf = node.callFrame;
    if (leaf.functionName === 'wasm-to-js' || leaf.functionName === 'js-to-wasm') {
        return 'glue';
    }
    if (leaf.functionName === '(garbage collector)') {
        return 'gc';
    }
    if (leaf.functionName === '(program)' || leaf.functionName === '(idle)' || leaf.functionName === '(root)') {
        return 'other';
    }
    // Walk up through native builtins, noting JSON.stringify/parse.
    while (node && !node.callFrame.url) {
        const fn = node.callFrame.functionName;
        if (fn === 'stringify' || fn === 'JSONStringify') {
            return 'encode';
        }
        if (fn === 'parse' || fn === 'JSONParse') {
            return 'decode';
        }
        node = byId.get(parent.get(node.id));
    }
    if (!node) {
        return 'other';
    }
    const { url, functionName } = node.callFrame;
    if (url.startsWith('wasm://')) {
        return 'core';
    }
    if (/concerto-engine|concerto-wasm\/pkg/.test(url)) {
        return 'glue';
    }
    if (/concerto-cto\//.test(url)) {
        return 'cto-parser';
    }
    if (/concerto-core\/dist\//.test(url)) {
        if (/\/engine\/serializer(-codec)?\.js$/.test(url)) {
            if (/decode|materiali|setOwn|modelClasses/i.test(functionName)) {
                return 'decode';
            }
            return 'encode';
        }
        if (/\/engine\/views(-[a-z]+)?\.js$|\/introspect\//.test(url)) {
            return 'views';
        }
        return 'ts-core';
    }
    return 'other';
}

const stages = {};
const frames = {};
let total = 0;
prof.samples.forEach((id, i) => {
    const dt = prof.timeDeltas[i] || 0;
    const s = byId.get(id).callFrame.functionName === '(garbage collector)' ? 'gc' : measured(id) ? stageOf(id) : null;
    if (s === null) {
        return;
    }
    stages[s] = (stages[s] || 0) + dt;
    total += dt;
    const leaf = byId.get(id).callFrame;
    const key = `${s} | ${leaf.functionName || '(anon)'} ${leaf.url.split('/').slice(-2).join('/')}`;
    frames[key] = (frames[key] || 0) + dt;
});

const out = {
    file,
    totalMs: total / 1000,
    stages: Object.fromEntries(
        Object.entries(stages).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Number(((100 * v) / total).toFixed(1))]),
    ),
    topFrames: Object.entries(frames).sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([k, v]) => [k, Number(((100 * v) / total).toFixed(1))]),
};
if (asJson) {
    console.log(JSON.stringify(out));
} else {
    console.log(`${file}: ${out.totalMs.toFixed(0)} ms sampled`);
    for (const [k, v] of Object.entries(out.stages)) {
        console.log(`  ${String(v).padStart(5)}%  ${k}`);
    }
    console.log('  top self frames:');
    for (const [k, v] of out.topFrames) {
        console.log(`  ${String(v).padStart(5)}%  ${k}`);
    }
}
