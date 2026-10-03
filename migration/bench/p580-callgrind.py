#!/usr/bin/env python3
"""P5-80 (accordproject/concerto-rust#424): how much of an instance op is
model-graph work, from a callgrind profile of concerto-rust's
`benches/examples/p580_profile.rs` (valgrind --tool=callgrind
--toggle-collect='p580_profile::op_*').

    python3 migration/bench/p580-callgrind.py [--json] <callgrind.out> [...]

The model-graph work is the cost of every call into a model-graph function
(the GRAPH patterns below) from a function that is not one: the inclusive
cost of the boundary call edges, read from callgrind's raw call records, so
a graph function calling another is counted once. Each boundary edge goes to
the bucket of the function it calls. What is left is instance handling (the
walk over the value, building results, allocation, errors not raised).

Caveats: callgrind counts instructions (Ir), not time; a model-graph
function the compiler inlined into an instance function counts as instance
work, so the graph share is a floor for the named functions.
"""
import json
import re
import sys

# (bucket, pattern over the demangled name); first match wins.
GRAPH = [
    ('identifier field', r'ModelManager::identifier_field(_of)?\b|TypeRef::identifier_field_name|TypeRef::is_identified|TypeRef::is_system_identified|identifiable_field_name|model::identifier_regex'),
    ('super types / assignability', r'ModelManager::(is_assignable_to|is_type_assignable_to|derives_from|super_chain|super_type_fqn|class_info)\b'),
    ('property lookup', r'ModelManager::(class_properties_of|properties)\b|ClassProperties::(find|contains)\b|TypeRef::propert(y|ies)\b'),
    ('regex / validator build', r'StringValidator::new|NumberValidator::new|CollectionSizeValidator::new|validators::compile_regex|number_validator_ast|FieldElement::new|serde_json::value::de::.*from_value|serde_json::value::from_value'),
    ('declaration lookup / type resolution', r'instance::model::get_type\b|instance::model::field\b|ModelManager::(declaration_id|type_declaration|type_declaration_impl|get_type_declaration|get_declaration|resolve_type_name_at|resolve_type_name_lazy|model_file|model_file_of|decl_fqn|declaration)\b|validate::resolve_object_target|validate::mm_resolve|ModelFile::resolve_local_type'),
    ('cached per-type facts', r'ModelManager::cached_instance_facts|populator::field_defaults|from_json::field_defaults'),
    ('validation plan (prototype)', r'instance::plan::'),
]
GRAPH_RE = [(b, re.compile(p)) for b, p in GRAPH]


def bucket_of(name, cache={}):
    if name not in cache:
        cache[name] = next((b for b, r in GRAPH_RE if r.search(name)), None)
    return cache[name]


def parse(path):
    names = {}
    self_cost = {}
    edges = {}
    fn = None
    cfn = None
    pending = False
    total_summary = None

    def name_of(spec):
        m = re.match(r'\((\d+)\)(?:\s+(.*))?', spec)
        if not m:
            return spec
        i, n = m.group(1), m.group(2)
        if n:
            names[i] = n
        return names.get(i, '?' + i)

    with open(path, errors='replace') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            c = line[0]
            if c.isdigit() or c in '+-*':
                parts = line.split()
                cost = int(parts[1]) if len(parts) > 1 else 0
                if pending:
                    edges[(fn, cfn)] = edges.get((fn, cfn), 0) + cost
                    pending = False
                else:
                    self_cost[fn] = self_cost.get(fn, 0) + cost
                continue
            if line.startswith('fn='):
                fn = name_of(line[3:])
            elif line.startswith('cfn='):
                cfn = name_of(line[4:])
            elif line.startswith('calls='):
                pending = True
            elif line.startswith('summary:') or line.startswith('totals:'):
                total_summary = int(line.split()[1])
    return self_cost, edges, total_summary


def analyse(path):
    self_cost, edges, summary = parse(path)
    total = sum(self_cost.values())
    buckets = {}
    for (caller, callee), cost in edges.items():
        b = bucket_of(callee)
        if b is None or bucket_of(caller) is not None:
            continue
        buckets[b] = buckets.get(b, 0) + cost
    graph = sum(buckets.values())
    return {
        'file': path,
        'total_ir': total,
        'summary_ir': summary,
        'graph_ir': graph,
        'graph_share': graph / total if total else 0.0,
        'buckets': dict(sorted(buckets.items(), key=lambda kv: -kv[1])),
    }


def main():
    args = sys.argv[1:]
    as_json = False
    if args and args[0] == '--json':
        as_json = True
        args = args[1:]
    out = [analyse(p) for p in args]
    if as_json:
        print(json.dumps(out, indent=2))
        return
    for r in out:
        print(f"{r['file']}: total {r['total_ir']:,} Ir, model graph {r['graph_ir']:,} ({100 * r['graph_share']:.1f}%)")
        for b, v in r['buckets'].items():
            print(f"  {b:40s} {v:>14,} {100 * v / r['total_ir']:5.1f}%")


if __name__ == '__main__':
    main()
