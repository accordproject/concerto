#!/usr/bin/env node
// P5-135 (accordproject/concerto-rust#516): move a run's raw benchmark or
// fuzz outputs out of git. For each unit directory named on the command line
// it writes a deterministic tarball of the raw files (sorted entries, fixed
// mtime, uid/gid 0, then `gzip -n -9`) and a MANIFEST beside the summaries
// that stay in git, naming the draft release the tarball goes to, its sha256
// and file count, and every archived path. Upload the tarball to that draft
// release yourself (see migration/bench/README.md, "Raw results");
// migration/bench/bin/fetch-results.sh restores it.
//
//   node migration/bench/bin/archive-results.mjs --release <tag> [--repo <owner/repo>]
//       [--out <dir>] [--remove] <unit dir>...
//
// Run from the concerto checkout root. A unit dir is one of:
//   migration/bench/results/<run>   -> asset bench-<run>.tgz
//   migration/bench/results         -> bench-root.tgz (its top-level files only)
//   migration/fuzz/results/<run>    -> fuzz-<run>.tgz
//   migration/fuzz/results          -> fuzz-root.tgz (its top-level files only)
//   migration/tags, migration/logs  -> <tags|logs>-mocha-results.tgz (mocha-results.json)
// --remove deletes the archived files (and directories left empty) from the
// working tree once the tarball and MANIFEST are written.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

// 2026-10-05T00:00:00Z, the date of the first archive. Fixed, so a tarball
// depends only on the archived bytes and paths.
const MTIME = 1791158400;
const SVG_LIMIT = 200 * 1024;
const SCRIPT_EXT = new Set(['.sh', '.cjs', '.mjs', '.js', '.py', '.patch', '.rs']);
const BENCH_KEEP_NAMES = new Set(['run-log.txt', 'timed-loads.txt', 'summary.txt', 'Cargo.toml', 'Cargo.lock', 'MANIFEST', '.gitignore']);
const FUZZ_KEEP_NAMES = new Set(['run-summary.json', 'divergence-summary.json', 'commits.json', 'state.json', 'run-42.json', 'MANIFEST', '.gitignore']);

/**
 * Whether a file stays in git (a summary, chart, log or script) rather than
 * going into the tarball. migration/bench/results/.gitignore and
 * migration/fuzz/results/.gitignore encode the same rule for new runs.
 * @param {string} area 'bench', 'fuzz' or 'mocha'
 * @param {string} rel path relative to the unit dir
 * @param {number} size bytes
 * @returns {boolean}
 */
function keepInGit(area, rel, size) {
    const base = path.basename(rel);
    const ext = path.extname(base);
    if (area === 'mocha') {
        return base !== 'mocha-results.json';
    }
    if (area === 'fuzz') {
        return FUZZ_KEEP_NAMES.has(base) || ext === '.md';
    }
    return ext === '.md'
        || base === 'tables.json' || base.endsWith('-tables.json')
        || (ext === '.svg' && size <= SVG_LIMIT)
        || BENCH_KEEP_NAMES.has(base) || base.endsWith('-run-log.txt')
        || SCRIPT_EXT.has(ext);
}

/**
 * @param {string} dir unit dir relative to the repo root
 * @returns {{name: string, area: string, topOnly: boolean}}
 */
function unitOf(dir) {
    const d = dir.replace(/\/+$/, '');
    let m;
    if (d === 'migration/bench/results') {
        return { name: 'bench-root', area: 'bench', topOnly: true };
    }
    if (d === 'migration/fuzz/results') {
        return { name: 'fuzz-root', area: 'fuzz', topOnly: true };
    }
    if ((m = /^migration\/bench\/results\/([^/]+)$/.exec(d))) {
        return { name: `bench-${m[1]}`, area: 'bench', topOnly: false };
    }
    if ((m = /^migration\/fuzz\/results\/([^/]+)$/.exec(d))) {
        return { name: `fuzz-${m[1]}`, area: 'fuzz', topOnly: false };
    }
    if ((m = /^migration\/(tags|logs)$/.exec(d))) {
        return { name: `${m[1]}-mocha-results`, area: 'mocha', topOnly: true };
    }
    throw new Error(`not an archivable unit dir: ${dir}`);
}

function walk(root, rel, topOnly, out) {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
            if (!topOnly) {
                walk(root, r, topOnly, out);
            }
        } else if (e.isFile()) {
            out.push(r);
        } else {
            throw new Error(`not a regular file: ${path.join(root, r)}`);
        }
    }
    return out;
}

function octal(n, len) {
    return n.toString(8).padStart(len - 1, '0') + '\0';
}

/**
 * One ustar header block.
 * @param {string} name entry path
 * @param {number} size bytes
 * @param {number} mode file mode
 * @returns {Buffer}
 */
