/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Self-test for the P5-84 v5.0.0 type check (guardrails rule 5).
// Run: node --test migration/api-snapshot/v5-types.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSnapshotTypes, compareTypes, checkAgainstV5, V5_BASELINE } from './v5-types.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const V5 = `// ==== a.d.ts ====
declare class A {
    toURI(): string;
    isEnum(field: any): any;
    names(): string[];
    loose(): any;
    private hidden;
    count: number;
    get size(): number;
    static make(x: string, y?: number): A;
}
export default A;
// ==== b.d.ts ====
export declare function helper(x: string): boolean;
`;

const snap = (body) => V5.replace(/declare class A \{[\s\S]*?\n\}/, `declare class A {\n${body}\n}`);

test('collects public member types, skipping private members', () => {
    const t = collectSnapshotTypes(V5);
    assert.equal(t.get('a.d.ts A.toURI return'), 'string');
    assert.equal(t.get('a.d.ts A.count type'), 'number');
    assert.equal(t.get('a.d.ts A.size get'), 'number');
    assert.equal(t.get('a.d.ts A.make param y'), 'number');
    assert.equal(t.get('b.d.ts <module>.helper return'), 'boolean');
    assert.ok(![...t.keys()].some((k) => k.includes('hidden')));
});

test('an unchanged snapshot has no violations', () => {
    const res = compareTypes(V5, V5);
    assert.deepEqual(res.violations, []);
    assert.ok(res.compared > 5);
});

test('a type that became never is a violation (the P5-02 regression)', () => {
    const cur = snap('    toURI(): never;\n    isEnum(field: any): never;\n    names(): never;\n    loose(): any;\n    count: number;\n    get size(): number;\n    static make(x: string, y?: number): A;');
    const res = compareTypes(V5, cur);
    assert.deepEqual(res.violations.map((v) => [v.key, v.kind]).sort(), [
        ['a.d.ts A.isEnum return', 'never'],
        ['a.d.ts A.names return', 'never'],
        ['a.d.ts A.toURI return', 'never'],
    ]);
});

test('any where v5.0.0 had a concrete type is a violation; any for any is not', () => {
    const cur = snap('    toURI(): string;\n    isEnum(field: any): any;\n    names(): string[];\n    loose(): any;\n    count: any;\n    get size(): number;\n    static make(x: any, y?: number): A;');
    const res = compareTypes(V5, cur);
    assert.deepEqual(res.violations.map((v) => [v.key, v.kind]).sort(), [
        ['a.d.ts A.count type', 'any'],
        ['a.d.ts A.make param x', 'any'],
    ]);
});

test('narrowing and other changes are not this check\'s business', () => {
    const cur = snap('    toURI(): string;\n    isEnum(field: any): boolean;\n    names(): readonly string[];\n    loose(): string;\n    count: number;\n    get size(): number;\n    static make(x: string, y?: number): A;');
    assert.deepEqual(compareTypes(V5, cur).violations, []);
});

test('an allow-list row with matching types suppresses a violation; a stale row is reported', () => {
    const cur = snap('    toURI(): never;\n    isEnum(field: any): any;\n    names(): string[];\n    loose(): any;\n    count: number;\n    get size(): number;\n    static make(x: string, y?: number): A;');
    const allow = new Map([
        ['a.d.ts A.toURI return', { v5: 'string', cur: 'never', bc: 'BC-99' }],
        ['a.d.ts A.gone return', { v5: 'string', cur: 'never', bc: 'BC-99' }],
    ]);
    const res = compareTypes(V5, cur, allow);
    assert.deepEqual(res.violations, []);
    assert.deepEqual(res.allowed.map((a) => a.key), ['a.d.ts A.toURI return']);
    assert.deepEqual(res.staleAllow, ['a.d.ts A.gone return']);
    // A row whose types do not match the finding does not suppress it.
    const wrong = new Map([['a.d.ts A.toURI return', { v5: 'string', cur: 'any', bc: 'BC-99' }]]);
    assert.equal(compareTypes(V5, cur, wrong).violations.length, 1);
});

test('the committed snapshot passes against the committed v5.0.0 baseline', () => {
    assert.ok(fs.existsSync(V5_BASELINE));
    const { failures } = checkAgainstV5(fs.readFileSync(path.join(__dirname, 'full-api.d.ts'), 'utf8'));
    assert.deepEqual(failures, []);
});
