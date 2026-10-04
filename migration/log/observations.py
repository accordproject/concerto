"""Curated observations for the progress log, each with its source.

These values were read by hand from GitHub comments, gate reports, status snapshots and
git history, because they are not published in a machine-readable form. Each row carries
its timestamp and a source (URL or repo@sha:path). The builder keeps a row only when its
timestamp is at or before the cutoff. Values are as published: never interpolate, and
leave a gap rather than estimate a missing value.

NYC rows are kept in events.json and burndown.json for the record, but no unit-test (nyc)
coverage series is rendered on the page.
"""
GH_RUST = 'https://github.com/accordproject/concerto-rust'
GH_TS = 'https://github.com/accordproject/concerto'

# Oracle corpus size over time (fixtures), with the comment that published it.
corpus_total = [('2026-09-24T00:00:00Z', 16085, f'{GH_RUST}/issues/44 (P1-07 done comment: 16,085 fixtures)'),
                ('2026-09-26T08:14:34Z', 16242, f'{GH_RUST}/issues/190 (P2-11b supplement: 16,242 fixtures)')]

# concerto-core nyc (statements, branches, functions, lines) from status snapshots, gate reports and
# verification comments of merged work. Recorded only; not rendered.
NYC = [
 ('2026-09-24T09:52:05Z', 98.95, 95.8, 99.18, 98.96, f'{GH_RUST}/issues/30', 'P0-01 baseline, TS engine'),
 ('2026-09-24T16:02:25Z', 99.01, 95.86, 99.34, 99.03, 'concerto@565aa6d7d:migration/status/status.json', 'status snapshot'),
 ('2026-09-25T18:29:44Z', 98.98, 95.7, 99.18, 98.99, 'concerto:migration/gate/reports/2026-09-25T18-22-08-435Z/status.json', 'gate dry run 1 (sandbox network test fails)'),
 ('2026-09-26T15:25:08Z', 99.04, 95.72, 99.34, 99.05, 'concerto:migration/gate/reports/2026-09-26T15-12-37-398Z/status.json', 'gate run'),
 ('2026-09-26T22:26:20Z', 99.04, 95.72, 99.34, 99.06, 'concerto:migration/gate/reports/2026-09-26T22-16-25-156Z/status.json', 'gate run'),
 ('2026-09-27T04:42:29Z', 99.04, 95.72, 99.34, 99.06, 'concerto@5d2cc6a92:migration/status/status.json', 'P5-01 gate snapshot'),
 ('2026-09-27T15:08:18Z', 99.35, 96.29, 99.81, 99.34, f'{GH_RUST}/issues/73', 'P5-02 merged (TS logic deleted, lifted fixtures)'),
 ('2026-09-27T18:35:40Z', 99.32, 96.21, 99.81, 99.31, f'{GH_RUST}/issues/269', 'P5-10a'),
 ('2026-09-27T19:19:39Z', 99.12, 95.9, 99.62, 99.15, f'{GH_RUST}/issues/270', 'P5-10b'),
 ('2026-09-27T20:35:44Z', 99.37, 96.23, 99.81, 99.4, f'{GH_TS}/pull/1397', 'integration verification'),
 ('2026-09-28T10:48:10Z', 99.29, 96.33, 99.62, 99.32, f'{GH_RUST}/issues/262', '#262 rustHandle fallback fix'),
 ('2026-09-28T13:41:29Z', 99.37, 96.41, 99.81, 99.4, f'{GH_TS}/pull/1406', 'P5-13 merge'),
 ('2026-09-28T18:02:29Z', 99.29, 96.4, 99.62, 99.32, f'{GH_RUST}/issues/308', 'P5-14'),
 ('2026-09-28T19:11:25Z', 99.4, 96.74, 99.62, 99.43, f'{GH_RUST}/issues/287', 'deferred port candidates (#287)'),
 ('2026-09-28T20:20:49Z', 99.48, 96.75, 99.81, 99.51, f'{GH_RUST}/issues/293', 'P5-12c'),
 ('2026-09-29T07:17:46Z', 99.4, 96.75, 99.62, 99.43, f'{GH_RUST}/issues/324', 'P5-19 merge'),
 ('2026-09-29T12:04:28Z', 99.36, 96.37, 99.62, 99.4, f'{GH_TS}/pull/1425', 'integration verification'),
 ('2026-09-29T14:33:48Z', 99.45, 96.41, 99.81, 99.48, f'{GH_RUST}/issues/328', 'P5-24 merged trees'),
 ('2026-09-29T17:37:38Z', 99.09, 95.56, 99.44, 99.12, f'{GH_RUST}/issues/346', 'P5-36 merge (after P5-34/P5-35 removed lifted checks)'),
 ('2026-09-29T21:48:20Z', 99.04, 95.63, 99.27, 99.07, f'{GH_RUST}/issues/373', 'P5-52 merge; statements at the 99% floor (P5-59 #390 restores margin)'),
 ('2026-09-30T07:31:16Z', 99.04, 95.63, 99.27, 99.07, f'{GH_RUST}/issues/350', 'P5-40 merge'),
]

