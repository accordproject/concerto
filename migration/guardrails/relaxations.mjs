/**
 * P5-09: the narrow exception to guardrail rule 1 (no edits under
 * packages/concerto-core/test/**).
 *
 * Maintainer decision 2026-09-27 (accordproject/concerto-rust#253): Rust and
 * TS must throw in the same scenarios with the same exception class, but the
 * message text may differ. The only test edits allowed are ones that relax an
 * exact-message assertion to a class (or "it throws") check. Every such edit
 * must be listed in test-message-relaxations.tsv (file, test, old assertion,
 * new assertion, reason) and signed off in review.
 *
 * This module is deliberately strict and syntactic. A changed hunk is allowed
 * only when it is a one-for-one replacement of assertion lines, and each
 * replacement has one of these shapes (whitespace is collapsed before
 * matching; prefix and suffix around the call must be byte-identical):
 *
 *   A. X.should.throw(C, <msg>)          -> X.should.throw(C)
 *      X.should.throw(<msg>)             -> X.should.throw()  or  X.should.throw(C)
 *      (also .to.throw, .throw, .should.be.rejectedWith, .to.be.rejectedWith)
 *      <msg> is a string, template or regex literal. A class already named in
 *      the old assertion must be kept unchanged.
 *   B. e.message.should.<match|equal|eql|deep.equal|include|contain>(<msg>)
 *                                        -> e.should.be.(an.)instanceOf(C)
 *   C. expect(e.message).to.<...>(<msg>) -> expect(e).to.be.(an.)instanceOf(C)
 *
 * Anything else (a new, deleted or renamed test file; an added or deleted
 * line without a partner; .skip/.only; a changed class; any non-assertion
 * change) is a violation. So is a valid relaxation that is not listed in the
 * allow-list for that file and test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MSG_LITERAL_RE = /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\/(?:[^/\\\n]|\\.)+\/[a-z]*)$/;
const CLASS_RE = /^[A-Z][A-Za-z0-9_]*$/;
const THROW_CALL_RE = /^(.*?)\.(should\.throw|to\.throw|throw|should\.be\.rejectedWith|to\.be\.rejectedWith)\((.*)\)(\s*[;,]?)$/;
const MESSAGE_ASSERT_RE = /^(.*?)\b([A-Za-z_$][\w$]*)\.message\.should\.(?:match|equal|eql|deep\.equal|include|contain)\((.*)\)(\s*;?)$/;
const EXPECT_MESSAGE_RE = /^(.*?)\bexpect\(([A-Za-z_$][\w$]*)\.message\)\.to\.(?:match|equal|eql|deep\.equal|include|contain|have\.string)\((.*)\)(\s*;?)$/;
const SHOULD_INSTANCE_RE = /^(.*?)\b([A-Za-z_$][\w$]*)\.should\.be\.(?:an?\.)?instanceOf\(([A-Z][A-Za-z0-9_]*)\)(\s*;?)$/;
const EXPECT_INSTANCE_RE = /^(.*?)\bexpect\(([A-Za-z_$][\w$]*)\)\.to\.be\.(?:an?\.)?instanceOf\(([A-Z][A-Za-z0-9_]*)\)(\s*;?)$/;

export function collapse(s) {
    return s.replace(/\s+/g, ' ').trim();
}

/** Split a call's argument text at top-level commas. */
export function splitArgs(text) {
    const args = [];
    let depth = 0;
    let cur = '';
    let quote = null;
    let inRegex = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quote) {
            cur += c;
            if (c === '\\') { cur += text[++i] ?? ''; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (inRegex) {
            cur += c;
            if (c === '\\') { cur += text[++i] ?? ''; continue; }
            if (c === '/') inRegex = false;
            continue;
        }
        if (c === '\'' || c === '"' || c === '`') { quote = c; cur += c; continue; }
        if (c === '/' && cur.trim() === '') { inRegex = true; cur += c; continue; }
        if (c === '(' || c === '[' || c === '{') depth++;
        if (c === ')' || c === ']' || c === '}') depth--;
        if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    if (quote || inRegex || depth !== 0) return null;
    if (cur.trim() !== '' || args.length > 0) args.push(cur.trim());
    return args;
}

/**
 * Is `oldText` -> `newText` (each one or more source lines) a message-to-class
 * relaxation? Returns null when it is, or a reason string when it is not.
 */
export function relaxationViolation(oldText, newText) {
    const o = collapse(oldText);
    const n = collapse(newText);
    if (/\.(skip|only)\(/.test(n) || /\bx(it|describe)\(/.test(n)) {
        return 'the new text skips or focuses a test';
    }
    // Shape A: throw / rejectedWith argument relaxation.
    const ot = o.match(THROW_CALL_RE);
    if (ot) {
        const nt = n.match(THROW_CALL_RE);
        if (!nt) return 'old text is a throw assertion but new text is not';
        if (ot[1] !== nt[1] || ot[2] !== nt[2] || ot[4] !== nt[4]) {
            return 'text around the throw assertion changed';
        }
        const oa = splitArgs(ot[3]);
        const na = splitArgs(nt[3]);
        if (!oa || !na) return 'could not parse the assertion arguments';
        const oldMsgs = oa.filter((a) => MSG_LITERAL_RE.test(a));
        const oldClasses = oa.filter((a) => CLASS_RE.test(a));
        if (oldMsgs.length === 0) return 'old assertion does not check a message';
        if (oldMsgs.length + oldClasses.length !== oa.length || oldClasses.length > 1) {
            return 'old assertion has arguments other than one class and a message';
        }
        if (na.length > 1 || (na.length === 1 && !CLASS_RE.test(na[0]))) {
            return 'new assertion must name at most one exception class and no message';
        }
        if (oldClasses.length === 1 && (na.length !== 1 || na[0] !== oldClasses[0])) {
            return `new assertion must keep the class ${oldClasses[0]}`;
        }
        return null;
    }
    // Shapes B and C: message property assertion -> instanceOf.
    const om = o.match(MESSAGE_ASSERT_RE) || o.match(EXPECT_MESSAGE_RE);
    if (om) {
        const oa = splitArgs(om[3]);
        if (!oa || oa.length !== 1 || !MSG_LITERAL_RE.test(oa[0]) && !/^[A-Za-z_$][\w$.]*$/.test(oa[0])) {
            return 'old message assertion has an unexpected argument';
        }
        const isExpect = EXPECT_MESSAGE_RE.test(o);
        const ni = (isExpect ? n.match(EXPECT_INSTANCE_RE) : n.match(SHOULD_INSTANCE_RE));
        if (!ni) return 'a message assertion must become an instanceOf(Class) assertion';
        if (ni[1] !== om[1] || ni[2] !== om[2] || ni[4] !== om[4]) {
            return 'text around the message assertion changed';
        }
        return null;
    }
    return 'old text is not a message assertion';
}

/** Parse `git diff -U0` output for one file into hunks. */
export function parseHunks(diffText) {
    const hunks = [];
    let h = null;
    for (const line of diffText.split('\n')) {
        const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (m) {
            h = { oldStart: +m[1], newStart: +m[3], removed: [], added: [] };
            hunks.push(h);
            continue;
        }
        if (!h) continue;
        if (line.startsWith('-')) h.removed.push(line.slice(1));
        else if (line.startsWith('+')) h.added.push(line.slice(1));
        else if (line.startsWith('\\')) h.noNewline = true;
    }
    return hunks;
}

/** Title of the nearest enclosing it('...') above 1-based line `lineNo`. */
export function enclosingTest(fileLines, lineNo) {
    for (let i = Math.min(lineNo, fileLines.length) - 1; i >= 0; i--) {
        const m = fileLines[i].match(/^\s*it\(\s*(['"`])((?:\\.|(?!\1).)*)\1/);
        if (m) return m[2];
    }
    return null;
}

/**
 * Split a hunk into (old, new) assertion pairs: one-for-one when the line
 * counts match, otherwise the whole hunk as one multi-line statement.
 */
export function hunkPairs(h) {
    if (h.removed.length === 0 || h.added.length === 0) return null;
    if (h.removed.length === h.added.length) {
        const pairs = h.removed.map((r, i) => ({ old: r, new: h.added[i], line: h.newStart + i }));
        if (pairs.every((p) => relaxationViolation(p.old, p.new) === null)) return pairs;
    }
    return [{ old: h.removed.join('\n'), new: h.added.join('\n'), line: h.newStart }];
}

export function readAllowList(tsvPath) {
    if (!fs.existsSync(tsvPath)) return [];
    const rows = [];
    const lines = fs.readFileSync(tsvPath, 'utf8').split('\n');
    for (const [i, raw] of lines.entries()) {
        if (raw.trim() === '' || raw.startsWith('#')) continue;
        const cols = raw.split('\t');
        if (cols[0] === 'file' && cols[1] === 'test') continue; // header
        if (cols.length !== 5 || cols.some((c) => c.trim() === '')) {
            throw new Error(`${tsvPath}:${i + 1}: expected 5 non-empty tab-separated columns (file, test, old_assertion, new_assertion, reason)`);
        }
        rows.push({ file: cols[0], test: cols[1], old: collapse(cols[2]), new: collapse(cols[3]), reason: cols[4], used: false });
    }
    return rows;
}

/**
 * Check one modified test file's hunks against the allow-list. Returns a list
 * of violation strings (empty when every hunk is a listed relaxation).
 */
export function checkFileHunks(file, hunks, fileLines, allow) {
    const out = [];
    for (const h of hunks) {
        const where = `${file}:${h.newStart}`;
        const pairs = hunkPairs(h);
        if (!pairs) {
            out.push(`${where}: lines only ${h.removed.length ? 'deleted' : 'added'}; only message-to-class assertion replacements are allowed`);
            continue;
        }
        for (const p of pairs) {
            const why = relaxationViolation(p.old, p.new);
            if (why) {
                out.push(`${where}: not a message-assertion relaxation (${why}):\n      - ${collapse(p.old)}\n      + ${collapse(p.new)}`);
                continue;
            }
            const test = enclosingTest(fileLines, p.line);
            const row = allow.find((r) => r.file === file && r.test === test && r.old === collapse(p.old) && r.new === collapse(p.new));
            if (!row) {
                out.push(`${where}: relaxation in test ${JSON.stringify(test)} is not listed in the allow-list:\n      - ${collapse(p.old)}\n      + ${collapse(p.new)}`);
                continue;
            }
            row.used = true;
        }
    }
    return out;
}

/**
 * Rule 1 of check-guardrails.mjs: every change under `testPrefix` in
 * `repoRoot`, relative to the merge base with `baseRef` (committed, staged
 * and unstaged, plus untracked files), must be an allow-listed relaxation.
 * Returns a list of violation strings.
 */
export function checkTestTree({ repoRoot, baseRef, testPrefix, allowListPath, log = console.log }) {
    const git = (args) => {
        try {
            return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        } catch (e) {
            return null;
        }
    };
    const out = [];
    let allow;
    try {
        allow = readAllowList(allowListPath);
    } catch (e) {
        return [e.message];
    }
    const mergeBase = (git(['merge-base', baseRef, 'HEAD']) || '').trim() || baseRef;
    // merge-base vs working tree covers committed, staged and unstaged edits.
    const status = git(['diff', '--name-status', '-M', mergeBase, '--', testPrefix]);
    if (status === null) return [`git diff against ${mergeBase} failed`];
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', testPrefix]) || '';
    const modified = [];
    for (const line of status.split('\n').filter(Boolean)) {
        const [st, ...files] = line.split('\t');
        if (st === 'M') {
            modified.push(files[0]);
            continue;
        }
        const what = st.startsWith('R') ? 'renamed' : st === 'D' ? 'deleted' : st === 'A' ? 'added' : `changed (${st})`;
        out.push(`${files.join(' -> ')}: test file ${what}; only in-place assertion relaxations are allowed`);
    }
    for (const f of untracked.split('\n').filter(Boolean)) {
        out.push(`${f}: new (untracked) test file; only in-place assertion relaxations are allowed`);
    }
    for (const file of modified) {
        const diff = git(['diff', '-U0', '--no-color', '--no-ext-diff', mergeBase, '--', file]) || '';
        const lines = fs.readFileSync(path.join(repoRoot, file), 'utf8').split('\n');
        out.push(...checkFileHunks(file, parseHunks(diff), lines, allow));
    }
    const used = allow.filter((r) => r.used).length;
    const unused = allow.length - used;
    if (used > 0) log(`(info) ${used} allow-listed message-assertion relaxation(s) under ${testPrefix}.`);
    if (unused > 0) {
        // Rows already merged into the base ref no longer show in the diff.
        log(`(info) ${unused} allow-list row(s) have no matching change relative to ${baseRef}.`);
    }
    return out;
}
