#!/usr/bin/env python3
"""Build <out>/events.json and <out>/burndown.json (hourly) from the fetched GitHub data,
git history of the integration branch in concerto and concerto-rust, the curated
observations (observations.py, decisions_curated.py), perf events (perf.py) and, if
present, curated transcript events. Read-only apart from <out>/.

Rules: only mttrbrts-authored content counts as a decision; values are as published, and
gaps stay gaps (no interpolation); everything after the cutoff (LOG_UNTIL) is ignored.
"""
import collections
import datetime as dt
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decisions_curated import D as CURATED  # noqa: E402
import observations as OBS  # noqa: E402
from lib import (GH_RUST, GH_TS, MAINTAINER, OUT, RAW, START_HOUR, P, branch_at, dump, first_parent_log,  # noqa: E402,F401
                 iso, load, show, until)

UNTIL = until()
R = RAW


def keep(ts):
    return P(ts) <= P(UNTIL)


issues = {i['number']: i for i in load('issues_all.json') if 'pull_request' not in i}
jobs = {j['n']: j for j in load('jobs.json')}
comments = [c for c in load('c_all.json') if c.get('user') == MAINTAINER]  # only maintainer-account content is authoritative
prs = {r: load(f'prs_{r}.json') for r in ('concerto', 'concerto-rust', 'concerto-conformance')}

TASK_RE = re.compile(r'\b(P\d-\d+[a-z]?(?:-[A-Z]\d+[a-z]?)?)')
def task_of(n):
    j = jobs.get(n)
    return {'id': j['task'] if j else None, 'issue': n}

events = []
def ev(ts, typ, task, worker, summary, source, metrics=None, **extra):
    e = {'ts': ts if isinstance(ts, str) else iso(ts), 'type': typ, 'task': task, 'worker': worker,
         'summary': summary, 'source': source}
    if metrics: e['metrics'] = metrics
    e.update(extra)
    events.append(e)

# ---------------------------------------------------------------- jobs
def worker_of(labels):
    ws = [l.split(':', 1)[1] for l in labels if l.startswith('worker:')]
    return ws[0] if ws else None

def pr_links(task_id, n):
    out = []
    title = jobs[n]['title']
    if not task_id or 'finding' in title.lower() or not re.match(r'^\[migration\] ' + re.escape(task_id) + r'\b', title):
        pat = re.compile(r'#' + str(n) + r'\b')
    else:
        pat = re.compile(r'(?<![\w-])' + re.escape(task_id) + r'(?![\w])')
    for repo, lst in prs.items():
        for p in lst:
            if p['merged_at'] and pat.search(p['title'] or ''):
                out.append({'repo': repo, 'number': p['number'], 'merged_at': p['merged_at'], 'url': p['html_url']})
    return sorted(out, key=lambda x: x['merged_at'])

