// P5-09: unit tests for the message-assertion relaxation guard.
// Run: node --test migration/guardrails/relaxations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { relaxationViolation, parseHunks, checkFileHunks, splitArgs, checkTestTree } from './relaxations.mjs';

const ok = (o, n) => assert.equal(relaxationViolation(o, n), null, `${o} -> ${n}`);
const bad = (o, n) => assert.notEqual(relaxationViolation(o, n), null, `${o} -> ${n}`);

test('splitArgs handles regexes and strings with commas', () => {
    assert.deepEqual(splitArgs('IllegalModelException, /a, b/'), ['IllegalModelException', '/a, b/']);
    assert.deepEqual(splitArgs('\'x, y\''), ['\'x, y\'']);
    assert.deepEqual(splitArgs(''), []);
});

test('accepted relaxations', () => {
    ok('}).should.throw(IllegalModelException, /Undeclared type/);', '}).should.throw(IllegalModelException);');
    ok('}).should.throw(/is already declared/);', '}).should.throw();');
    ok('}).should.throw(/is already declared/);', '}).should.throw(IllegalModelException);');
    ok('}).to.throw(Error, \'Type bar is not declared in namespace foo\');', '}).to.throw(Error);');
    ok('return p.should.be.rejectedWith(\'boom\');', 'return p.should.be.rejectedWith(ValidationException);');
    ok('err.message.should.match(/Class someAsset/);', 'err.should.be.an.instanceOf(IllegalModelException);');
    ok('expect(e.message).to.equal(\'x\');', 'expect(e).to.be.instanceOf(ValidationException);');
    ok('}).should.throw(IllegalModelException,\n    /long message/);', '}).should.throw(IllegalModelException);');
});

test('rejected changes', () => {
    bad('}).should.throw(IllegalModelException, /m/);', '}).should.throw(ValidationException);'); // class changed
    bad('}).should.throw(IllegalModelException, /m/);', '}).should.throw();'); // class dropped
    bad('}).should.throw(IllegalModelException);', '}).should.throw();'); // no message to relax
    bad('}).should.throw(/m/);', '}).should.throw(/other/);'); // message swapped
    bad('}).should.throw(/m/);', '}).should.not.throw();'); // outcome flipped
    bad('}).should.throw(/m/);', '});'); // assertion removed
    bad('const x = foo(1);', 'const x = foo(2);'); // not an assertion
    bad('it(\'does a thing\', () => {', 'it.skip(\'does a thing\', () => {');
    bad('err.message.should.match(/m/);', 'should.exist(err);');
    bad('err.message.should.match(/m/);', 'other.should.be.instanceOf(Error);'); // different subject
});

const FILE = 'packages/concerto-core/test/x.js';
const LINES = [
    'describe(\'X\', () => {',
    '    it(\'throws on bad input\', () => {',
    '        (() => {',
    '            f();',
    '        }).should.throw(IllegalModelException, /bad/);',
    '    });',
    '});',
];
const diff = (o, n) => `diff --git a/f b/f\n@@ -5 +5 @@\n-${o}\n+${n}\n`;

test('listed relaxation passes, unlisted fails', () => {
    const o = '        }).should.throw(IllegalModelException, /bad/);';
    const n = '        }).should.throw(IllegalModelException);';
    const lines = LINES.slice(); lines[4] = n;
    const row = { file: FILE, test: 'throws on bad input', old: o.trim(), new: n.trim(), reason: 'r', used: false };
    assert.deepEqual(checkFileHunks(FILE, parseHunks(diff(o, n)), lines, [row]), []);
    assert.equal(row.used, true);
    assert.equal(checkFileHunks(FILE, parseHunks(diff(o, n)), lines, []).length, 1);
    const wrongTest = { ...row, test: 'another test' };
    assert.equal(checkFileHunks(FILE, parseHunks(diff(o, n)), lines, [wrongTest]).length, 1);
});

test('pure deletions and additions fail', () => {
    const del = 'diff\n@@ -4 +3,0 @@\n-            f();\n';
    assert.equal(checkFileHunks(FILE, parseHunks(del), LINES, []).length, 1);
    const add = 'diff\n@@ -4,0 +5 @@\n+            g();\n';
    assert.equal(checkFileHunks(FILE, parseHunks(add), LINES, []).length, 1);
});

// End to end against a throwaway git repo (never the real test tree).
function scratchRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p509-guard-'));
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q', '-b', 'base');
    g('config', 'user.email', 't@example.com');
    g('config', 'user.name', 't');
    fs.mkdirSync(path.join(dir, 'packages/concerto-core/test'), { recursive: true });
    fs.writeFileSync(path.join(dir, FILE), LINES.join('\n') + '\n');
    g('add', '.');
    g('commit', '-q', '-m', 'base');
    g('checkout', '-q', '-b', 'work');
    return dir;
}
const TREE = (dir, allowListPath) => checkTestTree({ repoRoot: dir, baseRef: 'base', testPrefix: 'packages/concerto-core/test/', allowListPath, log: () => {} });
const edit = (dir, from, to) => {
    const f = path.join(dir, FILE);
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(from, to));
};

test('tree: clean tree passes; listed relaxation passes', () => {
    const dir = scratchRepo();
    const tsv = path.join(dir, 'allow.tsv');
    assert.deepEqual(TREE(dir, tsv), []);
    edit(dir, 'should.throw(IllegalModelException, /bad/)', 'should.throw(IllegalModelException)');
    assert.equal(TREE(dir, tsv).length, 1, 'unlisted relaxation must fail');
    fs.writeFileSync(tsv, 'file\ttest\told_assertion\tnew_assertion\treason\n' +
        `${FILE}\tthrows on bad input\t}).should.throw(IllegalModelException, /bad/);\t}).should.throw(IllegalModelException);\tmessage differs in Rust\n`);
    assert.deepEqual(TREE(dir, tsv), []);
});

test('tree: non-assertion edit, skipped test, deleted and new files fail', () => {
    let dir = scratchRepo();
    edit(dir, 'f();', 'g();');
    assert.match(TREE(dir, path.join(dir, 'none.tsv')).join('\n'), /not a message-assertion relaxation/);
    dir = scratchRepo();
    edit(dir, "it('throws", "it.skip('throws");
    assert.equal(TREE(dir, path.join(dir, 'none.tsv')).length, 1);
    dir = scratchRepo();
    fs.rmSync(path.join(dir, FILE));
    assert.match(TREE(dir, path.join(dir, 'none.tsv')).join('\n'), /deleted/);
    dir = scratchRepo();
    fs.writeFileSync(path.join(dir, 'packages/concerto-core/test/new.js'), 'x\n');
    assert.match(TREE(dir, path.join(dir, 'none.tsv')).join('\n'), /new \(untracked\) test file/);
});
