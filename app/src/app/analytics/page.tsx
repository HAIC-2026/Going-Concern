"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./analytics.module.css";

type Chamber="House"|"Senate";
type Metric={key:string;label:string;unit:string;source:string;note:string};
type District={chamber:Chamber;district:number;values:Record<string,number|null>};
type Payload={chamber:Chamber;year:number;dataset:string;source:string;limitations:string;metrics:Metric[];districts:District[]};
type Visual="rank"|"scatter"|"table";
const defaultKeys=["seniors65Pct","rentBurdenPct","snapHouseholdsPct","noInternetPct"];
const groupNames:Record<string,string>={seniors65Pct:"Demographics",seniors65Count:"Demographics",medianAge:"Demographics",disabilityPct:"Demographics",snapHouseholdsPct:"Community needs",noInternetPct:"Community needs",noVehiclePct:"Community needs",rentBurdenPct:"Housing",severeRentBurdenPct:"Housing",renterOccupiedPct:"Housing",vacantHousingPct:"Housing"};
const num=(v:number|null|undefined,unit="%")=>v==null||!Number.isFinite(v)?"Unavailable":`${v.toLocaleString("en-US",{maximumFractionDigits:1})}${unit==="%"?"%":unit==="years"?" years":""}`;
const median=(values:number[])=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
const download=(name:string,content:string,mime:string)=>{const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)};
const csvCell=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;
function round(v:number){return Math.round(v*10)/10}
export default function AnalyticsStudio(){
 const [theme,setTheme]=useState<"day"|"night">("day");
 const [chamber,setChamber]=useState<Chamber>("House");
 const [payload,setPayload]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [metricKey,setMetricKey]=useState("rentBurdenPct");
 const [xKey,setXKey]=useState("seniors65Pct");
 const [scope,setScope]=useState<"all"|"selected">("all");
 const [selected,setSelected]=useState<number[]>([5,15]);
 const [visual,setVisual]=useState<Visual>("rank");
 const [sort,setSort]=useState<"high"|"low">("high");
 const [group,setGroup]=useState("All indicators");
 const [visibleKpis,setVisibleKpis]=useState<string[]>(defaultKeys);
 const [period,setPeriod]=useState(1);
 const [scenarioPct,setScenarioPct]=useState(10);
 const [scenarioBaseline,setScenarioBaseline]=useState(100);
 const [scenarioKind,setScenarioKind]=useState<"outreach"|"rate">("outreach");
 const [aiBusy,setAiBusy]=useState(false);
 const [aiText,setAiText]=useState("");
 const [aiError,setAiError]=useState("");
 const [aiQuestion,setAiQuestion]=useState("Where are the biggest district-level differences, and what should staff investigate next?");
 useEffect(()=>{try{setTheme(localStorage.getItem("gc-color-mode")==="night"?"night":"day");const p=JSON.parse(localStorage.getItem("gc-demo-profile")||"null");if(p?.chamber==="House"||p?.chamber==="Senate"){setChamber(p.chamber);if(Number(p.district)>0)setSelected([Number(p.district)]);}}catch{}},[]);
 useEffect(()=>{const ctrl=new AbortController();setLoading(true);setError("");setPayload(null);fetch(`/api/analytics?chamber=${chamber}`,{signal:ctrl.signal}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.error||"Census data unavailable");return p as Payload}).then(p=>{setPayload(p);setSelected(old=>{const valid=old.filter(n=>p.districts.some(d=>d.district===n));return valid.length?valid:[p.districts[0]?.district||1]})}).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:"Cannot load data")}).finally(()=>{if(!ctrl.signal.aborted)setLoading(false)});return()=>ctrl.abort()},[chamber]);
 const metric=payload?.metrics.find(m=>m.key===metricKey)||payload?.metrics[0];
 const xMetric=payload?.metrics.find(m=>m.key===xKey)||payload?.metrics[0];
 const districts=useMemo(()=>payload?.districts.filter(d=>scope==="all"||selected.includes(d.district))||[],[payload,scope,selected]);
 const available=useMemo(()=>districts.filter(d=>d.values[metricKey]!=null).sort((a,b)=>sort==="high"?(b.values[metricKey] as number)-(a.values[metricKey] as number):(a.values[metricKey] as number)-(b.values[metricKey] as number)),[districts,metricKey,sort]);
 const allValues=useMemo(()=>payload?.districts.map(d=>d.values[metricKey]).filter((n):n is number=>n!=null)||[],[payload,metricKey]);
 const chamberMedian=median(allValues);
 const activeMedian=median(available.map(d=>d.values[metricKey] as number));
 const sampleMax=Math.max(1,...available.map(d=>d.values[metricKey]||0));
 const kpiMetrics=payload?.metrics.filter(m=>visibleKpis.includes(m.key))||[];
 const insightTop=available[0], insightBottom=available[available.length-1];
 const selectedMain=payload?.districts.find(d=>d.district===selected[0]);
 const scenarioMetric=payload?.metrics.find(m=>m.key===(scenarioKind==="outreach"?"snapHouseholdsPct":"rentBurdenPct"));
 const simulate=(scenarioKind==="outreach"?scenarioBaseline*scenarioPct/100:scenarioBaseline*scenarioPct/100);
 const toggle=(id:number)=>setSelected(old=>old.includes(id)?(old.length>1?old.filter(n=>n!==id):old):[...old,id].sort((a,b)=>a-b));
 const exportRows=()=>{if(!payload)return;const columns=["Chamber","District",...payload.metrics.map(m=>m.label)];const rows=[columns,...districts.map(d=>[d.chamber,String(d.district),...payload.metrics.map(m=>d.values[m.key]==null?"":String(d.values[m.key]))])];download(`GoingConcern_${chamber}_ACS2024.csv`,"\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8")};
 async function askAI(){if(!payload||!metric)return;setAiBusy(true);setAiError("");setAiText("");try{const response=await fetch("/api/analytics/insights",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chamber,metricKey,scope,selected,question:aiQuestion})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Advisor unavailable");setAiText(String(data.answer||"No answer returned"))}catch(e){setAiError(e instanceof Error?e.message:"Advisor unavailable")}finally{setAiBusy(false)}}
 return <div className={`${styles.screen} ${theme==="night"?styles.night:styles.day}`}>
 <div className={styles.scenery}/>
 <div className={styles.layout}>
  <aside className={styles.sidebar}>
   <div className={styles.islands} aria-hidden="true"/>
   <nav className={styles.nav} aria-label="Main navigation"><a href="/">⌂ <span>Home</span></a><a href="/" title="Map available from Home">◇ <span>Map View</span></a><a href="/analytics" aria-current="page">▥ <span>Analytics Studio</span></a><a href="/programs">✧ <span>Program Discovery</span></a><a href="/outreach">◎ <span>Outreach Gap</span></a></nav>
   <div className={styles.sidebarFoot}><div className={styles.source}>DATA SOURCES<br/><span>U.S. Census Bureau<br/>2024 ACS 5-Year Estimates<br/>State legislative districts</span></div><div className={styles.themes}><button aria-pressed={theme==="day"} onClick={()=>{setTheme("day");localStorage.setItem("gc-color-mode","day")}} title="Day mode">☀</button><button aria-pressed={theme==="night"} onClick={()=>{setTheme("night");localStorage.setItem("gc-color-mode","night")}} title="Evening mode">☾</button></div></div>
  </aside>
  <main className={styles.main}>
   <header className={styles.header}><div><p className={styles.eyebrow}>GOING CONCERN / INTELLIGENCE</p><h1>Analytics Studio</h1><p>Explore Hawaiʻi's districts, compare conditions and test assumptions.</p></div><button className={styles.outlineButton} onClick={exportRows} disabled={!payload}>↓ Export CSV</button></header>
   <section className={styles.toolbar} aria-label="Analysis controls">
    <div className={styles.switch}><button aria-pressed={chamber==="House"} onClick={()=>setChamber("House")}>House · 51</button><button aria-pressed={chamber==="Senate"} onClick={()=>setChamber("Senate")}>Senate · 25</button></div>
    <label>Scope <select value={scope} onChange={e=>setScope(e.target.value as "all"|"selected")}><option value="all">All {chamber} districts</option><option value="selected">Selected districts</option></select></label>
    <label>Metric category <select value={group} onChange={e=>{setGroup(e.target.value);const m=payload?.metrics.find(x=>e.target.value==="All indicators"||groupNames[x.key]===e.target.value);if(m)setMetricKey(m.key)}}>{["All indicators","Demographics","Housing","Community needs"].map(g=><option key={g}>{g}</option>)}</select></label>
    <label>Metric <select value={metricKey} onChange={e=>setMetricKey(e.target.value)}>{payload?.metrics.filter(m=>group==="All indicators"||groupNames[m.key]===group).map(m=><option value={m.key} key={m.key}>{m.label}</option>)}</select></label>
    <label>Time horizon <select value={period} onChange={e=>setPeriod(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option value={n} key={n}>Last {n} {n===1?"year":"years"}</option>)}</select></label>
   </section>
   {period>1&&<div className={styles.notice}>Historical view requested ({period} years). Only the 2024 ACS five-year *estimate* is connected. Comparable earlier vintages are not yet loaded, so this dashboard will not invent a trend.</div>}
   {loading&&<div className={styles.notice}>Loading verified Census district estimates…</div>}
   {error&&<div className={styles.notice} role="alert"><strong>Data could not load.</strong> {error} — Check that Going Concern is running and the Census endpoint is available.</div>}
   {payload&&metric&&xMetric&&<>
    <section className={styles.kpiStrip} aria-label="Key performance indicators">
     {kpiMetrics.map(m=>{const vals=districts.map(d=>d.values[m.key]).filter((x):x is number=>x!=null);const v=scope==="selected"&&districts.length===1?vals[0]??null:median(vals);return <article className={styles.kpi} key={m.key}><small>{m.label}</small><strong>{num(v,m.unit)}</strong><span>{scope==="selected"&&districts.length===1?`${chamber} District ${districts[0]?.district}`:`Median of ${vals.length} districts`}</span></article>})}
     <div className={styles.kpiAdd}><span>Choose cards</span><details><summary>＋ Edit KPIs</summary><div className={styles.kpiMenu}>{payload.metrics.map(m=><label key={m.key}><input type="checkbox" checked={visibleKpis.includes(m.key)} onChange={e=>setVisibleKpis(old=>e.target.checked?[...old,m.key]:old.filter(x=>x!==m.key))}/>{m.label}</label>)}</div></details></div>
    </section>
    <section className={styles.mainGrid}>
      <div className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>DISTRICT VISUALIZATION</span><h2>{metric.label} by district</h2><small>{metric.note}</small></div><div className={styles.visualTabs}>{(["rank","scatter","table"] as Visual[]).map(v=><button key={v} aria-pressed={visual===v} onClick={()=>setVisual(v)}>{v==="rank"?"Ranking":v==="scatter"?"Scatter":"Table"}</button>)}</div></div>
       {visual==="rank"&&<><div className={styles.rowHead}><span>{available.length} districts with estimates</span><button className={styles.textButton} onClick={()=>setSort(s=>s==="high"?"low":"high")}>Sort {sort==="high"?"high → low":"low → high"} ↕</button></div><div className={styles.bars}>{available.map((d,i)=><button className={`${styles.barRow} ${selected.includes(d.district)?styles.chosen:""}`} key={d.district} onClick={()=>toggle(d.district)} title="Click to select district"><span>{i+1}</span><b>HD {chamber==="House"?d.district:`Sen ${d.district}`}</b><span className={styles.track}><span style={{width:`${100*(d.values[metricKey]||0)/sampleMax}%`}}/></span><strong>{num(d.values[metricKey],metric.unit)}</strong></button>)}</div></>}
       {visual==="scatter"&&<div className={styles.scatterWrap}><label>X axis <select value={xKey} onChange={e=>setXKey(e.target.value)}>{payload.metrics.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></label><div className={styles.scatter}><svg viewBox="0 0 720 310" role="img" aria-label={`${xMetric.label} against ${metric.label} across districts`}><line x1="55" y1="270" x2="700" y2="270" stroke="currentColor" opacity=".5"/><line x1="55" y1="20" x2="55" y2="270" stroke="currentColor" opacity=".5"/>{[.25,.5,.75].map(t=><line key={t} x1="55" x2="700" y1={270-240*t} y2={270-240*t} stroke="currentColor" opacity=".12"/>)}{districts.filter(d=>d.values[xKey]!=null&&d.values[metricKey]!=null).map(d=>{const maxX=Math.max(1,...districts.map(v=>v.values[xKey]||0)),maxY=Math.max(1,...districts.map(v=>v.values[metricKey]||0));const x=55+630*(d.values[xKey]||0)/maxX,y=270-240*(d.values[metricKey]||0)/maxY;return <circle key={d.district} cx={x} cy={y} r={selected.includes(d.district)?8:5} fill={selected.includes(d.district)?"#f5b65b":"#a36be7"} fillOpacity=".84" stroke="white" strokeWidth="1"><title>{chamber} {d.district}: {xMetric.label} {num(d.values[xKey],xMetric.unit)}; {metric.label} {num(d.values[metricKey],metric.unit)}</title></circle>})}<text x="345" y="302" fontSize="13" fill="currentColor" textAnchor="middle">{xMetric.label}</text><text x="22" y="145" fontSize="13" fill="currentColor" textAnchor="middle" transform="rotate(-90,22,145)">{metric.label}</text></svg></div><small>Hover over a dot to see the district's values. Orange dots are selected districts.</small></div>}
       {visual==="table"&&<div className={styles.tableScroll}><table><thead><tr><th>District</th><th>{metric.label}</th><th>vs chamber median</th></tr></thead><tbody>{available.map(d=><tr key={d.district} onClick={()=>toggle(d.district)}><td>{chamber} {d.district}</td><td>{num(d.values[metricKey],metric.unit)}</td><td>{chamberMedian==null?"Unavailable":`${round((d.values[metricKey]||0)-chamberMedian)>0?"+":""}${num(round((d.values[metricKey]||0)-chamberMedian),metric.unit)}`}</td></tr>)}</tbody></table></div>}
       <div className={styles.footNote}>Chamber median: {num(chamberMedian,metric.unit)} · Median across districts, not a statewide rate. ACS 2024 five-year estimates; no claim of statistical significance.</div>
      </div>
      <aside className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>ANALYSIS ADVISOR</span><h2>Signals & recommendations</h2></div><span className={styles.spark}>✧</span></div>
       <div className={styles.insight}><small>Observed distribution</small><strong>{insightTop?`${chamber} ${insightTop.district}: ${num(insightTop.values[metricKey],metric.unit)}`:"No valid estimates"}</strong><p>Highest value in the current selection. {insightBottom?`Lowest: ${chamber} ${insightBottom.district} (${num(insightBottom.values[metricKey],metric.unit)}).`:""}</p></div>
       <div className={styles.insight}><small>Suggested next step</small><p>Compare selected districts on rent burden, SNAP receipt, vehicle access, and senior share. Differences may guide further investigation—not establish unmet need or program eligibility.</p></div>
       <label className={styles.askLabel}>Ask AI about this selection<textarea value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} maxLength={500} rows={3}/></label><button className={styles.primary} onClick={askAI} disabled={aiBusy||!aiQuestion.trim()}>{aiBusy?"Analyzing…":"✧ Analyze with AI"}</button>
       {aiError&&<div className={styles.aiAnswer} role="alert">{aiError}</div>}{aiText&&<div className={styles.aiAnswer}><strong>AI interpretation · Verify sources</strong><p>{aiText}</p></div>}
       <small className={styles.disclaimer}>AI cannot determine individual eligibility, causal effects, or whether small ACS differences are statistically significant.</small>
      </aside>
    </section>
    <section className={styles.bottomGrid}>
      <div className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>DISTRICT SELECTION</span><h2>Explore and compare</h2></div><button className={styles.textButton} onClick={()=>setSelected([selected[0]||1])}>Reset</button></div><div className={styles.districtPills}>{payload.districts.map(d=><button key={d.district} aria-pressed={selected.includes(d.district)} onClick={()=>{toggle(d.district);setScope("selected")}}>{d.district}</button>)}</div><p className={styles.footNote}>{selected.length} selected · Selecting districts narrows all charts when Scope = Selected districts.</p><div className={styles.compare}>{selected.slice(0,4).map(n=>{const d=payload.districts.find(x=>x.district===n);return <div key={n}><strong>{chamber} {n}</strong><span>{num(d?.values[metricKey],metric.unit)}</span></div>})}</div></div>
      <div className={styles.panel}><div className={styles.panelHeader}><div><span className={styles.eyebrow}>WHAT-IF LAB</span><h2>Scenario calculator</h2></div></div><p className={styles.subtle}>Illustrative arithmetic—not a forecast, measured outcome, or causal estimate.</p><div className={styles.scenarioTabs}><button aria-pressed={scenarioKind==="outreach"} onClick={()=>setScenarioKind("outreach")}>Outreach scenario</button><button aria-pressed={scenarioKind==="rate"} onClick={()=>setScenarioKind("rate")}>Housing scenario</button></div><label className={styles.scenarioLabel}>Assumed starting group (households) <input type="number" min={0} max={1000000} value={scenarioBaseline} onChange={e=>setScenarioBaseline(Math.max(0,Math.min(1000000,Number(e.target.value)||0)))}/></label><label className={styles.scenarioLabel}>Assumed change: {scenarioPct}% <input type="range" min="0" max="50" step="1" value={scenarioPct} onChange={e=>setScenarioPct(Number(e.target.value))}/></label><div className={styles.scenarioResult}><small>Illustrative households affected</small><strong>{Math.round(simulate).toLocaleString()}</strong><span>Of {scenarioBaseline.toLocaleString()} assumed households · {scenarioPct}% change</span></div><p className={styles.footNote}>{scenarioMetric?.label} is a contextual district indicator. The assumed household count is entered manually; it is not an ACS enrollment or eligibility estimate.</p></div>
    </section>
    <footer className={styles.footer}><strong>Data integrity:</strong> U.S. Census Bureau, 2024 ACS five-year estimates · <a target="_blank" rel="noreferrer" href={payload.source}>Original dataset</a> · Derived percentages without propagated margins of error · {payload.limitations}</footer>
   </>}
  </main>
 </div></div>;
}