job_summaries = []
for n, j in sorted(jobs.items()):
    if n < 30 or not j['mig']: continue
    hist = j['hist']
    claimed = None; blocked = []; bstart = None; prev = set()
    for ts, labs, closed in hist:
        labs = set(labs)
        if 'mig:claimed' in labs and 'mig:claimed' not in prev and claimed is None:
            claimed = (ts, worker_of(labs))
        if 'mig:blocked' in labs and 'mig:blocked' not in prev: bstart = ts
        if 'mig:blocked' not in labs and 'mig:blocked' in prev and bstart:
            blocked.append([bstart, ts]); bstart = None
        prev = labs
    if bstart: blocked.append([bstart, None])
    task = {'id': j['task'], 'issue': n}
    src = f'{GH_RUST}/issues/{n}'
    final_labels = j['labels']
    w_final = worker_of(final_labels)
    title = re.sub(r'^\[(migration|post-migration)\]\s*', '', j['title'])
    if claimed:
        ev(claimed[0], 'job_start', task, claimed[1] or w_final, f'{title[:110]} claimed.', src + ' (timeline: mig:claimed)')
    elif j['closed_at'] and 'mig:done' in final_labels:
        ev(j['created'], 'job_start', task, w_final, f'{title[:110]} recorded on the tracker already in progress (no claim event).', src + ' (created)', retroactive=True)
    links = pr_links(j['task'], n)
    if j['closed_at']:
        done = 'mig:done' in final_labels
        reason = issues[n].get('state_reason')
        outcome = 'done' if done else ('not planned' if reason == 'not_planned' else 'closed')
        bh = sum((P(b[1]) - P(b[0])).total_seconds() / 3600 for b in blocked if b[1])
        m = {'outcome': outcome, 'blocked_spans': blocked, 'blocked_hours': round(bh, 2)}
        if claimed: m['hours_claim_to_close'] = round((P(j['closed_at']) - P(claimed[0])).total_seconds() / 3600, 2)
        if links: m['merged_prs'] = [f"{l['repo']}#{l['number']}" for l in links]
        ev(j['closed_at'], 'job_end', task, w_final, f'{title[:110]} closed ({outcome}).', src + ' (closed)', m)
    job_summaries.append({'issue': n, 'task': j['task'], 'title': title, 'created': j['created'], 'claimed': claimed[0] if claimed else None,
                          'closed': j['closed_at'], 'worker': w_final, 'final_labels': final_labels, 'blocked': blocked, 'prs': links})
dump(job_summaries, os.path.join(R, 'job_summaries.json'))

# ---------------------------------------------------------------- hourly job states
START = P(START_HOUR)
# the hour that contains the cutoff (each row is the state at its hour start)
END = P(UNTIL).replace(minute=0, second=0, microsecond=0)
hours = []
h = START
while h <= END:
    hours.append(h); h += dt.timedelta(hours=1)

def state_at(j, t):
    if P(j['created']) > t: return None
    labs = set(); closed = False
    for ts, l, c in j['hist']:
        if P(ts) > t: break
        labs = set(l); closed = c
    if closed:
        return 'done' if 'mig:done' in labs else ('post_migration' if 'mig:post-migration' in labs else 'closed_other')
    if 'mig:post-migration' in labs: return 'post_migration'
    for s in ('blocked', 'needs-decision', 'in-review', 'claimed', 'ready', 'backlog'):
        if 'mig:' + s in labs: return s.replace('-', '_')
    return 'untriaged'

jobrows = []
mig_jobs = [j for n, j in jobs.items() if j['mig'] and n >= 30]
for t in hours:
    c = collections.Counter(state_at(j, t) for j in mig_jobs)
    c.pop(None, None)
    jobrows.append({'hour': iso(t), **{k: c.get(k, 0) for k in
                   ('backlog', 'ready', 'claimed', 'in_review', 'needs_decision', 'blocked', 'untriaged', 'done', 'closed_other', 'post_migration')}})

# ---------------------------------------------------------------- coverage observations
cov = {'ledger_d1': [], 'oracle': [], 'nyc': [], 'conformance': []}

# D1 from SUMMARY.md along first-parent history of the integration branch
for sha, cts, subj in first_parent_log('concerto', 'migration/ledger/SUMMARY.md'):
    s = show('concerto', sha, 'migration/ledger/SUMMARY.md')
    m = re.search(r'RUST\+HYBRID weighted share[^:]*:\s*([\d.]+)%', s)
    r = re.search(r'RUST only[^:]*:\s*([\d.]+)%', s)
    if m:
        cov['ledger_d1'].append({'ts': iso(P(cts)), 'd1_pct': float(m.group(1)), 'rust_only_pct': float(r.group(1)) if r else None,
                                 'source': f'concerto@{sha[:9]}:migration/ledger/SUMMARY.md', 'note': subj[:120]})

# Oracle: baseline.tsv along first-parent history; totals from sourced corpus sizes
def total_at(ts):
    tot = None
    for t0, v, src in OBS.corpus_total:
        if P(ts) >= P(t0): tot = (v, src)
    return tot
