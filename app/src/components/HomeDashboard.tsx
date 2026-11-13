"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HomeDashboard.module.css";

type Chamber = "House" | "Senate";
type Detail = { povertyRate: number | null; unemploymentRate: number | null; medianHomeValue: number | null; medianGrossRent: number | null; bachelorsOrHigherRate: number | null };
type Props = { chamber: Chamber; populations: Record<string, number>; incomes: Record<string, number>; details: Record<string, Detail>; onChamberChange: (next: Chamber) => void; onMap: () => void; onAskAI: () => void; mode: "night" | "day" };
const fmt = (v?: number | null) => v == null || !Number.isFinite(v) ? "Unavailable" : Math.round(v).toLocaleString("en-US");
const usd = (v?: number | null) => v == null || !Number.isFinite(v) ? "Unavailable" : `$${fmt(v)}`;
const pct = (v?: number | null) => v == null || !Number.isFinite(v) ? "Unavailable" : `${v.toFixed(1)}%`;
const median = (n: number[]) => { const v=n.filter(x=>Number.isFinite(x)).sort((a,b)=>a-b);return v.length ? (v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2 : null; };

export default function HomeDashboard({chamber,populations,incomes,details,onChamberChange,onMap,onAskAI,mode}:Props) {
  const [district,setDistrict] = useState("");
  const [profileName,setProfileName] = useState("");
  const [draftName,setDraftName] = useState("");
  const [draftDistrict,setDraftDistrict] = useState("");
  const [isOnboarded,setIsOnboarded] = useState<boolean | null>(null); // gc-profile-entry-fix-v1
  const [isSignedIn,setIsSignedIn] = useState(false); // gc-welcome-login-v1
  useEffect(() => {
    const openProfile = () => {
      try { sessionStorage.removeItem('gc-open-profile'); localStorage.removeItem('gc-demo-profile'); } catch {}
      setDraftName(profileName);
      setDraftDistrict(district);
      setDistrict('');
      setIsSignedIn(false);
      setIsOnboarded(false);
    };
    window.addEventListener('gc-open-profile', openProfile);
    try { if (sessionStorage.getItem('gc-open-profile') === '1') openProfile(); } catch {}
    return () => window.removeEventListener('gc-open-profile', openProfile);
  }, [profileName, district]);
  useEffect(() => {try {
    const data=JSON.parse(localStorage.getItem("gc-demo-profile") || "null");
    if (data && typeof data.name==="string" && /^(House|Senate)$/.test(data.chamber) && /^\d+$/.test(data.district)) {
      setProfileName(data.name); setDistrict(data.district); onChamberChange(data.chamber); setIsOnboarded(true);
    } else { setIsOnboarded(false); }
  }catch{setIsOnboarded(false);}}, []);
  const [search,setSearch] = useState("");
  const choices=useMemo(()=>Array.from(new Set([...Object.keys(populations),...Object.keys(incomes),...Object.keys(details)])).filter(x=>/^\d+$/.test(x)).sort((a,b)=>Number(a)-Number(b)),[populations,incomes,details]);
  const active=choices.includes(district)?district:(choices[0]??"");
  const d=details[active];
  const comparisons=useMemo(()=>[
    {label:"Poverty rate",value:d?.povertyRate,baseline:median(Object.values(details).map(x=>x.povertyRate).filter((x):x is number=>x!=null)),color:"pink"},
    {label:"Unemployment rate",value:d?.unemploymentRate,baseline:median(Object.values(details).map(x=>x.unemploymentRate).filter((x):x is number=>x!=null)),color:"teal"},
    {label:"Bachelor’s or higher, age 25+",value:d?.bachelorsOrHigherRate,baseline:median(Object.values(details).map(x=>x.bachelorsOrHigherRate).filter((x):x is number=>x!=null)),color:"purple"}
  ],[d,details]);
  const metrics=[
    {label:"Estimated population",value:fmt(populations[active]),color:"pink",info:"2024 ACS estimate"},
    {label:"Median household income",value:usd(incomes[active]),color:"teal",info:"USD annually · ACS"},
    {label:"Poverty rate",value:pct(d?.povertyRate),color:"purple",info:"People in poverty universe"},
    {label:"Unemployment rate",value:pct(d?.unemploymentRate),color:"gold",info:"Civilian labor force"}
  ];
  const submitSearch=(e:React.FormEvent)=>{e.preventDefault();const result=search.trim().match(/^(?:(?:house|senate|district|hd|sd)\s*#?\s*)?(\d{1,2})$/i)?.[1];if(!result)return;const next=String(Number(result));if(!choices.includes(next))return;setDistrict(next);setSearch("");try{const saved=JSON.parse(localStorage.getItem("gc-demo-profile")||"null");if(saved)localStorage.setItem("gc-demo-profile",JSON.stringify({...saved,district:next,chamber}));}catch{}};
  return <section className={`${styles.root} ${mode==="night"?styles.night:styles.day}`} aria-label="Going Concern Home dashboard">
    <div className={styles.scenery} aria-hidden="true"/>
    {(isOnboarded !== true || !isSignedIn) && <div className={styles.onboardingBackdrop}>
      {isOnboarded === null ? <div className={styles.onboardingCard} role="status" aria-live="polite"><h2>Opening your workspace…</h2><p>Checking your saved demo profile.</p></div>
       : isOnboarded === true ? <div className={styles.onboardingCard} role="dialog" aria-label="Welcome back to your district workspace" aria-modal="true">
        <span className={styles.eyebrow}>HAWAIʻI DISTRICT INTELLIGENCE</span>
        <h2>Aloha{profileName ? ", " + profileName : ""}.</h2>
        <p>Welcome back. Your saved district workspace is ready.</p>
        <div className={styles.welcomeSavedDistrict}>State {chamber} District {district}</div>
        <button type="button" autoFocus onClick={() => setIsSignedIn(true)}>Enter dashboard →</button>
        <button type="button" className={styles.welcomeSwitch} onClick={() => { try { localStorage.removeItem('gc-demo-profile'); } catch {} setDraftName(profileName); setDraftDistrict(''); setDistrict(''); setIsOnboarded(false); }}>Use a different profile</button>
        <small>This is a demonstration profile, not secure authentication.</small>
       </div> : (<>
      <form className={styles.onboardingCard} onSubmit={e=>{
        e.preventDefault();
        const cleanName=draftName.trim().slice(0,60);
        if(!cleanName || !draftDistrict || !choices.includes(draftDistrict)) return;
        const profile={name:cleanName,chamber,district:draftDistrict};
        try {localStorage.setItem("gc-demo-profile",JSON.stringify(profile));}catch{}
        setProfileName(cleanName);setDistrict(draftDistrict);setIsOnboarded(true);setIsSignedIn(true);
      }}>
        <span className={styles.eyebrow}>YOUR DISTRICT INTELLIGENCE WORKSPACE</span>
        <h2>Welcome to Hawaiʻi.</h2>
        <p>Choose your district once. Your name, district, and theme will be remembered in this browser. This is a demo profile, not a secure sign-in.</p>
        <label>Your name<input autoComplete="given-name" required maxLength={60} value={draftName} onChange={e=>setDraftName(e.target.value)} placeholder="e.g. Alex" /></label>
        <label>Legislative chamber
          <select value={chamber} onChange={e=>{onChamberChange(e.target.value as Chamber);setDraftDistrict("");}}>
            <option value="House">House</option><option value="Senate">Senate</option>
          </select>
        </label>
        <label>District
          <select required value={draftDistrict} onChange={e=>setDraftDistrict(e.target.value)} disabled={!choices.length}>
            <option value="">Select your district</option>
            {choices.map(n=><option value={n} key={n}>District {n}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!draftDistrict||!draftName.trim()}>Enter workspace →</button>
        <small>2024 ACS 5-Year Estimates · Public population-level data only</small>
      </form>
      </>)}
    </div>}
    <div className={styles.shell}>
      <div className={styles.welcome}>
        {/* gc-nav-search-refinement-v1: working district navigation search */}
        <form className={styles.topSearch} onSubmit={submitSearch} role="search" aria-label="Find legislative district">
          <svg className={styles.topSearchIcon} viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" fill="none"/><path d="m16 16 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <input aria-label="Search district number" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${chamber} districts…`} inputMode="numeric" />
          <button type="submit">Go</button>
        </form>
        <div><h2>Aloha{profileName ? `, ${profileName}` : ""}.</h2></div>
      </div>
      <div className={styles.titleRow}>
        <div><span className={styles.eyebrow}>DISTRICT OVERVIEW</span><h3>{active?`State ${chamber} District ${active}`:"Loading district data"}</h3><p>2024 ACS 5-Year Estimates · 2022 legislative district boundaries</p></div>
        <div className={styles.controls}>
          <button type="button" className={styles.profileAction} onClick={() => {
            try { localStorage.removeItem("gc-demo-profile"); } catch {}
            setDraftName(profileName); setDraftDistrict(district); setDistrict(""); setIsSignedIn(false); setIsOnboarded(false);
          }}>Change profile</button>
          <div className={styles.segment} role="group" aria-label="Legislative chamber">{(["House","Senate"] as const).map(c=><button key={c} type="button" aria-pressed={chamber===c} className={chamber===c?styles.picked:""} onClick={()=>onChamberChange(c)}>{c}</button>)}</div>
          <label className={styles.districtLabel}>District <select value={active} disabled={!choices.length} onChange={e=>{ setDistrict(e.target.value); try { const p=JSON.parse(localStorage.getItem("gc-demo-profile")||"null"); if(p) localStorage.setItem("gc-demo-profile",JSON.stringify({...p,district:e.target.value,chamber})); }catch{} }}>{choices.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
          
        </div>
      </div>
      <div className={styles.columns}>
        <div className={styles.analysis}>
          <div className={styles.stats}>{metrics.map(m=><article className={`${styles.glass} ${styles.stat} ${styles[m.color]}`} key={m.label}><span className={styles.statLabel}>{m.label}</span><strong>{m.value}</strong><small>{m.info}</small></article>)}</div>
          <div className={styles.bottomGrid}>
            <article className={`${styles.glass} ${styles.chartCard}`}>
              <div className={styles.cardHeading}><div><span className={styles.eyebrow}>CURRENT-YEAR COMPARISON</span><h4>District indicators</h4></div><span className={styles.pill}>2024 ACS</span></div>
              <p className={styles.intro}>District percentage versus median of {chamber.toLowerCase()} districts. These are not historical trends or statewide benchmarks.</p>
              <div className={styles.chartRows}>{comparisons.map(item=>{const max=Math.max(item.value??0,item.baseline??0,1)*1.15;return <div className={styles.chartRow} key={item.label}><div className={styles.chartName}><span>{item.label}</span><strong>{pct(item.value)}</strong></div><div className={styles.barTrack}><span className={`${styles.bar} ${styles[item.color]}`} style={{width:`${Math.max(0,Math.min(100,((item.value??0)/max)*100))}%`}}/>{item.baseline!=null&&<span className={styles.medianMark} style={{left:`${Math.min(100,item.baseline/max*100)}%`}} title={`Chamber median ${pct(item.baseline)}`}/>}</div><small>{item.baseline==null?"Comparison unavailable":`Chamber median: ${pct(item.baseline)}`}</small></div>})}</div>
            </article>
            <article className={`${styles.glass} ${styles.insightCard}`}><span className={styles.eyebrow}>DISTRICT INTELLIGENCE</span><h4>Key takeaways</h4><div className={styles.takeaways}><div><span>◈</span><p>Estimated population: <strong>{fmt(populations[active])}</strong></p></div><div><span>✦</span><p>Median monthly gross rent: <strong>{usd(d?.medianGrossRent)}</strong></p></div><div><span>◇</span><p>Median owner-occupied home value: <strong>{usd(d?.medianHomeValue)}</strong></p></div></div><p className={styles.caution}>Survey estimates, not exact resident counts. Program eligibility and unmet enrollment are not determined by these indicators alone.</p><button type="button" className={styles.secondaryAction} onClick={onMap}>View district map ↗</button></article>
          </div>
          <div className={styles.sources}>SOURCE: U.S. Census Bureau, 2024 ACS 5-Year Estimates · Geographic boundaries: State of Hawaiʻi GIS (2022) · Public aggregated data only</div>
        </div>
        <aside className={`${styles.glass} ${styles.advisor}`} aria-label="AI District Advisor">
          <div className={styles.advisorHead}><span className={styles.sparkle}>✧</span><div><h4>AI District Advisor</h4><small>Research and program intelligence</small></div></div>
          <p className={styles.advisorIntro}>Explore this district with grounded Census insights and official program sources.</p>
          <div className={styles.advisorButtons}>
            <button onClick={onAskAI} type="button">✦ <span>Ask about district {active || "data"}</span><b>›</b></button>
            <a href="/programs">◇ <span>Find relevant programs</span><b>›</b></a>
            <button onClick={onMap} type="button">▤ <span>Explore geographic layers</span><b>›</b></button>
          </div>
          <div className={styles.advisorNote}><span>✧</span> AI answers require source verification. No individual eligibility decisions.</div>
          <button type="button" className={styles.askButton} onClick={onAskAI}>Ask the AI District Advisor <span>↗</span></button>
        </aside>
      </div>
    </div>
  </section>;
}
