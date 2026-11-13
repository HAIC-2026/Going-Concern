// Run from app/: node scripts/refresh-outreach.mjs
// This generates a checked-in data snapshot so public demos do not require Census uptime.
import {writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
const BASE="https://api.census.gov/data";
const FIELDS=["S2201_C01_021E","S2201_C01_021M","S2201_C03_021E","S2201_C03_021M","S2201_C05_021E","S2201_C05_021M"];
const GEO={House:"state legislative district (lower chamber)",Senate:"state legislative district (upper chamber)"};
const countyFor=(c,n)=>c==="House"?(n<=8?"001":n<=14?"009":n<=17?"007":"003"):(n<=4?"001":n<=7?"009":n===8?"007":"003");
const valid=v=>{const n=Number(v);return v==null||v===""||!Number.isFinite(n)||n<0?null:n};
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(35000)});if(!r.ok)throw Error(url+" HTTP "+r.status);return r.json()}
async function vintage(){for(let y=new Date().getUTCFullYear();y>=2024;y--){try{
 const m=await json(`${BASE}/${y}/acs/acs5/subject/groups/S2201.json`);
 if(FIELDS.every(f=>m.variables?.[f]?.label?.includes("Below poverty level")))return y;
}catch{}}throw Error("No verified ACS S2201 vintage found")}
async function rows(year,geo,inside){const qs=new URLSearchParams({get:["NAME",...FIELDS].join(","),for:geo});if(inside)qs.set("in",inside);if(process.env.CENSUS_API_KEY)qs.set("key",process.env.CENSUS_API_KEY);
 const a=await json(`${BASE}/${year}/acs/acs5/subject?${qs}`);const [h,...r]=a;
 return r.map(v=>Object.fromEntries(h.map((key,i)=>[key,v[i]])))}
function one(r,kind,code,chamber){const e=p=>({id:p+"E",estimate:valid(r[p+"E"]),moe:valid(r[p+"M"])});return {
 name:r.NAME,code,kind,...(chamber?{chamber,countyCode:countyFor(chamber,Number(code))}:kind==="county"?{countyCode:code}:{}),
 snap:{total:e("S2201_C01_021"),receiving:e("S2201_C03_021"),notReceiving:e("S2201_C05_021")}
 }}
const year=await vintage();console.log("Verified ACS vintage",year);
const [house,senate,counties,state]=await Promise.all([
 rows(year,GEO.House+":*","state:15"),rows(year,GEO.Senate+":*","state:15"),rows(year,"county:*","state:15"),rows(year,"state:15","")
]);
if(house.length!==51||senate.length!==25||counties.length!==4||state.length!==1)throw Error("Unexpected geographic row counts");
const districts=[...house.map(r=>one(r,"district",String(Number(r[GEO.House])),"House")),...senate.map(r=>one(r,"district",String(Number(r[GEO.Senate])),"Senate"))];
const snapshot={vintage:year,fetchedAt:new Date().toISOString(),dataset:"ACS 5-Year Subject S2201",geographyVintage:"2022 legislative reapportionment geography",
 state:one(state[0],"state","15"),counties:counties.map(r=>one(r,"county",r.county)),districts,
 validations:{metadataVerified:true,districtCounts:{House:51,Senate:25},countyMappingMethod:"Office of Elections 2022 district allocation; House 1–8 Hawaiʻi, 9–14 Maui, 15–17 Kauaʻi, 18–51 Honolulu; Senate 1–4 Hawaiʻi, 5–7 Maui, 8 Kauaʻi, 9–25 Honolulu."}};
const dest=path.join(process.cwd(),"src","data","outreach-cache.json");await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(snapshot,null,2)+"\n");console.log("Saved",dest,"districts:",snapshot.districts.length);
