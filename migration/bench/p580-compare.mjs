// P5-80 (accordproject/concerto-rust#424), analysis only: joins the
// plan-off and plan-on p515 reports and the cold/mem TSVs into the
// issue's comparison tables.
//   node migration/bench/p580-compare.mjs <results/P5-80 dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const here = path.dirname(new URL(import.meta.url).pathname);
const rep = (side) => JSON.parse(execFileSync('node', [path.join(here, 'p515-report.mjs'), path.join(dir, 'sweep', side), '--json'], { encoding: 'utf8' })).rows;
const off = rep('plan-off'), on = rep('plan-on');
const key = (r) => `${r.op}|${r.set}`;
const onBy = new Map(on.map((r) => [key(r), r]));
const fmt = (us) => us == null ? '-' : us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${us.toFixed(us < 10 ? 2 : 1)} us`;
const pct = (a, b) => a == null || b == null ? '-' : `${((b / a - 1) * 100).toFixed(1)}%`;
const order = ['from_json', 'to_json', 'validate', 'new_resource', 'set_property_value', 'add_array_value', 'mm_new', 'modelfile_new', 'dcs_decorate'];
const sets = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const out = [];
out.push('| op | set | TS 5.0.0 | crate off | crate on | crate on/off | TS-API off | TS-API on | TS-API on/off |');
out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|');
for (const op of order) for (const set of sets) {
  const a = off.find((r) => r.op === op && r.set === set); const b = onBy.get(`${op}|${set}`);
  if (!a || !b) continue;
  out.push(`| ${op} | ${set} | ${fmt(a.tsRefUs)} | ${fmt(a.crateUs)} | ${fmt(b.crateUs)} | ${pct(a.crateUs, b.crateUs)} | ${fmt(a.rustApiUs)} | ${fmt(b.rustApiUs)} | ${pct(a.rustApiUs, b.rustApiUs)} |`);
}
// Cold: median over repetitions of the first pass on a fresh manager.
const cold = new Map();
for (const line of fs.readFileSync(path.join(dir, 'cold.tsv'), 'utf8').trim().split('\n')) {
  const [op, set, plan, , c, w] = line.split('\t');
  const k = `${op}|${set}|${plan}`; if (!cold.has(k)) cold.set(k, { c: [], w: [] });
  cold.get(k).c.push(+c.split('=')[1]); cold.get(k).w.push(+w.split('=')[1]);
}
const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[s.length >> 1]; };
out.push('', '| op | set | first pass off | first pass on | on/off | second pass off | second pass on | on/off |', '|---|---|---:|---:|---:|---:|---:|---:|');
for (const op of order) for (const set of sets) {
  const a = cold.get(`${op}|${set}|plan=false`), b = cold.get(`${op}|${set}|plan=true`);
  if (!a || !b) continue;
  out.push(`| ${op} | ${set} | ${fmt(med(a.c))} | ${fmt(med(b.c))} | ${pct(med(a.c), med(b.c))} | ${fmt(med(a.w))} | ${fmt(med(b.w))} | ${pct(med(a.w), med(b.w))} |`);
}
console.log(out.join('\n'));
