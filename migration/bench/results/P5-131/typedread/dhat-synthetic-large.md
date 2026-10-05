/home/user/wt/P5-131/concerto/migration/bench/results/P5-131/typedread/dhat/synthetic-large.json: 295.0 allocations, 1338100 bytes per load
  by kind: allocs/load (share) bytes/load (share)
       249.7 (84.6%)    854008 (63.8%)  Vec/String growth (realloc, grow_one, reserve)
          22 ( 7.5%)      2379 ( 0.2%)  Kept nodes (P5-76 JSON tree)
           6 (   2%)    229707 (17.2%)  other
         5.3 ( 1.8%)       327 (   0%)  Box::new (boxed nodes)
         3.7 ( 1.2%)    242525 (18.1%)  Vec collect / with_capacity (sized once)
         3.3 ( 1.1%)        39 (   0%)  string copies (to_owned, to_string, format!)
           3 (   1%)      9049 ( 0.7%)  hash/index tables (IndexMap, HashMap, HashSet)
           1 ( 0.3%)        27 (   0%)  Arc/Rc
           1 ( 0.3%)        39 (   0%)  serde_json::Value nodes (and their maps/strings)
  by origin: allocs/load (share) bytes/load (share)
         242 (  82%)    625968 (46.8%)  typed_ast.rs:443 exact
           6 (   2%)       160 (   0%)  kept.rs:138 deserialize
           5 ( 1.7%)      1920 ( 0.1%)  kept.rs:238 visit_map
           4 ( 1.4%)        24 (   0%)  kept.rs:146 kept_key
         3.7 ( 1.2%)       101 (   0%)  name.rs:69 new
         2.7 ( 0.9%)    225760 (16.9%)  typed_ast.rs:644 read_declaration
         2.3 ( 0.8%)        30 (   0%)  ser.rs:134 UnknownInlinedFun
         2.3 ( 0.8%)       124 (   0%)  model_file.rs:1417 import_short_names
         2.3 ( 0.8%)       217 (   0%)  validators.rs:611 compile_regex
           2 ( 0.7%)        76 (   0%)  kept.rs:210 UnknownInlinedFun
           2 ( 0.7%)       248 (   0%)  model_file.rs:1389 {closure#0}
           2 ( 0.7%)       117 (   0%)  model_util.rs:106 UnknownInlinedFun
           2 ( 0.7%)       128 (   0%)  typed_ast.rs:1613 UnknownInlinedFun
         1.7 ( 0.6%)        13 (   0%)  import.rs:157 UnknownInlinedFun
           1 ( 0.3%)        16 (   0%)  panicking.rs:581 do_call
           1 ( 0.3%)    229600 (17.2%)  model_file.rs:268 load_text
           1 ( 0.3%)        39 (   0%)  typed_ast.rs:414 visit_map
           1 ( 0.3%)    242400 (18.1%)  model_file.rs:432 load
           1 ( 0.3%)      8720 ( 0.7%)  model_file.rs:436 load
           1 ( 0.3%)        12 (   0%)  declaration.rs:1010 from_typed
           1 ( 0.3%)        15 (   0%)  typed_ast.rs:1557 UnknownInlinedFun
         0.7 ( 0.2%)      1728 ( 0.1%)  typed_ast.rs:1099 build
         0.7 ( 0.2%)        96 (   0%)  import.rs:158 {closure#6}
         0.7 ( 0.2%)        27 (   0%)  emit.rs:214 emit_node
         0.7 ( 0.2%)       128 (   0%)  emit.rs:170 emit_insn
  top allocation points:
         241    624240  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:443 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:532 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
         2.7    225760  [Vec/String growth (realloc, grow_one, reserve)] read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>>> @typed_ast.rs:644 < <concerto_core::introspect::typed_ast::DeclarationSeed as serde_core::de::Visitor>::visit_map @typed_ast.rs:599 < <&mu
           2        60  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
           2        12  [Kept nodes (P5-76 JSON tree)] kept_key @kept.rs:146 < concerto_core::introspect::kept::insert_entry @kept.rs:248 < concerto_core::introspect::kept::read_entries @kept.rs:260 < visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238
           2       768  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
           2        84  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
           2       117  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         1.7        13  [Box::new (boxed nodes)] concerto_core::introspect::model_file::import_short_names @model_file.rs:1417 < {closure#0} @model_file.rs:1427 < {closure#0} @model_file.rs:1427 < {closure#0}<std::collections::hash::map::HashMap<alloc::boxed::Box<str, alloc::alloc::Global>, @u32, u32), conce
         1.3        11  [Vec collect / with_capacity (sized once)] UnknownInlinedFun @import.rs:157 < {closure#6} @import.rs:158 < <concerto_core::introspect::import::Import as core::convert::TryFrom<&concerto_core::json::Value>>::try_from @import.rs:155 < {closure#0} @model_file.rs:1389
           1        16  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1    229600  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:268 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:175 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
           1        39  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, concerto_core::json::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < concerto_core::json::de::<impl serde_core::de::Deserialize for concerto_core::json::Value>::deserialize @de.rs:135 < UnknownInlinedFun @src/
           1       384  [Kept nodes (P5-76 JSON tree)] <concerto_core::introspect::kept::KeptSeed as serde_core::de::Visitor>::visit_map @kept.rs:238 < UnknownInlinedFun @src/de/value.rs:1632 < UnknownInlinedFun @kept.rs:138 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAc
           1        37  [Kept nodes (P5-76 JSON tree)] UnknownInlinedFun @kept.rs:210 < UnknownInlinedFun @src/de/mod.rs:1547 < UnknownInlinedFun @src/de/value.rs:573 < UnknownInlinedFun @kept.rs:138
           1         7  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < next_value_seed<
