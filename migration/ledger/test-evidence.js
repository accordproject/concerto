/*
 * Real per-test evidence for the seam ledger's test-coupling columns
 * (task: re-derive `coupled_tests` from migration/tags/test-tags.tsv,
 * follow-up to P0-02/P0-03; accordproject/concerto-rust#32).
 *
 * Replaces (for w_tests/direct_tests/needs_fallback) the old whole-file grep
 * in build-ledger.js's coupling() (kept as coupled_tests_grep for
 * comparison) with per-it() evidence:
 *
 *   (a) stub/spy/createStubInstance evidence, read directly off the
 *       `reasons` column that migration/bin/tag-tests.mjs already wrote to
 *       migration/tags/test-tags.tsv (static acorn pass + the sinon runtime
 *       trace, already reconciled there — see reasons like
 *       "runtime-stub: stub(ModelFile.getName)" or
 *       "stubs internal class Factory (createStubInstance)"), plus a source
 *       scan for the generic "reads/calls an internal-only member" reason
 *       (visitX / _resolveSuperType / .getAst() / modelFiles[ / .ast) so
 *       those tests resolve to concrete members too;
 *   (b) internal-field reads, folded into the same source scan (.ast,
 *       modelFiles[, superType-ish access patterns);
 *   (c) direct call-site analysis: for every test's own body plus the
 *       beforeEach/before hooks in scope (the same combinedText
 *       tag-tests.mjs builds), does it call `.member(` / `Class.member(` /
 *       `new Class(`.
 *
 * Both (a)'s generic reason and (c) are resolved by re-parsing the test
 * files with acorn (mirroring migration/bin/tag-tests.mjs's describe/it
 * walk) rather than by trusting file-wide grep, so a test only counts
 * against a member if the member's own it()/beforeEach/before text
 * mentions it — not merely because some other test in the same file does.
 *
 * Caveats (documented, not hidden):
 *   - `visitX` names are shared across ResourceValidator / JSONGenerator /
 *     JSONPopulator / InstanceGenerator; the receiver is not resolved, so a
 *     visitX hit attributes to every ledger member of that name, across
 *     classes. Real evidence, imprecise attribution — flagged in SUMMARY.
 *   - Bare internal-field reads (`.ast`, `modelFiles[`) have no owning
 *     *member* in this ledger (methods/functions only, no fields), so they
 *     cannot be routed to a member; such tests are reported as unmapped
 *     with a reason rather than silently dropped (verification step 4).
 *   - Call-site matching is still name-based (no type inference across
 *     `require`), same limitation as the old grep, just scoped to the
 *     individual test's own text instead of the whole file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

// ---------------------------------------------------------------- test-tags.tsv
function loadTestTags(tagsPath) {
    const lines = fs.readFileSync(tagsPath, 'utf8').split('\n').filter(Boolean);
    lines.shift(); // header
    return lines.map((l) => {
        const c = l.split('\t');
        return { file: c[0], describePath: c[1], title: c[2], tag: c[3], reasons: c[4] || '' };
    });
}

// Evidence explicit in the reasons column: [{cls, member|null}]
function stubEvidenceFromReasons(reasons) {
    const out = [];
    let m;
    const reRuntime = /runtime-stub:\s*(?:stub|spy|createStubInstance)\((\w+)(?:\.(\w+))?\)/g;
    while ((m = reRuntime.exec(reasons))) { out.push({ cls: m[1], member: m[2] || null }); }
    const reCreateStub = /stubs internal class (\w+) \(createStubInstance\)/g;
    while ((m = reCreateStub.exec(reasons))) { out.push({ cls: m[1], member: null }); }
    const reMember = /stubs\/spies ([\w.]+)\.(\w+) \(internal (\w+)\)/g;
    while ((m = reMember.exec(reasons))) { out.push({ cls: m[3], member: m[2] }); }
    const reBareClass = /stubs\/spies internal class (\w+)/g;
    while ((m = reBareClass.exec(reasons))) { out.push({ cls: m[1], member: null }); }
    return out;
}
const HAS_GENERIC_INTERNAL_REASON = (reasons) => /reads\/calls an internal-only member/.test(reasons);

// ---------------------------------------------------------------- acorn walk
// Mirrors migration/bin/tag-tests.mjs's describe/it walk closely enough to
// recover, per test, the same combinedText (own body + in-scope
// beforeEach/before hook bodies) it used to compute the W/M/B tag, so the
// call-site and internal-member scans below see exactly what that test runs.
const TEST_FN_NAMES = new Set(['it', 'it.only', 'it.skip', 'specify', 'specify.only', 'specify.skip']);
const SUITE_FN_NAMES = new Set(['describe', 'describe.only', 'describe.skip', 'context', 'context.only', 'context.skip']);
const HOOK_FN_NAMES = new Set(['beforeEach', 'before']);

function calleeName(node) {
    if (node.type === 'Identifier') { return node.name; }
    if (node.type === 'MemberExpression' && !node.computed) {
        const obj = calleeName(node.object);
        const prop = node.property.name;
        return obj ? `${obj}.${prop}` : null;
    }
    return null;
}
function titleInfo(node) {
    if (!node) { return { literal: null, pattern: null }; }
    if (node.type === 'Literal' && typeof node.value === 'string') { return { literal: node.value, pattern: null }; }
    if (node.type === 'TemplateLiteral') {
        return { literal: null, pattern: node.quasis.map((q) => (q.value.cooked ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') };
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        const parts = [];
        (function flatten(n) {
            if (n.type === 'BinaryExpression' && n.operator === '+') { flatten(n.left); flatten(n.right); }
            else if (n.type === 'Literal' && typeof n.value === 'string') { parts.push(n.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
            else { parts.push('.*'); }
        })(node);
        return { literal: null, pattern: parts.join('') };
    }
    return { literal: null, pattern: '.*' };
}

function collectTests(program, src) {
    const results = [];
    const suiteStack = [];
    function fnText(fnNode) {
        if (!fnNode || (fnNode.type !== 'FunctionExpression' && fnNode.type !== 'ArrowFunctionExpression')) { return ''; }
        return src.slice(fnNode.start, fnNode.end);
    }
    function visit(node) {
        if (!node || typeof node.type !== 'string') { return; }
        if (node.type === 'CallExpression') {
            const name = calleeName(node.callee);
            if (name && SUITE_FN_NAMES.has(name)) {
                const { literal, pattern } = titleInfo(node.arguments[0]);
                suiteStack.push({ titleLiteral: literal, titlePattern: pattern, hookTexts: [] });
                const fn = node.arguments[1];
                if (fn && fn.body) { visit(fn.body); }
                suiteStack.pop();
                return;
            }
            if (name && HOOK_FN_NAMES.has(name)) {
                const fn = node.arguments[node.arguments.length - 1];
                const text = fnText(fn);
                if (suiteStack.length > 0 && text) { suiteStack[suiteStack.length - 1].hookTexts.push(text); }
                return;
            }
            if (name && TEST_FN_NAMES.has(name)) {
                const { literal, pattern } = titleInfo(node.arguments[0]);
                const fn = node.arguments[1];
                const ownText = fnText(fn);
                const hookText = suiteStack.flatMap((s) => s.hookTexts).join('\n');
                const combinedText = hookText + '\n' + ownText;
                const describeParts = suiteStack.map((s) => s.titleLiteral ?? '<dynamic>');
                const literalFullTitle = literal !== null && describeParts.every((p) => p !== '<dynamic>')
                    ? [...describeParts, literal].join(' ') : null;
                const patternParts = suiteStack.map((s) => s.titlePattern ?? (s.titleLiteral ? s.titleLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '.*'));
                const ownPattern = pattern ?? (literal !== null ? literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '.*');
                results.push({
                    literalFullTitle,
                    fullTitlePattern: [...patternParts, ownPattern].join(' '),
                    combinedText,
                });
                return;
            }
        }
        for (const key in node) {
            if (key === 'parent') { continue; }
            const val = node[key];
            if (Array.isArray(val)) { for (const v of val) { if (v && typeof v.type === 'string') { visit(v); } } }
            else if (val && typeof val.type === 'string') { visit(val); }
        }
    }
    visit(program);
    return results;
}

// file (relative to test/) -> { exact: Map<title,text>, patterns: [{re,text}] }
function indexTestFile(absPath) {
    const src = fs.readFileSync(absPath, 'utf8');
    let program;
    try {
        program = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
    } catch (e) {
        return { exact: new Map(), patterns: [] };
    }
    const tests = collectTests(program, src);
    const exact = new Map();
    const patterns = [];
    for (const t of tests) {
        if (t.literalFullTitle !== null) { exact.set(t.literalFullTitle, t.combinedText); }
        let re = null;
        try { re = new RegExp('^' + t.fullTitlePattern + '$'); } catch (e) { re = null; }
        if (re) { patterns.push({ re, text: t.combinedText }); }
    }
    return { exact, patterns };
}

function findCombinedText(index, title) {
    if (index.exact.has(title)) { return index.exact.get(title); }
    for (const p of index.patterns) { if (p.re.test(title)) { return p.text; } }
    return '';
}

// ---------------------------------------------------------------- internal-member scan
// For the generic "reads/calls an internal-only member" reason, resolve
// *which* member: visitX names map straight to ledger members of that name
// (across classes — receiver not resolvable, documented above);
// `.getAst()` maps to BaseModelManager.getAst; `_resolveSuperType` maps to
// ClassDeclaration._resolveSuperType. Bare `.ast` / `modelFiles[` /
// `_resolveInternal` have no member in this ledger (fields, not methods) and
// stay unmapped, with that reason recorded explicitly.
function internalMemberHits(combinedText) {
    const hits = { members: new Set(), unmappedReasons: new Set() };
    const visitRe = /\.(visit[A-Z]\w*)\s*\(/g;
    let m;
    while ((m = visitRe.exec(combinedText))) { hits.members.add(m[1]); }
    if (/\.getAst\s*\(\)/.test(combinedText)) { hits.members.add('getAst'); }
    if (/_resolveSuperType/.test(combinedText)) { hits.members.add('_resolveSuperType'); }
    if (/modelFiles\[/.test(combinedText)) { hits.unmappedReasons.add('internal field access: modelFiles[..] (BaseModelManager instance field, no ledger member)'); }
    if (/\.ast\b/.test(combinedText)) { hits.unmappedReasons.add('internal field access: .ast (AST field on introspect classes, no ledger member)'); }
    if (/_resolveInternal/.test(combinedText)) { hits.unmappedReasons.add('internal-only member: _resolveInternal (not present in the current ledger member set)'); }
    return hits;
}

// ---------------------------------------------------------------- direct call-site scan
function callRegexFor(row) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const name = row.member.replace(/^(get|set) /, '');
    if (row.kind === 'ctor') { return new RegExp('new\\s+' + esc(row.cls) + '\\s*\\('); }
    if (row.kind === 'function') { return new RegExp('(^|[^.\\w$])' + esc(name) + '\\s*\\(|\\.' + esc(name) + '\\s*\\('); }
    if (row.kind === 'static') { return new RegExp('\\b' + esc(row.cls) + '\\.' + esc(name) + '\\s*\\('); }
    return new RegExp('\\.' + esc(name) + '\\s*\\(');
}

/**
 * @param {Array} ledgerRows extract-members.js rows (file, cls, member, kind)
 * @param {string} tagsPath  migration/tags/test-tags.tsv
 * @param {string} testRoot  packages/concerto-core/test
 * @returns {{perMember: Map, unmappedW: Array, wLiftByFile: Map}}
 */
