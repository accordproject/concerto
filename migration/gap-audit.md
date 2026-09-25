# P2-09 gap audit (early partial)

Tracks accordproject/concerto-rust#53. Plan: accordproject/concerto-rust#29, §1.4 and §4.

This is the early, partial audit the maintainer approved on 2026-09-25. It covers
P2-01 to P2-07, P2-08 (#52) and P2-08b (#129), all merged. P2-08c (#144) is still
open; its items are listed under [Pending: P2-08c (#144)](#pending-p2-08c-144). When
#144 closes, the coordinator reopens #53 for a short addendum.

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

**Which members count as validation-style.** A member of a file in P2 scope qualifies
if any of these holds: the ledger's `category` is `validation`; its name is
`validate*`, `check*`, `process`, `processType`, `resolve*`, `enforce*`,
`is*Valid*`, `isCompatible*` or `compatibleWith`; or its body throws (including through
`reportError`/`handleError`). Pure getters that only matched on a name, such as
`getType`, are left out. That gives 79 rows in the P2-scope files (`introspect/*`,
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
  `ModelManager.addModel` fixture. The report doesn't list unsupported fixtures by id,
  so this is a heuristic. It reproduces the report's per-op unsupported counts exactly
  for `addCTOModel` (195), `validateModelFiles` (16), `addModel` (172) and `getType` (11).
  Two members that throw identical text can't be told apart this way ("Duplicate
  class name", "Unrecognised model element", "Namespace is not defined for type"); the
  row says so where it matters.
- *Status*:
  - **Mapped**: the Rust counterpart exists, it is tested, and it has no open failure.
  - **Mapped, divergence**: mapped, with a documented `DIVERGENCES.md` row.
  - **Mapped, pending**: mapped, but some fixtures still fail. The failures belong to
    P2-08c (#144) or P2-08d (#151).
  - **Gap**: no library counterpart, a harness gap, or a check found missing or
    misordered by this audit. The owner is named in the note.
  - **Stays TS**: the ledger says so.

## Summary

| Status | Rows |
|---|---|
| Mapped | 45 |
| Mapped, divergence (DV-002, DV-003, DV-013) | 3 |
| Mapped, pending P2-08c / P2-08d | 19 |
| Gap | 6 |
| Stays TS (ledger) | 6 |
| **Total** | **79** |

| TS file(s) | Mapped | Divergence | Pending | Gap | Stays TS |
|---|---|---|---|---|---|
| `modelutil.ts` (P2-01) | 5 | 2 | | | |
| `model/resourceid.ts` (P2-01) | 3 | | | | |
| `introspect/*validator.ts` (P2-02) | 7 | | 3 | | 2 |
| `introspect/declaration.ts`, `classdeclaration.ts` and subclasses (P2-03) | 4 | 1 | 3 | | 1 |
| `introspect/property.ts`, `field.ts`, `relationshipdeclaration.ts`, `enumvaluedeclaration.ts` (P2-04) | 3 | | 3 | 1 | |
| `introspect/scalardeclaration.ts` (P2-05) | 2 | | | | |
| `introspect/map*.ts` (P2-06) | 1 | | 4 | 1 | |
| `introspect/decorated.ts`, `decorator.ts`, `decoratorfactory.ts` (P2-07) | 4 | | | 2 | 2 |
| `introspect/modelfile.ts` (P2-08) | 5 | | 3 | | |
| `basemodelmanager.ts`, `modelmanager.ts` (P2-08, P2-08b, P3-04) | 11 | | 3 | 1 | 1 |
| `introspect/metamodel.ts` (P3-04) | | | | 1 | |

Every row names a Rust counterpart or a written reason. No validation-style member in
P2 scope is silently unmapped.

### Gaps by owner

| Owner | What | Fixtures affected | Rows |
|---|---|---|---|
| **P2-08c (#144, open)** | 97 oracle failures, listed in [Pending](#pending-p2-08c-144) | 97 fail | 19 "Mapped, pending" rows |
| **P2-08d (#151, open)** | Self-import message (`ModelManager.addCTOModel` `c1b21256…`); `ClassDeclaration.getIdentifierFieldName` `557a5087…` gives "Type … not found" instead of "Namespace is not defined for type …" | 2 fail | `ModelFile.validate`, `ModelManager.addCTOModel` |
| **P3-04+P4-08** (P3-04 #59 closed; **P4-08 #67 open**) | The native harness can't replay the `metamodelValidation` option, and `MetaModel.validateMetaModel`/`modelManagerFromMetaModel` have no dispatch entry, so `validate_ast`/`validate_metamodel` have no oracle evidence, only unit tests | 276 unsupported | `validateAst`, `validateMetaModel` |
| **No open owner** (report owner P2-07+P4-05; #51 and #64 closed) | The native harness can't replay the `decoratorValidation` option (`tests/oracle/recipe.rs` l.1338), although the engine supports it (`ModelManager::set_decorator_validation`). No fixture checks `Decorator.validate`'s argument checks inside a model load. | 42 unsupported | `Decorator.validate` |
| **No open owner** (report owner P2-06+P4-07; #50 and #66 closed) | The Rust `MapDeclaration` doesn't read the decorators on a map's key or value | 16 unsupported (`Decorated.getDecorator`) | none directly (TS `MapKeyType`/`MapValueType.validate` don't validate decorators) |
| **No open owner** (P2-06 closed; `validation.rs` is in P2-08c's owned paths) | F2, F3: `MapDeclaration.validate` never runs the import-clash check, and checks decorators after key/value | none observed | `MapDeclaration.validate` |
| **No open owner** (P2-07 / P2-03 closed; `validation.rs` is in P2-08c's owned paths) | F1, F4: decorator checks run in a different order from TS | none observed | `ClassDeclaration.validate`, `Decorated.validate` |
| **No open owner** (P2-04 #48, P4-07 #66 closed) | Ledger drift: `Field.getScalarField` is `RUST` in the ledger, but its logic is still in the TS view and the harness re-implements it | none (17 pass) | `Field.getScalarField` |
| P1-07a | The CTO cache lacks non-string `addModel` inputs (87) and `net` bodies for `updateExternalModels` (2) | 89 unsupported | `updateExternalModels` |
| P2-01+P4-03 | Arguments that don't decode (`undefined`/`null`): `isValidIdentifier` 2 (the DV-002 inputs), `isSystemProperty` 2, `getFullyQualifiedName` 1 | 5 unsupported | `isValidIdentifier` |
| P5-06 (mutation testing) | No dedicated unit test for `NumberValidator::new`/`validate`/`compatible_with`, `is_valid_map_key`, `is_valid_map_value`, `get_nested_property`, or the `enforceImportVersioning` and alias-to-primitive loop. Oracle-only coverage today. | none | 7 rows |

"No open owner" means the task that owned the code has closed and no open issue covers the
item. The coordinator needs to assign it, or record that it's accepted.

### Findings (read from the code, no fixture observes them yet)

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
  instead. These throw `IllegalModelException` with Rust wording and skip default
  values. That is the root cause of P2-08c's two largest groups (30 + 4 failures). It
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
| getNamespace | RUST P2-01 | `model_util.rs` `get_namespace` (l.88) | `get_namespace_check_get_namespace` | op 5/0/0; "FQN is invalid" error path 94 pass (via `DecoratorManager.decorateModels` 88, `DcsConverter.jsonToYaml` 5) | Mapped |  |
| parseNamespace | RUST P2-01 | `model_util.rs` `parse_namespace` (l.248) | `parse_namespace_valid_with_version`, `_valid_with_version_validation_disabled`, `_invalid_null`, `_invalid_two_at_signs`, `_invalid_version` | op 5/0/0 (error path 3 of them) | Mapped, divergence | DV-003 (d6): TS accepts an unversioned namespace here; Rust follows D6. The unversioned-namespace *ModelFile* failures are a different check (`ModelFile.fromAst`, below). |
| isAssignableTo | RUST P2-01 | `model_util.rs` `is_assignable_to` (l.364) | `model_manager.rs` `ported_members_run_on_the_arena` (incl. the "Cannot find type" error) | op 6/0/0 | Mapped |  |
| isValidIdentifier | RUST P2-01 | `model_util.rs` `is_valid_identifier` (l.488) | `id_regex_compiles`, `id_regex_follows_the_ts_classes` | op 7/0/2 (2 unsupported: arguments `undefined`/`null` do not decode, owner P2-01+P4-03) | Mapped, divergence | DV-002 (ts-bug): TS returns `true` for `undefined`/`null`. Rust takes `&str`, so the two undecodable fixtures are exactly the DV-002 inputs. |
| isValidMapKey | RUST P2-01 | `model_util.rs` `is_valid_map_key` (l.606) | none found (oracle only) | op 10/0/0 | Mapped | No dedicated unit test; P5-06 input. |
| isValidMapKeyScalar | RUST P2-01 | `model_util.rs` `is_valid_map_key_scalar` (l.618) | `model_manager.rs` `ported_members_run_on_the_arena` | no op fixtures; the check it serves (`MapKeyType.validate`) is below | Mapped | `validation.rs` `validate_map_key` does not call it: it re-derives the scalar type through `Typed::type_name`. Same answer on every fixture; two implementations of one rule. |
| isValidMapValue | RUST P2-01 | `model_util.rs` `is_valid_map_value` (l.647) | none found (oracle only) | op 10/0/0 | Mapped | No dedicated unit test; P5-06 input. |

### src/model/resourceid.ts: ResourceId (P2-01)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| parseUri (module fn) | RUST P2-01 | `instance/resource_id.rs` `parse_uri` (l.70, crate-private) | `parse_uri_splits_scheme_authority_query_and_fragment`, `parse_uri_with_no_scheme_or_authority_is_all_path`, `parse_uri_non_numeric_port_is_invalid_port` (21 tests in the file) | via `Relationship.fromURI` (18/0/0, stays-ts op) | Mapped |  |
| constructor | HYBRID P2-01 | `instance/resource_id.rs` `ResourceId::new` (l.252) | `resource_id.rs` "ResourceId constructor" tests | "Missing namespace/type/id" error path 3 pass (`Relationship.fromURI`) | Mapped |  |
| fromURI | RUST P2-01 | `instance/resource_id.rs` `ResourceId::from_uri` (l.297) | `resource_id.rs` fromURI tests | "Invalid URI…" error path 3 pass (`Relationship.fromURI`) | Mapped |  |

### src/introspect/validator.ts, numbervalidator.ts, stringvalidator.ts, collectionsizevalidator.ts (P2-02)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Validator.reportError | HYBRID P2-02 | `introspect/validators.rs` `report_error` (l.64) | every rejecting test in `validators.rs` (33 tests) | every `BaseException` "Validator error for field…" that passes, e.g. `StringValidator.validate` 29/0/0 | Mapped |  |
| Validator.validate | TS | (abstract no-op in TS) | - | - | Stays TS | Ledger TS: base-class stub; each subclass has its own `validate`. |
| Validator.compatibleWith | TS | `validators.rs` `Validator::compatible_with` (l.50) dispatches to the three overrides | - | - | Stays TS | Ledger TS (base returns `false`); the overrides are mapped below. |
| NumberValidator.constructor | RUST P2-02 | `validators.rs` `NumberValidator::new` (l.114) | no dedicated test in `validators.rs` | no direct op; built by `NumberValidator.validate`/`compatibleWith` fixtures (12 pass). Model-load error path: 5 fail (settings) + 2 fail (default value outside bounds) | Mapped, pending | The model-load path does not call `NumberValidator::new`: `Property::check_validators` (`introspect/property.rs` l.355) uses the pre-port `introspect/mod.rs` `check_domain`, which throws `IllegalModelException` where TS throws concerto-util `BaseException`, and never checks the default value. Pending P2-08c. Unit-test gap for `NumberValidator::new` itself: P5-06 input. |
| NumberValidator.validate | RUST P2-02 | `validators.rs` `NumberValidator::validate` (l.197) | no dedicated test in `validators.rs` | op 3/0/0 | Mapped | Unit-test gap: P5-06 input. |
| NumberValidator.compatibleWith | RUST P2-02 | `validators.rs` `NumberValidator::compatible_with` (l.241) | no dedicated test | op 9/0/0 | Mapped |  |
| StringValidator.constructor | HYBRID P2-02 | `validators.rs` `StringValidator::new` (l.505) | `string_validator_rejects_an_invalid_regex`, `_rejects_invalid_regex_flags`, `_accepts_every_valid_regex_flag_once`, `_rejects_length_with_no_bounds`, `_rejects_min_length_above_max_length`, `_rejects_negative_lengths`, `_rejects_a_default_value_shorter_than_min_length`, `_longer_than_max_length`, `_accepts_a_default_value_matching_length_and_pattern` | no direct op. Model-load error path: 16 fail (settings) + 2 fail (default value length) | Mapped, pending | Same split as NumberValidator: the load path uses `introspect/mod.rs` `check_length`/`check_pattern` (IllegalModelException, no default-value check). Pending P2-08c. |
| StringValidator.validate | HYBRID P2-02 | `validators.rs` `StringValidator::validate` (l.655) | `string_validator_validates_a_matching_string`, `_detects_a_mismatched_string`, the global/sticky-regex tests, `_validates_a_unicode_string`, `_length_only_bounds`, `_length_takes_precedence_over_regex` | op 29/0/0 | Mapped | `options.regExp` stays JS (plan §3). |
| StringValidator.compatibleWith | RUST P2-02 | `validators.rs` `StringValidator::compatible_with` (l.713) | `string_validator_is_incompatible_with_a_number_validator`, `_compatible_with_same_pattern_and_flags`, `_incompatible_with_a_changed_pattern`, `_incompatible_with_changed_flags`, `_length_compatibility` | op 29/0/0 | Mapped |  |
| CollectionSizeValidator.constructor | RUST P2-02 | `validators.rs` `CollectionSizeValidator::new` (l.301) | `collection_size_validator_reads_both_bounds`, `_min_only`, `_rejects_no_bounds`, `_rejects_negative_bounds`, `_rejects_min_above_max`, `_allows_min_equal_max_and_zero` | getters 6/0/0. Model-load error path: 9 fail (settings) | Mapped, pending | Load path uses `introspect/mod.rs` `check_size` (IllegalModelException). Pending P2-08c. |
| CollectionSizeValidator.validate | RUST P2-02 | `validators.rs` `CollectionSizeValidator::validate` (l.361) | `collection_size_validator_validate` | no direct op; "Collection must contain…" error path 8 pass (`Serializer.fromJSON` 4, `Resource.validate` 2, `Serializer.toJSON` 2) | Mapped |  |
| CollectionSizeValidator.compatibleWith | RUST P2-02 | `validators.rs` `CollectionSizeValidator::compatible_with` (l.397) | `collection_size_validator_compatible_with` | op 10/0/0 | Mapped |  |

### src/introspect/declaration.ts, classdeclaration.ts and subclasses (P2-03)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Declaration.process | RUST P2-03 | `introspect/declaration.rs` `check_declaration_name` (l.1231), called from `Declaration::from_model_json` (l.1138) | `a_declaration_name_must_be_an_identifier`, `an_invalid_class_name_is_reported_before_a_system_field_name`, `a_map_with_no_name_is_rejected_as_an_invalid_class_name` | "Invalid class name" error path 1 pass (`ModelManager.fromAst`) | Mapped |  |
| Declaration.validate | RUST P2-03 | `validation.rs` `check_import_clash` (l.308), `is_reserved_system_type_import` (l.335) | `declaration_clashing_with_an_imported_name_is_rejected`, `a_user_declaration_clashes_with_the_implicitly_imported_system_types`, `dangerously_allow_reserved_system_type_names_permits_a_system_name_clash`, `…_does_not_permit_other_clashes`, `declaration_beside_a_distinct_import_is_accepted`, `an_aliased_import_clashes_under_its_alias` | "clashes with an imported type" error path 12 pass / 4 fail / 2 unsupported | Mapped, pending | The 4 failures are `error.location` null where TS has one (`validateModelFiles`), pending P2-08c. Separately, the map path never runs this check: see `MapDeclaration.validate`. |
| ClassDeclaration.declarationKind (and the 6 subclass overrides) | TS | (abstract stub) | - | `*.declarationKind` ops unsupported, stays-ts | Stays TS | Ledger TS: constant-return view members. |
| ClassDeclaration.process | RUST P2-03 | `declaration.rs` `ClassDeclaration::process_decision` (l.371), `ClassDeclaration::from_json` (l.423), `EnumDeclaration::implicit_super_type` (l.753) | `parses_concept_with_typed_properties`, `non_array_properties_is_rejected`, `a_class_declaration_with_no_properties_field_loads_with_none`, `only_the_exact_metamodel_classes_are_recognised`, `a_class_declaration_property_class_may_be_given_as_the_short_name`; `validation.rs` `reserved_field_name_is_rejected_at_load` | "Invalid field name"/"Properties of Class…" error path 9 pass; 1 fail ("Unrecognised model element" wording, `ModelManager.fromAst`) | Mapped, pending | The one failure is in P2-08c's list (#140 attributes it to `introspect/property.rs`). |
| EventDeclaration.process | RUST P2-03 | no separate fn: the body is `super.process()`, covered by `ClassDeclaration.process` | - | - | Mapped |  |
| ClassDeclaration._resolveSuperType | RUST P2-03 | `validation.rs` `check_super_type` (l.567); `model_manager.rs` `super_type_fqn` (l.1322), `not_a_class_like` (l.441); `declaration.rs` `kinds_compatible` (l.329) | `super_type_that_exists_passes`, `super_type_that_is_missing_fails`, `super_type_that_is_missing_carries_the_class_ast_location`, `a_participant_cannot_extend_an_asset`, `a_participant_may_extend_a_participant`; `model_manager.rs` `unresolved_super_type_is_hard_error` | "Could not find super type"/"cannot extend" error path 12 pass / 2 unsupported | Mapped |  |
| ClassDeclaration.validate | RUST P2-03 | `validation.rs` `impl Validate for ClassDeclaration` (l.416), `check_unique_field_names` (l.631), `check_identifier` (l.659), `check_identity_matches_super` (l.1009); `declaration.rs` `identifier_redeclare_conflict` (l.339) | `a_class_extending_itself_is_rejected`, `identifier_of_non_string_type_fails`, `identifier_of_string_type_passes`, `identifier_of_string_scalar_type_passes`, `optional_identifier_fails`, `optional_non_string_identifier_reports_the_type_first`, `a_system_identifier_may_not_extend_an_explicit_one`, `an_explicit_identifier_may_not_extend_an_explicit_one`, `field_redeclared_from_super_type_fails`, `unique_field_names_across_inheritance_pass` | op 7/0/0; error path 39 pass / 2 fail / 4 unsupported | Mapped, pending | The 2 failures ("explicit identifier cannot be redeclared", `addCTOModel`) come from check order: Rust runs the duplicate-field scan before the identifier checks, TS after. Pending P2-08c. Finding F1 (decorators checked last, TS first) is not in any list yet. |
| ClassDeclaration.getProperties | RUST P2-03 | `model_manager.rs` `get_all_properties` (l.1016) | `collects_inherited_properties_in_order`, `get_all_properties_on_enum_gives_its_values`, `circular_inheritance_is_a_range_error` | op 88/0/0 | Mapped, divergence | DV-013 (ts-bug): a cyclic chain overflows the stack in TS (`RangeError`); Rust reproduces the class. |
| ClassDeclaration.getNestedProperty | RUST P2-03 | `model_manager.rs` `get_nested_property` (l.1057) | none found (oracle only) | op 4/0/0; error path 2 pass | Mapped | No dedicated unit test; P5-06 input. |

### src/introspect/property.ts, field.ts, relationshipdeclaration.ts, enumvaluedeclaration.ts (P2-04)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Property.process | RUST P2-04 | `introspect/property.rs` `process` (l.56); `TryFrom<&Value> for Property` (l.243) | `process_derives_type_array_and_optional`, `process_object_property_type_is_the_referenced_name`, `process_enum_property_leaves_type_unset`, `process_rejects_an_invalid_identifier`, `a_property_name_must_be_an_identifier`, `unknown_property_kind_errors`, `a_reserved_name_is_rejected_before_the_kind_is_checked` | no direct op; error path 3 fail (`ModelManager.fromAst`) | Mapped, pending | Pending P2-08c: "Invalid property name" wording (Rust `invalid identifier: …` on the load path), "No name for type" (TS plain `Error`), and an `ObjectProperty` with no `type` that TS accepts and Rust rejects. |
| Field.process | RUST P2-04 | `introspect/field.rs` `process` (l.72) builds the faithful `NumberValidator`/`StringValidator` | `property.rs` `range_lower_above_upper_is_rejected`, `range_with_one_open_end_is_accepted`, `range_without_either_bound_is_rejected`, `negative_string_length_is_rejected`, `string_length_min_above_max_is_rejected`, `a_regex_validator_must_compile` (these test the pre-port load path, not `field.rs`) | see the three validator constructors above | Mapped, pending | `field.rs` `process` is used by the WASM view; `ModelManager` loading goes through `Property::check_validators` instead. Pending P2-08c. |
| Field.getScalarField | RUST P2-04 | none in the library: logic stays in the converted TS view (`packages/concerto-core/src/introspect/field.ts` `getScalarField`), and `tests/oracle/ops.rs` `get_scalar_field` (l.2342) re-implements it for the harness | - | op 17/0/0; "is not a scalar property" error path 1 pass | Gap | Ledger drift: the ledger row says RUST P2-04+P4-07; both tasks are closed. Owner: none open, coordinator to decide (reclassify TS, or port). |
| Property.validate | RUST P2-04 | `validation.rs` `validate_property` (l.455), `check_property_type` (l.733), `check_size_validator_target` (l.906), `undeclared_type_error` (l.1270) | `object_property_of_undeclared_type_fails`, `object_property_of_declared_type_passes`, `size_validator_on_a_non_array_object_property_of_a_non_map_type_is_rejected`, `…_of_a_map_type_is_allowed`, `size_validator_on_a_map_type_imported_from_another_namespace_is_allowed`, `size_validator_on_a_non_array_primitive_or_relationship_is_rejected_by_validation`, `an_inherited_property_is_validated_in_the_subclass_pass` | no direct op; "size validator can only be applied…" error path 7 pass; "Undeclared type" (resolveType) 17 pass / 5 unsupported | Mapped |  |
| Property.getFullyQualifiedTypeName | RUST P2-04 | `model_manager.rs` `ResolutionContext::get_fully_qualified_type_name` (l.1938); `introspect/model_file.rs` `get_fully_qualified_type_name` (l.450) | `an_aliased_import_s_property_resolves_its_fully_qualified_type_name` | op 63/0/0; error path 2 pass | Mapped |  |
| RelationshipDeclaration.validate | RUST P2-04 | `validation.rs` `check_property_type`, relationship arms (l.733-895) | `relationship_to_primitive_fails`, `relationship_to_unidentified_class_fails`, `relationship_to_identified_class_passes`, `relationship_to_unresolvable_type_fails_with_the_undeclared_type_message`, `a_relationship_to_a_class_identified_only_through_its_super_type_passes` | no direct op; error path 13 pass / 1 fail / 1 unsupported | Mapped, pending | The failure is "Relationship must have a type" (`validateModelFiles`; Rust reports an undeclared type `""`). Pending P2-08c. |
| EnumValueDeclaration.validate | RUST P2-04 | body is `super.validate()` (decorators only, no type): `validation.rs` `impl Validate for Declaration`, `Enum` arm (l.365) | `duplicate_decorator_on_an_enum_value_is_rejected`, `duplicate_enum_value_name_is_rejected` | no direct op | Mapped |  |

### src/introspect/scalardeclaration.ts (P2-05)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| ScalarDeclaration.process | RUST P2-05 | `introspect/scalar.rs` `ScalarDeclaration::process` (l.111); `declaration.rs` `load_scalar` (l.571) | `throws_when_scalar_name_is_a_primitive_type`, `does_not_throw_for_a_valid_scalar_name`, `default_value_*` (3); `declaration.rs` `scalar_with_reversed_range_is_rejected`, `scalar_with_valid_range_is_accepted`, `unknown_scalar_kind_errors` | `ScalarDeclaration.new` 13/0/0; "Invalid scalar name" error path 8 pass | Mapped | A scalar's validator settings go through `ScalarDeclaration::check_validators` (l.373) on the load path, so the P2-08c `BaseException` item applies to scalars too. |
| ScalarDeclaration.validate | RUST P2-05 | `scalar.rs` `ScalarDeclaration::validate` (l.300); `validation.rs` `Declaration::Scalar` arm (l.397) | `validate_rejects_a_duplicate_fully_qualified_name`, `validate_accepts_unique_fully_qualified_names`, `duplicate_decorator_on_a_scalar_declaration_is_rejected` | no direct op | Mapped | On the manager pass the duplicate-FQN branch is unreachable (ModelFile.validate scans first); documented in `validation.rs` l.398-409. |

### src/introspect/mapdeclaration.ts, mapkeytype.ts, mapvaluetype.ts (P2-06)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| MapDeclaration.process | RUST P2-06 | `declaration.rs` `MapDeclaration` load and `key_kind`/`value_kind` (l.845/858); the TS construction-time checks run later, at validate time, in `validation.rs` `validate_map_key`/`validate_map_value` with Rust wording | `a_map_with_no_key_loads_with_an_empty_key_kind`, `a_map_with_an_unrecognised_key_kind_still_loads`; `validation.rs` `map_missing_its_key_field_is_rejected_at_validate`, `map_missing_its_value_field_is_rejected_at_validate`, `map_key_with_an_unknown_class_is_rejected_at_validate`, `map_value_with_an_unknown_class_is_rejected_at_validate` | no direct op; error path 4 fail (`ModelManager.fromAst`: TS throws while building, Rust loads) | Mapped, pending | Pending P2-08c ("MapDeclaration structural checks missing"). |
| MapDeclaration.validate | RUST P2-06 | `validation.rs` `impl Validate for MapDeclaration` (l.1074); `validate_detached_declaration` (l.172) | `duplicate_decorator_on_a_map_declaration_is_rejected`, `a_loaded_map_declaration_introspects_as_ts_does`, the 30+ `a_map_*`/`every_*` tests in `validation.rs` | op 34/0/0 | Gap | Findings F2/F3: never runs `Declaration.validate`'s import-clash check (the doc comment on `check_import_clash`, l.306, says so), and checks decorators after key/value where TS checks them first. No fixture observes either. Owner: none open (P2-06 closed); `validation.rs` is in P2-08c's owned paths. |
| MapKeyType.process / processType | RUST P2-06 | `declaration.rs` `MapDeclaration::key_kind` (l.845), `key_type` (l.875), `key_type_name` (l.901) | `key_type_name_is_string_for_a_string_key`, `…_datetime_…`, `…_the_raw_referenced_name_for_an_object_key` | `MapKeyType.getType` 6/0/0 | Mapped |  |
| MapKeyType.validate | RUST P2-06 | `validation.rs` `validate_map_key` (l.1093); `validate_detached_map_key` (l.191) | `a_map_key_must_be_string_or_datetime`, `a_map_key_kind_outside_the_allowed_set_is_rejected`, `a_scalar_map_key_over_long_integer_double_or_boolean_is_rejected`, `a_map_key_imported_from_another_namespace_and_not_string_or_datetime_is_rejected`, `…_and_is_a_string_scalar_validates`, `an_enum_declaration_as_an_object_map_key_is_rejected` | op 1/0/0; "Scalar must be one of…" error path 7 pass / 30 fail / 10 unsupported | Mapped, pending | The 30 failures: Rust appends ` File '…': `, which TS `MapKeyType.validate` does not (it passes no model file). Pending P2-08c. |
| MapValueType.process / processType | RUST P2-06 | `declaration.rs` `value_kind` (l.858), `value_type` (l.886); structural checks run at validate time in `validate_map_value` | `an_object_map_value_missing_its_type_property_is_rejected`, `an_object_map_value_type_missing_its_name_is_rejected`, `an_object_map_value_type_with_a_bad_class_is_rejected`, `value_type_name_covers_every_primitive_kind` | `MapValueType.getType` 7/0/0; "ObjectMapValueType…" error path 3 fail (`ModelManager.fromAst`) | Mapped, pending | Pending P2-08c (same root cause as `MapDeclaration.process`). |
| MapValueType.validate | RUST P2-06 | `validation.rs` `validate_map_value` (l.1139); `validate_detached_map_value` (l.198) | `a_map_value_must_name_a_declared_type`, `a_map_value_may_be_a_relationship`, `a_map_value_may_be_an_enum`, `a_map_value_may_not_be_a_map_declaration`, `every_declared_class_kind_validates_as_a_map_value` | op 1/0/0; error path 1 pass; 4 fail where TS throws a `TypeError` (undeclared value type) | Mapped, pending | Pending P2-08c, which may move them to DIVERGENCES instead (TS reads `isMapDeclaration` of `null`). |

### src/introspect/decorated.ts, decorator.ts, decoratorfactory.ts (P2-07)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| Decorated.constructor | HYBRID P2-07 | `introspect/model_file.rs` `ModelFile::check_constructor_arguments` (l.202) for the `ast not specified` check | `constructor_arguments_are_checked_in_ts_order` | `ModelFile.new` "ast not specified" 1 pass | Mapped | Only `ModelFile` can receive a missing AST in Rust; every other `Decorated` is built from an AST node the loader already holds. |
| Decorated.process | HYBRID P2-07 | `introspect/decorator.rs` `parse_decorators` (l.502) | `reads_every_argument_kind` | `Decorated.getDecorators` 5/0/2, `getDecorator` 57/0/21 | Mapped |  |
| Decorated.getModelFile | TS | (abstract stub) | - | - | Stays TS | Ledger TS. |
| Decorated.validate | RUST P2-07 | `validation.rs` `check_unique_decorators` (l.534), `validate_decorators` (l.518) | `duplicate_decorator_is_rejected`, `distinct_decorators_are_accepted`, `duplicate_decorator_on_an_enum_declaration_is_rejected`, `…_on_a_scalar_declaration_…`, `…_on_a_map_declaration_…`, `…_on_an_enum_value_…`, `…_on_a_namespace_…`, `…_on_a_declaration_…` | "Duplicate decorator" error path 94 pass / 1 unsupported | Gap | Finding F4: TS validates each decorator before the duplicate scan; Rust scans first. Observable only with `decoratorValidation` on and both faults on one element, and the harness cannot replay that option (next row). Owner: none open (P2-07 closed); `validation.rs` is in P2-08c's owned paths. |
| Decorator.process | RUST P2-07 | `decorator.rs` `Decorator::from_ast` (l.89) | `stores_name_and_string_arguments`, `no_arguments_field_gives_an_empty_list`, `reads_every_argument_kind`, `a_short_class_is_accepted_for_the_type_reference` | `Decorator.getArguments` 43/0/0 | Mapped |  |
| Decorator.validate | RUST P2-07 | `decorator.rs` `Decorator::validate` (l.148), `try_validate` (l.165), `check_argument` (l.269), `check_type_reference_argument` (l.318) | `validate_is_a_no_op_when_disabled`, `missing_decorator_error_reports_the_undeclared_type_wrapped_once`, `missing_decorator_off_is_silent`, `too_few_arguments_is_reported_through_invalid_decorator` | op 2/0/0; "Decorator … has/references" error path 156 pass (`DecoratorManager.decorateModels`) / 8 unsupported | Gap | Harness gap: a `ModelManager` built with the `decoratorValidation` option is not replayed natively ("not modelled by the Rust engine yet"), 42 fixtures across 7 ops, report owner P2-07+P4-05. The engine has the option (`ModelManager::set_decorator_validation`); only `tests/oracle/recipe.rs` (l.1338) rejects it. Owner: none open (P2-07 #51, P4-05 #64 closed). |
| Decorator.handleError | HYBRID P2-07 | `decorator.rs` `handle` (l.387), `rethrow` (l.407) | `too_few_arguments_is_reported_through_invalid_decorator`, `missing_decorator_off_is_silent` | via `Decorator.validate` | Mapped | The `Logger.dispatch` half is not ported: nothing observes a log line (reason in `decorator.rs` l.385). |
| DecoratorFactory.newDecorator | TS | (abstract stub) | - | fixtures with a decorator factory are unsupported, stays-ts (`@@oracle:decoratorfactory`, 32 across 7 ops) | Stays TS | Ledger TS. |

### src/introspect/modelfile.ts: ModelFile (P2-08)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| constructor | HYBRID P2-08 | `introspect/model_file.rs` `ModelFile::check_constructor_arguments` (l.202), `from_json_with_definitions` (l.71) | `constructor_arguments_are_checked_in_ts_order`, `missing_namespace_is_rejected`, `non_array_declarations_or_imports_is_rejected`, `keeps_the_ast_it_was_given_in_its_original_key_order` | `ModelFile.new` 192/4/0 | Mapped, pending | The 4 failures are the validator-settings `BaseException` item. Pending P2-08c. |
| fromAst | RUST P2-08 | `model_file.rs` `from_json_with_definitions` (l.71), `split_versioned_namespace` (l.738), `built_in_import` (l.660); `introspect/import.rs` `Import::try_from` (l.126) | `parses_namespace_imports_and_declarations`, `unversioned_namespace_is_rejected`, `duplicate_declaration_is_accepted_at_construction_and_the_last_wins`; `import.rs` `wildcard_import_is_rejected`, `resolves_multi_import_with_alias` | error path 3 pass / 12 fail / 3 unsupported | Mapped, pending | Pending P2-08c: 10 "unversioned namespace" (TS plain `Error`, Rust `IllegalModelException`), 1 "Invalid namespace part" wording; the 12th is the "Unrecognised model element" message, which the regex cannot tell apart from `ClassDeclaration.process`'s (same failure, counted once in the Pending list). |
| enforceImportVersioning | RUST P2-08 | inline in `from_json_with_definitions` (l.113-137), with the alias-to-primitive check | none found (oracle only) | "Cannot use an unversioned import" error path 9 pass / 2 unsupported | Mapped | No dedicated unit test; P5-06 input. |
| isCompatibleVersion | RUST P2-08 | `model_file.rs` `check_compatible_version` (l.701); `semver_range.rs` | `a_concerto_version_satisfied_by_this_runtime_is_recorded_verbatim`, `a_v3_concerto_version_is_accepted_for_backward_compatibility`, `an_unsatisfiable_concerto_version_is_rejected`, `no_concerto_version_at_all_leaves_it_none`; 7 `semver_range.rs` tests | `ModelFile.getConcertoVersion` 2/0/0; error path 4 pass / 1 unsupported | Mapped |  |
| validate | RUST P2-08 | `validation.rs` `ModelManager::validate_model_file` (l.110), `validate_detached_model_file` (l.142), `check_imports` (l.958), `check_unique_declaration_names` (l.251), `attach_model_file` (l.284) | `importing_from_the_files_own_namespace_is_rejected`, `importing_a_type_that_does_not_exist_is_rejected`, `importing_a_declared_type_is_accepted`, `importing_two_versions_of_one_namespace_is_rejected`, `duplicate_declaration_is_accepted_on_load_and_rejected_by_validation`, `duplicate_declaration_scan_runs_between_imports_and_declarations`, `a_detached_model_file_validates_against_its_manager` | op 17/0/0; "Duplicate class name"/"different versions" error path 40 pass / 7 unsupported; "Namespace is not defined"/"Type … is not defined" (shared with `getType`) 463 pass / 2 fail / 32 unsupported | Mapped, pending | The 2 failures are P2-08d (#151): the self-import message (`addCTOModel` `c1b21256…`) and `ClassDeclaration.getIdentifierFieldName` `557a5087…`. |
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
| validateModelFiles | RUST P2-08 | `validation.rs` `ModelManager::validate_models` (l.64) | `test_fresh_model_manager_is_valid`, `add_models_rejects_a_duplicate_declaration_at_validation` | op 342/18/16 | Mapped, pending | All 18 failures are in the P2-08c list; the 16 unsupported are the `decoratorValidation` harness gap. |
| updateModelFile | HYBRID P2-08b | `model_manager.rs` `update_model_file` (l.1715) | `update_model_file_replaces_the_registered_file`, `update_model_file_rejects_an_unregistered_namespace` | op 6/0/0; error path 2 pass | Mapped |  |
| deleteModelFile | RUST P2-08b | `model_manager.rs` `delete_model_file` (l.1742) | `delete_model_file_removes_the_namespace`, `delete_model_file_rejects_an_absent_namespace` | op 5/0/0; error path 1 pass | Mapped |  |
| addModelFiles | HYBRID P2-08 | `model_manager.rs` `add_models` (l.571), `insert_models` (l.1814) | `add_models_relaxes_import_order`, `add_models_rolls_back_the_whole_batch_on_validation_failure`, `add_models_rolls_back_on_duplicate_namespace_within_the_batch`, `…_against_an_existing_model`, `add_models_leaves_pre_existing_models_validating_on_success` | op 52/0/0 | Mapped |  |
| updateExternalModels | HYBRID P2-08b | `model_manager.rs` `update_external_models` (l.1779); downloading stays JS | `update_external_models_adds_then_updates_a_namespace`, `…_with_nothing_downloaded_still_validates`, `…_rolls_back_when_validation_fails` | op 4/0/2 | Mapped | The 2 unsupported fixtures need `net` response bodies in the CTO cache (owner P1-07a). |
| writeModelsToFileSystem | TS | - | - | op 0/0/3, stays-ts | Stays TS | Ledger TS (file-system I/O). |
| resolveType | RUST P2-08b | `model_manager.rs` `resolve_type` (l.1417) | `resolve_type_passes_primitives_through`, `resolve_type_resolves_a_local_type`, `resolve_type_rejects_an_unregistered_namespace`, `resolve_type_rejects_an_imported_name` | op 5/0/0; error path 76 pass | Mapped |  |
| getType | RUST P2-08 | `model_manager.rs` `get_type_declaration` (l.874) | `resolves_by_exact_fqn_only`, `get_type_follows_model_file_get_type` | op 671/0/11 (9 decorator-factory stays-ts, 2 `decoratorValidation`) | Mapped |  |
| resolveMetaModel | RUST P2-08b | `model_manager.rs` `resolve_meta_model` (l.1575), `resolve_local_names` (l.2476) | `resolve_meta_model_resolves_an_imported_super_type`, `…_rejects_an_unresolvable_name`, `…_rejects_an_import_of_an_undeclared_type`, `…_accepts_an_empty_import_types_from_an_unknown_namespace` | op 4/0/0 | Mapped |  |
| fromAst | RUST P2-08 | no library fn: `tests/oracle/recipe.rs` (l.1986) composes it from `ModelFile::from_json`, `add_model` and `validate_models` | - | op 16/21/0 | Mapped, pending | All 21 failures are in the P2-08c list. A library entry point is P4-08's to add (#67, open) if the view needs one. |
| ModelManager.addCTOModel | HYBRID P2-08 | CTO parsing stays JS; the Rust half is `add_model` + `validate_detached_model_file` | (as `addModelFile`) | op 1167/55/195 | Mapped, pending | 54 failures are in the P2-08c list and 1 is P2-08d; 171 unsupported are `metamodelValidation`, 19 `decoratorValidation`, 5 decorator factory. |
| validateAst | RUST P3-04 | `instance/metamodel.rs` `validate_ast` (l.133) | 10 tests in `instance/metamodel.rs` | no fixture replays it natively | Gap | Harness gap: the `metamodelValidation` option is "not modelled by the Rust engine yet", 276 fixtures unsupported (171 `addCTOModel`, 85 `addModel`, …), report owner P3-04+P4-08. P3-04 (#59) is closed, P4-08 (#67) is open. |

### src/introspect/metamodel.ts (P3-04)

| Member | Ledger | Rust counterpart | Unit tests | Oracle (pass/fail/unsupported) | Status | Notes |
|---|---|---|---|---|---|---|
| validateMetaModel | RUST P3-04 | `instance/metamodel.rs` `validate_metamodel` (l.104) | 10 tests in `instance/metamodel.rs` | `MetaModel.validateMetaModel` 0/0/12 ("not ported yet": no harness dispatch) | Gap | Owner P3-04+P4-08, as `validateAst`. |

## Outside this partial audit

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
| `decoratormanager.ts` | `validate`, `validateCommand`, `checkForDuplicateDecorators`, `checkForNamespaceTargetAndApplyDecorator`, `decorateModels`, `applyDecorator` | HYBRID/RUST P4-09 | `dcs/mod.rs` `validate` l.1197, `validate_command` l.710, `check_for_duplicate_decorators` l.400, `check_for_namespace_target_and_apply_decorator` l.532, `decorate_models` l.1322, `apply_decorator` l.427 | 35 in `dcs/mod.rs`, 29 in `dcs/decoratormanager_tests.rs` | `DecoratorManager.validate` 23/0/0, `decorateModels` 1300/0/1 | |
| `decoratorextractor.ts` | `parseVocabularies`, `process*` | RUST P4-09 | `dcs/extractor.rs` `parse_vocabularies` l.352 | 3 | `DecoratorManager.extractVocabularies` 69/0/0 | |
| `dcsconverter.ts` | conversion validation | P2-12/P4-09 | `dcs/dcsconverter.rs` | 15 | `DcsConverter.*` 26/0/0 | |
| `datetimeutil.ts` | `setCurrentTime` | TS | - | - | unsupported, stays-ts | |

## Pending: P2-08c (#144)

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

## Reproducing this audit

```sh
# concerto-rust at the audited head, in a private worktree
git -C concerto-rust worktree add --detach <scratch>/rust fc58371
cd <scratch>/rust
CARGO_TARGET_DIR=<scratch>/target \
CONCERTO_ORACLE_FIXTURES=<concerto>/migration/oracle/fixtures \
  cargo test -p accordproject-concerto-core --test oracle -- --nocapture
# prints "16085 fixtures … 13484 pass, 99 fail, 2502 unsupported, 0 harness errors";
# per-rule counts, failures and unsupported reasons are in target/oracle-report.json
```

The member list comes from the reference source plus `SEAM_LEDGER.tsv` (`line` and
`loc` locate each body). The *error path* counts come from matching each fixture's
`outcome.error.message` against the TS throw text of the member. A fixture is failing
if its id is in `oracle-report.json`'s `failures`. The unit-test names were checked
against the `fn` names in `concerto-core` at fc58371.
