#!/usr/bin/env python3
# P5-15 (accordproject/concerto-rust#309): summarise a macOS `sample` call
# tree of the crate-direct criterion bench (benches/benches/p515_sweep.rs,
# run with --profile-time) into cost buckets. Measure only.
#
#   python3 migration/bench/p515-sample.py <sample.txt> [--json]
#
# Only samples under criterion's measured routine count (a frame naming
# `criterion::bencher` / `Bencher`), so fixture loading and setup are left
# out. Buckets are inclusive (a sample under both a clone and malloc counts
# for both), so they do not sum to 100%; "top self" and "top concerto"
# frames say where the time lands.

import collections
import json
import re
import sys


def idents(sym):
    s = re.sub(r's[0-9A-Za-z]{8,16}_', ' ', sym)
    out, i = [], 0
    while i < len(s):
        m = re.match(r'(\d+)', s[i:])
        if m and (i == 0 or not s[i - 1].isdigit()):
            n = int(m.group(1))
            j = i + len(m.group(1))
            if s[j:j + 1] == '_':
                j += 1
            ident = s[j:j + n]
            if n > 0 and len(ident) == n and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', ident):
                out.append(ident)
                i = j + n
                continue
        i += 1
    return out


def short(sym):
    """A readable name for a (possibly v0-mangled) Rust symbol."""
    if sym.startswith('_R'):
        ids = [x for x in idents(sym) if x not in ('core', 'alloc', 'std')]
        return '::'.join(ids[-3:]) if ids else sym[:60]
    sym = re.sub(r'::h[0-9a-f]{16}$', '', sym)
    sym = re.sub(r'<[^<>]*>', '', sym)
    return sym[-90:]


def parse(path):
    rows = []
    for line in open(path, errors='replace'):
        if line.startswith('Total number in stack'):
            break
        m = re.match(r'^([ +!:|]*)(\d+) (.+?)(?:  \(in [^)]*\).*)?$', line.rstrip('\n'))
        if not m or 'Thread_' in line:
            continue
        rows.append((len(m.group(1)), int(m.group(2)), m.group(3).strip()))
    samples = []
    stack = []
    for idx, (d, c, name) in enumerate(rows):
        child_d, kids = None, 0
        for d2, c2, _ in rows[idx + 1:]:
            if d2 <= d:
                break
            if child_d is None:
                child_d = d2
            if d2 == child_d:
                kids += c2
        while stack and stack[-1][0] >= d:
            stack.pop()
        stack.append((d, name))
        if c - kids > 0:
            samples.append(([n for _, n in stack], c - kids))
    return samples


BUCKETS = [
    ('alloc/free', r'\bmalloc|\bfree\b|_free|realloc|szone|tiny_|small_|__rdl_|__rust_(alloc|dealloc|realloc)|_malloc_zone|nanov2'),
    ('clone', r'as core::clone::Clone>::clone|Clone::clone|clone_into|SpecCloneIntoVec|to_vec|to_owned|ToOwned|to_string'),
    ('drop', r'drop_in_place|drop_glue|as core::ops::drop::Drop>::drop'),
    ('hash/map', r'hash|Hasher|hashbrown|indexmap|BTreeMap|btree'),
    ('fmt', r'core::fmt|alloc::fmt|format_inner|fmt::write'),
    ('serde_json', r'serde_json'),
    ('regex', r'regress|regex'),
    ('memcpy/memmove/memcmp', r'_platform_mem|memcpy|memmove|memcmp|bzero'),
]


def main():
    path = sys.argv[1]
    samples = parse(path)
    root = [(st, n) for st, n in samples if any(re.search(r'criterion.*[Bb]encher|Bencher<', x) for x in st)]
    total = sum(n for _, n in root)
    if total == 0:
        print(json.dumps({'file': path, 'total': 0}))
        return
    inc = collections.Counter()
    for st, n in root:
        for name, pat in BUCKETS:
            if any(re.search(pat, x) or re.search(pat, short(x)) for x in st):
                inc[name] += n
    selfc = collections.Counter()
    concerto = collections.Counter()
    owner = collections.Counter()
    for st, n in root:
        selfc[short(st[-1])] += n
        for x in set(short(y) for y in st if re.search(r'concerto_core|concerto_core_js', y)):
            concerto[x] += n
        o = next((short(y) for y in reversed(st) if re.search(r'concerto_core', y)
                  and not re.search(r'drop_in_place|Clone|clone|hash|fmt|Hasher', y)), '?')
        owner[o] += n
    pct = lambda v: round(100.0 * v / total, 1)
    out = {
        'file': path,
        'total': total,
        'buckets': {k: pct(inc[k]) for k, _ in BUCKETS},
        'topSelf': [[k, pct(v)] for k, v in selfc.most_common(12)],
        'topConcertoInclusive': [[k, pct(v)] for k, v in concerto.most_common(15)],
        'selfByNearestConcertoFrame': [[k, pct(v)] for k, v in owner.most_common(12)],
    }
    if '--json' in sys.argv:
        print(json.dumps(out))
        return
    print(f"{path}: {total} samples under the measured routine")
    print('  buckets (inclusive): ' + ', '.join(f"{k} {v}%" for k, v in out['buckets'].items()))
    print('  top self frames:')
    for k, v in out['topSelf']:
        print(f'    {v:5.1f}%  {k}')
    print('  self time by nearest concerto frame:')
    for k, v in out['selfByNearestConcertoFrame']:
        print(f'    {v:5.1f}%  {k}')
    print('  inclusive concerto frames:')
    for k, v in out['topConcertoInclusive']:
        print(f'    {v:5.1f}%  {k}')


main()
