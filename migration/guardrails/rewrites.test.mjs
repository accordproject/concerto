// P5-33: unit tests for the approved test-case rewrite guard.
// Run: node --test migration/guardrails/rewrites.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mochaBlocks, scopeOfLine, TOP_LEVEL } from './rewrites.mjs';
import { checkTestTree } from './relaxations.mjs';

const FILE = 'packages/concerto-core/test/x.js';
const SOURCE = [
    '\'use strict\';',                                  // 1
    'const sinon = require(\'sinon\');',                // 2
    'describe(\'X\', () => {',                          // 3
    '    let stub;',                                    // 4
    '    beforeEach(() => { stub = sinon.stub(); });',  // 5
    '    describe(\'#a\', () => {',                     // 6
    '        it(\'rewritten case\', () => {',           // 7
    '            stub.returns(1);',                     // 8
    '        });',                                      // 9
    '        it(\'other case\', () => {',               // 10
    '            stub.returns(2);',                     // 11
    '        });',                                      // 12
    '    });',                                          // 13
    '});',                                              // 14
].join('\n') + '\n';

test('mochaBlocks and scopeOfLine name the innermost scope', () => {
    const blocks = mochaBlocks(SOURCE);
    assert.deepEqual(blocks.map((b) => b.path.join(' > ')), ['X', 'X > #a', 'X > #a > rewritten case', 'X > #a > other case']);
    assert.equal(scopeOfLine(blocks, 2), TOP_LEVEL);
    assert.equal(scopeOfLine(blocks, 5), 'X > (setup)');
    assert.equal(scopeOfLine(blocks, 6), 'X > #a > (setup)');
    assert.equal(scopeOfLine(blocks, 8), 'X > #a > rewritten case');
    assert.equal(scopeOfLine(blocks, 11), 'X > #a > other case');
});

function scratchRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p533-guard-'));
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q', '-b', 'base');
    g('config', 'user.email', 't@example.com');
    g('config', 'user.name', 't');
    fs.mkdirSync(path.join(dir, 'packages/concerto-core/test'), { recursive: true });
    fs.writeFileSync(path.join(dir, FILE), SOURCE);
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    g('checkout', '-q', '-b', 'work');
    return dir;
}
const HEADER = 'file\tscope\tapproval\treason\n';
const rewriteList = (dir, scopes) => {
    const p = path.join(dir, 'rewrites.tsv');
    fs.writeFileSync(p, HEADER + scopes.map((s) => `${FILE}\t${s}\t#343\tblack-box rewrite\n`).join(''));
    return p;
};
const TREE = (dir, rewriteListPath) => checkTestTree({
    repoRoot: dir, baseRef: 'base', testPrefix: 'packages/concerto-core/test/',
    allowListPath: path.join(dir, 'none.tsv'), rewriteListPath, log: () => {},
});
const edit = (dir, from, to) => {
    const f = path.join(dir, FILE);
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(s.includes(from), from);
    fs.writeFileSync(f, s.replace(from, to));
};

test('an edit inside a listed case passes; the same edit unlisted fails', () => {
    const dir = scratchRepo();
    edit(dir, 'stub.returns(1);', 'const real = 1;\n            real.should.equal(1);');
    assert.equal(TREE(dir, rewriteList(dir, [])).length, 1);
    assert.equal(TREE(dir, rewriteList(dir, ['X > #a > other case'])).length, 1);
    assert.deepEqual(TREE(dir, rewriteList(dir, ['X > #a > rewritten case'])), []);
});

test('setup and top-level scopes must be listed separately', () => {
    const dir = scratchRepo();
    edit(dir, 'stub = sinon.stub();', 'stub = 1;');
    edit(dir, 'const sinon = require(\'sinon\');', 'const sinon = require(\'sinon\');\nconst x = 1;');
    assert.equal(TREE(dir, rewriteList(dir, ['X > (setup)'])).length, 1);
    assert.deepEqual(TREE(dir, rewriteList(dir, ['X > (setup)', TOP_LEVEL])), []);
    // A describe's setup scope does not cover its nested cases.
    edit(dir, 'stub.returns(2);', 'stub.returns(3);');
    assert.equal(TREE(dir, rewriteList(dir, ['X > (setup)', TOP_LEVEL])).length, 1);
});

test('deleting, renaming, adding, skipping or focusing a listed case fails', () => {
    const all = ['X > (setup)', 'X > #a > (setup)', 'X > #a > rewritten case', 'X > #a > other case', TOP_LEVEL];
    let dir = scratchRepo();
    edit(dir, '        it(\'rewritten case\', () => {\n            stub.returns(1);\n        });\n', '');
    assert.match(TREE(dir, rewriteList(dir, all)).join('\n'), /deleted or renamed/);
    dir = scratchRepo();
    edit(dir, 'it(\'rewritten case\'', 'it(\'renamed case\'');
    assert.match(TREE(dir, rewriteList(dir, all)).join('\n'), /deleted or renamed/);
    dir = scratchRepo();
    edit(dir, '    });\n});', '        it(\'new case\', () => {});\n    });\n});');
    assert.match(TREE(dir, rewriteList(dir, all)).join('\n'), /was added/);
    dir = scratchRepo();
    edit(dir, 'it(\'rewritten case\'', 'it.skip(\'rewritten case\'');
    assert.match(TREE(dir, rewriteList(dir, all)).join('\n'), /skips or focuses/);
    dir = scratchRepo();
    edit(dir, 'it(\'other case\'', 'it.only(\'other case\'');
    assert.match(TREE(dir, rewriteList(dir, all)).join('\n'), /skips or focuses/);
});

test('rewrite rows for another file do not cover this one', () => {
    const dir = scratchRepo();
    edit(dir, 'stub.returns(1);', 'stub.returns(5);');
    const p = path.join(dir, 'rewrites.tsv');
    fs.writeFileSync(p, HEADER + 'packages/concerto-core/test/y.js\tX > #a > rewritten case\t#343\tr\n');
    assert.equal(TREE(dir, p).length, 1);
});

test('malformed rewrite list rows are reported', () => {
    const dir = scratchRepo();
    const p = path.join(dir, 'rewrites.tsv');
    fs.writeFileSync(p, HEADER + `${FILE}\tX > #a > rewritten case\n`);
    assert.match(TREE(dir, p).join('\n'), /expected 4 non-empty/);
});
