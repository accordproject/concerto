#!/usr/bin/env python3
"""P5-48 (accordproject/concerto-rust#369): buckets a callgrind profile of
concerto-core's `load_profile` example (valgrind --tool=callgrind
--toggle-collect='load_profile::<op>') the way P5-12d's flame.py bucketed
macOS `sample` profiles, for Linux, where `sample` is not available.

    python3 migration/bench/p548-callgrind.py <file.cg> [...]

For each profile, prints:
  - self cost (instructions, Ir) by bucket: every function's own
    instructions are put in one bucket by its name (first match wins);
  - inclusive cost of the concerto-core stages the task attributes time to.

Callgrind counts instructions, not time: allocator and hashing work is
cheap per instruction, cache misses are free, so shares are indicative.
"""
import re
import subprocess
import sys

SELF_BUCKETS = [
    ('allocator (malloc/free/realloc)', r'malloc|_int_free|\bfree\b|realloc|unlink_chunk|__rust_alloc|__rust_dealloc|__rust_realloc|__rdl_|finish_grow|do_reserve_and_handle|alloc::alloc::|tcache|consolidate|cfree'),
    ('memcpy/memmove/memcmp', r'memcpy|memmove|memcmp|memset|bcmp|memchr|memrchr|strlen'),
    ('hashing (SipHash, FxHash)', r'sip::|Sip13|Sip24|hash_one|BuildHasher|FxHasher|rustc_hash|core::hash::'),
    ('IndexMap/HashMap tables', r'indexmap::|hashbrown::|RawTable|RawIter'),
    ('drop (destructors)', r'drop_in_place'),
    ('clone', r'as core::clone::Clone>::clone|to_owned|to_vec'),
    ('string building (fmt, format!)', r'core::fmt::|alloc::fmt::|fmt::Write|write_str|write_fmt|pad_integral|Display'),
    ('JSON decode (serde_json de, typed AST read)', r'serde_json::de|serde_json::read|typed_ast|serde_core::de|Deserialize|Deserializer|Visitor|MapAccess|SeqAccess|parse_str|skip_to_escape'),
    ('Value build/encode (serde_json ser, to_value)', r'serde_json::value::ser|serde_core::ser|Serialize|serde_json::value|location_value'),
    ('regex / identifier checks', r'regress|is_valid_identifier|ecma::'),
    ('concerto-core logic', r'concerto_core'),
]

STAGES = [
    ('typed-AST decode (typed_ast::parse)', 'concerto_core::introspect::typed_ast::parse'),
    ('ModelFile build after decode (ModelFile::load)', 'concerto_core::introspect::model_file::ModelFile::load'),
    ('  declaration/property construction (Declaration::from_typed)', 'concerto_core::introspect::declaration::Declaration::from_typed'),
    ('  Value-path declarations (Declaration::from_model_json)', 'concerto_core::introspect::declaration::Declaration::from_model_json'),
    ('  namespace/import parse (parse_namespace_with)', 'concerto_core::model_util::parse_namespace_with'),
    ('detached validation (validate_detached_model_file)', 'concerto_core::validation::<impl concerto_core::model_manager::ModelManager>::validate_detached_model_file'),
    ('  scratch manager (with_model_file_registered)', 'concerto_core::model_manager::ModelManager::with_model_file_registered'),
    ('  ModelFile clone', '<concerto_core::introspect::model_file::ModelFile as core::clone::Clone>::clone'),
    ('  check_imports', 'concerto_core::validation::check_imports'),
    ('  declaration checks (Declaration::validate)', 'concerto_core::validation::<impl concerto_core::introspect::traits::Validate for concerto_core::introspect::declaration::Declaration>::validate'),
    ('  check_unique_field_names', 'concerto_core::validation::check_unique_field_names'),
    ('  ModelManager::properties (super-chain property lists)', 'concerto_core::model_manager::ModelManager::properties'),
    ('  super_type_fqn', 'concerto_core::model_manager::ModelManager::super_type_fqn'),
    ('  error locations built eagerly (location_value)', 'concerto_core::error::location_value::js_numbers'),
    ('in-place validate and register (validate_and_add_model_file, P5-48)', 'concerto_core::validation::<impl concerto_core::model_manager::ModelManager>::validate_and_add_model_file'),
    ('  register (append_for_validation)', 'concerto_core::model_manager::ModelManager::append_for_validation'),
    ('register (add_model_file)', 'concerto_core::model_manager::ModelManager::add_model_file'),
    ('ModelManager::new', 'concerto_core::model_manager::ModelManager::new'),
    ('system model cache clone (system_model_files)', 'concerto_core::model_manager::system_model_files'),
]


def annotate(path, inclusive):
    args = ['callgrind_annotate', '--threshold=100']
    if inclusive:
        args.append('--inclusive=yes')
    out = subprocess.run(args + [path], capture_output=True, text=True, check=True).stdout
    total = None
    rows = []
    for line in out.splitlines():
        m = re.match(r'\s*([\d,]+) \(\s*[\d.]+%\)\s+(.*)$', line)
        if not m:
            continue
        n = int(m.group(1).replace(',', ''))
        name = m.group(2)
        if 'PROGRAM TOTALS' in name:
            total = n
            continue
        name = re.sub(r' \[[^\]]*\]$', '', name)
        name = re.sub(r"^[^:]*:", '', name, count=1) if not name.startswith('???:') else name[4:]
        rows.append((n, name))
    return total, rows


def main():
    for path in sys.argv[1:]:
        total, rows = annotate(path, False)
        print(f'## {path}: {total:,} Ir')
        buckets = {b: 0 for b, _ in SELF_BUCKETS}
        buckets['other'] = 0
        for n, name in rows:
            for b, pat in SELF_BUCKETS:
                if re.search(pat, name):
                    buckets[b] += n
                    break
            else:
                buckets['other'] += n
        print('| self-cost bucket | share |')
        print('|---|---:|')
        for b, n in sorted(buckets.items(), key=lambda kv: -kv[1]):
            print(f'| {b} | {100 * n / total:.1f}% |')
        _, inc = annotate(path, True)
        seen = {}
        for n, name in inc:
            base = re.sub(r"'\d+$", '', name)
            seen[base] = max(seen.get(base, 0), n)
        print()
        print('| stage (inclusive) | share |')
        print('|---|---:|')
        for label, fn in STAGES:
            if fn in seen:
                print(f'| {label} | {100 * seen[fn] / total:.1f}% |')
        print()


if __name__ == '__main__':
    main()
