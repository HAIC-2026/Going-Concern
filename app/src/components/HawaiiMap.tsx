
"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
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
  fillOpacity: 0.48,
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
    const updateZoom = () => setZoom(map.getZoom());

    map.on("zoomend", updateZoom);

    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  useEffect(() => {
    if (zoom < 9) return;

    const labels = L.layerGroup();

    districts.features.forEach((feature) => {
      if (!feature.geometry) return;

      const name = getDistrictName(feature, chamber);
      const number = name.match(/\d+/)?.[0];

      if (!number) return;

      const bounds = L.geoJSON(feature).getBounds();

      if (!bounds.isValid()) return;

      const center = bounds.getCenter();

      const label = L.marker(center, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `
            <div style="
              width:28px;
              text-align:center;
              font-size:12px;
              font-weight:700;
              color:#0f172a;
              text-shadow:
                0 1px 2px white,
                0 -1px 2px white;
            ">${number}</div>
          `,
          iconSize: [28, 20],
          iconAnchor: [14, 10],
        }),
      });

      labels.addLayer(label);
    });

    labels.addTo(map);

    return () => {
      map.removeLayer(labels);
    };
  }, [map, districts, chamber, zoom]);

  return null;
}

function MapResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  return null;
}

function MapPointerReset({
  clearHover,
}: {
  clearHover: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    map.on("mouseout", clearHover);
    map.on("dragstart", clearHover);

    return () => {
      map.off("mouseout", clearHover);
      map.off("dragstart", clearHover);
    };
  }, [map, clearHover]);

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
  const hoveredLayer = useRef<L.Path | null>(null);

  function clearHover() {
    const previous = hoveredLayer.current;

    if (previous && previous !== selectedLayer.current) {
      previous.setStyle(normalStyle);
    }

    hoveredLayer.current = null;
  }

  function hoverDistrict(layer: L.Path) {
    if (hoveredLayer.current !== layer) {
      clearHover();
    }

    hoveredLayer.current = layer;

    if (layer !== selectedLayer.current) {
      layer.setStyle(hoverStyle);
    }
  }

  function leaveDistrict(layer: L.Path) {
    if (hoveredLayer.current === layer) {
      clearHover();
    } else if (layer !== selectedLayer.current) {
      layer.setStyle(normalStyle);
    }
  }

  function selectDistrict(
    name: string,
    layer: L.Path
  ) {
    const previous = selectedLayer.current;

    if (previous && previous !== layer) {
      previous.setStyle(normalStyle);
    }

    selectedLayer.current = layer;
    hoveredLayer.current = layer;

    layer.setStyle(selectedStyle);
    layer.bringToFront();

    onDistrictSelect(name, chamber);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadDistricts() {
      setLoading(true);
      setError("");
      setDistricts(null);

      selectedLayer.current = null;
      hoveredLayer.current = null;

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

    clearHover();
    selectedLayer.current = null;

    setChamber(nextChamber);
    onChamberChange(nextChamber);
  }

return (
  <div
 style={{
  width: "100%",
  height: "100dvh",
  position: "relative",
}}
  >
      <MapContainer
        center={[20.8, -156.3]}
        zoom={7}
        scrollWheelZoom={true}
        style={{
          width: "100%",
          height: "100%",
          background: "#dce8e6",
        }}
      >
        <MapResize />

        <MapPointerReset clearHover={clearHover} />

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
                  hoverDistrict(path);
                });

                layer.on("mouseout", () => {
                  leaveDistrict(path);
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

      <div
        style={{
          position: "absolute",
          top: "88px",
          left: "250px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px",
          background: "rgba(15,23,42,0.94)",
          borderRadius: "10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        {(["House", "Senate"] as Chamber[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeChamber(item)}
            style={{
              padding: "9px 16px",
              borderRadius: "7px",
              border: "none",
              cursor: "pointer",
              background:
                chamber === item
                  ? "#2563eb"
                  : "transparent",
              color:
                chamber === item
                  ? "#ffffff"
                  : "#cbd5e1",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {loading && (
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            zIndex: 1000,
            background: "#0f172a",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        >
          Loading {chamber} districts...
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            zIndex: 1000,
            background: "#7f1d1d",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
