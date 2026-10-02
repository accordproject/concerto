#!/usr/bin/env node
/**
 * P5-84 (accordproject/concerto-rust#430): the public .d.ts type check
 * against the published concerto-core 5.0.0.
 *
 * The byte-identical snapshot rule (check-guardrails.mjs rule 4) only says
 * that the committed snapshot matches the live build; a regenerated snapshot
 * passes it whatever the types became. P5-02 regenerated it with 14 public
 * return types turned into `never`, and nothing failed. This module compares
 * every public member's types with v5.0.0's instead:
 *
 *   - a member type that is `never` now, where v5.0.0 had another type, or
 *   - a member type that is `any` now, where v5.0.0 had a concrete type
 *     (anything but `any`, `unknown` or `never`),
 *
 * is a violation, unless migration/api-snapshot/v5-types-allowlist.tsv lists
 * it with a BC reference (a row of migration/BREAKING-CHANGES-PLAN.md).
 *
 * A "member type" is a method's or function's return type, each parameter's
 * type, a property's type or an accessor's type, keyed by file, owner
 * (class, interface or `<module>`), member name and overload index. Members
 * that are `private` in the .d.ts, or that are missing on either side, are
 * not compared (removals and additions are rule 4's and the BC plan's job).
 *
 * The v5.0.0 side is migration/api-snapshot/v5.0.0-full-api.d.ts, the
 * published package's dist/**.d.ts (not esm*) concatenated in the same format
 * as full-api.d.ts. Regenerate it, only from the published package, with:
 *   npm --prefix migration/oracle/reference ci
 *   node migration/api-snapshot/v5-types.mjs --write-v5-baseline
 *
 * The same rule also compiles migration/api-snapshot/consumer/strict-consumer.ts
 * with `tsc --strict` against the live .d.ts: a small consumer that uses the
 * 14 methods P5-84 restored, and asserts their exact v5.0.0 types.
 *
 * Usage (stand-alone; check-guardrails.mjs runs both checks as rule 5):
 *   node migration/api-snapshot/v5-types.mjs [--snapshot <full-api.d.ts>]
 *   node migration/api-snapshot/v5-types.mjs --consumer-against-v5
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MIGRATION_ROOT, '..');
const require = createRequire(import.meta.url);

export const V5_BASELINE = path.join(__dirname, 'v5.0.0-full-api.d.ts');
export const ALLOW_LIST = path.join(__dirname, 'v5-types-allowlist.tsv');
export const CONSUMER = path.join(__dirname, 'consumer', 'strict-consumer.ts');
const REFERENCE_DIST = path.join(MIGRATION_ROOT, 'oracle', 'reference', 'node_modules', '@accordproject', 'concerto-core');

function loadTs() {
    return require(require.resolve('typescript', { paths: [REPO_ROOT] }));
}

/**
 * Split a concatenated snapshot (`// ==== rel/path.d.ts ====` headers) into
 * { relPath: text }.
 * @param {string} text the snapshot
 * @return {Object<string,string>} the files
 */
export function splitSnapshot(text) {
    const files = {};
    let current = null;
    let lines = [];
    for (const line of text.split('\n')) {
        const m = line.match(/^\/\/ ==== (.+) ====$/);
        if (m) {
            if (current !== null) {
                files[current] = lines.join('\n');
            }
            current = m[1];
            lines = [];
        } else {
            lines.push(line);
        }
    }
    if (current !== null) {
        files[current] = lines.join('\n');
    }
    return files;
}

