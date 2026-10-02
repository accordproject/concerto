#!/usr/bin/env python3
"""Write <out>/timeline.md: the consolidated timeline, one line per event in events.json,
with performance measurements rolled up to one line per task and run."""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import OUT  # noqa: E402

E = json.load(open(os.path.join(OUT, 'events.json')))['events']
LABEL = {'decision': 'DECISION', 'plan_change': 'PLAN', 'job_start': 'START', 'job_end': 'END', 'coverage': 'COVERAGE', 'bug': 'BUG', 'perf': 'PERF'}
# roll perf up: one line per (task, ts) with the ops it measured
perf = collections.defaultdict(list)
rest = []
for e in E:
    if e['type'] == 'perf':
        t = (e.get('task') or {})
        perf[(t.get('id'), e['ts'][:16])].append(e)
    else:
        rest.append(e)
for (tid, ts), es in perf.items():
    m0 = es[0].get('metrics', {})
    ops = sorted({(x.get('metrics') or {}).get('op') for x in es if (x.get('metrics') or {}).get('op')})
    rest.append({'ts': es[0]['ts'], 'type': 'perf', 'task': es[0].get('task'), 'worker': es[0].get('worker'),
                 'summary': f"{tid}: {len(es)} x-TS measurements ({m0.get('machine')}, run {m0.get('run')}) for {', '.join(ops[:8])}{'...' if len(ops) > 8 else ''}. See perf.json.",
                 'source': es[0]['source']})
rest.sort(key=lambda e: e['ts'])
L = ['# Consolidated migration timeline (concerto-core -> Rust)', '',
     'All times UTC. One line per event from events.json; performance measurements are rolled up to one line per task and run (details in perf.json).',
     'Types: DECISION, PLAN (plan change), START/END (job lifecycle), COVERAGE, BUG, PERF. Sources are GitHub URLs, `repo@sha:path`, or `transcript:<session>:<line>`.', '']
day = None
for e in rest:
    d = e['ts'][:10]
    if d != day:
        day = d; L += ['', f'## {d}', '']
    t = e.get('task') or {}
    tid = t.get('id') if isinstance(t, dict) else None
    iss = t.get('issue') if isinstance(t, dict) else None
    tag = ' '.join(x for x in [tid or '', f'#{iss}' if iss else ''] if x)
    w = f" [{e['worker']}]" if e.get('worker') else ''
    L.append(f"- {e['ts'][11:16]} **{LABEL.get(e['type'], e['type'])}** {tag}{w} {e['summary']} — {e['source']}")
with open(os.path.join(OUT, 'timeline.md'), 'w') as f:
    f.write('\n'.join(L) + '\n')
print(len(rest))
