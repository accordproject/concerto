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
| **BC-03** | DV-004 (`engine`) | JS strings may contain a lone surrogate. The WASM boundary passes UTF-8, so Rust sees U+FFFD. No fixture observes this. **After P5-02 it is JS-visible.** | Accept and document it in the R1 changelog. Alternatively, pass such strings as UTF-16 (`JsString`) at the boundary, which is a patch but costs speed. | none, or patch | JS | no fixture; unobserved | low | none | changelog (R1) | S if fixed |
| **BR-02** | DV-005 (`engine`), #90 | Rust `mm::*` Integer/Long AST fields are `f64` (OD-3). Re-serialising a typed value prints `5.0` and `1e19`. | Give the numeric `mm::*` fields a JS-number serializer (ECMAScript `Number::toString`, as PORTING.md 3.1 already requires for messages), so the typed round trip prints like `JSON.stringify`. | API or type change | Rust | `concerto-metamodel/tests/numeric_widening.rs` | low | a faithful typed round trip for P6 users | Rust minor (pre-1.0) | S |
| **BC-04** | DV-006 (`ts-bug`), #186 | `checkMapType` unwraps the **value** slot using the **key's** scalar-ness. | Unwrap the value slot by the value type's own scalar-ness. | bug fix / validation | both | **0 fixtures** (ported by reading the TS source) | medium, and the direction is unknown: instances may flip either way | correctness | major until a fixture shows the direction is reject→accept only (Q6) | S, plus new fixtures M |
| **BC-05** | DV-007 (`ts-bug`), #187 | A `RelationshipMapValueType` value must be an embedded `Resource`. A relationship URI string is rejected. | The value is a relationship reference, as for `RelationshipProperty`, in the validator, populator and generator. | bug fix / validation | both | `instance::validate::tests::a_map_with_a_relationship_typed_value_accepts_a_nested_resource` | **high:** stored data that holds embedded objects in such maps stops validating | spec alignment | major | M |
| **BC-06** | DV-008 (`ts-bug`), #127 | `ResourceValidator` throws `TypeError` (`obj.getFullyQualifiedType is not a function`, or `…reading 'toString'`) for a non-Identifiable value or a `null` element. | Throw a `ValidationException` naming the field and the value's JS type. | error class | both | 1 fixture (`gaps/Resource.validate/d444ebcf0cf5a3c23e5ee6dd`) and 2 unit tests | low | clearer errors; callers can catch one class | minor | S |
| **BC-07** | DV-009 (`engine`), #169 (closed) | TS's non-strict `DateTime` parsing falls back to V8's legacy date parser (`Nov 28 2022`, `"1"`, `"-0"`). Rust covers the ECMAScript format and the numeric-only legacy forms the corpus reaches, and rejects the other legacy forms. **After P5-02 this is JS-visible:** `"-0"` and `"1"` stop parsing. | **Maintainer decision (2026-09-27): the Rust engine will not support non-strict `DateTime` values.** (a) Put the forms that already stop parsing in the R1 changelog. (b) Deprecate non-strict (non-ISO, legacy-parser) date strings in R2, with a warning. (c) In R3, **remove the non-strict date path outright**: only strict ISO 8601 `DateTime` values are accepted (today's `strictQualifiedDateTimes: true` behaviour), the option no longer has a lenient mode, and the Rust legacy-form emulation is deleted. Q7 is answered. | validation strictness | JS (dates stay in dayjs, D7) | 47 legacy-format fixtures pass; fuzz T1d, 2 clusters and 8 cases in stage 2 (`"-0"`); DV-009's own `"1"` example | medium: lenient date inputs from users | predictable, engine-independent dates | major (both the engine switch and the default flip) | S |
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
- DV-015, DV-017 and DV-018 are `maintainer-accepted`, so Rust's behaviour is already the decision.

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
`fromJSON` 5.7×, `resource.validate()` 6.8×.

