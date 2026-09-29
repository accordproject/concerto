#!/usr/bin/env node
// P5-48 (accordproject/concerto-rust#369): the symbolised WASM half of the
// model-loading profile. Buckets a V8 CPU profile of
// `p515-sweep.mjs --mode loop` (node --cpu-prof), taken with an engine
// built with its function names kept (see RESULTS.md, P5-48, for the
// build), the way p548-callgrind.py buckets the native profile.
//
//   node migration/bench/p548-wasmprof.mjs <file.cpuprofile> [...]
//
// For each profile, over the samples under the measured loop only:
//   - the p515-cpuprof.mjs stage split is left to that script;
//   - WASM self time by bucket (first match wins, by function name);
//   - the inclusive share of the concerto-core stages the task attributes
//     time to (a sample counts once for a stage when any frame on its stack
//     matches it).

import fs from 'fs';

const SELF_BUCKETS = [
    ['allocator (dlmalloc malloc/free/realloc)', /dlmalloc|__rust_alloc|__rust_dealloc|__rust_realloc|__rdl_|finish_grow|do_reserve_and_handle|alloc::alloc::|\bmalloc\b|\bfree\b|realloc/],
    ['memcpy/memmove/memcmp', /memcpy|memmove|memcmp|memset|bcmp|memchr|memrchr/],
    ['hashing (SipHash, FxHash)', /sip::|Sip13|Sip24|hash_one|BuildHasher|FxHasher|rustc_hash|core::hash::/],
    ['IndexMap/HashMap tables', /indexmap::|hashbrown::|RawTable|RawIter/],
    ['drop (destructors)', /drop_in_place/],
    ['clone', /as core::clone::Clone>::clone|to_owned|to_vec/],
    ['string building (fmt, format!)', /core::fmt::|alloc::fmt::|fmt::Write|write_str|write_fmt|pad_integral|Display/],
    ['JSON decode (serde_json de, typed AST read)', /serde_json::de|serde_json::read|typed_ast|serde_core::de|Deserialize|Deserializer|Visitor|MapAccess|SeqAccess|parse_str|skip_to_escape/],
    ['Value build/encode (serde_json ser, to_value)', /serde_json::value::ser|serde_core::ser|Serialize|serde_json::value|location_value/],
    ['regex / identifier checks', /regress|is_valid_identifier|ecma::/],
    ['concerto-core logic', /concerto_core/],
];

const STAGES = [
    ['typed-AST decode (typed_ast::parse)', /concerto_core::introspect::typed_ast::parse\b/],
    ['ModelFile build after decode (ModelFile::load)', /concerto_core::introspect::model_file::ModelFile::load::/],
    ['detached validation (validate_detached_model_file)', /validate_detached_model_file/],
    ['  scratch manager (with_model_file_registered)', /with_model_file_registered/],
    ['in-place validation (validate_and_add_model_file)', /validate_and_add_model_file/],
    ['declaration checks (Declaration::validate)', /Validate for concerto_core::introspect::declaration::Declaration>::validate/],
    ['error locations built eagerly (location_value)', /location_value/],
    ['register (add_model_file / insert)', /ModelManager::add_model_file|ModelManager::insert_shared|ModelManager::insert::/],
    ['ModelManager::new', /ModelManager::new::/],
    ['header JSON (stageModelFileWithHeader encode)', /staged_header|snapshot/],
];

function strip(name) {
    return name.replace(/::h[0-9a-f]{16}(\.\d+)?$/, '');
}

function analyse(file) {
    const prof = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byId = new Map(prof.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of prof.nodes) {
        for (const c of n.children || []) {
            parent.set(c, n.id);
        }
    }
    const stackOf = (id) => {
        const out = [];
        for (let n = byId.get(id); n; n = byId.get(parent.get(n.id))) {
            out.push(n.callFrame);
        }
        return out;
    };
    let measured = 0;
    let wasm = 0;
    const self = new Map(SELF_BUCKETS.map(([b]) => [b, 0]));
    self.set('other WASM', 0);
    const stages = new Map(STAGES.map(([s]) => [s, 0]));
    for (const id of prof.samples) {
        const stack = stackOf(id);
        if (!stack.some((f) => f.functionName === 'p515MeasuredLoop')) {
            continue;
        }
        measured++;
        const leaf = stack[0];
        if (leaf.url.startsWith('wasm')) {
            wasm++;
            const name = strip(leaf.functionName);
            const bucket = SELF_BUCKETS.find(([, re]) => re.test(name));
            const key = bucket ? bucket[0] : 'other WASM';
            self.set(key, self.get(key) + 1);
        }
        for (const [label, re] of STAGES) {
            if (stack.some((f) => f.url.startsWith('wasm') && re.test(strip(f.functionName)))) {
                stages.set(label, stages.get(label) + 1);
            }
        }
    }
    const pct = (n, d) => `${(100 * n / d).toFixed(1)}%`;
    console.log(`## ${file}: ${measured} samples in the measured loop, ${pct(wasm, measured)} in WASM`);
    console.log('| WASM self-time bucket | share of WASM | share of all |');
    console.log('|---|---:|---:|');
    for (const [b, n] of [...self].sort((a, b) => b[1] - a[1])) {
        console.log(`| ${b} | ${pct(n, wasm)} | ${pct(n, measured)} |`);
    }
    console.log('');
    console.log('| stage (inclusive, WASM frames) | share of all |');
    console.log('|---|---:|');
    for (const [s, n] of stages) {
        if (n > 0) {
            console.log(`| ${s} | ${pct(n, measured)} |`);
        }
    }
    console.log('');
}

for (const file of process.argv.slice(2)) {
    analyse(file);
}
