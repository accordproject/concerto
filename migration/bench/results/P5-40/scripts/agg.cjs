// P5-40: medians over the three rounds of each round's median (as P5-41's agg.cjs).
const fs=require('fs');const p=require('path');const D=process.env.P540_OUT||'/home/user/wt/P5-40/p540/out';
const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
const sets=['synthetic-large','conformance','concerto-core-test-data'];
const R=[1,2,3];const j=f=>JSON.parse(fs.readFileSync(p.join(D,f)));
const L=['ts','engine-base','engine-new','percall-base','percall-new'];
const sw={};for(const l of L)for(const s of sets){sw[l+'|'+s]=R.map(r=>j(`r${r}/sweep-${l}.json`).results.find(x=>x.set===s).medianUs/1000);}
console.log('TS API ms, DecoratorManager.extractDecorators (per-round medians -> median of 3)');
for(const s of sets){console.log(s);for(const l of L){const v=sw[l+'|'+s];console.log(`  ${l} ${v.map(x=>x.toFixed(1)).join('/')} => ${med(v).toFixed(2)}`)}
const ts=med(sw['ts|'+s]);const r=l=>(med(sw[l+'|'+s])/ts).toFixed(2);console.log(`  ratios vs TS: resident base ${r('engine-base')}x new ${r('engine-new')}x; percall base ${r('percall-base')}x new ${r('percall-new')}x`);}
console.log('\nbinding decoratorManagerExtractDecorators from JS (run-wasm), ms');
for(const s of sets)for(const e of ['base','new']){const v=R.map(r=>j(`r${r}/binding-${e}-${s}.json`));console.log(`  ${s} ${e}: ${v.map(x=>(x.engineBinding.medianUs/1000).toFixed(1)).join('/')} => ${(med(v.map(x=>x.engineBinding.medianUs))/1000).toFixed(2)}`)}
const ST=['parse','rebuild','extract','encode','drop','total'];
console.log('\nnative spike stages, ms (median of 3 rounds), base -> new');
for(const n of ['glibc','dlmalloc'])for(const s of sets){const f=m=>R.map(r=>j(`r${r}/native-${n}-${m}-${s}.json`));const o=f('base'),d=f('new');
console.log(`  ${n} ${s}: `+ST.map(k=>`${k} ${(med(o.map(x=>x[k].medianUs))/1000).toFixed(2)} -> ${(med(d.map(x=>x[k].medianUs))/1000).toFixed(2)}`).join('; '))}
console.log('\ncount-alloc per stage (r1), base -> new: allocs (bytes)');
for(const s of sets){const b=j(`r1/count-alloc-base-${s}.json`),n=j(`r1/count-alloc-new-${s}.json`);
console.log(`  ${s}: `+['rebuild','extract','encode','drop'].map(k=>`${k} ${b[k].allocs} -> ${n[k].allocs} (${(b[k].bytes/1e6).toFixed(2)} -> ${(n[k].bytes/1e6).toFixed(2)} MB)`).join('; '))}
console.log('\nWASM spike stages (shipped settings), ms (median of 3 rounds), base -> new');
const WS=['parse','rebuild','extract','encode','drop','wasmStagesTotal'];
for(const s of sets){if(!fs.existsSync(p.join(D,`r1/wasm-stages-base-${s}.json`)))continue;const f=m=>R.map(r=>j(`r${r}/wasm-stages-${m}-${s}.json`));const o=f('base'),d=f('new');
console.log(`  ${s}: `+WS.map(k=>`${k} ${(med(o.map(x=>x[k].medianUs))/1000).toFixed(2)} -> ${(med(d.map(x=>x[k].medianUs))/1000).toFixed(2)}`).join('; '));
console.log(`    extract per round: base ${o.map(x=>(x.extract.medianUs/1000).toFixed(2)).join('/')} new ${d.map(x=>(x.extract.medianUs/1000).toFixed(2)).join('/')}`)}
