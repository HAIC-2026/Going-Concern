
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
type MapLayer = "boundaries" | "population" | "income" | "povertyRate" | "unemploymentRate" | "medianHomeValue" | "medianGrossRent" | "bachelorsOrHigherRate";
type MetricValues = Record<Exclude<MapLayer, "boundaries">, number | null>;


type HawaiiMapProps = {
  onDistrictSelect: (
    districtName: string,
    chamber: Chamber
  ) => void;
  chamber: Chamber;
  mapLayer: MapLayer;
  valuesByDistrict: Record<string, MetricValues>;
  incomeByDistrict: Record<string, number>;
  rentThresholds?: number[];
};

const GIS_BASE =
  "https://geodata.hawaii.gov/arcgis/rest/services/AdminBnd/MapServer";

function getDistrictUrl(chamber: Chamber) {
  const layer = chamber === "House" ? 33 : 34;

  return `${GIS_BASE}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.001&f=geojson`;
}

const normalStyle: L.PathOptions = {
  color: "#777e85",
  weight: 1.2,
  opacity: 0.65,
  fillColor: "#777e85",
  fillOpacity: 0.02,
};

// Fixed bands make House/Senate comparisons consistent.
// Poverty, unemployment and rent use blue for lower values and red for higher values.
const thresholds: Record<Exclude<MapLayer, "boundaries">, number[]> = {
  population: [22000, 26000, 30000, 35000],
  income: [60000, 80000, 100000, 120000],
  povertyRate: [5, 10, 15, 20],
  unemploymentRate: [3, 5, 7, 10],
  medianHomeValue: [500000, 700000, 900000, 1100000],
  medianGrossRent: [1200, 1600, 2000, 2400],
  bachelorsOrHigherRate: [20, 30, 40, 50],
};
const bandColors = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6"];
function metricStyle(metric: MapLayer, value: number | null | undefined, rentThresholds?: number[]): L.PathOptions {
  if (metric === "boundaries") return normalStyle;
  const missing = value === null || value === undefined || !Number.isFinite(value) || value < 0;
  const breaks = metric === "medianGrossRent" && rentThresholds?.length === 4 ? rentThresholds : thresholds[metric];
  const band = missing ? 0 : breaks.findIndex((breakpoint) => value < breakpoint);
  const colorIndex = band < 0 ? 4 : band;
  const color = missing ? "#64748b" : bandColors[["povertyRate", "unemploymentRate", "medianGrossRent"].includes(metric) ? 4 - colorIndex : colorIndex];
  return {
    ...normalStyle,
    color: "#9ca3aa",
    opacity: 0.85,
    fillColor: color,
    fillOpacity: missing ? 0.06 : 0.52,
  };
}

const hoverStyle: L.PathOptions = {
  color: "#f4f5f6",
  weight: 2.5,
  opacity: 1,
  fillColor: "#f4f5f6",
  fillOpacity: 0.12,
};

const selectedStyle: L.PathOptions = {
  color: "#f4f5f6",
  weight: 3,
  opacity: 1,
  fillColor: "#f4f5f6",
  fillOpacity: 0.16,
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

      const center =
  chamber === "House" && number === "13"
    ? L.latLng(21.14, -157.02)
    : bounds.getCenter();

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
  resetHighlights,
}: {
  resetHighlights: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.addEventListener("pointerleave", resetHighlights);
    map.on("dragstart", resetHighlights);

    return () => {
      container.removeEventListener("pointerleave", resetHighlights);
      map.off("dragstart", resetHighlights);
    };
  }, [map, resetHighlights]);

  return null;
}

export default function HawaiiMap({
  onDistrictSelect,
  chamber,
  mapLayer,
  incomeByDistrict,
  valuesByDistrict,
  rentThresholds,
}: HawaiiMapProps) {

  const [districts, setDistricts] =
    useState<FeatureCollection | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedLayer = useRef<L.Path | null>(null);
  const hoveredLayer = useRef<L.Path | null>(null);
  const districtLayers = useRef<Set<L.Path>>(new Set());
  const baseStyles = useRef<Map<L.Path, L.PathOptions>>(new Map());
  const layerNumbers = useRef<Map<L.Path, string>>(new Map());

  // Recolor existing Leaflet polygons without remounting them, preserving selection.
  useEffect(() => {
    districtLayers.current.forEach((layer) => {
      const number = layerNumbers.current.get(layer);
      const value = number ? (mapLayer === "income" ? incomeByDistrict[number] : mapLayer === "boundaries" ? null : valuesByDistrict[number]?.[mapLayer]) : null;
      const base = metricStyle(mapLayer, value, rentThresholds);
      baseStyles.current.set(layer, base);
      layer.setStyle(layer === selectedLayer.current ? selectedStyle : base);
    });
    hoveredLayer.current = null;
  }, [mapLayer, incomeByDistrict, valuesByDistrict, rentThresholds]);

  function resetHighlights() {
    districtLayers.current.forEach((layer) => {
      layer.setStyle(
        layer === selectedLayer.current
          ? selectedStyle
          : (baseStyles.current.get(layer) ?? normalStyle)
      );
    });
    hoveredLayer.current = null;
  }

  function hoverDistrict(layer: L.Path) {
    // Reset every district, even if Leaflet missed a mouseout event.
    resetHighlights();
    hoveredLayer.current = layer;
    if (layer !== selectedLayer.current) {
      layer.setStyle(hoverStyle);
    }
  }

  function leaveDistrict(layer: L.Path) {
    if (hoveredLayer.current === layer) {
      resetHighlights();
    }
  }

  function selectDistrict(name: string, layer: L.Path) {
    selectedLayer.current = layer;
    resetHighlights();
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
      districtLayers.current.clear();
      baseStyles.current.clear();
      layerNumbers.current.clear();

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
          background: "#0d0f11",
        }}
      >
        <MapResize />

        <MapPointerReset resetHighlights={resetHighlights} />

        <TileLayer
  attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors'
  url={`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
/>

        {districts && (
          <>
            <GeoJSON
              key={`${chamber}-${districts.features.length}`}
              data={districts}
              style={(feature) => {
                if (mapLayer === "boundaries") return normalStyle;
                const name = getDistrictName(feature as Feature<Geometry>, chamber);
                const districtNumber = name.match(/\d+/)?.[0];
                const id = districtNumber ? String(Number(districtNumber)) : "";
                const value = mapLayer === "income" ? incomeByDistrict[id] : valuesByDistrict[id]?.[mapLayer];
                return metricStyle(mapLayer, value, rentThresholds);
              }}
              onEachFeature={(feature, layer) => {
                const name = getDistrictName(
                  feature as Feature<Geometry>,
                  chamber
                );

                const path = layer as L.Path;
                districtLayers.current.add(path);
                const districtNumber = name.match(/\d+/)?.[0];
                const id = districtNumber ? String(Number(districtNumber)) : "";
                const value = mapLayer === "income" ? incomeByDistrict[id] : mapLayer === "boundaries" ? null : valuesByDistrict[id]?.[mapLayer];
                baseStyles.current.set(path, metricStyle(mapLayer, value, rentThresholds));
                if (districtNumber) layerNumbers.current.set(path, String(Number(districtNumber)));

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
