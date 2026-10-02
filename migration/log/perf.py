#!/usr/bin/env python3
"""Build <out>/perf.json and <out>/raw/perf_events.json: Rust-vs-TS performance ratios per
operation, model set, task and run, grouped into the page's categories.

Sources are migration/bench/RESULTS.md and results/P5-*/ in concerto (cited as
concerto@<sha>:<path>) and the GitHub comments that published a result. Where a task
published a machine-readable table (P5-15, P5-22, P5-28 table/compare.md; P5-60 and P5-72
tables.json) it is read from git at the publishing commit; the rest were transcribed from
RESULTS.md as stated, with any computed value marked by a 'derivation' field.
Never interpolate: a value the source does not state is left out.
"""
import json, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import OUT, RAW, dump, show  # noqa: E402
RES = "migration/bench/RESULTS.md"

def C(sha, path=RES):
    return f"concerto@{sha}:{path}"

WORKER = {75: "cloud-3", 92: "cloud-2", 255: "local-matt", 220: "cloud-3", 226: "cloud-3", 227: "cloud-3",
          234: "cloud-3", 239: "cloud-3", 269: "cloud-3", 270: "cloud-3", 271: "cloud-3", 289: "local-matt",
          292: "local-matt", 293: "local-matt", 296: "local-matt", 297: "local-matt", 308: "cloud-3",
          309: "local-matt", 310: "cloud-3", 315: "local-matt", 316: "local-matt", 317: "cloud-3",
          318: "local-matt", 319: "cloud-3", 326: "cloud-3", 332: "cloud-3", 333: "cloud-3", 334: "cloud-3",
          335: "cloud-3", 351: "cloud-3", 273: "local-matt", 350: "cloud-3", 352: "cloud-3", 369: "cloud-3",
          392: "cloud-3", 413: "cloud-3", 414: "cloud-3"}

SETN = {"core-test-data": "concerto-core-test-data", "concerto-core-test-data": "concerto-core-test-data",
        "conformance": "conformance", "synthetic-large": "synthetic-large", "(synthetic, 500)": "instance-500",
        "instance": "instance-500", "(none)": "system-models", "(system models)": "system-models", "Item": "Item"}

E = []
def add(op, ts, task, issue, level, rb, ra, machine, run, source, set_=None, **kw):
    e = {"ts": ts, "task": task, "issue": issue, "level": level, "ratio_before": rb, "ratio_after": ra,
         "machine": machine, "run": run, "source": source}
    if set_ is not None:
        e["set"] = SETN.get(set_, set_)
    e.update(kw)
    E.append((op, e))

TD, CF, SL, INS = "concerto-core-test-data", "conformance", "synthetic-large", "instance-500"

# ---------- P5-04a (#92) crate vs TS, cloud-2 Xeon 2.80GHz ----------
s = C("483a952d3"); ts = "2026-09-24T17:07:46Z"; run = "P5-04a/single-run"
for st, v in [(TD, 2.61), (CF, 1.90), (SL, 8.56)]:
    add("load", ts, "P5-04a", 92, "crate", None, v, "cloud", run, s, st, note="crate add_model/from_json load vs TS ModelManager load")
add("validate_models", ts, "P5-04a", 92, "crate", None, 0.24, "cloud", run, s, CF, note="crate validate_models vs TS validate; other sets skipped (crate did not accept them yet)")
for st, v in [(TD, 0.122), (CF, 0.112)]:
    add("validate_ast", ts, "P5-04a", 92, "crate", None, v, "cloud", run, s, st, note="crate ModelFile::from_json vs TS validateAst (P5-12d later noted this times model loading, not the metamodel check)")
for st, v in [(TD, 0.054), (CF, 0.116)]:
    add("validate_ast", ts, "P5-04a", 92, "crate", None, v, "cloud", run, s, st, variant="concerto-validate-rs")

# ---------- P5-04 (#75) baseline, cloud Xeon 2.10GHz ----------
s = C("1abf7e9ac"); ts = "2026-09-26T14:55:38Z"; run = "P5-04/run1(2026-09-26T14:51)"
for st, v in [(TD, 40.0), (CF, 46.8), (SL, 107.6)]:
    add("load", ts, "P5-04", 75, "TS-API", None, v, "cloud", run, s, st)
for st, v in [(TD, 31.9), (CF, 37.6), (SL, 44.1)]:
    add("load_validate", ts, "P5-04", 75, "TS-API", None, v, "cloud", run, s, st, note="run-ts.mjs 'validate' metric (fresh load + validateModelFiles)")
for st, v in [(TD, 6.5), (CF, 12.1)]:
    add("validate_ast", ts, "P5-04", 75, "TS-API", None, v, "cloud", run, s, st)
add("from_json", ts, "P5-04", 75, "TS-API", None, 14.9, "cloud", run, s, INS)
add("validate", ts, "P5-04", 75, "TS-API", None, 30.8, "cloud", run, s, INS, note="Resource.validate() / validate_only")
for st, v in [(TD, 2.88), (CF, 2.30), (SL, 8.50)]:
    add("load", ts, "P5-04", 75, "crate", None, v, "cloud", run, s, st)
for st, v in [(TD, 0.99), (CF, 1.39), (SL, 1.55)]:
    add("validate_models", ts, "P5-04", 75, "crate", None, v, "cloud", run, s, st)
for st, v in [(TD, 0.133), (CF, 0.136)]:
    add("validate_ast", ts, "P5-04", 75, "crate", None, v, "cloud", run, s, st, note="crate ModelFile::from_json vs TS validateAst (not the metamodel check, per P5-12d)")
add("validate", ts, "P5-04", 75, "crate", None, 2.1, "cloud", run, s, INS, note="crate validate_instance vs TS Resource.validate()")

# ---------- P5-06 (#220) cloud ----------
s = C("82509aa29"); ts = "2026-09-26T16:15:00Z"; run = "P5-06/runs1-2"
rows = [("load", TD, 40.4, 13.3), ("load_validate", TD, 27.8, 17.0), ("validate_ast", TD, 6.5, 1.7),
        ("load", CF, 41.9, 24.6), ("load_validate", CF, 34.4, 21.0), ("validate_ast", CF, 11.7, 2.5),
        ("load", SL, 105.6, 40.4), ("load_validate", SL, 42.4, 17.3),
        ("from_json", INS, 16.5, 5.7), ("validate", INS, 32.8, 6.8)]
for op, st, b, a in rows:
    add(op, ts, "P5-06", 220, "TS-API", b, a, "cloud", run, s, st)

