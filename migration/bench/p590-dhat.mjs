#!/usr/bin/env node
// P5-90 (accordproject/concerto-rust#436), Phase 0, measure only: the
// native allocation profile of the typed read (`stageModelFileChecked`'s
// `ModelFile::from_json_text_checked_with_imports`), from a
// `valgrind --tool=dhat` run of concerto-rust's
// `benches/examples/p590_typed_read.rs loop`.
//
//   node migration/bench/p590-dhat.mjs <dhat.json> <loads> [--json]
//
// <loads>: the typed reads the run made (iterations x model files), to
// give per-file figures. Only allocation points under
// `p590_typed_read::typed_read` count (not the fixture load). Each point is
// put in one kind (first match, by its whole stack) and one origin (the
// innermost concerto_core function on its stack).

import fs from 'fs';

const [file, loadsArg] = process.argv.slice(2);
const asJson = process.argv.includes('--json');
const loads = Number(loadsArg);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const frame = (i) => d.ftbl[i].replace(/^0x[0-9A-F]+: /i, '');

const KINDS = [
    ['serde_json::Value nodes (and their maps/strings)', /serde_json::value|ValueVisitor|serde_json::map::/],
    ['Kept nodes (P5-76 JSON tree)', /introspect::kept::/],
    ['owned Strings decoded from the JSON text', /visit_str|visit_string|StringVisitor|deserialize_string|<alloc::string::String as serde_core::de::Deserialize>/],
    ['Vec/String growth (realloc, grow_one, reserve)', /grow_one|finish_grow|do_reserve_and_handle|grow_amortized|reserve_for_push|RawVecInner.*reserve/],
    ['string copies (to_owned, to_string, format!)', /<str as alloc::borrow::ToOwned>|to_owned|to_string|String::from|<alloc::string::String as core::clone::Clone>|alloc::fmt::format|format_inner/],
    ['clones (Clone::clone of other types)', /as core::clone::Clone>::clone/],
    ['hash/index tables (IndexMap, HashMap, HashSet)', /hashbrown|indexmap|RawTable/],
    ['Box::new (boxed nodes)', /exchange_malloc|Box<.*>::new|alloc::boxed::/],
    ['Arc/Rc', /alloc::sync::Arc|alloc::rc::Rc/],
    ['Vec collect / with_capacity (sized once)', /from_iter|with_capacity|SpecFromIter|collect|allocate_in|try_allocate_in/],
];

const kinds = {};
const origins = {};
const points = [];
let blocks = 0;
let bytes = 0;
for (const pp of d.pps) {
    const fs_ = pp.fs.map(frame);
    if (!fs_.some((f) => /p590_typed_read::typed_read/.test(f))) {
        continue;
    }
    const stack = fs_.join('\n');
    const kind = (KINDS.find(([, re]) => re.test(stack)) || ['other'])[0];
    // The innermost frame of concerto-core's own source: debug info names
    // a local crate's file by its bare name (`typed_ast.rs:222`), where std
    // and the dependencies carry a path (`src/de.rs`, `library/alloc/...`).
    const originFrame = fs_.find((f) => /\(([a-z_0-9]+\.rs):\d+\)$/.test(f) && !/p590_typed_read\.rs|\((alloc|mod|raw|boxed|string|str|vec|slice|impls|de|macros|lib|function|map|inner|clone|borrow|fmt|iter|spec_from_iter_nested|spec_extend|rt|spec_from_elem|set_len_on_drop|cow|option|result)\.rs:/.test(f)) || '(none)';
    const m = /^(.*) \(([a-z_0-9]+\.rs:\d+)\)$/.exec(originFrame);
    const origin = m ? `${m[2]} ${m[1].replace(/<[^<>]*>/g, '').replace(/<[^<>]*>/g, '').replace(/^.*::/, '').slice(0, 60)}` : originFrame;
    for (const [o, k] of [[kinds, kind], [origins, origin]]) {
        const e = o[k] || (o[k] = { blocks: 0, bytes: 0 });
        e.blocks += pp.tbk;
        e.bytes += pp.tb;
    }
    blocks += pp.tbk;
    bytes += pp.tb;
    points.push({ kind, origin, blocks: pp.tbk, bytes: pp.tb, site: fs_.slice(1).filter((f) => !/library\/alloc\/|library\/core\/|raw_vec|hashbrown|vgpreload|^UnknownInlinedFun \((alloc|mod|raw)\.rs/.test(f)).slice(0, 4).map((f) => f.replace(/ \((.*)\)$/, ' @$1')).join(' < ') });
}

const per = (e) => ({ blocksPerLoad: Number((e.blocks / loads).toFixed(1)), bytesPerLoad: Math.round(e.bytes / loads), blockShare: Number(((100 * e.blocks) / blocks).toFixed(1)), byteShare: Number(((100 * e.bytes) / bytes).toFixed(1)) });
const table = (o) => Object.entries(o).sort((a, b) => b[1].blocks - a[1].blocks).map(([k, e]) => ({ key: k, ...per(e) }));
const out = {
    file, loads, blocksPerLoad: blocks / loads, bytesPerLoad: bytes / loads,
    kinds: table(kinds),
    origins: table(origins).slice(0, 25),
    topPoints: points.sort((a, b) => b.blocks - a.blocks).slice(0, 15).map((p) => ({ ...p, ...per(p), blocks: undefined, bytes: undefined })),
};
if (asJson) {
    console.log(JSON.stringify(out, null, 2));
} else {
    console.log(`${file}: ${out.blocksPerLoad.toFixed(1)} allocations, ${out.bytesPerLoad.toFixed(0)} bytes per load`);
    for (const [title, rows] of [['by kind', out.kinds], ['by origin', out.origins]]) {
        console.log(`  ${title}: allocs/load (share) bytes/load (share)`);
        for (const r of rows) {
            console.log(`    ${String(r.blocksPerLoad).padStart(8)} (${String(r.blockShare).padStart(4)}%) ${String(r.bytesPerLoad).padStart(9)} (${String(r.byteShare).padStart(4)}%)  ${r.key}`);
        }
    }
    console.log('  top allocation points:');
    for (const p of out.topPoints) {
        console.log(`    ${String(p.blocksPerLoad).padStart(8)} ${String(p.bytesPerLoad).padStart(9)}  [${p.kind}] ${p.site.slice(0, 260)}`);
    }
}
