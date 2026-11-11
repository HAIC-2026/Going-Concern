
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Chamber = "House" | "Senate";
type ChatMessage = { role: "user" | "assistant"; content: string };
type MapLayer = "boundaries" | "population" | "income" | "povertyRate" | "unemploymentRate" | "medianHomeValue" | "medianGrossRent" | "bachelorsOrHigherRate";
type LayerDefinition = { label: string; title: string; thresholds: number[]; labels: string[]; unit: string };
const LAYER_DEFINITIONS: Record<Exclude<MapLayer, "boundaries">, LayerDefinition> = {
  population: { label: "Population", title: "ESTIMATED POPULATION", thresholds: [22000, 26000, 30000, 35000], labels: ["Under 22,000", "22,000–25,999", "26,000–29,999", "30,000–34,999", "35,000+"], unit: "residents" },
  income: { label: "Median household income", title: "ANNUAL HOUSEHOLD INCOME", thresholds: [60000, 80000, 100000, 120000], labels: ["Under $60k", "$60k–$79,999", "$80k–$99,999", "$100k–$119,999", "$120k+"], unit: "USD annually" },
  povertyRate: { label: "Poverty rate", title: "POVERTY RATE", thresholds: [5, 10, 15, 20], labels: ["Under 5%", "5–9.9%", "10–14.9%", "15–19.9%", "20%+"], unit: "% of poverty universe" },
  unemploymentRate: { label: "Unemployment rate", title: "UNEMPLOYMENT RATE", thresholds: [3, 5, 7, 10], labels: ["Under 3%", "3–4.9%", "5–6.9%", "7–9.9%", "10%+"], unit: "% of civilian labor force" },
  medianHomeValue: { label: "Median home value", title: "MEDIAN HOME VALUE", thresholds: [500000, 700000, 900000, 1100000], labels: ["Under $500k", "$500k–$699,999", "$700k–$899,999", "$900k–$1.1m", "$1.1m+"], unit: "USD, owner-occupied" },
  medianGrossRent: { label: "Median gross rent", title: "MEDIAN GROSS RENT", thresholds: [1200, 1600, 2000, 2400], labels: ["Under $1,200", "$1,200–$1,599", "$1,600–$1,999", "$2,000–$2,399", "$2,400+"], unit: "USD per month" },
  bachelorsOrHigherRate: { label: "Bachelor's degree or higher", title: "BACHELOR'S DEGREE OR HIGHER", thresholds: [20, 30, 40, 50], labels: ["Under 20%", "20–29.9%", "30–39.9%", "40–49.9%", "50%+"], unit: "% of adults age 25+" },
};
const LAYER_COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6"];

// Rent breaks adapt to the actual ACS estimates for the selected chamber.
// Rounded $100 increments preserve meaningful dollar ranges without forcing quintiles.
function getRentBreaks(values: number[]): number[] | null {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length < 2) return null;
  const minimum = Math.min(...valid);
  const maximum = Math.max(...valid);
  if (maximum <= minimum) return null;
  const lower = Math.floor(minimum / 100) * 100;
  const upper = Math.ceil(maximum / 100) * 100;
  const step = Math.max(100, Math.ceil((upper - lower) / 500) * 100);
  return [1, 2, 3, 4].map((index) => lower + index * step);
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

const LAYER_CONTEXT: Record<Exclude<MapLayer, "boundaries">, string> = {
  population: "Higher means more residents, not greater population density. Neither end is inherently better.",
  income: "Higher household income generally indicates greater purchasing power. This is not a measure of living costs.",
  povertyRate: "Higher poverty rates indicate a larger share of residents below the federal poverty threshold.",
  unemploymentRate: "Higher unemployment indicates greater labor-market challenges among the civilian labor force.",
  medianHomeValue: "Higher values indicate more expensive owner-occupied homes; this is not inherently good or bad.",
  medianGrossRent: "Higher rents can signal greater housing-cost pressure. Compare with local income before judging affordability.",
  bachelorsOrHigherRate: "Higher values indicate a greater share of adults age 25+ with a bachelor's degree or higher; this is not a measure of individual ability.",
};

const HIGH_IS_RED: MapLayer[] = ["povertyRate", "unemploymentRate", "medianGrossRent"];


type SelectedDistrict = {
  name: string;
  chamber: Chamber;
};
type DistrictPopulation = Record<string, number>;
type DistrictIncome = Record<string, number>;
type PopulationStatus = "loading" | "ready" | "error";
type ExtraMetrics = {
  povertyRate: number | null;
  unemploymentRate: number | null;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
  bachelorsOrHigherRate: number | null;
};
type DistrictMetrics = Record<string, ExtraMetrics>;