# ---------- P5-06a (#226) lazy-views spike, not merged ----------
s = C("47788cced"); ts = "2026-09-26T18:26:03Z"; run = "P5-06a/runs1-3"
rows = [("load", TD, 14.4, 4.7), ("load_validate", TD, 15.1, 6.2), ("validate_ast", TD, 1.8, 1.7),
        ("load", CF, 17.0, 8.2), ("load_validate", CF, 20.8, 10.3), ("validate_ast", CF, 2.4, 2.5),
        ("load", SL, 47.0, 21.3), ("load_validate", SL, 17.2, 8.7),
        ("from_json", INS, 4.4, 4.5), ("validate", INS, 8.7, 8.8)]
for op, st, b, a in rows:
    add(op, ts, "P5-06a", 226, "TS-API", b, a, "cloud", run, s, st, merged=False, note="spike; maintainer decided no lazy-views rollout at the time (later done as P5-10a/b)")

# ---------- P5-06b (#227) spike, closed not planned ----------
u = "https://github.com/accordproject/concerto-rust/issues/227#issuecomment-5848836798"; ts = "2026-09-26T18:40:54Z"
add("from_json", ts, "P5-06b", 227, "TS-API", 5.6, 2.4, "cloud", "P5-06b/profile-run", u, INS, merged=False, note="closed as not planned; branch kept as reference, not merged")
add("validate", ts, "P5-06b", 227, "TS-API", 9.1, 2.9, "cloud", "P5-06b/profile-run", u, INS, merged=False, note="closed as not planned; not merged")

# ---------- P5-06c (#234) spike ----------
u = "https://github.com/accordproject/concerto-rust/issues/234#issuecomment-5849657270"; ts = "2026-09-26T20:34:06Z"
rows = [("load", TD, 36.0, 529, 508, 14.1), ("load_validate", TD, 69.0, 1131, 622, 9.0), ("validate_ast", TD, 640, 1098, 1115, 1.7),
        ("load", CF, 15.4, 401, 156, 10.1), ("load_validate", CF, 25.6, 497, 356, 13.9), ("validate_ast", CF, 253, 628, 616, 2.4),
        ("load", SL, 717, 28439, 20675, 28.8), ("load_validate", SL, 2204, 38966, 25019, 11.4),
        ("from_json", INS, 8.6, 46.4, 48.9, 5.7), ("validate", INS, 2.0, 19.2, 18.5, 9.3)]
for op, st, t, b, a, ra in rows:
    add(op, ts, "P5-06c", 234, "TS-API", round(b / t, 2), ra, "cloud", "P5-06c/runs1-3", u, st,
        derivation="ratio_before computed from the comment's before us / TS us (same run); ratio_after as stated",
        merged=False, note="spike; adopted as P5-06d")

# ---------- P5-06d (#239) ----------
s = C("557dbd5b3"); ts = "2026-09-27T16:18:37Z"; run = "P5-06d/runs1-3"
rows = [("load", TD, 14.8, 14.9), ("load_validate", TD, 15.9, 8.2), ("validate_ast", TD, 1.6, 1.4),
        ("load", CF, 23.7, 10.4), ("load_validate", CF, 19.2, 12.1), ("validate_ast", CF, 2.3, 2.4),
        ("load", SL, 32.1, 28.6), ("load_validate", SL, 14.9, 9.0),
        ("from_json", INS, 6.6, 7.0), ("validate", INS, 8.8, 9.3)]
for op, st, b, a in rows:
    add(op, ts, "P5-06d", 239, "TS-API", b, a, "cloud", run, s, st)

# ---------- P5-04b (#255) laptop ----------
s = C("5efc7d547"); ts = "2026-09-27T16:42:34Z"; run = "P5-04b/runs1-2"
rows = [("load", TD, 16.9, 16.9), ("load_validate", TD, 18.7, 18.7), ("validate_ast", TD, 1.5, 1.5),
        ("load", CF, 28.9, 28.6), ("load_validate", CF, 25.3, 26.0), ("validate_ast", CF, 2.0, 2.1),
        ("load", SL, 64.2, 65.4), ("load_validate", SL, 29.4, 29.2),
        ("from_json", INS, 6.4, 6.2), ("validate", INS, 9.1, 9.3)]
for op, st, b, a in rows:
    add(op, ts, "P5-04b", 255, "TS-API", b, a, "laptop", run, s, st,
        note="before = same post-P5-02 engine via pre-P5-02 TS wrapper (provenance corrected in 5efc7d547; first published b0ee2a7d2 2026-09-27T16:32:54Z); engine built without wasm-opt; quiet-check threshold (<4.0) unconfirmed")

# ---------- P5-10a (#269) ----------
s = C("c3b3a5f41"); ts = "2026-09-27T18:17:01Z"; run = "P5-10a/runs1-3"
rows = [("load", TD, 13.6, 4.6), ("load_validate", TD, 8.6, 3.0), ("validate_ast", TD, 1.8, 1.8),
        ("load", CF, 12.2, 5.3), ("load_validate", CF, 13.9, 8.1), ("validate_ast", CF, 2.6, 2.6),
        ("load", SL, 30.3, 10.3), ("load_validate", SL, 12.5, 5.2),
        ("from_json", INS, 5.9, 6.4), ("validate", INS, 9.2, 9.2)]
for op, st, b, a in rows:
    add(op, ts, "P5-10a", 269, "TS-API", b, a, "cloud", run, s, st)

# ---------- P5-10c (#271) ----------
s = C("980d934c1"); ts = "2026-09-27T20:56:36Z"; run = "P5-10c/runs1-3"
rows = [("load", TD, 12.0, 4.1), ("load_validate", TD, 9.3, 3.2), ("validate_ast", TD, 1.8, 1.8),
        ("load", CF, 10.0, 4.6), ("load_validate", CF, 13.7, 8.0), ("validate_ast", CF, 2.8, 2.7),
        ("load", SL, 35.7, 12.4), ("load_validate", SL, 15.0, 6.0),
        ("from_json", INS, 6.3, 5.8), ("validate", INS, 9.2, 9.7)]
for op, st, b, a in rows:
    add(op, ts, "P5-10c", 271, "TS-API", b, a, "cloud", run, s, st, note="before = pre-lazy head; after = head after P5-10a+P5-10b")

# ---------- P5-12 (#289) spike, laptop ----------
u = "https://github.com/accordproject/concerto-rust/issues/289#issuecomment-5865590258"; ts = "2026-09-28T07:41:30Z"
for var, v in [("A: TS primitive check", 7.6), ("B: one Rust call per resource", 6.6), ("C: hoist lookups", 9.1)]:
    add("validate", ts, "P5-12", 289, "TS-API", 9.2, v, "laptop", "P5-12/runs1-3", u, INS, variant=var, merged=False,
        note="design spike; load average 2.2-3.2")

