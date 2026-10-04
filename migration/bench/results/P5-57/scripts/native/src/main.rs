//! P5-57 scratch bench.
//!
//!   p557-native <models.json> [--iters N] [--warmup N]
//!
//! `<models.json>` is one of the P5-30 dumped inputs (the `models` array the
//! TS API hands the engine for `extractDecorators`). The input manager is
//! built once, untimed, as the resident path keeps it. Per iteration, for
//! `removeDecoratorsFromModel` false (the sweep's default) and true, it
//! times, interleaved:
//!
//! - `value`: `dcs::extract_decorators` (the Value route, P5-40), then the
//!   command sets and vocabularies to JSON text as P5-41's encode writes
//!   them, then the drop;
//! - `direct`: `dcs::extract_encoded` (P5-57), the vocabularies to JSON
//!   text, then the drop.
//!
//! The model-AST part of the encode is the same on both sides and is left
//! out. Before timing, it checks the two routes agree byte for byte for
//! every action, both remove settings and two locales. Prints one JSON
//! object: per stage, the median and min in microseconds.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::hint::black_box;
use std::time::Instant;

use concerto_core::dcs::{self, extractor::Action};
use concerto_core::ModelManager;
use serde_json::{Value, json};

fn median(v: &mut [f64]) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let input = std::fs::read_to_string(&args[1]).expect("input file");
    let opt = |k: &str, d: &str| -> String {
        args.iter()
            .position(|a| a == k)
            .map(|i| args[i + 1].clone())
            .unwrap_or_else(|| d.to_string())
    };
    let iters: usize = opt("--iters", "30").parse().unwrap();
    let warmup: usize = opt("--warmup", "5").parse().unwrap();
    let models: Vec<Value> = serde_json::from_str(&input).unwrap();
    let mut source = ModelManager::new().unwrap();
    for model in &models {
        source.add_model_with_definitions(model, None, None).unwrap();
    }

    // Byte identity, every action x remove x locale.
    let mut checked = 0;
    let mut commands = 0;
    for remove in [false, true] {
        for locale in ["en", "fr"] {
            let opts = dcs::ExtractOptions { remove_decorators_from_model: remove, locale: locale.to_string() };
            for action in [Action::ExtractAll, Action::ExtractVocab, Action::ExtractNonVocab] {
                let v = match action {
                    Action::ExtractAll => dcs::extract_decorators(&source, &opts),
                    Action::ExtractVocab => dcs::extract_vocabularies(&source, &opts),
                    Action::ExtractNonVocab => dcs::extract_non_vocab_decorators(&source, &opts),
                }
                .unwrap();
                let d = dcs::extract_encoded(&source, &opts, action).unwrap();
                assert_eq!(serde_json::to_string(&v.decorator_command_set).unwrap(), d.decorator_command_set, "{action:?} {remove} {locale}");
                assert_eq!(v.vocabularies, d.vocabularies, "{action:?} {remove} {locale}");
                assert!(v.model_manager.model_files().map(|f| f.ast()).eq(d.model_manager.model_files().map(|f| f.ast())));
                if action == Action::ExtractAll && !remove && locale == "en" {
                    commands = v.decorator_command_set.iter().map(|s| s["commands"].as_array().map_or(0, Vec::len)).sum::<usize>();
                    eprintln!("sets {} commands {} vocabularies {}", v.decorator_command_set.len(), commands, v.vocabularies.len());
                }
                checked += 1;
            }
        }
    }

    let names = ["value_false", "direct_false", "value_true", "direct_true"];
    let mut times: Vec<Vec<f64>> = vec![Vec::new(); names.len()];
    for i in 0..warmup + iters {
        let mut row = [0.0f64; 4];
        for (k, remove) in [false, true].into_iter().enumerate() {
            let opts = dcs::ExtractOptions { remove_decorators_from_model: remove, locale: "en".to_string() };
            let order: [usize; 2] = if i % 2 == 0 { [0, 1] } else { [1, 0] };
            for side in order {
                let t = Instant::now();
                if side == 0 {
                    let r = dcs::extract_decorators(&source, &opts).unwrap();
                    black_box(serde_json::to_string(&r.decorator_command_set).unwrap());
                    black_box(serde_json::to_string(&r.vocabularies).unwrap());
                    drop(black_box(r));
                } else {
                    let r = dcs::extract_encoded(&source, &opts, Action::ExtractAll).unwrap();
                    black_box(serde_json::to_string(&r.vocabularies).unwrap());
                    drop(black_box(r));
                }
                row[k * 2 + side] = t.elapsed().as_secs_f64() * 1e6;
            }
        }
        if i >= warmup {
            for (j, v) in row.iter().enumerate() {
                times[j].push(*v);
            }
        }
    }
    let mut out = serde_json::Map::new();
    for (j, name) in names.iter().enumerate() {
        let min = times[j].iter().cloned().fold(f64::INFINITY, f64::min);
        out.insert(name.to_string(), json!({ "median_us": median(&mut times[j]), "min_us": min }));
    }
    out.insert("identity_checked".into(), json!(checked));
    out.insert("commands".into(), json!(commands));
    println!("{}", Value::Object(out));
}
