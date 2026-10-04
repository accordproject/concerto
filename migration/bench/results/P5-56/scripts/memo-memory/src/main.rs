// P5-56 (T2, F-A2): the memory the concerto-wasm extract memo keeps, and the
// native time of a full extract against a memoised one.
//
// The memo (concerto-wasm `DcsExtractKept`) keeps the resolved source models
// the extractor walks, the result manager, the result's AST as JSON text and
// one staged header per result model file. This measures the first three
// with a counting allocator (the headers, a version and a few short names per
// file, are left out), next to the source manager itself, whose models are
// what the memo copies.
//
// Usage: p556-memo-memory <p530 dumped models .json> [--iters N] [--warmup N]

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicIsize, Ordering};
use std::time::Instant;

use concerto_core::{ModelFile, ModelManager, dcs};
use serde_json::Value;

struct Counting;

static LIVE: AtomicIsize = AtomicIsize::new(0);

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        LIVE.fetch_add(layout.size() as isize, Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        LIVE.fetch_sub(layout.size() as isize, Ordering::Relaxed);
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        LIVE.fetch_add(new_size as isize - layout.size() as isize, Ordering::Relaxed);
        unsafe { System.realloc(ptr, layout, new_size) }
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

fn live() -> isize {
    LIVE.load(Ordering::Relaxed)
}

/// The result manager's AST as JSON text, as concerto-wasm's
/// `ModelManagerAstView` writes it.
fn ast_text(mm: &ModelManager) -> String {
    struct Asts<'a>(&'a ModelManager);
    impl serde::Serialize for Asts<'_> {
        fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
            s.collect_seq(self.0.model_files().map(ModelFile::ast))
        }
    }
    format!(
        "{{\"$class\":\"concerto.metamodel@1.0.0.Models\",\"models\":{}}}",
        serde_json::to_string(&Asts(mm)).unwrap()
    )
}

fn median(v: &mut [f64]) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let opt = |k: &str, d: &str| -> String {
        args.iter()
            .position(|a| a == k)
            .map(|i| args[i + 1].clone())
            .unwrap_or_else(|| d.to_string())
    };
    let iters: usize = opt("--iters", "60").parse().unwrap();
    let warmup: usize = opt("--warmup", "10").parse().unwrap();
    let input = std::fs::read_to_string(&args[1]).expect("input file");
    let models: Vec<Value> = serde_json::from_str(&input).unwrap();
    drop(input);

    let before = live();
    let mut source = ModelManager::new().unwrap();
    for model in &models {
        source.add_model_with_definitions(model, None, None).unwrap();
    }
    let source_bytes = live() - before;

    let opts = dcs::ExtractOptions::default();
    let action = dcs::extractor::Action::ExtractAll;

    // The memo, as the second call at an epoch fills it.
    let before = live();
    let (result, kept_source) = dcs::extract_encoded_keeping_source(&source, &opts, action).unwrap();
    let dcs::extractor::EncodedExtractResult {
        model_manager,
        decorator_command_set,
        vocabularies,
    } = result;
    drop(decorator_command_set);
    drop(vocabularies);
    let after_kept_models = live();
    let text = ast_text(&model_manager);
    let memo_bytes = live() - before;
    let text_bytes = live() - after_kept_models;
    let before_drop = live();
    drop(kept_source);
    let source_models_bytes = before_drop - live();
    let result_manager_bytes = memo_bytes - text_bytes - source_models_bytes;
    let (kept_source_again, result_again) = {
        let (r, s) = dcs::extract_encoded_keeping_source(&source, &opts, action).unwrap();
        (s, r)
    };

    // Native time: a full extract (as every call without the memo) against
    // a memoised one (the command sets and vocabularies rebuilt from the
    // kept source models, plus the result's file clones staging makes and a
    // copy of the AST text), each dropped as the binding drops it.
    let full = || {
        let t = Instant::now();
        let r = dcs::extract_encoded(&source, &opts, action).unwrap();
        let clones: Vec<ModelFile> = r.model_manager.model_files().cloned().collect();
        let text = ast_text(&r.model_manager);
        drop((r, clones, text));
        t.elapsed().as_secs_f64() * 1e3
    };
    let memo = || {
        let t = Instant::now();
        let (sets, vocab) = dcs::encode_extract_source(&kept_source_again, &opts, action).unwrap();
        let clones: Vec<ModelFile> = result_again.model_manager.model_files().cloned().collect();
        let copy = text.clone();
        drop((sets, vocab, clones, copy));
        t.elapsed().as_secs_f64() * 1e3
    };
    for _ in 0..warmup {
        full();
        memo();
    }
    let mut f = Vec::new();
    let mut m = Vec::new();
    for _ in 0..iters {
        f.push(full());
        m.push(memo());
    }
    let mib = |b: isize| b as f64 / (1024.0 * 1024.0);
    println!(
        "{{\"input\":{:?},\"models\":{},\"source_manager_bytes\":{},\"memo_bytes\":{},\"memo_source_models_bytes\":{},\"memo_result_manager_bytes\":{},\"memo_ast_text_bytes\":{},\"memo_over_source_manager\":{:.2},\"memo_mib\":{:.2},\"native_full_ms\":{:.3},\"native_memo_ms\":{:.3}}}",
        args[1],
        models.len(),
        source_bytes,
        memo_bytes,
        source_models_bytes,
        result_manager_bytes,
        text_bytes,
        memo_bytes as f64 / source_bytes as f64,
        mib(memo_bytes),
        median(&mut f),
        median(&mut m)
    );
    drop(model_manager);
}
