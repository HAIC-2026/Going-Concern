// Run from app/: node scripts/test-outreach.mjs [House|Senate] [district number]
// Compares locally cached raw values and computed SNAP rate to a fresh Census API request.
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
const chamber=process.argv[2]??"House",district=Number(process.argv[3]??"5");
assert.ok(["House","Senate"].includes(chamber),"Chamber must be House or Senate");
assert.ok(Number.isInteger(district)&&district>=1&&district<=(chamber==="House"?51:25),"Invalid district");
const cache=JSON.parse(await readFile(path.join(process.cwd(),"src","data","outreach-cache.json"),"utf8"));
const row=cache.districts.find(d=>d.chamber===chamber&&Number(d.code)===district);
assert.ok(row,"Cached district missing");
assert.equal(cache.districts.length,76,"Expected 76 districts");
const geo=`state legislative district (${chamber==="House"?"lower":"upper"} chamber)`;
const qs=new URLSearchParams({get:"NAME,S2201_C01_021E,S2201_C03_021E,S2201_C05_021E",for:`${geo}:${String(district).padStart(3,"0")}`,in:"state:15"});
if(process.env.CENSUS_API_KEY)qs.set("key",process.env.CENSUS_API_KEY);
const url=`https://api.census.gov/data/${cache.vintage}/acs/acs5/subject?${qs}`;
const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!r.ok)throw Error("Census source returned "+r.status);
const [headers,values]=await r.json();
const lookup=Object.fromEntries(headers.map((k,i)=>[k,values[i]]));
const pair=[["total","S2201_C01_021E"],["receiving","S2201_C03_021E"],["notReceiving","S2201_C05_021E"]];
for(const [type,id] of pair){
 const original=Number(lookup[id]),saved=row.snap[type].estimate;
 assert.equal(saved,original,`Mismatch ${id}: cache ${saved}, live ${original}`);
}
const total=row.snap.total.estimate,receiving=row.snap.receiving.estimate,gap=row.snap.notReceiving.estimate;
assert.ok(total===null||receiving===null||gap===null||Math.abs(total-receiving-gap)<=2,"SNAP components do not approximately reconcile");
const rate=total>0?100*receiving/total:null;
const moe=row.snap.notReceiving.moe;
const cv=gap>0&&moe!=null?moe/1.645/gap:null;
console.log(`${chamber} District ${district} · ${cache.vintage} ACS S2201 verified against live Census`);
console.log({belowPovertyHouseholds:total,receiving,gap,participationRatePct:rate,gapMOE90:moe,gapCV:cv,highUncertainty:cv!==null&&cv>0.3});
console.log("PASS: exact raw-estimate tie-out; MOE/CV values require the cached published MOE columns.");
