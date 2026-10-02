"""Shared configuration and helpers for the migration progress-log builder.

Every script in migration/log/ imports this module. Configuration comes from
environment variables so that the scripts can run from any checkout:

  LOG_OUT             output directory (default: migration/log/out)
  LOG_UNTIL           cutoff, ISO-8601 UTC (default: the cutoff recorded by
                      fetch.py in <out>/raw/fetch_meta.json, else "now")
  CONCERTO_REPO       concerto git checkout (default: this checkout)
  CONCERTO_RUST_REPO  concerto-rust git checkout (default: ../concerto-rust
                      next to the concerto checkout)
  LOG_BRANCH          integration ref in both checkouts
                      (default: origin/claude/tender-pascal-ocwf9q)

Nothing here writes outside LOG_OUT.
"""
import datetime as dt
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.environ.get('LOG_OUT') or os.path.join(HERE, 'out'))
RAW = os.path.join(OUT, 'raw')

GH_RUST = 'https://github.com/accordproject/concerto-rust'
GH_TS = 'https://github.com/accordproject/concerto'
REPOS = ('concerto', 'concerto-rust', 'concerto-conformance')
OWNER = 'accordproject'
TRACKER = 'concerto-rust'

# Only content authored by this account counts as a decision or instruction.
MAINTAINER = 'mttrbrts'

# The tracker (plan issue #29) was created on 24 Sep 2026; PRs created earlier are not fetched.
SINCE = '2026-09-24T00:00:00Z'
# Comments are fetched with the API's `since` (last update) from the day before, which also
# picks up the maintainer's 23 Sep comments on PRs that the migration then touched.
COMMENTS_SINCE = '2026-09-23T00:00:00Z'
# First hour of the hourly burndown series.
START_HOUR = '2026-09-24T09:00:00Z'


def P(s):
    """Parse an ISO-8601 timestamp into an aware UTC datetime."""
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(dt.timezone.utc)


def iso(d):
    return d.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _toplevel():
    r = subprocess.run(['git', '-C', HERE, 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    return r.stdout.strip() or os.path.dirname(os.path.dirname(HERE))


CONCERTO_REPO = os.path.abspath(os.environ.get('CONCERTO_REPO') or _toplevel())
RUST_REPO = os.path.abspath(os.environ.get('CONCERTO_RUST_REPO') or os.path.join(os.path.dirname(CONCERTO_REPO), 'concerto-rust'))
BRANCH = os.environ.get('LOG_BRANCH', 'origin/claude/tender-pascal-ocwf9q')
REPO_DIRS = {'concerto': CONCERTO_REPO, 'concerto-rust': RUST_REPO}


def until():
    """The cutoff: nothing after it is counted, so a later rebuild reproduces an earlier one."""
    if os.environ.get('LOG_UNTIL'):
        return iso(P(os.environ['LOG_UNTIL']))
    meta = os.path.join(RAW, 'fetch_meta.json')
    if os.path.exists(meta):
        return json.load(open(meta))['until']
    return iso(dt.datetime.now(dt.timezone.utc))


def git(repo, *args, check=False):
    r = subprocess.run(['git', '-C', REPO_DIRS[repo], *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(f'git -C {REPO_DIRS[repo]} {" ".join(args)} failed: {r.stderr.strip()}')
    return r.stdout


def branch_at(repo, cutoff=None):
    """The integration branch's first-parent commit at the cutoff."""
    cutoff = cutoff or until()
    sha = git(repo, 'rev-list', '-1', '--first-parent', f'--before={cutoff}', BRANCH, check=True).strip()
    if not sha:
        raise SystemExit(f'{repo}: no commit on {BRANCH} before {cutoff}')
    return sha


def first_parent_log(repo, path, cutoff=None):
    """[(sha, commit time, subject)] for commits touching path on the first-parent line, oldest first."""
    cutoff = cutoff or until()
    out = git(repo, 'log', '--first-parent', '--reverse', f'--before={cutoff}', '--format=%H %cI %s', BRANCH, '--', path, check=True)
    rows = []
    for line in out.strip().splitlines():
        sha, cts, subj = line.split(' ', 2)
        rows.append((sha, cts, subj))
    return rows


def show(repo, rev, path):
    """File contents at a commit. Fetches the commit by sha from origin if the clone lacks it
    (benchmark results published on task branches that were squash-merged or never merged);
    such revs must be full 40-character shas, since only those can be fetched."""
    r = subprocess.run(['git', '-C', REPO_DIRS[repo], 'show', f'{rev}:{path}'], capture_output=True, text=True)
    if r.returncode == 0:
        return r.stdout
    subprocess.run(['git', '-C', REPO_DIRS[repo], 'fetch', '-q', 'origin', rev], capture_output=True, text=True)
    return git(repo, 'show', f'{rev}:{path}', check=True)


def load(name):
    return json.load(open(os.path.join(RAW, name)))


def dump(obj, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=kw.pop('indent', 1), **kw)


def task_id(title):
    """Task id from an issue title: P5-60, P2-11b, P5-08c, DV-007 or #94b style."""
    import re
    m = re.search(r'\b(P\d-\d+[a-z]?(?:-[A-Z]\d+[a-z]?)?)', title)
    if m:
        return m.group(1)
    m = re.search(r'(DV-\d+)', title)
    if m:
        return m.group(1)
    m = re.search(r'#(\d+b)', title)
    return m.group(1) if m else None