function computeEvidence(ledgerRows, tagsPath, testRoot) {
    const tagRows = loadTestTags(tagsPath);

    // Index every test file referenced by test-tags.tsv once.
    const fileIndex = new Map();
    for (const t of tagRows) {
        if (!fileIndex.has(t.file)) {
            const abs = path.join(testRoot, t.file);
            fileIndex.set(t.file, fs.existsSync(abs) ? indexTestFile(abs) : { exact: new Map(), patterns: [] });
        }
    }

    // Ledger lookups.
    const byClassMember = new Map(); // "Class.member" -> [rowIdx,...]
    const byMember = new Map(); // "member" -> [rowIdx,...] (any class - for visitX etc.)
    const ctorByClass = new Map(); // "Class" -> rowIdx
    ledgerRows.forEach((row, i) => {
        const key = `${row.cls || ''}.${row.member}`;
        if (!byClassMember.has(key)) { byClassMember.set(key, []); }
        byClassMember.get(key).push(i);
        if (!byMember.has(row.member)) { byMember.set(row.member, []); }
        byMember.get(row.member).push(i);
        if (row.kind === 'ctor') { ctorByClass.set(row.cls, i); }
    });
    const classNames = new Set(ledgerRows.map((r) => r.cls).filter(Boolean));
// Exception classes are asserted via `new X(...)`/`.should.throw(X, ...)` in
// almost every test file, including plain M unit tests, as the normal way
// to name the expected error — not evidence that the class was built over a
// stubbed collaborator (plan section 3 is about view constructors taking a
// sinon-stubbed parent). Exclude them from that specific heuristic so a
// throw assertion elsewhere in a test doesn't manufacture a false
// needs_fallback for an exception constructor.
const EXCEPTION_CLASSES = new Set([
    'IllegalModelException', 'MetamodelException', 'SecurityException',
    'ValidationException', 'TypeNotFoundException',
]);

    const wTestsByRow = ledgerRows.map(() => new Map()); // rowIdx -> Map<"file\u0000title", {file,title}>
    const directTestsByRow = ledgerRows.map(() => new Map());
    const needsFallback = ledgerRows.map(() => false);
    const unmappedW = [];
    const wLiftByFile = new Map(); // test file -> [{title, reasons}]

    const addW = (rowIdx, file, title) => {
        wTestsByRow[rowIdx].set(file + '\u0000' + title, { file, title });
    };
    const addDirect = (rowIdx, file, title) => {
        directTestsByRow[rowIdx].set(file + '\u0000' + title, { file, title });
    };

    for (const t of tagRows) {
        const index = fileIndex.get(t.file);
        const combinedText = findCombinedText(index, t.title);

        if (t.tag === 'W') {
            if (!wLiftByFile.has(t.file)) { wLiftByFile.set(t.file, []); }
            wLiftByFile.get(t.file).push({ title: t.title, reasons: t.reasons });

            let mappedAny = false;
            // (a) explicit stub/spy/createStubInstance evidence from reasons.
            for (const ev of stubEvidenceFromReasons(t.reasons)) {
                if (ev.member) {
                    const idxs = byClassMember.get(`${ev.cls}.${ev.member}`) || [];
                    for (const idx of idxs) { addW(idx, t.file, t.title); mappedAny = true; }
                } else if (ctorByClass.has(ev.cls)) {
                    addW(ctorByClass.get(ev.cls), t.file, t.title);
                    mappedAny = true;
                    // whole-class stub (createStubInstance) replaces every prototype
                    // method for this test, so it is also collaborator-fallback
                    // evidence for the class's own constructor (plan section 3).
                    needsFallback[ctorByClass.get(ev.cls)] = true;
                }
            }
            // (a)/(b) generic "internal-only member" reason: resolve via source scan.
            if (HAS_GENERIC_INTERNAL_REASON(t.reasons) || combinedText) {
                const hits = internalMemberHits(combinedText);
                for (const name of hits.members) {
                    const idxs = byMember.get(name) || [];
                    for (const idx of idxs) { addW(idx, t.file, t.title); mappedAny = true; }
                }
                if (HAS_GENERIC_INTERNAL_REASON(t.reasons) && hits.unmappedReasons.size && hits.members.size === 0) {
                    for (const r of hits.unmappedReasons) { unmappedW.push({ file: t.file, title: t.title, reason: r }); }
                    mappedAny = true; // "listed as unmapped with a reason" counts as handled
                }
            }

            // needs_fallback, part 2: this test stubs some collaborator class Y
            // and, in the same test text, constructs a *different* ledger class
            // X (a `new X(` not itself in the stub set) — X's constructor is
            // built over a stubbed collaborator.
            const stubbed = new Set(stubEvidenceFromReasons(t.reasons).map((e) => e.cls));
            if (stubbed.size > 0 && combinedText) {
                const newRe = /new\s+([A-Za-z_$][\w$]*)\s*\(/g;
                let m;
                while ((m = newRe.exec(combinedText))) {
                    const cls = m[1];
                    if (classNames.has(cls) && !stubbed.has(cls) && ctorByClass.has(cls) && !EXCEPTION_CLASSES.has(cls)) {
                        needsFallback[ctorByClass.get(cls)] = true;
                        addW(ctorByClass.get(cls), t.file, t.title);
                        mappedAny = true;
                    }
                }
            }

            if (!mappedAny) {
                unmappedW.push({ file: t.file, title: t.title, reason: 'W-tagged but no stub/spy/createStubInstance target or internal-only member could be resolved to a ledger member from its reasons or source text' });
            }
        }

        // (c) direct call-site evidence, from every test regardless of tag
        // (a B test is exactly what "direct_tests: exercising it through the
        // public API" means; W tests can call a member directly too).
        if (combinedText) {
            for (let idx = 0; idx < ledgerRows.length; idx++) {
                const row = ledgerRows[idx];
                // cheap prefilter: the bare name must appear as a token before
                // paying for the full call regex. For a constructor row the
                // call site reads `new ClassName(`, not the word
                // "constructor", so prefilter on the class name instead.
                const bare = row.kind === 'ctor' ? row.cls : row.member.replace(/^(get|set) /, '');
                if (!bare || !combinedText.includes(bare)) { continue; }
                if (callRegexFor(row).test(combinedText)) {
                    addDirect(idx, t.file, t.title);
                }
            }
        }
    }

    return { wTestsByRow, directTestsByRow, needsFallback, unmappedW, wLiftByFile };
}

function fmtTestSet(map, maxFiles) {
    if (map.size === 0) { return '-'; }
    const byFile = new Map();
    for (const { file } of map.values()) { byFile.set(file, (byFile.get(file) || 0) + 1); }
    const files = [...byFile.keys()].sort((a, b) => byFile.get(b) - byFile.get(a) || a.localeCompare(b));
    const shown = files.slice(0, maxFiles).map((f) => `${f}:${byFile.get(f)}`);
    const extra = files.length > maxFiles ? `,+${files.length - maxFiles}files` : '';
    return `n=${map.size} ${shown.join(',')}${extra}`;
}

module.exports = { computeEvidence, fmtTestSet, loadTestTags };
