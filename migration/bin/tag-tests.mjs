#!/usr/bin/env node
/**
 * P0-02(A): tag every it() in packages/concerto-core/test/** as B / W / M.
 *
 * Two passes are combined:
 *  1. STATIC (this file): parses each test file with acorn, resolves the
 *     describe/before/beforeEach chain that applies to each `it`, and
 *     pattern-matches the combined source text against the B/W/M rules in
 *     RUST_MIGRATION_PLAN.md §2.1.
 *  2. RUNTIME: migration/tags/sinon-trace-hook.cjs, loaded as a mocha
 *     --require hook while the real suite runs, records which tests
 *     actually created a stub/spy touching a concerto-core internal.
 *     migration/tags/runtime-stub-trace.json is its output.
 *
 * The runtime test *list* itself (full titles, including loop-generated
 * tests whose titles are built at runtime) comes from a mocha JSON
 * reporter run and is the source of truth for "which tests exist" — see
 * migration/tags/mocha-results.json, produced by run-tagging.sh.
 *
 * Reconciliation: for every runtime test, take the static tag if the test's
 * title matches a statically-known it() (exactly, or via a title pattern
 * for loop-generated titles); then, if the runtime trace shows that test
 * created an internal stub/spy, the tag is upgraded to W regardless of what
 * the static pass said (runtime observation wins over static analysis,
 * since indirection can hide a stub from the static pass but never from
 * the runtime one).
 *
 * Output:
 *   migration/tags/test-tags.tsv   columns: file, describe path, test title, tag, reasons
 *   migration/tags/SUMMARY.md      counts per tag and per file
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { computeInternalClassNames, EXTERNAL_COLLABORATORS, INTERNAL_ONLY_MEMBER_RE } from '../tags/internal-classes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MIGRATION_ROOT, '..');
const CORE_ROOT = path.join(REPO_ROOT, 'packages', 'concerto-core');
const CORE_SRC = path.join(CORE_ROOT, 'src');
const TEST_ROOT = path.join(CORE_ROOT, 'test');
const TAGS_DIR = path.join(MIGRATION_ROOT, 'tags');

const args = process.argv.slice(2);
function argVal(name, def) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 ? args[i + 1] : def;
}
const mochaResultsPath = argVal('mocha-results', path.join(TAGS_DIR, 'mocha-results.json'));
const runtimeTracePath = argVal('runtime-trace', path.join(TAGS_DIR, 'runtime-stub-trace.json'));
const testFilesListPath = argVal('files', null);

const INTERNAL_NAMES = computeInternalClassNames(CORE_SRC);

// Constructors whose presence in a test means "this test builds/reaches a
// real concerto-core model graph, so it isn't a pure message/unit (M)
// test" even if it also happens to construct an exception.
const GRAPH_CONSTRUCTORS = [
    'ModelManager', 'BaseModelManager', 'AstModelManager', 'Introspector', 'ModelFile',
    'ClassDeclaration', 'Property', 'Field', 'AssetDeclaration', 'ParticipantDeclaration',
    'TransactionDeclaration', 'EventDeclaration', 'ConceptDeclaration', 'EnumDeclaration',
    'EnumValueDeclaration', 'MapDeclaration', 'ScalarDeclaration', 'RelationshipDeclaration',
    'DecoratorManager', 'DecoratorFactory', 'Serializer', 'Factory', 'Resource', 'Typed',
    'Relationship', 'Identifiable', 'ValidatedResource', 'ModelLoader', 'DcsIndexWrapper',
];
const GRAPH_CTOR_RE = new RegExp(`\\bnew\\s+(${GRAPH_CONSTRUCTORS.join('|')})\\s*\\(`);

// Pure message/exception/unit constructs (plan's M definition).
const PURE_UNIT_RE = new RegExp(
    '\\bnew\\s+(SecurityException|TypeNotFoundException|IllegalModelException|MetamodelException)\\s*\\(' +
    '|\\bGlobalize\\s*\\(' +
    '|\\bDateTimeUtil\\.'
);

/** Escape a literal string for embedding in a RegExp. */
function reEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if a stub/spy/createStubInstance target name counts as external. */
function isExternalName(name) {
    return EXTERNAL_COLLABORATORS.has(name);
}
function isInternalName(name) {
    return INTERNAL_NAMES.has(name);
}