for sha, cts, subj in first_parent_log('concerto-rust', 'concerto-core/tests/oracle/baseline.tsv'):
    s = show('concerto-rust', sha, 'concerto-core/tests/oracle/baseline.tsv')
    cnt = collections.Counter()
    for l in s.splitlines():
        if l.startswith('#'): continue
        f = l.split('\t')
        if len(f) >= 3: cnt[f[2].split(':')[0]] += 1
    tot = total_at(iso(P(cts)))
    o = {'ts': iso(P(cts)), 'pass': cnt['pass'], 'fail': cnt['fail'], 'total': tot[0],
         'unsupported': tot[0] - cnt['pass'] - cnt['fail'], 'unsupported_derivation': 'computed: corpus total - pass - fail (matches sourced figures where published)',
         'source': f'concerto-rust@{sha[:9]}:concerto-core/tests/oracle/baseline.tsv', 'total_source': tot[1], 'note': subj[:120]}
    if sha.startswith(('780bc6d', '5a6e7ef', '379eea9', 'fa4ee0b')):
        o['note'] += ' (baselined failures are intended R1 breaking changes)'
    if sha.startswith('369e6ea'):
        o['note'] += ' (30 baselined failures are intended R1 breaking changes: strict DateTime, BC-07/42/43/45)'
    cov['oracle'].append(o)

# nyc (statements/branches/functions/lines) — status snapshots, gate reports and verification comments of merged work
def curl(ts, issue):
    for c in comments:
        if c['ts'] == ts and c['issue'] == issue: return c['url']
    return None
for ts, s, b, f, l, src, note in [r for r in OBS.NYC if keep(r[0])]:
    m = re.search(r'/(issues|pull)/(\d+)$', src)
    if m:
        u = curl(ts, int(m.group(2)))
        if u: src = u
    cov['nyc'].append({'ts': ts, 'statements': s, 'branches': b, 'functions': f, 'lines': l, 'source': src, 'note': note})

# Rust-native harness (concerto-conformance semantic/features/support/rust) against the concerto-rust integration branch
for o in [dict(x) for x in OBS.CONF_NATIVE if keep(x['ts'])]:
    cov['conformance'].append({**o, 'harness': 'native'})
for o in [dict(x) for x in OBS.CONF_JS if keep(x['ts'])]:
    m = re.search(r'/issues/(\d+)$', o['source'])
    if m:
        u = curl(o['ts'], int(m.group(1)))
        if u: o['source'] = u
    cov['conformance'].append({**o, 'harness': 'js'})

for series, obs in cov.items():
    for o in obs:
        met = {k: v for k, v in o.items() if k not in ('ts', 'source', 'note', 'unsupported_derivation', 'total_source')}
        if series == 'ledger_d1':
            summ = f"D1 ledger share (RUST+HYBRID) {o['d1_pct']}% (RUST only {o['rust_only_pct']}%) after: {o['note']}"
        elif series == 'oracle':
            summ = f"Oracle native baseline: {o['pass']} pass, {o['fail']} fail, {o['unsupported']} unsupported of {o['total']} fixtures after: {o['note']}"
        elif series == 'nyc':
            summ = f"concerto-core nyc {o['statements']}/{o['branches']}/{o['functions']}/{o['lines']} (stmts/branches/funcs/lines): {o['note']}"
        else:
            summ = (f"Conformance, Rust-native harness vs integration branch: {o['passed']} passed of {o['run']} run, {o['total']} in suite ({o['suite']}): {o['note']}" if o['harness'] == 'native'
                    else f"Conformance, JS harness (reference, {o['engine']}): {o['passed']}/{o['total']} pass: {o['note']}")
        ev(o['ts'], 'coverage', None, None, summ + '.', o['source'], {'series': series, **met})