function normaliseType(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Collect every public member type in one .d.ts text.
 * @param {string} rel the file's path, used in the keys
 * @param {string} text the .d.ts text
 * @return {Map<string,string>} key -> type text
 */
export function collectMemberTypes(rel, text) {
    const ts = loadTs();
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const out = new Map();
    const counters = new Map();
    const isPrivate = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Private) !== 0
        || (node.name && ts.isPrivateIdentifier(node.name));
    const typeText = (t) => (t ? normaliseType(t.getText(sf)) : null);
    const nameOf = (node) => {
        if (!node.name) {
            return ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node) ? 'constructor' : '(call)';
        }
        return node.name.getText(sf);
    };
    const put = (key, type) => {
        if (type !== null) {
            out.set(key, type);
        }
    };
    const addSignature = (base, node) => {
        const n = counters.get(base) || 0;
        counters.set(base, n + 1);
        const key = n === 0 ? base : `${base}#${n}`;
        if (!ts.isConstructorDeclaration(node) && !ts.isConstructSignatureDeclaration(node)) {
            put(`${key} return`, typeText(node.type));
        }
        node.parameters.forEach((p, i) => {
            const pname = ts.isIdentifier(p.name) ? p.name.text : `#${i}`;
            put(`${key} param ${pname}`, typeText(p.type));
        });
    };
    const visitMembers = (owner, members) => {
        for (const m of members) {
            if (isPrivate(m)) {
                continue;
            }
            const base = `${rel} ${owner}.${nameOf(m)}`;
            if (ts.isMethodDeclaration(m) || ts.isMethodSignature(m) || ts.isConstructorDeclaration(m)
                || ts.isCallSignatureDeclaration(m) || ts.isConstructSignatureDeclaration(m)) {
                addSignature(base, m);
            } else if (ts.isPropertyDeclaration(m) || ts.isPropertySignature(m)) {
                put(`${base} type`, typeText(m.type));
            } else if (ts.isGetAccessorDeclaration(m)) {
                put(`${base} get`, typeText(m.type));
            } else if (ts.isSetAccessorDeclaration(m)) {
                m.parameters.forEach((p) => put(`${base} set`, typeText(p.type)));
            }
        }
    };
    const visit = (node, prefix) => {
        if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
            visitMembers(`${prefix}${node.name ? node.name.text : 'default'}`, node.members);
        } else if (ts.isFunctionDeclaration(node) && node.name) {
            addSignature(`${rel} ${prefix || '<module>.'}${node.name.text}`, node);
        } else if (ts.isVariableStatement(node)) {
            for (const d of node.declarationList.declarations) {
                if (ts.isIdentifier(d.name)) {
                    put(`${rel} ${prefix || '<module>.'}${d.name.text} type`, typeText(d.type));
                }
            }
        } else if (ts.isTypeAliasDeclaration(node)) {
            put(`${rel} ${prefix || '<module>.'}${node.name.text} alias`, typeText(node.type));
        } else if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
            for (const s of node.body.statements) {
                visit(s, `${prefix}${node.name.getText(sf)}.`);
            }
        }
    };
    for (const s of sf.statements) {
        visit(s, '');
    }
    return out;
}

/**
 * Collect every public member type in a concatenated snapshot.
 * @param {string} snapshotText the snapshot
 * @return {Map<string,string>} key -> type text
 */
export function collectSnapshotTypes(snapshotText) {
    const all = new Map();
    for (const [rel, text] of Object.entries(splitSnapshot(snapshotText))) {
        if (rel === 'index.d.ts') {
            continue;
        }
        for (const [k, v] of collectMemberTypes(rel, text)) {
            all.set(k, v);
        }
    }
    return all;
}

const LOOSE = new Set(['any', 'unknown', 'never']);

/**
 * Read the allow-list: `key<TAB>v5 type<TAB>current type<TAB>BC ref<TAB>note`.
 * Each row must name a BC row (BC-nn).
 * @param {string} file the TSV
 * @return {{rows: Map<string,object>, errors: string[]}} the rows and any malformed lines
 */
export function readAllowList(file) {
    const rows = new Map();
    const errors = [];
    if (!fs.existsSync(file)) {
        return { rows, errors };
    }
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (!line.trim() || line.startsWith('#')) {
            return;
        }
        const [key, v5, cur, bc, note] = line.split('\t');
        if (!key || v5 === undefined || cur === undefined || !/^BC-\d+$/.test(bc || '')) {
            errors.push(`${path.basename(file)} line ${i + 1}: expected key, v5.0.0 type, current type and a BC-nn reference, tab-separated`);
            return;
        }
        rows.set(key, { v5, cur, bc, note });
    });
    return { rows, errors };
}

/**
 * Compare the current snapshot's member types with v5.0.0's.
 * @param {string} v5Text the v5.0.0 snapshot
 * @param {string} currentText the current snapshot
 * @param {Map<string,object>} allow the allow-list rows
 * @return {{violations: object[], allowed: object[], staleAllow: string[], compared: number}} the result
 */
export function compareTypes(v5Text, currentText, allow = new Map()) {
    const v5 = collectSnapshotTypes(v5Text);
    const cur = collectSnapshotTypes(currentText);
    const violations = [];
    const allowed = [];
    const used = new Set();
    let compared = 0;
    for (const [key, v5Type] of v5) {
        if (!cur.has(key)) {
            continue;
        }
        compared++;
        const curType = cur.get(key);
        const becameNever = curType === 'never' && v5Type !== 'never';
        const becameAny = curType === 'any' && !LOOSE.has(v5Type);
        if (!becameNever && !becameAny) {
            continue;
        }
        const finding = { key, v5: v5Type, current: curType, kind: becameNever ? 'never' : 'any' };
        const row = allow.get(key);
        if (row && row.v5 === v5Type && row.cur === curType) {
            used.add(key);
            allowed.push({ ...finding, bc: row.bc });
        } else {
            violations.push(finding);
        }
    }
    const staleAllow = [...allow.keys()].filter((k) => !used.has(k));
    return { violations, allowed, staleAllow, compared };
}

/**
 * Run the v5.0.0 type comparison against a current snapshot text.
 * @param {string} currentText the current full-api.d.ts text
 * @return {{failures: string[], info: string[]}} the outcome
 */