# ---------- P5-12b (#292) spike, laptop, not quiet ----------
u = "https://github.com/accordproject/concerto-rust/issues/292#issuecomment-5866642523"; ts = "2026-09-28T08:52:45Z"
for var, v in [("(a) JSON straight to validator values", 4.3), ("(b) serde-wasm-bindgen", 5.8), ("(c) compact binary Uint8Array", 3.6), ("(c)+(e) scratch buffer", 3.5)]:
    add("validate", ts, "P5-12b", 292, "TS-API", 8.0, v, "laptop", "P5-12b/runs1-3", u, INS, variant=var, merged=False,
        note="spike; before = P5-12 variant B (wire JSON); machine not quiet (1-min load 5-15)")

# ---------- P5-12d (#296) spike, laptop ----------
u1 = "https://github.com/accordproject/concerto-rust/issues/296#issuecomment-5867198186"
u2 = "https://github.com/accordproject/concerto-rust/issues/296#issuecomment-5867759017"
for st, b, a in [(TD, 1.47, 1.36), (CF, 2.24, 2.09)]:
    add("validate_ast", "2026-09-28T09:29:33Z", "P5-12d", 296, "TS-API", b, a, "laptop", "P5-12d/round-set-1", u1, st, variant="(a) validateAstValue", merged=False, note="spike; adopted in P5-13")
for st, b, a in [(TD, 1.50, 1.39), (CF, 2.17, 1.58)]:
    add("validate_ast", "2026-09-28T10:03:32Z", "P5-12d", 296, "TS-API", b, a, "laptop", "P5-12d/round-set-2", u2, st, variant="(a) + resident metamodel", merged=False, note="spike; adopted in P5-13")

# ---------- P5-13 (#297) laptop ----------
s = C("a4959e42d"); ts = "2026-09-28T12:16:12Z"; run = "P5-13/first-run(not quiet)"
for op, st, b, a in [("validate_ast", TD, 1.21, 0.35), ("validate_ast", CF, 1.79, 0.41), ("from_json", INS, 6.57, 4.13), ("validate", INS, 10.17, 10.30)]:
    add(op, ts, "P5-13", 297, "TS-API", b, a, "laptop", run, s, st, superseded=True, note="first run, machine not fully quiet; replaced by the quiet-machine run in 361bcb398")
s = C("361bcb398"); ts = "2026-09-28T15:46:31Z"; run = "P5-13/quiet-runs1-3"
for op, st, b, a in [("validate_ast", TD, 1.23, 0.37), ("validate_ast", CF, 1.90, 0.44), ("from_json", INS, 6.61, 4.22), ("validate", INS, 10.33, 10.13)]:
    add(op, ts, "P5-13", 297, "TS-API", b, a, "laptop", run, s, st)
add("validate", ts, "P5-13", 297, "crate", round(2.26 / 2.12, 2), 0.64, "laptop", run, s, INS, route="in-WASM (benches/wasm-instance, no TS boundary)",
    derivation="ratio_before computed: in-WASM before 2.26 us / TS-API TS 5.0.0 validate() 2.12 us (RESULTS text states 1.07x); ratio_after stated 0.64x",
    note="in-WASM validate_only vs TS 5.0.0 whole Resource.validate()")
add("from_json", ts, "P5-13", 297, "crate", round(19.94 / 8.83, 2), 0.82, "laptop", run, s, INS, route="in-WASM (benches/wasm-instance, no TS boundary)",
    derivation="ratio_before computed: in-WASM before median 19.94 us / TS fromJSON 8.83 us (text states 2.3x slower); ratio_after stated 0.82x")

# ---------- P5-14 (#308) cloud ----------
s = C("64253e573"); ts = "2026-09-28T17:54:47Z"; run = "P5-14/runs1-3"
rows = [("load", TD, 5.30, 4.58), ("load_validate", TD, 2.60, 2.57), ("validate_ast", TD, 0.44, 0.42),
        ("load", CF, 5.33, 5.04), ("load_validate", CF, 7.34, 7.64), ("validate_ast", CF, 0.53, 0.52),
        ("load", SL, 12.17, 12.25), ("load_validate", SL, 4.28, 3.89),
        ("from_json", INS, 3.70, 4.02), ("validate", INS, 9.53, 3.92), ("to_json", INS, 5.88, 5.52),
        ("get_properties", "Item", 14.55, 0.23), ("get_property", "Item", 15.04, 2.39)]
for op, st, b, a in rows:
    add(op, ts, "P5-14", 308, "TS-API", b, a, "cloud", run, s, st)

# ---------- P5-12c (#293) laptop ----------
s = C("da964bab3"); ts = "2026-09-28T19:00:44Z"; run = "P5-12c/r1-runs1-3"
for op, b, a in [("from_json", 4.30, 4.33), ("validate", 11.50, 2.51), ("set_property_value", 9.88, 15.13), ("add_array_value", 9.36, 9.95)]:
    add(op, ts, "P5-12c", 293, "TS-API", b, a, "laptop", run, s, INS)
s = C("48fd2f497"); ts = "2026-09-28T21:35:55Z"; run = "P5-12c/r2-runs1-3"
for op, b, a in [("from_json", 4.60, 4.58), ("validate", 4.54, 2.31), ("set_property_value", 4.10, 4.63), ("add_array_value", 6.37, 7.36)]:
    add(op, ts, "P5-12c", 293, "TS-API", b, a, "laptop", run, s, INS, note="round 2 on the head with P5-11 and P5-14, plus the setPropertyValue fix")