/**
 * Resolve a call's callee to a dotted name like "it", "it.only",
 * "describe.skip", "beforeEach", etc. Returns null for anything else.
 */
function calleeName(node) {
    if (node.type === 'Identifier') {
        return node.name;
    }
    if (node.type === 'MemberExpression' && !node.computed) {
        const obj = calleeName(node.object);
        const prop = node.property.name;
        return obj ? `${obj}.${prop}` : null;
    }
    return null;
}

const TEST_FN_NAMES = new Set(['it', 'it.only', 'it.skip', 'specify', 'specify.only', 'specify.skip']);
const SUITE_FN_NAMES = new Set(['describe', 'describe.only', 'describe.skip', 'context', 'context.only', 'context.skip']);
const HOOK_FN_NAMES = new Set(['beforeEach', 'before']);

/** Extract a title string, or a regex-pattern string (with .* holes), from a title AST node. */
function titleInfo(node) {
    if (!node) {
        return { literal: null, pattern: null };
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return { literal: node.value, pattern: null };
    }
    if (node.type === 'TemplateLiteral') {
        const parts = node.quasis.map((q) => reEscape(q.value.cooked ?? ''));
        return { literal: null, pattern: parts.join('.*') };
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        // Best-effort: flatten a chain of string concatenations, replacing
        // any non-literal piece with a wildcard.
        const parts = [];
        (function flatten(n) {
            if (n.type === 'BinaryExpression' && n.operator === '+') {
                flatten(n.left);
                flatten(n.right);
            } else if (n.type === 'Literal' && typeof n.value === 'string') {
                parts.push(reEscape(n.value));
            } else {
                parts.push('.*');
            }
        })(node);
        return { literal: null, pattern: parts.join('') };
    }
    return { literal: null, pattern: '.*' };
}

/**
 * Walk `program` (an acorn AST) and yield every it()/describe()/hook() call,
 * with a parent stack so we can build full titles and gather beforeEach text.
 */
function collectTests(program, src) {
    const results = [];
    const suiteStack = []; // { titleLiteral, titlePattern, hookTexts: [] }

    function functionSourceText(fnNode) {
        if (!fnNode || (fnNode.type !== 'FunctionExpression' && fnNode.type !== 'ArrowFunctionExpression')) {
            return '';
        }
        return src.slice(fnNode.start, fnNode.end);
    }

    function visit(node) {
        if (!node || typeof node.type !== 'string') {
            return;
        }
        if (node.type === 'CallExpression') {
            const name = calleeName(node.callee);
            if (name && (SUITE_FN_NAMES.has(name))) {
                const { literal, pattern } = titleInfo(node.arguments[0]);
                suiteStack.push({ titleLiteral: literal, titlePattern: pattern, hookTexts: [] });
                const fn = node.arguments[1];
                if (fn && fn.body) {
                    visit(fn.body);
                }
                suiteStack.pop();
                return; // children already visited
            }
            if (name && HOOK_FN_NAMES.has(name)) {
                const fn = node.arguments[node.arguments.length - 1];
                const text = functionSourceText(fn);
                if (suiteStack.length > 0 && text) {
                    suiteStack[suiteStack.length - 1].hookTexts.push(text);
                }
                return;
            }
            if (name && TEST_FN_NAMES.has(name)) {
                const { literal, pattern } = titleInfo(node.arguments[0]);
                const fn = node.arguments[1];
                const ownText = functionSourceText(fn);
                const hookText = suiteStack.flatMap((s) => s.hookTexts).join('\n');
                const combinedText = hookText + '\n' + ownText;
                const describeParts = suiteStack.map((s) => s.titleLiteral ?? '<dynamic>');
                const literalFullTitle = literal !== null && describeParts.every((p) => p !== '<dynamic>')
                    ? [...describeParts, literal].join(' ')
                    : null;
                const patternParts = suiteStack.map((s) => s.titlePattern ?? (s.titleLiteral ? reEscape(s.titleLiteral) : '.*'));
                const ownPattern = pattern ?? (literal !== null ? reEscape(literal) : '.*');
                const fullPattern = [...patternParts, ownPattern].join(' ');
                results.push({
                    describePath: describeParts.join(' > '),
                    literalFullTitle,
                    fullTitlePattern: fullPattern,
                    combinedText,
                    isDynamic: literalFullTitle === null,
                });
                return;
            }
        }
        for (const key in node) {
            if (key === 'parent') continue;
            const val = node[key];
            if (Array.isArray(val)) {
                for (const v of val) {
                    if (v && typeof v.type === 'string') visit(v);
                }
            } else if (val && typeof val.type === 'string') {
                visit(val);
            }
        }
    }

    visit(program);
    return results;
}

