#!/usr/bin/env python3
"""Per-day session logs (<out>/sessions/<day>-<worker>.md) for workers without a local
transcript, reconstructed from GitHub: issue timelines, comments and PRs, plus the
events in events.json. Workers default to cloud-main, cloud-2 and cloud-3; set
LOG_GH_WORKERS (comma-separated) to change them.

Session logs for the coordinator and local-matt come from their transcripts and are
curated by hand; if LOG_TRANSCRIPT_SESSIONS names a directory of such <day>-<worker>.md
files, they are copied in unchanged. Otherwise those days are left as gaps.
"""
import collections
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import OUT, load  # noqa: E402

E = json.load(open(os.path.join(OUT, 'events.json')))['events']
jobs = {j['n']: j for j in load('jobs.json')}
prs = {r: load(f'prs_{r}.json') for r in ('concerto', 'concerto-rust', 'concerto-conformance')}
comments = load('c_all.json')
os.makedirs(os.path.join(OUT, 'sessions'), exist_ok=True)
WORKERS = [w.strip() for w in os.environ.get('LOG_GH_WORKERS', 'cloud-main,cloud-2,cloud-3').split(',') if w.strip()]

def worker_at(j, ts):
    w = None
    for t, labs, c in j['hist']:
        if t > ts: break
        ws = [l.split(':', 1)[1] for l in labs if l.startswith('worker:')]
        w = ws[0] if ws else w
    return w

for W in WORKERS:
    days = collections.defaultdict(lambda: {'acts': [], 'start': [], 'end': [], 'prs': [], 'dec': [], 'bug': [], 'cov': [], 'perf': [], 'plan': []})
    wissues = set()
    for n, j in jobs.items():
        prev = set()
        for ts, labs, c in j['hist']:
            labs = set(labs)
            if f'worker:{W}' in labs:
                wissues.add(n)
                for s in ('mig:claimed', 'mig:in-review', 'mig:blocked'):
                    if s in labs and s not in prev:
                        days[ts[:10]]['acts'].append(ts)
            prev = labs
    for repo, lst in prs.items():
        for p in lst:
            if W in (p['head'] or ''):
                days[p['created_at'][:10]]['acts'].append(p['created_at'])
                if p['merged_at']:
                    days[p['merged_at'][:10]]['prs'].append(f"[{repo}#{p['number']}]({p['html_url']}) {p['title'][:90]} (merged {p['merged_at'][11:16]}Z)")
    wname = W.replace('cloud-', 'cloud ')
    for c in comments:
        if c['issue'] in wissues and re.search(r'(?i)(worker:?\s*' + re.escape(W) + r'|' + re.escape(wname) + r'\b)', c['body'][:300]):
            days[c['ts'][:10]]['acts'].append(c['ts'])
    for e in E:
        d = e['ts'][:10]
        t = e.get('task') or {}
        n = t.get('issue') if isinstance(t, dict) else None
        if e['type'] in ('job_start', 'job_end') and e.get('worker') == W:
            days[d]['start' if e['type'] == 'job_start' else 'end'].append(e)
            days[d]['acts'].append(e['ts'])
        elif n in jobs and n in wissues and worker_at(jobs[n], e['ts']) == W:
            key = {'decision': 'dec', 'bug': 'bug', 'coverage': 'cov', 'perf': 'perf', 'plan_change': 'plan'}.get(e['type'])
            if key: days[d][key].append(e)
    for d, v in sorted(days.items()):
        if not v['acts'] and not v['prs']: continue
        acts = sorted(v['acts'])
        L = [f'# {d} — worker {W} (reconstructed from GitHub)', '',
             f'No local transcript exists for {W}; this log is rebuilt from issue timelines, comments and PRs in accordproject/concerto-rust, concerto and concerto-conformance. Start/end are the first and last GitHub activity attributable to the worker that day (UTC), not session boundaries.', '',
             f'- **First activity:** {acts[0] if acts else "gap"}', f'- **Last activity:** {acts[-1] if acts else "gap"}', '']
        def sec(title, items, fmt):
            L.append(f'## {title}')
            L.extend([fmt(x) for x in items] or ['- none recorded'])
            L.append('')
        sec('Jobs started', v['start'], lambda e: f"- {e['ts'][11:16]}Z {(e['task'] or {}).get('id') or ''} (#{(e['task'] or {}).get('issue')}): {e['summary']}")
        sec('Jobs finished', v['end'], lambda e: f"- {e['ts'][11:16]}Z {(e['task'] or {}).get('id') or ''} (#{(e['task'] or {}).get('issue')}): {e['summary']} " + (f"PRs: {', '.join(e['metrics'].get('merged_prs', []))}" if e.get('metrics') else ''))
        sec('PRs merged from this worker\'s branches', v['prs'], lambda s: f'- {s}')
        sec('Decisions affecting this worker\'s tasks', v['dec'], lambda e: f"- {e['ts'][11:16]}Z #{e['task']['issue']}: {e['summary']} ([source]({e['source']}))")
        sec('Bugs / review failures', v['bug'], lambda e: f"- {e['ts'][11:16]}Z #{e['task']['issue']}: {e['summary']}")
        sec('Coverage values reported', v['cov'], lambda e: f"- {e['ts'][11:16]}Z {e['summary']}")
        sec('Plan changes', v['plan'], lambda e: f"- {e['ts'][11:16]}Z {e['summary']}")
        sec('Performance changes', v['perf'], lambda e: f"- {e['ts'][11:16]}Z {e['summary']}")
        with open(os.path.join(OUT, 'sessions', f'{d}-{W}.md'), 'w') as f:
            f.write('\n'.join(L))
        print(d, W, len(acts), len(v['start']), len(v['end']), len(v['prs']))

src = os.environ.get('LOG_TRANSCRIPT_SESSIONS')
if src:
    for name in sorted(os.listdir(src)):
        if name.endswith('.md') and not any(name.endswith(f'-{w}.md') for w in WORKERS):
            shutil.copy(os.path.join(src, name), os.path.join(OUT, 'sessions', name))
            print('copied', name)
