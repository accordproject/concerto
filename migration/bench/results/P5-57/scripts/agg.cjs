// P5-57: aggregate the three timed rounds (median of per-round medians).
'use strict';
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2];
const SETS = ['synthetic-large', 'conformance', 'concerto-core-test-data'];
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rd = f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const f2 = x => x.toFixed(2);
const lines = [];
lines.push('TS API ms, DecoratorManager.extractDecorators (per-round medians -> median of 3)');
const labels = ['ts', 'engine-base', 'engine-new', 'percall-base', 'percall-new'];
for (const set of SETS) {
    lines.push(set); const m = {};
    for (const l of labels) {
        const v = [1, 2, 3].map(r => rd(`r${r}/sweep-${l}.json`).results.find(x => x.set === set).median_ms);
        m[l] = med(v); lines.push(`  ${l} ${v.map(x => x.toFixed(1)).join('/')} => ${f2(m[l])}`);
    }
    const r = k => (m[k] / m.ts).toFixed(2) + 'x';
    lines.push(`  ratios vs TS: resident base ${r('engine-base')} new ${r('engine-new')}; percall base ${r('percall-base')} new ${r('percall-new')}`);
    lines.push(`  new/base: resident ${(m['engine-new'] / m['engine-base']).toFixed(3)}; percall ${(m['percall-new'] / m['percall-base']).toFixed(3)}`);
}
lines.push('');
lines.push('native p557-native, DCS extract (ExtractAll, locale en) incl. JSON encode, ms (median_us per round -> median of 3), Value route -> direct encoding');
for (const set of SETS) {
    const rs = [1, 2, 3].map(r => rd(`r${r}/native-${set}.json`));
    lines.push(`${set} (commands ${rs[0].commands}, identity checked ${rs[0].identity_checked})`);
    for (const flag of ['false', 'true']) {
        const v = rs.map(x => x[`value_${flag}`].median_us / 1000), d = rs.map(x => x[`direct_${flag}`].median_us / 1000);
        const vm = med(v), dm = med(d);
        lines.push(`  removeDecoratorsFromModel=${flag}: value ${v.map(f2).join('/')} => ${f2(vm)}; direct ${d.map(f2).join('/')} => ${f2(dm)}; delta ${f2(dm - vm)} ms, ratio ${(dm / vm).toFixed(3)}`);
    }
}
process.stdout.write(lines.join('\n') + '\n');
