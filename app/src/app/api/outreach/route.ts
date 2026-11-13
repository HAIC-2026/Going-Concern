import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { calcSnap, type OutreachCache, type GeoSnap, type Chamber } from "@/lib/outreach";

export const runtime = "nodejs";
const ROOT = "https://api.census.gov/data";
const REQUIRED = ["S2201_C01_021E","S2201_C01_021M","S2201_C03_021E","S2201_C03_021M","S2201_C05_021E","S2201_C05_021M"];
const GEO = {House:"state legislative district (lower chamber)",Senate:"state legislative district (upper chamber)"} as const;
const COUNTY_NAMES:Record<string,string>={"001":"Hawaiʻi County","003":"Honolulu County","005":"Kalawao County","007":"Kauaʻi County","009":"Maui County"};
// Office of Elections, 2022 post-reapportionment district plans. See README-OUTREACH.md.
export function countyFor(chamber:Chamber,d:number):string {
 if(chamber==="House")return d<=8?"001":d<=14?"009":d<=17?"007":"003";
 return d<=4?"001":d<=7?"009":d===8?"007":"003";
}
const numeric=(value:unknown):number|null=>{
 if(value==null||value===""||value==="-"||value==="**"||value==="N")return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0&&n<1e9?n:null;
};
async function getJson(url:string):Promise<unknown>{
 const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error("Census API "+r.status+" ("+url.split("?")[0]+")");
 return r.json();
}
export async function discoverVintage(){
 // Do not infer that a calendar year has published ACS data. Probe newest subject metadata.
 const latest=new Date().getUTCFullYear();
 for(let year=latest;year>=2024;year--){
   try{
     const meta=await getJson(`${ROOT}/${year}/acs/acs5/subject/groups/S2201.json`) as {variables?:Record<string,{label?:string}>};
     const vars=meta.variables??{};
     if(REQUIRED.every(id=>typeof vars[id]?.label==="string" &&
       vars[id].label!.includes("Below poverty level")))return year;
   }catch{/* next published vintage */}
 }
 throw Error("No verified ACS five-year S2201 vintage from 2024 onward");
}
async function censusRows(year:number,geo:string,extra:string) {
 const q=new URLSearchParams({get:["NAME",...REQUIRED].join(","),for:geo});
 if(extra)q.set("in",extra);
 const key=process.env.CENSUS_API_KEY?.trim();if(key)q.set("key",key);
 const rows=await getJson(`${ROOT}/${year}/acs/acs5/subject?${q}`) as unknown;
 if(!Array.isArray(rows)||!Array.isArray(rows[0]))throw Error("Invalid Census table");
 const header=rows[0] as string[];
 return rows.slice(1).filter(Array.isArray).map(r=>Object.fromEntries(header.map((h,i)=>[h,(r as unknown[])[i]]))) as Array<Record<string,unknown>>;
}
function normalize(row:Record<string,unknown>,kind:GeoSnap["kind"],code:string,year:number,chamber?:Chamber):GeoSnap {
 const entry=(prefix:string)=>({
  id:prefix+"E",estimate:numeric(row[prefix+"E"]),moe:numeric(row[prefix+"M"])
 });
 return {
  name:String(row.NAME??"Unknown"),kind,code,chamber,
  countyCode:kind==="district"&&chamber?countyFor(chamber,Number(code)):kind==="county"?code:null,
  snap:{
   total:entry("S2201_C01_021"),receiving:entry("S2201_C03_021"),notReceiving:entry("S2201_C05_021")
  }
 };
}
export async function pullOutreach():Promise<OutreachCache>{
 const vintage=await discoverVintage();
 const [h,s,counties,state]=await Promise.all([
  censusRows(vintage,GEO.House+":*","state:15"),
  censusRows(vintage,GEO.Senate+":*","state:15"),
  censusRows(vintage,"county:*","state:15"),
  censusRows(vintage,"state:15","")
 ]);
 const districts=[
  ...h.map(row=>normalize(row,"district",String(Number(row[GEO.House]??"")),vintage,"House")),
  ...s.map(row=>normalize(row,"district",String(Number(row[GEO.Senate]??"")),vintage,"Senate"))
 ];
 const countyEntries=counties.map(row=>normalize(row,"county",String(row.county??""),vintage));
 if(h.length!==51||s.length!==25)throw Error(`Unexpected district counts: ${h.length} House, ${s.length} Senate`);
 if(countyEntries.length<4||state.length!==1||["001","003","007","009"].some(c=>!countyEntries.some(x=>x.code===c)))throw Error("Missing state or principal county rows");
 const result:OutreachCache={vintage,dataset:"ACS 5-Year Subject S2201",geographyVintage:"2022 legislative reapportionment geography",fetchedAt:new Date().toISOString(),
   districts,counties:countyEntries,state:normalize(state[0],"state","15",vintage),
   validations:{metadataVerified:true,districtCounts:{House:h.length,Senate:s.length},
      countyMappingMethod:"Office of Elections 2022 district allocation; House 1–8 Hawaiʻi, 9–14 Maui, 15–17 Kauaʻi, 18–51 Honolulu; Senate 1–4 Hawaiʻi, 5–7 Maui, 8 Kauaʻi, 9–25 Honolulu."}};
 return result;
}
async function cached():Promise<OutreachCache|null>{
 try{const raw=await readFile(join(process.cwd(),"src","data","outreach-cache.json"),"utf8");
 const parsed=JSON.parse(raw) as OutreachCache;
 if(parsed?.validations?.metadataVerified&&parsed.districts.length===76)return parsed;
 }catch{/* cache has not yet been generated */}
 return null;
}
export async function GET(request:NextRequest){
 const chamber=request.nextUrl.searchParams.get("chamber")??"House";
 if(chamber!=="House"&&chamber!=="Senate")return NextResponse.json({error:"Invalid chamber"},{status:400});
 try{
  const dataset=await cached()??await pullOutreach();
  const districts=dataset.districts.filter(d=>d.chamber===chamber).map(d=>{
   const county=dataset.counties.find(c=>c.code===d.countyCode);
   return {district:d.code,name:d.name,countyCode:d.countyCode,countyName:county?.name??"Unavailable",
      districtStats:calcSnap(d,dataset.vintage),countyStats:county?calcSnap(county,dataset.vintage):null,
      stateStats:calcSnap(dataset.state,dataset.vintage)};
  });
  return NextResponse.json({vintage:dataset.vintage,fetchedAt:dataset.fetchedAt,cached:Boolean(await cached()),districts,
   geographicBasis:dataset.geographyVintage,
   caveat:"S2201 measures below-poverty households not receiving SNAP. It does not establish eligibility or administrative enrollment counts. County/state overlap with districts; comparison differences are descriptive.",
   method:dataset.validations.countyMappingMethod});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Data unavailable; no estimates were fabricated"},{status:503})}
}
