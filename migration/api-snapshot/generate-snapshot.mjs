#!/usr/bin/env node
/**
 * Generates the concerto-core public API snapshot used by
 * migration/bin/check-guardrails.mjs (plan P0-02 part B):
 *   migration/api-snapshot/index.d.ts    normalised .d.ts for src/index.ts
 *                                        (just the re-export list — kept for
 *                                        readability/back-compat, NOT the
 *                                        thing rule 4 actually diffs)
 *   migration/api-snapshot/full-api.d.ts EVERY .d.ts emitted for
 *                                        concerto-core (method/type/property
 *                                        signatures for every exported
 *                                        class), concatenated in a
 *                                        deterministic (sorted-path) order
 *                                        with per-file `// ==== path ====`
 *                                        headers. THIS is what rule 4 diffs,
 *                                        so a signature change anywhere in
 *                                        the emitted API (not just the
 *                                        top-level export list) is caught.
 *   migration/api-snapshot/exports.json  sorted export list + deep src/...
 *                                        paths
 *
 * Run with --write to (re)generate the committed snapshot; with no flags it
 * just prints what it would write (used by check-guardrails.mjs to diff
 * against the committed snapshot without touching it).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MIGRATION_ROOT, '..');
const CORE_ROOT = path.join(REPO_ROOT, 'packages', 'concerto-core');

/**
 * Build .d.ts for concerto-core into a temp dir via `tsc --emitDeclarationOnly`,
 * and return { indexDts, fullApiDts, exportNames, deepPaths }.
 * @param {string} [outDir] optional temp dir to build into (caller-owned scratch);
 *   defaults to a fresh os.tmpdir() subdirectory.
 */
export function buildSnapshot(outDir) {
    const tmp = outDir || fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-core-dts-'));
    fs.mkdirSync(tmp, { recursive: true });
    execFileSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['tsc', '-p', 'tsconfig.build.json', '--emitDeclarationOnly', '--declaration', '--outDir', tmp],
        { cwd: CORE_ROOT, stdio: 'pipe' }
    );
    const indexDtsPath = path.join(tmp, 'index.d.ts');
    const raw = fs.readFileSync(indexDtsPath, 'utf8');
    const normalised = normaliseDts(raw);

    const exportMatch = normalised.match(/export\s*\{([^}]*)\}/);
    const exportNames = exportMatch
        ? exportMatch[1].split(',').map((s) => s.trim()).filter(Boolean).sort()
        : [];

    const deepPaths = {};
    const importRe = /import\s+(\w+)\s+from\s+["']\.\/([^"']+)["']/g;
    let m;
    while ((m = importRe.exec(normalised))) {
        deepPaths[m[1]] = m[2];
    }

    // index.d.ts is only a 43-import re-export list; it never carries a
    // single method/property/type signature. The actual public API lives in
    // every OTHER .d.ts tsc emits (one per src/**/*.ts). Walk the whole
    // output tree and concatenate every file, normalised, in a
    // deterministic (sorted relative-path) order with a header per file, so
    // a signature change anywhere gets caught by a plain text diff.
    const allDtsFiles = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.d.ts')) {
                allDtsFiles.push(path.relative(tmp, full).split(path.sep).join('/'));
            }
        }
    })(tmp);
    allDtsFiles.sort();

    const fullApiParts = [];
    for (const rel of allDtsFiles) {
        const text = normaliseDts(fs.readFileSync(path.join(tmp, rel), 'utf8'));
        fullApiParts.push(`// ==== ${rel} ====\n${text}`);
    }
    const fullApiDts = fullApiParts.join('\n');

    return { indexDts: normalised, fullApiDts, exportNames, deepPaths, fileList: allDtsFiles };
}

/** Strip anything environment-dependent (blank-line runs, trailing whitespace). */
function normaliseDts(text) {
    return text
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+$/, ''))
        .filter((l) => l.length > 0)
        .join('\n') + '\n';
}

function writeSnapshot(outDir) {
    const { indexDts, fullApiDts, exportNames, deepPaths, fileList } = buildSnapshot(outDir);
    fs.writeFileSync(path.join(MIGRATION_ROOT, 'api-snapshot', 'index.d.ts'), indexDts);
    fs.writeFileSync(path.join(MIGRATION_ROOT, 'api-snapshot', 'full-api.d.ts'), fullApiDts);
    fs.writeFileSync(
        path.join(MIGRATION_ROOT, 'api-snapshot', 'exports.json'),
        JSON.stringify({ exportNames, deepPaths, fileList }, null, 2) + '\n'
    );
    console.log(`Wrote api-snapshot/index.d.ts, full-api.d.ts (${fileList.length} .d.ts files) and exports.json (${exportNames.length} exports).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (process.argv.includes('--write')) {
        writeSnapshot();
    } else {
        const { exportNames } = buildSnapshot();
        console.log(JSON.stringify(exportNames, null, 2));
    }
}