# ---------- P5-15 (#309) laptop sweep (parsed from table.md) ----------
s = C("f6f6b10d7", "migration/bench/results/P5-15/table.md"); ts = "2026-09-28T20:28:01Z"; run = "P5-15/rounds1-3"
for line in show("concerto", "f6f6b10d7837d539ec5034a6f9fc44cc111c091e", "migration/bench/results/P5-15/table.md").splitlines(True):
    if not line.startswith("| ") or line.startswith("| op ") or line.startswith("|---"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    op, st, xcrate, xapi = c[0], c[1], c[4], c[6]
    m = re.match(r"([\d.]+)(?: \(([\d.]+)\))?", xcrate)
    add(op, ts, "P5-15", 309, "TS-API", None, float(xapi), "laptop", run, s, st, note="profiling sweep, measure only (branch not merged)")
    kw = {"note": "profiling sweep, measure only"}
    if m.group(2):
        kw["ratio_after_with_rebuild"] = float(m.group(2))
    add(op, ts, "P5-15", 309, "crate", None, float(m.group(1)), "laptop", run, s, st, **kw)

# ---------- P5-16 (#310) cloud ----------
s = C("eaeab4dc1"); ts = "2026-09-28T21:07:26Z"; run = "P5-16/first-round-runs1-3"
for op, b, a in [("from_json", 4.33, 2.26), ("validate", 4.58, 4.66), ("to_json", 6.66, 6.66)]:
    add(op, ts, "P5-16", 310, "TS-API", b, a, "cloud", run, s, INS, superseded=True, note="first round; replaced by the fix-round run in c8f9744c6")
s = C("c8f9744c6"); ts = "2026-09-28T21:56:21Z"; run = "P5-16/fix-round-runs1-3"
for op, b, a in [("from_json", 4.00, 1.82), ("validate", 3.97, 5.00), ("to_json", 6.41, 6.52)]:
    add(op, ts, "P5-16", 310, "TS-API", b, a, "cloud", run, s, INS)

# ---------- P6-04 (#273) laptop, three-way ----------
s0 = C("e22b70c28"); s = C("496df3f9a"); ts0 = "2026-09-28T20:34:28Z"; ts = "2026-09-28T20:41:19Z"; run = "P6-04/runs1-2"
for op, st, v in [("load", TD, 5.02), ("load", CF, 7.65), ("load", SL, 9.19),
                  ("load_validate", TD, 2.84), ("load_validate", CF, 4.90), ("load_validate", SL, 3.99),
                  ("validate_ast", TD, 0.33), ("validate_ast", CF, 0.41), ("from_json", INS, 3.77)]:
    kw = {"note": "Rust-via-TS/TS; the 'Validate (validate_models)' table's TS-API column is run-ts.mjs's validate metric (load + validateModelFiles)"} if op == "load_validate" else {}
    add(op, ts0, "P6-04", 273, "TS-API", None, v, "laptop", run, s0, st, **kw)
for op, st, v, old in [("load", TD, 3.70, 3.78), ("load", CF, 4.10, 4.43), ("load", SL, 10.59, 13.55),
                       ("validate_models", TD, 1.31, 1.36), ("validate_models", CF, 2.51, 3.19), ("validate_models", SL, 2.06, 2.63),
                       ("validate_ast", TD, 2.90, 2.92), ("validate_ast", CF, 7.35, 9.32)]:
    add(op, ts0, "P6-04", 273, "crate", None, old, "laptop", "P6-04/native-runs1-2(median, round 2 contended)", s0, st, superseded=True,
        note="original figures used contended native round 2; corrected in 496df3f9a")
    add(op, ts, "P6-04", 273, "crate", None, v, "laptop", "P6-04/native-run1", s, st,
        note="native public API (D11) vs TS 5.0.0; validate_ast is the free function metamodel::validate_ast (fresh metamodel per call)" if op == "validate_ast" else "native public API (D11) vs TS 5.0.0, native run 1 only")
add("from_json", ts, "P6-04", 273, "crate", None, 0.88, "laptop", "P6-04/native-run1", s, INS, note="native ModelManager::validate_instance vs TS Serializer.fromJSON")

# ---------- P5-21 (#319) cloud ----------
s = C("80c17efe3"); ts = "2026-09-28T21:47:40Z"; run = "P5-21/native-run1-vs-ts-runs1-3"
for st, v in [(TD, 0.28), (CF, 0.30)]:
    add("validate_ast", ts, "P5-21", 319, "crate", None, v, "cloud", run, s, st,
        note="native metamodel::validate_ast on a resident metamodel; before figure (P6-04 7.35x/2.90x) was on a different machine, so not recorded as ratio_before; runs did not meet the quiet gate")

# ---------- P5-17 (#315) laptop ----------
s = C("63c5f0bbe"); ts = "2026-09-28T22:52:42Z"; run = "P5-17/runs1-3"
rows = [("extract_decorators", TD, 11.11, 3.84), ("extract_decorators", CF, 14.26, 4.99), ("extract_decorators", SL, 6.44, 5.45),
        ("extract_vocabularies", TD, 14.51, 5.90), ("extract_vocabularies", CF, 20.77, 8.28), ("extract_vocabularies", SL, 8.26, 7.04),
        ("dcs_decorate", TD, 2.37, 1.52), ("dcs_decorate", CF, 2.48, 1.50), ("dcs_decorate", SL, 1.55, 1.39),
        ("dcs_validate", TD, 1.42, 1.39), ("dcs_validate", CF, 1.83, 1.80), ("dcs_validate", SL, 1.26, 1.27)]
for op, st, b, a in rows:
    add(op, ts, "P5-17", 315, "TS-API", b, a, "laptop", run, s, st)

# ---------- P5-18 (#316) laptop ----------
s = C("55737364b"); ts = "2026-09-29T00:00:16Z"; run = "P5-18/runs1-3"
rows = [("add_model_file", TD, 5.67, 4.14), ("add_model_file", CF, 8.07, 6.39), ("add_model_file", SL, 2.89, 3.17),
        ("add_cto_model", TD, 3.15, 3.03), ("add_cto_model", CF, 5.23, 4.89), ("add_cto_model", SL, 1.48, 1.64),
        ("modelfile_new", TD, 7.11, 7.22), ("modelfile_new", CF, 13.73, 13.14), ("modelfile_new", SL, 11.46, 11.67)]
for op, st, b, a in rows:
    kw = {"note": "follow-up recheck found synthetic-large unchanged (0.91x is noise)"} if (op == "add_model_file" and st == SL) else {}
    add(op, ts, "P5-18", 316, "TS-API", b, a, "laptop", run, s, st, **kw)

# ---------- P5-19 (#317) cloud ----------
s = C("7ef1e0819"); ts = "2026-09-29T06:43:35Z"; run = "P5-19/runs1-3"
rows = [("new_resource", TD, 6.93, 3.00), ("new_resource", CF, 11.09, 3.57), ("new_resource", SL, 3.63, 2.31),
        ("from_json", TD, 1.25, 1.24), ("from_json", CF, 0.87, 0.95), ("from_json", SL, 1.77, 1.77),
        ("to_json", TD, 2.57, 2.41), ("to_json", CF, 3.46, 2.91), ("to_json", SL, 4.51, 4.20)]
for op, st, b, a in rows:
    add(op, ts, "P5-19", 317, "TS-API", b, a, "cloud", run, s, st, note="p515-sweep workload (per model set), not run-ts.mjs instance-500")

# ---------- P5-20 (#318) laptop ----------
s = C("bc0875948"); ts = "2026-09-29T07:10:10Z"; run = "P5-20/runs1-3"
rows = [("parse_namespace", TD, 13.26, 5.44), ("parse_namespace", CF, 6.63, 2.65), ("parse_namespace", SL, 8.01, 2.61),
        ("parse_namespace_read", TD, 12.65, 6.51), ("parse_namespace_read", CF, 6.81, 2.81), ("parse_namespace_read", SL, 8.95, 3.11),
        ("mm_new", "(none)", 2.12, 2.02),
        ("add_model_file", TD, 3.08, 3.12), ("add_model_file", CF, 5.76, 5.31), ("add_model_file", SL, 2.85, 2.84)]
for op, st, b, a in rows:
    add(op, ts, "P5-20", 318, "TS-API", b, a, "laptop", run, s, st)

# ---------- P5-22 (#326) cloud, parsed from compare.md ----------
s = C("d3abd4555", "migration/bench/results/P5-22/compare.md"); ts = "2026-09-29T09:22:29Z"; run = "P5-22/rounds1-3"
for line in show("concerto", "d3abd4555", "migration/bench/results/P5-22/compare.md").splitlines(True):
    if not line.startswith("| ") or line.startswith("| op ") or line.startswith("|---"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    op, st = c[0], c[1]
    cb, ca = [float(x) for x in c[5].split("->")]
    ab, aa = [float(x) for x in c[7].split("->")]
    note = "before = pre-F1 integration head timed in the same run (difference: P5-16..P5-20)"
    add(op, ts, "P5-22", 326, "TS-API", ab, aa, "cloud", run, s, st, note=note)
    add(op, ts, "P5-22", 326, "crate", cb, ca, "cloud", run, s, st, note=note)

# ---------- P5-27 (#332) cloud ----------
s = C("877e4221b"); ts = "2026-09-29T10:44:31Z"; run = "P5-27/rounds1-3"
rows = [("dcs_decorate", TD, 0.90, 0.80), ("dcs_decorate", CF, 1.21, 1.24), ("dcs_decorate", SL, 1.54, 1.45),
        ("extract_decorators", TD, 4.91, 3.33), ("extract_decorators", CF, 7.55, 5.39), ("extract_decorators", SL, 6.14, 3.23),
        ("extract_vocabularies", TD, 5.12, 4.77), ("extract_vocabularies", CF, 8.26, 5.52), ("extract_vocabularies", SL, 7.08, 4.57)]
for op, st, b, a in rows:
    add(op, ts, "P5-27", 332, "TS-API", b, a, "cloud", run, s, st)
for st, b, a in [(TD, 1.34, 1.44), (CF, 1.63, 1.71), (SL, 1.14, 1.16)]:
    add("dcs_validate", ts, "P5-27", 332, "TS-API", b, a, "cloud", run, s, st, superseded=True, note="first run, before the validate change; no change")
s = C("8283f60e7"); ts = "2026-09-29T11:05:43Z"; run = "P5-27/validate-rounds1-3"
for st, b, a in [(TD, 1.07, 0.66), (CF, 1.22, 0.78), (SL, 1.12, 0.80)]:
    add("dcs_validate", ts, "P5-27", 332, "TS-API", b, a, "cloud", run, s, st, note="second run after the dcsValidate change")

# ---------- P5-28 (#333) cloud, parsed from table.md ----------
s = C("e55569e53", "migration/bench/results/P5-28/table.md"); ts = "2026-09-29T10:44:45Z"; run = "P5-28/rounds1-3"
for line in show("concerto", "e55569e53", "migration/bench/results/P5-28/table.md").splitlines(True):
    if not line.startswith("| ") or line.startswith("| op ") or line.startswith("|---"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    b, a = [float(x) for x in c[5].split("->")]
    add(c[0], ts, "P5-28", 333, "TS-API", b, a, "cloud", run, s, c[1], note="not written up in RESULTS.md; results/P5-28/table.md only")

# ---------- P5-29 (#334) cloud ----------
s = C("cff7b0ad2"); ts = "2026-09-29T11:45:17Z"; run = "P5-29/rounds1-3"
rows = [("get_namespaces", TD, 23.31, 0.50), ("get_namespaces", CF, 16.23, 0.30), ("get_namespaces", SL, 10.86, 2.46),
        ("get_type", TD, 8.47, 0.85), ("get_type", CF, 4.50, 1.21), ("get_type", SL, 2.59, 1.14),
        ("resolve_type", TD, 6.44, 0.32), ("resolve_type", CF, 6.02, 0.38), ("resolve_type", SL, 2.42, 0.11),
        ("get_namespaces_first", TD, 13.01, 17.94), ("get_namespaces_first", CF, 11.02, 17.66), ("get_namespaces_first", SL, 6.62, 14.89),
        ("get_type_first", TD, 5.87, 12.25), ("get_type_first", CF, 5.31, 6.42), ("get_type_first", SL, 2.43, 2.63),
        ("resolve_type_first", TD, 7.01, 9.66), ("resolve_type_first", CF, 6.76, 8.63), ("resolve_type_first", SL, 2.40, 3.25)]
for op, st, b, a in rows:
    add(op, ts, "P5-29", 334, "TS-API", b, a, "cloud", run, s, st,
        note=("repeated reads (memo hit)" if not op.endswith("_first") else "first read after a model change (memo miss)"))

# ---------- P5-30 (#335) cloud, measure-only spike ----------
u = "https://github.com/accordproject/concerto-rust/issues/335#issuecomment-5888739779"; ts = "2026-09-29T10:53:07Z"; run = "P5-30/rounds1-3"
add("extract_decorators", ts, "P5-30", 335, "TS-API", None, 6.4, "cloud", run, u, SL, note="stated 6.4x (Rust engine 50.25 ms vs TS 7.81 ms); measure only")
add("extract_decorators", ts, "P5-30", 335, "TS-API", None, round(29.11 / 7.77, 2), "cloud", run, u, TD, derivation="computed: engine 29.11 ms / TS 7.77 ms", note="measure only")
add("extract_decorators", ts, "P5-30", 335, "TS-API", None, round(13.84 / 2.85, 2), "cloud", run, u, CF, derivation="computed: engine 13.84 ms / TS 2.85 ms", note="measure only")
add("extract_decorators", ts, "P5-30", 335, "crate", None, round(30.21 / 7.81, 2), "cloud", run, u, SL,
    derivation="computed: native glibc same-work total 30.21 ms / TS-API TS 5.0.0 7.81 ms (report states native is 3.3-3.9x slower than TS)", note="spike crate (binding body natively), measure only")

# ---------- P5-41 (#351) cloud ----------
s = C("4f3bf3bcf"); ts = "2026-09-29T14:03:10Z"; run = "P5-41/rounds1-3"
for st, b, a, pb, pa in [(SL, 3.55, 3.59, 6.00, 5.86), (CF, 2.65, 2.10, 3.81, 4.43), (TD, 1.87, 1.39, 3.65, 3.56)]:
    add("extract_decorators", ts, "P5-41", 351, "TS-API", b, a, "cloud", run, s, st, variant="resident path (default since P5-27)",
        note="changes within the stated noise band (about 25%); not a measured end-to-end change per the write-up")
    add("extract_decorators", ts, "P5-41", 351, "TS-API", pb, pa, "cloud", run, s, st, variant="per-call bindings (DcsManagerHandle hidden)")

# ---------- P5-42 (#352) cloud, F-A design analysis (measure only) ----------
u = "https://github.com/accordproject/concerto-rust/issues/352#issuecomment-5893635371"; ts = "2026-09-29T15:46:08Z"; run = "P5-42/ts-api-rounds1-3"
for st, tc, tw, rc, rw in [(SL, 9.59, 9.78, 106.07, 43.88), (CF, 3.58, 3.60, 15.18, 8.98), (TD, 8.26, 9.07, 59.93, 32.31)]:
    kw = dict(source_file="concerto-rust@ff8aa3c:spikes/p542-typed-extract/results/ts-api/medians.md",
              note="design analysis, measure only; Rust engine built without wasm-opt (report: about 10% pessimistic); median of 3 round medians")
    add("extract_decorators", ts, "P5-42", 352, "TS-API", None, round(rc / tc, 2), "cloud", run, u, st,
        variant="cold (first call on a freshly loaded manager)", derivation=f"computed: Rust cold {rc} ms / TS 5.0.0 cold {tc} ms", **kw)
    add("extract_decorators", ts, "P5-42", 352, "TS-API", None, round(rw / tw, 2), "cloud", run, u, st,
        variant="warm (repeat call, resident P5-27 path)", derivation=f"computed: Rust warm {rw} ms / TS 5.0.0 warm {tw} ms", **kw)

# ---------- P5-40 (#350) cloud ----------
s = C("245e94cd8"); ts = "2026-09-29T17:35:44Z"; run = "P5-40/rounds1-3"
for st, rb, ra, pb, pa in [(SL, 3.64, 3.64, 5.26, 4.24), (CF, 2.92, 2.61, 4.76, 4.66), (TD, 2.19, 2.22, 3.70, 3.43)]:
    add("extract_decorators", ts, "P5-40", 350, "TS-API", rb, ra, "cloud", run, s, st, variant="resident path (default since P5-27)",
        note="before = concerto-rust a52dad4 timed in the same run; write-up: resident-path changes are within the ~25% noise band")
    add("extract_decorators", ts, "P5-40", 350, "TS-API", pb, pa, "cloud", run, s, st, variant="per-call bindings (DcsManagerHandle hidden)",
        note="before = concerto-rust a52dad4 timed in the same run")

# ---------- P5-48 (#369) cloud, TS-API and crate x TS in one table ----------
s = C("e635f7013"); ts = "2026-09-29T18:28:14Z"; run = "P5-48/rounds1-3"
P548N = "before = concerto-rust a52dad4 timed in the same run; TS-API noise about +-35% (changes under ~25% are noise)"
rows = [("mm_new", CF, 1.01, 0.80, 0.03, 0.00, None), ("modelfile_new", TD, 5.74, 4.93, 1.64, 1.22, None),
        ("modelfile_new", CF, 7.25, 8.10, 1.60, 1.28, "TS-API +12% marked noise in the source"),
        ("modelfile_new", SL, 6.25, 5.42, 2.83, 2.14, None), ("add_model_file", TD, 3.35, 2.86, 1.71, 0.89, None),
        ("add_model_file", CF, 11.00, 7.52, 2.28, 0.81, None), ("add_model_file", SL, 4.49, 3.89, 1.88, 1.09, None),
        ("add_cto_model", TD, 2.72, 2.97, None, None, "TS-API +9% marked noise in the source; no crate row (CTO parse is TS on both engines)"),
        ("add_cto_model", CF, 3.77, 4.02, None, None, "TS-API +7% marked noise in the source; no crate row (CTO parse is TS on both engines)"),
        ("add_cto_model", SL, 1.81, 1.73, None, None, "no crate row (CTO parse is TS on both engines)")]
for op, st, ab, aa, cb, ca, extra in rows:
    add(op, ts, "P5-48", 369, "TS-API", ab, aa, "cloud", run, s, st, note=P548N + ("; " + extra if extra else ""))
    if ca is not None:
        add(op, ts, "P5-48", 369, "crate", cb, ca, "cloud", run, s, st,
            note="crate-direct concerto-core load_profile example (time mode) vs TS 5.0.0 through the TS API; crate rounds mostly within +-10%"
                 + ("; x TS rounded to 2 dp in the source (crate 13.6 -> 1.44 us vs TS 391 us)" if op == "mm_new" else ""))
u = "https://github.com/accordproject/concerto-rust/issues/369#issuecomment-5899176591"
add("mm_new", "2026-09-29T21:21:54Z", "P5-48", 369, "TS-API", None, 1.09, "cloud", "P5-48/merged-head-recheck(6 rounds)", u, CF,
    note="merge-fix re-confirmation on the merged head (concerto-rust 8884b57); source attributes the change from the recorded 0.80x to single-item sampling noise (CV 50-98%), not the merge. The other re-check rows were reported only as within 10% or as time changes, so they are not recorded as ratios")

# ---------- P5-60 (#392) and P5-72 (#413) cloud same-run sweeps, parsed from tables.json ----------
# These carry their own event summaries, so they are kept apart from E until assembly.
SAME_RUN = []
SWEEPS = [
    ("P5-60", 392, "cdcfe6f61", "2026-09-30T19:35:47Z",
     "P5-60/same-run sweep rounds1-3 (pre-F1 head vs now: concerto 2a6a71754 / concerto-rust 299935e; TS 5.0.0 in the same run)",
     "concerto@cdcfe6f61:migration/bench/results/P5-60/report-now.json (before: report-before.json); https://github.com/accordproject/concerto-rust/issues/392#issuecomment-5918360835"),
    ("P5-72", 413, "503ffea23", "2026-10-01T11:03:44Z",
     "P5-72/same-run sweep (pre-F1 vs P5-60 head 2a6a71754/299935e vs now 503ffea23 base; TS 5.0.0 in each round)",
     "concerto@503ffea23:migration/bench/results/P5-72/report-now.json (pre-F1: report-before.json; P5-60 head: report-p560.json); https://github.com/accordproject/concerto-rust/issues/413#issuecomment-5930064181"),
]
r3 = lambda x: None if x is None else round(x, 3)
for task, issue, sha, ts, run, src in SWEEPS:
    tables = json.loads(show("concerto", sha, f"migration/bench/results/{task}/tables.json"))
    three = "p560Rounds" in tables
    by_key = {(r["op"], r["set"]): r for r in tables["rows"]}
    # report-now.json (the cited source) fixes the row order; tables.json holds the ratios.
    order = json.loads(show("concerto", sha, f"migration/bench/results/{task}/report-now.json"))["rows"]
    for row in [by_key[(r["op"], r["set"])] for r in order]:
        for level, now, before, mid in (("TS-API", "apiVsTs", "beforeApiVsTs", "p560ApiVsTs"), ("crate", "crateVsTs", "beforeCrateVsTs", "p560CrateVsTs")):
            if row.get(now) is None:
                continue
            e = {"ts": ts, "task": task, "issue": issue, "level": level, "ratio_before": r3(row.get(before))}
            if three:
                e["ratio_p560_head"] = r3(row.get(mid))
            e.update({"ratio_after": r3(row[now]), "machine": "cloud", "run": run, "source": src, "set": row["set"],
                      "category": None, "same_run": True})
            where = f"{row['op']} ({row['set']}, {level})"
            if three:
                summ = f"{task} same-run sweep: {where} pre-F1 {e['ratio_before']}\u00d7, P5-60 head {e['ratio_p560_head']}\u00d7, now {e['ratio_after']}\u00d7 TS."
            else:
                summ = f"{task} same-run sweep: {where} {e['ratio_before']}\u00d7 \u2192 {e['ratio_after']}\u00d7 TS."
            metrics = {"op": row["op"], "level": level, "ratio_before": e["ratio_before"]}
            if three:
                metrics["ratio_p560_head"] = e["ratio_p560_head"]
            metrics.update({"ratio_after": e["ratio_after"], "machine": "cloud", "run": run, "category": None})
            SAME_RUN.append((row["op"], e, summ, metrics))

# ---------- P5-73 (#414) cloud, absolute times only (GitHub comment) ----------
u = "https://github.com/accordproject/concerto-rust/issues/414#issuecomment-5931464385"
SAME_RUN.append(("mm_new", {"ts": "2026-10-01T12:42:31Z", "task": "P5-73", "issue": 414, "level": "TS-API", "ratio_before": None, "ratio_after": None,
                            "abs_before_us": 314, "abs_after_us": 193, "machine": "cloud",
                            "run": "P5-73/targeted same-run bench (mm_new plus two controls, 3 rounds, quiet gate)", "source": u,
                            "set": "system-models", "category": "model loading",
                            "derivation": "absolute times only; x TS for mm_new is not comparable across runs because TS 5.0.0 mm_new time varies with the sample count (110 us at 300 samples, 366 us at 30, 449 us in P5-72)",
                            "same_run": True},
                 "P5-73: new ModelManager() 314 \u00b5s \u2192 193 \u00b5s (\u221238%) in a same-run targeted benchmark; controls flat; \u00d7 TS not comparable across runs for this op.",
                 {"op": "mm_new", "level": "TS-API", "abs_before_us": 314, "abs_after_us": 193, "machine": "cloud", "run": "P5-73"}))

# Category geometric means as published in the P5-60 and P5-72 report comments.
P5_60_SUMMARY = {"source": "https://github.com/accordproject/concerto-rust/issues/392#issuecomment-5918360835", "machine": "cloud", "run": "P5-60 same-run sweep",
                 "geomean_ts_api": {"model loading": [4.99, 8.31], "introspection": [4.39, 1.79], "serialisation": [3.45, 2.01], "instance creation": [10.5, 1.79], "validation": [4.14, 2.95]},
                 "geomean_crate_now": {"model loading": 0.31, "introspection": 0.3, "serialisation": 0.56, "instance creation": 0.39, "validation": 0.81},
                 "rows_at_or_below_ts": {"ts_api": [5, 19, 73], "crate": [35, 46, 57]}, "note": "introspection includes DCS; pairs are [pre-F1, now]"}
P5_72_SUMMARY = {"source": "https://github.com/accordproject/concerto-rust/issues/413#issuecomment-5930064181", "machine": "cloud", "run": "P5-72 same-run sweep",
                 "geomean_ts_api": {"model loading": [4.48, 7.32, 3.68], "introspection": [4.56, 1.87, 1.48], "serialisation": [3.1, 2.04, 1.84], "instance creation": [7.06, 1.72, 1.68], "validation": [2.55, 2.1, 2.05]},
                 "geomean_crate_now": {"model loading": 0.33, "introspection": 0.31, "serialisation": 0.53, "instance creation": 0.35, "validation": 0.57},
                 "rows_at_or_below_ts": {"ts_api": [5, 17, 19, 73], "crate_now": [45, 57]}, "note": "triples are [pre-F1, P5-60 head, now], all measured in the P5-72 run"}

# ---------- assemble ----------
CATEGORIES = {
    "model loading": ["load", "add_model_file", "add_cto_model", "mm_new", "modelfile_new", "parse_namespace", "parse_namespace_read", "from_ast"],
    "introspection": ["get_namespaces", "get_type", "resolve_type", "get_properties", "get_property", "derives_from", "is_assignable_to",
                      "get_namespaces_first", "get_type_first", "resolve_type_first", "get_identifier_field_name",
                      "dcs_decorate", "extract_decorators", "extract_vocabularies", "dcs_validate", "get_decorators", "extract_cold", "extract_keep"],
    "serialisation": ["from_json", "to_json"],
    "instance creation": ["new_resource", "set_property_value", "add_array_value"],
    "validation": ["validate", "validate_ast", "validate_models", "load_validate"],
}
OP2CAT = {o: c for c, l in CATEGORIES.items() for o in l}
for op, e in E:
    e["category"] = OP2CAT.get(op, "other")
for op, e, _, metrics in SAME_RUN:
    e["category"] = OP2CAT.get(op, "other")
    if "category" in metrics:
        metrics["category"] = e["category"]
present = {op for op, _ in E} | {op for op, _, _, _ in SAME_RUN}
categories = {c: [o for o in l if o in present] for c, l in CATEGORIES.items()}
categories["other"] = sorted(o for o in present if o not in OP2CAT)
ops = {}
for op, e in E:
    ops.setdefault(op, []).append(e)
for op in ops:
    ops[op].sort(key=lambda e: (e["ts"], e["level"], e.get("set", "")))
# same-run sweeps follow in source order (they are the latest runs)
for op, e, _, _ in SAME_RUN:
    ops.setdefault(op, []).append(e)

notes = [
    "x TS = Rust time / TS concerto-core 5.0.0 time (>1 slower than TS, <1 faster). ratio_before/ratio_after as stated in the source unless a 'derivation' field says 'computed'.",
    "Ratios are only comparable within one run (same 'run' id and machine). 'laptop' = Intel i7-7820HQ macOS developer laptop (worker local-matt); 'cloud' = Intel Xeon Linux cloud container (2.10GHz; P5-04a used a 2.80GHz Xeon).",
    "level 'TS-API' = Rust engine (WASM) measured through the concerto-core TS public API against TS 5.0.0 (or, before P5-02, the in-tree TS engine). level 'crate' = native Rust crate (criterion or native harness) against TS; entries with a 'route' field of in-WASM are the in-WASM validator without the TS boundary (P5-13).",
    "'set' = model set: concerto-core-test-data (35 files), conformance (41 files), synthetic-large (1 file, 300 decls), instance-500 (run-ts.mjs synthetic Item workload, 500 instances), system-models (new ModelManager), Item (single declaration).",
    "Op names: validate = Resource.validate() instance validation; from_json = Serializer.fromJSON; to_json = Serializer.toJSON; new_resource = Factory.newResource; load = run-ts.mjs model-set load; load_validate = run-ts.mjs 'validate' metric (fresh load + validateModelFiles); validate_models = native validate_models only; add_model_file / add_cto_model / modelfile_new / mm_new = p515-sweep load family; dcs_decorate = DecoratorManager.decorateModels; extract_decorators / extract_vocabularies = DecoratorManager.extract*; dcs_validate = DecoratorManager.validate; *_first = first read after a model change (P5-29).",
    "run-ts.mjs workloads (load, load_validate, validate_ast, instance-500 from_json/validate/to_json) and p515-sweep workloads (per model set) are different harnesses; do not compare values across them even for the same op name.",
    "'superseded': true marks numbers later replaced in the same task (P5-13 first run, P5-16 first round, P6-04 contended native round, P5-27 first dcs_validate run). 'merged': false marks spikes whose code was not merged (P5-06a, P5-06b, P5-06c, P5-12, P5-12b, P5-12d). P5-30 and P5-42 are measure-only analyses (no product code change).",
    "ts = commit time (UTC) of the concerto commit that published the numbers, or the GitHub comment time for comment-only results. P5-15 and P5-28 numbers come from results/ tables (P5-15 on an unmerged measure-only branch commit f6f6b10d7).",
    "synthetic-large validateAst is rejected by both engines in every run, so it has no ratio.",
    "category: grouping of operations used by the HTML page (model loading, introspection, serialisation, instance creation, validation, other; decorator/DCS operations are in introspection). The top-level 'categories' map lists the op keys present in each.",
    "P5-40 and P5-41 extract_decorators have two variants each: the resident path (TS API default since P5-27) and the per-call bindings. P5-42 extract_decorators variants are cold (first call on a fresh manager) and warm (repeat call), with ratios computed from the report's ms medians; its engine was built without wasm-opt.",
    "P5-48 publishes TS-API and crate x TS for the same rows in one table (cloud, same run); both levels are recorded. Its merged-head re-check (6 rounds) stated only one new ratio (TS-API mm_new 1.09x, attributed to sampling noise). Crossings-only tasks (P5-32, P5-34, P5-37) report no timings and are not in this file.",
]
notes += [
    "P5-60 (#392): single same-run cloud sweep, pre-F1 head vs now, TS 5.0.0 in the same run; entries carry same_run=true; p5_60_summary holds the category geometric means as published.",
    "P5-72 (#413): three-sided same-run cloud sweep (pre-F1, P5-60 head, now); entries carry ratio_p560_head and same_run=true; p5_72_summary holds the published category geomeans.",
    "P5-73 (#414): absolute mm_new times only (314 -> 193 us, -38%); no x TS recorded because the TS 5.0.0 reference varies with sample count.",
]
dump({"notes": notes, "categories": categories, "operations": ops, "p5_60_summary": P5_60_SUMMARY, "p5_72_summary": P5_72_SUMMARY},
     os.path.join(OUT, "perf.json"), ensure_ascii=False)

LEVELNAME = {"TS-API": "through the TS API", "crate": "native crate"}
ev = []
for op, e in E:
    rb, ra = e["ratio_before"], e["ratio_after"]
    where = f"{op} on {e.get('set', '-')}"
    if e.get("variant"):
        where += f" ({e['variant']})"
    if rb is not None:
        summ = f"{e['task']} measured {where} {LEVELNAME[e['level']]} at {ra}x TS 5.0.0, from {rb}x before, on the {e['machine']} machine."
    else:
        summ = f"{e['task']} measured {where} {LEVELNAME[e['level']]} at {ra}x TS 5.0.0 on the {e['machine']} machine."
    ev.append({"ts": e["ts"], "type": "perf", "task": {"id": e["task"], "issue": e["issue"]},
               "worker": WORKER.get(e["issue"]), "summary": summ, "source": e["source"],
               "metrics": {"op": op, "set": e.get("set"), "level": e["level"], "ratio_before": rb, "ratio_after": ra,
                           "machine": e["machine"], "run": e["run"], "category": e["category"],
                           **({"variant": e["variant"]} if e.get("variant") else {}),
                           **({"superseded": True} if e.get("superseded") else {}),
                           **({"merged": False} if e.get("merged") is False else {})}})
ev.sort(key=lambda x: (x["ts"], x["task"]["id"], x["metrics"]["op"]))
for op, e, summ, metrics in SAME_RUN:
    ev.append({"ts": e["ts"], "type": "perf", "task": {"id": e["task"], "issue": e["issue"]}, "worker": WORKER.get(e["issue"]),
               "summary": summ, "source": e["source"], "metrics": metrics})
dump(ev, os.path.join(RAW, "perf_events.json"), ensure_ascii=False)
print(len(E) + len(SAME_RUN), "entries;", len(ops), "ops")
