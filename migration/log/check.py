#!/usr/bin/env python3
"""Compare a build in <out>/ with a reference build (a directory holding events.json,
perf.json and optionally burndown.json), for the "a clean rebuild reproduces the data" check.

  python3 check.py REFERENCE_DIR

Compared:
  perf.json    entry count per operation and in total, the category map, and full equality
  events.json  event counts by type, outside the transcript-dependent part (origin
               "transcript"); when this build also has transcript events, the full counts
               and the events themselves
  burndown     hourly range, row count and every job-state row (if the reference has it)

Exit status 0 when everything compared matches.
"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import OUT  # noqa: E402

failures = []


def check(name, ok, detail=''):
    print(('ok    ' if ok else 'FAIL  ') + name + (f': {detail}' if detail and not ok else ''))
    if not ok:
        failures.append(name)


def by_type(events, include_transcript):
    return dict(sorted(collections.Counter(e['type'] for e in events
                                           if include_transcript or e.get('origin') != 'transcript').items()))


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    ref = sys.argv[1]

    a = json.load(open(os.path.join(OUT, 'perf.json')))
    b = json.load(open(os.path.join(ref, 'perf.json')))
    ca = {op: len(v) for op, v in a['operations'].items()}
    cb = {op: len(v) for op, v in b['operations'].items()}
    check('perf.json entries per operation', ca == cb, f'{ca} != {cb}')
    check('perf.json total entries', sum(ca.values()) == sum(cb.values()), f'{sum(ca.values())} != {sum(cb.values())}')
    check('perf.json categories', a['categories'] == b['categories'])
    check('perf.json identical', a == b)

    ea = json.load(open(os.path.join(OUT, 'events.json')))['events']
    eb = json.load(open(os.path.join(ref, 'events.json')))['events']
    ta = by_type(ea, False)
    tb = by_type(eb, False)
    check('events.json counts by type, excluding transcript events', ta == tb, f'{ta} != {tb}')
    nb = sum(1 for e in eb if e.get('origin') == 'transcript')
    na = sum(1 for e in ea if e.get('origin') == 'transcript')
    print(f'      transcript-dependent events: {na} in this build, {nb} in the reference')
    if na:
        check('events.json counts by type, all events', by_type(ea, True) == by_type(eb, True),
              f'{by_type(ea, True)} != {by_type(eb, True)}')
        check('events.json identical', ea == eb)
    else:
        strip = lambda es: [e for e in es if e.get('origin') != 'transcript']
        check('events.json identical outside the transcript part', strip(ea) == strip(eb))

    rb = os.path.join(ref, 'burndown.json')
    if os.path.exists(rb):
        ba = json.load(open(os.path.join(OUT, 'burndown.json')))
        bb = json.load(open(rb))
        check('burndown.json range', ba['range'] == bb['range'], f"{ba['range']} != {bb['range']}")
        check('burndown.json job rows', ba['jobs']['rows'] == bb['jobs']['rows'])
        check('burndown.json identical', ba == bb)

    print('PASS' if not failures else f'FAIL ({len(failures)})')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
