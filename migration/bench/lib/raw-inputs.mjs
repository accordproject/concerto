// P5-135 (accordproject/concerto-rust#516): raw benchmark outputs are kept
// out of git as draft-release assets, with a MANIFEST in each archived
// directory (see bin/archive-results.mjs). The table scripts call
// requireRawInputs() with every path they read, so that on a fresh checkout
// they stop with a pointer to bin/fetch-results.sh, instead of failing
// obscurely or printing a table of empty rows.

import fs from 'fs';
import path from 'path';

const STOP = new Set(['bench', 'fuzz', 'migration']);

/**
 * The nearest MANIFEST at or above `p`, inside a results tree.
 * @param {string} p absolute path
 * @returns {string|null} the MANIFEST's directory
 */
function manifestDir(p) {
    let d = fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : path.dirname(p);
    for (;;) {
        if (fs.existsSync(path.join(d, 'MANIFEST'))) {
            return d;
        }
        const up = path.dirname(d);
        if (up === d || STOP.has(path.basename(d))) {
            return null;
        }
        d = up;
    }
}

/**
 * @param {string} dir a MANIFEST's directory
 * @returns {{name: string, files: string[]}}
 */
function readManifest(dir) {
    const text = fs.readFileSync(path.join(dir, 'MANIFEST'), 'utf8');
    const name = (/^name\t(.+)$/m.exec(text) || [])[1] || path.basename(dir);
    const at = text.indexOf('\narchived:\n');
    const files = at < 0 ? [] : text.slice(at + '\narchived:\n'.length).split('\n').filter(Boolean);
    return { name, files };
}

/**
 * Exits with status 2 and a fetch-results.sh hint when any archived file
 * under the given paths (files or directories) is missing. Paths outside an
 * archived directory (a new run's own output) are not checked.
 * @param {...(string|null|undefined)} paths the inputs the script reads
 */
export function requireRawInputs(...paths) {
    const need = new Map();
    for (const p of paths.filter(Boolean)) {
        const abs = path.resolve(p);
        const dir = manifestDir(abs);
        if (!dir) {
            continue;
        }
        const { name, files } = readManifest(dir);
        const rel = path.relative(dir, abs);
        const missing = files.filter((f) => (rel === '' || f === rel || f.startsWith(`${rel}/`)) && !fs.existsSync(path.join(dir, f)));
        if (missing.length) {
            need.set(name, (need.get(name) || 0) + missing.length);
        }
    }
    if (need.size) {
        const script = path.basename(process.argv[1] || 'table script');
        const names = [...need.keys()];
        console.error(`${script}: ${[...need.values()].reduce((a, b) => a + b, 0)} raw input file(s) are not in this checkout: `
            + `${names.join(', ')} (archived as draft-release assets, P5-135).\n`
            + `Restore with: sh migration/bench/bin/fetch-results.sh ${names.join(' ')}`);
        process.exit(2);
    }
}