function header(name, size, mode) {
    const h = Buffer.alloc(512, 0);
    let prefix = '';
    let base = name;
    if (Buffer.byteLength(name) > 100) {
        // ustar: split at a '/' so the name fits in 100 bytes, the prefix in 155.
        let i = -1;
        for (let j = name.indexOf('/'); j > 0; j = name.indexOf('/', j + 1)) {
            if (Buffer.byteLength(name.slice(j + 1)) <= 100 && Buffer.byteLength(name.slice(0, j)) <= 155) {
                i = j;
                break;
            }
        }
        if (i < 0) {
            throw new Error(`path too long for ustar: ${name}`);
        }
        prefix = name.slice(0, i);
        base = name.slice(i + 1);
    }
    h.write(base, 0, 100, 'utf8');
    h.write(octal(mode, 8), 100, 8, 'ascii');
    h.write(octal(0, 8), 108, 8, 'ascii');
    h.write(octal(0, 8), 116, 8, 'ascii');
    h.write(octal(size, 12), 124, 12, 'ascii');
    h.write(octal(MTIME, 12), 136, 12, 'ascii');
    h.write('        ', 148, 8, 'ascii');
    h.write('0', 156, 1, 'ascii');
    h.write('ustar\0', 257, 6, 'ascii');
    h.write('00', 263, 2, 'ascii');
    h.write(prefix, 345, 155, 'utf8');
    let sum = 0;
    for (const b of h) {
        sum += b;
    }
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return h;
}

/**
 * The uncompressed tar of `files` (sorted, paths relative to `root`).
 * @param {string} root unit dir
 * @param {string[]} files sorted relative paths
 * @returns {Buffer}
 */
function tarOf(root, files) {
    const parts = [];
    for (const rel of files) {
        const abs = path.join(root, rel);
        const data = fs.readFileSync(abs);
        const mode = fs.statSync(abs).mode & 0o111 ? 0o755 : 0o644;
        parts.push(header(rel, data.length, mode), data);
        const pad = (512 - (data.length % 512)) % 512;
        if (pad) {
            parts.push(Buffer.alloc(pad, 0));
        }
    }
    parts.push(Buffer.alloc(1024, 0));
    return Buffer.concat(parts);
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

function main() {
    const argv = process.argv.slice(2);
    const opt = (k, d) => {
        const i = argv.indexOf(k);
        if (i < 0) {
            return d;
        }
        const v = argv[i + 1];
        argv.splice(i, 2);
        return v;
    };
    const release = opt('--release', null);
    const repo = opt('--repo', 'accordproject/concerto-rust');
    const out = opt('--out', '.');
    const remove = argv.includes('--remove');
    const dirs = argv.filter((a) => a !== '--remove');
    if (!release || !dirs.length) {
        console.error('usage: archive-results.mjs --release <tag> [--repo <owner/repo>] [--out <dir>] [--remove] <unit dir>...');
        process.exit(2);
    }
    fs.mkdirSync(out, { recursive: true });
    for (const dir of dirs) {
        const unit = unitOf(dir);
        const all = walk(dir, '', unit.topOnly, []);
        const files = all
            .filter((rel) => !keepInGit(unit.area, rel, fs.statSync(path.join(dir, rel)).size))
            .sort((a, b) => (Buffer.from(a).compare(Buffer.from(b))));
        if (!files.length) {
            console.error(`${dir}: nothing to archive`);
            continue;
        }
        const tar = tarOf(dir, files);
        const tgz = execFileSync('gzip', ['-n', '-9', '-c'], { input: tar, maxBuffer: 1 << 30 });
        const asset = `${unit.name}.tgz`;
        fs.writeFileSync(path.join(out, asset), tgz);
        const bytes = files.reduce((s, rel) => s + fs.statSync(path.join(dir, rel)).size, 0);
        const manifest = [
            '# P5-135 (accordproject/concerto-rust#516): this directory\'s raw outputs are',
            '# not in git. They are the tarball below, an asset of a draft release.',
            '# Restore them (into this directory) with',
            `#   sh migration/bench/bin/fetch-results.sh ${unit.name}`,
            '# tar_sha256 is the sha256 of the uncompressed tarball, which does not',
            '# depend on the gzip build.',
            `name\t${unit.name}`,
            `dir\t${dir.replace(/\/+$/, '')}`,
            `repo\t${repo}`,
            `release\t${release}`,
            `asset\t${asset}`,
            `sha256\t${sha256(tgz)}`,
            `tar_sha256\t${sha256(tar)}`,
            `files\t${files.length}`,
            `bytes\t${bytes}`,
            'archived:',
            ...files,
            '',
        ].join('\n');
        fs.writeFileSync(path.join(dir, 'MANIFEST'), manifest);
        if (remove) {
            for (const rel of files) {
                fs.unlinkSync(path.join(dir, rel));
                let d = path.dirname(path.join(dir, rel));
                while (d !== path.normalize(dir) && fs.readdirSync(d).length === 0) {
                    fs.rmdirSync(d);
                    d = path.dirname(d);
                }
            }
        }
        console.log([unit.name, asset, sha256(tgz), files.length, bytes, tgz.length].join('\t'));
    }
}

main();
