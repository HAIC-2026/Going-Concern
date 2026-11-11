
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Chamber = "House" | "Senate";
type SelectedDistrict = {
  name: string;
  chamber: Chamber;
};
type DistrictPopulation = Record<string, number>;
type PopulationStatus = "loading" | "ready" | "error";

const HawaiiMap = dynamic(
  () => import("../components/HawaiiMap"),
  {
    ssr: false,
    loading: () => (
      <div style={{ color: "#cbd5e1", padding: 24 }}>
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

  const [populationData, setPopulationData] = useState<
    Record<Chamber, DistrictPopulation>
  >({ House: {}, Senate: {} });

  const [populationStatus, setPopulationStatus] = useState<
    Record<Chamber, PopulationStatus>
  >({ House: "loading", Senate: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPopulation(selectedChamber: Chamber) {
      try {
        const response = await fetch(
          `/api/census?chamber=${selectedChamber}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Census request failed");
        }

        const data = await response.json();

        if (!Array.isArray(data.rows)) {
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

        if (!controller.signal.aborted) {
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

    loadPopulation("House");
    loadPopulation("Senate");

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
          onDistrictSelect={handleDistrictSelect}
          onChamberChange={handleChamberChange}
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

        <span className="topbar-label">
          {chamber.toUpperCase()} DISTRICTS
        </span>
      </header>

      {/* Sidebar and attached collapse handle */}
      <aside className="sidebar">
        <div className="sidebar-content">
          <p className="section-label">
            {sidebarOpen ? "WORKSPACE" : "•••"}
          </p>

          <nav aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className={`nav-item ${
                  item.active ? "active" : "disabled"
                }`}
                title={item.label}
                aria-label={item.label}
              >
                <span className="nav-icon">{item.icon}</span>

                <span className="nav-label">
                  {item.label}
                </span>
              </div>
            ))}
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
              Additional demographic, housing, and program
              intelligence metrics will appear here as
              data layers are integrated.
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
          background: #0b1220;
          color: #f1f5f9;
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
          background: rgba(12, 23, 40, 0.96);
          border-bottom: 1px solid #293b54;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-symbol {
          color: #60a5fa;
          font-size: 26px;
        }

        .brand h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
        }

        .brand p {
          color: #94a3b8;
          font-size: 12px;
          margin-top: 5px;
        }

        .topbar-label {
          font-size: 11px;
          color: #60a5fa;
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
          background: rgba(13, 25, 43, 0.96);
          border-right: 1px solid #293b54;
          transition: width 0.28s ease;
          overflow: visible;
        }

        .sidebar-content {
          height: 100%;
          overflow: hidden;
          padding: 24px 14px;
        }

        .section-label {
          color: #94a3b8;
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

        .nav-item.active {
          background: #1e3656;
          color: #60a5fa;
          font-weight: 700;
        }

        .nav-item.disabled {
          color: #94a3b8;
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
          border: 1px solid #293b54;
          border-left: none;
          border-radius: 0 7px 7px 0;
          background: #0d192b;
          color: #94a3b8;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          z-index: 1300;
          transition:
            color 0.2s ease,
            background 0.2s ease;
        }

        .collapse-handle:hover {
          color: #60a5fa;
          background: #152238;
        }

        .collapse-handle:focus-visible {
          outline: 2px solid #60a5fa;
          outline-offset: 2px;
        }

        .sources {
          margin-top: 36px;
          padding: 16px;
          border: 1px solid #293b54;
          background: #152238;
          border-radius: 10px;
        }

        .sources strong {
          font-size: 12px;
        }

        .sources p {
          color: #94a3b8;
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
          background: rgba(18, 32, 53, 0.97);
          border: 1px solid #293b54;
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
          color: #60a5fa;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .panel-heading button {
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-size: 18px;
          cursor: pointer;
        }

        .intelligence-panel h2 {
          margin-top: 28px;
          font-size: 26px;
          font-weight: 700;
        }

        .panel-subtitle {
          color: #94a3b8;
          font-size: 13px;
          margin-top: 8px;
        }

        .population-card {
          margin-top: 28px;
          padding: 20px;
          background: #1c304b;
          border: 1px solid #293b54;
          border-radius: 10px;
        }

        .population-card p {
          color: #94a3b8;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .population-card strong {
          display: block;
          font-size: 36px;
        }

        .population-card span {
          display: block;
          color: #94a3b8;
          font-size: 11px;
          margin-top: 10px;
        }

        .details {
          border-top: 1px solid #293b54;
          margin-top: 28px;
          padding-top: 20px;
        }

        .details h3 {
          font-size: 14px;
          margin-bottom: 18px;
        }

        .details p {
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 14px;
        }

        .details strong {
          color: #f1f5f9;
        }

        .coming-soon {
          margin-top: 28px;
          padding: 16px;
          border: 1px dashed #293b54;
          border-radius: 10px;
          color: #94a3b8;
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
