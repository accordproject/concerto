#!/usr/bin/env node
/**
 * P0-02(B): guardrails for the migration.
 *
 * Exits non-zero (and prints why) if, relative to a given base ref
 * (default origin/main):
 *   1. any file under packages/concerto-core/test/ changed;
 *   2. the `nyc` block in packages/concerto-core/package.json changed;
 *   3. the export list of packages/concerto-core/src/index.ts changed;
 *   4. the generated API snapshot (migration/api-snapshot/) differs from
 *      what concerto-core's current .d.ts actually is.
 *
 * "Changed relative to base ref" covers both committed history (base..HEAD)
 * and anything not yet committed (staged + working tree), so this also
 * works as a local pre-flight/hook check, not just a CI one.
 *
 * Usage:
 *   node migration/bin/check-guardrails.mjs [--base-ref origin/main] [--skip-dts-build]
 *
 * --skip-dts-build skips rule 4's `tsc --emitDeclarationOnly` rebuild and
 * just diffs the previously-generated migration/api-snapshot/ against git's
 * base-ref copy of it (fast path for callers that already regenerated the
 * snapshot themselves, e.g. after intentionally changing the public API).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSnapshot } from '../api-snapshot/generate-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MIGRATION_ROOT, '..');
const CORE_REL = 'packages/concerto-core';
const CORE_ROOT = path.join(REPO_ROOT, CORE_REL);

function argVal(name, def) {
    const i = process.argv.indexOf(`--${name}`);
    return i !== -1 ? process.argv[i + 1] : def;
}
const BASE_REF = argVal('base-ref', 'origin/main');
const SKIP_DTS_BUILD = process.argv.includes('--skip-dts-build');

function git(args) {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function gitOrNull(args) {
    try {
        return git(args);
    } catch (e) {
        return null;
    }
}

const failures = [];

// -- Resolve base ref, fetching it if this is a shallow/partial clone. -----
if (gitOrNull(['rev-parse', '--verify', BASE_REF]) === null) {
    console.error(`base ref '${BASE_REF}' not found locally; trying to fetch...`);
    const [remote, ...rest] = BASE_REF.split('/');
    const branch = rest.join('/');
    if (branch) {
        gitOrNull(['fetch', '--depth=1', remote, branch]);
    }
}
if (gitOrNull(['rev-parse', '--verify', BASE_REF]) === null) {
    console.error(`Cannot resolve base ref '${BASE_REF}'. Pass --base-ref explicitly.`);
    process.exit(2);
}

// -- Rule 1: nothing under packages/concerto-core/test/ changed. -----------
function changedFilesVsBase() {
    const set = new Set();
    const committed = gitOrNull(['diff', '--name-only', `${BASE_REF}...HEAD`]) || '';
    const staged = gitOrNull(['diff', '--name-only', '--cached']) || '';
    const unstaged = gitOrNull(['diff', '--name-only']) || '';
    const untracked = gitOrNull(['ls-files', '--others', '--exclude-standard']) || '';
    for (const chunk of [committed, staged, unstaged, untracked]) {
        for (const line of chunk.split('\n')) {
            const f = line.trim();
            if (f) set.add(f);
        }
    }
    return [...set];
}

const changed = changedFilesVsBase();
const testPrefix = `${CORE_REL}/test/`;
const changedTestFiles = changed.filter((f) => f.startsWith(testPrefix));
if (changedTestFiles.length > 0) {
    failures.push([
        `${changedTestFiles.length} file(s) under ${testPrefix} changed relative to ${BASE_REF}:`,
        ...changedTestFiles.map((f) => `    ${f}`),
    ].join('\n'));
}

// -- Rule 2: the nyc block in package.json is unchanged. --------------------
function readJsonAt(ref, relPath) {
    const text = gitOrNull(['show', `${ref}:${relPath}`]);
    return text === null ? null : JSON.parse(text);
}
const pkgRel = `${CORE_REL}/package.json`;
const basePkg = readJsonAt(BASE_REF, pkgRel);
const currentPkgText = fs.readFileSync(path.join(REPO_ROOT, pkgRel), 'utf8');
const currentPkg = JSON.parse(currentPkgText);
if (basePkg) {
    const baseNyc = JSON.stringify(basePkg.nyc ?? null, Object.keys(basePkg.nyc ?? {}).sort());
    const curNyc = JSON.stringify(currentPkg.nyc ?? null, Object.keys(currentPkg.nyc ?? {}).sort());
    // Compare with normalised (sorted-key) JSON so key reordering alone
    // doesn't trip the guardrail, but any value/threshold change does.
    const norm = (o) => JSON.stringify(sortKeysDeep(o));
    if (norm(basePkg.nyc ?? null) !== norm(currentPkg.nyc ?? null)) {
        failures.push(
            `The "nyc" block in ${pkgRel} changed relative to ${BASE_REF}.\n` +
            `  base:    ${norm(basePkg.nyc ?? null)}\n` +
            `  current: ${norm(currentPkg.nyc ?? null)}`
        );
    }
} else {
    console.warn(`(warning) could not read ${pkgRel} at ${BASE_REF}; skipping nyc-block check`);
}

function sortKeysDeep(o) {
    if (Array.isArray(o)) return o.map(sortKeysDeep);
    if (o && typeof o === 'object') {
        return Object.keys(o).sort().reduce((acc, k) => {
            acc[k] = sortKeysDeep(o[k]);
            return acc;
        }, {});
    }
    return o;
}

// -- Rule 3: export list of src/index.ts is unchanged. -----------------------
function extractExportNames(indexTsText) {
    const m = indexTsText.match(/export\s*\{([^}]*)\}/);
    if (!m) return null;
    return m[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
}
const indexTsRel = `${CORE_REL}/src/index.ts`;
const baseIndexTs = gitOrNull(['show', `${BASE_REF}:${indexTsRel}`]);
const currentIndexTs = fs.readFileSync(path.join(REPO_ROOT, indexTsRel), 'utf8');
if (baseIndexTs !== null) {
    const baseExports = extractExportNames(baseIndexTs);
    const currentExports = extractExportNames(currentIndexTs);
    if (JSON.stringify(baseExports) !== JSON.stringify(currentExports)) {
        const added = currentExports.filter((n) => !baseExports.includes(n));
        const removed = baseExports.filter((n) => !currentExports.includes(n));
        failures.push(
            `The export list of ${indexTsRel} changed relative to ${BASE_REF}.\n` +
            `  added:   ${JSON.stringify(added)}\n` +
            `  removed: ${JSON.stringify(removed)}`
        );
    }
} else {
    console.warn(`(warning) could not read ${indexTsRel} at ${BASE_REF}; skipping export-list check`);
}

// -- Rule 4: the generated API (.d.ts) snapshot is unchanged. ----------------
const snapshotDir = path.join(MIGRATION_ROOT, 'api-snapshot');
const storedIndexDts = fs.existsSync(path.join(snapshotDir, 'index.d.ts'))
    ? fs.readFileSync(path.join(snapshotDir, 'index.d.ts'), 'utf8')
    : null;
const storedFullApiDts = fs.existsSync(path.join(snapshotDir, 'full-api.d.ts'))
    ? fs.readFileSync(path.join(snapshotDir, 'full-api.d.ts'), 'utf8')
    : null;
const storedExportsJson = fs.existsSync(path.join(snapshotDir, 'exports.json'))
    ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'exports.json'), 'utf8'))
    : null;

if (storedIndexDts === null || storedFullApiDts === null || storedExportsJson === null) {
    failures.push(`No (complete) API snapshot found under ${path.relative(REPO_ROOT, snapshotDir)}/. Run 'node migration/api-snapshot/generate-snapshot.mjs --write' once and commit it.`);
} else if (!SKIP_DTS_BUILD) {
    // Full check: rebuild concerto-core's .d.ts right now and diff it
    // against the committed snapshot, so a real (uncommitted) API change
    // is caught even before the snapshot file itself is touched.
    //
    // index.d.ts alone is NOT enough here: it is only concerto-core's
    // 43-import re-export list and carries no method/property/type
    // signatures at all, so a signature change (e.g. a new public method,
    // or a changed parameter/return type on an existing one) would leave it
    // byte-identical. full-api.d.ts is every .d.ts tsc emits for
    // concerto-core concatenated together, and IS what actually diffs on a
    // signature change; it is the file this rule treats as authoritative.
    let current;
    try {
        current = buildSnapshot();
    } catch (e) {
        failures.push(`Failed to build concerto-core's .d.ts to check the API snapshot: ${e.message}`);
        current = null;
    }
    if (current) {
        if (current.fullApiDts !== storedFullApiDts) {
            failures.push(
                `The generated API snapshot (${path.relative(REPO_ROOT, snapshotDir)}/full-api.d.ts) differs from concerto-core's current .d.ts output (this covers every exported class's method/property/type signatures, not just the top-level export list).\n` +
                '  Regenerate it with: node migration/api-snapshot/generate-snapshot.mjs --write\n' +
                '  ...and confirm the diff is an *intended* public API change before committing it.'
            );
        } else if (current.indexDts !== storedIndexDts) {
            // Extremely unlikely to fire without the full-api check above
            // also firing (index.d.ts is a strict subset of what full-api.d.ts
            // captures), but kept as a defence-in-depth check.
            failures.push(
                `The generated API snapshot (${path.relative(REPO_ROOT, snapshotDir)}/index.d.ts) differs from concerto-core's current .d.ts.\n` +
                '  Regenerate it with: node migration/api-snapshot/generate-snapshot.mjs --write'
            );
        }
        const curExportNames = JSON.stringify(current.exportNames);
        const storedExportNames = JSON.stringify(storedExportsJson.exportNames);
        if (curExportNames !== storedExportNames) {
            failures.push(`The API snapshot's export list no longer matches concerto-core's actual exports.\n  stored:  ${storedExportNames}\n  current: ${curExportNames}`);
        }
    }
} else {
    // Fast path: skip the tsc rebuild and just check that the committed
    // snapshot files themselves haven't drifted from the base ref (still
    // catches someone hand-editing or reverting the snapshot).
    const snapRel = (name) => path.relative(REPO_ROOT, path.join(snapshotDir, name));
    for (const name of ['index.d.ts', 'full-api.d.ts', 'exports.json']) {
        const baseText = gitOrNull(['show', `${BASE_REF}:${snapRel(name)}`]);
        const curText = fs.readFileSync(path.join(snapshotDir, name), 'utf8');
        if (baseText !== null && baseText !== curText) {
            failures.push(`${snapRel(name)} differs from ${BASE_REF} (checked without rebuilding; pass without --skip-dts-build for a full check against the live .d.ts).`);
        }
    }
}

// -- Report. ------------------------------------------------------------------
if (failures.length > 0) {
    console.error(`\nGUARDRAILS FAILED (${failures.length} violation(s), base ref: ${BASE_REF}):\n`);
    for (const f of failures) {
        console.error(`- ${f}\n`);
    }
    process.exit(1);
}
console.log(`Guardrails OK (base ref: ${BASE_REF}).`);
