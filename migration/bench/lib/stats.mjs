// Small, dependency-free statistics helpers for the benchmark harness.
//
// We deliberately do not pull in a benchmarking library (tinybench or
// otherwise): this repo's owned path for task P5-04a is `migration/bench/`
// only, and adding a new dependency would mean touching the workspace
// root `package.json`/`package-lock.json`, which is outside that path.
// These few functions are all the harness needs.

/**
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

/**
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Sample standard deviation.
 * @param {number[]} values
 * @returns {number}
 */
export function stddev(values) {
    if (values.length < 2) {
        return 0;
    }
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Coefficient of variation, as a fraction (0.05 = 5%). This is the number we
 * check reruns against per the exit condition ("rerunning gives numbers
 * within the stated variance").
 * @param {number[]} values
 * @returns {number}
 */
export function coefficientOfVariation(values) {
    const m = mean(values);
    if (m === 0) {
        return 0;
    }
    return stddev(values) / m;
}

/**
 * Summarises a set of samples (in milliseconds) the same way for every
 * workload, so the TS and Rust reports line up.
 * @param {number[]} samplesMs
 * @param {number} n - number of logical operations each sample covers, so
 *   per-operation timings are comparable across workloads with different
 *   batch sizes.
 */
export function summarise(samplesMs, n = 1) {
    const perOp = samplesMs.map((s) => s / n);
    return {
        samples: samplesMs.length,
        n,
        median_ms: median(perOp),
        mean_ms: mean(perOp),
        stddev_ms: stddev(perOp),
        min_ms: Math.min(...perOp),
        max_ms: Math.max(...perOp),
        cv: coefficientOfVariation(perOp),
    };
}
