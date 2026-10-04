// The source comment policy: comments describe the code as it is, not the
// history of the migration. A comment in packages/concerto-core/src (and,
// with a concerto-rust checkout, in its concerto-*/src crates) may not name
// a migration task id (`P5-105`), a concerto-rust issue or PR
// (`concerto-rust#459`, `concerto-rust/pull/481`, `concerto-rust/issues/32`),
// a short cross-repository issue number (`concerto#1514`) or a bare issue
// number (`#459`, `#32`). BC-nn and DV-nn rows, which document current
// differences from TS 5.0.0, and full-form upstream links
// (`accordproject/concerto#1273`) are allowed.
//
// Only comment text is checked: string literals, template literals and
// regular expressions are skipped, so a test title or an error message
// keeps whatever text it needs. The one exception is the value of a Rust
// `#[doc = "..."]` attribute, which is a doc comment and is checked.
//
// Run on its own:
//   node migration/guardrails/comment-policy.mjs [--rust-root <dir>] [--rust-only]
// --rust-only checks only the concerto-rust checkout, not concerto-core's
// src/ (concerto-rust's CI uses it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The forbidden references, each with the name a violation reports. */
export const RULES = [
    { name: 'task id', re: /\bP\d+-\d+[a-z]?\b/g },
    { name: 'concerto-rust issue or PR', re: /concerto-rust(?:#|\/(?:pull|issues)\/)\d+/g },
    // A short cross-repository form such as `concerto#1514`: only the full
    // `accordproject/concerto#1514` names an upstream issue.
    { name: 'short cross-repo issue number', re: /(?<![\w/-])concerto#\d+/g },
    // `#123` not preceded by a word character, `/`, `#` or `-`, so
    // `accordproject/concerto#1273` and `concerto-rust#459` (reported by the
    // rule above) are not bare.
    { name: 'bare issue number', re: /(?<![\w/#-])#\d+\b/g },
];

/**
 * Whether the Rust string literal starting at `at` is the value of a doc
 * attribute (`#[doc = "..."]` or `#![doc = "..."]`), which is a doc comment
 * written another way.
 * @param {string} text the source text
 * @param {number} at the index of the literal (its `"` or its `b`/`c`/`r` prefix)
 * @return {boolean} true for a doc attribute's value
 */
function isDocAttr(text, at) {
    return /#!?\[\s*doc\s*=\s*b?$/.test(text.slice(Math.max(0, at - 40), at));
}

/**
 * The comments of `text`, as `{ line, text }` per comment line.
 * @param {string} text the source text
 * @param {'ts'|'rs'} lang the language: TypeScript/JavaScript or Rust
 * @return {{line: number, text: string}[]} each comment line, 1-based
 */
export function commentLines(text, lang) {
    const out = [];
    let i = 0;
    let line = 1;
    const n = text.length;
    // The last significant character, to tell a regex literal from a division.
    let prev = '';
    const push = (start, end, startLine) => {
        text.slice(start, end).split('\n').forEach((t, k) => out.push({ line: startLine + k, text: t }));
    };
    const advance = (to) => {
        for (let k = i; k < to; k++) {
            if (text[k] === '\n') {
                line++;
            }
        }
        i = to;
    };
    while (i < n) {
        const c = text[i];
        const d = text[i + 1];
        if (c === '/' && d === '/') {
            let e = text.indexOf('\n', i);
            if (e === -1) {
                e = n;
            }
            push(i, e, line);
            advance(e);
            continue;
        }
        if (c === '/' && d === '*') {
            // Rust block comments nest; TypeScript's do not.
            let depth = 1;
            let k = i + 2;
            while (k < n && depth > 0) {
                if (lang === 'rs' && text[k] === '/' && text[k + 1] === '*') {
                    depth++;
                    k += 2;
                } else if (text[k] === '*' && text[k + 1] === '/') {
                    depth--;
                    k += 2;
                } else {
                    k++;
                }
            }
            push(i, k, line);
            advance(k);
            continue;
        }
        if (lang === 'rs' && (c === 'r' || ((c === 'b' || c === 'c') && d === 'r')) && !/[\w]/.test(text[i - 1] ?? '')) {
            // A raw string: r"...", r#"..."#, and the raw byte and C string
            // forms br"..." and cr"...", which have no escapes either.
            const m = /^[bc]?r(#*)"/.exec(text.slice(i, i + 260));
            if (m) {
                const close = '"' + m[1];
                const e = text.indexOf(close, i + m[0].length);
                const end = e === -1 ? n : e + close.length;
                if (isDocAttr(text, i)) {
                    push(i, end, line);
                }
                advance(end);
                prev = '"';
                continue;
            }
        }
        if (c === '"' || (lang === 'ts' && (c === '\'' || c === '`'))) {
            let k = i + 1;
            while (k < n && text[k] !== c) {
                if (text[k] === '\\') {
                    k++;
                } else if (c === '`' && text[k] === '$' && text[k + 1] === '{') {
                    // Skip a substitution, braces balanced.
                    let depth = 1;
                    k += 2;
                    while (k < n && depth > 0) {
                        if (text[k] === '{') {
                            depth++;
                        } else if (text[k] === '}') {
                            depth--;
                        }
                        k++;
                    }
                    continue;
                }
                k++;
            }
            const end = Math.min(k + 1, n);
            if (lang === 'rs' && isDocAttr(text, i)) {
                push(i, end, line);
            }
            advance(end);
            prev = '"';
            continue;
        }
        if (lang === 'rs' && c === '\'') {
            // A char literal ('x', '\n', '\u{1F600}'), not a lifetime ('a).
            const m = /^'(\\.[^']*|[^\\'])'/u.exec(text.slice(i, i + 12));
            if (m) {
                advance(i + m[0].length);
                prev = '"';
                continue;
            }
        }
        if (lang === 'ts' && c === '/' && (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|in|of)$/.test(text.slice(Math.max(0, i - 7), i).trimEnd()))) {
            // A regex literal: to the closing unescaped `/` outside a class.
            let k = i + 1;
            let inClass = false;
            while (k < n && text[k] !== '\n') {
                if (text[k] === '\\') {
                    k += 2;
                    continue;
                }
                if (text[k] === '[') {
                    inClass = true;
                } else if (text[k] === ']') {
                    inClass = false;
                } else if (text[k] === '/' && !inClass) {
                    break;
                }
                k++;
            }
            if (k < n && text[k] === '/') {
                advance(k + 1);
                prev = '"';
                continue;
            }
        }
        if (!/\s/.test(c)) {
            prev = c;
        }
        advance(i + 1);
    }
    return out;
}

/**
 * The policy violations in `text`.
 * @param {string} text the source text
 * @param {'ts'|'rs'} lang the language
 * @return {{line: number, rule: string, match: string, text: string}[]} the violations
 */
export function scanText(text, lang) {
    const found = [];
    for (const { line, text: t } of commentLines(text, lang)) {
        for (const rule of RULES) {
            rule.re.lastIndex = 0;
            let m;
            while ((m = rule.re.exec(t)) !== null) {
                found.push({ line, rule: rule.name, match: m[0], text: t.trim() });
            }
        }
    }
    return found;
}

/**
 * Every source file under `dir` with one of `exts`, skipping `node_modules`
 * and `target`.
 * @param {string} dir the directory
 * @param {string[]} exts the file extensions
 * @return {string[]} the files, sorted
 */
function walk(dir, exts) {
    const files = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== 'target') {
                files.push(...walk(p, exts));
            }
        } else if (exts.some((e) => ent.name.endsWith(e))) {
            files.push(p);
        }
    }
    return files.sort();
}

/**
 * The violations under concerto-core's src/ (unless `rustOnly`) and, when
 * `rustRoot` is given, under each concerto-* crate's src/ there.
 * @param {string} repoRoot the concerto checkout
 * @param {string} [rustRoot] a concerto-rust checkout
 * @param {{rustOnly?: boolean}} [options] rustOnly: check only `rustRoot`
 * @return {string[]} one `file:line: rule 'match': text` line per violation
 */
export function checkCommentPolicy(repoRoot, rustRoot, { rustOnly = false } = {}) {
    if (rustOnly && !rustRoot) {
        throw new Error('--rust-only needs --rust-root');
    }
    const roots = rustOnly ? [] : [{ dir: path.join(repoRoot, 'packages/concerto-core/src'), base: repoRoot, lang: 'ts', exts: ['.ts', '.js'] }];
    if (rustRoot) {
        for (const ent of fs.readdirSync(rustRoot, { withFileTypes: true })) {
            const src = path.join(rustRoot, ent.name, 'src');
            if (ent.isDirectory() && ent.name.startsWith('concerto-') && fs.existsSync(src)) {
                roots.push({ dir: src, base: rustRoot, lang: 'rs', exts: ['.rs'] });
            }
        }
    }
    const violations = [];
    for (const { dir, base, lang, exts } of roots) {
        for (const file of walk(dir, exts)) {
            for (const v of scanText(fs.readFileSync(file, 'utf8'), lang)) {
                violations.push(`${path.relative(base, file)}:${v.line}: ${v.rule} '${v.match}': ${v.text}`);
            }
        }
    }
    return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const i = process.argv.indexOf('--rust-root');
    const rustRoot = i !== -1 ? path.resolve(process.argv[i + 1]) : undefined;
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const violations = checkCommentPolicy(repoRoot, rustRoot, { rustOnly: process.argv.includes('--rust-only') });
    if (violations.length > 0) {
        console.error(`${violations.length} comment(s) break the comment policy (migration/guardrails/comment-policy.mjs):`);
        violations.forEach((v) => console.error(`    ${v}`));
        process.exit(1);
    }
    console.log('Comment policy OK.');
}
