#!/bin/sh
# Supplementary: TS-API validate only, before/now interleaved, 6 rounds, to
# resolve the bimodal validate rows of the 3-round sweep.
W=/home/user/wt/P5-88
cd $W/concerto
OUT=migration/bench/results/P5-88/validate-recheck
for r in 1 2 3 4 5 6; do
  if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
  for side in $ORDER; do
    echo "round $r $side load $(cut -d' ' -f1-3 /proc/loadavg)"
    case $side in
      before) CONCERTO_ENGINE_MODULE=$W/base/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs node migration/bench/p515-sweep.mjs --core-dist $W/concerto/packages/concerto-core/dist --ops validate --samples 30 --warmup 5 --out $OUT/before-$r.json > $OUT/before-$r.log 2>&1 ;;
      now) node migration/bench/p515-sweep.mjs --ops validate --samples 30 --warmup 5 --out $OUT/now-$r.json > $OUT/now-$r.log 2>&1 ;;
    esac
  done
done
node -e '
const fs=require("fs"),d=process.argv[1];
const med=a=>{a=[...a].sort((x,y)=>x-y);const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
const v={};
for(const s of ["before","now"])for(let r=1;r<=6;r++){const j=JSON.parse(fs.readFileSync(`${d}/${s}-${r}.json`));for(const x of j.results.filter(x=>x.op==="validate")){(v[x.set]??={})[s]??=[];v[x.set][s].push(x.medianUs)}}
for(const [set,o] of Object.entries(v)){console.log(set,"before",o.before.map(x=>x.toFixed(1)).join("/"),"now",o.now.map(x=>x.toFixed(1)).join("/"),"median before",med(o.before).toFixed(2),"now",med(o.now).toFixed(2),"now/before",((med(o.now)/med(o.before)-1)*100).toFixed(1)+"%")}
' $OUT | tee $OUT/summary.txt
