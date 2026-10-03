/home/user/wt/P5-109/concerto/migration/bench/results/P5-109/typedread/dhat/synthetic-large.json: 308.0 allocations, 1338545 bytes per load
  by kind: allocs/load (share) bytes/load (share)
       249.3 (  81%)    853904 (63.8%)  Vec/String growth (realloc, grow_one, reserve)
        27.3 ( 8.9%)      1624 ( 0.1%)  serde_json::Value nodes (and their maps/strings)
          11 ( 3.6%)      1447 ( 0.1%)  Kept nodes (P5-76 JSON tree)
         5.3 ( 1.7%)       327 (   0%)  Box::new (boxed nodes)
           4 ( 1.3%)        83 (   0%)  string copies (to_owned, to_string, format!)
         3.7 ( 1.2%)    229677 (17.2%)  other
         3.7 ( 1.2%)    242446 (18.1%)  Vec collect / with_capacity (sized once)
         2.7 ( 0.9%)      9011 ( 0.7%)  hash/index tables (IndexMap, HashMap, HashSet)
           1 ( 0.3%)        27 (   0%)  Arc/Rc
  by origin: allocs/load (share) bytes/load (share)
         242 (78.6%)    625968 (46.8%)  typed_ast.rs:491 exact
           8 ( 2.6%)       449 (   0%)  typed_ast.rs:1520 next_value_seed
           7 ( 2.3%)       442 (   0%)  scalar.rs:191 process
         4.3 ( 1.4%)       278 (   0%)  model_file.rs:1305 built_in_import
         3.7 ( 1.2%)       101 (   0%)  name.rs:77 new
           3 (   1%)      1152 ( 0.1%)  kept.rs:237 visit_map
           3 (   1%)        93 (   0%)  kept.rs:137 deserialize
         2.7 ( 0.9%)    225760 (16.9%)  typed_ast.rs:680 ErrorBridge>
         2.3 ( 0.8%)       124 (   0%)  model_file.rs:1341 import_short_names
         2.3 ( 0.8%)       217 (   0%)  validators.rs:689 compile_regex
           2 ( 0.6%)       364 (   0%)  typed_ast.rs:683 ErrorBridge>
           2 ( 0.6%)        13 (   0%)  typed_ast.rs:1516 UnknownInlinedFun
           2 ( 0.6%)       117 (   0%)  model_util.rs:106 UnknownInlinedFun
           2 ( 0.6%)        60 (   0%)  ecma.rs:30 to_js_string
           2 ( 0.6%)       128 (   0%)  typed_ast.rs:1691 UnknownInlinedFun
         1.7 ( 0.5%)        13 (   0%)  import.rs:183 UnknownInlinedFun
           1 ( 0.3%)        16 (   0%)  panicking.rs:581 do_call
           1 ( 0.3%)    229600 (17.2%)  model_file.rs:291 load_text
           1 ( 0.3%)        39 (   0%)  typed_ast.rs:460 visit_map
           1 ( 0.3%)         6 (   0%)  typed_ast.rs:1488 next_key_seed
           1 ( 0.3%)        37 (   0%)  typed_ast.rs:1498 next_value_seed
           1 ( 0.3%)        39 (   0%)  kept.rs:209 UnknownInlinedFun
           1 ( 0.3%)         3 (   0%)  kept.rs:145 kept_key
           1 ( 0.3%)    242400 (18.1%)  model_file.rs:463 load
           1 ( 0.3%)      8720 ( 0.7%)  model_file.rs:467 load
  top allocation points:
         241    624240  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:491 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:580 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
           3        18  [serde_json::Value nodes (and their maps/strings)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         2.7    225760  [Vec/String growth (realloc, grow_one, reserve)] read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>>> @typed_ast.rs:680 < <concerto_core::introspect::typed_ast::DeclarationSeed as serde_core::de::Visitor>::visit_map @typed_ast.rs:648 < <&mu
           2        13  [serde_json::Value nodes (and their maps/strings)] UnknownInlinedFun @src/de/impls.rs:596 < UnknownInlinedFun @src/de.rs:0 < UnknownInlinedFun @src/macros.rs:132 < UnknownInlinedFun @src/de/impls.rs:693
           2        12  [serde_json::Value nodes (and their maps/strings)] UnknownInlinedFun @src/de/impls.rs:596 < UnknownInlinedFun @src/de.rs:0 < UnknownInlinedFun @src/macros.rs:132 < UnknownInlinedFun @src/de/impls.rs:693
           2       768  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
           2        84  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:137 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
           2       117  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           2        60  [serde_json::Value nodes (and their maps/strings)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         1.7        13  [Box::new (boxed nodes)] concerto_core::introspect::model_file::import_short_names @model_file.rs:1341 < {closure#0} @model_file.rs:1351 < {closure#0} @model_file.rs:1351 < {closure#0}<std::collections::hash::map::HashMap<alloc::boxed::Box<str, alloc::alloc::Global>, @u32, u32), rustc
         1.3        11  [serde_json::Value nodes (and their maps/strings)] UnknownInlinedFun @import.rs:183 < {closure#6} @import.rs:184 < <concerto_core::introspect::import::Import as core::convert::TryFrom<&serde_json::value::Value>>::try_from @import.rs:181 < {closure#0} @model_file.rs:1316
           1        16  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1    229600  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:291 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:186 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
           1        39  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, serde_json::value::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < serde_json::value::de::<impl serde_core::de::Deserialize for serde_json::value::Value>::deserialize @src/value/de.rs:151 < UnknownInlinedFun @
           1         6  [serde_json::Value nodes (and their maps/strings)] UnknownInlinedFun @src/value/de.rs:1366 < UnknownInlinedFun @src/de/mod.rs:1547 < UnknownInlinedFun @src/de/value.rs:573 < UnknownInlinedFun @src/macros.rs:132
