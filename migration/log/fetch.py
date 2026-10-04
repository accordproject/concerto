#!/usr/bin/env python3
"""Fetch the GitHub inputs of the progress log into <out>/raw/ (read-only; uses `gh api`).

Writes, all cut off at LOG_UNTIL (default: now) so that a later rebuild with the
same cutoff reproduces the same data:

  issues_all.json                 every issue and PR in accordproject/concerto-rust (REST shape);
                                  labels, state and closed_at are replayed to their value at the cutoff
  tl/<n>.json                     issue timeline for every tracker issue from #29 (REST shape)
  comments_all_<repo>.json        issue and PR comments updated since 23 Sep, as {issue, ts, user, url, body}
  c_all.json                      the two comment files above for concerto-rust and concerto, combined
  prs_<repo>.json                 PRs created since 24 Sep in concerto, concerto-rust and concerto-conformance
  fetch_meta.json                 the cutoff and fetch time

Comments from every author are stored; the builders keep only mttrbrts content as decisions.
"""
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import COMMENTS_SINCE, OWNER, RAW, REPOS, SINCE, TRACKER, P, dump, iso, until  # noqa: E402


def api(path):
    for attempt in range(4):
        r = subprocess.run(['gh', 'api', '-H', 'Accept: application/vnd.github+json', path], capture_output=True, text=True)
        if r.returncode == 0:
            return json.loads(r.stdout)
        sys.stderr.write(f'gh api {path} failed ({r.stderr.strip()[:200]}), retry {attempt + 1}\n')
    raise SystemExit(f'gh api {path} failed')


def pages(path, stop=None):
    sep = '&' if '?' in path else '?'
    page = 1
    while True:
        batch = api(f'{path}{sep}per_page=100&page={page}')
        if not batch:
            return
        for x in batch:
            if stop and stop(x):
                return
            yield x
        if len(batch) < 100:
            return
        page += 1


def before(ts, cutoff):
    return ts is not None and P(ts) <= P(cutoff)


def replay(issue, tl, cutoff, label_ids):
    """Labels, state and closed_at of an issue at the cutoff, replayed from its timeline."""
    labs = []
    closed_at = None
    later = False
    for e in tl:
        kind = e.get('event')
        if kind not in ('labeled', 'unlabeled', 'closed', 'reopened'):
            continue
        if not before(e.get('created_at'), cutoff):
            later = True
            continue
        if kind == 'labeled' and e['label']['name'] not in labs:
            labs.append(e['label']['name'])
        elif kind == 'unlabeled' and e['label']['name'] in labs:
            labs.remove(e['label']['name'])
        elif kind == 'closed':
            closed_at = e['created_at']
        elif kind == 'reopened':
            closed_at = None
    if not later:
        return issue  # nothing changed after the cutoff: keep the API's current view
    issue = dict(issue)
    current = {l['name']: l for l in issue['labels']}
    # the API lists an issue's labels in label-id order
    labs.sort(key=lambda n: label_ids.get(n, float('inf')))
    issue['labels'] = [current.get(n, {'name': n}) for n in labs]
    issue['state'] = 'closed' if closed_at else 'open'
    issue['closed_at'] = closed_at
    if not closed_at:
        issue['state_reason'] = None
    return issue


def main():
    cutoff = until()
    os.makedirs(os.path.join(RAW, 'tl'), exist_ok=True)
    print('cutoff', cutoff)

    label_ids = {l['name']: l['id'] for l in pages(f'repos/{OWNER}/{TRACKER}/labels')}
    issues = [i for i in pages(f'repos/{OWNER}/{TRACKER}/issues?state=all&direction=asc') if before(i['created_at'], cutoff)]
    out = []
    for i in issues:
        n = i['number']
        if n >= 29 and 'pull_request' not in i:
            full = list(pages(f'repos/{OWNER}/{TRACKER}/issues/{n}/timeline'))
            i = replay(i, full, cutoff, label_ids)
            tl = [e for e in full if e.get('created_at') is None or before(e['created_at'], cutoff)]
            dump(tl, os.path.join(RAW, 'tl', f'{n}.json'))
        out.append(i)
    dump(out, os.path.join(RAW, 'issues_all.json'))
    print('issues', len(out))

    combined = []
    for repo in ('concerto-rust', 'concerto'):
        cs = []
        for c in pages(f'repos/{OWNER}/{repo}/issues/comments?since={urllib.parse.quote(COMMENTS_SINCE)}'):
            if not before(c['created_at'], cutoff):
                continue
            cs.append({'issue': int(c['issue_url'].rsplit('/', 1)[1]), 'ts': c['created_at'],
                       'user': (c.get('user') or {}).get('login'), 'url': c['html_url'], 'body': c.get('body') or ''})
        cs.sort(key=lambda c: (c['ts'], c['url']))
        dump(cs, os.path.join(RAW, f'comments_all_{repo}.json'))
        combined += cs
        print('comments', repo, len(cs))
    dump(combined, os.path.join(RAW, 'c_all.json'))

    for repo in REPOS:
        prs = []
        for p in pages(f'repos/{OWNER}/{repo}/pulls?state=all&sort=created&direction=desc',
                       stop=lambda p: P(p['created_at']) < P(SINCE)):
            if not before(p['created_at'], cutoff):
                continue
            merged = p['merged_at'] if before(p['merged_at'], cutoff) else None
            closed = p['closed_at'] if before(p['closed_at'], cutoff) else None
            prs.append({'number': p['number'], 'title': p['title'], 'state': 'closed' if closed else 'open',
                        'created_at': p['created_at'], 'merged_at': merged, 'closed_at': closed,
                        'base': p['base']['ref'], 'head': p['head']['ref'], 'user': (p.get('user') or {}).get('login'),
                        'body': p.get('body'), 'html_url': p['html_url'], 'draft': p.get('draft')})
        # kept in API order (newest first): pr_links() sorts by merge time and keeps this order for ties
        dump(prs, os.path.join(RAW, f'prs_{repo}.json'))
        print('prs', repo, len(prs))

    dump({'until': cutoff, 'fetched_at': iso(dt.datetime.now(dt.timezone.utc))}, os.path.join(RAW, 'fetch_meta.json'))


if __name__ == '__main__':
    main()
