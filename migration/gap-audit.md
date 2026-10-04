# P2-09 gap audit

Tracks accordproject/concerto-rust#53. Plan: accordproject/concerto-rust#29, §1.4 and §4.

This started as the early, partial audit the maintainer approved on 2026-09-25. It
covered P2-01 to P2-07, P2-08 (#52) and P2-08b (#129). At that point P2-08c (#144) was
still open, so its items went under a Pending section. **The
[addendum](#addendum-after-p2-08c-p2-08d-p2-09b-and-p4-07a) (2026-09-25) closes that
section.** P2-08c (#144), P2-08d (#151), P2-09b (#153) and P4-07a (#154) have all
merged. The addendum re-runs the oracle at concerto-rust `b211ae9` and moves every
"Mapped, pending" row to a final status. The per-file tables and the summary below
show the post-addendum status. Where a row changed, its note says so.

This is a document only. Nothing in either repo was changed. Where the audit finds a
gap, it names the owner and leaves the fix to them.

## What was audited, and against what

| | |
|---|---|
| TS reference | `packages/concerto-core/src` at `origin/main` 95645ef27, the published 5.0.0 the oracle was recorded from |
| Ledger | `migration/ledger/SEAM_LEDGER.tsv` on this branch, at integration head 82f1dd05e |
| Rust | `accordproject/concerto-rust` integration branch `claude/tender-pascal-ocwf9q` at fc58371 (P2-08b merged) |
| Oracle run | native harness on fc58371: `CONCERTO_ORACLE_FIXTURES=<concerto>/migration/oracle/fixtures cargo test -p accordproject-concerto-core --test oracle` |
| Oracle result | **16085 fixtures, 13484 pass, 99 fail, 2502 unsupported, 0 harness errors, 0 regressions** against `baseline.tsv` |
| Failing and unsupported, by owner | P1-07a 89, P2-01+P4-03 5, P2-03+P4-05 11, P2-03+P4-06 1, P2-06+P4-07 16, P2-07+P4-05 42, P2-08+P4-08 98, P3-04+P4-08 276, stays-ts 2063 (0 unowned) |
| **Addendum** Rust | integration head `b211ae9` (P2-08c, P2-08d, P4-07a and P2-09b merged); concerto integration head `0c62e492f` |
| **Addendum** oracle result | **16085 fixtures, 13706 pass, 13 fail, 2366 unsupported, 0 harness errors, 0 regressions**. It matches `baseline.tsv` at `b211ae9` exactly |
| **Addendum** failing and unsupported, by owner | P2-03+P4-05 11, P2-06+P4-07 16, P2-07+P4-05 1, P2-08+P4-08 12, P3-04+P4-08 276, stays-ts 2063 (0 unowned) |

**Which members count as validation-style.** A member of a file in P2 scope qualifies
if any of these holds: the ledger's `category` is `validation`; its name is
`validate*`, `check*`, `process`, `processType`, `resolve*`, `enforce*`,
`is*Valid*`, `isCompatible*` or `compatibleWith`; or its body throws (including through
`reportError`/`handleError`). Pure getters that only matched on a name, such as
`getType`, are left out. That gives 80 rows in the P2-scope files (`introspect/*`,
`modelutil.ts`, `model/resourceid.ts`, `basemodelmanager.ts`, `modelmanager.ts`, and
`introspect/metamodel.ts`, which sits with `validateAst`). The validation-style members
of the P3/P4 files are listed, without an in-depth audit, in
[Outside this partial audit](#outside-this-partial-audit).

**How to read the evidence columns.**

- *Rust counterpart*: file (under `concerto-core/src/` unless shown otherwise) and
  function, with its line number at fc58371. Most carry a `TS: <Class>.<member>` doc line
  (PORTING.md 7.2).
- *Unit tests*: `#[test]` functions in concerto-rust that exercise the counterpart,
  named as they appear in the source. A leading `_` or `…` abbreviates the shared
  prefix of the test named just before it.
- *Oracle*: `op p/f/u` is the report's own rule for `<Class>.<member>` (pass, fail,
  unsupported). *Error path* counts every fixture in the corpus, whatever its op, whose
  recorded TS error is this member's throw text. A fixture counts as failing if it is on
  the report's failure list. It counts as unsupported if its recipe uses
  `metamodelValidation`, `decoratorValidation` or a decorator factory, or if it is a
  `ModelManager.addModel` fixture with a recorded error (all 87 of those have a non-string
  input the CTO cache can't replay; the one `addModel` fixture without either passes and
  records no error, so it never enters an error-path count). The report doesn't list
  unsupported fixtures by id,
  so this is a heuristic. It reproduces the report's per-op unsupported counts exactly
  for `addCTOModel` (195), `validateModelFiles` (16), `addModel` (172) and `getType` (11).
  Two members that throw identical text can't be told apart this way ("Duplicate
  class name", "Unrecognised model element", "Namespace is not defined for type"); the
  row says so where it matters.
- *Status*:
  - **Mapped**: the Rust counterpart exists, it is tested, and it has no open failure.
  - **Mapped, divergence**: mapped, with a documented `DIVERGENCES.md` row.
  - **Mapped, pending**: mapped, but some fixtures still fail. The failures belong to
    P2-08c (#144) or P2-08d (#151). After the addendum no row has this status.
  - **Gap**: no library counterpart, a harness gap, or a check found missing or
    misordered by this audit. The owner is named in the note.
  - **Stays TS**: the ledger says so.

## Summary

After the addendum (partial-audit counts in brackets):

| Status | Rows |
|---|---|
| Mapped | 63 [45] |
| Mapped, divergence (DV-002, DV-003, DV-013, DV-014) | 4 [3] |
| Mapped, pending P2-08c / P2-08d | 0 [19] |
| Gap | 7 [7] |
| Stays TS (ledger) | 6 [6] |
| **Total** | **80** |

| TS file(s) | Mapped | Divergence | Pending | Gap | Stays TS |
|---|---|---|---|---|---|
| `modelutil.ts` (P2-01) | 5 | 2 | | | |
| `model/resourceid.ts` (P2-01) | 3 | | | | |
| `introspect/*validator.ts` (P2-02) | 10 | | | | 2 |
| `introspect/declaration.ts`, `classdeclaration.ts` and subclasses (P2-03) | 6 | 1 | | 1 | 1 |
| `introspect/property.ts`, `field.ts`, `relationshipdeclaration.ts`, `enumvaluedeclaration.ts` (P2-04) | 7 | | | | |
| `introspect/scalardeclaration.ts` (P2-05) | 1 | | | 1 | |
| `introspect/map*.ts` (P2-06) | 4 | 1 | | 1 | |
| `introspect/decorated.ts`, `decorator.ts`, `decoratorfactory.ts` (P2-07) | 5 | | | 1 | 2 |
| `introspect/modelfile.ts` (P2-08) | 8 | | | | |
| `basemodelmanager.ts`, `modelmanager.ts` (P2-08, P2-08b, P3-04) | 14 | | | 2 | 1 |
| `introspect/metamodel.ts` (P3-04) | | | | 1 | |

Every row names a Rust counterpart or a written reason. No validation-style member in
P2 scope is silently unmapped. The 7 Gap rows are no longer the same 7 as in the partial
audit. `Field.getScalarField`, `Decorator.validate` and `ModelManager.addModel` closed.
`ClassDeclaration.validate`, `ScalarDeclaration.process` and
`BaseModelManager.validateModelFiles` opened, each on a finding recorded in the
addendum.

### Gaps by owner

After the addendum, at `b211ae9`. The partial audit's table, at `fc58371`, is kept in
the addendum under [What changed](#what-changed).

| Owner | What | Fixtures affected | Rows |
|---|---|---|---|
| **P2-09a (#152, open)** | F1, F4: decorator-check order in `ClassDeclaration.validate` and `Decorated.validate`. F2: maps never run the import-clash check. F3: map decorators are checked after key and value. Map key/value decorators are not read. All confirmed still present at `b211ae9` | 16 unsupported (`Decorated.getDecorator`, map key/value decorators); F1-F4 none observed | `ClassDeclaration.validate`, `Decorated.validate`, `MapDeclaration.validate` |
| **P3-04+P4-08** (P3-04 #59 closed; **P4-08 #67 open**) | The native harness can't replay the `metamodelValidation` option. `MetaModel.validateMetaModel`/`modelManagerFromMetaModel` have no dispatch entry, so `validate_ast`/`validate_metamodel` have unit tests but no oracle evidence | 276 unsupported | `validateAst`, `validateMetaModel` (and 171 `addCTOModel`, 85 `addModel` fixtures) |
| **No open owner** (report owner P2-08+P4-08; P2-08 #52 closed, P4-08 #67 open but converts views) | F6: with `decoratorValidation` on, TS's `validateModelFiles` error carries the ` File '<name>': ` suffix twice, and the engine emits it once. These 12 fixtures were unsupported until P2-09b made the option replayable. They are in `baseline.tsv` as known failures | 12 fail | `BaseModelManager.validateModelFiles` |
| **No open owner** (report owner P2-07+P4-05; #51 and #64 closed) | F7: `Decorated.getDecorator` fixture `1dc47e37519c8be0f3870220` (a `decorateModels` result with `decoratorValidation` on): TS encodes argument 2's `array` as `undefined`, and Rust as `null`. It is not a validation-style member, so it is recorded here only | 1 fail | none directly |
| **No open owner** (P2-05 #49 and P2-08c #144 closed) | F5: a String *scalar*'s regex and length validator settings still go through the pre-port `introspect/mod.rs` `check_pattern`/`check_length`, not `validators.rs` `StringValidator::new`. That path throws `IllegalModelException` with Rust wording where TS throws `BaseException`, and it skips the default-value check. Fields were moved to the faithful path by P2-08c. No fixture in the corpus has a String scalar with invalid validator settings | none observed | `ScalarDeclaration.process` |
| **No open owner** (DV-014's follow-up) | `DIVERGENCES.md` DV-014 names #144 (closed) as its post-migration follow-up, not a dedicated `mig:post-migration` issue. P2-08c's review flagged this too | none | `MapValueType.validate` |
| P5-06 (#77, open: mutation testing) | No dedicated unit test for `NumberValidator::new`/`validate`/`compatible_with`, `is_valid_map_key`, `is_valid_map_value`, `get_nested_property`, or the `enforceImportVersioning` and alias-to-primitive loop. Unchanged at `b211ae9`. Oracle-only coverage | none | 7 rows |

"No open owner" means the task that owned the code has closed and no open issue covers the
item. The coordinator needs to assign it, or record that it's accepted.

### Findings (read from the code, no fixture observes them yet)

*Addendum status, at `b211ae9`.* F1-F4 are all still present: `validation.rs` l.464-481
for F1, l.1147-1153 for F2 and F3, and every `check_unique_decorators` call still comes
before `validate_decorators` for F4. P2-09a (#152, open) now owns all four. P2-08c fixed
the "two load-time validator paths" finding for fields but not for String scalars (F5,
in the addendum). It also fixed "model-level checks moved to a different phase":
`MapDeclaration`/`MapValueType` now throw at construction. The line numbers below are
at `fc58371`.

- **F1: `ClassDeclaration.validate` checks decorators last.** TS runs
  `super.validate()` first (`Decorated.validate`, then `Declaration.validate`'s import
  clash), then the super type, the identifier and the duplicate fields. Rust
  (`validation.rs` l.416-439) checks the import clash, the super type, duplicate fields,
  the identifier, super-type identity, and only then the class's own decorators. A class
  with a duplicate decorator *and*, say, a missing super type fails with a different
  error in each. The duplicate-field/identifier inversion in the same function is already
  on P2-08c's list (2 fixtures). The decorator position isn't.
- **F2: `MapDeclaration.validate` never runs the import-clash check.** TS
  `MapDeclaration.validate` calls `super.validate()` (`Declaration.validate`, #648).
  Rust's `impl Validate for MapDeclaration` doesn't call `check_import_clash`; its doc
  comment (`validation.rs` l.306) says this was left to P2-06. A map named like an
  imported type loads in Rust and fails in TS.
- **F3: `MapDeclaration.validate` checks decorators last.** TS: decorators, import
  clash, key, value. Rust: key, value, then decorators.
- **F4: `Decorated.validate` scans for duplicates before validating each decorator.**
  TS runs `Decorator.validate` on each decorator, then the duplicate scan. Rust's
  callers run `check_unique_decorators` before `validate_decorators` everywhere
  (`validation.rs` l.112-113, 375-376, 386-387, 408-409, 428-429, 479-480, 1078-1079).
  This is only observable with `decoratorValidation` on, which the harness can't
  replay (above).
- **Two load-time validator paths.** `introspect/validators.rs` (P2-02) ports
  `NumberValidator`, `StringValidator` and `CollectionSizeValidator` faithfully:
  `BaseException` through `report_error`, and default-value checks. It is used by the
  WASM views, the instance validator and `introspect/field.rs`. The `ModelManager` load
  path doesn't use it: `Property::check_validators` and `ScalarDeclaration::check_validators`
  call the pre-port `introspect/mod.rs` `check_domain`/`check_length`/`check_pattern`/`check_size`
  instead (for scalars only String ones: `ScalarDeclaration::check_validators` calls just
  `check_pattern`/`check_length`, while numeric scalars go through `NumberValidator::new` in
  `ScalarDeclaration::process`). These throw `IllegalModelException` with Rust wording and skip default
  values. That is the root cause of P2-08c's groups A (30 failures) and F (4). It
  is recorded here so the P2-08c fix can remove the duplicate path rather than patch
  its messages.
- **Model-level checks moved to a different phase.** `MapDeclaration.process` and
  `MapValueType.processType` throw at construction in TS. Rust loads the map and rejects
  it at validate time, with its own wording (`validate_map_key`/`validate_map_value`). This
  accounts for P2-08c's 7 `fromAst` failures.

## Per-file audit

One table per TS file or class family. Line numbers are at concerto-rust fc58371. Oracle counts are from the run above.

### src/modelutil.ts: ModelUtil (P2-01)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| getNamespace | RUST P2-01 | `model_util.rs` `get_namespace` (l.96) | `get_namespace_check_get_namespace` | op 5/0/0; "FQN is invalid" error path 94 pass (via `DecoratorManager.decorateModels` 88, `DcsConverter.jsonToYaml` 5) | Mapped |  |
| parseNamespace | RUST P2-01 | `model_util.rs` `parse_namespace` (l.258) | `parse_namespace_valid_with_version`, `_valid_with_version_validation_disabled`, `_invalid_null`, `_invalid_two_at_signs`, `_invalid_version` | op 5/0/0 (error path 3 of them) | Mapped, divergence | DV-003 (d6): TS accepts an unversioned namespace here; Rust follows D6. The unversioned-namespace *ModelFile* failures are a different check (`ModelFile.fromAst`, below). |
| isAssignableTo | RUST P2-01 | `model_util.rs` `is_assignable_to` (l.365) | `model_manager.rs` `ported_members_run_on_the_arena` (incl. the "Cannot find type" error) | op 6/0/0 | Mapped | **Addendum:** on a cyclic super-type chain this now reaches DV-013 (extended by P2-08d #151 to `ModelManager.isAssignableTo`/`is_assignable_to`). No fixture drives it. |
| isValidIdentifier | RUST P2-01 | `model_util.rs` `is_valid_identifier` (l.488) | `id_regex_compiles`, `id_regex_follows_the_ts_classes` | op 9/0/0 (the 2 undecodable arguments replay since P2-09b #153) | Mapped, divergence | DV-002 (ts-bug): TS returns `true` for `undefined`/`null`. Rust takes `&str`, so the two undecodable fixtures are exactly the DV-002 inputs. **Addendum:** P2-09b made `undefined`/`null` decode, and both pass. `isSystemProperty` 28/0/0 and `getFullyQualifiedName` 5/0/0 too. |
| isValidMapKey | RUST P2-01 | `model_util.rs` `is_valid_map_key` (l.606) | none found (oracle only) | op 10/0/0 | Mapped | No dedicated unit test; P5-06 input. |
| isValidMapKeyScalar | RUST P2-01 | `model_util.rs` `is_valid_map_key_scalar` (l.618) | `model_manager.rs` `ported_members_run_on_the_arena` | no op fixtures; the check it serves (`MapKeyType.validate`) is below | Mapped | `validation.rs` `validate_map_key` does not call it: it re-derives the scalar type through `Typed::type_name`. Same answer on every fixture; two implementations of one rule. |
| isValidMapValue | RUST P2-01 | `model_util.rs` `is_valid_map_value` (l.647) | none found (oracle only) | op 10/0/0 | Mapped | No dedicated unit test; P5-06 input. |

### src/model/resourceid.ts: ResourceId (P2-01)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| parseUri (module fn) | RUST P2-01 | `instance/resource_id.rs` `parse_uri` (l.70, crate-private) | `parse_uri_splits_scheme_authority_query_and_fragment`, `parse_uri_with_no_scheme_or_authority_is_all_path`, `parse_uri_non_numeric_port_is_invalid_port` (21 tests in the file) | via `Relationship.fromURI` (18/0/0, stays-ts op) | Mapped |  |
| constructor | HYBRID P2-01 | `instance/resource_id.rs` `ResourceId::new` (l.252) | `resource_id.rs` "ResourceId constructor" tests | "Missing namespace/type/id" error path 3 pass (`Relationship.fromURI`) | Mapped |  |
| fromURI | RUST P2-01 | `instance/resource_id.rs` `ResourceId::from_uri` (l.309) | `resource_id.rs` fromURI tests | "Invalid URI…" error path 3 pass (`Relationship.fromURI`) | Mapped |  |

### src/introspect/validator.ts, numbervalidator.ts, stringvalidator.ts, collectionsizevalidator.ts (P2-02)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Validator.reportError | HYBRID P2-02 | `introspect/validators.rs` `report_error` (l.64) | every rejecting test in `validators.rs` (33 tests) | every `BaseException` "Validator error for field…" that passes, e.g. `StringValidator.validate` 29/0/0 | Mapped |  |
| Validator.validate | TS | (abstract no-op in TS) | - | - | Stays TS | Ledger TS: base-class stub; each subclass has its own `validate`. |
| Validator.compatibleWith | TS | `validators.rs` `Validator::compatible_with` (l.50) dispatches to the three overrides | - | - | Stays TS | Ledger TS (base returns `false`); the overrides are mapped below. |
| NumberValidator.constructor | RUST P2-02 | `validators.rs` `NumberValidator::new` (l.114); since P2-08c the model-load path builds it through `introspect/property.rs` `Property::check_bound_validators` | no dedicated test in `validators.rs` | no direct op; built by `NumberValidator.validate`/`compatibleWith` fixtures (12 pass). Model-load error path: settings 5/0/0, default value outside bounds ("is outside … bound") 4/0/0 | Mapped | **Addendum:** P2-08c (#144) removed the pre-port `check_domain`/`check_size` and routes field loads through `validators.rs`. All 7 former failures pass. A unit-test gap for `NumberValidator::new` itself remains, as a P5-06 input. |
| NumberValidator.validate | RUST P2-02 | `validators.rs` `NumberValidator::validate` (l.197) | no dedicated test in `validators.rs` | op 3/0/0 | Mapped | Unit-test gap: P5-06 input. |
| NumberValidator.compatibleWith | RUST P2-02 | `validators.rs` `NumberValidator::compatible_with` (l.241) | no dedicated test | op 9/0/0 | Mapped |  |
| StringValidator.constructor | HYBRID P2-02 | `validators.rs` `StringValidator::new` (l.505) | `string_validator_rejects_an_invalid_regex`, `_rejects_invalid_regex_flags`, `_accepts_every_valid_regex_flag_once`, `_rejects_length_with_no_bounds`, `_rejects_min_length_above_max_length`, `_rejects_negative_lengths`, `_rejects_a_default_value_shorter_than_min_length`, `_longer_than_max_length`, `_accepts_a_default_value_matching_length_and_pattern` | no direct op. Model-load error path: settings 17/0/0, default value length/regex 16/0/0 (incl. 14 `StringValidator.validate` op fixtures) | Mapped | **Addendum:** fields now go through `StringValidator::new` (P2-08c), and every former failure passes. String *scalars* still do not (F5, see `ScalarDeclaration.process`). |
| StringValidator.validate | HYBRID P2-02 | `validators.rs` `StringValidator::validate` (l.655) | `string_validator_validates_a_matching_string`, `_detects_a_mismatched_string`, the global/sticky-regex tests, `_validates_a_unicode_string`, `_length_only_bounds`, `_length_takes_precedence_over_regex` | op 29/0/0 | Mapped | `options.regExp` stays JS (plan §3). |
| StringValidator.compatibleWith | RUST P2-02 | `validators.rs` `StringValidator::compatible_with` (l.713) | `string_validator_is_incompatible_with_a_number_validator`, `_compatible_with_same_pattern_and_flags`, `_incompatible_with_a_changed_pattern`, `_incompatible_with_changed_flags`, `_length_compatibility` | op 29/0/0 | Mapped |  |
| CollectionSizeValidator.constructor | RUST P2-02 | `validators.rs` `CollectionSizeValidator::new` (l.301) | `collection_size_validator_reads_both_bounds`, `_min_only`, `_rejects_no_bounds`, `_rejects_negative_bounds`, `_rejects_min_above_max`, `_allows_min_equal_max_and_zero` | getters 6/0/0. Model-load error path: settings 9/0/0 | Mapped | **Addendum:** the load path uses `CollectionSizeValidator::new` since P2-08c; `check_size` was removed. |
| CollectionSizeValidator.validate | RUST P2-02 | `validators.rs` `CollectionSizeValidator::validate` (l.361) | `collection_size_validator_validate` | no direct op; "Collection must contain…" error path 8 pass (`Serializer.fromJSON` 4, `Resource.validate` 2, `Serializer.toJSON` 2) | Mapped |  |
| CollectionSizeValidator.compatibleWith | RUST P2-02 | `validators.rs` `CollectionSizeValidator::compatible_with` (l.397) | `collection_size_validator_compatible_with` | op 10/0/0 | Mapped |  |

### src/introspect/declaration.ts, classdeclaration.ts and subclasses (P2-03)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Declaration.process | RUST P2-03 | `introspect/declaration.rs` `check_declaration_name` (l.1231), called from `Declaration::from_model_json` (l.1138) | `a_declaration_name_must_be_an_identifier`, `an_invalid_class_name_is_reported_before_a_system_field_name`, `a_map_with_no_name_is_rejected_as_an_invalid_class_name` | "Invalid class name" error path 1 pass (`ModelManager.fromAst`) | Mapped |  |
| Declaration.validate | RUST P2-03 | `validation.rs` `check_import_clash` (l.308), `is_reserved_system_type_import` (l.335) | `declaration_clashing_with_an_imported_name_is_rejected`, `a_user_declaration_clashes_with_the_implicitly_imported_system_types`, `dangerously_allow_reserved_system_type_names_permits_a_system_name_clash`, `…_does_not_permit_other_clashes`, `declaration_beside_a_distinct_import_is_accepted`, `an_aliased_import_clashes_under_its_alias` | "clashes with an imported type" error path 16/0/2 | Mapped | **Addendum:** P2-08c fixed the 4 `location` failures (an enum now passes its AST location). The map path still skips this check (F2, P2-09a #152), recorded against `MapDeclaration.validate`. |
| ClassDeclaration.declarationKind (and the 6 subclass overrides) | TS | (abstract stub) | - | `*.declarationKind` ops unsupported, stays-ts | Stays TS | Ledger TS: constant-return view members. |
| ClassDeclaration.process | RUST P2-03 | `declaration.rs` `ClassDeclaration::process_decision` (l.371), `ClassDeclaration::from_json` (l.423), `EnumDeclaration::implicit_super_type` (l.753) | `parses_concept_with_typed_properties`, `non_array_properties_is_rejected`, `a_class_declaration_with_no_properties_field_loads_with_none`, `only_the_exact_metamodel_classes_are_recognised`, `a_class_declaration_property_class_may_be_given_as_the_short_name`; `validation.rs` `reserved_field_name_is_rejected_at_load` | "Invalid field name"/"Properties of Class…" error path 9/0/0; "Unrecognised model element" 2/0/0 | Mapped | **Addendum:** the wording failure was fixed by P2-08c (through the error catalogue). |
| EventDeclaration.process | RUST P2-03 | no separate fn: the body is `super.process()`, covered by `ClassDeclaration.process` | - | - | Mapped |  |
| ClassDeclaration._resolveSuperType | RUST P2-03 | `validation.rs` `check_super_type` (l.567); `model_manager.rs` `super_type_fqn` (l.1322), `not_a_class_like` (l.441); `declaration.rs` `kinds_compatible` (l.329) | `super_type_that_exists_passes`, `super_type_that_is_missing_fails`, `super_type_that_is_missing_carries_the_class_ast_location`, `a_participant_cannot_extend_an_asset`, `a_participant_may_extend_a_participant`; `model_manager.rs` `unresolved_super_type_is_hard_error` | "Could not find super type"/"cannot extend" error path 12 pass / 2 unsupported | Mapped |  |
| ClassDeclaration.validate | RUST P2-03 | `validation.rs` `impl Validate for ClassDeclaration` (l.416), `check_unique_field_names` (l.631), `check_identifier` (l.659), `check_identity_matches_super` (l.1009); `declaration.rs` `identifier_redeclare_conflict` (l.339) | `a_class_extending_itself_is_rejected`, `identifier_of_non_string_type_fails`, `identifier_of_string_type_passes`, `identifier_of_string_scalar_type_passes`, `optional_identifier_fails`, `optional_non_string_identifier_reports_the_type_first`, `a_system_identifier_may_not_extend_an_explicit_one`, `an_explicit_identifier_may_not_extend_an_explicit_one`, `field_redeclared_from_super_type_fails`, `unique_field_names_across_inheritance_pass` | op 7/0/0; error path 41/0/4 | Gap | **Addendum:** P2-08c moved the identity checks before the duplicate-field scan, so both former failures pass. Finding F1 remains: the class's own decorators are still checked last (`validation.rs` l.480-481 at `b211ae9`). Owner: P2-09a (#152, open). No fixture observes it. |
| ClassDeclaration.getProperties | RUST P2-03 | `model_manager.rs` `get_all_properties` (l.1016) | `collects_inherited_properties_in_order`, `get_all_properties_on_enum_gives_its_values`, `circular_inheritance_is_a_range_error` | op 88/0/0 | Mapped, divergence | DV-013 (ts-bug): a cyclic chain overflows the stack in TS (`RangeError`); Rust reproduces the class. |
| ClassDeclaration.getNestedProperty | RUST P2-03 | `model_manager.rs` `get_nested_property` (l.1057) | none found (oracle only) | op 4/0/0; error path 2 pass | Mapped | No dedicated unit test; P5-06 input. |

### src/introspect/property.ts, field.ts, relationshipdeclaration.ts, enumvaluedeclaration.ts (P2-04)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Property.process | RUST P2-04 | `introspect/property.rs` `process` (l.56); `TryFrom<&Value> for Property` (l.243) | `process_derives_type_array_and_optional`, `process_object_property_type_is_the_referenced_name`, `process_enum_property_leaves_type_unset`, `process_rejects_an_invalid_identifier`, `a_property_name_must_be_an_identifier`, `unknown_property_kind_errors`, `a_reserved_name_is_rejected_before_the_kind_is_checked` | no direct op; error path ("Invalid property name"/"No name for type") 3/0/0 | Mapped | **Addendum:** all 3 fixed by P2-08c. An `ObjectProperty` with no `type` now loads, as in TS. |
| Field.process | RUST P2-04 | `introspect/field.rs` `process` (WASM view); on the `ModelManager` load path, `introspect/property.rs` `Property::check_bound_validators` (l.468 at `b211ae9`) builds the same `validators.rs` validators | `property.rs` `range_lower_above_upper_is_rejected`, `range_with_one_open_end_is_accepted`, `range_without_either_bound_is_rejected`, `negative_string_length_is_rejected`, `string_length_min_above_max_is_rejected`, `a_regex_validator_must_compile` (these test the pre-port load path, not `introspect/field.rs`) | see the three validator constructors above | Mapped | **Addendum:** P2-08c made the load path construct the faithful validators, so the split this row recorded is gone. Oracle evidence is the three validator-constructor rows above, all 0 fail. |
| Field.getScalarField | RUST P2-04 | `introspect/field.rs` `scalar_to_field_ast` (l.130 at `b211ae9`), added by P4-07a (#154). The TS view delegates to it through the `fieldGetScalarField` WASM binding (concerto 27d62593a) | `maps_every_scalar_class_to_its_property_class`, `errors_on_an_unrecognized_scalar_class` | op 17/0/0; "is not a scalar property" error path 1 pass | Mapped | **Addendum:** the ledger drift is closed. Residual, not a gap: `tests/oracle/ops.rs` `get_scalar_field` still builds the synthetic field itself (it takes the `*Property` class from `ScalarDeclaration::scalar_type`) rather than calling `scalar_to_field_ast`. So the 17 op fixtures check the harness's copy of the rule. P2-09b's review noted the same. |
| Property.validate | RUST P2-04 | `validation.rs` `validate_property` (l.455), `check_property_type` (l.733), `check_size_validator_target` (l.906), `undeclared_type_error` (l.1270) | `object_property_of_undeclared_type_fails`, `object_property_of_declared_type_passes`, `size_validator_on_a_non_array_object_property_of_a_non_map_type_is_rejected`, `…_of_a_map_type_is_allowed`, `size_validator_on_a_map_type_imported_from_another_namespace_is_allowed`, `size_validator_on_a_non_array_primitive_or_relationship_is_rejected_by_validation`, `an_inherited_property_is_validated_in_the_subclass_pass` | no direct op; "size validator can only be applied…" error path 7 pass; "Undeclared type" (resolveType) 17 pass / 5 unsupported | Mapped |  |
| Property.getFullyQualifiedTypeName | RUST P2-04 | `model_manager.rs` `ResolutionContext::get_fully_qualified_type_name` (l.1938); `introspect/model_file.rs` `get_fully_qualified_type_name` (l.450) | `an_aliased_import_s_property_resolves_its_fully_qualified_type_name` | op 63/0/0; error path 2 pass | Mapped |  |
| RelationshipDeclaration.validate | RUST P2-04 | `validation.rs` `check_property_type`, relationship arms (l.733-895) | `relationship_to_primitive_fails`, `relationship_to_unidentified_class_fails`, `relationship_to_identified_class_passes`, `relationship_to_unresolvable_type_fails_with_the_undeclared_type_message`, `a_relationship_to_a_class_identified_only_through_its_super_type_passes` | no direct op; error path 14/0/1 | Mapped | **Addendum:** "Relationship must have a type" fixed by P2-08c (an empty type is now falsy, as in TS). |
| EnumValueDeclaration.validate | RUST P2-04 | body is `super.validate()` (decorators only, no type): `validation.rs` `impl Validate for Declaration`, `Enum` arm (l.365) | `duplicate_decorator_on_an_enum_value_is_rejected`, `duplicate_enum_value_name_is_rejected` | no direct op | Mapped |  |

### src/introspect/scalardeclaration.ts (P2-05)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| ScalarDeclaration.process | RUST P2-05 | `introspect/scalar.rs` `ScalarDeclaration::process` (l.111); `introspect/declaration.rs` `load_scalar` (l.571) | `throws_when_scalar_name_is_a_primitive_type`, `does_not_throw_for_a_valid_scalar_name`, `default_value_*` (3); `declaration.rs` `scalar_with_reversed_range_is_rejected`, `scalar_with_valid_range_is_accepted`, `unknown_scalar_kind_errors` | `ScalarDeclaration.new` 13/0/0; "Invalid scalar name" error path 8 pass | Gap | Only String scalars reach the pre-port path: `ScalarDeclaration::check_validators` (l.373) calls just `check_pattern`/`check_length`, so P2-08c group A applies to String scalars (their regex and length settings) and not to numeric ones, which `ScalarDeclaration::process` (l.146) builds through the faithful `NumberValidator::new`. **Addendum:** **F5.** P2-08c moved *fields* to `validators.rs` but not scalars. `ScalarDeclaration::build_standalone` (`scalar.rs` l.242-257 at `b211ae9`, the standalone `new ScalarDeclaration` path) and `HasValidators::check_validators` (l.373, the model-load path) still call the pre-port `introspect/mod.rs` `check_pattern`/`check_length`. TS `ScalarDeclaration.process` builds `new StringValidator(...)` (scalardeclaration.ts l.105). So an invalid regex or length on a String scalar throws `IllegalModelException` with Rust wording (`Invalid string length on <name>, …`) where TS throws `BaseException` ("Validator error for field …"), and a String scalar's default value is never checked against it. The doc comment at `scalar.rs` l.370 ("`StringValidator` is not ported yet") is stale. No fixture in the corpus observes it. Owner: none open (P2-05 #49, P2-08c #144 closed). |
| ScalarDeclaration.validate | RUST P2-05 | `scalar.rs` `ScalarDeclaration::validate` (l.300); `validation.rs` `Declaration::Scalar` arm (l.397) | `validate_rejects_a_duplicate_fully_qualified_name`, `validate_accepts_unique_fully_qualified_names`, `duplicate_decorator_on_a_scalar_declaration_is_rejected` | no direct op | Mapped | On the manager pass the duplicate-FQN branch is unreachable (ModelFile.validate scans first); documented in `validation.rs` l.398-409. |

### src/introspect/mapdeclaration.ts, mapkeytype.ts, mapvaluetype.ts (P2-06)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| MapDeclaration.process | RUST P2-06 | `introspect/declaration.rs` `MapDeclaration` loader: since P2-08c it throws TS's construction-time `IllegalModelException`s (missing key/value, invalid key/value kind) | `a_map_with_no_key_loads_with_an_empty_key_kind`, `a_map_with_an_unrecognised_key_kind_still_loads`; `validation.rs` `map_missing_its_key_field_is_rejected_at_validate`, `map_missing_its_value_field_is_rejected_at_validate`, `map_key_with_an_unknown_class_is_rejected_at_validate`, `map_value_with_an_unknown_class_is_rejected_at_validate` | no direct op; "MapDeclaration must contain…" error path 4/0/0 | Mapped | **Addendum:** fixed by P2-08c (5f06176). A malformed map is now rejected at load, as in TS, and the unit tests that assumed a validate-time rejection were updated. |
| MapDeclaration.validate | RUST P2-06 | `validation.rs` `impl Validate for MapDeclaration` (l.1074); `validate_detached_declaration` (l.172) | `duplicate_decorator_on_a_map_declaration_is_rejected`, `a_loaded_map_declaration_introspects_as_ts_does`, the 30+ `a_map_*`/`every_*` tests in `validation.rs` | op 34/0/0 | Gap | Findings F2/F3: never runs `Declaration.validate`'s import-clash check (the doc comment on `check_import_clash`, l.306, says so), and checks decorators after key/value where TS checks them first. No fixture observes either. Owner: none open (P2-06 closed); `validation.rs` is in P2-08c's owned paths. **Addendum:** F2/F3 still present at `b211ae9` (`validation.rs` l.1147-1153: key, value, then decorators; no `check_import_clash`). Owner: P2-09a (#152, open). |
| MapKeyType.process / processType | RUST P2-06 | `declaration.rs` `MapDeclaration::key_kind` (l.845), `key_type` (l.875), `key_type_name` (l.901) | `key_type_name_is_string_for_a_string_key`, `…_datetime_…`, `…_the_raw_referenced_name_for_an_object_key` | `MapKeyType.getType` 6/0/0 | Mapped |  |
| MapKeyType.validate | RUST P2-06 | `validation.rs` `validate_map_key` (l.1093); `validate_detached_map_key` (l.191) | `a_map_key_must_be_string_or_datetime`, `a_map_key_kind_outside_the_allowed_set_is_rejected`, `a_scalar_map_key_over_long_integer_double_or_boolean_is_rejected`, `a_map_key_imported_from_another_namespace_and_not_string_or_datetime_is_rejected`, `…_and_is_a_string_scalar_validates`, `an_enum_declaration_as_an_object_map_key_is_rejected` | op 1/0/0; "Scalar must be one of…" error path 37/0/10 | Mapped | **Addendum:** P2-08c removed the stray ` File '…': ` suffix, and all 30 pass. The 10 unsupported use `metamodelValidation` (P4-08). |
| MapValueType.process / processType | RUST P2-06 | `declaration.rs` `value_kind` (l.858), `value_type` (l.886); structural checks run at validate time in `validate_map_value` | `an_object_map_value_missing_its_type_property_is_rejected`, `an_object_map_value_type_missing_its_name_is_rejected`, `an_object_map_value_type_with_a_bad_class_is_rejected`, `value_type_name_covers_every_primitive_kind` | `MapValueType.getType` 7/0/0; "ObjectMapValueType…" error path 3/0/0 | Mapped | **Addendum:** fixed by P2-08c (same change as `MapDeclaration.process`). |
| MapValueType.validate | RUST P2-06 | `validation.rs` `validate_map_value` (l.1139); `validate_detached_map_value` (l.198) | `a_map_value_must_name_a_declared_type`, `a_map_value_may_be_a_relationship`, `a_map_value_may_be_an_enum`, `a_map_value_may_not_be_a_map_declaration`, `every_declared_class_kind_validates_as_a_map_value` | op 1/0/0; error path 1 pass; the 4 undeclared-value-type fixtures (TS `TypeError`) 4/0/0 | Mapped, divergence | **Addendum:** P2-08c reproduces TS's `TypeError` (reading `isMapDeclaration` of `null`) and records it as DV-014 (ts-bug). DV-014's follow-up names #144, which is closed, not a `mig:post-migration` issue: see Gaps by owner. |

### src/introspect/decorated.ts, decorator.ts, decoratorfactory.ts (P2-07)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Decorated.constructor | HYBRID P2-07 | `introspect/model_file.rs` `ModelFile::check_constructor_arguments` (l.202) for the `ast not specified` check | `constructor_arguments_are_checked_in_ts_order` | `ModelFile.new` "ast not specified" 1 pass | Mapped | Only `ModelFile` can receive a missing AST in Rust; every other `Decorated` is built from an AST node the loader already holds. |
| Decorated.process | HYBRID P2-07 | `introspect/decorator.rs` `parse_decorators` (l.502) | `reads_every_argument_kind` | `Decorated.getDecorators` 5/0/2, `getDecorator` 57/0/21 | Mapped |  |
| Decorated.getModelFile | TS | (abstract stub) | - | - | Stays TS | Ledger TS. |
| Decorated.validate | RUST P2-07 | `validation.rs` `check_unique_decorators` (l.534), `validate_decorators` (l.518) | `duplicate_decorator_is_rejected`, `distinct_decorators_are_accepted`, `duplicate_decorator_on_an_enum_declaration_is_rejected`, `…_on_a_scalar_declaration_…`, `…_on_a_map_declaration_…`, `…_on_an_enum_value_…`, `…_on_a_namespace_…`, `…_on_a_declaration_…` | "Duplicate decorator" error path 94 pass / 1 unsupported | Gap | Finding F4: TS validates each decorator before the duplicate scan; Rust scans first. Observable only with `decoratorValidation` on and both faults on one element, and the harness cannot replay that option (next row). Owner: none open (P2-07 closed); `validation.rs` is in P2-08c's owned paths. **Addendum:** F4 still present at `b211ae9`. P2-09b made `decoratorValidation` replayable, but no fixture has both faults on one element. Owner: P2-09a (#152, open). |
| Decorator.process | RUST P2-07 | `decorator.rs` `Decorator::from_ast` (l.89) | `stores_name_and_string_arguments`, `no_arguments_field_gives_an_empty_list`, `reads_every_argument_kind`, `a_short_class_is_accepted_for_the_type_reference` | `Decorator.getArguments` 43/0/0 | Mapped |  |
| Decorator.validate | RUST P2-07 | `decorator.rs` `Decorator::validate` (l.148), `try_validate` (l.165), `check_argument` (l.269), `check_type_reference_argument` (l.318) | `validate_is_a_no_op_when_disabled`, `missing_decorator_error_reports_the_undeclared_type_wrapped_once`, `missing_decorator_off_is_silent`, `too_few_arguments_is_reported_through_invalid_decorator` | op 2/0/0; "Decorator … has/references" error path 164 = 156 pass (`DecoratorManager.decorateModels`) / 8 fail (`validateModelFiles`) / 0 unsupported | Mapped | **Addendum:** P2-09b (#153) taught `tests/oracle/recipe.rs` to replay `decoratorValidation`, so the 42 fixtures run. The 8 failures are F6, a doubled ` File '…': ` suffix that TS adds and the engine does not. They are recorded against `BaseModelManager.validateModelFiles`, which composes the message; the decorator text itself matches. |
| Decorator.handleError | HYBRID P2-07 | `decorator.rs` `handle` (l.387), `rethrow` (l.407) | `too_few_arguments_is_reported_through_invalid_decorator`, `missing_decorator_off_is_silent` | via `Decorator.validate` | Mapped | The `Logger.dispatch` half is not ported: nothing observes a log line (reason in `decorator.rs` l.385). |
| DecoratorFactory.newDecorator | TS | (abstract stub) | - | fixtures with a decorator factory are unsupported, stays-ts (`@@oracle:decoratorfactory`, 32 across 7 ops) | Stays TS | Ledger TS. |

### src/introspect/modelfile.ts: ModelFile (P2-08)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| constructor | HYBRID P2-08 | `introspect/model_file.rs` `ModelFile::check_constructor_arguments` (l.202), `from_json_with_definitions` (l.71) | `constructor_arguments_are_checked_in_ts_order`, `missing_namespace_is_rejected`, `non_array_declarations_or_imports_is_rejected`, `keeps_the_ast_it_was_given_in_its_original_key_order` | `ModelFile.new` 196/0/0 | Mapped | **Addendum:** the 4 validator-settings failures were fixed by P2-08c. |
| fromAst | RUST P2-08 | `model_file.rs` `from_json_with_definitions` (l.71), `split_versioned_namespace` (l.738), `built_in_import` (l.660); `introspect/import.rs` `Import::try_from` (l.126) | `parses_namespace_imports_and_declarations`, `unversioned_namespace_is_rejected`, `duplicate_declaration_is_accepted_at_construction_and_the_last_wins`; `import.rs` `wildcard_import_is_rejected`, `resolves_multi_import_with_alias` | error path 16/0/3 ("unversioned namespace" 10/0/3, "Invalid namespace part" 1/0/0, "Unrecognised model element" 2/0/0, of which 1 is `ClassDeclaration.process`'s) | Mapped | **Addendum:** P2-08c (7b84165): an unversioned namespace is now a plain `Error`, and "Invalid namespace part" goes through the catalogue. |
| enforceImportVersioning | RUST P2-08 | inline in `from_json_with_definitions` (l.113-137), with the alias-to-primitive check | none found (oracle only) | "Cannot use an unversioned import" error path 9 pass / 2 unsupported | Mapped | No dedicated unit test; P5-06 input. |
| isCompatibleVersion | RUST P2-08 | `model_file.rs` `check_compatible_version` (l.701); `semver_range.rs` | `a_concerto_version_satisfied_by_this_runtime_is_recorded_verbatim`, `a_v3_concerto_version_is_accepted_for_backward_compatibility`, `an_unsatisfiable_concerto_version_is_rejected`, `no_concerto_version_at_all_leaves_it_none`; 7 `semver_range.rs` tests | `ModelFile.getConcertoVersion` 2/0/0; error path 4 pass / 1 unsupported | Mapped |  |
| validate | RUST P2-08 | `validation.rs` `ModelManager::validate_model_file` (l.110), `validate_detached_model_file` (l.142), `check_imports` (l.958), `check_unique_declaration_names` (l.251), `attach_model_file` (l.284) | `importing_from_the_files_own_namespace_is_rejected`, `importing_a_type_that_does_not_exist_is_rejected`, `importing_a_declared_type_is_accepted`, `importing_two_versions_of_one_namespace_is_rejected`, `duplicate_declaration_is_accepted_on_load_and_rejected_by_validation`, `duplicate_declaration_scan_runs_between_imports_and_declarations`, `a_detached_model_file_validates_against_its_manager` | op 17/0/0; "Duplicate class name"/"different versions" error path 40/0/7; "Namespace is not defined"/"Type … is not defined" 463/0/34 (exact, from `baseline.tsv`; the partial audit's heuristic gave 463/2/32) | Mapped | **Addendum:** both P2-08d (#151) failures pass: the self-import message (`c1b21256…`) and `getIdentifierFieldName` (`557a5087…`). |
| resolveType | RUST P2-08 | `validation.rs` `resolve` (l.925), `undeclared_type_error` (l.1270); `model_file.rs` `resolve_local_type` (l.297); `decorator.rs` `resolve_own_name` (l.242) | `relationship_to_unresolvable_type_fails_with_the_undeclared_type_message`, `object_property_of_undeclared_type_fails`, `resolves_local_primitive_and_import` | "Undeclared type" error path 17 pass / 5 unsupported | Mapped |  |
| resolveImport | RUST P2-08 | `model_file.rs` `resolve_import` (l.414) | `resolve_import_failure_lists_the_imports_as_ts_stringifies_them`, `resolves_and_reports_imported_types_by_their_visible_local_name` | op 8/0/0; error path 1 pass | Mapped |  |
| getLocalType | RUST P2-08 | `model_file.rs` `get_local_type` (l.376); `model_manager.rs` `local_type` (l.1355) | - | `ModelFile.getType` 34/0/0, `isLocalType` 2/0/0 | Mapped | TS's only throw ("local types are not yet initialized") cannot happen in Rust: the local-type index is built inside the constructor, before any caller can reach it. |

### src/basemodelmanager.ts, modelmanager.ts: BaseModelManager / ModelManager (P2-08, P2-08b)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| addRootModel, addDecoratorModel | RUST P2-08 | `model_manager.rs` `ModelManager::new` (l.494) | `preloads_system_model`, `preloads_decorator_model_before_root_model` | `ModelManager.new` 8/0/4 | Mapped | TS throws only if the bundled JS module lacks its export; the Rust models are compiled in (`rootmodel.rs`, `decoratormodel.json`), so there is nothing to port. |
| _throwAlreadyExists | RUST P2-08b | `model_manager.rs` `already_exists` (l.457) | `duplicate_namespace_rejected`, `duplicate_namespace_names_both_files`, `duplicate_namespace_without_file_names`, `add_models_rejects_a_duplicate_namespace_with_the_ts_message` | "is already declared" error path 17 pass | Mapped |  |
| addModelFile | RUST P2-08 | `model_manager.rs` `add_model` (l.518) + `validation.rs` `validate_detached_model_file` | `a_failed_load_changes_nothing`, `handles_survive_later_loads` | op 92/0/0 | Mapped | "Cannot add an unversioned namespace" is unreachable in both: constructing the `ModelFile` rejects it first. No fixture records it. |
| validateModelFile | HYBRID P2-08 | `validation.rs` `validate_detached_model_file` (l.142); a string input is parsed in JS | `a_detached_model_file_validates_against_its_manager` | op 5/0/0 | Mapped |  |
| validateModelFiles | RUST P2-08 | `validation.rs` `ModelManager::validate_models` (l.64) | `test_fresh_model_manager_is_valid`, `add_models_rejects_a_duplicate_declaration_at_validation` | op 364/12/0 | Gap | **Addendum:** P2-08c fixed all 18 former failures, and P2-09b made the 16 `decoratorValidation` fixtures replayable. **F6:** 12 of those now fail on a message mismatch. With `decoratorValidation` on, TS's error ends in ` File 'test.cto':  File 'test.cto': ` (the suffix twice), and the engine gives it once (e.g. `0c3b211e…`, `63b2562d…`, `32914285…`). They are 8 decorator-argument errors and 4 "Undeclared type" errors. `baseline.tsv` records them as known failures. Owner: none open (report owner P2-08+P4-08; P2-08 #52 closed, P4-08 #67 is the view conversion). |
| updateModelFile | HYBRID P2-08b | `model_manager.rs` `update_model_file` (l.1715) | `update_model_file_replaces_the_registered_file`, `update_model_file_rejects_an_unregistered_namespace` | op 6/0/0; error path 2 pass | Mapped |  |
| deleteModelFile | RUST P2-08b | `model_manager.rs` `delete_model_file` (l.1742) | `delete_model_file_removes_the_namespace`, `delete_model_file_rejects_an_absent_namespace` | op 5/0/0; error path 1 pass | Mapped |  |
| addModelFiles | HYBRID P2-08 | `model_manager.rs` `add_models` (l.571), `insert_models` (l.1814) | `add_models_relaxes_import_order`, `add_models_rolls_back_the_whole_batch_on_validation_failure`, `add_models_rolls_back_on_duplicate_namespace_within_the_batch`, `…_against_an_existing_model`, `add_models_leaves_pre_existing_models_validating_on_success` | op 52/0/0 | Mapped |  |
| updateExternalModels | HYBRID P2-08b | `model_manager.rs` `update_external_models` (l.1779); downloading stays JS | `update_external_models_adds_then_updates_a_namespace`, `…_with_nothing_downloaded_still_validates`, `…_rolls_back_when_validation_fails` | op 6/0/0 | Mapped | **Addendum:** the 2 `net`-body fixtures replay since P2-09b (concerto bf4eea232 collects them in the CTO cache) and pass. |
| writeModelsToFileSystem | TS | - | - | op 0/0/3, stays-ts | Stays TS | Ledger TS (file-system I/O). |
| resolveType | RUST P2-08b | `model_manager.rs` `resolve_type` (l.1417) | `resolve_type_passes_primitives_through`, `resolve_type_resolves_a_local_type`, `resolve_type_rejects_an_unregistered_namespace`, `resolve_type_rejects_an_imported_name` | op 5/0/0; error path 76 pass | Mapped |  |
| getType | RUST P2-08 | `model_manager.rs` `get_type_declaration` (l.874) | `resolves_by_exact_fqn_only`, `get_type_follows_model_file_get_type` | op 673/0/9 (9 decorator-factory, stays-ts) | Mapped |  |
| resolveMetaModel | RUST P2-08b | `model_manager.rs` `resolve_meta_model` (l.1575), `resolve_local_names` (l.2476) | `resolve_meta_model_resolves_an_imported_super_type`, `…_rejects_an_unresolvable_name`, `…_rejects_an_import_of_an_undeclared_type`, `…_accepts_an_empty_import_types_from_an_unknown_namespace` | op 4/0/0 | Mapped |  |
| fromAst | RUST P2-08 | no library fn: `tests/oracle/recipe.rs` (l.1986) composes it from `ModelFile::from_json`, `add_model` and `validate_models` | - | op 37/0/0 | Mapped | **Addendum:** all 21 former failures fixed by P2-08c. There is still no library entry point: `tests/oracle/recipe.rs` composes it, which is P4-08's to add (#67, open) if the view needs one. |
| ModelManager.addCTOModel | HYBRID P2-08 | CTO parsing stays JS; the Rust half is `add_model` + `validate_detached_model_file` | (as `addModelFile`) | op 1241/0/176 | Mapped | **Addendum:** the 54 P2-08c and 1 P2-08d failures pass. The 19 `decoratorValidation` fixtures replay since P2-09b and pass. The 176 unsupported are 171 `metamodelValidation` (P4-08 #67) and 5 decorator factory (stays-ts). |
| addModel | HYBRID P2-08 | a string input is parsed in JS (`processFile`); an AST input goes to `model_manager.rs` `add_model` (l.518) + `validation.rs` `validate_detached_model_file` (l.142) (as `addModelFile`) | (as `addModelFile`) | op 88/0/85 | Mapped | **Addendum:** P2-09b (concerto bf4eea232) collects the `String(input)` texts in the CTO cache, and all 87 now pass. The 85 still unsupported use `metamodelValidation`, the same P4-08 (#67) gap as `addCTOModel`, so this row now counts as Mapped on the same grounds as `addCTOModel`. |
| validateAst | RUST P3-04 | `instance/metamodel.rs` `validate_ast` (l.133) | 10 tests in `instance/metamodel.rs` | no fixture replays it natively | Gap | Harness gap: the `metamodelValidation` option is "not modelled by the Rust engine yet", 276 fixtures unsupported (171 `addCTOModel`, 85 `addModel`, …), report owner P3-04+P4-08. P3-04 (#59) is closed, P4-08 (#67) is open. |

### src/introspect/metamodel.ts (P3-04)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| validateMetaModel | RUST P3-04 | `instance/metamodel.rs` `validate_metamodel` (l.104) | 10 tests in `instance/metamodel.rs` | `MetaModel.validateMetaModel` 0/0/12 ("not ported yet": no harness dispatch) | Gap | Owner P3-04+P4-08, as `validateAst`. |

## Outside this partial audit

The addendum didn't extend this section. It re-checked only the oracle counts, which are
unchanged except where the table says so.

These TS files hold validation-style members too, but their units (P2-12, P3-01a/b,
P3-04, P4-09, P4-10) weren't in the approved scope. The table records the ledger
classification, the Rust counterpart and the oracle rule. It does not claim a
member-by-member review. The full audit (#53's description: all 59 source files) still
has to cover them.

| TS file | Validation-style members | Ledger | Rust counterpart | Unit tests | Oracle (op p/f/u) | DIVERGENCES |
|---|---|---|---|---|---|---|
| `serializer/resourcevalidator.ts` | `visitClassDeclaration`, `visitField`, `visitEnumDeclaration`, `visitMapDeclaration`, `visitRelationshipDeclaration`, `checkEnum`, `checkArray`, `checkItem`, `checkMapType`, `checkRelationship`, 9 `report*` | HYBRID P3-01+P4-10 | `instance/validate.rs` (`visit_class_declaration` l.216 … `invalid_field_assignment` l.1697) | 59 in `instance/validate.rs` | `Serializer.fromJSON` 2074/0/0, `Serializer.toJSON` 1776/0/0, `Resource.validate` 73/0/0 | DV-006, DV-007, DV-008 |
| `serializer/jsonpopulator.ts` | `validateProperties`, `getAssignableProperties`, `visitField`, `convertToObject`, `visitRelationshipDeclaration`, `processMapType` | RUST/HYBRID P3-01+P4-10 | `instance/populator.rs` (`get_assignable_properties` l.237, `validate_properties` l.278, `process_map_type` l.508, `visit_field` l.557, `convert_to_object` l.627, `visit_relationship_declaration` l.636) | 1 | via `Serializer.fromJSON` | DV-010, DV-011, DV-012 |
| `serializer/jsongenerator.ts` | `visitClassDeclaration`, `getRelationshipText` (HYBRID); `visit` (TS) | HYBRID / TS | `instance/generator.rs` (l.144, l.340) | 0 | via `Serializer.toJSON` | DV-010 |
| `serializer/instancegenerator.ts` | `visit`, `visitField` (TS); `findConcreteSubclass` (RUST) | TS / RUST P3-01+P4-10 | none for `findConcreteSubclass`; `InstanceGenerator` stays TS (D7) | - | `Factory.newResource` generate path 1264 unsupported, stays-ts | ledger drift to check: `findConcreteSubclass` is RUST in the ledger |
| `serializer.ts` | `toJSON`, `fromJSON` (HYBRID); constructor (TS) | HYBRID P3-01+P4-10 | `instance/serializer.rs` `to_json` l.144, `from_json` l.85 | 13 | `Serializer.new` 162/0/0 | |
| `factory.ts` | `newResource`, `newRelationship`, `newTransaction`, `newEvent` | TS | `instance/factory.rs` `check_new_resource` l.65, `new_resource` l.272, `new_relationship` l.286, `new_transaction` l.359, `new_event` l.383 (P3-01b) | 3 | `Factory.newResource` 131/0/1264, `newRelationship` 37/0/0, `newTransaction` 10/0/0, `newEvent` 5/0/0 | ledger drift to check: TS in the ledger, ported by P3-01b |
| `model/validatedresource.ts` | `validate`, `setPropertyValue`, `addArrayValue` | TS | `instance/resource.rs` `validate` l.124, `set_property_value` l.32, `add_array_value` l.74 | 0 | `Resource.validate` 73/0/0, `setPropertyValue` 53/0/0, `addArrayValue` 6/0/0 | ledger drift to check, as for `factory.ts` |
| `decoratormanager.ts` | `validate`, `validateCommand`, `checkForDuplicateDecorators`, `checkForNamespaceTargetAndApplyDecorator`, `decorateModels`, `applyDecorator` | HYBRID/RUST P4-09 | `dcs/mod.rs` `validate` l.1197, `validate_command` l.710, `check_for_duplicate_decorators` l.400, `check_for_namespace_target_and_apply_decorator` l.532, `decorate_models` l.1322, `apply_decorator` l.427 | 35 in `dcs/mod.rs`, 29 in `dcs/decoratormanager_tests.rs` | `DecoratorManager.validate` 23/0/0, `decorateModels` 1300/0/1 (addendum: 1301/0/0) | |
| `decoratorextractor.ts` | `parseVocabularies`, `process*` | RUST P4-09 | `dcs/extractor.rs` `parse_vocabularies` l.352 | 3 | `DecoratorManager.extractVocabularies` 69/0/0 | |
| `dcsconverter.ts` | conversion validation | P2-12/P4-09 | `dcs/dcsconverter.rs` | 15 | `DcsConverter.*` 26/0/0 | |
| `datetimeutil.ts` | `setCurrentTime` | TS | - | - | unsupported, stays-ts | |

## Pending: P2-08c (#144) (closed, see the addendum)

*This section is the partial audit's record at `fc58371`, kept as it was. Every item in
it is resolved in the [addendum](#addendum-after-p2-08c-p2-08d-p2-09b-and-p4-07a).*

P2-08c ("Fix the introspect root causes behind ~95 ModelManager oracle failures") is
open. cloud-3 owns it, and its PR #148 is in flight. It owns
`concerto-core/src/introspect/property.rs`, `scalar.rs`, `model_file.rs` and
`validation.rs`, plus Rust tests for each fix. The starting list is the corrected
98-failure list the maintainer posted on accordproject/concerto-rust#140 on 2026-09-25.
Since then, #151 (P2-08d) has taken the self-import message, so **97 remain with
P2-08c**. This audit's run at fc58371 reproduces exactly that list. Every one of the 99
failures in the run is either below or one of P2-08d's 2.

**By op (97):** `ModelManager.addCTOModel` 54, `ModelManager.fromAst` 21,
`ModelManager.validateModelFiles` 18, `ModelFile.new` 4.

| # | Root cause (from #140) | Fixtures | Ops | TS member(s) whose check it is | Rust file(s) |
|---|---|---|---|---|---|
| A | Invalid validator settings: TS throws concerto-util `BaseException` (through `Validator.reportError`), Rust `IllegalModelException`, because the load path uses `introspect/mod.rs` `check_*`, not `validators.rs` | 30 | `ModelFile.new` 4, `addCTOModel` 17, `fromAst` 9 | `NumberValidator.constructor`, `StringValidator.constructor`, `CollectionSizeValidator.constructor` | `introspect/validators.rs`, `property.rs`, `scalar.rs` (`check_validators`) |
| B | Map-key scalar error gets a ` File '…': ` suffix; TS `MapKeyType.validate` passes no model file | 30 | `addCTOModel` 20, `validateModelFiles` 10 | `MapKeyType.validate` | `validation.rs` (`validate_map_key`) |
| C | Unversioned namespace: TS plain `Error`, Rust `IllegalModelException` | 10 | `addCTOModel` 10 | `ModelFile.fromAst` | `introspect/model_file.rs` (`split_versioned_namespace`) |
| D | `MapDeclaration`'s construction-time structural checks are missing ("must contain Key & Value", "valid MapKeyType/MapValueType", "ObjectMapValueType must contain property 'type'" …) | 7 | `fromAst` 7 | `MapDeclaration.process` (4), `MapValueType.processType` (3) | `introspect/declaration.rs` |
| E | Undeclared map value type: TS `TypeError` (reading `isMapDeclaration` of `null`), Rust `IllegalModelException`; fix it or record a `ts-bug` divergence | 4 | `addCTOModel` 1, `validateModelFiles` 3 | `MapValueType.validate` | `validation.rs` |
| F | Default values not checked against their validators | 4 | `addCTOModel` 4 | `NumberValidator.constructor` (2), `StringValidator.constructor` (2) | `introspect/property.rs`, `validators.rs` |
| G | Error `location` null where TS has one (import clash) | 4 | `validateModelFiles` 4 | `Declaration.validate` | `validation.rs` |
| H | "Super class … has an explicit identifier … cannot be redeclared": Rust's duplicate-field scan runs first | 2 | `addCTOModel` 2 | `ClassDeclaration.validate` | `validation.rs` |
| I | Single mismatches: "Invalid property name" wording; "No name for type" (TS plain `Error`); `ObjectProperty` with no `type` (TS accepts); "Unrecognised model element" wording; "Invalid namespace part" wording; "Relationship must have a type" | 6 | `fromAst` 5, `validateModelFiles` 1 | `Property.process` (3), `ClassDeclaration.process` (1), `ModelFile.fromAst` (1), `RelationshipDeclaration.validate` (1) | `introspect/property.rs`, `model_file.rs`, `validation.rs` |
| | **Total** | **97** | | | |

**ModelManager, BaseModelManager and ModelFile rows that stay "Mapped, pending" until
#144 closes** (a fixture appears once under the TS member whose check it is and once under
its op, so the two columns overlap: `ModelFile.fromAst`'s 11 are 10 `addCTOModel` and 1
`fromAst` fixtures):

| TS member | Failures pending | Groups |
|---|---|---|
| `ModelFile` constructor | 4 | A |
| `ModelFile.fromAst` | 11 | C 10, I 1 |
| `ModelFile.validate` | 0 with P2-08c (2 with P2-08d) | - |
| `ModelManager.addCTOModel` | 54 (+1 P2-08d) | A 17, B 20, C 10, E 1, F 4, H 2 |
| `BaseModelManager.fromAst` | 21 | A 9, D 7, I 5 |
| `BaseModelManager.validateModelFiles` | 18 | B 10, E 3, G 4, I 1 |

The introspect rows that surface through these ops (`*Validator.constructor`,
`Declaration.validate`, `ClassDeclaration.process`, `ClassDeclaration.validate`,
`Property.process`, `Field.process`, `RelationshipDeclaration.validate`,
`MapDeclaration.process`, `MapKeyType.validate`, `MapValueType.processType`,
`MapValueType.validate`) are pending the same fixes.

**Not in P2-08c's list, but in the same files.** These findings are in paths P2-08c
owns. They are noted here so its reviewer can decide whether to take them or leave them
for a follow-up. This audit doesn't assign them.

- F1 (`ClassDeclaration.validate` checks decorators last), F2 (maps skip the import-clash
  check), F3 (maps check decorators last) and F4 (duplicate scan before
  `Decorator.validate`), all in `validation.rs`.
- The duplicate validator path in `introspect/mod.rs`, behind groups A and F.

**Addendum checklist for when #144 (and #151) close:**

1. Re-run the native oracle on the new integration head with the same corpus, and
   confirm `fail` is 0, or that the remainder are `DIVERGENCES.md` rows.
2. Move the 19 "Mapped, pending" rows to Mapped (or Mapped, divergence), and update
   their oracle counts.
3. Record where F1-F4 ended up: fixed, a DIVERGENCES row, or an issue with an owner.
4. Re-check the Gap rows whose owner is P4-08 (#67), which is still open.

## Addendum: after P2-08c, P2-08d, P2-09b and P4-07a

Written 2026-09-25, when #144 (P2-08c), #151 (P2-08d), #153 (P2-09b) and #154 (P4-07a)
had closed. It follows the checklist above.

**Heads audited.** concerto-rust `claude/tender-pascal-ocwf9q` at `b211ae9`: P2-08c
merged as 3133108, P2-08d as 1e586c2, P4-07a as eb37a02 and P2-09b as b211ae9.
concerto at `0c62e492f`: P4-07a's view delegation 27d62593a and P2-09b's CTO-cache
change bf4eea232.

**Corpus.** The canonical `oracle-corpus-p107-06aa375`: the downloaded tarball's
sha256 is `e8a2bf72…9fce1`, it has 16,704 files, and `diff -r` against the corpus used
here shows no differences. `migration/ledger/` is next to it. The CTO cache is the one
next to the corpus (last written 2026-09-25 18:52). The addendum didn't rebuild it. All 87
non-string `addModel` inputs and both `updateExternalModels` bodies replay from it and pass.

**Error-path counts.** Here they are exact, not heuristic: a fixture counts as unsupported
when it is absent from `baseline.tsv`, and as failing when `baseline.tsv` records `fail:*`.
Re-deriving the partial audit's counts this way from `baseline.tsv` at `fc58371`
reproduces all the counts for the pending rows. The shared "Namespace is not defined"
text differs (463/2/32 heuristic, 461/2/34 exact), and its row says so. Rows the
addendum didn't touch keep the partial audit's heuristic counts. Each of the 99
`fc58371` failures passes at `b211ae9`. Each of the 13 `b211ae9` failures was absent
(unsupported) from the `fc58371` baseline. No fixture went from pass to anything else.

### Checklist

1. **Oracle re-run.** `fail` is 13, not 0. 16085 fixtures: 13706 pass, 13 fail, 2366
   unsupported, 0 harness errors, 0 regressions. None of the 97 P2-08c failures or the
   2 P2-08d failures remains: all 99 pass. The 13 failures are new. They were unsupported at
   `fc58371`, and P2-09b made them replayable. Neither is a `DIVERGENCES.md` row:
   - **F6** (12, `ModelManager.validateModelFiles`, report owner P2-08+P4-08): with
     `decoratorValidation` on, TS's message ends in the ` File '<name>': ` suffix twice,
     and the engine appends it once. 8 are decorator-argument errors (`Decorator … has
     …`/`references …`) and 4 are "Undeclared type" errors.
   - **F7** (1, `Decorated.getDecorator` `1dc47e37519c8be0f3870220`, report owner
     P2-07+P4-05): argument 2's `array` is `undefined` in TS and `null` in Rust.
   Neither has an open owner.
2. **The 19 "Mapped, pending" rows.** 16 are now Mapped, and 1 is Mapped, divergence
   (`MapValueType.validate`, DV-014). 2 are now Gap, each on a finding that is not a
   P2-08c item: `ClassDeclaration.validate` (F1) and `BaseModelManager.validateModelFiles`
   (F6). Separately, `ScalarDeclaration.process` went from Mapped to Gap (F5). The
   table below lists every row that changed.
3. **F1-F4.** None is fixed. P2-09a (#152, open, created from the partial audit) owns
   all four, plus the map key/value decorators (16 unsupported). They are still present at
   `b211ae9`: see the note under [Findings](#findings-read-from-the-code-no-fixture-observes-them-yet).
4. **P4-08 (#67) rows.** `validateAst` and `validateMetaModel` stay Gap. P4-08 is still
   open, and `metamodelValidation` still isn't replayed (276 unsupported:
   `addCTOModel` 171, `addModel` 85, `MetaModel.validateMetaModel` 12,
   `modelManagerFromMetaModel` 4, `ModelManager.new` 2, `ModelManager.getAst` 1,
   `BaseModelManager.new` 1).

### What changed

| Row | Partial audit (`fc58371`) | Addendum (`b211ae9`) | Closed by |
|---|---|---|---|
| `NumberValidator.constructor` | Mapped, pending (7 fail) | Mapped | P2-08c |
| `StringValidator.constructor` | Mapped, pending (18 fail) | Mapped (String scalars: F5) | P2-08c |
| `CollectionSizeValidator.constructor` | Mapped, pending (9 fail) | Mapped | P2-08c |
| `Declaration.validate` | Mapped, pending (4 fail) | Mapped | P2-08c |
| `ClassDeclaration.process` | Mapped, pending (1 fail) | Mapped | P2-08c |
| `ClassDeclaration.validate` | Mapped, pending (2 fail) | **Gap** (F1) | failures: P2-08c; F1 open with P2-09a |
| `Property.process` | Mapped, pending (3 fail) | Mapped | P2-08c |
| `Field.process` | Mapped, pending | Mapped | P2-08c |
| `Field.getScalarField` | Gap (ledger drift) | Mapped | P4-07a |
| `RelationshipDeclaration.validate` | Mapped, pending (1 fail) | Mapped | P2-08c |
| `ScalarDeclaration.process` | Mapped | **Gap** (F5) | new finding |
| `MapDeclaration.process` | Mapped, pending (4 fail) | Mapped | P2-08c |
| `MapKeyType.validate` | Mapped, pending (30 fail) | Mapped | P2-08c |
| `MapValueType.process / processType` | Mapped, pending (3 fail) | Mapped | P2-08c |
| `MapValueType.validate` | Mapped, pending (4 fail) | Mapped, divergence (DV-014) | P2-08c |
| `Decorator.validate` | Gap (harness can't replay `decoratorValidation`) | Mapped (F6 is recorded on `validateModelFiles`) | P2-09b |
| `ModelFile` constructor | Mapped, pending (4 fail) | Mapped | P2-08c |
| `ModelFile.fromAst` | Mapped, pending (12 fail) | Mapped | P2-08c |
| `ModelFile.validate` | Mapped, pending (2 fail) | Mapped | P2-08d |
| `BaseModelManager.validateModelFiles` | Mapped, pending (18 fail, 16 unsupported) | **Gap** (F6, 12 fail) | failures: P2-08c; F6 no open owner |
| `BaseModelManager.fromAst` | Mapped, pending (21 fail) | Mapped | P2-08c |
| `ModelManager.addCTOModel` | Mapped, pending (55 fail) | Mapped | P2-08c, P2-08d, P2-09b |
| `ModelManager.addModel` | Gap (1/0/172) | Mapped (88/0/85) | P2-09b |
| `updateExternalModels` | Mapped (4/0/2) | Mapped (6/0/0) | P2-09b |
| `ModelUtil.isValidIdentifier` | Mapped, divergence (7/0/2) | Mapped, divergence (9/0/0) | P2-09b |

All 19 pending rows are resolved: 16 to Mapped, 1 to Mapped, divergence, and 2 to Gap
(`ClassDeclaration.validate`, `validateModelFiles`). Also, 3 former Gap rows closed
(`Field.getScalarField`, `Decorator.validate`, `addModel`), and 1 former Mapped row
became a Gap (`ScalarDeclaration.process`). Totals: 45 + 16 + 3 − 1 = 63 Mapped, 3 + 1 =
4 divergence, 7 − 3 + 2 + 1 = 7 Gap, 6 Stays TS.

The partial audit's gaps-by-owner table, at `fc58371`, for the record:

| Owner | What | Fixtures affected | Rows |
|---|---|---|---|
| **P2-08c (#144, open)** | 97 oracle failures, listed in [Pending](#pending-p2-08c-144) | 97 fail | 19 "Mapped, pending" rows |
| **P2-08d (#151, open)** | Self-import message (`ModelManager.addCTOModel` `c1b21256…`); `ClassDeclaration.getIdentifierFieldName` `557a5087…` gives "Type … not found" instead of "Namespace is not defined for type …" | 2 fail | `ModelFile.validate`, `ModelManager.addCTOModel` |
| **P3-04+P4-08** (P3-04 #59 closed; **P4-08 #67 open**) | The native harness can't replay the `metamodelValidation` option, and `MetaModel.validateMetaModel`/`modelManagerFromMetaModel` have no dispatch entry, so `validate_ast`/`validate_metamodel` have no oracle evidence, only unit tests | 276 unsupported | `validateAst`, `validateMetaModel`, `addModel` (85) |
| **No open owner** (report owner P2-07+P4-05; #51 and #64 closed) | The native harness can't replay the `decoratorValidation` option (`tests/oracle/recipe.rs` l.1338), although the engine supports it (`ModelManager::set_decorator_validation`). No fixture checks `Decorator.validate`'s argument checks inside a model load. | 42 unsupported | `Decorator.validate` |
| **No open owner** (report owner P2-06+P4-07; #50 and #66 closed) | The Rust `MapDeclaration` doesn't read the decorators on a map's key or value | 16 unsupported (`Decorated.getDecorator`) | none directly (TS `MapKeyType`/`MapValueType.validate` don't validate decorators) |
| **No open owner** (P2-06 closed; `validation.rs` is in P2-08c's owned paths) | F2, F3: `MapDeclaration.validate` never runs the import-clash check, and checks decorators after key/value | none observed | `MapDeclaration.validate` |
| **No open owner** (P2-07 / P2-03 closed; `validation.rs` is in P2-08c's owned paths) | F1, F4: decorator checks run in a different order from TS | none observed | `ClassDeclaration.validate`, `Decorated.validate` |
| **No open owner** (P2-04 #48, P4-07 #66 closed) | Ledger drift: `Field.getScalarField` is `RUST` in the ledger, but its logic is still in the TS view and the harness re-implements it | none (17 pass) | `Field.getScalarField` |
| **No open owner** (report owner P1-07a; #91 closed) | The CTO cache lacks non-string `addModel` inputs (87) and `net` bodies for `updateExternalModels` (2) | 89 unsupported | `addModel` (87), `updateExternalModels` (2) |
| **No open owner** (report owner P2-01+P4-03; #45 and #62 closed) | Arguments that don't decode (`undefined`/`null`): `isValidIdentifier` 2 (the DV-002 inputs), `isSystemProperty` 2, `getFullyQualifiedName` 1 | 5 unsupported | `isValidIdentifier` |
| P5-06 (mutation testing) | No dedicated unit test for `NumberValidator::new`/`validate`/`compatible_with`, `is_valid_map_key`, `is_valid_map_value`, `get_nested_property`, or the `enforceImportVersioning` and alias-to-primitive loop. Oracle-only coverage today. | none | 7 rows |

### New findings

- **F5: String scalars still use the pre-port validator checks.** P2-08c routed field
  loads through `validators.rs` (`Property::check_bound_validators`) and deleted
  `check_domain`/`check_size`. `check_pattern`/`check_length` in `introspect/mod.rs`
  survive, and both String-scalar paths call them: `ScalarDeclaration::build_standalone`
  (`scalar.rs` l.242-257) and `HasValidators::check_validators` (l.373, called from
  `declaration.rs` l.629 on load). TS `ScalarDeclaration.process` builds a `StringValidator`
  (scalardeclaration.ts l.105). So a String scalar with a bad regex or length bound fails
  with `IllegalModelException` `Invalid string length on <name>, …` instead of TS's
  `BaseException` "Validator error for field …", and its default value is not checked.
  Numeric scalars are fine (`NumberValidator::new` inside `ScalarDeclaration::process`).
  No fixture observes it. Owner: none open.
- **F6: doubled file suffix under `decoratorValidation`.** See checklist item 1. 12
  fixtures, all `ModelManager.validateModelFiles`, recorded as known failures in
  `baseline.tsv`. The decorator and undeclared-type texts match. Only the wrapping
  differs, so the member at fault is the `validateModelFiles` wrapping
  (`validation.rs` `attach_model_file`), not `Decorator.validate`. Owner: none open.
- **F7: `getDecorator` argument encoding.** One fixture, not a validation-style member.
  Owner: none open.
- **Residual on `Field.getScalarField`.** The library function exists now, but the oracle
  harness doesn't call it. This is recorded on the row, and it isn't a gap.

### For the coordinator

Open owners: P2-09a (#152) for F1-F4 and the map key/value decorators; P4-08 (#67) for
`metamodelValidation`; P5-06 (#77) for the unit-test gaps. With no open owner, to assign or
accept: F5, F6 (12 fail), F7 (1 fail), and DV-014's follow-up issue.

## Reproducing this audit

```sh
# concerto-rust at the audited head, in a private worktree
git -C concerto-rust worktree add --detach <scratch>/rust fc58371
cd <scratch>/rust
CARGO_TARGET_DIR=<scratch>/target \
CONCERTO_ORACLE_FIXTURES=<concerto>/migration/oracle/fixtures \
  cargo test -p accordproject-concerto-core --test oracle -- --nocapture
# at fc58371 prints "16085 fixtures … 13484 pass, 99 fail, 2502 unsupported, 0 harness errors";
# at b211ae9 (the addendum) "… 13706 pass, 13 fail, 2366 unsupported, 0 harness errors";
# per-rule counts, failures and unsupported reasons are in target/oracle-report.json
```

The member list comes from the reference source plus `SEAM_LEDGER.tsv` (`line` and
`loc` locate each body). The *error path* counts come from matching each fixture's
`outcome.error.message` against the TS throw text of the member. A fixture is failing
if its id is in `oracle-report.json`'s `failures`. The unit-test names were checked
against the `fn` names in `concerto-core` at fc58371.
