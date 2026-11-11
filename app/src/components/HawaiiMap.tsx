
"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
} from "geojson";
import "leaflet/dist/leaflet.css";

type Chamber = "House" | "Senate";

type HawaiiMapProps = {
  onDistrictSelect: (
    districtName: string,
    chamber: Chamber
  ) => void;
  onChamberChange: (chamber: Chamber) => void;
};

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

const normalStyle: L.PathOptions = {
  color: "#2563eb",
  weight: 1.2,
  opacity: 0.8,
  fillColor: "#3b82f6",
  fillOpacity: 0.15,
};

const hoverStyle: L.PathOptions = {
  color: "#0284c7",
  weight: 2.5,
  opacity: 1,
  fillColor: "#38bdf8",
  fillOpacity: 0.45,
};

const selectedStyle: L.PathOptions = {
  color: "#1d4ed8",
  weight: 3,
  opacity: 1,
  fillColor: "#2563eb",
  fillOpacity: 0.35,
};

function getDistrictName(
  feature: Feature<Geometry>,
  chamber: Chamber
) {
  const properties = feature.properties ?? {};

  return String(
    chamber === "House"
      ? properties.House_Name ??
          properties.house_name ??
          "Hawaii House District"
      : properties.Senate_Name ??
          properties.senate_name ??
          "Hawaii Senate District"
  );
}

function DistrictLabels({
  districts,
  chamber,
}: {
  districts: FeatureCollection;
  chamber: Chamber;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    function updateZoom() {
      setZoom(map.getZoom());
    }

    map.on("zoomend", updateZoom);

    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  useEffect(() => {
    if (zoom < 9) return;

    const labels: L.Marker[] = [];

    districts.features.forEach((feature) => {
      if (!feature.geometry) return;

      const name = getDistrictName(feature, chamber);
      const number = name.match(/\d+/)?.[0];

      if (!number) return;

      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();

      if (!bounds.isValid()) return;

      const center = bounds.getCenter();

      const label = L.marker(center, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `
            <div style="
              font-size:12px;
              font-weight:700;
              color:#0f172a;
              text-shadow:0 1px 2px white;
              text-align:center;
              width:28px;
            ">${number}</div>
          `,
          iconSize: [28, 20],
          iconAnchor: [14, 10],
        }),
      });

      label.addTo(map);
      labels.push(label);
    });

    return () => {
      labels.forEach((label) => map.removeLayer(label));
    };
  }, [map, districts, chamber, zoom]);

  return null;
}

export default function HawaiiMap({
  onDistrictSelect,
  onChamberChange,
}: HawaiiMapProps) {
  const [chamber, setChamber] = useState<Chamber>("House");

  const [districts, setDistricts] =
    useState<FeatureCollection | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedLayer = useRef<L.Path | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDistricts() {
      setLoading(true);
      setError("");
      setDistricts(null);
      selectedLayer.current = null;

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

    selectedLayer.current = null;
    setChamber(nextChamber);
    onChamberChange(nextChamber);
  }

  function selectDistrict(
    name: string,
    layer: L.Path
  ) {
    if (selectedLayer.current) {
      selectedLayer.current.setStyle(normalStyle);
    }

    selectedLayer.current = layer;
    layer.setStyle(selectedStyle);

    if ("bringToFront" in layer) {
      layer.bringToFront();
    }

    onDistrictSelect(name, chamber);
  }

  return (
    <div>
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
          <>
            <GeoJSON
              key={`${chamber}-${districts.features.length}`}
              data={districts}
              style={normalStyle}
              onEachFeature={(feature, layer) => {
                const name = getDistrictName(
                  feature as Feature<Geometry>,
                  chamber
                );

                const path = layer as L.Path;

                layer.on("mouseover", () => {
                  if (selectedLayer.current !== path) {
                    path.setStyle(hoverStyle);
                    path.bringToFront();
                  }
                });

                layer.on("mouseout", () => {
                  if (selectedLayer.current !== path) {
                    path.setStyle(normalStyle);
                  }
                });

                layer.on("click", () => {
                  selectDistrict(name, path);
                });
              }}
            />

            <DistrictLabels
              districts={districts}
              chamber={chamber}
            />
          </>
        )}

      
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