# Rust-native conformance harness (concerto-conformance semantic/features/support/rust) against
# the concerto-rust integration branch.
CONF_NATIVE = [
 dict(ts='2026-09-24T10:49:50Z', total=81, run=60, passed=60, skip_upstream=6, skip_rust=6, skip_missing=9, suite='81 scenarios (conformance at P0-07)', draft=False,
      source=f'{GH_RUST}/issues/36#issuecomment-5812653522', note='P0-07: 60 PASS, 21 SKIP (9 unusable fixtures, 6 upstream @skip, 6 @skip-rust)'),
 dict(ts='2026-09-27T15:49:16Z', total=108, run=67, passed=67, skip_upstream=None, skip_rust=41, skip_missing=None, suite='108 semantic (after promotion PRs #39/#40)', draft=False,
      source=f'{GH_RUST}/issues/249#issuecomment-5857380427', note='67/67 run passed with 41 @skip-rust; total computed as 67 + 41; upstream @skip count not stated'),
 dict(ts='2026-09-30T15:40:00Z', total=116, run=69, passed=69, skip_upstream=7, skip_rust=40, skip_missing=0, suite='116 semantic (conformance main 57d3c23); 42 instance scenarios not run (no instance runner)', draft=False,
      source=f'{GH_RUST}/issues/397 (issue body: coordinator run, 2026-09-30)', note='With @skip-rust included: 69 pass, 34 fail on "a step has no matching definition", 6 unexpected passes'),
 dict(ts='2026-09-30T16:27:50Z', total=158, run=151, passed=151, skip_upstream=7, skip_rust=0, skip_missing=0, suite='158 semantic + instance, draft harness (conformance#42, c578a7e)', draft=True,
      source=f'{GH_RUST}/issues/397#issuecomment-5915386936', note='P5-62 draft harness against integration 4c7c827: 151 run, 151 passed, 0 errors; not yet merged to conformance main'),
]
# JS conformance harness (reference runs).
CONF_JS = [
 dict(ts='2026-09-25T16:33:11Z', passed=75, total=75, engine='engine not stated in source', source=f'{GH_RUST}/issues/145', note='concerto-conformance local run (60 semantic + 15 validate)'),
 dict(ts='2026-09-26T16:16:55Z', passed=75, total=75, engine='engine not stated in source', source=f'{GH_RUST}/issues/72', note='P5-01 gate item 7'),
 dict(ts='2026-09-27T08:51:44Z', passed=149, total=149, engine='npm concerto-core 5.0.0 (TS reference)', source=f'{GH_TS}/pull/1381', note='after promotion PRs: 108/108 semantic + 41/41 instance'),
 dict(ts='2026-09-27T23:31:05Z', passed=151, total=151, engine='Rust engine build (P5-10c lazy engine)', source=f'{GH_RUST}/issues/271', note='109/109 semantic + 42/42 instance'),
]

# Regressions caught at verification: (ts, issue, summary).
REG = [
 ('2026-09-25T13:56:59Z', 68, 'P4-09 merge verification: nyc lines 98.4% below the 99% threshold.'),
 ('2026-09-25T19:54:05Z', 157, 'P4-09a: nyc statements/lines dropped below the pre-merge 99.03%/99.05%.'),
 ('2026-09-27T07:33:15Z', 73, 'P5-02 (TS deletion) branch: nyc fell to 88.68/75.96/95.84/88.6 against the 99/94.8/99/99 gate; caught before merge.'),
 ('2026-09-28T07:41:30Z', 289, 'P5-12 spike: nyc statements 98.97% below threshold because validate() bypassed the visitor code.'),
 ('2026-09-29T21:24:03Z', 345, 'After P5-35 removed lifted checks, integration nyc sat exactly at the 99% statement floor (25 of 2,547 statements uncovered); restore filed as P5-59 (#390).'),
 ('2026-09-28T08:36:01Z', 262, '#262 fix: nyc lines 98.84% / statements 98.82% below threshold (basemodelmanager.ts); fixed before merge.'),
]

# Process gaps: (ts, source, summary).
REG2 = [('2026-09-29T17:32:32Z', 'concerto@1f86bc13d', 'Merge-step check gap: the concerto merge check ran a narrow mocha command without the lifted fallbacks and nyc thresholds, so P5-34, P5-43 and P5-35 merged without confirmed coverage; fixed upstream by running the full core suite.')]

