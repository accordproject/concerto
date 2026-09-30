// P5-55: aggregate the three timed rounds (median of per-round medians).
'use strict';
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2];
const SETS = ['synthetic-large', 'conformance', 'concerto-core-test-data'];
const OPS = [['extract_cold', 'cold'], ['extract_decorators', 'warm']];
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rd = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const f2 = x => x.toFixed(2);
const labels = ['ts', 'before', 'new'];
const lines = ['TS API ms, DecoratorManager.extractDecorators (removeDecoratorsFromModel, en), per-round medians -> median of 3'];
const m = {};
for (const set of SETS) {
    lines.push(set);
    for (const [op, name] of OPS) {
        const k = `${set}/${op}`; m[k] = {};
        for (const l of labels) {
            const v = [1, 2, 3].map(r => rd(`r${r}/sweep-${l}.json`).results.find(x => x.set === set && x.op === op).median_ms);
            m[k][l] = med(v);
            lines.push(`  ${name} ${l} ${v.map(f2).join('/')} => ${f2(m[k][l])}`);
        }
        const x = m[k];
        lines.push(`  ${name}: new - before ${f2(x.new - x.before)} ms (new/before ${(x.new / x.before).toFixed(3)}); vs TS before ${(x.before / x.ts).toFixed(2)}x new ${(x.new / x.ts).toFixed(2)}x`);
    }
    const c = m[`${set}/extract_cold`], w = m[`${set}/extract_decorators`];
    lines.push(`  cold/warm: ts ${(c.ts / w.ts).toFixed(2)}, before ${(c.before / w.before).toFixed(2)}, new ${(c.new / w.new).toFixed(2)}`);
}
process.stdout.write(lines.join('\n') + '\n');
