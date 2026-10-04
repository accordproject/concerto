#!/usr/bin/env node
// P5-90 (accordproject/concerto-rust#436): the Phase 0 wall-time split of a
// TS-API load op (new ModelFile, addModelFile, addCTOModel, extract_cold),
// from a V8 CPU profile of `p515-sweep.mjs --mode loop` (node --cpu-prof),
// taken with an engine built with its function names kept
// (p590-engine-build.sh ... named). Measure only.
//
//   node migration/bench/p590-split.mjs <file.cpuprofile>... [--json]
//
// Several profiles (p590-profile.mjs writes one per profiled stretch) are
// summed.
//
// Unlike p515-cpuprof.mjs, the JS self time is split by source line
// (the profile's positionTicks), because V8 shows JSON.stringify,
// TextEncoder.encodeInto, JSON.parse and the WeakMap builtins as the self
// time of the line that calls them. Each self sample lands in one bucket:
//
//   stringify      a JS line that calls JSON.stringify (the AST text, and
//                  the memo keys built from it)
//   utf8-encode    the AST text's UTF-8 encode (`utf8Text`, encodeInto)
//   call-copy      the JS-to-engine call and copy: the wasm-bindgen glue
//                  (concerto-engine.cjs), js-to-wasm/wasm-to-js, and the
//                  result string's decode out of WASM memory
//   wasm           the engine (WASM), split by the binding on the stack
//                  and into the allocator (dlmalloc/talc, memcpy) and the rest
//   parse          a views/introspect line that calls JSON.parse (the
//                  engine's staged header or result text)
//   weak           FileSlot and WeakMap/WeakSet/FinalizationRegistry ops
//                  of the lazy-view bookkeeping
//   views          the rest of engine/views*.js and introspect/*
//                  (process, _fromAstHeader, deferDeclarations, ...), by
//                  function
//   cto-parse      concerto-cto (addCTOModel's parse)
//   gc             the garbage collector
//   ts-core        any other concerto-core dist module
//   other          node internals and the harness
//
// The phase split names, for each self sample, the first of these on its
// stack (leaf first): the extract result-manager build (`adoptStagedModels`),
// the extract binding, `restoreAllUndefinedDecorators`, `addModelFile`,
// the `ModelFile` constructor, `addCTOModel`, `new ModelManager`.

import fs from 'fs';
import url from 'url';

const files = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const file = files.length === 1 ? files[0] : `${files.length} profiles`;
const asJson = process.argv.includes('--json');
let byId;
let parent;

