#!/usr/bin/env node
/*
 * Extract every method / static method / getter / setter / constructor /
 * top-level function from packages/concerto-core/src/**\/*.ts using the
 * TypeScript compiler AST. Prints TSV: file, class, member, kind, loc, line.
 *
 * Usage: node extract-members.js [--check SEAM_LEDGER.tsv]
 *   --check diffs the extracted member keys (file|class|member|kind)
 *   against the ledger and exits non-zero on any difference or duplicate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const ts = require(path.join(repo, 'node_modules', 'typescript'));
const srcRoot = path.join(repo, 'packages', 'concerto-core', 'src');

function walk(dir) {
    let out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { out = out.concat(walk(p)); }
        else if (e.name.endsWith('.ts')) { out.push(p); }
    }
    return out.sort();
}

function nameOf(n, sf) {
    if (!n.name) { return '(anonymous)'; }
    return n.name.getText(sf);
}

function extract() {
    const rows = [];
    for (const file of walk(srcRoot)) {
        const rel = path.relative(path.join(repo, 'packages', 'concerto-core'), file);
        const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const loc = (n) => {
            const a = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
            const b = sf.getLineAndCharacterOfPosition(n.getEnd()).line;
            return [b - a + 1, a + 1];
        };
        const push = (cls, member, kind, n) => {
            const [l, line] = loc(n);
            rows.push({ file: rel, cls, member, kind, loc: l, line, text: n.getText(sf) });
        };
        const visitClass = (c) => {
            const cname = c.name ? c.name.getText(sf) : '(anonymous)';
            for (const m of c.members) {
                const isStatic = (ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static) !== 0;
                if (ts.isConstructorDeclaration(m) && m.body) { push(cname, 'constructor', 'ctor', m); }
                else if (ts.isMethodDeclaration(m) && m.body) { push(cname, nameOf(m, sf), isStatic ? 'static' : 'method', m); }
                else if (ts.isGetAccessor(m) && m.body) { push(cname, 'get ' + nameOf(m, sf), 'getter', m); }
                else if (ts.isSetAccessor(m) && m.body) { push(cname, 'set ' + nameOf(m, sf), 'getter', m); }
                else if (ts.isPropertyDeclaration(m) && m.initializer &&
                    (ts.isArrowFunction(m.initializer) || ts.isFunctionExpression(m.initializer))) {
                    push(cname, nameOf(m, sf), isStatic ? 'static' : 'method', m);
                }
            }
        };
        const visitTop = (n) => {
            if (ts.isClassDeclaration(n)) { visitClass(n); }
            else if (ts.isFunctionDeclaration(n) && n.body) { push('', nameOf(n, sf), 'function', n); }
            else if (ts.isVariableStatement(n)) {
                for (const d of n.declarationList.declarations) {
                    if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
                        push('', d.name.getText(sf), 'function', n.declarationList.declarations.length === 1 ? n : d);
                    }
                }
            } else if (ts.isModuleDeclaration(n) && n.body && ts.isModuleBlock(n.body)) {
                n.body.statements.forEach(visitTop);
            }
        };
        sf.statements.forEach(visitTop);
    }
    return rows;
}

if (require.main !== module) {
    module.exports = { extract, srcRoot, repo };
    return;
}
const rows = extract();
const key = (r) => [r.file, r.cls, r.member, r.kind].join('|');
const ci = process.argv.indexOf('--check');
if (ci < 0) {
    process.stdout.write('file\tclass\tmember\tkind\tloc\tline\n');
    for (const r of rows) { process.stdout.write([r.file, r.cls, r.member, r.kind, r.loc, r.line].join('\t') + '\n'); }
    process.exit(0);
}
const ledgerPath = process.argv[ci + 1];
const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
const hdr = lines.shift().split('\t');
const idx = (h) => hdr.indexOf(h);
const seen = new Map();
let bad = 0;
for (const l of lines) {
    const c = l.split('\t');
    const k = [c[idx('file')], c[idx('class')], c[idx('member')], c[idx('kind')]].join('|');
    seen.set(k, (seen.get(k) || 0) + 1);
    const cls = c[idx('classification')];
    if (!['RUST', 'HYBRID', 'TS'].includes(cls)) { console.log('BAD classification: ' + k); bad++; }
    if (cls !== 'RUST' && !(c[idx('reason')] || '').trim()) { console.log('MISSING reason: ' + k); bad++; }
    if (c.length !== hdr.length) { console.log('BAD column count: ' + k); bad++; }
}
const want = new Map();
for (const r of rows) { want.set(key(r), (want.get(key(r)) || 0) + 1); }
for (const [k, n] of want) {
    if (n > 1) { console.log('NOTE duplicate AST key (overloads?) ' + k + ' x' + n); }
    if (!seen.has(k)) { console.log('MISSING from ledger: ' + k); bad++; }
    else if (seen.get(k) !== n) { console.log('COUNT mismatch: ' + k + ' ledger=' + seen.get(k) + ' ast=' + n); bad++; }
}
for (const k of seen.keys()) { if (!want.has(k)) { console.log('EXTRA in ledger: ' + k); bad++; } }
console.log(`AST members: ${rows.length}; ledger rows: ${lines.length}; problems: ${bad}`);
process.exit(bad ? 1 : 0);
