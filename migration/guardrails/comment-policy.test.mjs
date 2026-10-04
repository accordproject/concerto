// Self-test of the comment policy guard (comment-policy.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { commentLines, scanText } from './comment-policy.mjs';

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
    assert.deepEqual(matches('// a two-digit #12 or a colour #fff\n', 'ts'), []);
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
