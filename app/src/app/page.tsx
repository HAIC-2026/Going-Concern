
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Chamber = "House" | "Senate";

type SelectedDistrict = {
  name: string;
  chamber: Chamber;
};

type DistrictPopulation = {
  [districtNumber: string]: number;
};

const HawaiiMap = dynamic(
  () => import("../components/HawaiiMap"),
  {
    ssr: false,
    loading: () => <p>Loading Hawaii map...</p>,
  }
);

export default function Home() {
  const [chamber, setChamber] = useState<Chamber>("House");

  const [selectedDistrict, setSelectedDistrict] =
    useState<SelectedDistrict | null>(null);

  const [populationData, setPopulationData] =
    useState<DistrictPopulation>({});

  const [populationStatus, setPopulationStatus] =
    useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    async function loadPopulation() {
      try {
        const response = await fetch("/api/census");

        if (!response.ok) {
          throw new Error("Census request failed");
        }

        const data = await response.json();

        if (!Array.isArray(data.rows)) {
          throw new Error("Invalid Census response");
        }

        const population: DistrictPopulation = {};

        for (const row of data.rows.slice(1)) {
          const districtNumber = String(Number(row[3]));
          const value = Number(row[1]);

          if (
            districtNumber !== "NaN" &&
            Number.isFinite(value)
          ) {
            population[districtNumber] = value;
          }
        }

        setPopulationData(population);
        setPopulationStatus("ready");
      } catch (error) {
        console.error("Census loading failed:", error);
        setPopulationStatus("error");
      }
    }

    loadPopulation();
  }, []);

  function handleChamberChange(nextChamber: Chamber) {
    setChamber(nextChamber);
    setSelectedDistrict(null);
  }

  function handleDistrictSelect(
    name: string,
    selectedChamber: Chamber
  ) {
    setChamber(selectedChamber);
    setSelectedDistrict({
      name,
      chamber: selectedChamber,
    });
  }

  const districtNumber =
    selectedDistrict?.name.match(/\d+/)?.[0];

  const population =
    selectedDistrict?.chamber === "House" && districtNumber
      ? populationData[String(Number(districtNumber))]
      : undefined;

  function getPopulationDisplay() {
    if (selectedDistrict?.chamber === "Senate") {
      return "Senate population integration pending";
    }

    if (populationStatus === "loading") {
      return "Loading...";
    }

    if (populationStatus === "error") {
      return "Census API unavailable";
    }

    return population !== undefined
      ? population.toLocaleString()
      : "Population data unavailable";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        backgroundColor: "#f4f7fb",
        color: "#14283f",
      }}
    >
      <h1 style={{ fontSize: "36px", fontWeight: "bold" }}>
        Know Your District
      </h1>

      <p style={{ marginTop: "12px", marginBottom: "28px" }}>
        Hawaii District Intelligence Platform
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: "24px",
        }}
      >
        <section
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #ddd",
            minWidth: 0,
          }}
        >
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            Legislative District Map
          </h2>

          <HawaiiMap
            onDistrictSelect={handleDistrictSelect}
            onChamberChange={handleChamberChange}
          />
        </section>

        <aside
          style={{
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "12px",
            border: "1px solid #ddd",
          }}
        >
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "bold",
            }}
          >
            District Intelligence
          </h2>

          {selectedDistrict ? (
            <div style={{ marginTop: "24px" }}>
              <p style={{ color: "#64748b" }}>
                Selected District
              </p>

              <h3
                style={{
                  fontSize: "26px",
                  fontWeight: "bold",
                  marginTop: "8px",
                }}
              >
                {selectedDistrict.name}
              </h3>

              <hr
                style={{
                  margin: "24px 0",
                  borderColor: "#eee",
                }}
              />

              <p>
                <strong>Legislative Chamber:</strong>{" "}
                {selectedDistrict.chamber}
              </p>

              <p style={{ marginTop: "12px" }}>
                <strong>Boundary Source:</strong>{" "}
                State of Hawaiʻi GIS Program
              </p>

              <p style={{ marginTop: "12px" }}>
                <strong>Boundary Year:</strong> 2022
              </p>

              <hr
                style={{
                  margin: "24px 0",
                  borderColor: "#eee",
                }}
              />

              <h4
                style={{
                  fontWeight: "bold",
                  fontSize: "18px",
                }}
              >
                Community Demographics
              </h4>

              <p
                style={{
                  color: "#64748b",
                  marginTop: "12px",
                }}
              >
                <strong>Estimated Population (2024):</strong>{" "}
                {getPopulationDisplay()}
              </p>

              {selectedDistrict.chamber === "House" && (
                <p
                  style={{
                    color: "#64748b",
                    marginTop: "12px",
                  }}
                >
                  Source: U.S. Census Bureau,
                  2024 ACS 5-Year Estimates.
                </p>
              )}
            </div>
          ) : (
            <p
              style={{
                marginTop: "24px",
                color: "#64748b",
              }}
            >
              Click a {chamber} district on the map
              to view its information.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