const ALLOC = /dlmalloc|__rust_alloc|__rust_dealloc|__rust_realloc|__rdl_|__rg_|finish_grow|do_reserve_and_handle|grow_one|grow_amortized|alloc::alloc::|talc::|Talc|\bmalloc\b|\bfree\b|realloc|memcpy|memmove|memset/;
const WEAK_NAMES = /\b(fileStates|stages|committed|acceptedUnmirrored|stagedFileHeaders|importNamesMemo|lazyFiles|systemModelAsts|shapeChecked|shapePending|prestaged|stagedHeaders|dcsResidents|deferredFiles|pendingFields|propertyLookups|identifierEntries|stageFinalizer)\??\.(get|set|has|delete|add|register|unregister)\(/;
const PHASES = [
    ['result-manager build (adoptStagedModels)', /^adoptStagedModels$/],
    ['restoreAllUndefinedDecorators', /^restoreAllUndefinedDecorators$/],
    ['extract binding', /^(dcsExtract\w*|extract\w*)$/, 'glue'],
    ['addModelFile', /^addModelFile$/],
    ['new ModelFile', /^ModelFile$/],
    ['addCTOModel', /^addCTOModel$/],
    ['new ModelManager', /^(ModelManager|BaseModelManager|clearModelFiles)$/],
];

const sourceCache = new Map();
function lineText(u, line) {
    if (!u.startsWith('file://')) {
        return '';
    }
    if (!sourceCache.has(u)) {
        try {
            sourceCache.set(u, fs.readFileSync(url.fileURLToPath(u), 'utf8').split('\n'));
        } catch (e) {
            sourceCache.set(u, []);
        }
    }
    return sourceCache.get(u)[line - 1] || '';
}

function isGlue(u) {
    return /concerto-engine|concerto-wasm\/pkg|\/pkg\/node\//.test(u);
}

function stackOf(id) {
    const out = [];
    for (let n = byId.get(id); n; n = byId.get(parent.get(n.id))) {
        out.push(n);
    }
    return out;
}

function measured(stack) {
    return stack.some((n) => n.callFrame.functionName === 'p515MeasuredLoop');
}

// The binding a WASM sample runs under: the nearest glue frame's name.
function bindingOf(stack) {
    for (const n of stack) {
        const cf = n.callFrame;
        if (isGlue(cf.url) && cf.functionName && !/^(passArray|passString|getString|getArray|decodeText|getUint8|getDataView|handleError|takeObject|addHeapObject|__wbg)/.test(cf.functionName)) {
            return cf.functionName;
        }
    }
    return '?';
}

// The first phase in PHASES order found anywhere on the stack, so a
// ModelFile built inside adoptStagedModels counts as the result-manager
// build, and one built inside addCTOModel as `new ModelFile`.
function phaseOf(stack) {
    for (const [name, re, where] of PHASES) {
        if (stack.some((n) => re.test(n.callFrame.functionName) && (where !== 'glue' || isGlue(n.callFrame.url)))) {
            return name;
        }
    }
    return '(none)';
}

// The engine side of the extract binding, by the Rust functions on the
// stack (a named engine build), first match.
const EXTRACT_WASM = [
    ['drop (destructors, free)', /drop_in_place|as core::ops::drop::Drop>::drop|dlmalloc.*::free|__rust_dealloc/],
    ['result encode (JSON text, JSON.parse to JS)', /result_js|ser::Serialize|serialize_str|collect_seq|serde_json::ser::|js_sys::JSON::parse|compact/],
    ['result staging (ModelFile build, header, register)', /from_owned_json|ModelFile::load|typed_ast::|staged_header|insert_shared|add_loaded_model_file|validate_model|Declaration::from_typed/],
    ['source models AST (models_ast)', /ModelManager::models_ast/],
    ['extract logic (DecoratorExtractor)', /DecoratorExtractor|dcs::extract|collect_models/],
];
function extractSubOf(stack) {
    const names = stack.filter((n) => n.callFrame.url.startsWith('wasm://')).map((n) => n.callFrame.functionName);
    for (const [name, re] of EXTRACT_WASM) {
        if (names.some((f) => re.test(f))) {
            return name;
        }
    }
    return 'other';
}

// Bucket of a node's self time on one line (line is 1-based, or 0).
function bucketOf(node, stack, line) {
    const cf = node.callFrame;
    const fn = cf.functionName;
    if (fn === '(garbage collector)') {
        return ['gc', 'gc'];
    }
    if (cf.url.startsWith('wasm://') && fn !== 'wasm-to-js' && fn !== 'js-to-wasm') {
        const b = bindingOf(stack);
        const sub = /extract/i.test(b) ? ` | ${extractSubOf(stack)}` : '';
        return ['wasm', `wasm ${b} ${ALLOC.test(fn) ? 'alloc' : 'other'}${sub}`];
    }
    if (fn === 'wasm-to-js' || fn === 'js-to-wasm') {
        return ['call-copy', `call-copy ${fn}`];
    }
    // A builtin (no URL): its nearest sourced caller decides, by that
    // caller's file (the builtin's line is the caller's call site, which
    // the caller's own positionTicks do not cover).
    // Node's own JS wrappers (node:internal/encoding's encodeInto and
    // decode) count as their caller's, as builtins do.
    let src = node;
    let i = 0;
    while (src && (!src.callFrame.url || src.callFrame.url.startsWith('node:'))) {
        src = stack[++i];
    }
    if (!src) {
        return ['other', `other ${fn}`];
    }
    const u = src.callFrame.url;
    const sfn = src.callFrame.functionName || '(anon)';
    if (isGlue(u)) {
        return ['call-copy', `call-copy ${sfn}${src === node ? '' : ` > ${fn}`}`];
    }
    if (/concerto-cto\//.test(u)) {
        return ['cto-parse', 'cto-parse'];
    }
    if (/concerto-core\/dist\//.test(u)) {
        const views = /\/engine\/views(-[a-z]+)?\.js$|\/introspect\//.test(u);
        const text = src === node ? lineText(u, line) : '';
        if (sfn === 'utf8Text' || /encodeInto|utf8Encoder/.test(text)) {
            return ['utf8-encode', 'utf8-encode'];
        }
        if (/JSON\.stringify/.test(text) || /^(stringify|JSONStringify)$/.test(fn)) {
            return ['stringify', `stringify ${sfn}`];
        }
        if (views && (/JSON\.parse/.test(text) || /^(parse|JSONParse)$/.test(fn))) {
            return ['parse', `parse ${sfn}`];
        }
        if (/\/engine\/views(-[a-z]+)?\.js$/.test(u) && (/^(get|set|has|add|delete)$/.test(sfn) && /fileStates|state\[this\.field\]|this\.set\(/.test(lineText(u, line)) || WEAK_NAMES.test(text) || /^Weak|FinalizationRegistry/.test(fn))) {
            return ['weak', `weak ${sfn}`];
        }
        if (views) {
            return ['views', `views ${sfn}`];
        }
        return ['ts-core', `ts-core ${sfn} ${u.split('/').slice(-1)[0]}`];
    }
    return ['other', `other ${sfn}`];
}

const bucket = {};
const detail = {};
const phase = {};
let total = 0;
for (const f of files) {
const prof = JSON.parse(fs.readFileSync(f, 'utf8'));
byId = new Map(prof.nodes.map((n) => [n.id, n]));
parent = new Map();
for (const n of prof.nodes) {
    for (const c of n.children || []) {
        parent.set(c, n.id);
    }
}
const selfByNode = new Map();
prof.samples.forEach((id, i) => {
    selfByNode.set(id, (selfByNode.get(id) || 0) + (prof.timeDeltas[i] || 0));
});
for (const [id, dt] of selfByNode) {
    const node = byId.get(id);
    const stack = stackOf(id);
    const isGc = node.callFrame.functionName === '(garbage collector)';
    if (!isGc && !measured(stack)) {
        continue;
    }
    const ticks = node.positionTicks && node.positionTicks.length ? node.positionTicks : [{ line: 0, ticks: 1 }];
    const sum = ticks.reduce((x, t) => x + t.ticks, 0);
    const ph = isGc ? 'gc' : phaseOf(stack);
    for (const t of ticks) {
        const share = (dt * t.ticks) / sum;
        const [b, d] = bucketOf(node, stack, t.line);
        bucket[b] = (bucket[b] || 0) + share;
        detail[d] = (detail[d] || 0) + share;
        const pk = `${ph} | ${b}`;
        phase[pk] = (phase[pk] || 0) + share;
        total += share;
    }
}
}

const pct = (v) => Number(((100 * v) / total).toFixed(1));
const sorted = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, pct(v)]);
const out = { file, totalMs: total / 1000, buckets: Object.fromEntries(sorted(bucket, 99)), detail: sorted(detail, 60), phases: sorted(phase, 40) };
if (asJson) {
    console.log(JSON.stringify(out));
} else {
    console.log(`${file}: ${out.totalMs.toFixed(0)} ms sampled`);
    for (const [k, v] of Object.entries(out.buckets)) {
        console.log(`  ${String(v).padStart(5)}%  ${k}`);
    }
    console.log('  detail:');
    for (const [k, v] of out.detail) {
        console.log(`  ${String(v).padStart(5)}%  ${k}`);
    }
    console.log('  phase | bucket:');
    for (const [k, v] of out.phases) {
        console.log(`  ${String(v).padStart(5)}%  ${k}`);
    }
}