| ID | Source | Current behaviour | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-23** | #67 hybrid decision (comment 5844197262); #220 structural finding; #226 no-go | In rust mode the **TS view graph is built eagerly** (hybrid construction), and the AST crosses into WASM two or three times. Public fields (`declarations`, `properties`, `ast`) are plain mutable TS objects with stable identity. | Handle-backed views: declarations and properties are materialised from the Rust arena on demand, and public fields become getters. Identity is guaranteed only through the view cache. Mutating a returned array or field no longer reaches the engine. | performance-enabling / API | JS | #220: the two load-time round trips are about 45% of `synthetic-large` load, GC is 16% and system-model views are 10%. #226: lazy views give 2–3× (load 4.7–21× TS), and the crate's own load is the floor. | **high:** identity, mutation, `instanceof` and subclassing assumptions | 2–3× on load (measured), more with BR-09 | major | L |
| **BC-24** | #226 design note §3 (decorator factories force the eager path) | A `DecoratorFactory.newDecorator` runs during model construction, so user code runs synchronously at load. The ledger keeps it as a TS user extension point. | Run factories at first access to a decorator, or replace factories with a post-load hook. | API / performance-enabling | JS | #226 design note, and a factory added after load was hidden in the prototype | medium: users of `DecoratorFactory` | lets BC-23 apply to every model manager | major | M |
| **BC-25** | #226 §3 (error-timing parity) | Every model error is thrown at construction. Laziness is sound only if Rust rejects everything TS construction rejects. | Keep errors eager: this is a **constraint, not a change**. BC-23 must not move error timing. Its prerequisite is zero under-rejections in the P5-05 fuzzer on the stage op, which BC-19 makes easy. | constraint | – | #226 `CONCERTO_LAZY_VIEWS_CHECK`: 0 under-rejections in the suite and the corpus | – | – | – | – |
| **BC-26** | D7 (plan §6); #227 profile | Instances are TS `Resource` objects (D7), so every `resource.validate()` and `fromJSON` marshals the instance (`JSON.stringify` and UTF-8 into WASM). Marshalling alone (about 2.75 µs) costs more than TS's whole `validate()` (2.1 µs). | Additive first: a plain-JSON entry point (for example `modelManager.validateJSON(obj, type, options)`) that skips `Resource` construction. Later, and optionally, Rust-owned instance values. | performance-enabling / API | JS | #227: `fromJSON` 5.6× → 2.4× and `validate()` 9.1× → 2.9× on the unmerged prototype; parity blocked by marshalling | low for the additive form; high for Rust-owned instances | instance throughput | minor (additive), or major (Rust-owned) | M / L |
| **BC-27** | #227 review (comment 5848906482) | `ResourceValidator` **writes** `$identifier`, follows the **prototype chain** for declared fields, and so throws on a **frozen** resource (`Cannot assign to read only property '$identifier'`). A one-call fast path cannot reproduce that, so #227's fast path diverged on frozen and inherited-field resources. | `validate()` becomes read-only. It reads own enumerable data properties only and validates frozen objects. | performance-enabling / bug fix | JS | 2 behaviour differences found by #227's differential review | low to medium: code that relies on validate's `$identifier` write or on inherited fields | lets the one-call validate fast path apply always | major (narrow) | S–M |
| **BC-28** | plan §3 ("pluggable `options.regExp` stays in JS"); `engine/serializer.ts` (`model-manager-regExp-option`); ledger `StringValidator.getRegex` (stays-ts); lifted MAP.tsv (2 not-liftable rows) | `new ModelManager({regExp})`, a custom engine such as XRegExp, forces the TS path, because the Rust fast path cannot call it. `StringValidator.getRegex()` returns a JS `RegExp`. | Deprecate `options.regExp`. Make `getRegex()` return `{pattern, flags}` (or keep the `RegExp` but build it from Rust's validated source). | removal / API | JS | 2 not-liftable W tests; fast-path bail-out | medium: XRegExp users | Rust validates every regex, and removes a TS-only branch | major | S–M |
| **BC-29** | #226 (`parseNamespace` about 11 µs against 1.8 µs, because of the `semver.parse` host callback); PORTING.md 3.5 | `parseNamespace` returns a node-semver `SemVer` instance, built in JS through a host callback. | Non-breaking first: a pure-Rust check that builds the `SemVer` only when it is read (patch). The breaking alternative, returning plain `{major, minor, patch}`, is not recommended. | performance-enabling | JS | #226 profile | low (non-breaking form) | faster load | patch (recommended form) | S |
| **BC-30** | P5-04 RESULTS.md Table B ("no fast-path batching … future work") | Each model crosses the boundary on its own. | Additive batch entry points (for example a whole-set `addModels` with one crossing). | performance-enabling / API | JS | Table B per-model costs | low | fewer crossings | minor | M |

### 1.5 Design decisions, exceptions and constraints

| ID | Source | Current behaviour | Proposed behaviour | Category | Affects | Evidence | Risk | Benefit | Semver | Size |
|---|---|---|---|---|---|---|---|---|---|---|
| **BC-31** | PORTING.md 1.5 (P4-11a, #115): "Node version" | Rust mode through the public **Node ESM** entry needs synchronous `require()` of `.mjs`, which needs Node ≥ 22.12. `engines.node` is `>=18`. After P5-02 there is no ts mode to fall back to. | Either raise `engines.node` to `>=22.12`, or make the ESM entry load the engine without synchronous `require` (Q3). | packaging | JS (ESM on Node < 22.12) | PORTING.md 1.5, recorded as a known limitation | **high:** ESM consumers on Node 18/20 | – | major | S (floor) / M (loader) |
| **BC-32** | PORTING.md 1.5, maintainer decision on #115; RESULTS.md (module 2.56–2.84 MB) | In rust mode the **browser** ESM graph does not load the engine by itself. A bundler, or a host-supplied synchronous `require`, is needed. The WASM module adds about 2.6–2.8 MB. After P5-02 this is the only mode. | An asynchronous initialisation entry for browsers (for example `await init()`, or top-level await in the browser build), and a documented bundler recipe. | packaging / API | JS (browser) | `e2e/tests/wasm-engine.spec.ts` stands in for the bundler | **high:** browser users without a bundler | – | major | M–L |
| **BC-33** | #198 and #72 gate notes (5846635927, 5846917558) | `ModelManager.getModelFileByFileName()` is typed `ModelFile` but can return `undefined`. The type was pinned to keep the API snapshot byte-identical. | Type it as `ModelFile \| undefined`. | API / type change | JS (TypeScript consumers) | #198 | low | honest types | major (for strict TypeScript consumers) | S |
| **BC-34** | plan §3 ("visitor shells … because tests spy on `visitX`"); lifted MAP.tsv (4 `jsonpopulator` not-liftable rows: `parameters.path` injection, `visit` fallthrough); `migration/api-snapshot` `deepPaths`; §0.5 | `JSONPopulator`, `JSONGenerator` and `ResourceValidator` keep TS visitor shells, and their internals (`parameters.path`, `visitX`) are reachable through deep `src/...` paths that §0.5 kept stable. | Stop supporting deep imports of visitor internals and internal visitor parameters. Only the root exports stay public. | removal | JS | 4 not-liftable W tests; `deepPaths` in the snapshot | medium: unknown deep-import users | lets P5-02-style deletion continue inside the visitors | major | M |
| **BC-35** | ledger (stays-ts): `globalize.ts` `messageFormatter`; P1-05 (Rust owns the templates) | `Globalize` stays public over `messages/en.json`, while Rust owns the same templates. | Deprecate `Globalize`, or generate `en.json` from the Rust catalogue so the two cannot drift. | removal | JS | ledger row | low | one message source | major (removal) / patch (generation) | S |
| **BC-36** | D7; ledger (stays-ts) for `Factory`, `Resource`, `Typed`, `Identifiable`, `Relationship`, `ValidatedResource`, `InstanceGenerator`, `valuegenerator`, `DateTimeUtil` | Instances are dynamic TS objects with dayjs date values. Sample generation uses `Math.random`, randexp and dayjs. | **No change proposed.** Replacing dayjs, or making instances Rust-owned, is a public API redesign. List it as a long-horizon option only (BC-26 covers the performance side). | – | – | ledger rows (177 `TS`/`-` rows; 84 of them are in these D7 files) | – | – | – | – |
| **BC-37** | P5-02 (#73), concerto 70bdeb49e; maintainer decision 2026-09-27 (option 1: accept) | P5-02 deleted the superseded TS decorator-command implementation and regenerated `migration/api-snapshot` (−352/+35 lines). Removed from the published `.d.ts`: the whole `DecoratorExtractor` module and class (never exported from the package root; reachable only by deep import), 11 `DecoratorManager` static helpers (`validateCommand`, `executeCommand`, `applyDecorator`, `applyDecoratorForMapElement`, `migrateAndValidate`, `getDecoratorMaps`, `addDcsWithIndexToMap`, `pushMapValues`, `checkForDuplicateDecorators`, `checkForNamespaceTargetAndApplyDecorator`, `executeNamespaceCommand`), and `processType` on `MapKeyType`/`MapValueType`. The public entry points (`DecoratorManager.decorateModels`, `validate`, `migrateTo`, `extractDecorators`, `extractVocabularies`, `extractNonVocabDecorators`) are unchanged. | **Accepted as shipped (maintainer decision).** The regenerated snapshot is the new baseline. List the removals in the R1 changelog. No shims. | removal | JS | api-snapshot diff 7c2cc6752..c73e6aa8c | low: internal helpers and a deep-import-only module | lets P5-02 remove the TS decorator-command engine | major (R1) | none (already done) |
| **BC-38** | Maintainer decision D1 and Q-14 on accordproject/concerto-rust#249 (conformance review of 2026-09-27, applied in P5-08c #257); CONFORMANCE-PROMOTION-PLAN Q-13, Q-14 | Most concerto exceptions leave `errorType` unset, so it defaults to `DefaultBaseException` (`BaseException` constructor); validators set `DefaultValidatorException` or a specific code. The conformance suite asserts an error class plus an `@rule:<ID>` tag, never message text, and rules that TS raises as a plain `Error` only at the "rejected" level. | Every concerto exception carries a standard `errorType` equal to its `@rule` ID (the concerto-conformance rule IDs, e.g. `CLASS_DECLARATION_007`), in TS and Rust. The conformance suite then gains a step `the error code should be <rule>`, derived from the `@rule` tags, and its `reject(any)` scenarios are strengthened to it. **This item owns the final public code format** (the rule ID verbatim, or namespaced) and any renumbering of the rule IDs (Q-14 of the promotion plan). | error-class or message fix | JS and Rust | the suite's `@rule` tags; `baseexception.ts` default | low: additive, since unset codes default to `DefaultBaseException` today | a portable error code the spec can assert, instead of class-only or rejected-only | minor | M |
| **BC-39** | Maintainer decision Q-15 on accordproject/concerto-rust#249 (applied in P5-08c #257); CONFORMANCE-PROMOTION-PLAN Q-15 | Validator errors are `BaseException`, both at model load (bad bounds, a default value outside its validator) and at instance validation (regex, length, range, size): `Validator.reportError` in TS (introspect/validator.ts:81-82) and `ErrorKind::Validator` in Rust (error/mod.rs:104, `ts_class` `BaseException`). | Load-time validator errors become `IllegalModelException`, and instance violations become `ValidationException`, keeping their `errorType`. Afterwards the conformance suite's validator scenarios, which assert rejection plus `errorType` for now, are strengthened to assert the class. | error-class or message fix | JS and Rust | recorded `BaseException` outcomes (F:conformance/ModelFile.new validator negatives; F:conformance/Serializer.fromJSON/3fd7878b64ffd91a8fdaafd8) | medium: callers that catch `BaseException` by class keep working (both are subclasses), but code that checks `name === 'BaseException'` changes | one error class per phase, as for every other rule | major (a change between two concerto classes) | S–M |
| **BC-40** | Maintainer decision D2 on accordproject/concerto-rust#249 (applied in P5-08c #257); concerto-conformance `scalars.feature` STRING_VALIDATOR_001 (`@skip`) | A string length validator with neither bound (`length=[,]`, or an AST whose `lengthValidator` has neither `minLength` nor `maxLength`) is accepted. TS `StringValidator` reads the bounds with `?.minLength` and tests `=== null`, so an absent (`undefined`) bound slips past the "must be specified" check. Rust copies this in introspect/validators.rs (`length_bound_field`). `NumberValidator` already rejects `range=[,]`. | Reject it, as `NumberValidator` does for `range=[,]`. Then un-skip STRING_VALIDATOR_001. A DIVERGENCES.md row is not needed while TS and Rust agree; the change is to both. | validation strictness | JS and Rust | the skipped conformance scenario; `stringvalidator.ts` bound handling | low: a model with an empty length validator has no effect today | consistent validator rules | major (rejects a model that used to load) | S |

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
| **Needs a major release** | BC-37 (already shipped in R1), BC-39, BC-40, BC-02, BC-04 (until Q6), BC-05, BC-07 (default flip), BC-10, BC-17, BC-19 (with BC-18 and BC-20 folded in), BC-21 extending DV-018, BC-23, BC-24, BC-26 Rust-owned form, BC-27, BC-28, BC-31, BC-32, BC-33, BC-34, BC-35 removal form |
| **Changelog-only: already Rust behaviour, universal at P5-02** | BC-03 (DV-004), BC-07 part (a) (DV-009), BC-13 (DV-015), BC-15 (DV-017), BC-16 (DV-018) |
| **Rust-crate-API-only** (feeds P6-01 #83) | BR-01 to BR-11 |
| **No change proposed** | BR-01, BC-25 (a constraint), BC-36, BC-22 (pending #219) |

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
  - BC-07(c), removing non-strict `DateTime` support (maintainer decision 2026-09-27; only strict ISO 8601 values accepted);
  - BC-39 (validator errors leave `BaseException`) and BC-40 (reject `length=[,]`), both maintainer decisions of 2026-09-27 (#249).
- **Performance and API:**
  - BC-23 and BC-24 (BC-25 is their constraint);
  - BC-27 and BC-28;
  - BC-34 and BC-35 (removal form).

**Dependencies and order inside R3:**
1. **BC-19 first.** It is the prerequisite for BC-25's zero-under-rejection guarantee, and so for BC-23, and it lets BR-09 drop the `Value` fallback.
2. **BC-24** before BC-23 is turned on by default.
3. **BC-23.** It re-uses the unmerged P5-06a prototype (concerto#1373, concerto-rust#231), which first needs the integration head merged in (#226, comment 5849126577).
4. **BC-27** before the #227 fast path is revived (concerto-rust#232, concerto#1374, kept for reference).

**Tie to the P5-02 outcome:**
- If P5-02 keeps the hybrid TS construction, as #67 decided, BC-23 is where most of the remaining load gap closes. #226 measured the non-breaking variant at 2–3×, and parity needs crate work as well: BR-09, allocation, and so on.
- If the P5-02 chunks delete the TS graph outright, BC-23 is partly done by P5-02, and R3 carries only its API consequences: identity, getters and mutation.

**Size:** BC-19 L, BC-23 L, the rest S–M.

### RB: Rust crate 1.0 (P6-01 #83 onward)

**Contents:** BR-02 to BR-10, in the order of public-api.md §7:
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
| BC-07 | R1: a changelog entry only. R2: warn whenever a non-strict date form is accepted. R3: remove non-strict parsing. | `strictQualifiedDateTimes` (existing); in R3 its lenient mode is removed and `false` is rejected or ignored with a warning | R1: "Date strings outside ISO 8601 and the simple numeric forms are no longer accepted when `strictQualifiedDateTimes` is false." R3: "Only strict ISO 8601 `DateTime` values are accepted. Non-strict date parsing, and the lenient mode of `strictQualifiedDateTimes`, are removed." |
| BC-10 | – | none | "`±Infinity` is rejected for Integer and Long fields during deserialisation, even when validation is off." |
| BC-13 | – | none | "A non-string `$class` in an instance is rejected with `Error: a $class that is not a string: …`. It used to throw a `TypeError`, or, for an array, a `TypeNotFoundException`." |
| BC-15 / BC-16 | – | none | "A relationship without a type, or a `null` decorator, is rejected with an `IllegalModelException` instead of a `TypeError`." |
| BC-17, BC-18, BC-19, BC-20 | R2: `ModelManager` option `strictAst` (default false) that runs the metamodel shape check on load, with a warning when it would reject. R3: flip the default. | `strictAst` (or re-use `metamodelValidation`, Q10) | "Models are checked against the Concerto metamodel when they are loaded. Malformed ASTs that used to load, or that failed with a `TypeError`, now fail with an `IllegalModelException`. Set `strictAst: false` to restore the old behaviour for this major." |
| BC-21 (extended) | – | covered by `strictAst` | "Non-object decorators are rejected." |
| BC-23 | R2: an opt-in `lazyViews` option, with the #226 check mode as a debugging aid. Deprecate mutating `declarations` and `properties` arrays (warn in dev builds). | `lazyViews` (opt-in in R2, default in R3, removed in the major after) | "Declarations and properties are views over the engine and are built on first access. Treat them as read-only. Mutating returned arrays or fields is no longer supported." |
| BC-24 | Deprecate synchronous side effects in `DecoratorFactory.newDecorator`. Add a post-load hook in R2. | none | "Decorator factories run when a decorator is first read, not while the model loads." |
| BC-26 (Rust-owned) | Only after the additive entry point has one major of uptake. | – | – |
| BC-27 | Warn in R2 when `validate()` would write `$identifier` or read an inherited field. | none | "`Resource.validate()` no longer modifies the resource, and reads only its own properties. Frozen resources can be validated." |
| BC-28 | Deprecate `options.regExp` in R2, with a warning. | `options.regExp` is kept until R3 (on the TS-fallback path). | "The `regExp` option is removed. Regular expressions are evaluated by the Concerto engine. `StringValidator.getRegex()` returns `{pattern, flags}`." |
| BC-31 | Announce in the R1 pre-release. | none | "concerto-core requires Node 22.12 or later." (Or: "the ESM entry loads the engine asynchronously", Q3.) |
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
2. A follow-up for DV-009's default flip (BC-07).
3. A DIVERGENCES row plus a follow-up for BC-17 (see 5.2).
4. BC-19, the design of strict AST loading.
5. BC-23 and BC-24, handle-backed views.
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
- **Q2. One major or two?** Recommended: two. R1 is "same behaviour, new engine, plus packaging", and R3 is "strict models and fast views", to keep risk apart. The alternative is to fold R3 into R1, so users take one major, but a regression is then harder to attribute to the engine switch or to the new strictness.
- **Q3. BC-31: raise `engines.node` to 22.12, or build an asynchronous ESM loader** so Node 18/20 ESM consumers keep working? Node 18 and 20 are past end of life by 2026, which argues for raising the floor.
- **Q4. Follow-up issues.** Should the follow-up issues in section 4 be filed now (P5-07 may not file them), and should they carry `mig:post-migration`?
- **Q5. BC-02 (DV-003).** Should `parseNamespace` enforce v4 versioning, or is accepting an unversioned namespace intended (for `strict: false` users), in which case DV-003 closes as "keep"?
- **Q6. BC-04 (DV-006).** Record fixtures first, to show whether the fix only ever accepts more? If it does, it drops to minor.
- **Q7. BC-07 (DV-009).** ~~Should the non-strict date path be kept in R3, with its default flipped, or removed outright?~~ **Answered 2026-09-27: removed outright; the Rust engine will not support non-strict `DateTime` values.**
- **Q8. BC-09 (DV-011).** Is a map value's `$identifier` part of any serialised or public output? If it is, the fix is major.
- **Q9. BC-21.** For a non-object decorator (`[7]`), port TS's acceptance (a faithful patch), or extend DV-018's clearer rejection (a maintainer-accepted exception)?
- **Q10. BC-19.** Should strict AST loading reuse the existing `metamodelValidation` option, or get a new name? Should R2 ship it opt-in, with the default flipped in R3?
- **Q11. Evidence gaps.** The independent review should spot-check review comments on merged migration PRs for "out of scope" notes this plan may have missed (5.1). Should the plan also be refreshed when #219 closes (BC-22)?
- **Q12. Sequencing.** The coordinator's order on #73 was P5-02, then P5-06d, then P5-07, while this issue says "runs now". This plan was written now, from records only. Should it be re-checked after P5-02 lands, because P5-02 may make BC-23 moot?

---

## 7. Claims confirmed against the current code

Only recorded claims were checked. No finding was re-derived.

- `DIVERGENCES.md` at concerto-rust `78566e7` has exactly DV-001 to DV-018, with the text quoted above.
- The `mig:post-migration` label lists exactly 10 issues: #127, #136, #137, #138, #172, #179, #184, #185, #186 and #187.
- `concerto-core/src/introspect/decorator.rs` `parse_decorators` documents the per-code-unit port (BC-17 and 5.2), and no `DV-` marker appears there.
- `packages/concerto-core/src/engine/serializer.ts` bails out of the fast path on `options.regExp` (`model-manager-regExp-option`) (BC-28).
- `packages/concerto-core/package.json` has `engines.node` `>=18` (BC-31).
- `migration/fuzz/results/stage2/divergence-summary.json` `by_class_pair` gives the `ts=TypeError` totals quoted in BC-18.
- `migration/ledger/SEAM_LEDGER.tsv` has 177 rows classified `TS` with planned task `-` (stays-ts).
