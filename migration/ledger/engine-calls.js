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
 * Scans one member.
 * @param {{text: string, loc: number}} row an extract-members.js row
 * @return {{engineCall: boolean, engineRefs: string[], branches: boolean, substantive: boolean}} result
 */
function scan(row) {
    // Wrap in a class so method/accessor/constructor text parses as-is;
    // top-level functions and `const f = () => ...` parse either way.
    const wrapped = /^\s*(export\s+)?(async\s+)?(function|const|let|var)\b/.test(row.text)
        ? row.text
        : `class __X__ {\n${row.text}\n}`;
    const sf = ts.createSourceFile('member.ts', wrapped, ts.ScriptTarget.Latest, true);
    const refs = new Set();
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
        if (BRANCH_KINDS.has(n.kind)) { branches = true; }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return {
        engineCall: refs.size > 0,
        engineRefs: [...refs].sort(),
        branches,
        substantive: branches && row.loc > 4,
    };
}

module.exports = { scan };
