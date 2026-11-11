
"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";

// Official State of Hawaii GIS API
type Chamber = "House" | "Senate";

const GIS_BASE =
  "https://geodata.hawaii.gov/arcgis/rest/services/AdminBnd/MapServer";

function getDistrictUrl(chamber: Chamber) {
  const layer = chamber === "House" ? 33 : 34;

  return `${GIS_BASE}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.001&f=geojson`;
}

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="background:#1456a0;border:3px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 2px 8px #0005"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

type HawaiiMapProps = {
  onDistrictSelect: (
    districtName: string,
    chamber: Chamber
  ) => void;
  onChamberChange: (chamber: Chamber) => void;
};

export default function HawaiiMap({
  onDistrictSelect,
  onChamberChange,
}: HawaiiMapProps) {
  const [chamber, setChamber] = useState<Chamber>("House");

  const [districts, setDistricts] =
    useState<FeatureCollection | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDistricts() {
      setLoading(true);
      setError("");
      setDistricts(null);

      try {
        const response = await fetch(
          getDistrictUrl(chamber),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("District data request failed");
        }

        const data = await response.json();

        if (
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Invalid district data");
        }

        if (!controller.signal.aborted) {
          setDistricts(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err);
          setError("Unable to load district boundaries.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDistricts();

    return () => controller.abort();
  }, [chamber]);

  function changeChamber(nextChamber: Chamber) {
    if (nextChamber === chamber) return;

    setChamber(nextChamber);
    onChamberChange(nextChamber);
  }

  return (
    <div>
      {/* House / Senate selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Legislative boundaries:
        </span>

        <button
          type="button"
          onClick={() => changeChamber("House")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #94a3b8",
            background:
              chamber === "House" ? "#2563eb" : "#ffffff",
            color:
              chamber === "House" ? "#ffffff" : "#334155",
            cursor: "pointer",
          }}
        >
          House
        </button>

        <button
          type="button"
          onClick={() => changeChamber("Senate")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #94a3b8",
            background:
              chamber === "Senate" ? "#2563eb" : "#ffffff",
            color:
              chamber === "Senate" ? "#ffffff" : "#334155",
            cursor: "pointer",
          }}
        >
          Senate
        </button>
      </div>

      {loading && (
        <p style={{ color: "#64748b" }}>
          Loading {chamber} district boundaries...
        </p>
      )}

      {error && (
        <p style={{ color: "red", marginBottom: "12px" }}>
          {error}
        </p>
      )}

      <MapContainer
        center={[20.8, -156.3]}
        zoom={7}
        scrollWheelZoom={true}
        style={{
          height: "500px",
          width: "100%",
          borderRadius: "12px",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {districts && (
          <GeoJSON
            key={`${chamber}-${districts.features.length}`}
            data={districts}
            style={{
              color: "#64748b",
              weight: 1,
              fillColor: "#60a5fa",
              fillOpacity: 0.10,
            }}
            onEachFeature={(feature, layer) => {
              const properties = feature.properties ?? {};

              const name = String(
                chamber === "House"
                  ? properties.House_Name ??
                      properties.house_name ??
                      "Hawaii House District"
                  : properties.Senate_Name ??
                      properties.senate_name ??
                      "Hawaii Senate District"
              );

              layer.bindPopup(
                `<strong>${name}</strong><br/>Official 2022 ${chamber} district boundary`
              );

              layer.on("click", () => {
                onDistrictSelect(name, chamber);
              });
            }}
          />
        )}

        <Marker
          position={[21.3099, -157.8581]}
          icon={markerIcon}
        >
          <Popup>Honolulu, Oʻahu</Popup>
        </Marker>
      </MapContainer>

      <p
        style={{
          marginTop: "12px",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        Boundary source: State of Hawaiʻi GIS Program,
        2022 {chamber} districts.
      </p>
    </div>
  );
}