/** Apply the B/W/M rules to a chunk of combined source text. */
function staticTag(combinedText, file) {
    const reasons = [];

    if (file.startsWith('scripts/')) {
        return { tag: 'M', reasons: ['test/scripts: exercises repo scripts, not concerto-core behaviour'] };
    }

    // W signals -----------------------------------------------------------
    let stubMatch;
    // createStubInstance(Klass[, overrides]) — the single form that always
    // stubs a whole internal object, regardless of arg count.
    const createStubRe = /createStubInstance\s*\(\s*([A-Za-z_$][\w$]*)/g;
    while ((stubMatch = createStubRe.exec(combinedText))) {
        const name = stubMatch[1];
        if (isInternalName(name)) {
            reasons.push(`stubs internal class ${name} (createStubInstance)`);
        }
    }
    // `.stub(obj, 'method')` / `.spy(obj, 'method')` — the two-arg member
    // form. Checked first (before the single-arg form below) so that
    // `sandbox.stub(Factory, 'newId')` is recognised as the newId
    // exception and not also counted as a bare `.stub(Factory)` hit.
    const memberStubRe = /\.(?:stub|spy)\s*\(\s*([A-Za-z_$][\w$.]*)\s*,\s*['"]([A-Za-z0-9_]+)['"]/g;
    const memberStubbedSpans = [];
    while ((stubMatch = memberStubRe.exec(combinedText))) {
        const [full, receiver, method] = stubMatch;
        memberStubbedSpans.push([stubMatch.index, stubMatch.index + full.length]);
        if (method === 'newId') {
            continue; // Factory.newId stubbing stays B (external-collaborator-like).
        }
        for (const iname of INTERNAL_NAMES) {
            if (receiver === iname || receiver.startsWith(`${iname}.`)) {
                reasons.push(`stubs/spies ${receiver}.${method} (internal ${iname})`);
                break;
            }
        }
    }
    // `.stub(obj)` / `.spy(obj)` — bare single-arg form (spies on/stubs an
    // entire object). Skip matches that are actually part of a two-arg
    // `.stub(obj, 'method')` call already handled above.
    const bareStubRe = /\.(?:stub|spy)\s*\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
    while ((stubMatch = bareStubRe.exec(combinedText))) {
        const overlapsMember = memberStubbedSpans.some(([s, e]) => stubMatch.index >= s && stubMatch.index < e);
        if (overlapsMember) {
            continue;
        }
        const name = stubMatch[1];
        if (isInternalName(name)) {
            reasons.push(`stubs/spies internal class ${name}`);
        }
    }
    if (INTERNAL_ONLY_MEMBER_RE.test(combinedText)) {
        reasons.push('reads/calls an internal-only member (visitX/_resolveSuperType/.ast/modelFiles[..])');
    }

    if (reasons.length > 0) {
        return { tag: 'W', reasons };
    }

    // M signals -------------------------------------------------------------
    if (PURE_UNIT_RE.test(combinedText) && !GRAPH_CTOR_RE.test(combinedText)) {
        return { tag: 'M', reasons: ['pure exception/Globalize/DateTimeUtil unit test, no model graph built'] };
    }

    // Default: B -------------------------------------------------------------
    return { tag: 'B', reasons: ['drives only the public API/fixtures'] };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function listTestFiles() {
    if (testFilesListPath) {
        return fs.readFileSync(testFilesListPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    }
    const out = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const rel = path.relative(TEST_ROOT, full);
            if (entry.isDirectory()) {
                // Only test/data is pure fixtures (no it() specs at all);
                // test/models/*.js DOES contain real it() specs and must be
                // tagged like any other test directory (plan: tag every
                // it() in test/**, only test/scripts is special-cased).
                if (['data'].includes(entry.name)) continue;
                walk(full);
            } else if (entry.name.endsWith('.js')) {
                const src = fs.readFileSync(full, 'utf8');
                if (/\bit\s*\(/.test(src)) out.push(rel);
            }
        }
    })(TEST_ROOT);
    return out.sort();
}

function main() {
    const testFiles = listTestFiles();

    // Static pass: build exact-title map and an ordered list of pattern
    // entries (used for loop-generated / dynamic titles), per file.
    const exactMap = new Map(); // fullTitle -> {tag, reasons, file, describePath}
    const patternsByFile = new Map(); // file -> [{re, tag, reasons, describePath}]
    const staticIssues = [];

    for (const relFile of testFiles) {
        const abs = path.join(TEST_ROOT, relFile);
        const src = fs.readFileSync(abs, 'utf8');
        let program;
        try {
            program = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
        } catch (e) {
            staticIssues.push(`${relFile}: parse error: ${e.message}`);
            continue;
        }
        const tests = collectTests(program, src);
        const patterns = [];
        for (const t of tests) {
            const { tag, reasons } = staticTag(t.combinedText, relFile);
            if (t.literalFullTitle !== null) {
                exactMap.set(`${relFile}\u0000${t.literalFullTitle}`, { tag, reasons, file: relFile, describePath: t.describePath });
                // Also index without file prefix, for direct exact-title reconciliation.
                if (!exactMap.has(t.literalFullTitle)) {
                    exactMap.set(t.literalFullTitle, { tag, reasons, file: relFile, describePath: t.describePath });
                }
            }
            let re = null;
            try {
                re = new RegExp('^' + t.fullTitlePattern + '$');
            } catch (e) {
                re = null;
            }
            patterns.push({ re, tag, reasons, describePath: t.describePath, isDynamic: t.isDynamic });
            if (t.isDynamic) {
                if (!patternsByFile.has(relFile)) patternsByFile.set(relFile, []);
                patternsByFile.get(relFile).push({ re, tag, reasons, describePath: t.describePath });
            }
        }
    }

    // Runtime test list (source of truth for which tests exist).
    if (!fs.existsSync(mochaResultsPath)) {
        console.error(`Missing runtime mocha results at ${mochaResultsPath}. Run migration/bin/run-tagging.sh first.`);
        process.exit(1);
    }
    const mochaResults = JSON.parse(fs.readFileSync(mochaResultsPath, 'utf8'));
    const allRuntimeTests = [...(mochaResults.passes || []), ...(mochaResults.failures || []), ...(mochaResults.pending || [])];

    let runtimeTrace = {};
    if (fs.existsSync(runtimeTracePath)) {
        runtimeTrace = JSON.parse(fs.readFileSync(runtimeTracePath, 'utf8'));
    }

    const rows = [];
    const unresolved = [];
    for (const t of allRuntimeTests) {
        const fullTitle = t.fullTitle;
        const file = path.relative(TEST_ROOT, t.file);
        let entry = exactMap.get(`${file}\u0000${fullTitle}`) || exactMap.get(fullTitle);
        if (!entry) {
            const candidates = patternsByFile.get(file) || [];
            for (const c of candidates) {
                if (c.re && c.re.test(fullTitle)) {
                    entry = { tag: c.tag, reasons: c.reasons, file, describePath: c.describePath };
                    break;
                }
            }
        }
        if (!entry) {
            // scripts tests are always M regardless of static resolution.
            if (file.startsWith('scripts/')) {
                entry = { tag: 'M', reasons: ['test/scripts: exercises repo scripts, not concerto-core behaviour'], file, describePath: '' };
            } else {
                entry = { tag: 'B', reasons: ['no static match (dynamic title); defaulted to B'], file, describePath: '' };
                unresolved.push(fullTitle);
            }
        }

        let tag = entry.tag;
        const reasons = [...entry.reasons];
        const trace = runtimeTrace[fullTitle];
        if (trace && trace.internal && trace.internal.length > 0) {
            if (tag !== 'W') {
                reasons.push(`runtime: upgraded ${tag}->W`);
                tag = 'W';
            }
            for (const r of trace.internal) {
                reasons.push(`runtime-stub: ${r}`);
            }
        }

        rows.push({ file, describePath: entry.describePath, title: fullTitle, tag, reasons: reasons.join('; ') });
    }

    // Write TSV.
    const tsvLines = ['file\tdescribe_path\ttest_title\ttag\treasons'];
    for (const r of rows) {
        tsvLines.push([r.file, r.describePath, r.title, r.tag, r.reasons].map((s) => String(s).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
    }
    fs.mkdirSync(TAGS_DIR, { recursive: true });
    fs.writeFileSync(path.join(TAGS_DIR, 'test-tags.tsv'), tsvLines.join('\n') + '\n');

    // Summary.
    const counts = { B: 0, W: 0, M: 0 };
    const perFile = new Map();
    for (const r of rows) {
        counts[r.tag]++;
        if (!perFile.has(r.file)) perFile.set(r.file, { B: 0, W: 0, M: 0 });
        perFile.get(r.file)[r.tag]++;
    }
    const summaryLines = [];
    summaryLines.push('# Test tagging summary (P0-02)');
    summaryLines.push('');
    summaryLines.push(`Total tests: ${rows.length}`);
    summaryLines.push(`- B (behavioural): ${counts.B}`);
    summaryLines.push(`- W (white-box): ${counts.W}`);
    summaryLines.push(`- M (message/unit): ${counts.M}`);
    if (unresolved.length > 0) {
        summaryLines.push('');
        summaryLines.push(`**${unresolved.length} test(s) had no static match (dynamic/loop-generated titles the static pass could not pattern-match) and defaulted to B; see below.**`);
    }
    if (staticIssues.length > 0) {
        summaryLines.push('');
        summaryLines.push('## Static parse issues');
        for (const s of staticIssues) summaryLines.push(`- ${s}`);
    }
    summaryLines.push('');
    summaryLines.push('## Per file');
    summaryLines.push('');
    summaryLines.push('| file | B | W | M | total |');
    summaryLines.push('|---|---|---|---|---|');
    for (const [file, c] of [...perFile.entries()].sort()) {
        summaryLines.push(`| ${file} | ${c.B} | ${c.W} | ${c.M} | ${c.B + c.W + c.M} |`);
    }
    if (unresolved.length > 0) {
        summaryLines.push('');
        summaryLines.push('## Unresolved (dynamic title, defaulted to B)');
        for (const u of unresolved) summaryLines.push(`- ${u}`);
    }
    fs.writeFileSync(path.join(TAGS_DIR, 'SUMMARY.md'), summaryLines.join('\n') + '\n');

    console.log(`Tagged ${rows.length} tests: B=${counts.B} W=${counts.W} M=${counts.M}`);
    if (unresolved.length > 0) {
        console.log(`${unresolved.length} unresolved (dynamic titles, defaulted to B) — see migration/tags/SUMMARY.md`);
    }
}

main();
