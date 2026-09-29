# P5-07: Plan for compatibility-breaking improvements and fixes

Task P5-07, accordproject/concerto-rust#236, under the migration plan
accordproject/concerto-rust#29. **This is a read-only planning document. It
changes no code, files no issues, and decides nothing.** Every decision in it
is a proposal for the maintainer.

It lists every improvement or fix the migration has deliberately **not**
made because it would break compatibility with TS concerto-core 5.0.0, and
proposes how to deliver them after the migration. It is built from the
existing records only. Code was opened only to confirm that a recorded claim
is still current. Those checks are listed in section 7.

Heads read: concerto `98eed8099` and concerto-rust `78566e7`
(`claude/tender-pascal-ocwf9q`), plus the GitHub issues named in each row, as
of 2026-09-26.

**Update, P5-10c (accordproject/concerto-rust#271, 2026-09-27).** The
maintainer decided on 2026-09-27 to implement lazy views now, before the
migration release. P5-10a (#269) and P5-10b (#270) shipped them, so
**BC-23, BC-24 and BC-25 move to R1**, the engine-switch release (1.4,
section 3). A later maintainer decision on #270 (comment 5859088256,
option (b)) keeps decorator factories on the eager path, so R1 ships BC-24's
non-breaking part only. The factory-timing change is not in R1 and stays a
proposal for a later major. The mutation and identity semantics that changed
are recorded in 1.4 (BC-23), with changelog wording in section 4. Heads
checked for this update: concerto `d2be3f7be` and concerto-rust `e7c0163`.

**Update, P5-24 (accordproject/concerto-rust#328, 2026-09-29).** The
maintainer decided on P5-23 (#327) to make `DateTime` strict in **R1**, with
no R2 deprecation step, and to parse it with the `chrono` crate. **BC-07 (b)
and (c) move to R1**: only strict ISO 8601 / RFC 3339 `DateTime` values are
accepted, on every path, and `strictQualifiedDateTimes: false` is ignored
with a warning. Section 1.7 adds the rows from P5-23, with the IDs and
releases the coordinator assigned on #328: BC-41 (strict namespace SemVer,
R1 by maintainer decision 2026-09-29, implemented by P5-38, not P5-24),
BC-42 (impossible dates, R1), BC-43 (map `DateTime` values, R1), BC-44 (the
optional `utcOffset` change, R2/R3), BC-45 (`DateTime` default values
checked when they are applied, R1) and BR-12/BR-13
(native `DateTime` and `semver::Version` types, RB). These are intended
breaking changes, not parity failures: each changes a throw scenario on
purpose, with the class strict mode already used. The oracle records the
affected fixtures as baselined failures (`baseline.tsv`). Heads:
concerto `80bddbfc7` and concerto-rust `c0bb3a9`.

**Update, one major release (maintainer decisions 2026-09-29, confirmed to the coordinator directly).**
- **Q2 is answered: one major.** R3 is folded into R1. There is no separate "strict models" major; R2 stays for additive minors after R1.
- **Scheduled for R1** (tasks in accordproject/concerto-rust):
  - BC-02, Q5 answered (enforce versioning): P5-50 #371;
  - BC-10: P5-51 #372;
  - BC-19 with BC-17, BC-18 and BC-20 folded in, on by default with an opt-out (Q10's option name is proposed in the PR): P5-49 #370;
  - BC-28: P5-52 #373;
  - BC-39, a bug fix in the maintainer's view, with BC-40: P5-53 #374.
- **BC-34 is changelog-only:** v5 already restricts the public API to the package exports, so deep imports of visitor internals were never supported.
- **BC-46 and BC-48** shipped in R1 (P5-34 #344), and **BC-47** in R1 (P5-35 #345). BC-50 (P5-36 #346) is in progress.
- **BC-25:** the lazy-views gap noted in R1 below was closed by P5-10d (accordproject/concerto-rust#285).
- **Still to decide for the single major:** BC-04 (Q6), BC-05 (maintainer question pending), BC-21 (Q9), the BC-24 factory-timing part, BC-27, BC-33, the BC-35 removal form, and BC-44 and BC-49. The last two were planned as an R2 deprecation followed by an R3 removal, so with one major they are either removed in R1 or not removed at all.

## 0. How to read this

**IDs.** `BC-nn` rows affect JS users of concerto-core, and possibly Rust
users as well. `BR-nn` rows affect only Rust users of the crate, and feed
P6-01 (#83). Every row cites its source record.

**Categories:**
- bug fix;
- error-class or message fix;
- validation strictness;
- API or type change;
- performance-enabling change;
- removal;
- packaging (this category is added here, for runtime and bundle floors).

**Proposed semver policy.** This is itself open question Q1.
- **patch:** restores TS 5.0.0 behaviour, or changes something no caller can observe.
- **minor:** replaces a JS-engine crash (`TypeError`, `RangeError`, a V8 message) with a documented concerto exception; changes only message text; accepts an input that used to crash; or adds API.
- **major:** rejects an input that used to be accepted; changes an exception between two concerto classes; changes a public TS type or signature; removes something; raises the Node or browser floor; or changes object identity or error timing.

**Size.** One agent task, reviewed:
- **S:** one site or one class, under a day;
- **M:** several sites or both repos, with fixtures;
- **L:** a design task plus several chunks.

**The main point for sequencing.** Once P5-02 (#73) has deleted the TS logic,
concerto-core's behaviour lives in one place, the Rust crate. After that, every
TS-bug fix below is a Rust-only change, plus a DIVERGENCES.md row update and
new fixtures. Fixing them *before* P5-02 would mean changing both the TS
reference and the port. So nothing here should start before P5-02 merges,
except items that P5-02 itself forces (BC-31, BC-32).

**A second point.** Some divergences are already Rust behaviour today, and
P5-02 will make them the only behaviour: DV-004, DV-009, DV-015, DV-017 and
DV-018. So the release that removes the engine flag is itself
compatibility-breaking for those inputs, and it needs changelog entries even
if nothing else in this plan ships with it (section 3, R1).

---

## 1. Catalogue

### 1.1 DIVERGENCES.md rows (concerto-rust `DIVERGENCES.md`, DV-001 to DV-018)

Every row in the file is covered below.

| ID | Source | Current behaviour (TS 5.0.0 / Rust) | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BR-01** | DV-001 (`engine`), #87 | TS has no serde step. Rust names the first malformed field in node key order (`preserve_order`). | No change. Document it in the crate's error docs. If BC-21 lands, the typed path decides which field is reported. | none (documentation) | Rust | 7 of 1,736 runs in the P1-02 review | none | none | none | – |
| **BC-01** | DV-002 (`ts-bug`), #185 | `ModelUtil.isValidIdentifier(undefined)` and `(null)` return `true`, because of `String()` coercion. | Return `false` for a non-string. | bug fix | both (JS `ModelUtil`; Rust `is_valid_identifier` through the binding) | 2 fixtures (`unit/ModelUtil.isValidIdentifier` with an `undefined`/`null` argument) | low: only a caller passing a nullish value sees a change | correctness | minor | S |
| **BC-02** | DV-003 (`d6`), PORTING.md 3.6 | `ModelUtil.parseNamespace('org.acme')` accepts an unversioned namespace and returns `version: null`. Concerto v4 makes versions mandatory. | Reject an unversioned namespace in `parseNamespace`, as the v4 spec requires. Alternatively, keep it and close DV-003 as intended (Q5). | validation strictness | both | `ModelUtil #parseNamespace` tests; PORTING.md 3.6 | high: any caller or tool that parses unversioned namespaces; this interacts with `strict: false` model managers | spec alignment | major | S (plus callers M) |
| **BC-03** | DV-004 (`engine`) | JS strings may contain a lone surrogate. The WASM boundary passes UTF-8, so Rust sees U+FFFD. No fixture observes this. **After P5-02 it is JS-visible.** | **Maintainer decision (2026-09-27): accept.** Document it in the R1 changelog; no fix. (The rejected alternative was to pass such strings as UTF-16 (`JsString`) at the boundary, which costs speed on every string crossing.) DV-004 is `maintainer-accepted`. | none, or patch | JS | no fixture; unobserved | low | none | changelog (R1) | S if fixed |
| **BR-02** | DV-005 (`engine`), #90 | Rust `mm::*` Integer/Long AST fields are `f64` (OD-3). Re-serialising a typed value prints `5.0` and `1e19`. | Give the numeric `mm::*` fields a JS-number serializer (ECMAScript `Number::toString`, as PORTING.md 3.1 already requires for messages), so the typed round trip prints like `JSON.stringify`. | API or type change | Rust | `concerto-metamodel/tests/numeric_widening.rs` | low | a faithful typed round trip for P6 users | Rust minor (pre-1.0) | S |
| **BC-04** | DV-006 (`ts-bug`), #186 | `checkMapType` unwraps the **value** slot using the **key's** scalar-ness. | Unwrap the value slot by the value type's own scalar-ness. | bug fix / validation | both | **0 fixtures** (ported by reading the TS source) | medium, and the direction is unknown: instances may flip either way | correctness | major until a fixture shows the direction is reject→accept only (Q6) | S, plus new fixtures M |
| **BC-05** | DV-007 (`ts-bug`), #187 | A `RelationshipMapValueType` value must be an embedded `Resource`. A relationship URI string is rejected. | The value is a relationship reference, as for `RelationshipProperty`, in the validator, populator and generator. | bug fix / validation | both | `instance::validate::tests::a_map_with_a_relationship_typed_value_accepts_a_nested_resource` | **high:** stored data that holds embedded objects in such maps stops validating | spec alignment | major | M |
| **BC-06** | DV-008 (`ts-bug`), #127 | `ResourceValidator` throws `TypeError` (`obj.getFullyQualifiedType is not a function`, or `…reading 'toString'`) for a non-Identifiable value or a `null` element. | Throw a `ValidationException` naming the field and the value's JS type. | error class | both | 1 fixture (`gaps/Resource.validate/d444ebcf0cf5a3c23e5ee6dd`) and 2 unit tests | low | clearer errors; callers can catch one class | minor | S |
| **BC-07** | DV-009 (`maintainer-accepted`), #169 (closed); P5-23 (#327), P5-24 (#328) | TS's non-strict `DateTime` parsing (the `Serializer` default, `strictQualifiedDateTimes !== true`) goes through dayjs's `parseDate` and falls back to V8's `Date.parse` and legacy date parser (`2022-11-28`, `2022-11-28T01:02:03`, `Nov 28 2022`, `"1"`, `"-0"`, `--11-28`, a lower-case `t`/`z`, a space separator). | **Maintainer decisions (2026-09-27 and, moving (b) and (c) to R1, 2026-09-29 on #327): the Rust engine does not support non-strict `DateTime` values.** **Shipped in R1 by P5-24:** only strict ISO 8601 / RFC 3339 `DateTime` strings are accepted (`YYYY-MM-DDTHH:mm:ss`, an optional fraction, then `Z` or `±HH:mm`: the `strictQualifiedDateTimes` regex), in fields through `Serializer.fromJSON` and `JSONPopulator`, whatever the option says. `strictQualifiedDateTimes: false` is ignored with a warning (`concerto-strict-datetime`), not rejected; `true` still only stops `utcOffset` being applied. A rejected string throws the same `ValidationException` strict mode threw. The dayjs/V8 parser emulation in Rust (`parse_date_utc`, `date_parse`, `legacy_numeric_date`) is deleted: chrono parses behind the regex (BC-42). Q7 is answered. | validation strictness | JS and Rust | P5-24: 28 `Serializer.fromJSON` oracle fixtures (the `unit` "legacy datetime formats" set and the fuzz T1d `"-0"` cases) are recorded as intended failures; 27 concerto-core unit tests assert the lenient forms (3 `strictQualifiedDateTimes: false` cases in test/serializer/jsonpopulator.js, 24 "legacy datetime formats" cases in test/serializer.js): by maintainer decision 2026-09-29 on #328 (option 1) they are changed to assert the rejection and its `ValidationException` class, each listed in the P5-24 PR and the P5-09 guardrails allow-list | medium: lenient date inputs from users | predictable, engine-independent dates | major (R1) | S (done) |
| **BC-08** | DV-010 (`ts-bug`), #136 | `'Unrecognised ' + JSON.stringify(thing)` hits a circular structure, so V8 throws `TypeError: Converting circular structure to JSON`. | Throw an `Error` naming the unrecognised element. | error class | both | 4 fixtures (`gaps/Serializer.fromJSON/85289b13…`, `f15994fd…`; `gaps/Serializer.toJSON/8dddc00b…`, `979f8755…`) | low | clearer errors | minor | S |
| **BC-09** | DV-011 (`ts-bug`), #137 | `processMapType` passes the identifying field's **name** as the `$identifier` of an identified concept map value. | Use the value's own identifier. | bug fix (output) | both | `Serializer.fromJSON` map fixtures with identified concept values (count not recorded on the row) | low to medium: callers reading `$identifier` on map values | correctness | minor, unless `$identifier` is shown to be serialised (Q8) | S |
| **BC-10** | DV-012 (`ts-bug`), #138 | The populator's Integer/Long check (`Math.trunc(n) !== n`) passes `±Infinity`. `ResourceValidator` rejects them later, but only when the instance is validated. | Reject non-finite values in the populator. | validation strictness | both | none (named in PORTING.md 7.3) | low: observable only with validation off, or through which message is reported | correctness | major (narrow: accept→reject when `validate: false`) | S |
| **BC-11** | DV-013 (`ts-bug`), #184; #147 (stale, see 5.3) | Cyclic inheritance makes V8 overflow the stack (`RangeError: Maximum call stack size exceeded`). TS's `isAssignableTo` returns `true`, or loops until out of memory, and `getAllSuperTypeDeclarations` loops until out of memory. Rust returns `JsRangeError` for all of them. | `IllegalModelException` naming the circular inheritance, from every entry point. | error class / bug fix | both | 4 fixtures (`conformance/ModelManager.validateModelFiles/b25d9dd5…`, `343223828…`, `ce4c72b9…`; `ModelManager.addCTOModel/d85b2807…`); 2 Rust tests | low: only invalid models | removes a hang and out-of-memory path in TS; clear diagnostic | minor | S |
| **BC-12** | DV-014 (`ts-bug`), #172 | `MapValueType.validate` on an undeclared value type throws `TypeError: Cannot read properties of null (reading 'isMapDeclaration')`. | `IllegalModelException` naming the undeclared type. | error class | both | 1 fixture (`conformance/ModelManager.addCTOModel/86d8728f…`) | low | clearer errors | minor | S |
| **BC-13** | DV-015 (`maintainer-accepted`), #156; #160 (superseded, see 5.3) | TS: a non-string `$class` gives `TypeError: fqn.lastIndexOf is not a function`, or, for an array, `TypeNotFoundException`. Rust: `Error: a $class that is not a string: …`. **This already diverges in rust mode and becomes universal at P5-02.** | Keep Rust's behaviour. Put it in the R1 changelog. Because the array shape changes `TypeNotFoundException` to `Error`, a caller catching `TypeNotFoundException` for an array `$class` is affected. | error class | JS | stage-2 fuzz: 46,844 expected cases (28,683 `TypeError` and 18,161 array `TypeNotFoundException`); stage 1: 2,753 cases | low | clearer errors | changelog (R1); major in the strict policy because of the array shape (Q1) | none (already built) |
| **BC-14** | DV-016 (`ts-bug`), #179 | Under `decoratorValidation`, `Decorator.validate` wraps its own error again: `File 'x':` appears twice and an `IllegalModelException:` fragment is embedded in the message. | One file suffix, and no embedded fragment. | message fix | both | 12 `ModelManager.validateModelFiles` fixtures, e.g. `63b2562dda3a5fb8e15036e1`; gap-audit F6 | low: only callers matching the exact message text | readable errors | minor | S |
| **BC-15** | DV-017 (`maintainer-accepted`), #218, #224, #228 | TS: a `RelationshipProperty` with a missing or `null` `type` gives `TypeError … (reading 'name')`. Rust: `IllegalModelException: Relationship <name> must have a type`. **Universal at P5-02.** | Keep. Put it in the R1 changelog. | error class | JS | 187 stage-2 cases (T2b clusters #2–#5) | low | clearer errors | changelog (R1, minor) | none |
| **BC-16** | DV-018 (`maintainer-accepted`), #218, #228 | TS: a `null` element in a `decorators` array gives `TypeError … of null (reading 'name')` at decorator.ts:139. Rust: `IllegalModelException: Invalid decorator. Expected object. Found null`. **Universal at P5-02.** | Keep. Put it in the R1 changelog. | error class | JS | T2b cluster #3: 5 of the 10 cases in shard 1; reproducers on #228 | low | clearer errors | changelog (R1, minor) | none |

### 1.2 `mig:post-migration` issues

Every labelled issue is covered by the row for its DIVERGENCES entry. The
label lists exactly 10 issues on 2026-09-26, with no newer ones.

| Issue | DV | Row |
|---|---|---|
| #127 | DV-008 | BC-06 |
| #136 | DV-010 | BC-08 |
| #137 | DV-011 | BC-09 |
| #138 | DV-012 | BC-10 |
| #172 | DV-014 | BC-12 |
| #179 | DV-016 | BC-14 |
| #184 | DV-013 | BC-11 |
| #185 | DV-002 | BC-01 |
| #186 | DV-006 | BC-04 |
| #187 | DV-007 | BC-05 |

DV rows with no `mig:post-migration` issue, and why:
- DV-001, DV-004, DV-005 and DV-009 are `engine`, which needs no follow-up under PORTING.md 7.3.
- DV-003 is `d6`, which is matched to TS by D6.
- DV-004 (BC-03, maintainer decision 2026-09-27), DV-015, DV-017 and DV-018 are `maintainer-accepted`, so Rust's behaviour is already the decision.

Q4 proposes follow-up issues for BC-02, BC-07 and the R1 changelog.

### 1.3 Differential fuzzing (P5-05, #76, `migration/fuzz/TRIAGE.md`, `results/stage2/`, #217, #218, #219)

| ID | Source | Current behaviour | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-17** | #218 cluster #1, #222 (merged `b692be2`); `decorator.rs` `parse_decorators` doc comment | TS never checks that `ast.decorators` is an array. A string is iterated one UTF-16 code unit at a time into nameless decorators, so two or more units give `Duplicate decorator undefined`, and one unit is silently accepted. A number, boolean or `""` yields no decorators and is silently accepted. **Rust ports this faithfully, with no DIVERGENCES row** (5.2). | `IllegalModelException` for a non-array `decorators`, worded like DV-018 (`Invalid decorators. Expected array. Found …`). | validation strictness | both | 97 stage-2 cases (`models[1].decorators = "💥emoji"`) | low: only malformed ASTs | clearer errors; removes an odd TS quirk | major (it rejects a one-character string or a number, which are accepted today) | S |
| **BC-18** | stage-2 `divergence-summary.json` `by_class_pair`; #218 analysis; #217 review (`type.startsWith is not a function`) | TS walks a malformed AST without guards, and many malformed nodes give V8 `TypeError`s (`Cannot read properties of …`, `… is not a function`) rather than a concerto exception. The port reproduces them: PORTING.md 2.2 and the shared `engine-typeerror-*` templates. | Generalise DV-017/DV-018: every AST-walk site raises `IllegalModelException` for a node of the wrong shape. Best delivered through BC-19. | error class | both | **At least 1,862 stage-2 cases where TS threw a `TypeError`** on a mutated AST *and* the engines disagreed (`fromAst` 1,205 + 346 + 32 + 5; `addModelFile` 155 + 66 + 53). This is a lower bound: agreeing `TypeError` cases are not counted. | low | one error class for bad models | minor per site | M–L, or folded into BC-19 |
| **BC-19** | #217 (T2a), TRIAGE.md stage-2 re-run T2a; concerto-rust #230 | TS's untyped walk **loads** many structurally invalid ASTs: wrong-typed validator bounds, `identified` of the wrong shape, numeric or boolean names, and so on. To stay faithful, Rust was loosened to match (#217, #230: lenient validator decode, raw `JsValue` threading). | Validate the AST shape against the metamodel when a model is loaded (`fromAst`, `addModelFile`, `addModel`), which is `validateAst`'s strict check. Keep an opt-out flag for one major (section 4). After this, Rust can use the typed decode alone (BR-09). | validation strictness | both | **17,229 stage-2 cases in 69 clusters** where TS accepted a mutated AST and Rust rejected it before #217 | **medium to high:** hand-built or tool-built ASTs that load today | a whole class of fuzz cases gone; simpler and faster Rust (the typed path without the `Value` fallback, P5-06c/#234) | major | L |
| **BC-20** | #219 (T2c) cluster 1; #218 cluster #6; #217 review | Non-string names and super-type names are coerced as JS does: a numeric name `1e308` is reported as `'1e+308'`; `superType.name` of `""`, `0` or `false` gives `Could not find super type 0`; `superType: {}` gives `… undefined`. `_resolveSuperType` tests truthiness, but `getProperties`/`getProperty` test `!== null`. | Reject a non-string or empty name or super-type name with an explicit `IllegalModelException`. Subsumed by BC-19. | validation strictness / message fix | both | T2c cluster 1: 1,893 cases; #218 cluster #6: 3 cases; #217 review repros | low | consistent errors | major (subsumed by BC-19) | S within BC-19 |
| **BC-21** | #218 final comment (follow-up 2, not filed) | A non-object decorator on a property (e.g. `decorators: [7]`) is accepted by TS as a nameless decorator, and **rejected by Rust's serde on both paths**. This is a port gap, not an intended divergence. | Either port TS's acceptance (a faithful fix, not breaking), or, preferably, reject every non-object decorator as DV-018 does for `null`, which extends DV-018 (Q9). | validation strictness | both | #218 comment 5848545823; not a stage-2 cluster | low | consistent decorator validation | faithful fix: patch; extending DV-018: major-narrow | S |
| **BC-22** | #219 (open) | 205+ clusters (about 3,632 cases) still differ in class or message only. Most are being fixed to match TS; some may yet become `ts-bug` DV rows (map wording, the `'in'`-operator `TypeError`, the `BaseException`/`Error` validator class). | Refresh this plan when #219 closes. Any new `ts-bug` DV row joins section 1.1 and batch R2 or R3. | – | – | #219 comments 5848474246 and 5850411209 | – | – | – | – |

T1c, the embedded-NUL `DateTime` (#169), is fixed and so excluded. T3,
`Resource.validate`, had 0 divergences in 263,807 cases.

### 1.4 Performance records (P5-04 #75, P5-06 #220, P5-06a #226, P5-06b #227, P5-06c #234, `migration/bench/RESULTS.md`)

The maintainer accepted the current performance on 2026-09-26 (#226, #227).
P5-06d (#239), typed deserialisation behind a fallback, is **non-breaking** and
not listed. The rows below are the performance gains that need an API or
behaviour change. The ratios are Rust engine / TS through the public API,
after P5-06: load 13–40×, load+validate 17–21×, validateAst 1.7–2.5×,
`fromJSON` 5.7×, `resource.validate()` 6.8×. After lazy views (P5-10c,
2026-09-27): load 4.1–12.4×, load+validate 3.2–8.0×, validateAst 1.8–2.7×,
`fromJSON` 5.8×, `resource.validate()` 9.7×.

| ID | Source | Current behaviour | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-23** | #67 hybrid decision (comment 5844197262); #220 structural finding; #226 design note; **shipped in R1 by P5-10a (#269) and P5-10b (#270)** | Before P5-10a, the engine built the **TS view graph eagerly** (hybrid construction), and the AST crossed into WASM two or three times. **Now (R1):** a `ModelFile` is staged in Rust once at construction, and its declaration and property views are built on first use, from one batched snapshot per file. Decorators, validators and map key and value types are built on first read. There is no user-facing option; lazy is the only path. Public classes, the `.d.ts` and the api-snapshot are unchanged (BC-37 baseline). | **Ships in R1, as built, subject to BC-25 (see its row: P5-10c found one error-timing gap).** Probes against the TS 5.0.0 reference and the pre-lazy head (concerto `796669d5c`) show that object identity is unchanged. `getType`, `getLocalType`, `getAllDeclarations`, `getProperties`, `getDecorators` and `getValidator` return the same object on every call, as before. What changed: **(a)** A `ModelFile`'s AST is read twice: at construction, when Rust stages and validates it, and again when its views are first built, which can be after the file is added. A caller that mutates the AST in between gets views (declarations, properties, decorator arguments, validators) built from the mutated AST; TS 5.0.0 and the pre-lazy engine built them at construction. The Rust side keeps the construction-time AST, so the two can disagree: for example, renaming a declaration in the AST after `addModelFile` and before the first read makes `getType` of the old name throw `TypeNotFoundException`, where TS 5.0.0 returns the declaration. **(b)** Object shape: until first read, `ModelFile.declarations` and `localTypes` are own enumerable accessors, not data properties. `decorators` (every decorated element), `validator` (Field, ScalarDeclaration), `sizeValidator` (Property) and `key`/`value` (MapDeclaration) are prototype accessors, so `Object.keys`, `hasOwnProperty`, `Object.assign` and spread copies do not see them until they have been read once. The first read turns each into a plain own field. | performance-enabling / API | JS | P5-10c (`migration/bench/RESULTS.md`): load 2.2–2.9× and load+validate 1.7–3.0× faster than the pre-lazy head; against TS, load goes from 10.0–35.7× to 4.1–12.4× slower. The object-shape and AST-mutation probes are listed in the P5-10c report on #271. The concerto-core suite, the oracle (16,242 of 16,242 fixtures) and the conformance suite pass unchanged. | **medium:** code that mutates a model's AST after constructing its `ModelFile`, or copies view objects by enumerating own properties. Neither is a documented use. `instanceof`, subclassing and identity are unchanged. | 2.2–2.9× on load (measured) | major (R1, which is already major) | L (done) |
| **BC-24** | #226 design note §3; P5-10b (#270); **maintainer decision on #270 (comment 5859088256): option (b), decorator factories stay eager** | A `DecoratorFactory.newDecorator` runs during model construction, so user code runs synchronously at load. **R1 keeps this:** a model manager with any registered decorator factory builds its files eagerly, as before. Managers without factories, including heavily decorated models, get lazy decorators (BC-23). A factory added after a file was constructed does not apply to that file's decorators, as before. | **R1 ships only the non-breaking part** (lazy decorators when no factory is registered). The breaking part (run factories at first access to a decorator, or replace factories with a post-load hook) is **not in R1**. It stays a proposal for a later major, per the #270 decision. | API / performance-enabling | JS | P5-10b: running factories on first read moved 9 recorded `gaps/` fixtures' `abstract function called` throw from `addCTOModel` to the first decorator read, and was reverted. | medium: users of `DecoratorFactory` (for the later major) | lets BC-23 apply to model managers with factories | major (later major) | M |
| **BC-25** | #226 §3 (error-timing parity); P5-10a/b `CONCERTO_LAZY_VIEWS_CHECK`; **P5-10c fuzz (#271)** | Every model error is thrown at construction. Laziness is sound only if Rust rejects everything TS construction rejects. | **A constraint on R1, not a change: errors stay eager.** Where Rust rejects, or user code runs at construction (decorator factories, a custom `options.regExp`), the file is built eagerly, so the TS error is thrown at the same point. **P5-10c found that R1 does not yet meet it:** Rust accepts a property whose `$class` is not a metamodel class but ends in a property class's short name (for example `StringProperty`, `foo.StringProperty`, or a doubled `concerto.metamodel@1.0.0.StringPropertyconcerto.metamodel@1.0.0.StringProperty`). TS rejects it with `IllegalModelException: Unrecognised model element`. Before lazy views the TS constructor threw at construction; now the file is staged lazily and the same error is thrown only when the declarations are first read (after `addModelFile`, or never). Fixing this is a Rust under-rejection fix (the #218 direction), reported on #271 and not fixed in P5-10c. | constraint | – | `CONCERTO_LAZY_VIEWS_CHECK=1`: 0 under-rejections in the concerto-core suite and the oracle (P5-10a/b) and in the concerto-conformance JS suite (109 semantic and 42 instance scenarios, P5-10c). The P5-10c fuzz check shard (100,000 cases, run-seed 1001): 21 `LAZY-CHECK` under-rejection lines, all this `Unrecognised model element` gap, and the shard's 578 divergences match the pre-lazy engine's case for case (check mode restores eager errors). The 1,000,000-case lazy run has 236 divergences the pre-lazy run on the same cases does not (12 clusters, each minimised to a malformed property `$class`; 222 are TS-throws/Rust-accepts, 14 are a different error class because another error now surfaces first), and none the other way. The lazy-only divergences in the 1,000,000-case run: `migration/fuzz/TRIAGE.md` ("P5-10c"). | – | – | – | – |
| **BC-26** | D7 (plan §6); #227 profile | Instances are TS `Resource` objects (D7), so every `resource.validate()` and `fromJSON` marshals the instance (`JSON.stringify` and UTF-8 into WASM). Marshalling alone (about 2.75 µs) costs more than TS's whole `validate()` (2.1 µs). | Additive first: a plain-JSON entry point (for example `modelManager.validateJSON(obj, type, options)`) that skips `Resource` construction. Later, and optionally, Rust-owned instance values. | performance-enabling / API | JS | #227: `fromJSON` 5.6× → 2.4× and `validate()` 9.1× → 2.9× on the unmerged prototype; parity blocked by marshalling | low for the additive form; high for Rust-owned instances | instance throughput | minor (additive), or major (Rust-owned) | M / L |
| **BC-27** | #227 review (comment 5848906482) | `ResourceValidator` **writes** `$identifier`, follows the **prototype chain** for declared fields, and so throws on a **frozen** resource (`Cannot assign to read only property '$identifier'`). A one-call fast path cannot reproduce that, so #227's fast path diverged on frozen and inherited-field resources. | `validate()` becomes read-only. It reads own enumerable data properties only and validates frozen objects. | performance-enabling / bug fix | JS | 2 behaviour differences found by #227's differential review | low to medium: code that relies on validate's `$identifier` write or on inherited fields | lets the one-call validate fast path apply always | major (narrow) | S–M |
| **BC-28** | plan §3 ("pluggable `options.regExp` stays in JS"); `engine/serializer.ts` (`model-manager-regExp-option`); ledger `StringValidator.getRegex` (stays-ts); lifted MAP.tsv (2 not-liftable rows) | `new ModelManager({regExp})`, a custom engine such as XRegExp, forces the TS path, because the Rust fast path cannot call it. `StringValidator.getRegex()` returns a JS `RegExp`. | Deprecate `options.regExp`. Make `getRegex()` return `{pattern, flags}` (or keep the `RegExp` but build it from Rust's validated source). | removal / API | JS | 2 not-liftable W tests; fast-path bail-out | medium: XRegExp users | Rust validates every regex, and removes a TS-only branch | major | S–M |
| **BC-29** | #226 (`parseNamespace` about 11 µs against 1.8 µs, because of the `semver.parse` host callback); PORTING.md 3.5 | `parseNamespace` returns a node-semver `SemVer` instance, built in JS through a host callback. | Non-breaking first: a pure-Rust check that builds the `SemVer` only when it is read (patch). The breaking alternative, returning plain `{major, minor, patch}`, is not recommended. | performance-enabling | JS | #226 profile | low (non-breaking form) | faster load | patch (recommended form) | S |
| **BC-30** | P5-04 RESULTS.md Table B ("no fast-path batching … future work") | Each model crosses the boundary on its own. | Additive batch entry points (for example a whole-set `addModels` with one crossing). | performance-enabling / API | JS | Table B per-model costs | low | fewer crossings | minor | M |

### 1.5 Design decisions, exceptions and constraints

| ID | Source | Current behaviour | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-31** | PORTING.md 1.5 (P4-11a, #115): "Node version" | Rust mode through the public **Node ESM** entry needs synchronous `require()` of `.mjs`, which needs Node ≥ 22.12. `engines.node` is `>=18`. After P5-02 there is no ts mode to fall back to. | **Maintainer decision (2026-09-29): raise the floor.** `engines.node` becomes `^20.19.0 || >=22.12.0` in every package (Node 20.19 and 22.12 both load `.mjs` through synchronous `require()` unflagged); Node 18 is dropped. No asynchronous ESM loader. Q3 is answered. | packaging | JS (ESM on Node < 22.12) | PORTING.md 1.5, recorded as a known limitation | **high:** ESM consumers on Node 18/20 | – | major | S (floor) / M (loader) |
| **BC-32** | PORTING.md 1.5, maintainer decision on #115; RESULTS.md (module 2.56–2.84 MB) | In rust mode the **browser** ESM graph does not load the engine by itself. A bundler, or a host-supplied synchronous `require`, is needed. The WASM module adds about 2.6–2.8 MB. After P5-02 this is the only mode. | An asynchronous initialisation entry for browsers (for example `await init()`, or top-level await in the browser build), and a documented bundler recipe. | packaging / API | JS (browser) | `e2e/tests/wasm-engine.spec.ts` stands in for the bundler | **high:** browser users without a bundler | – | major | M–L |
| **BC-33** | #198 and #72 gate notes (5846635927, 5846917558) | `ModelManager.getModelFileByFileName()` is typed `ModelFile` but can return `undefined`. The type was pinned to keep the API snapshot byte-identical. | Type it as `ModelFile \| undefined`. | API / type change | JS (TypeScript consumers) | #198 | low | honest types | major (for strict TypeScript consumers) | S |
| **BC-34** | plan §3 ("visitor shells … because tests spy on `visitX`"); lifted MAP.tsv (4 `jsonpopulator` not-liftable rows: `parameters.path` injection, `visit` fallthrough); `migration/api-snapshot` `deepPaths`; §0.5 | `JSONPopulator`, `JSONGenerator` and `ResourceValidator` keep TS visitor shells, and their internals (`parameters.path`, `visitX`) are reachable through deep `src/...` paths that §0.5 kept stable. | Stop supporting deep imports of visitor internals and internal visitor parameters. Only the root exports stay public. | removal | JS | 4 not-liftable W tests; `deepPaths` in the snapshot | medium: unknown deep-import users | lets P5-02-style deletion continue inside the visitors | major | M |
| **BC-35** | ledger (stays-ts): `globalize.ts` `messageFormatter`; P1-05 (Rust owns the templates) | `Globalize` stays public over `messages/en.json`, while Rust owns the same templates. | Deprecate `Globalize`, or generate `en.json` from the Rust catalogue so the two cannot drift. | removal | JS | ledger row | low | one message source | major (removal) / patch (generation) | S |
| **BC-36** | D7; ledger (stays-ts) for `Factory`, `Resource`, `Typed`, `Identifiable`, `Relationship`, `ValidatedResource`, `InstanceGenerator`, `valuegenerator`, `DateTimeUtil` | Instances are dynamic TS objects with dayjs date values. Sample generation uses `Math.random`, randexp and dayjs. | **No change proposed.** Replacing dayjs, or making instances Rust-owned, is a public API redesign. List it as a long-horizon option only (BC-26 covers the performance side). | – | – | ledger rows (177 `TS`/`-` rows; 84 of them are in these D7 files) | – | – | – | – |
| **BC-37** | P5-02 (#73), concerto 70bdeb49e; maintainer decision 2026-09-27 (option 1: accept) | P5-02 deleted the superseded TS decorator-command implementation and regenerated `migration/api-snapshot` (−352/+35 lines). Removed from the published `.d.ts`: the whole `DecoratorExtractor` module and class (never exported from the package root; reachable only by deep import), 11 `DecoratorManager` static helpers (`validateCommand`, `executeCommand`, `applyDecorator`, `applyDecoratorForMapElement`, `migrateAndValidate`, `getDecoratorMaps`, `addDcsWithIndexToMap`, `pushMapValues`, `checkForDuplicateDecorators`, `checkForNamespaceTargetAndApplyDecorator`, `executeNamespaceCommand`), and `processType` on `MapKeyType`/`MapValueType`. The public entry points (`DecoratorManager.decorateModels`, `validate`, `migrateTo`, `extractDecorators`, `extractVocabularies`, `extractNonVocabDecorators`) are unchanged. | **Accepted as shipped (maintainer decision).** The regenerated snapshot is the new baseline. List the removals in the R1 changelog. No shims. | removal | JS | api-snapshot diff 7c2cc6752..c73e6aa8c | low: internal helpers and a deep-import-only module | lets P5-02 remove the TS decorator-command engine | major (R1) | none (already done) |
| **BC-38** | Maintainer decision D1 and Q-14 on accordproject/concerto-rust#249 (conformance review of 2026-09-27, applied in P5-08c #257); CONFORMANCE-PROMOTION-PLAN Q-13, Q-14 | Most concerto exceptions leave `errorType` unset, so it defaults to `DefaultBaseException` (`BaseException` constructor); validators set `DefaultValidatorException` or a specific code. The conformance suite asserts an error class plus an `@rule:<ID>` tag, never message text, and rules that TS raises as a plain `Error` only at the "rejected" level. | Every concerto exception carries a standard `errorType` equal to its `@rule` ID (the concerto-conformance rule IDs, e.g. `CLASS_DECLARATION_007`), in TS and Rust. The conformance suite then gains a step `the error code should be <rule>`, derived from the `@rule` tags, and its `reject(any)` scenarios are strengthened to it. **This item owns the final public code format** (the rule ID verbatim, or namespaced) and any renumbering of the rule IDs (Q-14 of the promotion plan). | error-class or message fix | JS and Rust | the suite's `@rule` tags; `baseexception.ts` default | low: additive, since unset codes default to `DefaultBaseException` today | a portable error code the spec can assert, instead of class-only or rejected-only | minor | M |
| **BC-39** | Maintainer decision Q-15 on accordproject/concerto-rust#249 (applied in P5-08c #257); CONFORMANCE-PROMOTION-PLAN Q-15 | Validator errors are `BaseException`, both at model load (bad bounds, a default value outside its validator) and at instance validation (regex, length, range, size): `Validator.reportError` in TS (introspect/validator.ts:81-82) and `ErrorKind::Validator` in Rust (error/mod.rs:104, `ts_class` `BaseException`). | Load-time validator errors become `IllegalModelException`, and instance violations become `ValidationException`, keeping their `errorType`. Afterwards the conformance suite's validator scenarios, which assert rejection plus `errorType` for now, are strengthened to assert the class. | error-class or message fix | JS and Rust | recorded `BaseException` outcomes (F:conformance/ModelFile.new validator negatives; F:conformance/Serializer.fromJSON/3fd7878b64ffd91a8fdaafd8) | medium: callers that catch `BaseException` by class keep working (both are subclasses), but code that checks `name === 'BaseException'` changes | one error class per phase, as for every other rule | major (a change between two concerto classes) | S–M |
| **BC-40** | Maintainer decision D2 on accordproject/concerto-rust#249 (applied in P5-08c #257); concerto-conformance `scalars.feature` STRING_VALIDATOR_001 (`@skip`) | A string length validator with neither bound (`length=[,]`, or an AST whose `lengthValidator` has neither `minLength` nor `maxLength`) is accepted. TS `StringValidator` reads the bounds with `?.minLength` and tests `=== null`, so an absent (`undefined`) bound slips past the "must be specified" check. Rust copies this in introspect/validators.rs (`length_bound_field`). `NumberValidator` already rejects `range=[,]`. | Reject it, as `NumberValidator` does for `range=[,]`. Then un-skip STRING_VALIDATOR_001. A DIVERGENCES.md row is not needed while TS and Rust agree; the change is to both. | validation strictness | JS and Rust | the skipped conformance scenario; `stringvalidator.ts` bound handling | low: a model with an empty length validator has no effect today | consistent validator rules | major (rejects a model that used to load) | S |

### 1.7 P5-23 dayjs and semver analysis (accordproject/concerto-rust#327; P5-24 #328)

P5-23 inventoried the dayjs and node-semver behaviour the Rust engine
reproduced, and proposed these rows (its provisional IDs BC-43/44/45 are
renumbered here, contiguous from BC-41). The maintainer's decision of
2026-09-29 on #327 moved the date rows to R1 (P5-24), and the decisions of
2026-09-29 on #328 moved BC-41 to R1 (implemented by P5-38) and made BC-45 a
check at the point a default is applied (option 2, lazy validation), not at
model load. The semver crate swap itself is non-breaking (P5-25, #329) and
has no row.

| ID | Source | Current behaviour (TS 5.0.0 / Rust) | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-41** | P5-23 report on #327 (S1) | A namespace or import version given through a JSON AST, `ModelUtil.parseNamespace`, a `$class` or a DCS target is parsed by node-semver's `parse`: a leading `v`, surrounding whitespace, and numbers only up to 2^53−1 (and 256 characters). The CTO grammar already requires strict SemVer 2.0.0. | Strict SemVer 2.0.0 on every path: no leading `v`, no surrounding whitespace, numbers up to 2^64−1 (the `semver` crate without P5-25's node-compatibility wrapper). | validation strictness | JS and Rust | 0 corpus fixtures; 812 of the 3,944 node-semver differential inputs (`concerto-core/tests/semver/node-semver-7.6.3.json`) | low: only AST and API callers | one version grammar | major (R1, maintainer decision 2026-09-29 on #328; implemented by P5-38, not P5-24) | S |
| **BC-42** | P5-23 report (D2, D3; the proposed BC-43); P5-24 | TS strict mode accepts a strict string that names an impossible calendar instant and rolls it over (`2024-02-30T00:00:00Z` becomes 03-01; `2023-02-29…`, `2024-04-31…`; `…T24:00:00Z` becomes the next midnight). | **Shipped in R1 by P5-24:** rejected, with the `ValidationException` (`Expected value … to be of type DateTime`) strict mode throws for an invalid date; a leap second (`:60`) stays rejected. chrono's RFC 3339 parser behind the strict regex, with a seconds ≤ 59 guard. | validation strictness | JS and Rust | P5-24 unit tests (`instance::dayjs::tests::impossible_instants_are_invalid`) and lifted checks SF-CO-020, SF-CO-021, VV/VE-MAP-008; no corpus fixture sends one | low | a `DateTime` names one real instant | major (R1) | S (done) |
| **BC-43** | P5-23 report (D7; the proposed BC-45); P5-24 | A map's `DateTime` value is checked with `dayjs.utc(value).isValid()` in TS, and with an approximation in Rust (`parses_as_dayjs`: a four-digit year prefix, or any finite number) that differed from TS both ways. | **Shipped in R1 by P5-24:** the same strict rule as a `DateTime` field: a strict string naming a real instant. A number is rejected, as for a field; `undefined` (no value) still passes. The same plain `Error` (`Model violation in … Expected Type of DateTime …`). This replaces P5-23's follow-up 1 (a dayjs-parity fix for D7, dropped). DIVERGENCES.md DV-020. | validation strictness | JS and Rust | 0 corpus fixtures change (the 2 that reach the check keep their outcome); lifted VV/VE-MAP-007 to 011 | low: maps of `DateTime` are rare | fields and maps agree | major (R1) | S (done) |
| **BC-44** | P5-23 report (D5; the proposed BC-44) | The `utcOffset` option follows dayjs: a number with \|n\| ≤ 16 is hours, otherwise minutes; a `±HH:mm` string; anything else (for example `"Z"`) is silently ignored. | Deprecate in R2 (warn on an hours value or an ignored string); in R3 accept minutes or `±HH:mm` only. **Unchanged by P5-24** (out of its scope). | API | JS and Rust | 1 corpus fixture uses `utcOffset: 5`, 7 use `"Z"` | low | one offset unit | major (R3) | S |
| **BC-45** | P5-24 scope 3 (#328); maintainer decision 2026-09-29 on #328 (option 2, lazy validation) | A `DateTime` property's or `DateTime` scalar's `default` is never checked: `Typed.assignFieldDefaults` builds `dayjs.utc(default)` when an instance is created, so `default="2022-11-18"` gives a lenient date and `default="FOO"` an invalid one. | **Shipped in R1 by P5-24, in the Rust engine:** the default must be a strict `DateTime` string, checked when it is applied (instance creation or population: the engine's `Factory.newResource` and `Serializer.fromJSON`/`JSONPopulator`), not at model load, so a model with a lenient default still loads. A bad default throws a `ValidationException` (`typed-assignfielddefaults-datetime`), the class a strict `DateTime` field value's rejection has, after the defaults before it were applied. TS's own `Typed.assignFieldDefaults` (the TS `Factory`) is unchanged (#328 scope 3 is the Rust check). | validation strictness | Rust (and JS through the engine's `fromJSON`) | 2 corpus fixtures, recorded in `baseline.tsv` as intended `fail:unexpected-error`: unit `Factory.newResource` `af5730ac379eaaf6675b06eb` and `1cf6a6d9ff910fe56e3848a3` ("Model Tests #validation check property validation", `model-base.cto`'s `default="2008-09-15T15:53:00"`). No model-load fixture changes (the load-time check P5-24 first built failed 603 baselined fixtures and 54 concerto-core tests; option 2 removed it). concerto-core's own suite is unaffected: its `Factory` is TS, and the engine's `fromJSON` throws only when the default stays. Tests: `instance::from_json::tests::a_date_time_default_is_checked_when_it_is_applied`, `concerto_core_js::factory::tests::new_resource_rejects_a_non_strict_date_time_default`, `concerto_core_js::serializer::tests::from_json_applies_a_non_strict_date_time_default_only_when_it_stays` | medium: an instance of a class with a lenient date default can no longer be created or populated | defaults obey the field rule | major (R1) | S (done) |

| ID | Source | Current behaviour | Proposed behaviour | Category | Evidence | Risk | Size |
|---|---|---|---|---|---|---|---|
| **BR-12** | P5-23 report (follow-up 6) | A `DateTime` is the dayjs-shaped `instance::dayjs::Dayjs` (a time value, an offset and dayjs's `utc` state), in the default public API (BR-03). | A native date-time type for Rust users (chrono's `DateTime<FixedOffset>`), with `Dayjs` behind the `binding` feature (BR-03). | API | `concerto-core/src/instance/dayjs.rs` | low (pre-1.0) | M |
| **BR-13** | P5-23 report (S1, follow-up 6) | `model_util::SemVer` has `f64` fields (node-semver's number bound). | Expose `semver::Version` natively (after P5-25). | API | `concerto-core/src/model_util.rs` | low (pre-1.0) | S |

**The other stays-ts rows**, excluded because nothing breaks:
- constant-return, abstract-stub and `accept` dispatch members;
- the `processFile` CTO parse seam, `ModelLoader` and `DcsConverter` (the yaml library);
- constructor and options plumbing.

**The lifted W tests** (`migration/oracle/lifted/`, 110 rows) replace tests
without changing behaviour. The only ones relevant here are the not-liftable
rows cited in BC-28 and BC-34.

**The api-snapshot constraint** (§0.5, byte-identical) is what keeps BC-33
and BC-34 from happening during the migration. P4-08's `stripInternal` and
`@internal` members are not public and are excluded.

### 1.8 P5-26 test-support analysis (accordproject/concerto-rust#330; P5-34 #344)

P5-26 audited the code kept mainly so white-box tests could pass (stub
ModelFiles, spied call sites) and proposed BC rows for the public extension
points involved. The maintainer chose option 1 on each of its three
decisions (2026-09-29, on #330). The coordinator assigned these IDs on #344
to avoid the P5-23 clash: BC-46 (duck-typed ModelFiles), BC-47 (a ModelFile
needs a BaseModelManager, P5-35), BC-48 (`modelFiles` internal), BC-49
(per-declaration `validate()`) and BC-50 (monkeypatched ClassDeclaration
methods, P5-36). P5-34 adds BC-46, BC-48 and BC-49, and P5-35 adds BC-47;
BC-50 is added by its own task.

| ID | Source | Current behaviour (TS 5.0.0 / Rust) | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-46** | P5-26 report on #330 (I-1, I-2; the proposed BC-41); maintainer decision D3 option 1 (2026-09-29) | `addModelFile`, `addModelFiles` and `updateModelFile` accept any object with the `ModelFile` methods they call (`getNamespace`, `getVersion`, `validate`, `getAst`, ...). Before P5-34 the engine manager kept such an object out of its mirror, and every read on that manager then switched to a TS body. | **Shipped in R1 by P5-34:** only a ModelFile built by the ModelFile constructor is accepted; anything else (a duck-typed object, `Object.create(ModelFile.prototype)`, a sinon stub instance) throws a `TypeError` (`<method> expects a ModelFile built by the ModelFile constructor`). v5.0.0 already threw a `TypeError` for almost every such value, from the first method it lacked. The mirror-skip (`_isMirrored`, engine/views.ts `constructedFiles`) and the TS read bodies behind it are deleted. | API | JS | lifted checks CO-MM-010 to 018, P511-003, P511-006 and BOUNDARY-ARG-043/044 (deleted with the support); the frozen suite's stub cases were rewritten to real ModelFiles by P5-33 (#343) | low: the parameters are typed `ModelFile` in the `.d.ts`, and only test stubs were found doing this | every read of a manager answers from the engine, without a per-call mirror check | major (R1) | S (done) |
| **BC-47** | P5-26 report (I-6, I-7, I-10, I-11; the proposed BC-42); maintainer decision D3 option 1 (2026-09-29) | `new ModelFile(manager, ast)` accepts any manager object. Before P5-35 a manager with no `rustHandle` (a host's wrapper around a model manager, a stub) got a ModelFile built eagerly in TS, validated by the TS body of `ModelFile.validate()` (imports, duplicate names, then each declaration's `validate()`) and read through TS. | **Shipped in R1 by P5-35:** the ModelFile constructor accepts only a BaseModelManager whose constructor ran (a `ModelManager`, an `AstModelManager` or a subclass); anything else (a duck-typed object, a sinon stub instance, a `Proxy` around a real manager) throws a `TypeError` (`ModelFile expects a BaseModelManager built by its constructor`). The TS body of `ModelFile.validate()` and the manager shape guards (`_rustHandleId`, engine/views.ts `stageModelFile` and `lookupCacheable`) are deleted. The constructor was already documented "should only be called by framework code". The per-declaration `validate()` methods stay (BC-49). | API | JS | lifted checks CO-VAL-001 to 032 and P511-009 (deleted with the support; the per-declaration `validate()` scenarios are kept as direct calls in `declaration-validate.checks.js` DECL-VAL-001 to 025, and BC47-001/002 pin the `TypeError`); no `test/**` case reaches the TS body | low to medium: a host wrapper around a manager is the only known user, and none was found | one validation path for a ModelFile; about 70 TS lines fewer | major (R1) | S (done) |
| **BC-48** | P5-26 report (I-1(iv); the proposed BC-43); maintainer decision D3 option 1 (2026-09-29) | `ModelManager.modelFiles` is a public field. Mutating it bypassed the engine mirror; before P5-34 a per-call namespace-set comparison then silently switched reads to TS. | **Shipped in R1 by P5-34:** `modelFiles` is `@internal` (removed from the published `.d.ts` by `stripInternal`) and documented as read-only; read it through `getModelFile`, `getModelFiles` and `getNamespaces`. The per-call parity check is replaced by a flag the manager's own mutators set (`_mirrorPending`), so a direct mutation is no longer detected. | API | JS | `migration/api-snapshot/full-api.d.ts` (the field's line goes); crossings per read halve (`migration/bench/RESULTS.md`, P5-34) | low: the tests only read it | about half the engine calls per manager read | major (types) (R1) | S (done) |
| **BC-49** | P5-26 report (I-18; the proposed BC-44); maintainer decision D3 option 1 (2026-09-29) | Every declaration and element has a public `validate()` (`@protected` in the docs), which the library never calls: `ModelFile.validate()` and `ModelManager.validateModelFiles()` validate a whole file in one engine call. About 1k lines of per-element WASM bindings back the per-declaration path, which must be kept in parity with the whole-file one. | Deprecate in R2 (warn on a call; point to `ModelFile.validate()` / `ModelManager.validateModelFiles()`), remove in R3 with the per-element bindings. **No code change in R1.** | API | JS and Rust | I-18; 53 direct-call cases in 7 `test/introspect/*` files | medium: the methods are in the `.d.ts` | one validation path; about 1k WASM lines and 250 TS lines fewer | major (R3) | M |

### 1.6 Rust-crate-API-only (no JS impact; feeds P6-01 #83, `docs/public-api.md` §3.4)

| ID | Source | Current behaviour | Proposed behaviour | Category | Evidence | Risk | Size |
|---|---|---|---|---|---|---|---|
| **BR-03** | public-api.md F2 | JS-modelling types are in core's default public API: `instance::value::JsValue`, `Dayjs`, `SerializerOptions`, the `$$` constants, `ErrorKind::JsTypeError`/`JsRangeError`, `ts_class`. | Move them behind a `binding` feature (Q1 of that document). | API / removal | 304 grep lines in 11 files | low (pre-1.0) | M |
| **BR-04** | F3 | Binding-shaped traits (`ResolutionContext`, `ValidatedElement`, `HasValidators`, `Validate`, the `process`/`Processed*` family) are public. | Move them to the `binding` feature. | API / removal | the audit table | low | M |
| **BR-05** | F4 | Two lookup styles, by name and by handle, and mixed return types (names against `DeclId`s). | Choose one per question. | API | the audit | low | M |
| **BR-06** | F5 | 44 `pub fn get_*` keep the TS names. `add_model` takes a JSON AST where TS's `addModel` takes CTO. | Rust naming (C-GETTER), with `#[deprecated]` aliases for one minor, and rename `add_model` to reflect JSON AST input. | API | the audit | low | M |
| **BR-07** | F6 | `ConcertoError::{TypeNotFound, IllegalModel, Contract}` overlap (45 legacy references), and no enum is `#[non_exhaustive]`. | One `Error {kind, code, params, location}`, and `#[non_exhaustive]` on the public enums. | API | the audit | low | M |
| **BR-08** | F8 | The #1273 `DeserializeOptions` are reachable only through JS-shaped `SerializerOptions`. | Take them on the native `validate_instance`. | API (additive) | the audit | low | S |
| **BR-09** | #234 (P5-06c), #239 (P5-06d) | Typed AST deserialisation falls back to the `Value` path for every error, which means two schemas and double parsing on the error path. | Once BC-19 lands, the typed decode is the only loader and the `Value` fallback is removed. | performance-enabling | 1.5–2.7× native text-to-ModelFile; 1,475 ASTs and 42,096 mutants differential-tested | medium: needs BC-19's semantics first | M |
| **BR-10** | #217 final review (5848627881: "The native from_json path still differs from TS for truthy non-string names; the implementer declared this out of scope") | The native Rust loader (not the view bindings) treats truthy non-string names differently from TS. | Align it, or make it strict under BC-19. | validation (native only) | the #217 review | low | S |
| **BR-11** | DV-005, DV-001 | See BR-02 and BR-01. | – | – | – | – | – |

---

## 2. Classification

| Class | Rows |
|---|---|
| **Safe after the migration as minor or patch** | BC-01, BC-06, BC-08, BC-11, BC-12, BC-14 (crash to domain exception, or message text only); BC-38 (additive error codes, minor); BC-09 (subject to Q8); BC-21 as a faithful fix (patch); BC-29 (patch, non-breaking form); BC-26 additive form, BC-30 (minor, additive); BC-35 generation form (patch); BR-02 |
| **Needs a major release** | BC-37 (already shipped in R1), BC-23 (shipped in R1 by P5-10a/b), BC-07, BC-42, BC-43 and BC-45 (shipped in R1 by P5-24), BC-41 (R1, P5-38), BC-46 and BC-48 (shipped in R1 by P5-34), BC-47 (shipped in R1 by P5-35), BC-49 (R2 deprecation, R3 removal), BC-39, BC-40, BC-44, BC-02, BC-04 (until Q6), BC-05, BC-10, BC-17, BC-19 (with BC-18 and BC-20 folded in), BC-21 extending DV-018, BC-24 factory-timing part (its non-breaking part shipped in R1), BC-26 Rust-owned form, BC-27, BC-28, BC-31, BC-32, BC-33, BC-34, BC-35 removal form |
| **Changelog-only: already Rust behaviour, universal at P5-02** | BC-03 (DV-004), BC-07 part (a) (DV-009), BC-13 (DV-015), BC-15 (DV-017), BC-16 (DV-018) |
| **Rust-crate-API-only** (feeds P6-01 #83) | BR-01 to BR-13 |
| **No change proposed** | BR-01, BC-25 (a constraint on R1; not yet met, see its row), BC-36, BC-22 (pending #219) |

---

## 3. Grouping and order

Proposed releases. The version numbers assume concerto-core 5.x today, and
that the P5-02 release is the first to run on the Rust engine only.

### R1: the engine switch (the release that ships P5-02)

This release is **major** by necessity, because of BC-31 and BC-32. It is
otherwise "same behaviour, new engine".

**Contents:**
- **Packaging:** BC-31 (the Node floor, or an ESM loader) and BC-32 (a browser init entry and bundler docs).
- **Changelog for already-built divergences:** BC-03 (DV-004), BC-07(a) (DV-009), BC-13 (DV-015), BC-15 (DV-017) and BC-16 (DV-018).
- **Changelog for P5-02's accepted API removals:** BC-37 (`DecoratorExtractor`, internal `DecoratorManager` statics, `MapKeyType`/`MapValueType.processType`).
- **Strict `DateTime` (maintainer decision 2026-09-29 on #327; shipped by P5-24 #328):** BC-07 (b)+(c), BC-42, BC-43 and BC-45, with their changelog entries (section 4). No R2 deprecation step.
- **Strict namespace SemVer (maintainer decision 2026-09-29 on #328; implemented by P5-38):** BC-41, with its changelog entry (section 4). No R2 deprecation step.
- **ModelFile stub support removed (maintainer decision 2026-09-29 on #330; shipped by P5-34 #344):** BC-46 (only constructor-built ModelFiles) and BC-48 (`modelFiles` internal and read-only), and, shipped by P5-35 #345, BC-47 (a ModelFile needs a BaseModelManager), with their changelog entries (section 4). No R2 deprecation step.
- **Lazy views (maintainer decision 2026-09-27; shipped by P5-10a #269 and P5-10b #270; verified by P5-10c #271):** BC-23 as built, BC-24's non-breaking part (decorator factories stay eager, #270 option (b)), and BC-25 as the constraint they must meet. **P5-10c found one gap in BC-25** (a Rust under-rejection now surfaces at first read instead of at construction); it must be fixed, or accepted by the maintainer, before R1. Changelog entries for the mutation and object-shape changes in BC-23 (section 4).
- **Optionally, the minor-class fixes, because after P5-02 they are one-place Rust changes:**
  - BC-06, BC-08, BC-11, BC-12 and BC-14: TS crash to domain exception, or message text;
  - BC-01;
  - BC-33 (a type-only change that fits a major).

**Dependencies:**
- P5-02 (#73) merged, which itself waits on P5-01 (#72).
- #219 closed, since it may add DV rows.
- P5-03 (#74).

**Size:** BC-31 S–M, BC-32 M–L, the changelog S, each fix S.

### R2: 6.x minors after R1

**Contents:**
- P5-06d (#239, already planned and non-breaking);
- BC-29, BC-30 and the BC-26 additive entry point;
- BC-09 (if Q8 says minor);
- BC-21 as a faithful fix (it is a port gap; it could go earlier, before P5-02, as ordinary migration work);
- BC-35 generation form;
- BC-38 (standard `errorType` codes equal to the conformance `@rule` IDs; it decides the public code format first);
- BC-44's deprecation warning;
- BC-49's deprecation warning (per-declaration `validate()`);
- anything from the R1 optional list that was not shipped.

**Dependencies:**
- P5-06d follows P5-02 (the coordinator's order on #73);
- BC-26 depends on D7 staying as it is.

### R3: the next major, "strict models and fast views"

**Contents:**
- **Strictness:**
  - BC-19, with BC-17, BC-18 and BC-20 folded in, plus BC-21 extended if Q9 says so;
  - BC-02 (if Q5 says so);
  - BC-04, BC-05 and BC-10;
  - ~~BC-07(c), removing non-strict `DateTime` support~~ moved to R1 (P5-24, maintainer decision 2026-09-29);
  - ~~BC-41 (strict namespace SemVer)~~ moved to R1 (P5-38, maintainer decision 2026-09-29 on #328);
  - BC-44 (the `utcOffset` units, deprecated in R2);
  - BC-39 (validator errors leave `BaseException`) and BC-40 (reject `length=[,]`), both maintainer decisions of 2026-09-27 (#249).
- **Performance and API:**
  - BC-24's factory-timing part, if the maintainer adopts it (BC-23 and BC-25 moved to R1);
  - BC-27 and BC-28;
  - BC-34 and BC-35 (removal form);
  - BC-49 (per-declaration `validate()` and its per-element WASM bindings removed, deprecated in R2).

**Dependencies and order inside R3:**
1. **BC-19 first.** It makes BC-25's zero-under-rejection guarantee structural (Rust checks the full metamodel shape), rather than measured as in R1, and it lets BR-09 drop the `Value` fallback.
2. **BC-24's factory-timing part**, if adopted, after BC-19.
3. ~~BC-23~~ moved to R1 (P5-10a/b).
4. **BC-27** before the #227 fast path is revived (concerto-rust#232, concerto#1374, kept for reference).

**Tie to the P5-02 outcome (superseded by P5-10c):** P5-02 kept the hybrid TS construction, as #67 decided, and BC-23 then closed most of the remaining load gap in R1 (2.2–2.9× on load; P5-10c). Parity still needs crate work: BR-09, allocation, and so on.

**Size:** BC-19 L, the rest S–M.

### RB: Rust crate 1.0 (P6-01 #83 onward)

**Contents:** BR-02 to BR-10, and BR-12 and BR-13 (native `DateTime` and `semver::Version`, P5-23), in the order of public-api.md §7:
1. re-audit;
2. the `binding` feature (BR-03, BR-04);
3. errors (BR-07);
4. renames with deprecation aliases (BR-05, BR-06);
5. instance options (BR-08);
6. `#[non_exhaustive]`;
7. hand-over to P6-02 and P6-03 (#84, #85, the semver checks).

**Dependencies:**
- P5-03 (#74), which comes first according to #83.
- BR-09 after BC-19 and P5-06d.

RB does not affect JS users and can run in parallel with R2.

---

## 4. Migration aids for each breaking item

| ID | Deprecation path | Compatibility flag | Changelog note (draft) |
|---|---|---|---|
| BC-02 | Log a warning when an unversioned namespace is parsed, for one minor. | `ModelManager` option `allowUnversionedNamespaces` (defaults to true in R2, false in R3). | "`ModelUtil.parseNamespace` now rejects namespaces without a version, as Concerto v4 requires." |
| BC-04 | – (fix). Record fixtures first, to show the direction. | none | "Map values of a scalar type are now validated against the value type, not the key type." |
| BC-05 | Accept both embedded objects and relationship strings for one minor, with a warning on the embedded form. | `legacyRelationshipMapValues` | "Relationship-typed map values now hold relationship references, like relationship properties." |
| BC-07 | None: removed in R1 (maintainer decision 2026-09-29). | `strictQualifiedDateTimes`: its lenient mode is removed; `false` is ignored with a warning (`concerto-strict-datetime`), and `true` only stops `utcOffset` being applied | R1: "Only strict ISO 8601 / RFC 3339 `DateTime` values are accepted: `YYYY-MM-DDTHH:mm:ss`, an optional fraction of a second, then `Z` or `±HH:mm` (for example `2022-11-28T01:02:03.987Z`). Date-only strings, date-times without an offset, a lower-case `t` or `z`, a space separator and the other forms JavaScript's `Date` used to accept are rejected with a `ValidationException`, whatever `strictQualifiedDateTimes` says. Setting it to `false` no longer enables lenient parsing and prints a warning." |
| BC-41 | None (R1; maintainer decision 2026-09-29 on #328, implemented by P5-38). | none | R1: "Namespace versions given through the JSON AST, `ModelUtil.parseNamespace`, `$class` or a decorator command set must be strict SemVer 2.0.0, as the CTO parser already requires: `v1.0.0` and `' 1.0.0 '` are rejected." |
| BC-42 | None (R1). | none | R1: "A `DateTime` must name a real instant: `2024-02-30T00:00:00Z`, `2023-02-29T00:00:00Z` and `…T24:00:00Z` are rejected instead of being rolled over to the next valid instant, and a leap second (`:60`) is rejected as before." |
| BC-43 | None (R1). | none | R1: "Map values of type `DateTime` must be strict ISO 8601 date-times, as `DateTime` fields are. Numbers and lenient date strings are rejected." |
| BC-44 | R2: warn when `utcOffset` is a number between −16 and 16 (read as hours) or a string that is not `±HH:mm`. | none | R3: "The `utcOffset` option takes minutes, or a `±HH:mm` string. Numbers from −16 to 16 are no longer read as hours, and other strings are rejected instead of ignored." |
| BC-45 | None (R1). | none | R1: "A `DateTime` field's or scalar's default value must be a strict ISO 8601 date-time. A model with any other default (for example `default="2022-11-18"`) still loads, but creating or populating an instance that would get that default throws a `ValidationException`." |
| BC-46 | None (R1; maintainer decision 2026-09-29 on #330). | none | R1: "`addModelFile`, `addModelFiles` and `updateModelFile` accept only a `ModelFile` built by its constructor. Any other object, including one with the same methods, throws a `TypeError`." |
| BC-47 | None (R1; maintainer decision 2026-09-29 on #330). | none | R1: "`new ModelFile(modelManager, ast)` requires a `ModelManager` (or another `BaseModelManager`) as its manager. Any other object, including a wrapper or `Proxy` around a model manager, throws a `TypeError`. Build model files through the `ModelManager` methods where possible." |
| BC-48 | None (R1). | none | R1: "`ModelManager.modelFiles` is internal and read-only, and is no longer in the type declarations. Use `getModelFile`, `getModelFiles` or `getNamespaces`; change models only through the `ModelManager` methods." |
| BC-49 | R2: warn once per class when a declaration's or element's `validate()` is called, pointing to `ModelFile.validate()` and `ModelManager.validateModelFiles()`. | none | R3: "The per-declaration `validate()` methods are removed. Validate a whole model file with `ModelFile.validate()`, or every model file with `ModelManager.validateModelFiles()`." |
| BC-10 | – | none | "`±Infinity` is rejected for Integer and Long fields during deserialisation, even when validation is off." |
| BC-13 | – | none | "A non-string `$class` in an instance is rejected with `Error: a $class that is not a string: …`. It used to throw a `TypeError`, or, for an array, a `TypeNotFoundException`." |
| BC-15 / BC-16 | – | none | "A relationship without a type, or a `null` decorator, is rejected with an `IllegalModelException` instead of a `TypeError`." |
| BC-17, BC-18, BC-19, BC-20 | R2: `ModelManager` option `strictAst` (default false) that runs the metamodel shape check on load, with a warning when it would reject. R3: flip the default. | `strictAst` (or re-use `metamodelValidation`, Q10) | "Models are checked against the Concerto metamodel when they are loaded. Malformed ASTs that used to load, or that failed with a `TypeError`, now fail with an `IllegalModelException`. Set `strictAst: false` to restore the old behaviour for this major." |
| BC-21 (extended) | – | covered by `strictAst` | "Non-object decorators are rejected." |
| BC-23 | – (shipped in R1 with no option, per the maintainer's "lazy is the only path"). Document in the R1 changelog. | none | R1: "Declaration, property, decorator and validator objects are now built when they are first read, not when a model file is constructed. Object identity is unchanged. A model file's AST is treated as read-only once the `ModelFile` is constructed: changing it afterwards is not supported, and the declarations may reflect the change or not depending on when they are first read. Some view fields (`declarations`, `decorators`, `validator` and similar) are accessors until first read, so copying a view by enumerating its own properties (spread, `Object.assign`, `Object.keys`) may omit them; call the getters (`getDeclarations()`, `getDecorators()`, `getValidator()`) instead. A class declaration's property list and name lookup (`getProperties()`, `getProperty()`) are cached per declaration and refreshed when models are added, updated, deleted or cleared through the `ModelManager` (P5-14, #308). Replacing or renaming a `Property` object in place on a view is not seen by later `getProperties()`/`getProperty()` calls; change the model through the `ModelManager` instead. A model manager's `getNamespaces()`, `getType()` and `resolveType()` answers are likewise kept per manager and refreshed when models are added, updated, deleted or cleared through the `ModelManager` (P5-29, #334); `getNamespaces()` returns a new array on every call. Changing a model manager's internal model file map directly (not through its methods) may not be seen by later calls." |
| BC-24 | R1: none (factories stay eager). Later major, if adopted: deprecate synchronous side effects in `DecoratorFactory.newDecorator` and add a post-load hook first. | none | Later major, if adopted: "Decorator factories run when a decorator is first read, not while the model loads." |
| BC-26 (Rust-owned) | Only after the additive entry point has one major of uptake. | – | – |
| BC-27 | Warn in R2 when `validate()` would write `$identifier` or read an inherited field. | none | "`Resource.validate()` no longer modifies the resource, and reads only its own properties. Frozen resources can be validated." |
| BC-28 | Deprecate `options.regExp` in R2, with a warning. | `options.regExp` is kept until R3 (on the TS-fallback path). | "The `regExp` option is removed. Regular expressions are evaluated by the Concerto engine. `StringValidator.getRegex()` returns `{pattern, flags}`." |
| BC-31 | Announce in the R1 pre-release. | none | "Concerto requires Node.js 20.19 or later on the 20.x line, or 22.12 or later. Node.js 18 is no longer supported." |
| BC-32 | Keep the bundler path documented. Add `init()`. | none | "In browsers, await `init()` from `@accordproject/concerto-core` before first use, unless a bundler is used." |
| BC-33 | – | none | "`getModelFileByFileName` is typed `ModelFile \| undefined`." |
| BC-34 | Deprecate deep imports in R2 (package `exports` warnings). | none | "Only the package's root exports are public. Deep `src/...` imports of the serializer visitors are removed." |
| BC-35 | Deprecate `Globalize` in R2. | none | "`Globalize` is removed. Error messages come from the engine's catalogue." |
| BC-39 | – (the class changes; `errorType` is kept, so code that switches on `errorType` is unaffected) | none | "Validator errors are now `IllegalModelException` when a model loads and `ValidationException` when an instance is validated, instead of `BaseException`. Their `errorType` is unchanged." |
| BC-40 | Warn in R2 when a length validator has neither bound. | none | "A string length validator must specify `minLength`, `maxLength` or both, as a number range validator already must." |
| BC-37 | – (already removed in P5-02; accepted by the maintainer) | none | "`DecoratorExtractor` and the internal `DecoratorManager` helpers (`validateCommand`, `executeCommand`, `applyDecorator` and related statics) are removed; decorator command sets are applied by the Concerto engine. Use `DecoratorManager.decorateModels`, `validate`, `migrateTo` and the `extract*` methods, which are unchanged. `MapKeyType.processType` and `MapValueType.processType` are removed." |
| BR-* | `#[deprecated]` aliases for one minor (public-api.md §7.4). | the `binding` feature | Crate CHANGELOG, from P6-03's semver check. |

The minor-class rows (BC-01, BC-06, BC-08, BC-09, BC-11, BC-12, BC-14) need no
deprecation. Each needs a changelog note naming the old and new error or
value, the DIVERGENCES.md row closed in the same change, and the oracle
baseline regenerated.

**Proposed follow-up issues** (listed here, not filed, per the task rules):
1. The R1 changelog and packaging items (BC-31, BC-32).
2. ~~A follow-up for DV-009's default flip (BC-07)~~ done in R1 by P5-24 (#328).
3. A DIVERGENCES row plus a follow-up for BC-17 (see 5.2).
4. BC-19, the design of strict AST loading.
5. ~~BC-23 and BC-24, handle-backed views~~ done as P5-10a/b/c (#269, #270, #271); only BC-24's factory-timing part remains, as a later-major proposal.
6. BC-27, a read-only `validate`.
7. BC-28, deprecating `options.regExp`.
8. BC-33, the type fix.
9. BC-21, which needs a decision (Q9).

---

## 5. Exclusions and housekeeping

### 5.1 Recorded items excluded from the catalogue, and why

These are **port gaps**: Rust differed from TS and was, or is being, fixed to
match TS. None of them is a deliberately withheld improvement.
- **Gap-audit findings F1–F4:** fixed by P2-09a (#152).
- **Gap-audit findings F5–F7:** fixed by P2-09c (#171). F6's TS-side wart became DV-016, which is BC-14.
- **Gap-audit unit-test gaps:** these are not behaviour.
- **P2-11b findings** (#190, #193–#201): all closed after being fixed to match TS or supported in the harness. None added a DV row.
- **#217 (T2a) and #219 (T2c) port fixes:** these change Rust to match TS. The TS behaviours they expose are catalogued as BC-18, BC-19 and BC-20. #219 is still open (BC-22).
- **#169 (T1c, embedded NUL):** fixed to match V8.
- **The 80 JS-replay failures** (`Duplicate class name … File '…'`, `Scalar must be one of …`): fixed by P5-01b (#233).
- **#218 cluster #6** (`classDeclarationGetProperties` truthiness): a binding bug, fixed in #224.
- **P5-06, P5-06c and P5-06d** (#220, #234, #239): performance-only, with behaviour unchanged. The WASM allocator lever was dropped by the maintainer (#234).
- **P4-12 NAPI:** closed as not needed (#71).
- **No "out of scope, faithful port" note was found in the review comments of merged migration PRs** beyond those already cited (#217 review → BR-10, #218 follow-ups → BC-21 and BC-20). A GitHub search of PR comments for "faithful" and "out of scope" in both repos returned no further hits. That search is limited, and the independent review should spot-check the PR list (Q11).

### 5.2 A ported TS bug with no DIVERGENCES row

The #222 fix (#218 cluster #1) ports TS's per-code-unit iteration of a string
`decorators` value faithfully. It is documented in `decorator.rs`
`parse_decorators`, but has no `ts-bug` row in DIVERGENCES.md and no `// DV-nnn`
marker, which PORTING.md 7.3 requires. BC-17 catalogues it. **Proposed:** a
DV-019 row and a follow-up issue, done by a docs-only task, not by P5-07.

### 5.3 Stale or superseded open issues

- **#147** is open and unlabelled. It describes a Rust `IllegalModelException` for cycles against TS's `RangeError`, and cites "DV-014". It is superseded: DV-013 now ports the `RangeError`, and #184 is the follow-up for the real fix. Proposed: close it as superseded by #184.
- **#160** is open. The array/object `$class` shape was folded into DV-015 when #156's scope was confirmed (DV-015 row; TRIAGE.md T1b). Proposed: close it as superseded by #156/DV-015.

---

## 6. Open questions for the maintainer

- **Q1. The semver policy (section 0).** Is replacing a V8 `TypeError` or `RangeError` with a concerto exception a minor change? Is a message-text change minor? About 320 unit-test assertions match exact message text (plan §1.1), so callers may do the same. The strict answer makes R1's optional fixes, and BC-13's array shape, major-only.
- **Q2 (answered 2026-09-29: one major; see the update at the top). One major or two?** Recommended: two. R1 is "same behaviour, new engine, plus packaging", and R3 is "strict models and fast views", to keep risk apart. The alternative is to fold R3 into R1, so users take one major, but a regression is then harder to attribute to the engine switch or to the new strictness.
- **Q3 (answered 2026-09-29: raise the floor to `^20.19.0 || >=22.12.0`; see BC-31). BC-31: raise `engines.node` to 22.12, or build an asynchronous ESM loader** so Node 18/20 ESM consumers keep working? Node 18 and 20 are past end of life by 2026, which argues for raising the floor.
- **Q4. Follow-up issues.** Should the follow-up issues in section 4 be filed now (P5-07 may not file them), and should they carry `mig:post-migration`?
- **Q5 (answered 2026-09-29: enforce versioning in R1, P5-50). BC-02 (DV-003).** Should `parseNamespace` enforce v4 versioning, or is accepting an unversioned namespace intended (for `strict: false` users), in which case DV-003 closes as "keep"?
- **Q6. BC-04 (DV-006).** Record fixtures first, to show whether the fix only ever accepts more? If it does, it drops to minor.
- **Q7. BC-07 (DV-009).** ~~Should the non-strict date path be kept in R3, with its default flipped, or removed outright?~~ **Answered 2026-09-27: removed outright; the Rust engine will not support non-strict `DateTime` values.**
- **Q8. BC-09 (DV-011).** Is a map value's `$identifier` part of any serialised or public output? If it is, the fix is major.
- **Q9. BC-21.** For a non-object decorator (`[7]`), port TS's acceptance (a faithful patch), or extend DV-018's clearer rejection (a maintainer-accepted exception)?
- **Q10. BC-19.** Should strict AST loading reuse the existing `metamodelValidation` option, or get a new name? Should R2 ship it opt-in, with the default flipped in R3?
- **Q11. Evidence gaps.** The independent review should spot-check review comments on merged migration PRs for "out of scope" notes this plan may have missed (5.1). Should the plan also be refreshed when #219 closes (BC-22)?
- **Q12. Sequencing.** The coordinator's order on #73 was P5-02, then P5-06d, then P5-07, while this issue says "runs now". This plan was written now, from records only. Should it be re-checked after P5-02 lands, because P5-02 may make BC-23 moot? **Superseded 2026-09-27:** the maintainer decided to ship lazy views before the migration release; BC-23 and BC-25 moved to R1 (P5-10c).

---

## 7. Claims confirmed against the current code

Only recorded claims were checked. No finding was re-derived.

- `DIVERGENCES.md` at concerto-rust `78566e7` has exactly DV-001 to DV-018, with the text quoted above.
- The `mig:post-migration` label lists exactly 10 issues: #127, #136, #137, #138, #172, #179, #184, #185, #186 and #187.
- `concerto-core/src/introspect/decorator.rs` `parse_decorators` documents the per-code-unit port (BC-17 and 5.2), and no `DV-` marker appears there.
- `packages/concerto-core/src/engine/serializer.ts` bails out of the fast path on `options.regExp` (`model-manager-regExp-option`) (BC-28).
- ~~`packages/concerto-core/package.json` has `engines.node` `>=18` (BC-31).~~ Raised to `^20.19.0 || >=22.12.0` in every package (2026-09-29).
- `migration/fuzz/results/stage2/divergence-summary.json` `by_class_pair` gives the `ts=TypeError` totals quoted in BC-18.
- `migration/ledger/SEAM_LEDGER.tsv` has 177 rows classified `TS` with planned task `-` (stays-ts).