# hourly carry-forward
def carry(obs, keys):
    rows = []; i = 0; cur = None; obs = sorted(obs, key=lambda o: o['ts'])
    for t in hours:
        observed = []
        while i < len(obs) and P(obs[i]['ts']) < t + dt.timedelta(hours=1):
            if P(obs[i]['ts']) <= t + dt.timedelta(hours=1): cur = obs[i]; observed.append(obs[i]['source'])
            i += 1
        rows.append({'hour': iso(t), **({k: cur.get(k) for k in keys} if cur else {k: None for k in keys}),
                     'observed': bool(observed), 'sources': observed})
    return rows
burn = {
    'granularity': 'hour (UTC); each row covers [hour, hour+1h). Coverage values carry forward from the last sourced observation; observed=true marks hours containing a real observation. Before the first observation values are null (gap).',
    'range': [iso(START), iso(END)],
    'coverage': {
        'ledger_d1': carry(cov['ledger_d1'], ['d1_pct', 'rust_only_pct']),
        'oracle': carry(cov['oracle'], ['pass', 'fail', 'unsupported', 'total']),
        'nyc': carry(cov['nyc'], ['statements', 'branches', 'functions', 'lines']),
        'conformance_js': carry([o for o in cov['conformance'] if o['harness'] == 'js'], ['passed', 'total']),
        'conformance_native': carry([o for o in cov['conformance'] if o['harness'] == 'native'], ['passed', 'total']),
    },
    'jobs': {'note': 'Migration issues in accordproject/concerto-rust (#30 onward) by lifecycle label at the end of each hour boundary (state at hour start). needs_decision is shown separately from blocked. done = closed with mig:done (cumulative). post_migration = deferred out of scope. untriaged = open with no mig: state label.',
             'rows': jobrows},
    'observations': cov,
}
dump(burn, os.path.join(OUT, 'burndown.json'))

# ---------------------------------------------------------------- decisions (curated + all others)
used = set()
for ts, n, tid, summ, cat in CURATED:
    if not keep(ts):
        continue
    u = curl(ts, n) or f'{GH_RUST}/issues/{n}'
    used.add(u)
    ev(ts, 'decision', {'id': tid or jobs.get(n, {}).get('task'), 'issue': n}, None, summ, u, {'category': cat}, curated=True)
for c in comments:
    if c['url'] in used: continue
    head = c['body'][:300]
    if re.search(r'(?i)maintainer decision|maintainer (has )?(decided|approved|confirmed)', head) and 'concerto-rust' in c['url']:
        first = re.sub(r'[*`#>]', '', c['body']).strip().split('\n')[0]
        first = re.sub(r'\s+', ' ', first)[:220]
        ev(c['ts'], 'decision', task_of(c['issue']), None, first, c['url'], {'category': 'other'}, curated=False)

# ---------------------------------------------------------------- bugs
prev = set()
cur = show('concerto-rust', branch_at('concerto-rust'), 'DIVERGENCES.md')
dvcat = {m.group(1): m.group(2).strip() for m in re.finditer(r'^\|\s*(DV-\d+)\s*\|\s*([^|]+)\|', cur, re.M)}
for sha, cts, subj in first_parent_log('concerto-rust', 'DIVERGENCES.md'):
    s = show('concerto-rust', sha, 'DIVERGENCES.md')
    ids = set(re.findall(r'^\|\s*(DV-\d+)', s, re.M))
    for dv in sorted(ids - prev):
        ev(P(cts), 'bug', None, None, f'{dv} recorded in DIVERGENCES.md (current category: {dvcat.get(dv, "?")}) with: {subj[:100]}',
           f'concerto-rust@{sha[:9]}:DIVERGENCES.md', {'kind': 'divergence', 'dv': dv, 'category': dvcat.get(dv)})
    prev = ids

