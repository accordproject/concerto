import { summarise } from './stats.mjs';

/**
 * Runs `fn` repeatedly and returns timing samples in milliseconds, one per
 * call. `fn` is expected to itself iterate over a batch of `n` logical
 * operations (e.g. one call per model in a model set) so the harness measures
 * whole-batch cost per sample, and `summarise` divides back down to a
 * per-operation figure.
 *
 * @param {() => void} fn
 * @param {object} [opts]
 * @param {number} [opts.warmup] - untimed calls before sampling starts
 * @param {number} [opts.samples] - timed calls to record
 * @param {number} [opts.n] - logical operations per call, for per-op stats
 */
export function timeit(fn, { warmup = 3, samples = 20, n = 1 } = {}) {
    for (let i = 0; i < warmup; i++) {
        fn();
    }
    const times = [];
    for (let i = 0; i < samples; i++) {
        const t0 = process.hrtime.bigint();
        fn();
        const t1 = process.hrtime.bigint();
        times.push(Number(t1 - t0) / 1e6);
    }
    return summarise(times, n);
}
