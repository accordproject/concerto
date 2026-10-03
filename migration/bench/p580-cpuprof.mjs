#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// P5-80 (accordproject/concerto-rust#424), analysis only: how much of a
// TS-API instance op is model-graph work inside the WASM engine, from a V8
// CPU profile of `p515-sweep.mjs --mode loop` run against a concerto-wasm
// build that keeps its name section (wasm-bindgen --keep-debug).
//
//   node migration/bench/p580-cpuprof.mjs [--json] <file.cpuprofile> [...]
//
// Only samples under the measured loop count. A sample is model-graph work
// when any frame on its stack is a model-graph function (the GRAPH patterns,
// the same as p580-callgrind.py's); it is put in the bucket of the
// outermost such frame, so nested graph calls count once. Also reported:
// the share of samples whose leaf is in WASM, and the share under the
// prototype's plan functions.

import fs from 'fs';

const GRAPH = [
    ['identifier field', /ModelManager::identifier_field(_of)?\b|TypeRef::identifier_field_name|TypeRef::is_identified|TypeRef::is_system_identified|identifiable_field_name|model::identifier_regex/],
    ['super types / assignability', /ModelManager::(is_assignable_to|is_type_assignable_to|derives_from|super_chain|super_type_fqn|class_info)\b/],
    ['property lookup', /ModelManager::(class_properties_of|properties)\b|ClassProperties::(find|contains)\b|TypeRef::propert(y|ies)\b/],
    ['regex / validator build', /StringValidator::new|NumberValidator::new|CollectionSizeValidator::new|validators::compile_regex|number_validator_ast|FieldElement::new|serde_json::value::from_value/],
    ['declaration lookup / type resolution', /instance::model::get_type\b|instance::model::field\b|ModelManager::(declaration_id|type_declaration|type_declaration_impl|get_type_declaration|get_declaration|resolve_type_name_at|resolve_type_name_lazy|model_file|model_file_of|decl_fqn|declaration)\b|validate::resolve_object_target|validate::mm_resolve|ModelFile::resolve_local_type/],
    ['cached per-type facts', /ModelManager::cached_instance_facts|populator::field_defaults|from_json::field_defaults/],
    ['validation plan (prototype)', /instance::plan::/],
];

function bucketOf(name) {
    for (const [b, r] of GRAPH) {
        if (r.test(name)) {
            return b;
        }
    }
    return null;
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
    const memo = new Map();
    // [measured, outermost graph bucket or null]
    function classify(id) {
        if (memo.has(id)) {
            return memo.get(id);
        }
        const chain = [];
        for (let n = byId.get(id); n; n = byId.get(parent.get(n.id))) {
            chain.push(n);
        }
        let measured = false;
        let bucket = null;
        for (let i = chain.length - 1; i >= 0; i--) {
            const name = chain[i].callFrame.functionName;
            if (name === 'p515MeasuredLoop') {
                measured = true;
            } else if (measured && bucket === null) {
                bucket = bucketOf(name);
            }
        }
        const r = [measured, bucket];
        memo.set(id, r);
        return r;
    }
    let total = 0;
    let wasm = 0;
    const buckets = {};
    for (const id of prof.samples) {
        const [measured, bucket] = classify(id);
        if (!measured) {
            continue;
        }
        total++;
        if ((byId.get(id).callFrame.url || '').startsWith('wasm://')) {
            wasm++;
        }
        if (bucket) {
            buckets[bucket] = (buckets[bucket] || 0) + 1;
        }
    }
    const graph = Object.values(buckets).reduce((a, b) => a + b, 0);
    return { file, samples: total, wasmShare: total ? wasm / total : 0, graphShare: total ? graph / total : 0, buckets };
}

const args = process.argv.slice(2);
const asJson = args[0] === '--json';
const files = asJson ? args.slice(1) : args;
const out = files.map(analyse);
if (asJson) {
    console.log(JSON.stringify(out, null, 2));
} else {
    for (const r of out) {
        console.log(`${r.file}: ${r.samples} samples, leaf in WASM ${(100 * r.wasmShare).toFixed(1)}%, model graph ${(100 * r.graphShare).toFixed(1)}%`);
        for (const [b, v] of Object.entries(r.buckets).sort((x, y) => y[1] - x[1])) {
            console.log(`  ${b.padEnd(40)} ${(100 * v / r.samples).toFixed(1)}%`);
        }
    }
}
