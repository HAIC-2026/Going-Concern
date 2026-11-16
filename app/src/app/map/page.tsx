"use client";
import {useEffect,useState} from "react";
import dynamic from "next/dynamic";
import WorkspaceShell from "@/components/WorkspaceShell";
import Link from "next/link";
import styles from "./map.module.css";
type Chamber="House"|"Senate";
type Metric="boundaries"|"population"|"income"|"povertyRate"|"unemploymentRate"|"medianHomeValue"|"medianGrossRent"|"bachelorsOrHigherRate";
type MetricValues={population:number|null;povertyRate:number|null;unemploymentRate:number|null;medianHomeValue:number|null;medianGrossRent:number|null;bachelorsOrHigherRate:number|null;income:number|null};
type District={district:string;name:string;population:number|null;medianHouseholdIncome:number|null;povertyRate:number|null;unemploymentRate:number|null;medianHomeValue:number|null;medianGrossRent:number|null;bachelorsOrHigherRate:number|null};
const HawaiiMap=dynamic(()=>import("@/components/HawaiiMap"),{ssr:false,loading:()=> <div className={styles.loading}>Loading district boundaries…</div>});
const layers:{id:Metric;label:string}[]=[
 {id:"boundaries",label:"District boundaries"},{id:"population",label:"Population"},{id:"income",label:"Median household income"},{id:"povertyRate",label:"Poverty rate"},{id:"unemploymentRate",label:"Unemployment rate"},{id:"medianHomeValue",label:"Median home value"},{id:"medianGrossRent",label:"Median gross rent"},{id:"bachelorsOrHigherRate",label:"Bachelor's degree or higher"}
];
const n=(v:number|null|undefined,dollars=false)=>v==null?"Not available":(dollars?"$":"")+v.toLocaleString("en-US",{maximumFractionDigits:1});
export default function MapPage(){
 const [theme,setTheme]=useState<"night"|"day">("night");
 const [chamber,setChamber]=useState<Chamber>("House");
 const [layer,setLayer]=useState<Metric>("boundaries");
 const [filters,setFilters]=useState(true);
 const [rows,setRows]=useState<District[]>([]);
 const [selected,setSelected]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{try{setTheme(localStorage.getItem("gc-color-mode")==="day"?"day":"night");const p=JSON.parse(localStorage.getItem("gc-demo-profile")||"null");if(p?.chamber==="House"||p?.chamber==="Senate")setChamber(p.chamber)}catch{}},[]);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");
  fetch("/api/census?chamber="+chamber,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Census data unavailable");return d as {districts:District[]}}).then(d=>setRows(d.districts))
   .catch(e=>{if(!c.signal.aborted){setRows([]);setError(String(e))}}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
  return()=>c.abort();
 },[chamber]);
 const values=Object.fromEntries(rows.map(d=>[d.district,{population:d.population,income:d.medianHouseholdIncome,povertyRate:d.povertyRate,unemploymentRate:d.unemploymentRate,medianHomeValue:d.medianHomeValue,medianGrossRent:d.medianGrossRent,bachelorsOrHigherRate:d.bachelorsOrHigherRate}])) as Record<string,MetricValues>;
 const incomes=Object.fromEntries(rows.map(d=>[d.district,d.medianHouseholdIncome??0]));
 const entry=rows.find(d=>d.district===selected);
 return <WorkspaceShell title="District Map" kicker="INTERACTIVE LEGISLATIVE DISTRICT GEOGRAPHY">
  <div className={styles.toolbar}><div role="group" aria-label="Legislative chamber"><button aria-pressed={chamber==="House"} onClick={()=>{setChamber("House");setSelected("")}}>House · 51</button><button aria-pressed={chamber==="Senate"} onClick={()=>{setChamber("Senate");setSelected("")}}>Senate · 25</button></div><button type="button" aria-expanded={filters} onClick={()=>setFilters(!filters)}>{filters?"Hide filters":"Show filters"}</button><button type="button" onClick={()=>{const next=theme==="day"?"night":"day";setTheme(next);localStorage.setItem("gc-color-mode",next)}}>{theme==="night"?"☀ Day map":"☾ Night map"}</button></div>
  <div className={`${styles.split} ${!filters?styles.noFilters:""}`}>
   {filters&&<aside className={styles.filters}><h2>Map filters</h2><p>Color legislative districts by a selected Census indicator.</p><fieldset><legend>Choose a layer</legend>{layers.map(m=><label key={m.id}><input type="radio" name="metric-layer" checked={layer===m.id} onChange={()=>setLayer(m.id)}/>{m.label}</label>)}</fieldset><p className={styles.small}>U.S. Census Bureau 2024 ACS 5-Year. Layer values are descriptive estimates; margins of error are not displayed on this map.</p></aside>}
   <section className={styles.mapPanel} aria-label="Interactive Hawaiʻi district map"><HawaiiMap theme={theme} chamber={chamber} mapLayer={layer} valuesByDistrict={values} incomeByDistrict={incomes} onDistrictSelect={(name)=>{const hit=name.match(/\d+/)?.[0];if(hit)setSelected(String(Number(hit)))}}/><div className={styles.mapTitle}>Hawaiʻi · {chamber} legislative districts</div></section>
  </div>
  {loading&&<p className={styles.message} role="status">Loading Census map indicators…</p>}
  {error&&<p className={styles.message} role="alert">Some map indicators are unavailable: {error}. District boundaries may still be displayed.</p>}
  {entry&&<section className={styles.details}><div><h2>{chamber} District {entry.district}</h2><p>{entry.name}</p></div><div className={styles.detailStats}><span>Population <b>{n(entry.population)}</b></span><span>Poverty <b>{n(entry.povertyRate)}%</b></span><span>Median household income <b>{n(entry.medianHouseholdIncome,true)}</b></span></div><Link href={`/initiatives?chamber=${chamber}&district=${entry.district}`}>Explore outreach opportunity ↗</Link></section>}
  <p className={styles.foot}>Boundaries: Hawaiʻi State GIS public map service. Basemap: OpenStreetMap / CARTO. Values: U.S. Census Bureau ACS 2024, post-2022 district geography. Maps are not individual-level data.</p>
 </WorkspaceShell>;
}
