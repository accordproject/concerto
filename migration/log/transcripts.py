#!/usr/bin/env python3
"""Optional: extract the text turns of local Claude Code transcripts, merged by timestamp.

Transcripts live only on the machine that ran a session, so this step is optional: the
rest of the log builds without it, and the transcript-dependent part (curated transcript
events and the coordinator/local-matt session logs) is then left as a gap.

Usage:
  python3 transcripts.py NAME=PATH [NAME=PATH ...] [--since TS] [--until TS] [--user-only]
                         [--width N] [--window N] [--out FILE]

NAME labels a session (for example coordinator or local-matt). PATH is a .jsonl transcript
or a directory searched recursively for *.jsonl. A session made of several files is read
in the order of each file's first timestamp, and its line numbers run on across the files,
so `transcript:<NAME>:<line>` stays a stable reference.

Each file is streamed line by line (never loaded whole) and the sessions are merged with a
heap on timestamp. Claude Code appends records almost in time order (a few records land up
to a few dozen lines early), so each session passes through a small reorder buffer
(--window records, default 256) before the merge; the output is in timestamp order as
long as no record is displaced by more than the window. Output is TSV, one row per text turn:

  ts  session  line  role  text

with newlines shown as " ⏎ " and text cut to --width characters (default 600). Tool
calls, tool results and other non-text records are skipped.

The rows are raw material. Turning them into events is a curation step: write the events
to a JSON list (same shape as events.json entries, with source "transcript:<NAME>:<line>",
and only mttrbrts's own words counted as decisions) and pass it to events.py with
LOG_TRANSCRIPT_EVENTS=<file>. Never commit transcripts themselves.
"""
import argparse
import heapq
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import P  # noqa: E402


def files_of(path):
    if os.path.isfile(path):
        return [path]
    out = []
    for root, _, names in os.walk(path):
        out += [os.path.join(root, n) for n in names if n.endswith('.jsonl')]
    return out


def first_ts(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            try:
                ts = json.loads(line).get('timestamp')
            except ValueError:
                continue
            if ts:
                return ts
    return '9999'


def text_of(rec):
    msg = rec.get('message') or {}
    content = msg.get('content')
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(p.get('text', '') for p in content if isinstance(p, dict) and p.get('type') == 'text').strip()
    return ''


def turns(name, paths, args):
    """Text turns of one session, in file order; yields (ts, name, line, role, text)."""
    line_no = 0
    for path in sorted(paths, key=first_ts):
        with open(path, encoding='utf-8', errors='replace') as f:
            for raw in f:
                line_no += 1
                try:
                    rec = json.loads(raw)
                except ValueError:
                    continue
                role = rec.get('type')
                ts = rec.get('timestamp')
                if role not in ('user', 'assistant') or not ts:
                    continue
                if args.user_only and role != 'user':
                    continue
                if (args.since and P(ts) < P(args.since)) or (args.until and P(ts) > P(args.until)):
                    continue
                text = text_of(rec)
                if text:
                    yield (P(ts).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z', name, line_no, role, text)


def reorder(stream, window):
    """Sort a nearly sorted stream with a bounded heap."""
    heap = []
    seq = 0
    for item in stream:
        heapq.heappush(heap, (item[0], seq, item))
        seq += 1
        if len(heap) > window:
            yield heapq.heappop(heap)[2]
    while heap:
        yield heapq.heappop(heap)[2]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sessions', nargs='+', metavar='NAME=PATH')
    ap.add_argument('--since')
    ap.add_argument('--until')
    ap.add_argument('--user-only', action='store_true')
    ap.add_argument('--width', type=int, default=600)
    ap.add_argument('--window', type=int, default=256)
    ap.add_argument('--out')
    args = ap.parse_args()
    streams = []
    for spec in args.sessions:
        name, _, path = spec.partition('=')
        if not path:
            ap.error(f'expected NAME=PATH, got {spec}')
        paths = files_of(os.path.expanduser(path))
        if not paths:
            print(f'{name}: no .jsonl under {path}; skipped', file=sys.stderr)
            continue
        streams.append(reorder(turns(name, paths, args), args.window))
    out = open(args.out, 'w') if args.out else sys.stdout
    n = 0
    for ts, name, line, role, text in heapq.merge(*streams, key=lambda t: t[0]):
        text = text.replace('\t', ' ').replace('\n', ' ⏎ ')
        out.write(f'{ts}\t{name}\t{line}\t{role}\t{text[:args.width]}\n')
        n += 1
    if args.out:
        out.close()
    print(f'{n} turns', file=sys.stderr)


if __name__ == '__main__':
    main()
