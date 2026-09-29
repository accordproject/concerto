/**
 * P5-33 (accordproject/concerto-rust#343): approved black-box rewrites of
 * whole test cases, a second, separately listed exception to guardrail rule 1
 * (no edits under packages/concerto-core/test/**).
 *
 * Maintainer decision 2026-09-29 (P5-26 D1, accordproject/concerto-rust#330):
 * the stub-based cases in test/modelmanager.js and
 * test/introspect/assetdeclaration.js may be rewritten to run against real
 * ModelFile/ModelManager objects, keeping each case's intent. Only the scopes
 * listed in test-case-rewrites.tsv may change:
 *
 *   <describe> > ... > <it title>   the body of that one it() case
 *   <describe> > ... > (setup)      lines directly inside that describe()
 *                                   (hooks, helpers, shared variables), but
 *                                   not inside a nested describe() or it()
 *   (top level)                     lines outside every describe() (e.g. the
 *                                   require() header)
 *
 * A changed line (removed, in the base version; added, in the new version) is
 * covered when its innermost scope is listed for that file. On top of that,
 * for every file with a listed scope:
 *   - the file must keep exactly the same it() cases (same describe path and
 *     title), so no case is added, deleted or renamed;
 *   - no .skip/.only/xit/xdescribe may appear on an added line.
 * Hunks that are not fully covered fall back to the P5-09 message-relaxation
 * check (relaxations.mjs).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const TOP_LEVEL = '(top level)';
export const SETUP = '(setup)';

export function readRewriteList(tsvPath) {
    if (!tsvPath || !fs.existsSync(tsvPath)) return [];
    const rows = [];
    const lines = fs.readFileSync(tsvPath, 'utf8').split('\n');
    for (const [i, raw] of lines.entries()) {
        if (raw.trim() === '' || raw.startsWith('#')) continue;
        const cols = raw.split('\t');
        if (cols[0] === 'file' && cols[1] === 'scope') continue; // header
        if (cols.length !== 4 || cols.some((c) => c.trim() === '')) {
            throw new Error(`${tsvPath}:${i + 1}: expected 4 non-empty tab-separated columns (file, scope, approval, reason)`);
        }
        rows.push({ file: cols[0], scope: cols[1], approval: cols[2], reason: cols[3], used: false });
    }
    return rows;
}

function literalTitle(node) {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    return null;
}

/**
 * The mocha block structure of a test file: every describe()/it() call with a
 * literal title, as { kind, path, start, end } (1-based, inclusive lines).
 * `path` is the list of enclosing describe titles plus the block's own title.
 */
export function mochaBlocks(source) {
    const acorn = require('acorn');
    const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
    const blocks = [];
    const walk = (node, stack) => {
        if (!node || typeof node.type !== 'string') return;
        let next = stack;
        if (node.type === 'CallExpression') {
            const callee = node.callee;
            const name = callee.type === 'Identifier' ? callee.name
                : callee.type === 'MemberExpression' && callee.object.type === 'Identifier' ? callee.object.name : null;
            const title = literalTitle(node.arguments[0]);
            if ((name === 'describe' || name === 'it' || name === 'context' || name === 'specify') && title !== null) {
                const kind = name === 'describe' || name === 'context' ? 'describe' : 'it';
                const block = { kind, path: [...stack, title], start: node.loc.start.line, end: node.loc.end.line };
                blocks.push(block);
                if (kind === 'describe') next = block.path;
            }
        }
        for (const key of Object.keys(node)) {
            if (key === 'loc') continue;
            const v = node[key];
            if (Array.isArray(v)) v.forEach((c) => walk(c, next));
            else if (v && typeof v.type === 'string') walk(v, next);
        }
    };
    walk(ast, []);
    return blocks;
}

/** The scope name that owns 1-based line `line`, given mochaBlocks(). */
export function scopeOfLine(blocks, line) {
    let best = null;
    for (const b of blocks) {
        if (line < b.start || line > b.end) continue;
        if (!best || (b.end - b.start) < (best.end - best.start)) best = b;
    }
    if (!best) return TOP_LEVEL;
    return best.kind === 'it' ? best.path.join(' > ') : [...best.path, SETUP].join(' > ');
}

const caseKeys = (blocks) => blocks.filter((b) => b.kind === 'it').map((b) => b.path.join(' > ')).sort();

/**
 * Check one modified file against the rewrite list. Returns
 * { violations, uncovered } where `uncovered` are the hunks that still need
 * the P5-09 relaxation check.
 */
export function checkRewriteHunks(file, hunks, oldSource, newSource, rows) {
    const listed = rows.filter((r) => r.file === file);
    if (listed.length === 0) return { violations: [], uncovered: hunks };
    const violations = [];
    let oldBlocks;
    let newBlocks;
    try {
        oldBlocks = mochaBlocks(oldSource);
        newBlocks = mochaBlocks(newSource);
    } catch (e) {
        return { violations: [`${file}: could not parse the test file to check approved rewrites (${e.message})`], uncovered: [] };
    }
    const oldCases = caseKeys(oldBlocks);
    const newCases = caseKeys(newBlocks);
    const removedCases = oldCases.filter((k) => !newCases.includes(k));
    const addedCases = newCases.filter((k) => !oldCases.includes(k));
    for (const k of removedCases) violations.push(`${file}: test case ${JSON.stringify(k)} was deleted or renamed; an approved rewrite must keep every case`);
    for (const k of addedCases) violations.push(`${file}: test case ${JSON.stringify(k)} was added; an approved rewrite must keep the same cases`);
    if (oldCases.length !== newCases.length && removedCases.length === 0 && addedCases.length === 0) {
        violations.push(`${file}: the number of test cases changed (${oldCases.length} -> ${newCases.length})`);
    }
    const uncovered = [];
    for (const h of hunks) {
        if (h.added.some((l) => /\.(skip|only)\(/.test(l) || /\bx(it|describe)\(/.test(l))) {
            violations.push(`${file}:${h.newStart}: an added line skips or focuses a test`);
            continue;
        }
        const scopes = [
            ...h.removed.map((_, i) => scopeOfLine(oldBlocks, h.oldStart + i)),
            ...h.added.map((_, i) => scopeOfLine(newBlocks, h.newStart + i)),
        ];
        const rowsFor = scopes.map((s) => listed.find((r) => r.scope === s));
        if (rowsFor.every(Boolean)) {
            rowsFor.forEach((r) => { r.used = true; });
        } else {
            uncovered.push(h);
        }
    }
    return { violations, uncovered };
}