# Breaking-changes plan milestones: (commit time, concerto sha of migration/BREAKING-CHANGES-PLAN.md, summary).
BC = [
 ('2026-09-26T22:35:16Z', '7fb90ba93', 'P5-07 breaking-changes plan drafted: BC-02..BC-36 and BR-01, grouped into releases R1 (engine switch), R2 (deprecations), R3 (breaking major) and RB (Rust-only).'),
 ('2026-09-27T15:04:59Z', '7c2cc6752', 'BC-07 decision recorded: the Rust engine will not support non-strict DateTime values.'),
 ('2026-09-27T16:02:14Z', 'f728cd250', 'BC-37 added: P5-02 public API snapshot removals (DecoratorExtractor, internal DecoratorManager helpers).'),
 ('2026-09-27T16:50:54Z', '65889f839', 'BC-38..BC-40 added from the conformance review (P5-08c).'),
 ('2026-09-27T17:48:02Z', '2ce596bf7', 'BC-03 decided: accept DV-004 (lone surrogates become U+FFFD at the WASM boundary).'),
 ('2026-09-27T23:30:15Z', 'ac283fb05', 'BC-23, BC-24 and BC-25 (lazy views) moved to R1 after P5-10a/b shipped them.'),
 ('2026-09-29T09:46:20Z', '45366eae1', 'P5-24: BC-07 (b)+(c) moved to R1; BC-41..BC-45 and BR-12/BR-13 added.'),
 ('2026-09-29T13:43:16Z', '34e2950fa', 'BC-41 (strict namespace SemVer) moved from R3 to R1; BC-45 DateTime defaults checked when applied.'),
 ('2026-09-29T14:02:26Z', 'a4b070ee1', 'BC-31 applied: package requires Node.js ^20.19.0 || >=22.12.0.'),
 ('2026-09-29T16:13:48Z', '7776030be', 'One major release (Q2 answered): R3 folded into R1; R1 schedules BC-02, BC-05, BC-10, BC-17..BC-20, BC-28, BC-39, BC-40 (plus BC-41 and BC-46..BC-50 already there); BC-34 becomes changelog-only; BC-04/21/24/27/33/35/44/49 left to decide.'),
 ('2026-09-29T16:38:48Z', '38d4621cd', 'BC-41 detail: versionParsed is null in both engines for versions beyond node-semver limits.'),
 ('2026-09-29T17:37:38Z', 'ff76c2ff2', 'BC-46/BC-48 (P5-34), BC-47 (P5-35) and BC-50 (P5-36) recorded as shipped in R1.'),
 ('2026-09-29T17:59:03Z', '26f02d79a', 'BC-41 strict SemVer namespace versions shipped in R1 (P5-38).'),
 ('2026-09-29T18:09:50Z', '4f44cea0b', 'BC-10 non-finite Integer/Long rejected by the populator shipped in R1 (P5-51).'),
 ('2026-09-29T19:31:18Z', '2ca6a08a3', 'BC-05 relationship map values behave like relationship properties, shipped in R1 (P5-58).'),
 ('2026-09-30T10:39:28Z', '780bc6dad', 'BC-39 and BC-40 shipped in R1 (P5-53); conformance scenarios held until R1 is on npm.'),
 ('2026-09-30T11:23:07Z', '5a6e7ef0e', 'BC-19 with BC-17, BC-18 and BC-20 shipped in R1 (P5-49): strict AST shape at load, opt-out via metamodelValidation:false.'),
 ('2026-10-01T11:40:46Z', 'c83b8a74a', 'BC-34 shipped in R1 (P5-71): the ./dist/* export is removed from concerto-core, with a new exports check; no consumers found across the accordproject org.'),
 ('2026-09-30T19:31:17Z', 'a34097848', 'BC-01, BC-06, BC-08, BC-11, BC-12 and BC-14 (TS bugs ported for parity) fixed in R1 (P5-63).'),
 ('2026-09-30T20:19:18Z', '09295b075', 'BC-51: DateTimeUtil.setCurrentTime accepts only strict DateTime strings, R1 (P5-67).'),
 ('2026-09-30T16:14:44Z', '379eea9ed', 'BC-02 shipped in R1 (P5-50): unversioned namespaces rejected, including DCS command targets.'),
 ('2026-09-29T21:47:58Z', '00e59f2c6', 'BC-28 options.regExp retired, shipped in R1 (P5-52).'),
]

# Changes to how D1 is measured: (ts, issue, summary).
LEDGER_PC = [
 ('2026-09-27T17:49:59Z', 261, 'Ledger reclassification (#261): RUST rows with no engine call become PARTIAL and leave the D1 numerator; D1 falls from 78.9% to 61.5% and is reported NOT met.'),
 ('2026-09-28T06:41:54Z', 276, 'P5-11 reclassification per maintainer decision: most PARTIAL/HYBRID rows become TS; D1 falls to 39.4% and the gate reports §0.4 FAIL.'),
 ('2026-09-28T19:17:33Z', 287, 'Deferred port candidates (14 M rows) ported after the pause was lifted: D1 rises to 45.8%.'),
 ('2026-09-30T19:27:33Z', 401, 'P5-64 D1 ledger re-audit after the R1 changes (test-support removal, engine-shim helpers classified TS): D1 39.7% of 7,513 weight, RUST only 19.1%.'),
]