BUG_TITLE = re.compile(r'(?i)finding|DV-\d+|CI red|URGENT|fails|stale|diverges|accepts|rejects|below the|crash|trap|silent|leftover|mismatch|wrong|throws|honour|must honour|gap')
for n, j in sorted(jobs.items()):
    if n < 78: continue
    t = j['title']
    if BUG_TITLE.search(t) and (not re.match(r'^\[migration\] P\d-\d+ ', t) or 'finding' in t.lower()):
        kind = 'finding' if 'finding' in t.lower() else ('divergence' if re.search(r'DV-\d+', t) else 'defect')
        ev(j['created'], 'bug', task_of(n), worker_of(j['labels']), re.sub(r'^\[(post-)?migration\]\s*', '', t)[:160] + ' (issue filed).',
           f'{GH_RUST}/issues/{n}', {'kind': kind})

seen = set()
FAIL_RE = re.compile(r'(?i)(verdict:?\s*\**\s*FAIL|review:?\s*\**\s*FAIL|\bthe review failed\b|not accepted yet|adversarial review:?\s*\**FAIL)')
for c in sorted(comments, key=lambda c: c['ts']):
    if FAIL_RE.search(c['body'][:400]):
        key = (c['issue'], c['ts'][:13])
        if key in seen: continue
        seen.add(key)
        repo = 'concerto' if '/concerto/' in c['url'] else 'concerto-rust'
        tk = task_of(c['issue']) if repo == 'concerto-rust' else {'id': None, 'issue': None, 'pr': f'concerto#{c["issue"]}'}
        first = re.sub(r'[*`#>]', '', c['body']).strip().split('\n')[0]
        ev(c['ts'], 'bug', tk, None, 'Review FAIL: ' + re.sub(r'\s+', ' ', first)[:180], c['url'], {'kind': 'review_fail'})

for ts, src, sm in [r for r in OBS.REG2 if keep(r[0])]:
    ev(ts, 'bug', None, None, sm, src, {'kind': 'process_gap'})
for ts, n, s in [r for r in OBS.REG if keep(r[0])]:
    ev(ts, 'bug', task_of(n), None, s, curl(ts, n) or f'{GH_RUST}/issues/{n}', {'kind': 'regression_at_verification'})

# ---------------------------------------------------------------- plan changes
initial = [n for n, j in jobs.items() if 30 <= n <= 77 and j['mig']]
ev('2026-09-24T09:51:48Z', 'plan_change', None, None, f'Tracker created: plan issue #29 plus {len(initial)} migration task issues (#30-#77) for phases 0-5.', f'{GH_RUST}/issues/29', {'kind': 'initial_plan', 'tasks': len(initial)})
ev(iso(P('2026-09-24T11:39:36Z')), 'plan_change', None, None, 'PLAN.md v2.3: adds D11 and Phase 6 (standalone Rust interface), splits P0-04 into P0-04a/b, adds P2-12 (DCS in Rust), records the merge policy.', 'concerto@63cb75c5c:migration/PLAN.md', {'kind': 'plan_version'})
ev('2026-09-24T15:49:58Z', 'plan_change', None, None, 'Coordination handed over from the cloud coordinator to the local machine (COORDINATOR.md added).', 'concerto@bbdffc598:migration/COORDINATOR.md', {'kind': 'process'})
for n, j in sorted(jobs.items()):
    if n <= 77 or not j['mig']: continue
    t = re.sub(r'^\[(post-)?migration\]\s*', '', j['title'])
    if any(b['metrics'].get('kind') in ('finding', 'divergence', 'defect') for b in events if b['type'] == 'bug' and b['task'] and b['task'].get('issue') == n):
        continue
    ev(j['created'], 'plan_change', task_of(n), None, f'New task filed: {t[:150]}.', f'{GH_RUST}/issues/{n}', {'kind': 'task_added'})
