#!/usr/bin/env python3
"""Turn tracker issues and their timelines into <out>/raw/jobs.json.

One record per issue from #29: task id, title, created/closed, current labels, and the
label history [(ts, labels, closed)] replayed from the timeline. `mig` marks migration
issues (ever labelled migration or mig:*, or titled [migration]).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import RAW, dump, load, task_id  # noqa: E402


def main():
    issues = {i['number']: i for i in load('issues_all.json') if 'pull_request' not in i}
    jobs = []
    for n, i in sorted(issues.items()):
        if n < 29:
            continue
        tl = load(f'tl/{n}.json')
        labs = set()
        hist = []
        closed = False
        for e in tl:
            kind = e.get('event')
            if kind in ('labeled', 'unlabeled'):
                (labs.add if kind == 'labeled' else labs.discard)(e['label']['name'])
                hist.append((e['created_at'], frozenset(labs), closed))
            elif kind in ('closed', 'reopened'):
                closed = kind == 'closed'
                hist.append((e['created_at'], frozenset(labs), closed))
        ever = set(l for h in hist for l in h[1])
        mig = 'migration' in ever or '[migration]' in i['title'] or any(l.startswith('mig:') for l in ever)
        jobs.append(dict(n=n, title=i['title'], task=task_id(i['title']), created=i['created_at'], closed_at=i['closed_at'],
                         state=i['state'], labels=[l['name'] for l in i['labels']],
                         hist=[(a, sorted(b), c) for a, b, c in hist], mig=mig))
    dump(jobs, os.path.join(RAW, 'jobs.json'), indent=0)
    print('jobs', len(jobs), 'migration', sum(j['mig'] for j in jobs))


if __name__ == '__main__':
    main()
