# P5-08: Plan for promoting oracle and fuzz cases into concerto-conformance

Task: accordproject/concerto-rust#247 (P5-08). Plan: accordproject/concerto-rust#29.
Feeds P6-01 (accordproject/concerto-rust#83) as the language-neutral contract for the
core crate.

This is a planning document. It was written **from existing records only**: the
oracle corpus and its manifests, the P5-05 fuzz records, the P2-11b supplement,
DIVERGENCES.md, the P5-07 breaking-changes plan, the gate report and the current
concerto-conformance suite. No behaviour was re-derived from code, and no repository
other than this file was changed. concerto-conformance is untouched.

## 0. How to read this

### 0.1 Sources and snapshots

| Record | Where | Snapshot used |
|---|---|---|
| Oracle corpus | `migration/oracle/fixtures/` (pinned `oracle-corpus-p107-06aa375` plus `supplement/` from `oracle-corpus-supplement-d842c0ab7`) | 16,242 fixtures: unit 4,082, data 10,231, conformance 815, gaps 658, lifted 299, supplement 157 |
| Corpus manifests | `fixtures/manifest.json`, `fixtures/supplement/manifest.json`, `migration/oracle/SUPPLEMENT.md` | as extracted |
| Owner report | `migration/gate/reports/2026-09-27T04-00-19-777Z/report.md` (concerto) | 13,921 pass, 0 fail, 2,321 unsupported: stays-ts 2,121, P2-08+P4-08 172, P3-04+P4-08 17, P2-03+P4-05 11 |
| Seam ledger | `migration/ledger/SEAM_LEDGER.tsv` | concerto `c4793e9f6` |
| P5-05 fuzz | `migration/fuzz/TRIAGE.md`, `migration/fuzz/results/stage2/triage-clusters.json` (1,086 clusters) | concerto `c4793e9f6` |
| Fuzz follow-ups | concerto-rust #217, #218, #219, #241, #244 (all closed) | read 2026-09-27 |
| Supplement follow-ups | concerto-rust #190, #193 to #201 (all closed) | read 2026-09-27 |
| DIVERGENCES.md | concerto-rust `claude/tender-pascal-ocwf9q` | `114401e`, DV-001 to DV-019 |
| P5-07 plan | concerto#1376, `migration/BREAKING-CHANGES-PLAN.md` on `claude/tender-pascal-ocwf9q-cloud-3-P5-07` | BC-01 to BC-36, BR-01 to BR-11, Q1 to Q12 |
| concerto-conformance | `origin/main` | `9339642`: 81 semantic + 15 validate = 96 scenarios (corrected in P5-08b; the first version said 60 + 15 = 75) |

### 0.2 Citation conventions

- `F:<source>/<op>/<id>` is an oracle fixture, at
  `migration/oracle/fixtures/<source>/<op>/<id>.json`. Where a behaviour has many
  fixtures, one to three are cited and the count is given.
- `Z:#n` is `clusters[n]` (zero-based) in
  `migration/fuzz/results/stage2/triage-clusters.json`, with its minimised
  reproducer (seed file plus edit list).
- `DV-nnn` is a DIVERGENCES.md row (concerto-rust). `BC-nn`/`BR-nn`/`Q-P7-n` are
  P5-07 rows and questions.
- `CS:<feature>:<scenario>` is an existing concerto-conformance scenario.

### 0.3 Assertion vocabulary

Every promoted assertion is one of these. **None uses TS message text.**

- `accept`: loading and validating succeeds (existing step "no error should be
  thrown", or "the validation should succeed").
- `reject(<Class>)`: fails with an error of that **class**. Classes are the
  cross-implementation exception names that the TS reference, the Rust crate
  (`ErrorKind`/`ts_class`) and the recorded outcomes already share:
  `IllegalModelException`, `ValidationException`, `TypeNotFoundException`,
  `MetamodelException`. `ParseException` is used only where the input is CTO text
  (see exclusion X-06).
- `reject(any)`: fails, and the class is **not** normative yet. Used where TS
  raises a plain `Error`, a `BaseException`, or a V8 `TypeError`/`RangeError`
  for what is a spec rule. Each one links an open question in section 3.
- `@rule:<ID>`: the scenario's rule tag. Existing rule IDs are the
  concerto-conformance folder names (`CLASS_DECLARATION_005` and so on). New IDs
  are **proposed** here and follow the same pattern; the maintainer confirms them.
- `mentions(<model name>)` (optional): the message contains a name that comes
  **from the model or instance** (a type, property or namespace), never prose. Used
  only where the rule is about naming the offender.

### 0.4 Dispositions

- **promote**: spec-worthy, language-neutral, assertion as given.
- **promote (pending Q-n)**: spec-worthy, but the expected result depends on a
  maintainer answer in section 3. The scenario is written with `@pending-Qn` so
  runners skip it until the answer lands.
- **strengthen**: an existing scenario covers the behaviour; the change is to its
  assertion (class and rule instead of message text) or to its fixture.
- **exclude**: not promoted, with the reason (section 2 has the general classes).

---

## 1. Candidate list

Counts in the right-hand column of each area header are **new scenarios** proposed
(a positive/negative pair counts as two), as recomputed in P5-08c (section 4.2).

### 1.A Concepts and declarations: `semantic/features/concepts.feature` (+14)

| ID | Source | Behaviour (spec terms) | Assertion | Disposition |
|---|---|---|---|---|
| CON-01 | F:supplement/ModelManager.fromAst/9224ce1df87976aca5fb67d0 (#190 supplement, "a class declaration that extends itself") | A class declaration must not name itself as its super type. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_009 mentions(A)` | promote. Direct self-extension is a domain error in TS; contrast CON-12. |
| CON-02 | F:data/ModelManager.addCTOModel/04e93b56c320a77d8460c8d1 (8 data fixtures); F:unit/ModelManager.addCTOModel/34a90351b1d3f5cac1399cec | When a super class declares an explicit identifier (`identified by f`), a subclass must not declare its own `identified by`. Positive pair: subclass without `identified by` inherits it. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_011` (new) | promote |
| CON-03 | F:data/ModelManager.addCTOModel/6c5d39ee273d4809465f968e (4); F:unit/ModelManager.addModelFile/dc07549b7de716a452f0348a | `identified by f` requires a property `f` on the class or a super class. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_005 mentions(f)` | promote. `CS:concepts:Identifier field is not of type String or scalar` covers the wrong **type**, not the missing field. |
| CON-04 | F:data/ModelManager.addCTOModel/322940c4c551adcf3c670b4f (4); F:unit/ModelManager.addModelFiles/79db563bb1bff7b2050fa72b | A declaration may only extend a declaration of the same kind (a participant cannot extend an asset). Positive pair: asset extends asset. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_012` (new) | promote |
| CON-05 | F:unit/ModelManager.addCTOModel/78dbcdf668d182b06ed8dda8; F:gaps/ModelManager.fromAst/19622251d12f84f178484b75, ab6fa284e3042cf23740ea97 | Reserved system field names other than `$class` (here `$identifier`) cannot be declared as properties. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_001 mentions($identifier)` | promote. `CS:concepts:Property name uses system-reserved name` covers `$class` only. |
| CON-06 | F:data/ModelManager.addCTOModel/019573ce4a7402a1b62036a0 (4); F:supplement/ScalarDeclaration.validate/91f0bfe1c8da7d4a86575afe (#197) | Declaration names are unique across **all** declaration kinds in a file, scalars included. | `reject(IllegalModelException) @rule:DECLARATION_001` | promote. Existing DECLARATION_001 scenarios cover concept/enum/map pairs, not scalars. |
| CON-07 | F:supplement/ModelManager.fromAst/7b02e626a0a226bde3b810e6 (#193) | A class declaration must carry a properties list (an absent `properties` is invalid). | `reject(IllegalModelException) @rule:CLASS_DECLARATION_013` (new) | promote, the **absent** case only. JSON-AST-only scenario (not expressible in CTO). The non-list variant (F:supplement/ModelManager.fromAst/000dab841e9b0cef97e8826f, `"properties": "none"`) waits on Q-10 (maintainer decision D4a, P5-08c). |
| CON-08 | F:unit/ModelFile.new/ba4f62fc881f4ee9b9a96fb4 (2) | A model element whose `$class` is not a metamodel declaration type is rejected. | `reject(IllegalModelException) @rule:MODEL_ELEMENT_003` (new) | promote. JSON-AST-only. |
| CON-09 | F:supplement/Resource.validate/1704f2f065f42e186ec9096b (#190 "validate a derived asset") | A declaration that extends a concrete declaration and adds fields loads and validates. | `accept` | promote (positive coverage for CON-04). |
| CON-10 | F:conformance/ModelManager.addCTOModel/d85b28076a8ece00c558322c; F:conformance/ModelManager.validateModelFiles/b25d9dd5f7e2162ef0a0b2ee (DV-013) | A longer inheritance cycle (`A extends C`, `B extends A`, `C extends B`). | TS: V8 `RangeError`. Proposed: `reject(IllegalModelException) @rule:CLASS_DECLARATION_009` | **promote (pending Q-01)**; replaces `CS:concepts:Unique property names across inheritance` (circular), which asserts V8's `Maximum call stack size exceeded`. |
| CON-11 | `CS:concepts` rows asserting `Duplicate class name`, `Could not find super type`, `Identifying fields cannot be optional`, `has more than one field named`, `cannot be to the primitive type`, `Undeclared type`, `must be to a class that has an identifier`, `Duplicate decorator`; recorded TS outcomes in F:conformance/ModelManager.addCTOModel/* (e.g. 46bbc092704f9d77b15b5e44, 5f5ecb257b9091ed8c97f7f4, ea5cf69658fce182a0b92cbd, 55beeb0ad10954524d4a6990, bf41bb5cddb1d3de1339f550) | Already specified. | Change each to `reject(IllegalModelException) @rule:<folder>` | **strengthen** (batch 0). The recorded class is `IllegalModelException` in every case. |
| CON-12 | Z:#443 (#218 cluster #6, `superType.name = ""`, 3 cases); #217 review (`superType.name` of `0`/`false`) | A super type reference with an empty name. | `reject(IllegalModelException) @rule:CLASS_DECLARATION_004` for `""` only | promote the empty-string case. The `0`/`false`/non-string variants are JS coercion (exclude, X-02). |

### 1.B Identifiers and names: new `semantic/features/identifiers.feature` (+14)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| IDN-01 | F:unit/ModelUtil.isValidIdentifier/f803bb772273772d782c8927 (`1st`), ea8308fef78b0e065847f858 (`2nd`); #219 cluster 1 (TS records `IllegalModelException` for an invalid property name in a JSON AST) | An identifier must not start with a digit. Applied to a declaration name and a property name in a **JSON AST** (the CTO parser rejects it earlier, X-06). | `reject(IllegalModelException) @rule:MODEL_ELEMENT_002` | promote; also replaces the vacuous `CS:concepts:Invalid identifier should throw` and `CS:enums:Invalid enum identifier name should throw an error` (FIX-01). |
| IDN-02 | F:unit/ModelUtil.isValidIdentifier/183076801c054024763a587a (`"null"`), 468f923bf034b4b525585c82 (`property`), caba14b152502469c5846f0f (`field`), e6950fdea351d9a0ad4938a1 (`MapPermutation1`), 0692921295a1df144f9d9e6c (`suchName`) | Words that are keywords elsewhere (`null`, `property`, `field`) and letter-digit mixes are valid identifiers. | `accept` | promote |
| IDN-03 | Z:#1 (2,637 cases, `properties[0].name = true`), Z:#5, #219 cluster 1 (`name = 1e+308`) | A property or declaration `name` that is not a string in the JSON AST. | `reject(any)` only after Q-10 | **exclude now**: TS coerces with JS `ToString` and may accept (`true` → `"true"`), BC-19/BC-20. Re-open with Q-10. |
| IDN-04 | F:unit/ScalarDeclaration.new/00885bec98ea8d2a0e34fd40 (7 fixtures) | A scalar cannot be named after a primitive type (`String`, `Integer`, ...). | `reject(IllegalModelException) @rule:SCALAR_DECLARATION_001` (new) | promote |
| IDN-05 | F:supplement/ModelManager.fromAst/20cab432f80aacba5f4dfebc, f7738249d209270e5ddcfd06 (#190) | An import alias (`import ns.{A as X}`) cannot use a primitive type name as `X`. | `reject(any) @rule:MODEL_FILE_005` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**: TS raises plain `Error`. Also gated by the aliased-type option (#201). |
| IDN-06 | F:unit/ModelUtil.isValidIdentifier/69180a304acffbfb4c5dd2b9 (`undefined`), ddc54fdc16555fd15439a76d (`null`) (DV-002) | `isValidIdentifier(undefined/null)` is `true` in TS. | – | **exclude**: JS-only value (X-01) and a ts-bug (DV-002, BC-01). |
| IDN-07 | F:unit/ModelUtil.isSystemProperty (28), isPrivateSystemProperty (16) | Classification of `$`-prefixed names. | – | **exclude as API**: observable only through CON-05 and INS-03, which are promoted. |

### 1.C Namespaces and imports: `namespaces.feature`, `imports.feature` (+7)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| NSI-01 | F:unit/ModelUtil.parseNamespace/3c5887ca887124a8249dc174, 678eb2b91e38201e6a460c9b | A namespace's version part must be a valid semantic version (`org.acme@1.0.0@1.0` is invalid). At model level: a model declaring such a namespace is rejected. | `reject(any) @rule:MODEL_FILE_006` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**: TS raises plain `Error`. |
| NSI-02 | F:unit/ModelManager.addCTOModel/dff6288d1748aae8732f0cf6; F:data/ModelManager.addModelFiles/05b994249953c6afb4c0582b (17 total) | A namespace can be declared by only one model file in a model manager. | `reject(any) @rule:MODEL_FILE_007` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)** (plain `Error`). |
| NSI-03 | F:unit/ModelManager.addCTOModel/9e5e6711f71f710ff7b1cd47; F:data/ModelManager.addCTOModel/0354581253696eeff2ca6a05 (11) | An import must name a versioned namespace. | `reject(any) @rule:MODEL_FILE_008` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**. The `strict` option no longer exists in TS 5.0.0, and the check is unconditional (as cited in the #249 decision record: modelfile.ts:954-964; Rust model_file.rs:150-182). |
| NSI-04 | F:gaps/ModelManager.fromAst/474a585e4c374ad3df5eee85 (2) | Wildcard imports are not permitted. | `reject(any) @rule:MODEL_FILE_008` | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**. Unconditional in TS 5.0.0 and Rust, as for NSI-03. |
| NSI-05 | F:unit/ModelManager.addCTOModel/562a1f000f083a9b744e2130 | Importing a type that a **registered** namespace does not declare. | `reject(IllegalModelException) @rule:MODEL_FILE_001 mentions(<type>)` | promote. The existing MODEL_FILE_001 negative imports from an unregistered namespace. |
| NSI-06 | F:conformance/ModelManager.validateModelFiles/4e0f26af45608f309e43c501, 25e175debc5ce969a48303c1, 16acea074776a658b06bcf51 | A local declaration may not share a name with an imported type. | `reject(IllegalModelException) @rule:DECLARATION_002` | **strengthen**: un-skip `CS:imports:Conflict with imported type name…` and `CS:enums:Enum name conflicts with imported enum…` (both `@skip`). They assert text TS never emits (`already defined in an imported model`); the recorded class is `IllegalModelException`. |
| NSI-07 | F:conformance/ModelManager.addCTOModel/c1b2125619408b3b8b968ce8, 2508a0abf956fe0c010e25c8 | Self-import, and duplicate namespace imports. | `reject(IllegalModelException) @rule:MODEL_FILE_003` / `MODEL_FILE_002` | **strengthen**: un-skip `CS:namespaces:Invalid self-import…` (`@skip`); re-derive the expected class for `CS:namespaces:Invalid duplicate namespace imports…`, `CS:namespaces:Invalid duplicate declared names…` and `CS:imports:Duplicate namespace imports…` (all `@skip`) from their recorded conformance fixtures when the JSON ASTs are regenerated (FIX-01). |
| NSI-08 | DV-019, #241 (2 clusters, 3 cases; `imports[0].name = 'Vehicle../../etc'` on `data/ModelManager.fromAst/6287c8da05a81a766dd6845b.json`) | An import whose synthesised namespace is both unregistered and not a valid versioned namespace. | TS: plain `Error("Invalid namespace…")`. Proposed: `reject(any) @rule:MODEL_FILE_001` | **promote (pending Q-12)**: only the fact of rejection is spec-worthy; which rule fires first is a TS call-order accident. |
| NSI-09 | DV-003, BC-02 | A model whose namespace is unversioned is rejected. | `reject(any)`, per Q-13 | **promote (B3a; Q-05 answered: spec as TS does)**. Sources as cited in the #249 decision record: TS modelfile.ts:935-937 and basemodelmanager.ts:473-475; Rust model_file.rs `parse_namespace_version`. `parseNamespace` itself stays out (X-04). |
| NSI-10 | F:unit/ModelFile.new/dc0ef89942425c45c7355ab7; F:data/ModelManager.addCTOModel/45b0885055ae0f33b95d7126 (5) | `concerto version "…"` pragma checked against the implementation's version. | – | **exclude**: implementation-specific (each runtime has its own version, X-07). |

### 1.D Scalars, validators and collection sizes: `scalars.feature`, `collections.feature` (+6)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| SCV-01 | F:gaps/ModelManager.addCTOModel/600a2c246ae04367d123921d (`Value 100 is outside upper bound 10`), 6a6c169b79c3ef6b2c46fe35 (`outside lower bound 5`) | A numeric property's **default value** must satisfy its range validator. | `reject(any) @rule:NUMBER_VALIDATOR_004` (new) | **promote (B3a; Q-15 answered: `reject(any)` plus `errorType` plus `@rule`)**: TS class is `BaseException`. |
| SCV-02 | F:lifted/ModelManager.addCTOModel/354eab10434833df4a39a288 (SV-CTOR-008, `default="abcdefgh" length=[2,5]`) | A string property's default value must satisfy its length validator (and, by the same rule, its regex). | `reject(any) @rule:STRING_VALIDATOR_005` (new) | **promote (B3a; Q-15 answered: `reject(any)` plus `errorType` plus `@rule`)**. |
| SCV-03 | F:unit/ModelManager.addCTOModel/dee4955adbadd1782b484242 (2); Z:#44 (148 cases, `sizeValidator = true`) | A size validator must specify `minSize` and/or `maxSize`, each a non-negative integer. | `reject(any) @rule:COLLECTION_SIZE_007` (new) | **promote (B3a; Q-15 answered: `reject(any)` plus `errorType` plus `@rule`)** for the CTO-expressible cases (negative bound, no bound). The non-object `sizeValidator` shape is X-02/Q-10. |
| SCV-04 | F:unit/ModelManager.addCTOModel/09417161f15aa2959543e498, 2a3b94ed1d94fecba05cc8bc, ac1c2a58754f35a2fa8e32b5 | A size validator on a non-collection property. | `reject(IllegalModelException) @rule:COLLECTION_SIZE_006` | **strengthen** `CS:collections:should throw when size validator is applied to non-collection property`. |
| SCV-05 | Z:#58 (118 cases, `validator.pattern = ["("]`); TRIAGE.md stage 1 (`Invalid regular expression: /(/: Unterminated group`, 124 cases now agreeing) | A `regex` validator whose pattern is not a valid regular expression makes the **model** invalid. | `reject(any) @rule:STRING_VALIDATOR_004` | **promote (pending Q-16)** for a syntactically bad **string** pattern such as `(`; the array-valued pattern is X-02. Replaces the vacuous `CS:scalars:should pass for valid regex pattern` (FIX-02). |
| SCV-06 | F:conformance/ModelFile.new/bdb431e0cda8fe58f6290730, bf2720822629387877f85dec, ce3c3765f776df2457fa2172, ea6dd9f821792570a3270f48 | Existing negative validator scenarios (negative lengths, swapped bounds, invalid size). | `reject(any)` plus `errorType` `@rule:<folder>` | **strengthen** (Q-15 answered): recorded class is `BaseException`; drop the message text and assert the error type, not the class. |
| SCV-07 | #219 continuation (2 clusters, 30 cases: `sizeValidator.maxSize=[1]`, `lengthValidator.minLength='__proto__'`) | Validator bounds of a non-numeric JSON type. | – | **exclude**: TS compares with JS relational semantics (X-02). Covered by Q-10 (strict AST). |
| SCV-08 | `CS:scalars:should throw for no number bounds`, `…empty string length bounds`, `Invalid floating point range on Integer…` | Existing negatives whose JSON ASTs are missing (they pass vacuously). | per section 1.P | see FIX-01. P5-08c (maintainer decision D2): the NUMBER_VALIDATOR_003 negative is dropped (its text exists in no runtime and its `.cto` does not parse); STRING_VALIDATOR_001 stays `@skip`, in the D1 form, until the `length=[,]` follow-up (BREAKING-CHANGES-PLAN BC-40) lands. |

### 1.E Maps: `maps.feature` (+4)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| MAP-01 | F:data/ModelManager.addCTOModel/0346e9576d6ac88a3b8bd013 (40); F:unit/MapDeclaration.validate/0052fa8c025147afa24d60dc (7) | A map key may be `String`, `DateTime`, or a scalar of either; a scalar of any other base type is invalid as a key. | `reject(IllegalModelException) @rule:MAP_KEY_TYPE_001` | promote (JSON AST). The existing negative (`o Double` key) has no JSON AST and passes vacuously (FIX-01). |
| MAP-02 | F:unit/MapDeclaration.validate/c6c3d676d2dcc40a2afb100e | A map declaration cannot be a map's value type. | `reject(IllegalModelException) @rule:MAP_VALUE_TYPE_002` (new) | promote |
| MAP-03 | F:gaps/ModelManager.fromAst/52f8a94d983f4877bf41fa81 (2); Z:#22 (302 cases, key set to `0`) | A map declaration must have both key and value. | `reject(IllegalModelException) @rule:MAP_DECLARATION_002` (new) | promote the **absent** key/value case (JSON AST). Wording differs between engines (#219 cluster 22), so class only. |
| MAP-04 | F:conformance/ModelManager.addCTOModel/86d8728f782c4378437d2daf (DV-014) | A map whose value type is undeclared. | TS: V8 `TypeError … reading 'isMapDeclaration'`. Proposed: `reject(IllegalModelException) @rule:MAP_VALUE_TYPE_001` | **promote (pending Q-02)**; replaces `CS:maps:Non-existent map value type should throw error`, which asserts `Cannot read properties of null`. |
| MAP-05 | `CS:maps:Duplicate map names should throw error` (`@skip-rust`) | Duplicate map names. | `reject(IllegalModelException) @rule:DECLARATION_001` | **strengthen** and re-evaluate the Rust skip with a class assertion. |

### 1.F Decorators: new `semantic/features/decorators.feature` (+5)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| DEC-01 | F:unit/ModelManager.validateModelFiles/63b2562dda3a5fb8e15036e1 and 11 more `Decorators #validate` / `ModelManager #validateDecorators` fixtures (DV-016) | With decorator validation on (`missingDecorator: error`), a decorator whose name is not a declared decorator type is rejected. | `reject(IllegalModelException) @rule:DECORATOR_001` (new) | promote. DV-016's doubled `File` suffix is message-only, so the class assertion is unaffected. |
| DEC-02 | F:unit/ModelManager.validateModelFiles/0c3b211ea1cddf829787c629 | With decorator validation on, a decorator argument of the wrong type is rejected. | `reject(IllegalModelException) @rule:DECORATOR_002` (new) | promote |
| DEC-03 | Same fixture family, `ok` outcomes (F:unit/ModelManager.validateModelFiles, `Decorators #validate` titles) | With decorator validation on, a decorator that matches its declared type loads. With it off (the default), an undeclared decorator loads. | `accept` | promote (two scenarios). |
| DEC-04 | F:data/ModelManager.addCTOModel/04b7a07dd73b019e96957310 (`@bar("participant") @bar` on an asset); F:unit/ModelManager.addCTOModel/c817139770344eff584e8d23 | Duplicate decorator on one element. | `reject(IllegalModelException) @rule:DECORATED_001` | **strengthen** `CS:concepts:Duplicate decorator should throw`: the recorded fixtures are declaration-level, which the suite already covers, so no new scenario. |
| DEC-05 | DV-018 (maintainer-accepted); reproducers on `conformance/ModelManager.addModelFile/351e0846b6d348c39f164cc6.json` (`decorators = [null]` at model, declaration, property) | A `null` element in a `decorators` list is invalid. | TS: V8 `TypeError`. Rust: `IllegalModelException`. Proposed: `reject(IllegalModelException) @rule:DECORATOR_003` (new) | **promote (pending Q-03)**, `@since-R1`: the TS reference fails it until the engine switch (BC-16). |
| DEC-06 | Z:#73 (#218 cluster #1, 97 cases, `decorators = "💥emoji"`); BC-17 | A `decorators` value that is a string rather than a list. | – | **exclude until Q-04**: TS iterates it per UTF-16 code unit (X-02). |
| DEC-07 | #218 final comment follow-up 2; BC-21; Q-P7-9 | A non-object decorator element (`[7]`). | – | **exclude until Q-04**. |

### 1.G Metamodel and JSON AST shape: new `semantic/features/metamodel.feature` (+5)

These scenarios load **JSON ASTs only**, since the shapes cannot be written in CTO.

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| AST-01 | F:unit/ModelManager.addModel/6b183dd04a82a63d693b6d35; F:data/ModelManager.addCTOModel/d960773dc1add363ea2a8891 (2) | With metamodel validation on, an AST node carrying a property the metamodel does not declare (e.g. `defaultValue` on a `DateTimeProperty`) is rejected. | `reject(MetamodelException) @rule:METAMODEL_001` (new) | promote; needs the options step. |
| AST-02 | F:unit/ModelManager.addModel/75ea10eea76396079fe879ff | An AST whose metamodel version does not match the implementation's metamodel version is rejected. | `reject(MetamodelException) @rule:METAMODEL_002` (new) | promote |
| AST-03 | DV-017 (maintainer-accepted); Z:#78, #91, #185, #270 (#218 clusters #2 to #5, 187 cases) | A `RelationshipProperty` with no `type`, or a `null` one. | TS: V8 `TypeError`. Rust: `IllegalModelException`. Proposed: `reject(IllegalModelException) @rule:RELATIONSHIP_004` (new) | **promote (pending Q-03)**, `@since-R1` (BC-15). |
| AST-04 | CON-07, CON-08, MAP-03 | See those rows. | – | listed there. |
| AST-05 | Z:#0, #2, #6, #7, #8 (#217/#219: `identified = true`, `name = ["LocalType"]`, `superType = "__proto__"`, ...), 38,609 T2 cases in total | Structurally malformed ASTs (wrong JSON type for a field). | – | **exclude until Q-10**: TS's outcome depends on JS coercion and prototype lookups (X-02). The strict-AST decision (BC-19) decides whether a later metamodel scenario asserts `reject(MetamodelException)` for all of them. |

### 1.H Instance validation, structure: `validate/features/structure.feature` (new file, +9)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| INS-01 | F:unit/Serializer.fromJSON/8de154e6fa23e9e01ebc7740 | An instance object without `$class` is rejected. | `reject(any) @rule:INSTANCE_001` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)** (plain `Error`). |
| INS-02 | F:unit/Serializer.fromJSON/7eef0467c9736d911a423e4a, da7770373053efbcd3651cab, 853af8b9ef7b95224e8881ce; F:data/Serializer.fromJSON/05598770d4c6f12c4d5dcf8e (81 with this template) | A property the type does not declare is rejected. | `reject(ValidationException) @rule:INSTANCE_002 mentions(<property>)` | promote |
| INS-03 | F:unit/Serializer.fromJSON/4265ea5776f0744ece6cfaf3 (`$timestamp`), 4f5727758ee6ebaeb5aba2dc (reserved `$…`) | A reserved system property that the type does not allow is rejected. | `reject(ValidationException) @rule:INSTANCE_002` | promote |
| INS-04 | F:unit/Serializer.fromJSON/733af204effc067b07a2835b (11); F:supplement/Serializer.toJSON/eac548ead8fcba3e69860691 | A missing required field is rejected. | `reject(ValidationException) @rule:INSTANCE_003` | **strengthen** `CS:validate:Missing required field should fail` (add class). |
| INS-05 | F:gaps/Resource.validate/d2358f8a29e58042f7c2de82 (2) | An instance whose `$class` is abstract is rejected. | `reject(any) @rule:INSTANCE_004` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**, re-expressed (see 4.1). P5-08b: the instance-JSON form raises a plain `Error` ("Cannot instantiate the abstract type") in TS 5.0.0 and in rust mode, not the recorded `ValidationException`, so it moved from B2 to B3. |
| INS-06 | F:lifted/Serializer.fromJSON/6166a93ac060da7b83c35154 (JP-IT-001); F:data/Serializer.fromJSON (TypeNotFound family) | `$class` naming an undeclared type. | `reject(TypeNotFoundException) @rule:INSTANCE_005` | **strengthen** `CS:validate:Non-existent $class type should fail`. |
| INS-07 | F:unit/Serializer.fromJSON/c373d8970e5aa90866d4d02b, d0036c7cb4de10575d1d53d3 | An instance whose `$class` is an enum or a map declaration cannot be created. | `reject(any) @rule:INSTANCE_006` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**. |
| INS-08 | F:gaps/Factory.newConcept/1b570a045e1f39095db3bddd (4, "Model is recursive") | A recursive model for instance generation. | – | **exclude**: `Factory`/instance generation is stays-ts (X-03). |
| INS-09 | DV-015 (maintainer-accepted), TRIAGE T1a/T1b (46,844 cases); `data/Serializer.fromJSON/05598770d4c6f12c4d5dcf8e.json` with `$class: true` | A non-string `$class` is rejected. | Proposed: `reject(any) @rule:INSTANCE_001` | **promote (pending Q-06)**, `@since-R1`. TS crashes or raises `TypeNotFoundException` for an array. |

### 1.I Instance validation, primitive types and dates: `validate/features/primitives.feature` (+17)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| PRM-01 | F:lifted/Serializer.fromJSON/707218a446c96228c2f1dae0 (JP-CV-020), cdb265c14bad738f749b0062; F:gaps/Serializer.fromJSON/1aa31f090ed15792e0b30485 | A non-number for a `Long` field is rejected. | `reject(ValidationException) @rule:INSTANCE_010` (new) | promote. Note: both lifted fixtures were recorded with `{validate: false}` (the type check is the populator's, not the validator's); the scenario uses default options, as in the gaps fixture. |
| PRM-02 | F:lifted/Serializer.fromJSON/f06744c7e6fa3441835e266f (JP-CV-021); F:gaps/Serializer.fromJSON/dd8a2934832696c1b29dabd4 | A non-number for a `Double` field is rejected. | `reject(ValidationException) @rule:INSTANCE_010` | promote |
| PRM-03 | F:lifted/Serializer.fromJSON/7501684a928cc82ddb480a47 (JP-CV-031); F:gaps/Serializer.fromJSON/d106c4be2398eea1c9f577f5 | A non-string for a `String` field is rejected. | `reject(ValidationException) @rule:INSTANCE_010` | promote |
| PRM-04 | F:lifted/Serializer.fromJSON/32d50dc5c52c15ee0eb24f7e, c5b87cdb0253a6634bd0db1d, 76cb58b8715aef927fe84a59, 94cc1cb6fc3bf6f62ae38ecb, 648a492e4cef700df339b4ee, aee94f197dd35f048a664d25 (JP-CV-013/018/023/028/033/007) | An array element of the wrong primitive type is rejected (Integer, Long, Double, Boolean, String, DateTime). | `reject(ValidationException) @rule:INSTANCE_010` | promote (one Scenario Outline, 6 rows). Note: all six fixtures were recorded with `{validate: false}` (the type check is the populator's, so it applies either way); the scenario uses default options. |
| PRM-05 | F:lifted/Serializer.fromJSON/71bf28e9c21383193f2d16e3, e70d7dbfca54341a9ecabd25 (JP-VS-004/002) | A scalar value where the field is an array is rejected. | `reject(ValidationException) @rule:INSTANCE_011` (new) | promote |
| PRM-06 | F:lifted/Serializer.fromJSON/65bceda3f6583f0835ff902b (JP-CV-001), 99b0ff35c7d302f483e6de9f (JP-CV-002) and other `ok` JP-CV rows | Well-typed primitive and array values are accepted. | `accept` | promote (positive pairs). |
| PRM-07 | F:lifted/Serializer.fromJSON/0cf31f58220558fd98cf24cb, d9ab2eb613feb2022285a49a (JP-CV-003/004); F:unit/Serializer.fromJSON/0e73bcb5de7988de9d68b679 (26 with this template) | With strict qualified date-times, a `DateTime` without a time-zone designator is rejected. | `reject(ValidationException) @rule:INSTANCE_012` (new) | **promote (pending Q-17)** for the option default. |
| PRM-08 | F:lifted/Serializer.fromJSON/4cbbef1d3b9448fe5e45cede (JP-CV-006); F:unit/Serializer.fromJSON/176b7fad280d782925876dbe (13) | A string that is not an ISO 8601 date-time is rejected. | `reject(ValidationException) @rule:INSTANCE_012` | promote only for inputs outside **both** ISO 8601 and V8's legacy forms (e.g. `"not a date"`). |
| PRM-09 | DV-009; TRIAGE T1d (8 cases, `"-0"`); F:unit/Serializer.fromJSON "legacy datetime formats" (47, e.g. b781d8e9f91991a4111ee5ff `--11-28`) | V8 legacy date forms (`Nov 28 2022`, `11-28`, `"-0"`). | – | **exclude**: JS engine behaviour (X-01, DV-009, BC-07). |
| PRM-10 | DV-012, BC-10 | `±Infinity` for `Integer`/`Long`. | – | **exclude**: not representable in JSON (X-01). |
| PRM-11 | `CS:validate` primitives rows (`String value for Integer field`, `…Boolean field`) | Existing. | add `ValidationException` | **strengthen**. |

### 1.J Instance validation, identifiers and relationships: `validate/features/relationships.feature` (+11)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| REL-01 | F:gaps/Resource.validate/3b739c27995988ea846df853 | An identified instance with an empty identifier is rejected. | `reject(any) @rule:INSTANCE_020` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**, re-expressed (see 4.1). P5-08b: the instance-JSON form raises a plain `Error` ("Missing identifier", REL-02's rule) in TS 5.0.0 and in rust mode, not the recorded `ValidationException`, so it moved from B2 to B3. |
| REL-02 | F:data/Serializer.fromJSON/4d720dde48ec1737aba3f2e5 (identifier1err) | An identified instance missing its identifier field is rejected. | `reject(any) @rule:INSTANCE_020` | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)** (plain `Error`). |
| REL-03 | F:lifted/Serializer.fromJSON/dfd52817045927bf4086d2d3 (JP-RL-001), b2489235f4c5aa758d45b03d (JP-RL-007) | A relationship (single or array) given as an identifier string is accepted. | `accept`, with `validate: false` as recorded | **promote (pending Q-11)**: the recorded `validate: false` is a serializer option. Moved from B2 to B3 in P5-08b. |
| REL-04 | F:lifted/Serializer.fromJSON/9aed8b4bc4384bb4edb1342d (JP-RL-002), aa9ca2f4089cc755335b32a2 (JP-RL-004), bc0c01bd5483c1dbfde4008f (JP-RL-010); F:gaps/Serializer.fromJSON/2e9169b9f0f4dd24e1796dfd | With default options, a relationship field holding an object or a number is rejected. | `reject(any) @rule:INSTANCE_021` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)** (plain `Error`). |
| REL-05 | F:lifted/Serializer.fromJSON/777d0f1bdb8fc226c82bc415 (JP-VS-003) | A non-array for an array relationship field is rejected. | `reject(ValidationException) @rule:INSTANCE_011` | promote |
| REL-06 | F:gaps/Serializer.fromJSON/1a57d3a92be9d0df3807cf59 (2) | A relationship to a type that is not identifiable is rejected at instance level. | `reject(any) @rule:INSTANCE_022` (new) | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**. |
| REL-07 | F:gaps/Resource.validate/9b4cd4a28edb1f02bf3ac513 (7), 331fd69aebfa05c83bc17db6 (6) | A relationship field holding an in-memory `Resource` object. | – | **exclude**: recorded over hand-built JS resources (X-03). The JSON form of the same mistake is REL-04. |
| REL-08 | F:lifted/Serializer.fromJSON/28fd1189f544a892dfebf965 (JP-RL-005), 35d815204888ac7e173b7a57 (JP-RL-012) | With `acceptResourcesForRelationships: true`, an embedded object without `$class`, or with an unknown `$class`, is rejected. | `reject(any)` / `reject(TypeNotFoundException)` | **promote (pending Q-11)** for both, since both need `acceptResourcesForRelationships`; the first also waits on Q-13. Moved from B2 to B3 in P5-08b. |
| REL-09 | DV-008, BC-06; F:gaps/Resource.validate/d444ebcf0cf5a3c23e5ee6dd | A non-array value, or a `null` element, on an array relationship field. | TS: V8 `TypeError`. | **exclude until Q-07**. |
| REL-10 | F:unit/Relationship.fromURI (6 error fixtures, e.g. 008acf088257006f30b3e8f6) | Relationship URI syntax (`resource:ns.Type#id`). | – | **exclude for now**: `Relationship.fromURI` is stays-ts (X-03). Worth a later "URI" area if P6-01 exposes it natively. |

### 1.K Instance validation, inheritance: `validate/features/inheritance.feature` (+5)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| INH-01 | F:gaps/Resource.validate/3363a3ddcc5914a45a7a1422 (single field), e2649af2c774da7d2f7a8484 (array field); F:unit/Resource.validate/7fc8e23992f6c50ed3b5fb11. 4 gaps fixtures record this check on a contained value (the two above plus their `Serializer.toJSON` twins 11f594369be367182917899f, 38c5bb8d166e95573bcaf670). The other 12 gaps fixtures with the same message, such as 01286fe727ec519e670c99ad (cited here before P5-08b), are the relationship-field form, not this behaviour. | A nested value whose `$class` is not the declared type or a subtype of it is rejected. | `reject(ValidationException) @rule:INSTANCE_030` (new) | promote (re-expressed, see 4.1). |
| INH-02 | F:supplement/Serializer.fromJSON/3207b2a10e7355e10b2b2b9e, 93cc979c91cd056d2add5107 (#190 "validate a derived asset") | A subtype instance where the super type is declared is accepted, including inherited fields. | `accept` | promote |
| INH-03 | F:supplement/Resource.validate/e455cab3b19b2f737d873688 (#190 "a field with a default value left unset") | A field with a default value may be omitted. | `accept` | promote (re-expressed, see 4.1). |
| INH-04 | F:unit/Resource.validate/e112db6f710c1ba9da2175b7 (6) | A nested value with a property its type does not declare. | `reject(ValidationException) @rule:INSTANCE_002` | promote (nested form of INS-02; re-expressed, see 4.1). |

### 1.L Instance validation, validators: `validate/features/validators.feature` (+8)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| IVL-01 | F:lifted/StringValidator.validate/bdb5b634df9afdb6e600a0a0 (SV-VAL-005), f6dfc812305a41c6991f8940 (SV-VAL-003); F:gaps/StringValidator.validate/212af0a7e03338e645d4bdaf | A string that does not match its `regex` validator is rejected; matching strings are accepted (SV-VAL-001, 6ffb94c98c6d1c399c6fa9ba). | `reject(any) @rule:STRING_VALIDATOR_006` (new) / `accept` | **promote (pending Q-16)**; Q-15 is answered, and the patterns wait on the portable subset (Q-16). |
| IVL-02 | F:lifted/StringValidator.validate/0b342c7c7be08e043cafe617 (SV-VAL-012), 4ff9c4e5bf1d03e3eac2284b (SV-VAL-013), de983525a593fc98060f4067 (SV-VAL-016) | A string outside its `length` bounds is rejected; within is accepted. | `reject(any) @rule:STRING_VALIDATOR_006` / `accept` | **promote (pending Q-16)**; Q-15 is answered. Lengths use ASCII only; UTF-16 vs code-point length is Q-16. |
| IVL-03 | F:gaps/NumberValidator.validate/d53d0800f7cc33d437a69826, e2b902739597d1fbfc49cf6e | A number outside its `range` is rejected. | `reject(any) @rule:NUMBER_VALIDATOR_005` (new) | **promote (B3a; Q-15 answered: `reject(any)` plus `errorType` plus `@rule`)**. |
| IVL-04 | F:gaps/Resource.validate/3c27c0784b532b087d7df40e (4) | A **map** field with a size validator outside its bounds is rejected. | `reject(any) @rule:COLLECTION_SIZE_008` (new) | **promote (B3a; Q-15 answered: `reject(any)` plus `errorType` plus `@rule`)**, re-expressed (see 4.1). `CS:validate` covers arrays only. |
| IVL-05 | F:conformance/Serializer.fromJSON/3fd7878b64ffd91a8fdaafd8 | Existing array-size scenarios. | `reject(any)` plus `errorType` | **strengthen** (Q-15 answered): recorded class is `BaseException`, so assert the error type, not the class. |
| IVL-06 | F:unit/Resource.setPropertyValue/183fc67b071f1877cee6cc39 (5); F:conformance/Serializer.fromJSON/78c0404a8012d397d9967b4e | Invalid enum value. | `reject(ValidationException) @rule:INSTANCE_013` | **strengthen** `CS:validate:Invalid enum value should fail`. |

### 1.M Instance validation, maps: `validate/features/maps.feature` (+3)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| IMP-01 | F:supplement/Serializer.fromJSON/2cbebbf0437339c532b5d557, 96c2b0deacdd10cc1a83ca2d (#194) | A map value whose `$class` does not resolve is rejected as a validation error. | `reject(ValidationException) @rule:INSTANCE_040` (new) | promote (#194 fixed Rust to match). |
| IMP-02 | F:supplement/Serializer.fromJSON/64a7fda6f2fd8f2f9d4e0a8e (#194 positive) | A map with well-typed values is accepted. | `accept` | promote |
| IMP-03 | F:unit/Serializer.toJSON/5d2dddb7ac5e258808242d93 (2, `Dictionary`) | A map value of the wrong primitive type is rejected. | `reject(any) @rule:INSTANCE_040` | **promote (B3a; Q-13 answered: `reject(any)` plus `@rule`, plus a mention where a name exists)**: recorded on `toJSON` with a plain `Error`; re-record as a `fromJSON` case in the scenario. |
| IMP-04 | DV-006, BC-04 | A scalar-typed map value is checked against the **key**'s scalar-ness. | – | **exclude until Q-08**. |
| IMP-05 | DV-007, BC-05 | A relationship-typed map value must be an embedded resource. | – | **exclude until Q-08**. |
| IMP-06 | DV-011, BC-09 | An identified concept map value gets the identifying field's **name** as `$identifier`. | – | **exclude until Q-08**. |
| IMP-07 | F:unit/Serializer.toJSON/7f9be3e35a5c8b651801fa11 (`Expected a Map`) | A JS `Map` object is required in memory. | – | **exclude**: JS-only value (X-01). |

### 1.N Serialisation round trip: new `serialize/features/roundtrip.feature` (+6, optional)

| ID | Source | Behaviour | Assertion | Disposition |
|---|---|---|---|---|
| SER-01 | F:data/Serializer.fromJSON "single CTO files" (1,240 `ok` fixtures) and the paired `Serializer.toJSON` fixtures (1,777) | A valid instance, read and written back, yields the same JSON (up to key order). | `accept` plus a JSON-equality step | **promote (pending Q-17)**, one Scenario Outline over a curated 20 to 30 models. |
| SER-02 | Same fixtures, `DateTime` fields | A `DateTime` is written in a canonical form (UTC, millisecond precision, `Z`). | JSON equality | **promote (pending Q-17)**. |
| SER-03 | F:gaps/Serializer.fromJSON "strictQualifiedDateTimes default vs explicit true/false" (3) | The `strictQualifiedDateTimes` option. | `accept`/`reject(ValidationException)` | **promote (pending Q-17)**. |
| SER-04 | F:supplement/Serializer.setDefaultOptions (3), Serializer.new (164, stays-ts) | JS serializer construction and default options. | – | **exclude**: API shape (X-03). |

### 1.O Decorator command sets (DCS): future `dcs/` area (0 in this plan, sized for a later batch)

| ID | Source | Behaviour | Disposition |
|---|---|---|---|
| DCS-01 | F:*/DecoratorManager.decorateModels (1,301: 539 `ok`); ledger rows `DecoratorExtractor`/`DecoratorManager` → P4-09 (RUST) | Applying a `concerto.decorator` command set (UPSERT/APPEND by target type, property, namespace). | **defer**: spec-worthy and ported, but it needs a new step family (apply a DCS, compare the decorated AST) and a separate batch. Error cases to include then: `Unknown command type` (F:unit/DecoratorManager.decorateModels/378fff30b7be67d0b89480ba), `references both property and properties` (cccef90acac70971256e0a59), unknown namespace (02fa156441d7ddfac005169c). |
| DCS-02 | F:*/DecoratorManager.extractVocabularies (69), extractDecorators (49+) | Vocabulary extraction and its reserved-key rules (F:unit/DecoratorManager.extractVocabularies/79395b3829fbf912bcab9669). | **defer** with DCS-01. |
| DCS-03 | F:*/DecoratorManager.jsonToYaml, yamlToJson; F:*/DcsConverter.* | YAML conversion. | **exclude**: YAML formatting is library-specific (X-07). |

### 1.P Existing suite corrections (batch 0; no new behaviour)

| ID | Evidence | Problem | Proposed fix |
|---|---|---|---|
| FIX-01 | concerto-conformance `9339642`: 10 model files have a `.cto` and no `.json` AST (CLASS_DECLARATION_007 not-system-identified, MODEL_ELEMENT_002 concepts and enums, PROPERTY_003 invalid, imports MODEL_FILE_002 duplicate, MAP_KEY_TYPE_001 invalid, NUMBER_VALIDATOR_001 no-bounds, NUMBER_VALIDATOR_003 invalid, STRING_VALIDATOR_001 no-bounds, STRING_VALIDATOR_004 invalid). Nine scenarios assert `message ""` against one of them. The JS step turns the missing-file `Error` into the scenario's error, so they pass without testing anything. The recorded TS outcomes for those `.cto` files are `ParseException`s (e.g. F:conformance/ModelManager.addCTOModel/62c54d91eb8cc53323020ff4, 28b9331c444efb0ceff516a2, 96cce04444cd716da324d6d6). | Vacuous scenarios; several are parser tests, not semantic ones. | Make a missing fixture a **harness error** in the JS and C# steps (the Rust step already panics). For each: if the rule is semantic, author a JSON AST that reaches it (IDN-01, MAP-01); if it is syntactic, move it to a parser area outside this suite (X-06). |
| FIX-02 | `CS:scalars:should throw for invalid regex` loads `…valid_regex.json` and expects no error; `CS:scalars:should pass for valid regex pattern` loads the missing `…invalid_regex.json` and expects `""`. | Titles and fixtures are swapped, and the negative is vacuous. | Swap the titles; replace the negative with SCV-05. |
| FIX-03 | 6 `@skip` scenarios (imports ×2, enums ×1, namespaces ×3) assert text the recorded TS outcomes never contain (for example `already defined in an imported model`, where F:conformance/ModelManager.validateModelFiles/4e0f26af45608f309e43c501 records `IllegalModelException … clashes with an imported type`). | Skipped everywhere. | Un-skip with class assertions (NSI-06, NSI-07). |
| FIX-04 | 6 `@skip-rust` scenarios (concepts ×2, enums ×1, imports ×1, maps ×2). Two of them encode TS crashes: the cyclic-inheritance scenario asserts V8's `Maximum call stack size exceeded` (DV-013), and the undeclared-map-value scenario asserts `Cannot read properties of null` (DV-014). | Engine-specific text in the spec. | Replace the two crash assertions per Q-01/Q-02 (CON-10, MAP-04). Re-evaluate the other four with class assertions; the Rust port now matches TS's classes for them in the oracle (0 fail on the conformance source, gate report). |
| FIX-05 | Every `an error should be thrown with message "…"` step (all three runners). | Assertions depend on TS prose. | Add the class step and `@rule` tags (section 5), then convert all negatives (CON-11, SCV-04/06, INS-04/06, PRM-11, IVL-05/06). Keep the message step only for `mentions(...)` of model names. |

---

## 2. Exclusions

| ID | Class | What it covers, with counts from the records | Why |
|---|---|---|---|
| X-01 | **JS-only value semantics** | `undefined` vs absent (`@@oracle: undefined` args; DV-002); `bigint` (F:supplement/Resource.setPropertyValue, #200); JS `Map` instances (IMP-07); `±Infinity`/`NaN` (DV-012); lone UTF-16 surrogates (DV-004); V8 legacy date parsing (DV-009, TRIAGE T1d, 47 legacy-format fixtures); dayjs values in outcomes; `String()` coercion (DV-002) | Not expressible in JSON, or a property of the JS engine rather than of Concerto. A spec that pins them would make every non-JS runtime emulate V8. |
| X-02 | **JS coercion of malformed ASTs** | P5-05 T2a/T2c: 38,609 cases in 1,084 clusters (#217, #219) where the verdict depends on `ToString`, truthiness, `__proto__` lookup, `Array.prototype.lastIndexOf` or JS relational comparison; BC-17 to BC-20 | TS's outcome is an artefact of an untyped walk. Promoting it would specify JS semantics. They are re-opened as a group by Q-10 (strict AST), not case by case. |
| X-03 | **stays-ts ops** | 2,121 unsupported fixtures owned by `stays-ts` (gate report), mainly `Factory.newResource` 1,398, `ClassDeclaration.isClassDeclaration` 422, `Serializer.new` 164, `Field.isField` 100, the `is*`/`declarationKind` predicates, `Typed`/`Identifiable` accessors, `Relationship.fromURI` 23, `ModelLoader.*` 17, `Resource.toJSON`/`toString`, `accept` visitors | JS object model and API surface (ledger classification TS). They are the JS binding's contract, which the oracle keeps testing. |
| X-04 | **Introspection API shape** | Getter ops that are not stays-ts but only expose structure: `Declaration.getName` 369, `getFullyQualifiedName` 493, `getNamespace` 327, `Property.getName` 245, `ModelManager.getType` 688, `ModelFile.getAllDeclarations` 125, `ModelManager.getAst` 133, ... | Their results follow from loading a valid model; names and return shapes are per-language API (P6-01 decides the Rust names, BR-06). Only their **semantic** consequences are promoted (e.g. inherited identifiers, CON-02/03). |
| X-05 | **Exact message wording** | Every TS message string, including `File '<name>':` suffixes and line/column text (#219 location-suffix cluster, 1,611 cases), DV-016's doubled suffix, and the 205 #219 wording-only clusters | Wording is not portable and not a contract (Q-P7-1). The class plus `mentions(...)` carries the spec content. |
| X-06 | **Parser behaviour** | 225 `ParseException` fixtures, including the conformance source's `.cto` negatives (FIX-01) | The Concerto grammar is a separate component (concerto-cto, Peggy). Its expected-token lists are generator output. The semantic suite loads JSON ASTs, and a parser suite, if wanted, belongs elsewhere. |
| X-07 | **Implementation-specific environment** | Language-version pragma (NSI-10); `ModelLoader` HTTP (F:gaps/ModelLoader.loadModelManager/9d7f656bb2045c76526fc10d); `writeModelsToFileSystem`, `updateExternalModels` (network); YAML (DCS-03); `options.regExp` (BC-28); decorator factories (BC-24) | Depend on the runtime, the network, the file system or host callbacks. |
| X-08 | **TS crashes where a divergence stands** | DV-008 (REL-09), DV-010 (circular JSON in `JSONPopulator`/`JSONGenerator`), DV-013 (CON-10), DV-014 (MAP-04), DV-015 (INS-09), DV-017 (AST-03), DV-018 (DEC-05) | The V8 `TypeError`/`RangeError` is never promoted. Where the **intended** rule is clear, the candidate is listed with `pending Q-n` so the spec asserts the intended class once the maintainer confirms it. |
| X-09 | **Duplicates of the suite itself** | The corpus's `conformance` source (815 fixtures) was recorded **from** concerto-conformance's own files (`source_test: oracle conformance driver …`) | Already in the suite. Used here only as the recorded TS outcome for strengthening (FIX-03/04). |
| X-10 | **Recorder cross-products** | The data driver's "JSON files × every model in the directory" fixtures: about 250 `TypeNotFoundException`s from pairing an instance with the wrong model (e.g. `hierarchy1.json` against another model) | Harness artefacts, not behaviours. INS-06 promotes the rule once. |
| X-11 | **Rust-crate-only items** | BR-01 to BR-11 (P5-07 section 1.6) | Crate API, not observable behaviour; they belong to P6-01's API work. |

---

## 3. Open spec questions for the maintainer

Each question is where TS behaviour is arguably a bug, or where the spec needs a
decision the records do not settle. They cross-reference DIVERGENCES.md and P5-07.

**Status after the maintainer's review of 2026-09-27 (accordproject/concerto-rust#249,
applied in P5-08c):** Q-05, Q-13, Q-14 and Q-15 are answered, as recorded in their
rows. The other 13 (Q-01 to Q-04, Q-06 to Q-12, Q-16, Q-17) are deferred.

| # | Question | Records | Candidates waiting |
|---|---|---|---|
| Q-01 | **Cyclic inheritance.** TS overflows the stack (`RangeError`) on `A→C→B→A` but raises `IllegalModelException` for `A extends A`. Should the spec require `IllegalModelException` for every cycle? The existing scenario asserts the V8 message. | DV-013, BC-11, #184; F:supplement/ModelManager.fromAst/9224ce1df87976aca5fb67d0 vs F:conformance/ModelManager.addCTOModel/d85b28076a8ece00c558322c | CON-10, FIX-04 |
| Q-02 | **Undeclared map value type.** TS throws `TypeError … reading 'isMapDeclaration'`. Should the spec require `IllegalModelException`, like an undeclared property type? | DV-014, BC-12, #172 | MAP-04, FIX-04 |
| Q-03 | **Typeless relationship and `null` decorator.** Both are maintainer-accepted in Rust (`IllegalModelException`). May the spec assert the Rust behaviour now, tagged `@since-R1` so the TS-reference run skips them until P5-02 ships? | DV-017, DV-018, BC-15, BC-16, #218, #228 | AST-03, DEC-05 |
| Q-04 | **Non-list `decorators` and non-object decorator elements.** TS iterates a string per code unit and accepts `[7]` as a nameless decorator. Spec: reject both? | BC-17, BC-21, Q-P7-9, #218 follow-ups | DEC-06, DEC-07 |
| Q-05 | **Unversioned namespaces.** Is an unversioned model namespace valid (non-strict) or invalid (v4)? **Answered (maintainer, 2026-09-27, accordproject/concerto-rust#249, P5-08c):** spec as TS does. A model with an unversioned namespace is rejected, at the `reject(any)` level with no class (per Q-13). `parseNamespace` stays out (X-04). | DV-003, BC-02, Q-P7-5 | NSI-09 (now B3a) |
| Q-06 | **Non-string instance `$class`.** Spec it as a rejection (class TBD by Q-13), `@since-R1`? | DV-015, BC-13, TRIAGE T1a/T1b | INS-09 |
| Q-07 | **Relationship arrays with non-array values or `null` elements.** TS throws `TypeError`. Spec `ValidationException`? | DV-008, BC-06, #127 | REL-09 |
| Q-08 | **Map value semantics.** (a) A scalar-typed map value is unwrapped by the key's scalar-ness (DV-006). (b) A relationship-typed map value must be an embedded resource (DV-007). (c) An identified concept map value takes the identifying field's name as `$identifier` (DV-011). Which are spec, and which are bugs to fix first? | BC-04, BC-05, BC-09, Q-P7-6, Q-P7-8 | IMP-04, IMP-05, IMP-06 |
| Q-09 | **Load-time vs validate-time errors.** The suite distinguishes `Given I load` from `When I validate`. TS reports some rules at construction and others in `validateModelFiles`, and the Rust crate can differ (the `@skip-rust` duplicate-name scenarios). Should a scenario assert only "rejected by the end of validation"? | FIX-04; BC-25 (error-timing parity) | all semantic negatives |
| Q-10 | **Strict AST.** Should the spec require structurally invalid JSON ASTs (wrong field types, non-string names, non-object validators) to be rejected with `MetamodelException`, as BC-19's `strictAst` proposes? If yes, AST-05, IDN-03, SCV-07 and DEC-06 become one metamodel batch. | BC-18, BC-19, BC-20, Q-P7-10; #217/#219 | AST-05, IDN-03, SCV-03 (shape part), SCV-07, CON-12 variants, the CON-07 non-list variant (F:supplement/ModelManager.fromAst/000dab841e9b0cef97e8826f, P5-08c D4a) |
| Q-11 | **Serializer options in the spec.** Are `validate: false` and `acceptResourcesForRelationships` (both recorded in the lifted JP-RL fixtures) part of the language-neutral contract, or JS serializer options? If not, REL-03 and REL-08 are re-authored with validation on and default options. | F:lifted/Serializer.fromJSON JP-RL-001 to 012 | REL-03, REL-08 (REL-04's row needs Q-13 only; reconciled in P5-08c) |
| Q-12 | **Import error precedence.** For an import that is both unregistered and malformed, TS reports the malformed namespace because of call order. Spec: any rejection, or the "unregistered" rule first? | DV-019, #241, #242 | NSI-08 |
| Q-13 | **Error class for rules TS raises as plain `Error`.** Unversioned import, duplicate namespace, missing `$class`, abstract `$class`, missing or empty identifier, relationship value shape, alias to a primitive, invalid namespace version. Should the spec name a class (`IllegalModelException` for model rules, `ValidationException` for instance rules), or stay at `reject(any)`? **Answered (maintainer, 2026-09-27, accordproject/concerto-rust#249, P5-08c):** spec as TS does, at the `reject(any)` level (no class), plus `@rule`, plus a mention where a model or instance name exists. Strengthen to `errorType` codes when BREAKING-CHANGES-PLAN BC-38 lands. The JS runner has the step `Then an error should be thrown` for this. The unblocked candidates form batch B3a (section 4.3). | Records throughout sections 1.B to 1.M; Q-P7-1 (is a class change minor?) | IDN-05, NSI-01 to 04, INS-01, INS-05, INS-07, REL-01, REL-02, REL-04, REL-06, IMP-03 (all B3a); REL-08 (still held by Q-11). NSI-08 is held by Q-12 only (its row; reconciled in P5-08c). |
| Q-14 | **Rule IDs.** Confirm the proposed new IDs (CLASS_DECLARATION_011 to 013, MODEL_ELEMENT_003, SCALAR_DECLARATION_001, MODEL_FILE_005 to 008, NUMBER_VALIDATOR_004/005, STRING_VALIDATOR_005/006, COLLECTION_SIZE_007/008, MAP_VALUE_TYPE_002, MAP_DECLARATION_002, DECORATOR_001 to 003, RELATIONSHIP_004, METAMODEL_001/002, INSTANCE_001 to 040), or supply the canonical rule list if one exists outside the folder names. **Answered (maintainer, 2026-09-27, accordproject/concerto-rust#249, P5-08c):** confirm as proposed for the suite. The D1 `errorType` breaking-changes item (BREAKING-CHANGES-PLAN BC-38) decides the final public code format (verbatim or namespaced) and any renumbering. | concerto-conformance folder names | all new scenarios (no scenario changes) |
| Q-15 | **Validator errors are `BaseException` in TS**, both at model load (bad bounds, default out of range) and at instance validation (regex, length, range, size). Should the spec say `IllegalModelException` for model-load validator errors and `ValidationException` for instance violations? **Answered (maintainer, 2026-09-27, accordproject/concerto-rust#249, P5-08c):** the spec differs from TS. In future, validator errors stop being `BaseException`: load-time validator errors become `IllegalModelException` and instance violations `ValidationException`, keeping `errorType` (BREAKING-CHANGES-PLAN BC-39). In the interim, scenarios assert rejection plus `errorType` plus `@rule`, with no class (JS step `And the error type should be "<code>"`). SCV-01 to 03 and IVL-03/04 are promotable (B3a), and the SCV-06/IVL-05 strengthen rows apply. | F:conformance/ModelFile.new/* validator negatives; F:conformance/Serializer.fromJSON/3fd7878b64ffd91a8fdaafd8; #219 BaseException/Error clusters | SCV-01 to 03, IVL-03, IVL-04 (B3a); SCV-06, IVL-05 (strengthen); IVL-01, IVL-02 (still held by Q-16). SCV-05's row needs Q-16 only (reconciled in P5-08c). |
| Q-16 | **Regex dialect and string length.** Concerto `regex=` patterns are evaluated as ECMAScript regular expressions in TS (and emulated in Rust). What dialect does the spec require (ECMAScript, or a portable subset such as I-Regexp, RFC 9485)? Is `length` counted in UTF-16 code units (JS) or code points? | SCV-05; TRIAGE stage 1 (`/(/` wording fixed); BC-28; DV-004 | SCV-05, IVL-01, IVL-02 |
| Q-17 | **DateTime.** Which input forms are spec (ISO 8601 profile), what is `strictQualifiedDateTimes`'s default, and is the output form (UTC, milliseconds, `Z`) normative? | DV-009, BC-07, Q-P7-7; TRIAGE T1c/T1d | PRM-07, SER-01 to 03 |

---

## 4. Proposed scenario layout, count and batches

### 4.1 Layout

```
semantic/
  features/
    concepts.feature        + CON-01..10, 12              (existing file)
    identifiers.feature     IDN-01, 02, 04, 05             (new)
    namespaces.feature      + NSI-01, 02; NSI-07 strengthened (existing)
    imports.feature         + NSI-03..05, 08; NSI-06 strengthened (existing)
    scalars.feature         + SCV-01, 02, 05, 06           (existing)
    collections.feature     + SCV-03, 04                   (existing)
    maps.feature            + MAP-01..05                   (existing)
    decorators.feature      DEC-01..03, 05                 (new)
    metamodel.feature       AST-01..03                     (new)
  specifications/
    <area>/models/<RULE_ID>/<rule_id>_<case>.json   (+ .cto where CTO can express it)
validate/
  features/
    validate.feature        existing 15, strengthened      (existing)
    structure.feature       INS-01..07, 09                 (new)
    primitives.feature      PRM-01..08, 11                 (new)
    relationships.feature   REL-01..06, 08                 (new)
    inheritance.feature     INH-01..04                     (new)
    validators.feature      IVL-01..06                     (new)
    maps.feature            IMP-01..03                     (new)
  models/<area>/<case>.cto  + <case>.ast.json (new: JSON AST sibling of every .cto)
            <case>.json     (instance)
serialize/                                                  (new, optional)
  features/roundtrip.feature  SER-01..03
  models/...
```

Every new model is written as CTO **and** as its JSON AST, following the
existing `semantic/specifications` convention, so that runtimes without a CTO
parser (Rust today) can run it. Fixture JSON is taken from the cited oracle
fixture's `inputs` (the AST or instance argument), with namespaces renamed to the
suite's `org.concerto.<area>.<valid|invalid>.<rule>@1.0.0` pattern. The expected
result is taken from the fixture's recorded `outcome` class, never its message.

**Re-expressed candidates.** Rows marked "re-expressed" (INS-05, REL-01, INH-01,
INH-03, INH-04, IVL-04) were recorded by calling `Resource.validate` on resources built in
memory, not from instance JSON. The batch that promotes them writes the equivalent
instance JSON and must see the scenario pass on the JS reference in the suite's own
CI before merging; if the JSON form gives a different class, the candidate is
dropped or moved to section 3, not adjusted to fit.

### 4.2 Estimated count

A Scenario Outline counts once per example row. A positive/negative pair counts as two.

Recomputed in P5-08c after the maintainer's review (accordproject/concerto-rust#249).
"Written" counts the scenarios actually in concerto-conformance (P5-08b plus P5-08c's
AST-01 positive and INH-01 array scenario). "B3a" counts the candidates the answers to
Q-05, Q-13 and Q-15 unblocked. "Still pending" waits on a deferred question. The
per-candidate counts behind B3a and "still pending" are estimates until each scenario
is written (for example SCV-01 as 2, one per bound; REL-04 as 3, one per recorded shape).

| Area | New scenarios | Written | B3a (unblocked) | Still pending | Strengthened |
|---|---|---|---|---|---|
| Concepts and declarations | 14 | 12 | 0 | 2 (CON-10; CON-07 non-list, Q-10) | 8 |
| Identifiers | 14 | 13 | 1 | 0 | 2 |
| Namespaces and imports | 7 | 1 | 5 | 1 (NSI-08) | 6 |
| Scalars, validators, collections | 6 | 0 | 5 | 1 (SCV-05) | 5 |
| Maps | 4 | 3 | 0 | 1 | 2 |
| Decorators | 5 | 4 | 0 | 1 | 0 (DEC-04 is counted under CON-11) |
| Metamodel | 5 | 3 | 0 | 2 | 0 |
| Instance: structure | 9 | 4 | 4 | 1 (INS-09) | 2 |
| Instance: primitives and dates | 17 | 15 | 0 | 2 | 2 |
| Instance: relationships | 11 | 1 | 6 | 4 (REL-03, REL-08) | 0 |
| Instance: inheritance | 5 | 5 | 0 | 0 | 0 |
| Instance: validators | 8 | 0 | 4 | 4 (IVL-01, IVL-02) | 3 |
| Instance: maps | 3 | 2 | 1 | 0 | 0 |
| Serialisation (optional) | 6 | 0 | 0 | 6 | 0 |
| **Total** | **114** (108 without serialisation) | **63** | **26** | **25** | **30** |

The existing suite has 95 scenarios after P5-08c (81 + 15 = 96 at `9339642`, less the
dropped NUMBER_VALIDATOR_003 negative, decision D2). B1 is 36 (35 written by P5-08b,
not the 31 this plan first gave, plus the AST-01 positive) and B2 is 27 (26 plus the
INH-01 array-field scenario), so 63 no-question scenarios are written. With B3a the
suite grows to 184 scenarios runnable without a further answer, and to about 209
(95 + 114) if every pending question is answered. If Q-07/Q-08 promote REL-09 and
IMP-04 to 06, add about 5.

### 4.3 Batches

| Batch | Content | Needs | Size |
|---|---|---|---|
| **B0: hygiene** | FIX-01 to FIX-05: missing-fixture harness error, class step, `@rule` tags, convert the existing negatives, un-skip where the recorded class is known | class step in all three runners | 30 changed, 0 new |
| **B1: model semantics, no questions** | CON-01 to 09, CON-12, IDN-01/02/04, NSI-05, MAP-01 to 03, DEC-01 to 03, AST-01/02 (with the AST-01 positive added in P5-08c) | options step (decorator and metamodel validation) | 36 new (written) |
| **B2: instance validation, no questions** | INS-02/03, PRM-01 to 06, PRM-08, REL-05, INH-01 to 04 (with the INH-01 array-field scenario added in P5-08c), IMP-01/02 | Rust and C# instance steps; JSON AST siblings for `validate/models` | 27 new (written) |
| **B3a: unblocked by Q-05/Q-13/Q-15** | IDN-05, NSI-01 to 04, NSI-09, INS-01/05/07, REL-01/02/04/06, IMP-03 (Q-05/Q-13: `reject(any)` plus `@rule`, plus a mention where a name exists); SCV-01 to 03, IVL-03/04 (Q-15: `reject(any)` plus `errorType` plus `@rule`); the SCV-06 and IVL-05 strengthen rows | JS steps `Then an error should be thrown` and `And the error type should be "<code>"` (added in P5-08c) | about 26 new |
| **B3: after Q-11/Q-16/Q-17** | SCV-05, PRM-07, REL-03, REL-08 (both), IVL-01/02 | answers | about 11 new |
| **B4: after Q-01 to Q-04, Q-06 to Q-08, Q-10, Q-12** | CON-10, MAP-04, AST-03, DEC-05, INS-09, NSI-08, the CON-07 non-list variant (Q-10) (plus REL-09, IMP-04 to 06 and the strict-AST group if promoted) | answers; `@since-R1` tag handling | 8 new (+5 or more) |
| **B5 (optional)** | SER-01 to 03; later the DCS area | round-trip step; DCS steps | 6 new + DCS |

B1 and B2 are independent and can run in parallel. Each batch is one PR to
concerto-conformance, green on all three runners (or with explicit
`@skip-<runner>` tags and a reason).

---

## 5. Runner impact

### 5.1 New or changed steps (all runners)

| Step | Purpose | JS (`steps.ts`, `validateSteps.js`) | Rust (`cucumber_tests/src/steps.rs`) | C# (`Steps.cs`) |
|---|---|---|---|---|
| `Then an error of class "<Class>" should be thrown` | class assertion (FIX-05) | use `err.name`/constructor name | map the crate error to its class: `ConcertoError` variant or `ErrorKind` plus `ts_class` (BR-03, BR-07 may rename these; the mapping belongs in the runner, not the spec) | exception type name |
| `Then the error should mention "<name>"` | `mentions(...)` | substring of message | same | same |
| `Given the model manager options:` (table: `strict`, `decoratorValidation.missingDecorator`, `metamodelValidation`, `enableAliasedType`) | NSI-03/04, IDN-05, DEC-01 to 03, AST-01 | pass to `new ModelManager(opts)` | map to the crate's model manager options (P6-01 decides the Rust surface) | map, or tag `@skip-csharp` |
| Missing fixture is a harness error | FIX-01 | throw outside the scenario's error slot | already panics | throw |
| `@rule:<ID>`, `@pending-Qn`, `@since-R1` tags | reporting and gating | `--tags "not @pending and not @skip"` | filter in the cucumber runner | filter |

### 5.2 Instance validation (the largest change)

- **JS:** `validate/validateSteps.js` already has `When I validate "<json>" with
  models "<cto>"` and an options variant. Two changes: add the class step, and run
  it in `npm test` (today `test:instances` is a separate script outside CI's
  `npm test`).
- **Rust:** the runner has **no instance steps**. It needs
  `When I validate "<json>" with models "<ast.json>"` over the native crate
  (`validate_instance` or its P6-01 successor, BR-08 for options), plus the class
  step. It cannot read `.cto`, so every `validate/models` model needs a committed
  JSON AST sibling (generated once with `concerto-cto` in the JS toolchain, checked
  in, and verified in CI by re-parsing). This also brings the existing 15 validate
  scenarios to Rust.
- **C#:** the runner is partial and semantic-only. Tag instance features
  `@skip-csharp` until it gains an instance step; the class step is cheap to add.
- **Round trip (B5):** a `Then the output JSON equals "<file>"` step in all runners.

### 5.3 CI

- concerto-conformance CI (`npm test`) should run semantic **and** instance
  features.
- concerto-rust's `conformance-test.yml` already runs the Rust harness against
  the checkout. With B2 it also runs the instance features, which makes the suite
  the language-neutral contract P6-01 asks for.

---

## 6. What this plan does not do

- It changes no code and no concerto-conformance file; the batches above are future
  tasks.
- It does not re-run the oracle, the fuzzer or the suite. Where it states what a
  suite scenario does, the evidence is the scenario text, the fixture files present
  in `origin/main`, and the recorded TS outcome.
- It does not decide any question in section 3; candidates that depend on one are
  marked `pending`.
