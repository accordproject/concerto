/home/user/wt/P5-131/concerto/migration/bench/results/P5-131/typedread/dhat/conformance.json: 14.4 allocations, 5910 bytes per load
  by kind: allocs/load (share) bytes/load (share)
         5.6 (38.8%)      1061 (17.9%)  Kept nodes (P5-76 JSON tree)
         3.7 (25.5%)      2293 (38.8%)  Vec/String growth (realloc, grow_one, reserve)
         1.6 (11.2%)        47 ( 0.8%)  string copies (to_owned, to_string, format!)
         1.1 ( 7.4%)      1321 (22.4%)  other
           1 (   7%)      1132 (19.2%)  Vec collect / with_capacity (sized once)
           1 ( 6.9%)        38 ( 0.6%)  serde_json::Value nodes (and their maps/strings)
         0.4 ( 2.5%)         8 ( 0.1%)  owned Strings decoded from the JSON text
         0.1 ( 0.4%)         8 ( 0.1%)  hash/index tables (IndexMap, HashMap, HashSet)
           0 ( 0.2%)         2 (   0%)  Box::new (boxed nodes)
           0 (   0%)         0 (   0%)  Arc/Rc
  by origin: allocs/load (share) bytes/load (share)
         1.8 (12.4%)       731 (12.4%)  kept.rs:238 visit_map
         1.7 (11.7%)        53 ( 0.9%)  kept.rs:138 deserialize
         1.3 ( 8.8%)      1502 (25.4%)  typed_ast.rs:807 push_kept
         1.3 ( 8.8%)       706 (11.9%)  typed_ast.rs:443 exact
           1 ( 6.9%)        43 ( 0.7%)  panicking.rs:581 do_call
           1 ( 6.9%)      1320 (22.3%)  model_file.rs:268 load_text
           1 ( 6.9%)        38 ( 0.6%)  typed_ast.rs:414 visit_map
           1 ( 6.9%)      1132 (19.1%)  model_file.rs:432 load
           1 ( 6.9%)       208 ( 3.5%)  typed_ast.rs:1613 UnknownInlinedFun
         0.5 ( 3.7%)        33 ( 0.6%)  model_util.rs:106 qualify
         0.5 ( 3.7%)        40 ( 0.7%)  property.rs:452 check_bound_validators
         0.5 ( 3.6%)        14 ( 0.2%)  name.rs:69 new
         0.3 (   2%)         1 (   0%)  name.rs:110 into_string
         0.3 ( 1.9%)         1 (   0%)  property.rs:448 check_bound_validators
         0.3 ( 1.9%)         1 (   0%)  kept.rs:81 to_value
         0.1 (   1%)         6 ( 0.1%)  kept.rs:210 UnknownInlinedFun
         0.1 (   1%)        33 ( 0.6%)  kept.rs:79 to_value
         0.1 ( 0.8%)         0 (   0%)  kept.rs:146 kept_key
         0.1 ( 0.5%)         2 (   0%)  kept.rs:77 to_value
         0.1 ( 0.4%)         1 (   0%)  ser.rs:134 UnknownInlinedFun
           0 ( 0.3%)         6 ( 0.1%)  ser.rs:231 serialize_map
           0 ( 0.3%)         0 (   0%)  ser.rs:509 serialize_str
           0 ( 0.3%)         4 ( 0.1%)  model_util.rs:106 UnknownInlinedFun
           0 ( 0.3%)         1 (   0%)  read.rs:527 parse_str_bytes
           0 ( 0.2%)         0 (   0%)  declaration.rs:1010 from_typed
  top allocation points:
         1.1      1300  [Vec/String growth (realloc, grow_one, reserve)] concerto_core::introspect::typed_ast::PropertySeed::push_kept @typed_ast.rs:807 < read_property<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>>> @typed_ast.rs:946 < <concerto_core::introspect::typed_ast::
         1.1       590  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:443 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:532 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
           1        43  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1      1320  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:268 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:175 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
           1        38  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, concerto_core::json::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < concerto_core::json::de::<impl serde_core::de::Deserialize for concerto_core::json::Value>::deserialize @de.rs:135 < UnknownInlinedFun @src/
           1      1132  [Vec collect / with_capacity (sized once)] concerto_core::introspect::model_file::ModelFile::load @model_file.rs:432 < concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:296 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:17
         0.5        33  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         0.5        40  [Vec/String growth (realloc, grow_one, reserve)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         0.5        17  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.5       197  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.5       187  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.5        16  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.4       140  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.4        14  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
         0.3         1  [string copies (to_owned, to_string, format!)] concerto_core::introspect::property::Property::check_bound_validators @property.rs:448 < finish @declaration.rs:524 < {closure#2} @declaration.rs:1041 < concerto_core::introspect::declaration::Declaration::from_typed @declaration.rs:1040
