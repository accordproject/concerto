const fs=require('fs');const p=require('path');const D=process.env.P541_OUT||__dirname+'/out';
const med=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
const sets=['synthetic-large','conformance','concerto-core-test-data'];
const R=[1,2,3];const j=f=>JSON.parse(fs.readFileSync(p.join(D,f)));
const sw={};for(const l of ['ts','engine-base','engine-new','percall-base','percall-new'])for(const s of sets){sw[l+'|'+s]=R.map(r=>j(`r${r}/sweep-${l}.json`).results.find(x=>x.set===s).medianUs/1000);}
console.log('TS API ms (per-round medians -> median of 3)');
for(const s of sets){const row=['ts','engine-base','engine-new','percall-base','percall-new'].map(l=>{const v=sw[l+'|'+s];return `${l} ${v.map(x=>x.toFixed(1)).join('/')} => ${med(v).toFixed(2)}`});console.log(s);row.forEach(x=>console.log('  '+x));
const ts=med(sw['ts|'+s]);console.log(`  ratios vs TS: resident base ${(med(sw['engine-base|'+s])/ts).toFixed(2)}x new ${(med(sw['engine-new|'+s])/ts).toFixed(2)}x; percall base ${(med(sw['percall-base|'+s])/ts).toFixed(2)}x new ${(med(sw['percall-new|'+s])/ts).toFixed(2)}x`);}
console.log('\nbinding (run-wasm) median ms of 3 rounds: engineBinding / engineJsonStringify');
for(const s of sets)for(const e of ['base','new']){const v=R.map(r=>j(`r${r}/binding-${e}-${s}.json`));console.log(`  ${s} ${e}: binding ${v.map(x=>(x.engineBinding.medianUs/1000).toFixed(1)).join('/')} => ${(med(v.map(x=>x.engineBinding.medianUs))/1000).toFixed(2)}; stringify ${(med(v.map(x=>x.engineJsonStringify.medianUs))/1000).toFixed(2)}`)}
console.log('\nnative encode stage ms (median of 3 rounds)');
for(const n of ['glibc','dlmalloc'])for(const s of sets){const f=m=>R.map(r=>j(`r${r}/native-${n}-${m}-${s}.json`));const o=f('old'),d=f('direct');
console.log(`  ${n} ${s}: encode old ${(med(o.map(x=>x.encode.medianUs))/1000).toFixed(2)} direct ${(med(d.map(x=>x.encode.medianUs))/1000).toFixed(2)}; drop old ${(med(o.map(x=>x.drop.medianUs))/1000).toFixed(2)} direct ${(med(d.map(x=>x.drop.medianUs))/1000).toFixed(2)}; total old ${(med(o.map(x=>x.total.medianUs))/1000).toFixed(2)} direct ${(med(d.map(x=>x.total.medianUs))/1000).toFixed(2)}`)}
console.log('\ncount-alloc encode stage (r1)');
for(const s of sets)for(const m of ['old','direct']){const x=j(`r1/count-alloc-${m}-${s}.json`);console.log(`  ${s} ${m}: allocs ${x.encode.allocs} reallocs ${x.encode.reallocs} bytes ${x.encode.bytes}`)}
