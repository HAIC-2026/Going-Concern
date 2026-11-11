
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

const DISTRICT_URL =
  "https://geodata.hawaii.gov/arcgis/rest/services/AdminBnd/MapServer/33/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.001&f=geojson";

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="background:#1456a0;border:3px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 2px 8px #0005"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function HawaiiMap() {
  const [districts, setDistricts] =
    useState<FeatureCollection | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDistricts() {
      try {
        const response = await fetch(DISTRICT_URL);

        if (!response.ok) {
          throw new Error("District data request failed");
        }

        const data = await response.json();

        if (data.type !== "FeatureCollection") {
          throw new Error("Invalid district data");
        }

        setDistricts(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load district boundaries.");
      }
    }

    loadDistricts();
  }, []);

  return (
    <div>
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
            data={districts}
            style={{
              color: "#2563eb",
              weight: 2,
              fillColor: "#60a5fa",
              fillOpacity: 0.15,
            }}
            onEachFeature={(feature, layer) => {
              const properties = feature.properties ?? {};

              const name =
                properties.House_Name ??
                properties.house_name ??
                "Hawaii House District";

              layer.bindPopup(
                `<strong>${String(name)}</strong><br/>Official 2022 House district boundary`
              );
            }}
          />
        )}

        <Marker
          position={[21.3099, -157.8581]}
          icon={markerIcon}
        >
          <Popup>
            Honolulu, Oʻahu
            <br />
            District intelligence data coming soon.
          </Popup>
        </Marker>
      </MapContainer>

      <p
        style={{
          marginTop: "12px",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        District boundaries: State of Hawaiʻi GIS Program,
        2022 House districts.
      </p>
    </div>
  );
}
