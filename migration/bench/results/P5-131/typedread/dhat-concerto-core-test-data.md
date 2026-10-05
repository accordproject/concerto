/home/user/wt/P5-131/concerto/migration/bench/results/P5-131/typedread/dhat/concerto-core-test-data.json: 34.9 allocations, 18732 bytes per load
  by kind: allocs/load (share) bytes/load (share)
        22.2 (63.8%)      3534 (18.9%)  Kept nodes (P5-76 JSON tree)
         4.6 (13.2%)      7753 (41.4%)  Vec/String growth (realloc, grow_one, reserve)
           2 ( 5.8%)        37 ( 0.2%)  string copies (to_owned, to_string, format!)
         1.5 ( 4.4%)      3787 (20.2%)  Vec collect / with_capacity (sized once)
         1.3 ( 3.9%)        43 ( 0.2%)  serde_json::Value nodes (and their maps/strings)
         1.3 ( 3.6%)      3284 (17.5%)  other
         0.7 (   2%)       158 ( 0.8%)  Box::new (boxed nodes)
         0.7 (   2%)        17 ( 0.1%)  owned Strings decoded from the JSON text
         0.4 ( 1.3%)       115 ( 0.6%)  hash/index tables (IndexMap, HashMap, HashSet)
           0 ( 0.1%)         3 (   0%)  clones (Clone::clone of other types)
           0 (   0%)         0 (   0%)  Arc/Rc
  by origin: allocs/load (share) bytes/load (share)
         8.3 (23.9%)      2050 (10.9%)  kept.rs:1409 push_sized
         3.9 (11.3%)      7035 (37.6%)  typed_ast.rs:443 exact
         2.4 ( 6.8%)        61 ( 0.3%)  kept.rs:138 deserialize
           2 ( 5.8%)        68 ( 0.4%)  name.rs:69 new
         1.5 ( 4.4%)       592 ( 3.2%)  kept.rs:238 visit_map
         1.5 ( 4.4%)        17 ( 0.1%)  kept.rs:1728 visit_map
         1.3 ( 3.9%)        13 ( 0.1%)  kept.rs:1724 visit_map
         1.3 ( 3.8%)        43 ( 0.2%)  typed_ast.rs:414 visit_map
         1.2 ( 3.4%)       174 ( 0.9%)  typed_ast.rs:1613 UnknownInlinedFun
           1 ( 2.9%)        26 ( 0.1%)  panicking.rs:581 do_call
           1 ( 2.9%)      3278 (17.5%)  model_file.rs:268 load_text
         0.9 ( 2.7%)      3749 (  20%)  model_file.rs:432 load
         0.6 ( 1.8%)       177 ( 0.9%)  typed_ast.rs:1495 deserialize
         0.6 ( 1.6%)        21 ( 0.1%)  decorator.rs:517 decode_argument
         0.5 ( 1.4%)         3 (   0%)  kept.rs:146 kept_key
         0.5 ( 1.3%)        75 ( 0.4%)  typed_ast.rs:1609 UnknownInlinedFun
         0.4 ( 1.2%)       132 ( 0.7%)  kept.rs:232 visit_seq
         0.4 ( 1.1%)         5 (   0%)  name.rs:110 into_string
         0.3 ( 0.9%)       141 ( 0.8%)  classicalbacktrack.rs:82 new
         0.3 ( 0.8%)        11 ( 0.1%)  kept.rs:210 UnknownInlinedFun
         0.2 ( 0.7%)        11 ( 0.1%)  model_file.rs:1417 import_short_names
         0.2 ( 0.7%)         5 (   0%)  model_util.rs:106 UnknownInlinedFun
         0.2 ( 0.7%)        80 ( 0.4%)  decorator.rs:647 UnknownInlinedFun
         0.2 ( 0.7%)        29 ( 0.2%)  decorator.rs:91 {closure#0}
         0.2 ( 0.7%)         2 (   0%)  typed_ast.rs:1502 deserialize_string
  top allocation points:
         3.4      6060  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:443 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:532 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
         1.7       636  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1409 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1381 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::DecoratorsSeed> @src/de.rs:1436 < <concerto_
         1.7       377  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1409 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1382 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::DecoratorsSeed> @src/de.rs:1436 < <concerto_
         1.5       376  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1409 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1638 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentsSeed> @src/de.rs:1436 < <conce
         1.5        48  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1409 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1639 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentsSeed> @src/de.rs:1436 < <conce
         1.3        14  [Kept nodes (P5-76 JSON tree)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         1.1        10  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:1724 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::PlainArgumentSeed as serde_core::
         1.1        21  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, concerto_core::json::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < concerto_core::json::de::<impl serde_core::de::Deserialize for concerto_core::json::Value>::deserialize @de.rs:135 < UnknownInlinedFun @src/
           1        25  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:138 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
           1        26  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1      3278  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:268 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:175 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
         0.9      3749  [Vec collect / with_capacity (sized once)] concerto_core::introspect::model_file::ModelFile::load @model_file.rs:432 < concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:296 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:17
         0.5       975  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:443 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:532 < read_enum<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>
         0.5       197  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.3       132  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:238 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
