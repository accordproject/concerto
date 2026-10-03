/home/user/wt/P5-109/concerto/migration/bench/results/P5-109/typedread/dhat/conformance.json: 14.9 allocations, 5949 bytes per load
  by kind: allocs/load (share) bytes/load (share)
         4.9 (32.5%)       982 (16.5%)  Kept nodes (P5-76 JSON tree)
         3.7 (24.6%)      2293 (38.5%)  Vec/String growth (realloc, grow_one, reserve)
         2.5 (16.4%)       166 ( 2.8%)  serde_json::Value nodes (and their maps/strings)
         1.5 (10.3%)        46 ( 0.8%)  string copies (to_owned, to_string, format!)
           1 ( 6.8%)      1132 (  19%)  Vec collect / with_capacity (sized once)
           1 ( 6.8%)      1320 (22.2%)  other
         0.3 ( 2.3%)         7 ( 0.1%)  owned Strings decoded from the JSON text
           0 ( 0.2%)         2 (   0%)  Box::new (boxed nodes)
           0 (   0%)         1 (   0%)  hash/index tables (IndexMap, HashMap, HashSet)
           0 (   0%)         0 (   0%)  Arc/Rc
  by origin: allocs/load (share) bytes/load (share)
         1.7 (11.3%)       693 (11.6%)  kept.rs:237 visit_map
         1.6 (10.6%)        50 ( 0.8%)  kept.rs:137 deserialize
         1.3 ( 8.5%)      1502 (25.2%)  typed_ast.rs:843 push_kept
         1.3 ( 8.5%)       706 (11.9%)  typed_ast.rs:491 exact
           1 ( 6.7%)        43 ( 0.7%)  panicking.rs:581 do_call
           1 ( 6.7%)      1320 (22.2%)  model_file.rs:291 load_text
           1 ( 6.7%)        38 ( 0.6%)  typed_ast.rs:460 visit_map
           1 ( 6.7%)      1132 (  19%)  model_file.rs:463 load
           1 ( 6.7%)       208 ( 3.5%)  typed_ast.rs:1691 UnknownInlinedFun
         0.6 ( 4.1%)        70 ( 1.2%)  typed_ast.rs:1520 next_value_seed
         0.6 ( 3.9%)        36 ( 0.6%)  model_util.rs:106 UnknownInlinedFun
         0.5 ( 3.6%)        40 ( 0.7%)  property.rs:532 check_bound_validators
         0.5 ( 3.5%)        14 ( 0.2%)  name.rs:77 new
         0.3 (   2%)         1 (   0%)  name.rs:118 into_string
         0.3 ( 1.8%)         1 (   0%)  property.rs:528 check_bound_validators
         0.3 ( 1.8%)         1 (   0%)  kept.rs:80 to_value
         0.1 (   1%)        33 ( 0.6%)  kept.rs:78 to_value
         0.1 ( 0.8%)         5 ( 0.1%)  kept.rs:209 UnknownInlinedFun
         0.1 ( 0.8%)         0 (   0%)  kept.rs:145 kept_key
         0.1 ( 0.7%)         1 (   0%)  typed_ast.rs:1242 take
         0.1 ( 0.5%)         2 (   0%)  kept.rs:76 to_value
           0 ( 0.3%)         6 ( 0.1%)  ser.rs:266 serialize_map
           0 ( 0.3%)         9 ( 0.1%)  typed_ast.rs:683 ErrorBridge>
           0 ( 0.3%)         0 (   0%)  typed_ast.rs:1516 UnknownInlinedFun
           0 ( 0.3%)         1 (   0%)  read.rs:527 parse_str_bytes
  top allocation points:
         1.1      1300  [Vec/String growth (realloc, grow_one, reserve)] concerto_core::introspect::typed_ast::PropertySeed::push_kept @typed_ast.rs:843 < read_property<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>>> @typed_ast.rs:990 < <concerto_core::introspect::typed_ast::
         1.1       590  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:491 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:580 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
           1        43  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1      1320  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:291 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:186 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
           1        38  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, serde_json::value::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < serde_json::value::de::<impl serde_core::de::Deserialize for serde_json::value::Value>::deserialize @src/value/de.rs:151 < UnknownInlinedFun @
           1      1132  [Vec collect / with_capacity (sized once)] concerto_core::introspect::model_file::ModelFile::load @model_file.rs:463 < concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:319 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:18
         0.5        33  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         0.5        40  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         0.5        17  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:137 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.5       197  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.5       187  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.5        16  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:137 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.4       140  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.4        14  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:137 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.3         1  [string copies (to_owned, to_string, format!)] concerto_core::introspect::property::Property::check_bound_validators @property.rs:528 < finish @declaration.rs:658 < {closure#2} @declaration.rs:1236 < concerto_core::introspect::declaration::Declaration::from_typed @declaration.rs:1235
