/*
 * Engine-call scan for the seam ledger (accordproject/concerto-rust#261).
 *
 * Parses one member's source text with the TypeScript compiler API and
 * reports:
 *   - engineCall: whether the member's own body (nested closures included)
 *     references the Rust engine: the module-level `rust` binding, a
 *     `rustHandle` / `_rust*` handle, or `loadEngine(...)`;
 *   - substantive: whether the body runs real logic of its own, i.e. it has
 *     a branch, loop, `throw`, `try` or conditional expression and spans
 *     more than 4 lines. A member with no engine call that is not
 *     substantive is a snapshot getter or a trivial field read / forward.
 *
 * An engine call is also counted one hop away, inside the same source file
 * (accordproject/concerto-rust#276, H1):
 *   - a call to a same-module helper that crosses: a top-level function of
 *     the same file whose own body makes an engine call, directly or through
 *     another such helper (e.g. `beginModelFile` -> `computeBatch`, which
 *     calls `rust.modelFileViewSnapshot`);
 *   - a method call on a local handle: a local variable initialised from such
 *     a helper call (e.g. `const handle = handleFor(mm);
 *     handle.serializerFromJson(...)`).
 * Imported functions and methods (`this.x()`) are not followed.
 *
 * build-ledger.js uses it to demote a RUST row with no engine call to
 * PARTIAL, and `extract-members.js --check` uses it to fail when a RUST row
 * makes no engine call or a PARTIAL row does (it has been converted since
 * the ledger was built and should be RUST). HYBRID rows are not checked.
 */
'use strict';
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const ts = require(path.join(repo, 'node_modules', 'typescript'));

const ENGINE_IDENT = /^(rust|rustHandle|loadEngine|_rust\w*)$/;
const BRANCH_KINDS = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.ThrowStatement,
    ts.SyntaxKind.TryStatement,
    ts.SyntaxKind.ConditionalExpression,
]);

/**
 * Parses one member's text (see `scan`).
 * @param {{text: string}} row an extract-members.js row
 * @return {object} the TypeScript SourceFile
 */
function parse(row) {
    // Wrap in a class so method/accessor/constructor text parses as-is;
    // top-level functions and `const f = () => ...` parse either way.
    const wrapped = /^\s*(export\s+)?(async\s+)?(function|const|let|var)\b/.test(row.text)
        ? row.text
        : `class __X__ {\n${row.text}\n}`;
    return ts.createSourceFile('member.ts', wrapped, ts.ScriptTarget.Latest, true);
}

/**
 * The direct engine references in a parsed member, and the plain identifier
 * calls it makes (candidate same-module helper calls).
 * @param {object} sf the parsed member
 * @return {{refs: Set<string>, calls: Set<string>, branches: boolean}} result
 */
function directRefs(sf) {
    const refs = new Set();
    const calls = new Set();
    let branches = false;
    const visit = (n) => {
        if (ts.isIdentifier(n) && ENGINE_IDENT.test(n.text)) {
            // The member's own name is not a reference (e.g. a method named
            // `_rustHandleMatchesModelFiles` declaring itself).
            const p = n.parent;
            const isDeclName = p && (ts.isMethodDeclaration(p) || ts.isFunctionDeclaration(p) ||
                ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isPropertyDeclaration(p)) && p.name === n;
            if (!isDeclName) { refs.add(n.text); }
        }
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) { calls.add(n.expression.text); }
        if (BRANCH_KINDS.has(n.kind)) { branches = true; }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return { refs, calls, branches };
}

/**
 * The same-module helpers that cross, per source file: the top-level
 * functions (extract-members.js rows with no class) whose own body makes an
 * engine call, directly or by calling another helper of the same file that
 * does (a fixpoint).
 * @param {Array<object>} rows every extract-members.js row
 * @return {Map<string, Set<string>>} file -> helper names
 */
function crossingHelpers(rows) {
    const byFile = new Map();
    for (const row of rows) {
        if (row.cls || row.kind !== 'function') { continue; }
        if (!byFile.has(row.file)) { byFile.set(row.file, new Map()); }
        byFile.get(row.file).set(row.member, directRefs(parse(row)));
    }
    const out = new Map();
    for (const [file, fns] of byFile) {
        const crossing = new Set([...fns].filter(([, d]) => d.refs.size > 0).map(([name]) => name));
        let grew = true;
        while (grew) {
            grew = false;
            for (const [name, d] of fns) {
                if (!crossing.has(name) && [...d.calls].some(c => c !== name && crossing.has(c))) {
                    crossing.add(name);
                    grew = true;
                }
            }
        }
        out.set(file, crossing);
    }
    return out;
}

/**
 * Scans one member.
 * @param {{file: string, text: string, loc: number}} row an extract-members.js row
 * @param {Map<string, Set<string>>} [helpers] `crossingHelpers(rows)`; omit to
 *   count only the member's direct engine references
 * @return {{engineCall: boolean, engineRefs: string[], branches: boolean, substantive: boolean}} result
 */
function scan(row, helpers) {
    const sf = parse(row);
    const { refs, branches } = directRefs(sf);
    const crossing = (helpers && helpers.get(row.file)) || new Set();
    if (crossing.size) {
        const self = row.cls ? null : row.member;
        // A helper named like an engine reference (`loadEngine`) is already
        // counted directly above.
        const isHelperCall = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) &&
            e.expression.text !== self && !ENGINE_IDENT.test(e.expression.text) && crossing.has(e.expression.text);
        // Local handles: `const h = helper(...)`.
        const handles = new Set();
        const findHandles = (n) => {
            if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && isHelperCall(n.initializer)) {
                handles.add(n.name.text);
            }
            ts.forEachChild(n, findHandles);
        };
        findHandles(sf);
        const visit = (n) => {
            if (isHelperCall(n)) { refs.add(n.expression.text + '()'); }
            if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
                ts.isIdentifier(n.expression.expression) && handles.has(n.expression.expression.text)) {
                refs.add(n.expression.expression.text + '.' + n.expression.name.text + '()');
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
    }
    return {
        engineCall: refs.size > 0,
        engineRefs: [...refs].sort(),
        branches,
        substantive: branches && row.loc > 4,
    };
}

module.exports = { scan, crossingHelpers };
