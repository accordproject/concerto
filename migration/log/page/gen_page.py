#!/usr/bin/env python3
"""Render <out>/concerto-rust-migration.html from page/template.html and the built data.

The rendered page is not committed: publishing it to the Artifact is a coordinator step.
page_text.json holds the page's prose (lede, tiles, notes), edited by the coordinator per
publish; <out>/tsbugs.json comes from page/tsbugs.py. No unit-test (nyc) coverage series is rendered.
"""
import json
import os
import re
import sys

PAGE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(PAGE))
from lib import OUT  # noqa: E402

burn = json.load(open(os.path.join(OUT, 'burndown.json')))
perf = json.load(open(os.path.join(OUT, 'perf.json')))
evs = json.load(open(os.path.join(OUT, 'events.json')))['events']
extra = json.load(open(os.path.join(PAGE, 'page_text.json')))

cov = burn['coverage']
H = [r['hour'] for r in burn['jobs']['rows']]
def col(rows, k): return [r[k] for r in rows]
data = {
  'hours': H,
  'd1': {'v': col(cov['ledger_d1'], 'd1_pct'), 'r': col(cov['ledger_d1'], 'rust_only_pct'), 'o': col(cov['ledger_d1'], 'observed')},
  'oracle': {'pass': col(cov['oracle'], 'pass'), 'fail': col(cov['oracle'], 'fail'), 'uns': col(cov['oracle'], 'unsupported'), 'o': col(cov['oracle'], 'observed')},
  'conf': {'js': col(cov['conformance_js'], 'passed'), 'jst': col(cov['conformance_js'], 'total'), 'jo': col(cov['conformance_js'], 'observed'),
           'nat': col(cov['conformance_native'], 'passed'), 'natt': col(cov['conformance_native'], 'total'), 'no': col(cov['conformance_native'], 'observed')},
  'jobs': {k: col(burn['jobs']['rows'], k) for k in ('backlog', 'ready', 'claimed', 'in_review', 'needs_decision', 'blocked', 'done', 'post_migration')},
}
# perf: categories, one line per representative op; each point = median across model sets of one task run
import statistics
LABELS = {'load':'model load (run-ts)','add_model_file':'addModelFile','add_cto_model':'addCTOModel','parse_namespace':'parseNamespace',
  'get_namespaces':'getNamespaces (repeat)','get_type':'getType (repeat)','resolve_type':'resolveType (repeat)','derives_from':'derivesFrom',
  'from_json':'fromJSON','to_json':'toJSON','new_resource':'newResource','set_property_value':'setPropertyValue','add_array_value':'addArrayValue',
  'validate':'Resource.validate','validate_ast':'validateAst','load_validate':'load + validate','validate_models':'validateModelFiles',
  'extract_decorators':'extractDecorators','dcs_decorate':'decorateModels','extract_vocabularies':'extractVocabularies','dcs_validate':'DCS validate'}
REP = [('model loading',['load','add_model_file','add_cto_model','parse_namespace']),
       ('introspection',['get_namespaces','get_type','extract_decorators','dcs_decorate']),
       ('serialisation',['from_json','to_json']),
       ('instance creation',['new_resource','set_property_value','add_array_value']),
       ('validation',['validate','validate_ast','load_validate','validate_models'])]
def ok(e): return e.get('level')=='TS-API' and not e.get('superseded') and e.get('merged') is not False and e.get('ratio_after') is not None
P = []
for cat, ops in REP:
    lines = []
    for op in ops:
        g = {}
        for e in perf['operations'].get(op, []):
            v = e.get('variant') or e.get('route')
            if not ok(e) or (v and not re.match(r'(resident|warm)', v)): continue
            g.setdefault((e['task'], e.get('run'), e['ts'][:16]), []).append(e)
        pts = []
        for (task, run, ts), es in sorted(g.items(), key=lambda kv: kv[0][2]):
            a = [x['ratio_after'] for x in es]; b = [x['ratio_before'] for x in es if x.get('ratio_before') is not None]
            pts.append({'t': es[0]['ts'], 'task': task, 'run': run, 'm': es[0].get('machine'), 'a': round(statistics.median(a), 2),
                        'b': round(statistics.median(b), 2) if b else None, 'sets': [f"{x.get('set')}: {x.get('ratio_before')}→{x['ratio_after']}" for x in es]})
        if pts: lines.append({'op': op, 'label': LABELS.get(op, op), 'pts': pts})
    rows = []
    for op, es in perf['operations'].items():
        for e in es:
            if e.get('category') == cat and not e.get('superseded') and e.get('merged') is not False and e.get('ratio_after') is not None:
                rows.append([e['ts'][:16].replace('T', ' '), e.get('task'), e.get('level'), LABELS.get(op, op) + (f" ({e.get('variant') or e.get('route')})" if (e.get('variant') or e.get('route')) else ''), e.get('set'), e.get('ratio_before'), e['ratio_after'], e.get('machine'), e.get('run')])
    rows.sort()
    P.append({'cat': cat, 'lines': lines, 'rows': rows})
data['perf'] = P

# timeline
TL = []
for e in evs:
    t = e['type']
    if t == 'decision' and e.get('curated') and re.search(r'(?i)nyc|restore (concerto-core )?coverage|coverage (margin|restoration|after TS deletion)|Coverage restoration', e['summary']):
        continue  # unit-test (nyc) coverage is not rendered on the page
    if t == 'decision' and e.get('curated'):
        TL.append({'ts': e['ts'], 'k': 'decision', 'cat': e['metrics']['category'], 'task': (e.get('task') or {}).get('id'), 'issue': (e.get('task') or {}).get('issue'), 's': e['summary'], 'u': e['source']})
    elif t == 'plan_change' and (e.get('metrics') or {}).get('kind') in ('initial_plan', 'plan_version', 'process', 'breaking_change_plan', 'measurement_change', 'phase_start'):
        u = e['source'] if e['source'].startswith('http') else None
        TL.append({'ts': e['ts'], 'k': 'plan', 'cat': e['metrics']['kind'], 'task': (e.get('task') or {}).get('id'), 'issue': (e.get('task') or {}).get('issue'), 's': e['summary'], 'u': u, 'src': None if u else e['source']})
for x in extra.get('timeline_extra', []):
    TL.append(x)
# Optional transcript-derived timeline rows (same shape as timeline_extra), never committed.
tx_tl = os.environ.get('LOG_TRANSCRIPT_TIMELINE')
if tx_tl:
    TL.extend(json.load(open(tx_tl)))
else:
    print('LOG_TRANSCRIPT_TIMELINE unset: no transcript-derived timeline rows', file=sys.stderr)
TL.sort(key=lambda x: x['ts'])
data['timeline'] = TL
data['text'] = extra
data['confNative'] = [o for o in burn['observations']['conformance'] if o['harness'] == 'native']
data['confJs'] = [o for o in burn['observations']['conformance'] if o['harness'] == 'js']
data['p560'] = perf.get('p5_60_summary')
data['p572'] = perf.get('p5_72_summary')
data['tsbugs'] = json.load(open(os.path.join(OUT, 'tsbugs.json')))

tpl = open(os.path.join(PAGE, 'template.html')).read()
html = tpl.replace('/*__DATA__*/null', json.dumps(data, separators=(',', ':')))
with open(os.path.join(OUT, 'concerto-rust-migration.html'), 'w') as f:
    f.write(html)
print(len(html), len(TL))
