"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import WorkspaceShell from "@/components/WorkspaceShell";
import styles from "./initiatives.module.css";

type Chamber="House"|"Senate";
type Quantity={value:number|null;moe:number|null;cv:number|null;caution:boolean};
type Stats={total:Quantity;receiving:Quantity;gap:Quantity;rate:Quantity;source:string};
type District={district:string;name:string;countyName:string;districtStats:Stats;countyStats:Stats|null;stateStats:Stats};
type Dataset={vintage:number;districts:District[];caveat:string;cached:boolean;fetchedAt:string};
type Activity={id:string;at:string;event:string;detail:string};
type Stage="Discover"|"Verify"|"Match"|"Plan"|"Outreach"|"Track";
export type Initiative={id:string;name:string;chamber:Chamber;district:string;stage:Stage;notes:string;email:string;partnerIds:string[];updatedAt:string;events:Activity[]};
const STORE="gc-initiatives-demo-v2";
export const partners=[
 {id:"dhs",name:"Hawaiʻi Department of Human Services",role:"SNAP program administrator",url:"https://humanservices.hawaii.gov/bessd/snap/",verified:"Official program source"},
 {id:"foodbank",name:"Hawaiʻi Foodbank",role:"Food access and community resource partner",url:"https://hawaiifoodbank.org/",verified:"Official organization website"},
 {id:"aloha",name:"Aloha United Way 211",role:"Community resource and referral network",url:"https://www.auw211.org/",verified:"Official resource directory"}
];
const stages:Stage[]=["Discover","Verify","Match","Plan","Outreach","Track"];
const display=(v:number|null|undefined,percent=false)=>v==null?"Not available":v.toLocaleString("en-US",{maximumFractionDigits:percent?1:0})+(percent?"%":"");
const sourceLine=(stats:Stats|undefined)=>stats?.source||"Census source unavailable";
const makeInitial=(chamber:Chamber,district:string):Initiative=>({id:"snap-"+chamber+"-"+district,name:"SNAP Participation Initiative",chamber,district,stage:"Discover",notes:"",email:"",partnerIds:["dhs"],updatedAt:new Date().toISOString(),events:[]});
function stamp(){return new Date().toISOString()}
function makeEvent(event:string,detail:string):Activity{return{id:stamp()+"-"+Math.random().toString(36).slice(2),at:stamp(),event,detail}}
export function loadInitiatives():Initiative[]{try{const v=JSON.parse(localStorage.getItem(STORE)||"[]");return Array.isArray(v)?v:[]}catch{return []}}
export function saveInitiatives(items:Initiative[]){try{localStorage.setItem(STORE,JSON.stringify(items))}catch{}}
export default function InitiativeWorkspace({view="workspace"}:{view?:"workspace"|"activity"|"partners"|"settings"}){
 const [chamber,setChamber]=useState<Chamber>("House");
 const [district,setDistrict]=useState("5");
 const [dataset,setDataset]=useState<Dataset|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [all,setAll]=useState<Initiative[]>([]);
 const [activeId,setActiveId]=useState("");
 const [ready,setReady]=useState(false);
 const [target,setTarget]=useState<"state"|"county">("state");
 const [actionMessage,setActionMessage]=useState("");
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem("gc-demo-profile")||"null");if(p?.chamber==="House"||p?.chamber==="Senate")setChamber(p.chamber);if(p?.district)setDistrict(String(Number(p.district)));const saved=loadInitiatives();setAll(saved);if(saved.length)setActiveId(saved[0].id);}catch{}setReady(true)},[]);
 useEffect(()=>{if(!ready)return;const controller=new AbortController();setLoading(true);setError("");
  fetch("/api/outreach?chamber="+chamber,{signal:controller.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Data unavailable");return data as Dataset})
   .then(data=>{setDataset(data);setDistrict(old=>data.districts.some(r=>r.district===old)?old:"1")})
   .catch(e=>{if(!controller.signal.aborted)setError(String(e))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[chamber,ready]);
 const row=dataset?.districts.find(r=>r.district===district);
 const active=all.find(x=>x.id===activeId);
 const current=active?.chamber===chamber&&active?.district===district?active:null;
 const comparison=target==="state"?row?.stateStats:row?.countyStats;
 const gap=row?.districtStats.gap;
 const denominator=row?.districtStats.total.value;
 const districtRate=row?.districtStats.rate.value;
 const peerRate=comparison?.rate.value;
 const additional=denominator!=null&&districtRate!=null&&peerRate!=null?Math.max(0,Math.round(denominator*Math.max(0,peerRate-districtRate)/100)):null;
 const items=useMemo(()=>[...all].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[all]);
 function update(next:Initiative,log?:{event:string;detail:string}){const result={...next,updatedAt:stamp(),events:log?[...next.events,makeEvent(log.event,log.detail)]:next.events};const updated=[result,...all.filter(i=>i.id!==result.id)];setAll(updated);setActiveId(result.id);saveInitiatives(updated);setActionMessage("Saved in this browser (demonstration workspace).")}
 function start(){const existing=all.find(i=>i.chamber===chamber&&i.district===district);if(existing){setActiveId(existing.id);setActionMessage("Opened existing initiative for this district.");return}
  const entry=makeInitial(chamber,district);update(entry,{event:"Initiative created",detail:`Created SNAP outreach draft for ${chamber} District ${district}`})}
 function step(next:Stage){const entry=current;if(!entry)return;update({...entry,stage:next},{event:"Stage updated",detail:`Moved to ${next}; this is a locally recorded demo workflow status`})}
 function draft(){if(!row)return;const text=`Subject: Exploring SNAP outreach for ${chamber} District ${district}\n\nAloha,\n\nWe are reviewing public ACS ${dataset?.vintage} five-year estimates for ${chamber} District ${district}. Census subject table S2201 estimates ${display(gap?.value)} households below the poverty threshold were not receiving SNAP (90% margin of error: ±${display(gap?.moe)}). This does not mean they are confirmed eligible.\n\nWe would welcome a conversation about official eligibility guidance, outreach channels, and appropriate community partners. No individual records are involved.\n\nMahalo.\n\nSource: ${sourceLine(row.districtStats)}\nOfficial application information: https://humanservices.hawaii.gov/bessd/snap/`;
 const entry=current||makeInitial(chamber,district);
 update({...entry,email:text,stage:"Plan"},{event:"Outreach email drafted",detail:"Draft saved locally; no email was sent."})}
 function copy(text:string){if(typeof navigator!=="undefined"&&navigator.clipboard){navigator.clipboard.writeText(text).then(()=>setActionMessage("Copied to clipboard.")).catch(()=>setActionMessage("Clipboard unavailable; select and copy the text manually."))}}
 function exportJSON(){const data=current||makeInitial(chamber,district);const contents=JSON.stringify({initiative:data,source:{vintage:dataset?.vintage,geography:row?.name,snap:row?.districtStats,county:row?.countyStats,state:row?.stateStats},limitations:dataset?.caveat,generatedAt:stamp()},null,2);const url=URL.createObjectURL(new Blob([contents],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`going-concern-${chamber.toLowerCase()}-${district}-initiative.json`;a.click();URL.revokeObjectURL(url)}
 const headerButtons=<><button className={styles.ghost} onClick={()=>copy(window.location.href)} type="button">Share link</button><button className={styles.ghost} onClick={exportJSON} type="button">Export data</button><button className={styles.primary} onClick={start} type="button">+ New initiative</button></>;
 if(view==="settings")return <WorkspaceShell title="Workspace Settings" kicker="PERSONALIZE YOUR DEMO"><div className={styles.card}><h2>Privacy and persistence</h2><p>Initiatives, action history, selected partners and drafts are stored only in this browser's local storage. They are not shared between devices or offices, and there is no secure authentication in this prototype.</p><p>Use the day/night toggle in the header. Navigation expansion is also remembered in this browser.</p><button className={styles.danger} type="button" onClick={()=>{if(window.confirm("Delete all locally saved demo initiatives and drafts?")){saveInitiatives([]);setAll([]);setActiveId("");setActionMessage("Local demonstration records cleared.")}}}>Clear local demo initiatives</button>{actionMessage&&<p role="status">{actionMessage}</p>}</div></WorkspaceShell>;
 if(view==="partners")return <WorkspaceShell title="Partner Directory" kicker="VERIFIED EXTERNAL ORGANIZATIONS"><div className={styles.card}><p>These are potential resources, not established Going Concern partnerships or endorsements. Contact and approval statuses are not represented as completed.</p><div className={styles.partnerGrid}>{partners.map(p=><article className={styles.partner} key={p.id}><h2>{p.name}</h2><p>{p.role}</p><small>{p.verified}</small><p><a href={p.url} target="_blank" rel="noopener noreferrer">Visit official website ↗</a></p></article>)}</div></div></WorkspaceShell>;
 if(view==="activity")return <WorkspaceShell title="Activity Center" kicker="LOCALLY SAVED DEMO ACTIVITY"><div className={styles.card}><p>Activity appears only after a user takes an action. Nothing below indicates a real-world email, approval, enrollment, or outreach outcome.</p>{items.length===0?<p>No initiatives saved yet. <Link href="/initiatives">Create an initiative</Link> to begin.</p>:items.map(item=><article className={styles.activityBlock} key={item.id}><h2>{item.name} · {item.chamber} District {item.district}</h2><p>Current stage: <strong>{item.stage}</strong></p>{[...item.events].reverse().map(e=><p key={e.id}><time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time> — <strong>{e.event}</strong>: {e.detail}</p>)}</article>)}</div></WorkspaceShell>;
 return <WorkspaceShell title={current?.name||"SNAP Participation Initiative"} kicker="INITIATIVE WORKSPACE · EVIDENCE TO ACTION" actions={headerButtons}>
  <p className={styles.lead}>Identify a potential outreach opportunity, verify Census evidence, select resources, develop a plan and track user-recorded actions.</p>
  <div className={styles.filters}><label>Chamber <select value={chamber} onChange={e=>{setChamber(e.target.value as Chamber);setActiveId("")}}><option value="House">House</option><option value="Senate">Senate</option></select></label><label>District<select value={district} onChange={e=>{setDistrict(e.target.value);setActiveId("")}}>{Array.from({length:chamber==="House"?51:25},(_,n)=><option value={n+1} key={n+1}>{chamber} District {n+1}</option>)}</select></label><label>Scenario baseline<select value={target} onChange={e=>setTarget(e.target.value as "county"|"state")}><option value="state">State rate</option><option value="county">County rate</option></select></label>{current&&<strong className={styles.status}>Draft in progress · {current.stage}</strong>}</div>
  <div className={styles.steps} aria-label="Initiative stages">{stages.map((s,i)=><button key={s} className={current?.stage===s?styles.current:""} type="button" disabled={!current} onClick={()=>step(s)}><b>{i+1}</b><span>{s}</span><small>{["Find need","Source & explain","Programs & partners","Outreach strategy","Draft communication","Record follow-up"][i]}</small></button>)}</div>
  {loading&&<p role="status" className={styles.banner}>Loading verified Census estimates…</p>}
  {error&&<p role="alert" className={styles.banner}>Census data unavailable: {error}. No sample values were inserted. Refresh and commit the offline cache before deployment.</p>}
  {row&&<div className={styles.kpis}>
   <article><small>Observed SNAP nonreceipt gap</small><strong>{display(gap?.value)}</strong><span>Below-poverty households · ±{display(gap?.moe)} MOE</span>{gap?.caution&&<em>Use with caution: CV &gt;30%</em>}</article>
   <article><small>Below-poverty households</small><strong>{display(denominator)}</strong><span>ACS S2201 denominator · ±{display(row.districtStats.total.moe)}</span></article>
   <article><small>Current SNAP participation</small><strong>{display(districtRate,true)}</strong><span>County: {display(row.countyStats?.rate.value,true)} · State: {display(row.stateStats.rate.value,true)}</span></article>
   <article><small>Illustrative matching-rate scenario</small><strong>{additional==null?"Not available":`+${additional.toLocaleString()}`}</strong><span>{districtRate!=null&&peerRate!=null&&districtRate>=peerRate?"Already at or above comparison rate":"Not a forecast or predicted outcome"}</span></article>
  </div>}
  <div className={styles.columns}><div className={styles.primaryColumn}>
   <section className={styles.card}><h2>Information Flow: From Data to Action</h2><p className={styles.muted}>Every step is actionable. No invented enrollments, sent messages, partner agreements or approvals.</p>
    <div className={styles.flow}><div className={styles.flowBox}><h3>Sourced Data</h3><Link href="/outreach">↗ U.S. Census ACS S2201</Link><Link href="/outreach">↗ Source estimates & uncertainty</Link><a href="https://humanservices.hawaii.gov/bessd/snap/" target="_blank" rel="noopener noreferrer">↗ Hawaiʻi DHS SNAP</a></div><div className={styles.flowCenter}><span>≋</span><b>District Intelligence Engine</b><small>Observe · Compare · Plan</small></div><div className={styles.flowBox}><h3>Assistance Programs</h3><a href="https://humanservices.hawaii.gov/bessd/snap/" target="_blank" rel="noopener noreferrer">SNAP · official DHS source ↗</a><Link href="/programs">Browse other programs ↗</Link><h3>Potential Partners</h3>{partners.slice(1).map(p=><a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">{p.name} ↗</a>)}</div><div className={styles.flowBox}><h3>Outreach</h3><button type="button" onClick={draft}>Draft an email</button><button type="button" onClick={()=>step("Plan")} disabled={!current}>Develop plan</button><button type="button" onClick={()=>step("Track")} disabled={!current}>Track follow-up</button></div></div>
    {row&&<p className={styles.source}>Source: {sourceLine(row.districtStats)} · 90% MOE ±{display(gap?.moe)}. Below-poverty nonreceipt is not confirmed program eligibility. Final eligibility is determined by Hawaiʻi DHS.</p>}
   </section>
   <div className={styles.lower}>
    <section className={styles.card}><h2>Key takeaways</h2>{row?<><p>• {display(gap?.value)} below-poverty households are estimated not to be receiving SNAP.</p><p>• District participation: {display(districtRate,true)}; comparison ({target}): {display(peerRate,true)}.</p><p>• Scenario formula: max(0, households × (comparison rate − district rate) ÷ 100). Result: {additional==null?"Not available":display(additional)}.</p></>:<p>Awaiting verified data.</p>}</section>
    <section className={styles.card}><h2>Next Action</h2><p>{!current?"Start an initiative to save your steps.":"Review the evidence, record partners, and prepare an outreach draft."}</p><button className={styles.primary} type="button" onClick={current?draft:start}>{current?"Draft outreach email":"Create initiative"}</button></section>
   </div>
   <section className={styles.card}><h2>Draft outreach plan & correspondence</h2><p className={styles.muted}>Editable text remains on this device. Copying a message does not send it.</p><label className={styles.fullLabel}>Working notes<textarea rows={4} value={current?.notes||""} onChange={e=>{if(current)update({...current,notes:e.target.value})}} placeholder="Record evidence, proposed outreach channels, and next steps" disabled={!current}/></label><label className={styles.fullLabel}>Email draft<textarea rows={9} value={current?.email||""} onChange={e=>{if(current)update({...current,email:e.target.value})}} placeholder="Generate a source-backed draft above" disabled={!current}/></label><button type="button" className={styles.ghost} disabled={!current?.email} onClick={()=>copy(current?.email||"")}>Copy email draft</button><p className={styles.muted}>No email integration is configured; all external contact remains manual.</p></section>
  </div>
  <aside className={styles.sideColumn}><section className={styles.card}><h2>Activity Timeline</h2><span className={styles.saveLabel}>● Browser-local storage</span>{current?.events.length?<ol>{[...current.events].reverse().map(e=><li key={e.id}><strong>{e.event}</strong><small>{new Date(e.at).toLocaleString()}</small><p>{e.detail}</p></li>)}</ol>:<p>No actions recorded for this district. Create an initiative to begin.</p>}</section>
   <section className={styles.card}><h2>Partner selections</h2>{partners.map(p=><label className={styles.partnerRow} key={p.id}><input type="checkbox" checked={Boolean(current?.partnerIds.includes(p.id))} disabled={!current} onChange={e=>{if(!current)return;const ids=e.target.checked?[...current.partnerIds,p.id]:current.partnerIds.filter(x=>x!==p.id);update({...current,partnerIds:ids},{event:"Partner list updated",detail:`Potential partner ${p.name} ${e.target.checked?"added":"removed"}. No contact has been made.`})}}/><span>{p.name}</span></label>)}<Link href="/partners">Open partner directory ↗</Link></section>
   <section className={styles.card}><h2>References & export</h2><Link href="/outreach">ACS estimates, MOE and methodology ↗</Link><a href="https://humanservices.hawaii.gov/bessd/snap/" target="_blank" rel="noopener noreferrer">Official DHS SNAP guidance ↗</a><button className={styles.ghost} type="button" onClick={()=>window.print()}>Print workspace</button></section>
  </aside></div>
  {actionMessage&&<p className={styles.banner} role="status">{actionMessage}</p>}
  <p className={styles.disclaimer}>Demonstration workflow, not a constituent case management system. All figures are aggregate public ACS estimates. No actual enrollment, approval, communication or collaboration is asserted.</p>
 </WorkspaceShell>;
}