for n, j in sorted(jobs.items()):
    if n < 30: continue
    if issues[n].get('state_reason') == 'not_planned' or (j['closed_at'] and 'mig:done' not in j['labels'] and j['mig']):
        t = re.sub(r'^\[(post-)?migration\]\s*', '', j['title'])
        ev(j['closed_at'], 'plan_change', task_of(n), None, f'Task dropped/closed without completion: {t[:140]}.', f'{GH_RUST}/issues/{n}', {'kind': 'task_dropped'})
    for ts, labs, closed in j['hist']:
        pass
    prevl = set()
    for ts, labs, closed in j['hist']:
        if 'mig:post-migration' in labs and 'mig:post-migration' not in prevl:
            t = re.sub(r'^\[(post-)?migration\]\s*', '', j['title'])
            ev(ts, 'plan_change', task_of(n), None, f'Deferred to post-migration: {t[:140]}.', f'{GH_RUST}/issues/{n} (timeline: mig:post-migration)', {'kind': 'deferred'})
        prevl = set(labs)
# phases: first claim and last close per phase label
phase_first = {}; phase_last = {}
for n, j in jobs.items():
    ph = [l for l in (set(x for h in j['hist'] for x in h[1])) if l.startswith('phase:')]
    if not ph: continue
    ph = ph[0]
    for ts, labs, closed in j['hist']:
        if 'mig:claimed' in labs:
            phase_first[ph] = min(phase_first.get(ph, ts), ts); break
    if j['closed_at'] and 'mig:done' in j['labels']:
        phase_last[ph] = max(phase_last.get(ph, j['closed_at']), j['closed_at'])
for ph, ts in phase_first.items():
    ev(ts, 'plan_change', None, None, f'Phase {ph.split(":")[1]}: first task claimed.', f'{GH_RUST}/issues?q=label%3A{ph.replace(":", "%3A")}', {'kind': 'phase_start', 'phase': ph})
for ts, sha, s in [r for r in OBS.BC if keep(r[0])]:
    ev(ts, 'plan_change', None, None, s, f'concerto@{sha}:migration/BREAKING-CHANGES-PLAN.md', {'kind': 'breaking_change_plan'})
for ts, n, s in [r for r in OBS.LEDGER_PC if keep(r[0])]:
    ev(ts, 'plan_change', task_of(n), None, s, f'{GH_RUST}/issues/{n}', {'kind': 'measurement_change'})

# ---------------------------------------------------------------- merge external event sets
# perf events come from perf.py. Transcript events are optional: curated from local Claude Code
# transcripts (see transcripts.py), read from LOG_TRANSCRIPT_EVENTS or <out>/raw/transcript_events.json.
tx_path = os.environ.get('LOG_TRANSCRIPT_EVENTS') or os.path.join(R, 'transcript_events.json')
tx_count = 0
for origin, path in (('transcript', tx_path), ('perf', os.path.join(R, 'perf_events.json'))):
    if not os.path.exists(path):
        print(f'no {origin} events ({path}); that part of the log is left as a gap')
        continue
    for e in json.load(open(path)):
        if not keep(e['ts']):
            continue
        e.setdefault('origin', origin)
        events.append(e)
        tx_count += origin == 'transcript'

events.sort(key=lambda e: (e['ts'], e['type']))
sources = ('GitHub accordproject/concerto-rust issues/timelines/comments, PRs in concerto/concerto-rust/concerto-conformance, '
           'git history of claude/tender-pascal-ocwf9q')
sources += ', and curated Claude Code transcript events (coordinator, local-matt)' if tx_count else '; no transcript events (optional input absent)'
dump({'generated_note': f'Normalised event stream for the concerto-core -> Rust migration, cut off at {UNTIL}. Sources: {sources}. '
                        'Values are as published; no interpolation.',
      'until': UNTIL,
      'count_by_type': collections.Counter(e['type'] for e in events),
      'count_by_origin': collections.Counter(e.get('origin', 'github+git') for e in events),
      'events': events}, os.path.join(OUT, 'events.json'))
print(dict(collections.Counter(e['type'] for e in events)))
print('jobs last row', jobrows[-1])
