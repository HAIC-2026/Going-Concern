
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Chamber = "House" | "Senate";
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
  const [mapLayer, setMapLayer] = useState<"boundaries" | "income">("boundaries");
  const [layersOpen, setLayersOpen] = useState(false);

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
          incomeByDistrict={incomeData[chamber]}
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
              item.label === "Data Layers" ? (
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
                <label>
                  <input type="radio" name="map-layer" checked={mapLayer === "income"}
                    onChange={() => setMapLayer("income")} />
                  Median household income
                </label>
                {mapLayer === "income" && (
                  <div className="income-legend">
                    <p>ANNUAL HOUSEHOLD INCOME</p>
                    {[
                      ["#ef4444", "Under $60k"],
                      ["#f97316", "$60k–$79,999"],
                      ["#facc15", "$80k–$99,999"],
                      ["#22c55e", "$100k–$119,999"],
                      ["#3b82f6", "$120k+"],
                      ["#64748b", "No estimate"],
                    ].map(([color, label]) => (
                      <div className="legend-row" key={label}>
                        <span style={{ backgroundColor: color }} />{label}
                      </div>
                    ))}
                    <small>2024 ACS 5-Year · USD</small>
                  </div>
                )}
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
          overflow: hidden;
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
