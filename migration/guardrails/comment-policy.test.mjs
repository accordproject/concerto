// Self-test of the comment policy guard (comment-policy.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCommentPolicy, commentLines, scanText } from './comment-policy.mjs';

const matches = (text, lang) => scanText(text, lang).map((v) => v.match);

test('a task id in a comment is a violation', () => {
    assert.deepEqual(matches('// done in P5-105\nconst a = 1;\n', 'ts'), ['P5-105']);
    assert.deepEqual(matches('/// see P2-09b\nfn f() {}\n', 'rs'), ['P2-09b']);
    assert.deepEqual(matches('/**\n * (P4-08)\n */\n', 'ts'), ['P4-08']);
});

test('a bare or concerto-rust issue number in a comment is a violation', () => {
    assert.deepEqual(matches('// see #459\n', 'ts'), ['#459']);
    assert.deepEqual(matches('// accordproject/concerto-rust#459\n', 'rs'), ['concerto-rust#459']);
});

test('BC and DV rows and full-form upstream links are allowed', () => {
    assert.deepEqual(matches('// BC-11, DV-013, accordproject/concerto#1273\n', 'rs'), []);
    assert.deepEqual(matches('// a colour #fff or #123abc, an attribute #[derive(Debug)]\n', 'ts'), []);
    assert.deepEqual(matches('// https://github.com/accordproject/concerto/pull/1514\n', 'rs'), []);
});

test('a bare issue number of any length is a violation', () => {
    assert.deepEqual(matches('// see #3 and #32\n', 'ts'), ['#3', '#32']);
    assert.deepEqual(matches('//! which #32 point 4 moves\n', 'rs'), ['#32']);
    assert.deepEqual(matches('// see #12345\n', 'rs'), ['#12345']);
});

test('a concerto-rust issue or PR URL is a violation', () => {
    assert.deepEqual(matches('// https://github.com/accordproject/concerto-rust/pull/481\n', 'ts'), ['concerto-rust/pull/481']);
    assert.deepEqual(matches('/// concerto-rust/issues/32\n', 'rs'), ['concerto-rust/issues/32']);
});

test('a short cross-repo issue number is a violation; the full form is not', () => {
    assert.deepEqual(matches('// see concerto#1514\n', 'rs'), ['concerto#1514']);
    assert.deepEqual(matches('// (concerto#1514)\n', 'ts'), ['concerto#1514']);
    assert.deepEqual(matches('// accordproject/concerto#1514\n', 'ts'), []);
});

test('raw byte and C strings end at their closing quote', () => {
    assert.deepEqual(matches('let p = br"C:\\";\n// P5-999\n', 'rs'), ['P5-999']);
    assert.deepEqual(matches('let p = cr"a\\"; // P1-01\n', 'rs'), ['P1-01']);
    assert.deepEqual(matches('let p = br#"x"y"#; // #45\n', 'rs'), ['#45']);
    assert.deepEqual(matches('let p = br"P5-999";\n', 'rs'), []);
});

test('a #[doc = "..."] attribute is checked as a doc comment', () => {
    assert.deepEqual(matches('#[doc = "P5-1"]\nfn f() {}\n', 'rs'), ['P5-1']);
    assert.deepEqual(matches('#![doc = r"see #12"]\n', 'rs'), ['#12']);
    assert.deepEqual(matches('#[cfg(doc)]\nconst S: &str = "P5-1";\n', 'rs'), []);
});

test('string literals, template literals and regexes are not comments', () => {
    assert.deepEqual(matches('const s = "P5-105 #459";\nconst t = `P1-01 ${x} #123`;\nconst r = /#\\d{3}/;\n', 'ts'), []);
    assert.deepEqual(matches('let s = "// P5-105";\nlet r = r#"#459 /* P1-01 */"#;\nlet c = \'"\';\n', 'rs'), []);
});

test('Rust block comments nest', () => {
    const lines = commentLines('/* a /* b */ P1-01 */\nfn f() {}\n', 'rs');
    assert.equal(lines.length, 1);
    assert.deepEqual(matches('/* a /* b */ P1-01 */\nfn f() {}\n', 'rs'), ['P1-01']);
});

test('a violation reports its line', () => {
    const [v] = scanText('const a = 1;\n\n// P3-02\n', 'ts');
    assert.equal(v.line, 3);
});

test('rustOnly checks only the concerto-rust checkout', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-policy-'));
    const repo = path.join(tmp, 'concerto');
    const rust = path.join(tmp, 'concerto-rust');
    fs.mkdirSync(path.join(repo, 'packages/concerto-core/src'), { recursive: true });
    fs.mkdirSync(path.join(rust, 'concerto-core/src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'packages/concerto-core/src/a.ts'), '// P1-01\n');
    fs.writeFileSync(path.join(rust, 'concerto-core/src/lib.rs'), '// P2-02\n');
    try {
        assert.equal(checkCommentPolicy(repo, rust).length, 2);
        assert.deepEqual(checkCommentPolicy(repo, rust, { rustOnly: true }), [`${path.join('concerto-core', 'src', 'lib.rs')}:1: task id 'P2-02': // P2-02`]);
        assert.throws(() => checkCommentPolicy(repo, undefined, { rustOnly: true }));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
