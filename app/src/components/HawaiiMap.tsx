
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
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
  theme?: "day" | "night";
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

// Attach the basemap only while Leaflet's tile pane exists. React 19 development
// navigation can briefly expose a map whose DOM panes were already torn down;
// react-leaflet's eager TileLayer mount can then throw on pane.appendChild.
function SafeBasemap({theme,onRecover}:{
  theme:"day"|"night";
  onRecover:()=>void;
}) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    let tile: L.TileLayer | null = null;
    let frame: number | null = null;
    let attempts = 0;

    const attach = () => {
      if (cancelled) return;
      const container = map.getContainer();
      const pane = map.getPane("tilePane");
      if (!container.isConnected || !pane) {
        // In a destroyed or partially mounted map, don't call addTo.
        if (++attempts > 4) { onRecover(); return; }
        frame = window.requestAnimationFrame(attach);
        return;
      }

      const isNight = theme === "night";
      const url = isNight
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attribution = isNight
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
      try {
        tile = L.tileLayer(url, {attribution, maxZoom: 19});
        tile.addTo(map);
      } catch {
        // Never leave a half-attached tile layer behind. Recreate MapContainer.
        try { tile?.remove(); } catch { /* previous map was removed */ }
        tile = null;
        if (!cancelled) onRecover();
      }
    };

    frame = window.requestAnimationFrame(attach);
    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      try { tile?.remove(); } catch { /* map already detached */ }
    };
  }, [map,theme,onRecover]);
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
  theme = "night",
}: HawaiiMapProps) {

  const [districts, setDistricts] =
    useState<FeatureCollection | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapEpoch,setMapEpoch] = useState(0);
  const recoveries = useRef(0);

  const selectedLayer = useRef<L.Path | null>(null);
  const hoveredLayer = useRef<L.Path | null>(null);
  const districtLayers = useRef<Set<L.Path>>(new Set());
  const baseStyles = useRef<Map<L.Path, L.PathOptions>>(new Map());
  const layerNumbers = useRef<Map<L.Path, string>>(new Map());
  const recoverMap = useCallback(() => {
    if (recoveries.current >= 2) {
      setError("Map tiles could not initialize. Reload Map View to retry.");
      return;
    }
    recoveries.current += 1;
    selectedLayer.current = null;
    hoveredLayer.current = null;
    districtLayers.current.clear();
    baseStyles.current.clear();
    layerNumbers.current.clear();
    setMapEpoch(value => value + 1);
  }, []);

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
  height: "100%",
  position: "relative",
}}
  >
      <MapContainer
        key={mapEpoch}
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

        <SafeBasemap theme={theme} onRecover={recoverMap} />

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