export function checkAgainstV5(currentText) {
    const failures = [];
    const info = [];
    if (!fs.existsSync(V5_BASELINE)) {
        failures.push(`${path.relative(REPO_ROOT, V5_BASELINE)} is missing. Regenerate it from the published package: npm --prefix migration/oracle/reference ci && node migration/api-snapshot/v5-types.mjs --write-v5-baseline`);
        return { failures, info };
    }
    const { rows, errors } = readAllowList(ALLOW_LIST);
    failures.push(...errors);
    const planPath = path.join(MIGRATION_ROOT, 'BREAKING-CHANGES-PLAN.md');
    const plan = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : '';
    for (const [key, row] of rows) {
        if (!plan.includes(`| **${row.bc}** |`)) {
            failures.push(`${path.basename(ALLOW_LIST)}: ${key} cites ${row.bc}, which is not a row of migration/BREAKING-CHANGES-PLAN.md`);
        }
    }
    const res = compareTypes(fs.readFileSync(V5_BASELINE, 'utf8'), currentText, rows);
    for (const v of res.violations) {
        failures.push(`Public type regressed against v5.0.0 (became ${v.kind}): ${v.key}: v5.0.0 \`${v.v5}\`, now \`${v.current}\`. Restore the v5.0.0 type, or list it in ${path.relative(REPO_ROOT, ALLOW_LIST)} with the BC row that makes it intended.`);
    }
    for (const k of res.staleAllow) {
        info.push(`(info) ${path.basename(ALLOW_LIST)} row has no matching regression: ${k}`);
    }
    info.push(`(info) v5.0.0 type check: ${res.compared} member types compared, ${res.allowed.length} allow-listed, ${res.violations.length} violation(s).`);
    return { failures, info };
}

/**
 * Compile the strict consumer against a directory of concerto-core .d.ts.
 * @param {string} dtsDir the directory holding index.d.ts
 * @return {{ok: boolean, output: string}} the tsc outcome
 */
export function compileConsumer(dtsDir) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-strict-consumer-'));
    try {
        const tsconfig = {
            compilerOptions: {
                strict: true,
                noEmit: true,
                target: 'es2020',
                module: 'commonjs',
                moduleResolution: 'node10',
                esModuleInterop: true,
                skipLibCheck: true,
                types: [],
                baseUrl: REPO_ROOT,
                paths: {
                    '@accordproject/concerto-core': [path.join(dtsDir, 'index.d.ts')],
                    '@accordproject/concerto-core/dist/*': [path.join(dtsDir, '*')],
                    '*': ['node_modules/*', 'node_modules/@types/*'],
                },
            },
            files: [CONSUMER],
        };
        const cfg = path.join(tmp, 'tsconfig.json');
        fs.writeFileSync(cfg, JSON.stringify(tsconfig, null, 2));
        const tsc = path.join(path.dirname(require.resolve('typescript/package.json', { paths: [REPO_ROOT] })), 'bin', 'tsc');
        try {
            const output = execFileSync(process.execPath, [tsc, '-p', cfg], { encoding: 'utf8', stdio: 'pipe' });
            return { ok: true, output };
        } catch (e) {
            return { ok: false, output: `${e.stdout || ''}${e.stderr || ''}` };
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function writeV5Baseline() {
    const pkg = JSON.parse(fs.readFileSync(path.join(REFERENCE_DIST, 'package.json'), 'utf8'));
    if (pkg.version !== '5.0.0') {
        throw new Error(`expected the published concerto-core 5.0.0 in ${REFERENCE_DIST}, found ${pkg.version}`);
    }
    const dist = path.join(REFERENCE_DIST, 'dist');
    const files = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const rel = path.relative(dist, full).split(path.sep).join('/');
            if (entry.isDirectory()) {
                if (!/^esm/.test(rel)) {
                    walk(full);
                }
            } else if (entry.name.endsWith('.d.ts')) {
                files.push(rel);
            }
        }
    })(dist);
    files.sort();
    const norm = (t) => t.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.length > 0).join('\n') + '\n';
    const text = files.map((rel) => `// ==== ${rel} ====\n${norm(fs.readFileSync(path.join(dist, rel), 'utf8'))}`).join('\n');
    fs.writeFileSync(V5_BASELINE, text);
    console.log(`Wrote ${path.relative(REPO_ROOT, V5_BASELINE)} (${files.length} .d.ts files from the published concerto-core 5.0.0).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const argv = process.argv.slice(2);
    if (argv.includes('--write-v5-baseline')) {
        writeV5Baseline();
    } else if (argv.includes('--consumer-against-v5')) {
        const res = compileConsumer(path.join(REFERENCE_DIST, 'dist'));
        console.log(res.ok ? 'strict consumer compiles against the published 5.0.0 .d.ts' : res.output);
        process.exit(res.ok ? 0 : 1);
    } else {
        const i = argv.indexOf('--snapshot');
        const snap = i >= 0 ? argv[i + 1] : path.join(__dirname, 'full-api.d.ts');
        const { failures, info } = checkAgainstV5(fs.readFileSync(snap, 'utf8'));
        info.forEach((l) => console.log(l));
        failures.forEach((f) => console.error(`- ${f}`));
        process.exit(failures.length ? 1 : 0);
    }
}