const HawaiiMap = dynamic(
  () => import("../components/HawaiiMap"),
  {
    ssr: false,
    loading: () => (
      <div style={{ color: "#d4d8dc", padding: 24 }}>
        Loading Hawaiʻi map...
      </div>
    ),
  }
);

const NAV_ITEMS = [
  { icon: "◈", label: "District Explorer", active: true },
  { icon: "▤", label: "Data Layers", active: false },
  { icon: "▥", label: "Compare Districts", active: false },
  { icon: "✧", label: "AI Insights", active: false },
];

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chamber, setChamber] = useState<Chamber>("House");
  const [selectedDistrict, setSelectedDistrict] =
    useState<SelectedDistrict | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("boundaries");
  const [layersOpen, setLayersOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    const previous = chatMessages;
    setChatMessages([...previous, { role: "user", content: message }]);
    setChatInput("");
    setChatError("");
    setChatBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: previous.slice(-6) }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.answer !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "Chat request failed.");
      }
      setChatMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to reach the chatbot.");
    } finally {
      setChatBusy(false);
    }
  }

  const [populationData, setPopulationData] = useState<
    Record<Chamber, DistrictPopulation>
  >({ House: {}, Senate: {} });

  const [incomeData, setIncomeData] = useState<
    Record<Chamber, DistrictIncome>
  >({ House: {}, Senate: {} });

  const [extraMetrics, setExtraMetrics] = useState<Record<Chamber, DistrictMetrics>>({
    House: {}, Senate: {},
  });

  const [populationStatus, setPopulationStatus] = useState<
    Record<Chamber, PopulationStatus>
  >({ House: "loading", Senate: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadCensusData(selectedChamber: Chamber) {
      try {
        const response = await fetch(
          `/api/census?chamber=${selectedChamber}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Census request failed");
        }

        const data = await response.json();

        if (!Array.isArray(data.rows) || !Array.isArray(data.incomeRows) || !Array.isArray(data.districts)) {
          throw new Error("Invalid Census response");
        }

        const population: DistrictPopulation = {};

        for (const row of data.rows.slice(1)) {
          const number = String(Number(row[3]));
          const value = Number(row[1]);

          if (
            number !== "NaN" &&
            Number.isFinite(value) &&
            value >= 0
          ) {
            population[number] = value;
          }
        }

        const income: DistrictIncome = {};

        for (const row of data.incomeRows.slice(1)) {
          if (!Array.isArray(row) || row.length < 4) continue;

          const districtId = Number(row[3]);
          const estimate = Number(row[1]);

          // Census uses negative sentinel values for unavailable estimates.
          if (
            Number.isInteger(districtId) &&
            districtId > 0 &&
            Number.isFinite(estimate) &&
            estimate >= 0 &&
            row[1] !== ""
          ) {
            income[String(districtId)] = estimate;
          }
        }

        const metrics: DistrictMetrics = {};
        const validMetric = (value: unknown): number | null =>
          typeof value === "number" && Number.isFinite(value) && value >= 0
            ? value
            : null;
        for (const district of data.districts) {
          if (!district || typeof district !== "object") continue;
          const districtId = Number(district.district);
          if (!Number.isInteger(districtId) || districtId <= 0) continue;
          metrics[String(districtId)] = {
            povertyRate: validMetric(district.povertyRate),
            unemploymentRate: validMetric(district.unemploymentRate),
            medianHomeValue: validMetric(district.medianHomeValue),
            medianGrossRent: validMetric(district.medianGrossRent),
            bachelorsOrHigherRate: validMetric(district.bachelorsOrHigherRate),
          };
        }

        if (!controller.signal.aborted) {
          setExtraMetrics((previous) => ({
            ...previous,
            [selectedChamber]: metrics,
          }));
          setIncomeData((previous) => ({
            ...previous,
            [selectedChamber]: income,
          }));

          setPopulationData((previous) => ({
            ...previous,
            [selectedChamber]: population,
          }));

          setPopulationStatus((previous) => ({
            ...previous,
            [selectedChamber]: "ready",
          }));
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(error);

        setPopulationStatus((previous) => ({
          ...previous,
          [selectedChamber]: "error",
        }));
      }
    }

    loadCensusData("House");
    loadCensusData("Senate");

    return () => controller.abort();
  }, []);

  function handleDistrictSelect(
    name: string,
    selectedChamber: Chamber
  ) {
    setChamber(selectedChamber);
    setSelectedDistrict({ name, chamber: selectedChamber });
    setPanelOpen(true);
  }

  function handleChamberChange(nextChamber: Chamber) {
    setChamber(nextChamber);
    setSelectedDistrict(null);
    setPanelOpen(false);
  }

  const rentValues = Object.values(extraMetrics[chamber])
    .map((metrics) => metrics.medianGrossRent)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const rentBreaks = getRentBreaks(rentValues);
  const activeDefinition = mapLayer === "boundaries" ? null : LAYER_DEFINITIONS[mapLayer];
  const activeLabels = mapLayer === "medianGrossRent" && rentBreaks
    ? [
        `Below ${money(rentBreaks[0])}`,
        `${money(rentBreaks[0])}–${money(rentBreaks[1] - 1)}`,
        `${money(rentBreaks[1])}–${money(rentBreaks[2] - 1)}`,
        `${money(rentBreaks[2])}–${money(rentBreaks[3] - 1)}`,
        `${money(rentBreaks[3])}+`,
      ]
    : activeDefinition?.labels ?? [];
  const rentExtent = rentValues.length
    ? `${money(Math.min(...rentValues))}–${money(Math.max(...rentValues))}`
    : null;

  const districtNumber =
    selectedDistrict?.name.match(/\d+/)?.[0];

  const population =
    selectedDistrict && districtNumber
      ? populationData[selectedDistrict.chamber][
          String(Number(districtNumber))
        ]
      : undefined;

  const income =
    selectedDistrict && districtNumber
      ? incomeData[selectedDistrict.chamber][String(Number(districtNumber))]
      : undefined;

  const selectedMetrics = selectedDistrict && districtNumber
    ? extraMetrics[selectedDistrict.chamber][String(Number(districtNumber))]
    : undefined;

  function extraDisplay(key: keyof ExtraMetrics, kind: "percent" | "currency") {
    if (!selectedDistrict) return "—";
    const status = populationStatus[selectedDistrict.chamber];
    if (status === "loading") return "Loading...";
    if (status === "error") return "Unavailable";
    const value = selectedMetrics?.[key];
    if (value === null || value === undefined) return "Unavailable";
    return kind === "percent"
      ? `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
      : value.toLocaleString("en-US", {
          style: "currency", currency: "USD", maximumFractionDigits: 0,
        });
  }

  function incomeDisplay() {
    if (!selectedDistrict) return "—";

    const status = populationStatus[selectedDistrict.chamber];
    if (status === "loading") return "Loading...";
    if (status === "error") return "Unavailable";

    return income !== undefined
      ? income.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "Unavailable";
  }

  function populationDisplay() {
    if (!selectedDistrict) return "—";

    const status = populationStatus[selectedDistrict.chamber];

    if (status === "loading") return "Loading...";
    if (status === "error") return "Unavailable";

    return population !== undefined
      ? population.toLocaleString()
      : "Unavailable";
  }

  return (
    <main
      className={`workspace ${
        sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      {/* Full-screen map */}
      <div className="map-canvas">
        <HawaiiMap
          chamber={chamber}
          mapLayer={mapLayer}
          rentThresholds={rentBreaks ?? undefined}
          incomeByDistrict={incomeData[chamber]}
          valuesByDistrict={Object.fromEntries(
            Object.entries(extraMetrics[chamber]).map(([id, metrics]) => [id, {
              ...metrics,
              population: populationData[chamber][id] ?? null,
              income: incomeData[chamber][id] ?? null,
            }])
          )}
          onDistrictSelect={handleDistrictSelect}
        />
      </div>

      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">◈</div>

          <div>
            <h1>DISTRICT INTELLIGENCE</h1>
            <p>Hawaiʻi Geospatial Analytics Platform</p>
          </div>
        </div>

        <div className="chamber-switch" role="group" aria-label="Legislative chamber">
          {(["House", "Senate"] as Chamber[]).map((item) => (
            <button
              key={item}
              type="button"
              className={chamber === item ? "selected" : ""}
              aria-pressed={chamber === item}
              onClick={() => handleChamberChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {/* Sidebar and attached collapse handle */}
      <aside className="sidebar">
        <div className="sidebar-content">
          <p className="section-label">
            {sidebarOpen ? "WORKSPACE" : "•••"}
          </p>

          <nav aria-label="Main navigation">
            {NAV_ITEMS.map((item) =>
              item.label === "AI Insights" ? (
                <button key={item.label} type="button"
                  className={`nav-item nav-button ${chatOpen ? "active" : ""}`}
                  onClick={() => { setSidebarOpen(true); setChatOpen(true); }}
                  title="AI Insights">
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ) : item.label === "Data Layers" ? (
                <button
                  key={item.label}
                  type="button"
                  className={`nav-item nav-button ${layersOpen ? "active" : ""}`}
                  onClick={() => {
                    setSidebarOpen(true);
                    setLayersOpen((open) => !open);
                  }}
                  aria-expanded={layersOpen}
                  title="Data Layers"
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ) : (
                <div
                  key={item.label}
                  className={`nav-item ${item.active ? "active" : "disabled"}`}
                  title={item.label}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </div>
              )
            )}
            {sidebarOpen && layersOpen && (
              <div className="layer-options" aria-label="Map data layer">
                <p>MAP COLORING</p>
                <label>
                  <input type="radio" name="map-layer" checked={mapLayer === "boundaries"}
                    onChange={() => setMapLayer("boundaries")} />
                  Boundaries only
                </label>
                {(Object.entries(LAYER_DEFINITIONS) as [Exclude<MapLayer, "boundaries">, LayerDefinition][]).map(([id, definition]) => (
                  <label key={id}>
                    <input type="radio" name="map-layer" checked={mapLayer === id}
                      onChange={() => setMapLayer(id)} />
                    {definition.label}
                  </label>
                ))}

              </div>
            )}
          </nav>

          {sidebarOpen && (
            <div className="sources">
              <strong>DATA SOURCES</strong>
              <p>State of Hawaiʻi GIS</p>
              <p>U.S. Census Bureau</p>
              <p>2024 ACS 5-Year</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="collapse-handle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={
            sidebarOpen
              ? "Collapse sidebar"
              : "Expand sidebar"
          }
          aria-expanded={sidebarOpen}
          title={
            sidebarOpen
              ? "Collapse sidebar"
              : "Expand sidebar"
          }
        >
          {sidebarOpen ? "‹" : "›"}
        </button>
      </aside>

      {/* Right-side intelligence panel */}
      <aside
        className={`intelligence-panel ${
          panelOpen ? "visible" : ""
        }`}
        aria-hidden={!panelOpen}
      >
        <div className="panel-heading">
          <span>DISTRICT INTELLIGENCE</span>

          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Close district intelligence"
            tabIndex={panelOpen ? 0 : -1}
          >
            ✕
          </button>
        </div>

        {selectedDistrict && (
          <>
            <h2>{selectedDistrict.name}</h2>

            <p className="panel-subtitle">
              Hawaiʻi State {selectedDistrict.chamber}
            </p>

            <div className="population-card">
              <p>ESTIMATED POPULATION</p>
              <strong>{populationDisplay()}</strong>
              <span>2024 ACS 5-Year Estimates</span>
            </div>

            <div className="income-card">
              <p>MEDIAN HOUSEHOLD INCOME</p>
              <strong>{incomeDisplay()}</strong>
              <span>2024 ACS 5-Year Estimates · Annual</span>
            </div>

            <div className="extra-metrics">
              <h3>ECONOMIC &amp; HOUSING INDICATORS</h3>
              <div className="metric-grid">
                {([
                  ["POVERTY RATE", "povertyRate", "percent", "People below poverty threshold"],
                  ["UNEMPLOYMENT RATE", "unemploymentRate", "percent", "Civilian labor force"],
                  ["MEDIAN HOME VALUE", "medianHomeValue", "currency", "Owner-occupied housing units"],
                  ["MEDIAN GROSS RENT", "medianGrossRent", "currency", "Monthly rent"],
                  ["BACHELOR'S OR HIGHER", "bachelorsOrHigherRate", "percent", "Adults age 25+"],
                ] as const).map(([label, key, kind, description]) => (
                  <div className="metric-card" key={key}>
                    <p>{label}</p>
                    <strong>{extraDisplay(key, kind)}</strong>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
              <p className="metric-source">2024 ACS 5-Year Estimates · U.S. Census Bureau</p>
            </div>

            <div className="details">
              <h3>District Details</h3>

              <p>
                Chamber:{" "}
                <strong>{selectedDistrict.chamber}</strong>
              </p>

              <p>
                Boundary Year: <strong>2022</strong>
              </p>

              <p>
                GIS Source: <strong>State of Hawaiʻi</strong>
              </p>
            </div>

            <div className="coming-soon">
              Additional program intelligence and geographic comparisons
              will appear as more data sources are integrated.
            </div>
          </>
        )}
      </aside>

             {/* Contextual map legend: matches the same thresholds used by HawaiiMap. */}
       {activeDefinition && (
         <section className={`map-legend ${panelOpen ? "district-visible" : ""} ${chatOpen ? "chat-visible" : ""}`}
           aria-label={`${activeDefinition.label} map legend`}>
           <div className="map-legend-header">
             <strong>{activeDefinition.label}</strong>
             <span>2024 ACS 5-Year · {chamber}</span>
           </div>
           <div className="map-legend-scale" aria-label="Five color bands">
             {activeLabels.map((label, index) => (
               <div className="map-legend-band" key={`${index}-${label}`}>
                 <span className="map-legend-swatch" style={{ backgroundColor: LAYER_COLORS[HIGH_IS_RED.includes(mapLayer) ? 4 - index : index] }} />
                 <span className="map-legend-range">{label}</span>
               </div>
             ))}
           </div>
           <div className="map-legend-direction">
             <span>← Lower {activeDefinition.unit}</span>
             <span>Higher {activeDefinition.unit} →</span>
           </div>
           <p className="map-legend-explanation">{LAYER_CONTEXT[mapLayer as Exclude<MapLayer, "boundaries">]}</p>
           <p className="map-legend-footnote">
             {mapLayer === "medianGrossRent"
               ? rentBreaks
                 ? `Adaptive $100-rounded bands · Observed ${chamber} district range: ${rentExtent}. Relative to this chamber; not affordability rankings.`
                 : "Waiting for enough valid district rent estimates; using the standard scale until data loads."
               : "Fixed bands allow consistent comparison between House and Senate districts."}
             {" · Gray = no estimate"}
           </p>
         </section>
       )}

{/* Compact AI assistant. Keeps its conversation when minimized. */}
      {!chatOpen && (
        <button type="button" className={`chat-launcher ${panelOpen ? "panel-shift" : ""}`}
          onClick={() => setChatOpen(true)} aria-label="Open AI Insights assistant" title="Ask AI Insights">
          <span aria-hidden="true">✧</span> Ask AI
        </button>
      )}
      <aside className={`chat-panel ${chatOpen ? "visible" : ""} ${panelOpen ? "panel-shift" : ""}`}
        aria-hidden={!chatOpen} aria-label="AI Insights assistant">
        <div className="chat-heading">
          <div><strong>✧ AI INSIGHTS</strong><p>Hawaiʻi district research assistant</p></div>
          <button type="button" onClick={() => setChatOpen(false)} aria-label="Minimize AI Insights" title="Minimize chat">−</button>
        </div>
        <div className="chat-messages" aria-live="polite">
          {chatMessages.length === 0 && (
            <div className="chat-welcome">
              <h2>Ask about Hawaiʻi districts</h2>
              <p>Answers use 2024 ACS 5-Year Census estimates for House and Senate districts.</p>
              {[
                "Which five House districts have the highest poverty rates?",
                "Compare House Districts 1 and 31.",
                "Which Senate districts have the highest median household income?",
              ].map((question) => (
                <button key={question} type="button" onClick={() => setChatInput(question)}>{question}</button>
              ))}
            </div>
          )}
          {chatMessages.map((message, index) => (
            <div key={index} className={`chat-bubble ${message.role}`}>
              <span>{message.role === "user" ? "YOU" : "AI INSIGHTS"}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {chatBusy && <p className="chat-status">Analyzing Census estimates...</p>}
          {chatError && <p className="chat-error" role="alert">{chatError}</p>}
        </div>
        <form className="chat-form" onSubmit={sendChat}>
          <textarea aria-label="Ask AI Insights" placeholder="Ask about districts, rankings, or comparisons..."
            value={chatInput} onChange={(event) => setChatInput(event.target.value)}
            maxLength={1200} rows={2} disabled={chatBusy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
          <button type="submit" disabled={chatBusy || !chatInput.trim()}>{chatBusy ? "Working..." : "Send →"}</button>
          <small>2024 ACS 5-Year Estimates · AI responses may contain errors; verify important figures.</small>
        </form>
      </aside>

      <style jsx>{`
        .workspace {
          position: relative;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: #0d0f11;
          color: #f4f5f6;
          font-family: Arial, Helvetica, sans-serif;
          --sidebar-width: 228px;
        }

        .workspace.sidebar-collapsed {
          --sidebar-width: 62px;
        }

        .map-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: hidden;
        }

        .map-canvas :global(.leaflet-container) {
          width: 100%;
          height: 100%;
        }

        .topbar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 72px;
          z-index: 1200;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 24px;
          background: rgba(16, 18, 20, 0.97);
          border-bottom: 1px solid #383d42;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-symbol {
          color: #d6dbe0;
          font-size: 26px;
        }

        .brand h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .brand p {
          color: #a7adb4;
          font-size: 12px;
          margin-top: 5px;
        }

        .chamber-switch {
          display: flex;
          gap: 4px;
          padding: 5px;
          border-radius: 10px;
          background: #202327;
          border: 1px solid #383d42;
        }

        .chamber-switch button {
          border: 0;
          border-radius: 7px;
          padding: 9px 16px;
          background: transparent;
          color: #d4d8dc;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .chamber-switch button.selected {
          background: #50575e;
          color: #ffffff;
        }

        .chamber-switch button:focus-visible {
          outline: 2px solid #d6dbe0;
          outline-offset: 2px;
        }

        .topbar-label {
          font-size: 11px;
          color: #d6dbe0;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .sidebar {
          position: absolute;
          top: 72px;
          bottom: 0;
          left: 0;
          width: var(--sidebar-width);
          z-index: 1100;
          background: rgba(19, 21, 24, 0.97);
          border-right: 1px solid #383d42;
          transition: width 0.28s ease;
          overflow: visible;
        }

        .sidebar-content {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px 14px;
        }

        .section-label {
          color: #a7adb4;
          font-size: 11px;
          letter-spacing: 1.5px;
          margin: 0 12px 20px;
          white-space: nowrap;
        }

        .nav-item {
          display: flex;
          gap: 12px;
          align-items: center;
          height: 46px;
          padding: 0 12px;
          margin-bottom: 6px;
          border-radius: 8px;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
        }

        .nav-icon {
          flex: 0 0 20px;
          font-size: 19px;
          text-align: center;
        }

        .nav-label {
          overflow: hidden;
        }


        .nav-button {
          width: 100%;
          border: 0;
          background: transparent;
          color: inherit;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }
        .layer-options {
          margin: 6px 2px 14px;
          padding: 12px;
          background: #202327;
          border: 1px solid #383d42;
          border-radius: 9px;
          font-size: 12px;
        }
        .layer-options > p, .income-legend > p {
          margin: 0 0 10px;
          font-size: 10px;
          letter-spacing: 0.8px;
          color: #a7adb4;
        }
        .layer-options label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 10px 0;
          cursor: pointer;
        }
        .layer-options input { accent-color: #c5cbd1; }
        .income-legend {
          border-top: 1px solid #383d42;
          margin-top: 14px;
          padding-top: 12px;
        }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 7px 0;
          color: #d4d8dc;
        }
        .legend-row span {
          width: 14px;
          height: 12px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .income-legend small { color: #a7adb4; }

        .nav-item.active {
          background: #30363b;
          color: #d6dbe0;
          font-weight: 700;
        }

        .nav-item.disabled {
          color: #a7adb4;
          opacity: 0.65;
          cursor: not-allowed;
        }

        .sidebar-collapsed .sidebar-content {
          padding: 24px 8px;
        }

        .sidebar-collapsed .section-label {
          text-align: center;
          margin: 0 0 20px;
          font-size: 9px;
        }

        .sidebar-collapsed .nav-item {
          justify-content: center;
          padding: 0;
        }

        .sidebar-collapsed .nav-label {
          display: none;
        }

        .collapse-handle {
          position: absolute;
          top: 50%;
          right: -19px;
          transform: translateY(-50%);
          width: 19px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #383d42;
          border-left: none;
          border-radius: 0 7px 7px 0;
          background: #202327;
          color: #a7adb4;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          z-index: 1300;
          transition:
            color 0.2s ease,
            background 0.2s ease;
        }

        .collapse-handle:hover {
          color: #d6dbe0;
          background: #202327;
        }

        .collapse-handle:focus-visible {
          outline: 2px solid #d6dbe0;
          outline-offset: 2px;
        }

        .sources {
          margin-top: 36px;
          padding: 16px;
          border: 1px solid #383d42;
          background: #202327;
          border-radius: 10px;
        }

        .sources strong {
          font-size: 12px;
        }

        .sources p {
          color: #a7adb4;
          font-size: 12px;
          margin-top: 9px;
        }

        /*
          Move the map's existing House/Senate controls
          according to the sidebar width.
        */
        .map-canvas :global(> div > div[style*="z-index: 1000"]) {
          transition: left 0.28s ease;
        }

        .intelligence-panel {
          position: absolute;
          top: 88px;
          bottom: 16px;
          right: 16px;
          width: 350px;
          max-width: calc(100vw - 32px);
          z-index: 1100;
          background: rgba(27, 30, 33, 0.98);
          border: 1px solid #383d42;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
          transform: translateX(calc(100% + 32px));
          opacity: 0;
          visibility: hidden;
          transition:
            transform 0.3s ease,
            opacity 0.3s ease,
            visibility 0.3s ease;
          overflow-y: auto;
          pointer-events: none;
        }

        .intelligence-panel.visible {
          transform: translateX(0);
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #d6dbe0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .panel-heading button {
          background: transparent;
          border: none;
          color: #d4d8dc;
          font-size: 18px;
          cursor: pointer;
        }

        .intelligence-panel h2 {
          margin-top: 28px;
          font-size: 26px;
          font-weight: 700;
        }

        .panel-subtitle {
          color: #a7adb4;
          font-size: 13px;
          margin-top: 8px;
        }

        .population-card {
          margin-top: 28px;
          padding: 20px;
          background: #202327;
          border: 1px solid #383d42;
          border-radius: 10px;
        }

        .population-card p {
          color: #a7adb4;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .population-card strong {
          display: block;
          font-size: 36px;
        }

        .population-card span {
          display: block;
          color: #a7adb4;
          font-size: 11px;
          margin-top: 10px;
        }

        .income-card {
          margin-top: 12px;
          padding: 20px;
          background: #202327;
          border: 1px solid #383d42;
          border-radius: 10px;
        }

        .income-card p {
          color: #a7adb4;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .income-card strong {
          display: block;
          font-size: 32px;
        }

        .income-card span {
          display: block;
          color: #a7adb4;
          font-size: 11px;
          margin-top: 10px;
        }

        .extra-metrics { margin-top: 26px; }
        .extra-metrics h3 {
          font-size: 11px; letter-spacing: 1px; color: #a7adb4;
          margin: 0 0 12px;
        }
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .metric-card {
          min-width: 0; padding: 14px 12px; background: #202327;
          border: 1px solid #383d42; border-radius: 10px;
        }
        .metric-card p { color: #a7adb4; font-size: 10px; line-height: 1.4; margin: 0 0 9px; }
        .metric-card strong { display: block; font-size: 19px; overflow-wrap: anywhere; }
        .metric-card span { display: block; margin-top: 8px; color: #a7adb4; font-size: 10px; line-height: 1.4; }
        .metric-source { margin-top: 10px; color: #a7adb4; font-size: 10px; }

        .details {
          border-top: 1px solid #383d42;
          margin-top: 28px;
          padding-top: 20px;
        }

        .details h3 {
          font-size: 14px;
          margin-bottom: 18px;
        }

        .details p {
          color: #a7adb4;
          font-size: 13px;
          margin-bottom: 14px;
        }

        .details strong {
          color: #f4f5f6;
        }

        .coming-soon {
          margin-top: 28px;
          padding: 16px;
          border: 1px dashed #383d42;
          border-radius: 10px;
          color: #a7adb4;
          font-size: 12px;
          line-height: 1.7;
        }


        .map-legend {
          position: absolute;
          z-index: 1090;
          bottom: 18px;
          left: calc(var(--sidebar-width) + (100% - var(--sidebar-width)) / 2);
          transform: translateX(-50%);
          width: min(590px, calc(100vw - var(--sidebar-width) - 40px));
          box-sizing: border-box;
          padding: 13px 16px 12px;
          border-radius: 11px;
          border: 1px solid #49515a;
          background: rgba(23, 26, 30, 0.96);
          box-shadow: 0 10px 35px rgba(0,0,0,.4);
          pointer-events: auto;
          transition: left .28s ease, width .28s ease;
        }
        .map-legend.district-visible {
          left: calc(var(--sidebar-width) + (100% - var(--sidebar-width) - 382px) / 2);
          width: min(550px, calc(100vw - var(--sidebar-width) - 410px));
        }
        .map-legend-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 10px; }
        .map-legend-header strong { font-size: 13px; }
        .map-legend-header span { color: #a7adb4; font-size: 10px; text-align: right; }
        .map-legend-scale { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
        .map-legend-band { min-width: 0; }
        .map-legend-swatch { display: block; height: 12px; border-radius: 2px; }
        .map-legend-range { display: block; color: #d4d8dc; font-size: 10px; line-height: 1.35; text-align: center; margin-top: 5px; overflow-wrap: anywhere; }
        .map-legend-direction { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; color: #b7bec5; font-size: 10px; }
        .map-legend-explanation { border-top: 1px solid #3b4148; padding-top: 8px; margin: 9px 0 0; font-size: 11px; line-height: 1.45; color: #e0e3e6; }
        .map-legend-footnote { margin: 5px 0 0; color: #a7adb4; font-size: 10px; line-height: 1.4; }
        @media (max-width: 1100px) {
          .map-legend.district-visible { left: calc(var(--sidebar-width) + 12px); transform: none; width: min(440px, calc(100vw - var(--sidebar-width) - 410px)); }
        }
        @media (max-width: 850px) {
          .map-legend, .map-legend.district-visible {
            left: calc(var(--sidebar-width) + 10px); transform: none;
            width: min(460px, calc(100vw - var(--sidebar-width) - 20px));
            bottom: 78px;
          }
        }
        @media (max-width: 600px) {
          .map-legend, .map-legend.district-visible { padding: 10px; bottom: 75px; }
          .map-legend-range { font-size: 9px; }
          .map-legend-header { flex-wrap: wrap; }
        }

        .chat-launcher {
          position: absolute; z-index: 1202; right: 22px; bottom: 22px;
          display: flex; align-items: center; gap: 9px; padding: 12px 17px;
          border-radius: 999px; border: 1px solid #59616a; background: #30363c;
          color: #f4f5f6; font: inherit; font-size: 13px; font-weight: 700;
          box-shadow: 0 8px 28px rgba(0,0,0,.45); cursor: pointer;
          transition: right .28s ease, background .2s ease;
        }
        .chat-launcher span { font-size: 19px; line-height: 1; }
        .chat-launcher:hover { background: #424a52; }
        .chat-launcher:focus-visible, .chat-heading button:focus-visible {
          outline: 2px solid #e5e7eb; outline-offset: 3px;
        }
        .chat-panel {
          position: absolute; z-index: 1201; right: 16px; bottom: 16px;
          top: auto; height: min(380px, calc(100dvh - 104px));
          width: min(340px, calc(100vw - 32px)); display: flex; flex-direction: column;
          background: #1b1e21; border: 1px solid #383d42; border-radius: 12px;
          box-shadow: 0 16px 48px rgba(0,0,0,.5); visibility: hidden;
          opacity: 0; transform: translateY(16px);
          pointer-events: none;
          transition: right .28s ease, transform .2s ease, opacity .2s ease, visibility .2s ease;
        }
        .chat-panel.visible { visibility: visible; opacity: 1; transform: translateY(0); pointer-events: auto; }
        /* Keep the district metrics readable while the assistant is open. */
        .chat-panel.panel-shift { right: 382px; }
        .chat-launcher.panel-shift { right: 388px; }
        @media (max-width: 1040px) {
          /* At narrower widths, place chat beside the sidebar rather than over district data. */
          .chat-panel.panel-shift { right: auto; left: calc(var(--sidebar-width) + 24px); }
          .chat-launcher.panel-shift { right: auto; left: calc(var(--sidebar-width) + 24px); }
        }
        @media (max-width: 760px) {
          /* On phones there is not room for both panels side by side. */
          .chat-panel.panel-shift { right: 8px; left: auto; }
          .chat-launcher.panel-shift { right: 12px; left: auto; }
        }
        .chat-heading { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px;
          border-bottom: 1px solid #383d42; }
        .chat-heading strong { font-size: 13px; letter-spacing: 1px; }
        .chat-heading p { margin-top: 6px; font-size: 11px; color: #a7adb4; }
        .chat-heading button { color: #f4f5f6; background: transparent; border: 0; cursor: pointer; font-size: 18px; }
        .chat-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }
        .chat-welcome h2 { font-size: 19px; margin: 8px 0 10px; }
        .chat-welcome p { font-size: 13px; line-height: 1.6; color: #a7adb4; margin-bottom: 18px; }
        .chat-welcome button { display: block; width: 100%; text-align: left; background: #272b2f;
          border: 1px solid #444a50; color: #e9ecef; padding: 12px; border-radius: 8px; cursor: pointer;
          margin-bottom: 9px; font-size: 12px; line-height: 1.5; }
        .chat-welcome button:hover { background: #343a40; }
        .chat-bubble { border-radius: 10px; padding: 13px; background: #2b3035; }
        .chat-bubble.user { background: #3a4046; margin-left: 26px; }
        .chat-bubble span { color: #b6bdc3; font-size: 10px; font-weight: bold; letter-spacing: .7px; }
        .chat-bubble p { margin-top: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.6; }
        .chat-status { font-size: 12px; color: #a7adb4; }
        .chat-error { font-size: 12px; color: #ff9a9a; line-height: 1.5; }
        .chat-form { border-top: 1px solid #383d42; padding: 10px; display: flex; flex-direction: column; gap: 9px; }
        .chat-form textarea { max-height: 72px; background: #101214; border: 1px solid #4b5157; color: #f4f5f6;
          font: inherit; font-size: 13px; line-height: 1.5; padding: 11px; border-radius: 8px; resize: vertical; }
        .chat-form button { align-self: flex-end; background: #d6dbe0; color: #151719; font-weight: 700;
          padding: 9px 18px; border: 0; border-radius: 7px; cursor: pointer; }
        .chat-form button:disabled { opacity: .45; cursor: not-allowed; }
        .chat-form small { color: #a7adb4; font-size: 10px; line-height: 1.4; }

        @media (max-width: 700px) {
          .topbar {
            padding: 0 12px;
          }

          .brand h1 {
            font-size: 14px;
          }

          .brand p {
            font-size: 10px;
          }

          .chamber-switch {
          display: flex;
          gap: 4px;
          padding: 5px;
          border-radius: 10px;
          background: #202327;
          border: 1px solid #383d42;
        }

        .chamber-switch button {
          border: 0;
          border-radius: 7px;
          padding: 9px 16px;
          background: transparent;
          color: #d4d8dc;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .chamber-switch button.selected {
          background: #50575e;
          color: #ffffff;
        }

        .chamber-switch button:focus-visible {
          outline: 2px solid #d6dbe0;
          outline-offset: 2px;
        }

        .topbar-label {
            display: none;
          }

          .intelligence-panel {
            right: 8px;
            top: 80px;
            bottom: 8px;
            width: min(350px, calc(100vw - 16px));
          }
        }
      `}</style>
    </main>
  );
}
