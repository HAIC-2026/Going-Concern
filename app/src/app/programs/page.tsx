"use client";

import { useEffect, useState } from "react";

type Evidence = { indicator: string; districtValue: number; referenceMedian: number; direction: string };
type Match = {
  program: { id: string; name: string; administeringAgency: string; category: string; whoItServes: string; eligibilitySummary: string; officialUrl: string; verifiedOn: string; matchingNote: string; enrollmentGapAvailable: boolean };
  evidence: Evidence[];
  explanation: string;
  status: "indicator-supported" | "not-assessed";
};
type Result = { chamber: string; district: { name: string }; dataset: string; matchingMethod: string; matches: Match[] };

const INDICATORS: Record<string, string> = { povertyRate: "Poverty rate", medianHouseholdIncome: "Median household income", unemploymentRate: "Unemployment rate" };
function fmt(key: string, n: number) { return key === "medianHouseholdIncome" ? `$${n.toLocaleString("en-US")}` : `${n.toFixed(1)}%`; }

export default function ProgramsPage() {
  const [chamber, setChamber] = useState<"House" | "Senate">("House");
  const [district, setDistrict] = useState(13);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/programs?chamber=${chamber}&district=${district}`, { signal: ctrl.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Unable to load programs");
        setResult(data);
        setError("");
      })
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setResult(null); } })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    return () => ctrl.abort();
  }, [chamber, district]);
  return <main style={{ minHeight: "100vh", padding: "32px max(24px, 6vw)", background: "#0f151b", color: "#eef3f5", fontFamily: "Arial, sans-serif" }}>
    <a href="/" style={{ color: "#a7dbe1" }}>← District Explorer</a>
    <header style={{ margin: "26px 0" }}><h1 style={{ fontSize: 30, fontWeight: 700 }}>Program Discovery</h1>
      <p style={{ color: "#b8c7d0", maxWidth: 780, lineHeight: 1.5 }}>Explore government assistance programs relevant to district-level outreach. These are informational leads, not determinations of individual eligibility or proof of an enrollment gap.</p></header>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
      <label>Chamber <select value={chamber} onChange={e => { const c=e.target.value as "House"|"Senate";setChamber(c);setDistrict(1);setBusy(true); }} style={inputStyle}><option>House</option><option>Senate</option></select></label>
      <label>District <select value={district} onChange={e => {setDistrict(Number(e.target.value));setBusy(true);}} style={inputStyle}>{Array.from({ length: chamber === "House" ? 51 : 25 },(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
    </div>
    {busy && <p role="status">Loading Census data and matching programs…</p>}
    {error && <p role="alert" style={{ color: "#ffb0a6" }}>{error}</p>}
    {result && !busy && <>
      <h2 style={{ fontSize: 21, fontWeight: 650, marginBottom: 8 }}>{result.district.name}</h2>
      <p style={{ color: "#b8c7d0", marginBottom: 24 }}>Source: U.S. Census Bureau · {result.dataset} · Same-chamber median comparison. No district-level enrollment gaps calculated.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 16 }}>
        {result.matches.map(m=><article key={m.program.id} style={{ border: "1px solid #354650", background: "#19232b", borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: m.evidence.length ? "#b7e4cf" : "#bac4cc" }}>{m.evidence.length ? "Review for potential outreach" : "No indicator signal / data unavailable"}</p>
          <h3 style={{ fontWeight: 700, fontSize: 20, margin: "10px 0" }}>{m.program.name}</h3>
          <p style={{ color: "#c5d0d5", fontSize: 14, marginBottom: 10 }}>{m.program.administeringAgency}</p>
          <p style={{ lineHeight: 1.5 }}>{m.program.whoItServes}</p>
          <p style={{ marginTop: 10, lineHeight: 1.5, color: "#cad5da", fontSize: 14 }}>{m.program.eligibilitySummary}</p>
          {m.evidence.length>0 && <div style={{ marginTop: 14, padding: 12, background: "#10202a", borderRadius: 8 }}><strong>Observed screening indicators</strong>{m.evidence.map(e=><p key={e.indicator} style={{ marginTop: 8, fontSize: 14 }}>{INDICATORS[e.indicator] || e.indicator}: {fmt(e.indicator,e.districtValue)} ({e.direction} chamber median of {fmt(e.indicator,e.referenceMedian)})</p>)}</div>}
          <p style={{ color: "#aebdc4", fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>{m.explanation}</p>
          <p style={{ color: "#aebdc4", fontSize: 12, marginTop: 8 }}>{m.program.matchingNote}</p>
          <a href={m.program.officialUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", color: "#8dd9e8", marginTop: 16, fontWeight: 600 }}>Official program website ↗</a>
        </article>)}
      </div>
      <p style={{ color: "#aebdc4", marginTop: 26, maxWidth: 880, lineHeight: 1.5 }}>Method: {result.matchingMethod} Census sampling uncertainty is not yet incorporated into matching thresholds. Program details and official links should be periodically reverified. Do not use this output to deny services or determine individual eligibility.</p>
    </>}
  </main>;
}
const inputStyle: React.CSSProperties = { display:"block", marginTop:8, minWidth:150, padding:10, background:"#25333e", color:"white", border:"1px solid #556570", borderRadius:7 };
