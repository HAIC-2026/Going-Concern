"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import styles from "./outreach.module.css";

type Quantity={value:number|null;moe:number|null;cv:number|null;caution:boolean};
type Stats={total:Quantity;receiving:Quantity;gap:Quantity;rate:Quantity;source:string};
type RecordRow={district:string;name:string;countyName:string;districtStats:Stats;countyStats:Stats|null;stateStats:Stats};
type Payload={vintage:number;fetchedAt:string;cached:boolean;districts:RecordRow[];caveat:string;method:string;geographicBasis:string};
const quantity=(q:Quantity|undefined,unit="")=>q?.value==null?"Not available":`${q.value.toLocaleString("en-US",{maximumFractionDigits:unit==="%"?1:0})}${unit}`;
const moe=(q:Quantity|undefined,unit="")=>q?.moe==null?"MOE not available":`±${q.moe.toLocaleString("en-US",{maximumFractionDigits:unit==="%"?1:0})}${unit} (90% confidence)`;
const warn=(q:Quantity|undefined)=>q?.caution?"Use with caution: high uncertainty (CV >30%).":"";
function StatsCard({name,stats,year}:{name:string;stats:Stats|null;year:number}){
 return <article className={styles.compare}>
  <h3>{name}</h3>
  {stats?<><strong>{quantity(stats.rate,"%")}</strong>
   <span>SNAP receipt among below-poverty households</span>
   <p>{moe(stats.rate,"%")}</p>
   <p>Below-poverty households: {quantity(stats.total)} · {moe(stats.total)}</p>
   <p>Receiving SNAP: {quantity(stats.receiving)} · {moe(stats.receiving)}</p>
   <p className={styles.caution} role={stats.rate.caution?"status":undefined}>{warn(stats.rate)}</p>
   <small>{stats.source}. ACS {year} subject table S2201 (estimate/MOE).</small></>:<p>Not available</p>}
 </article>;
}
export default function OutreachPage(){
 const [chamber,setChamber]=useState<"House"|"Senate">("House");
 const [district,setDistrict]=useState("1");
 const [target,setTarget]=useState<"state"|"county">("state");
 const [payload,setPayload]=useState<Payload|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(true);
 const [theme,setTheme]=useState<"day"|"night">("day");
 useEffect(()=>{try{setTheme(localStorage.getItem("gc-color-mode")==="night"?"night":"day")}catch{}},[]);
 useEffect(()=>{const ctl=new AbortController();setBusy(true);setError("");
  fetch("/api/outreach?chamber="+chamber,{signal:ctl.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??"SNAP data unavailable");return d as Payload})
   .then(d=>{setPayload(d);setDistrict(v=>d.districts.some(x=>x.district===v)?v:"1")}).catch(e=>{if(!ctl.signal.aborted)setError(String(e))}).finally(()=>{if(!ctl.signal.aborted)setBusy(false)});
  return ()=>ctl.abort();
 },[chamber]);
 const row=payload?.districts.find(d=>d.district===district);
 const selected=row?.districtStats;
 const baseline=target==="state"?row?.stateStats:row?.countyStats;
 const change=selected&&baseline&&selected.total.value!==null&&selected.rate.value!==null&&baseline.rate.value!==null
   ?Math.max(0,Math.round(selected.total.value*Math.max(0,baseline.rate.value-selected.rate.value)/100)):null;
 const already=selected&&baseline&&selected.rate.value!==null&&baseline.rate.value!==null&&selected.rate.value>=baseline.rate.value;
 const max=useMemo(()=>Math.max(1,...(payload?.districts??[]).map(d=>d.districtStats.gap.value??0)),[payload]);
 const ranks=useMemo(()=>[...(payload?.districts??[])].filter(d=>d.districtStats.gap.value!==null).sort((a,b)=>(b.districtStats.gap.value??0)-(a.districtStats.gap.value??0)),[payload]);
 function brief(){window.print()}
 return <div className={`${styles.page} ${theme==="night"?styles.night:""}`}>
  <div className={styles.scenery} aria-hidden="true"/>
  <div className={styles.shell}>
   <nav className={styles.nav} aria-label="Going Concern navigation"><Link href="/">Home</Link><Link href="/analytics">Analytics Studio</Link><Link href="/programs">Program Discovery</Link><span aria-current="page">Outreach Gap</span></nav>
   <main className={styles.content}>
    <header className={styles.top}><div><p className={styles.eyebrow}>KNOW YOUR DISTRICT · GOING CONCERN</p><h1>SNAP outreach gap</h1><p>Below-poverty households not receiving SNAP. An outreach indicator, not an eligibility determination.</p></div>
     <div className={styles.topActions}><button onClick={()=>{const next=theme==="day"?"night":"day";setTheme(next);localStorage.setItem("gc-color-mode",next)}} aria-label="Toggle day and evening mode">{theme==="day"?"☾ Evening":"☀ Day"}</button><button onClick={brief} disabled={!row}>Export one-pager / Print</button></div>
    </header>
    <section className={styles.filters} aria-label="Select legislative district">
     <fieldset><legend>Chamber</legend><div className={styles.switch}><button aria-pressed={chamber==="House"} onClick={()=>setChamber("House")}>House · 51</button><button aria-pressed={chamber==="Senate"} onClick={()=>setChamber("Senate")}>Senate · 25</button></div></fieldset>
     <label>District<select value={district} onChange={e=>setDistrict(e.target.value)}>{payload?.districts.map(d=><option key={d.district} value={d.district}>{chamber} District {d.district}</option>)}</select></label>
     <label>What-if comparison<select value={target} onChange={e=>setTarget(e.target.value as "state"|"county")}><option value="state">Hawaiʻi state</option><option value="county">District county</option></select></label>
     {payload&&<span className={styles.vintage}>{payload.vintage} ACS 5-Year · {payload.cached?"Cached dataset":"Live Census API"} · 2022 district geography</span>}
    </section>
    {busy&&<p className={styles.message} role="status">Loading verified Census S2201 estimates…</p>}
    {error&&<div className={styles.message} role="alert">Data unavailable: {error}. No substitute numbers have been inserted. Generate the local cache using the documented refresh script before the demo.</div>}
    {row&&payload&&<div className={styles.report}>
     <section className={styles.hero} aria-label="District SNAP gap">
      <div><p className={styles.eyebrow}>{chamber.toUpperCase()} DISTRICT {district} · {row.countyName}</p><h2>Households below poverty not receiving SNAP</h2><div className={styles.big}>{quantity(selected?.gap)}</div><p>{moe(selected?.gap)} · Source: S2201_C05_021E/M · {payload.vintage} ACS five-year · {row.name}</p>{selected?.gap.caution&&<strong className={styles.caution} role="status">Use with caution: high uncertainty (CV &gt;30%).</strong>}</div>
      <div className={styles.heroSide}><h3>District SNAP participation</h3><strong>{quantity(selected?.rate,"%")}</strong><p>{moe(selected?.rate,"%")}</p><p>Published below-poverty household estimates (S2201). Only households, not individuals.</p><small>{selected?.source}</small></div>
     </section>
     <section className={styles.three} aria-label="District county state comparison"><StatsCard year={payload.vintage} name={`${chamber} District ${district}`} stats={selected??null}/><StatsCard year={payload.vintage} name={row.countyName} stats={row.countyStats}/><StatsCard year={payload.vintage} name="State of Hawaiʻi" stats={row.stateStats}/></section>
     <section className={styles.two}>
      <article className={styles.card}><h2>What if participation matched the {target} rate?</h2><p className={styles.subtle}>One scenario: use the selected comparison's observed rate. This is illustrative, not a forecast.</p>
       {change===null?<p>Not available: one or more inputs are missing.</p>:<><div className={styles.result}>{already?"Already at or above comparison":"About "+change.toLocaleString("en-US")+" additional households"}</div>
        <p><strong>Formula:</strong> max(0, below-poverty households × (comparison rate − district rate) ÷ 100)</p>
        <dl className={styles.inputs}><div><dt>Below-poverty households</dt><dd>{quantity(selected?.total)} · {moe(selected?.total)}</dd></div><div><dt>District participation rate</dt><dd>{quantity(selected?.rate,"%")} · {moe(selected?.rate,"%")}</dd></div><div><dt>{target==="state"?"State":"County"} participation rate</dt><dd>{quantity(baseline?.rate,"%")} · {moe(baseline?.rate,"%")}</dd></div></dl>
        <p className={styles.subtle}>Sources: {selected?.source}; {baseline?.source}. Uncertainty in this scenario is not reported as an exact confidence interval because the district overlaps its county/state comparison and covariance is unknown.</p></>}
      </article>
      <article className={styles.card}><h2>Largest observed nonparticipation counts</h2><p className={styles.subtle}>Top 8 {chamber} districts by the S2201 below-poverty nonrecipient estimate. Estimates are subject to sampling uncertainty.</p><div className={styles.ranks}>{ranks.slice(0,8).map(d=><button key={d.district} onClick={()=>setDistrict(d.district)} title={`View ${chamber} District ${d.district}`}><span>{chamber==="House"?"HD":"SD"} {d.district}</span><span className={styles.bar}><span style={{width:`${100*(d.districtStats.gap.value??0)/max}%`}}/></span><strong>{quantity(d.districtStats.gap)}</strong>{d.districtStats.gap.caution&&<span title="High uncertainty">⚠</span>}</button>)}</div></article>
     </section>
     <section className={styles.card}><h2>Evidence-based analysis</h2><p>{selected?.gap.value===null?"No observed gap estimate is available.":`ACS estimates ${quantity(selected?.gap)} below-poverty households in ${chamber} District ${district} did not receive SNAP in the past 12 months.`}</p><p>{selected?.rate.value!==null&&baseline?.rate.value!==null?(selected.rate.value<baseline.rate.value?`Its observed SNAP receipt rate (${quantity(selected.rate,"%")}) is below the ${target} comparison (${quantity(baseline.rate,"%")}). This population-and-program pairing may warrant outreach investigation.`:`Its observed SNAP receipt rate is at or above the ${target} comparison; the matching-rate scenario does not imply additional participants.`):"The comparison rate is not available."}</p>
      <p className={styles.subtle}>This panel is deterministic and uses computed values only; no AI-generated figures. The ACS does not confirm who is eligible, whether outreach will cause enrollment, or who should be contacted. Final eligibility is determined by the administering agency.</p>
      <p>Official program: <a href="https://humanservices.hawaii.gov/bessd/snap./" target="_blank" rel="noopener noreferrer">Hawaiʻi DHS SNAP information and application</a>.</p>
     </section>
     <footer className={styles.footer}><p><strong>Source:</strong> U.S. Census Bureau {payload.vintage} ACS five-year, subject table S2201, variables C01/C03/C05 row 021, published 90% margins of error. {payload.geographicBasis}.</p><p><strong>Calculation:</strong> participation = S2201_C03_021E / S2201_C01_021E. Direct below-poverty nonrecipient count = S2201_C05_021E. Percentage MOE uses ACS subset-ratio approximation with fallback to general ratio; CV = MOE / (1.645 × estimate). High-uncertainty flag if CV &gt;30%.</p><p><strong>County method:</strong> {payload.method}</p><p>{payload.caveat}</p><p>Generated from Census estimates, not individual records. Final SNAP eligibility and benefit enrollment are decided by Hawaiʻi DHS. Source vintage: {payload.vintage}; data pulled: {payload.fetchedAt}.</p></footer>
    </div>}
   </main>
  </div>
 </div>;
}