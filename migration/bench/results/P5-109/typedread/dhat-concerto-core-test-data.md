/home/user/wt/P5-109/concerto/migration/bench/results/P5-109/typedread/dhat/concerto-core-test-data.json: 36.1 allocations, 18766 bytes per load
  by kind: allocs/load (share) bytes/load (share)
        20.2 (  56%)      3296 (17.6%)  Kept nodes (P5-76 JSON tree)
         5.3 (14.8%)       368 (   2%)  serde_json::Value nodes (and their maps/strings)
         4.6 (12.7%)      7744 (41.3%)  Vec/String growth (realloc, grow_one, reserve)
         1.8 (   5%)        36 ( 0.2%)  string copies (to_owned, to_string, format!)
         1.5 ( 4.2%)      3775 (20.1%)  Vec collect / with_capacity (sized once)
         1.1 (   3%)      3279 (17.5%)  other
         0.7 ( 1.9%)       158 ( 0.8%)  Box::new (boxed nodes)
         0.6 ( 1.7%)        14 ( 0.1%)  owned Strings decoded from the JSON text
         0.2 ( 0.7%)        92 ( 0.5%)  hash/index tables (IndexMap, HashMap, HashSet)
           0 ( 0.1%)         3 (   0%)  clones (Clone::clone of other types)
           0 (   0%)         0 (   0%)  Arc/Rc
  by origin: allocs/load (share) bytes/load (share)
         8.3 (23.1%)      2050 (10.9%)  kept.rs:1419 push_sized
         3.9 (10.9%)      7035 (37.5%)  typed_ast.rs:491 exact
           2 ( 5.6%)        68 ( 0.4%)  name.rs:77 new
         1.9 ( 5.2%)        51 ( 0.3%)  kept.rs:137 deserialize
         1.5 ( 4.3%)        17 ( 0.1%)  kept.rs:1739 visit_map
         1.5 ( 4.1%)       103 ( 0.6%)  typed_ast.rs:1520 next_value_seed
         1.3 ( 3.7%)        13 ( 0.1%)  kept.rs:1735 visit_map
         1.3 ( 3.6%)        43 ( 0.2%)  typed_ast.rs:460 visit_map
         1.2 ( 3.4%)       472 ( 2.5%)  kept.rs:237 visit_map
         1.2 ( 3.2%)       174 ( 0.9%)  typed_ast.rs:1691 UnknownInlinedFun
           1 ( 2.8%)        26 ( 0.1%)  panicking.rs:581 do_call
           1 ( 2.8%)      3278 (17.5%)  model_file.rs:291 load_text
         0.9 ( 2.6%)      3749 (  20%)  model_file.rs:463 load
         0.6 ( 1.7%)       177 ( 0.9%)  typed_ast.rs:1573 deserialize
         0.5 ( 1.3%)        75 ( 0.4%)  typed_ast.rs:1687 UnknownInlinedFun
         0.4 ( 1.1%)        14 ( 0.1%)  decorator.rs:637 decode_kept_argument
         0.4 ( 1.1%)         5 (   0%)  name.rs:118 into_string
         0.4 (   1%)       115 ( 0.6%)  kept.rs:231 visit_seq
         0.3 (   1%)         2 (   0%)  kept.rs:145 kept_key
         0.3 (   1%)         6 (   0%)  typed_ast.rs:1242 take
         0.3 ( 0.9%)       141 ( 0.7%)  classicalbacktrack.rs:82 new
         0.3 ( 0.8%)        65 ( 0.3%)  typed_ast.rs:683 ErrorBridge>
         0.2 ( 0.7%)        11 ( 0.1%)  model_file.rs:1341 import_short_names
         0.2 ( 0.6%)         5 (   0%)  model_util.rs:106 UnknownInlinedFun
         0.2 ( 0.6%)         2 (   0%)  typed_ast.rs:1580 deserialize_string
  top allocation points:
         3.4      6060  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:491 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:580 < read_declaration<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::S
         1.7       636  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1419 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1391 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::DecoratorsSeed> @src/de.rs:1436 < <concerto_
         1.7       377  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1419 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1392 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::DecoratorsSeed> @src/de.rs:1436 < <concerto_
         1.5       376  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1419 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1649 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentsSeed> @src/de.rs:1436 < <conce
         1.5        48  [Kept nodes (P5-76 JSON tree)] concerto_core::introspect::kept::push_sized @kept.rs:1419 < visit_seq<serde_json::de::SeqAccess<serde_json::read::StrRead>> @kept.rs:1650 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentsSeed> @src/de.rs:1436 < <conce
         1.3        14  [Kept nodes (P5-76 JSON tree)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
         1.1        10  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:1735 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::PlainArgumentSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::PlainArgumentSeed as serde_core::
         1.1        21  [serde_json::Value nodes (and their maps/strings)] deserialize_any<serde_json::read::StrRead, serde_json::value::de::{impl#0}::deserialize::ValueVisitor> @src/de.rs:0 < serde_json::value::de::<impl serde_core::de::Deserialize for serde_json::value::Value>::deserialize @src/value/de.rs:151 < UnknownInlinedFun @
           1        25  [Kept nodes (P5-76 JSON tree)] deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:0 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed>::deserialize @kept.rs:137 < UnknownInlinedFun @src/de.rs:2033 < concerto_core::i
           1        26  [string copies (to_owned, to_string, format!)] alloc @alloc.rs:95 < alloc_impl_runtime @alloc.rs:190 < alloc_impl @alloc.rs:312 < allocate @alloc.rs:429
           1      3278  [other] concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:291 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:186 < p590_typed_read::typed_read @p590_typed_read.rs:95 < p590_typed_read::ma
         0.9      3749  [Vec collect / with_capacity (sized once)] concerto_core::introspect::model_file::ModelFile::load @model_file.rs:463 < concerto_core::introspect::model_file::ModelFile::load_text @model_file.rs:319 < concerto_core::introspect::model_file::ModelFile::from_json_text_checked_with_imports @model_file.rs:18
         0.5       975  [Vec/String growth (realloc, grow_one, reserve)] exact<concerto_core::introspect::property::Property> @typed_ast.rs:491 < concerto_core::introspect::typed_ast::typed_properties @typed_ast.rs:580 < read_enum<concerto_core::introspect::typed_ast::ErrorBridge<serde_json::de::MapAccess<serde_json::read::StrRead>
         0.5       197  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
         0.3       132  [Kept nodes (P5-76 JSON tree)] visit_map<serde_json::de::MapAccess<serde_json::read::StrRead>> @kept.rs:237 < deserialize_any<serde_json::read::StrRead, concerto_core::introspect::kept::KeptSeed> @src/de.rs:1447 < <concerto_core::introspect::kept::KeptSeed as serde_core::de::DeserializeSeed
