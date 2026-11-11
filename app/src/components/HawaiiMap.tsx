
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
  chamber: Chamber;
  mapLayer: "boundaries" | "income";
  incomeByDistrict: Record<string, number>;
};

const GIS_BASE =
  "https://geodata.hawaii.gov/arcgis/rest/services/AdminBnd/MapServer";

function getDistrictUrl(chamber: Chamber) {
  const layer = chamber === "House" ? 33 : 34;

  return `${GIS_BASE}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.001&f=geojson`;
}

const normalStyle: L.PathOptions = {
  color: "#64748b",
  weight: 1.2,
  opacity: 0.65,
  fillColor: "#64748b",
  fillOpacity: 0.02,
};

// Fixed, interpretable income bands (USD), rather than relative ranks.
function incomeStyle(value: number | undefined): L.PathOptions {
  const color = value === undefined ? "#64748b" :
    value < 60000 ? "#ef4444" :
    value < 80000 ? "#f97316" :
    value < 100000 ? "#facc15" :
    value < 120000 ? "#22c55e" : "#3b82f6";
  return {
    ...normalStyle,
    color: "#94a3b8",
    opacity: 0.85,
    fillColor: color,
    fillOpacity: value === undefined ? 0.06 : 0.52,
  };
}

const hoverStyle: L.PathOptions = {
  color: "#38bdf8",
  weight: 2.5,
  opacity: 1,
  fillColor: "#38bdf8",
  fillOpacity: 0.18,
};

const selectedStyle: L.PathOptions = {
  color: "#3b82f6",
  weight: 3,
  opacity: 1,
  fillColor: "#3b82f6",
  fillOpacity: 0.22,
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
      const value = number ? incomeByDistrict[number] : undefined;
      const base = mapLayer === "income" ? incomeStyle(value) : normalStyle;
      baseStyles.current.set(layer, base);
      layer.setStyle(layer === selectedLayer.current ? selectedStyle : base);
    });
    hoveredLayer.current = null;
  }, [mapLayer, incomeByDistrict]);

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
          background: "#dce8e6",
        }}
      >
        <MapResize />

        <MapPointerReset resetHighlights={resetHighlights} />

        <TileLayer
  attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; OpenStreetMap contributors'
  url={`https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
/>

        {districts && (
          <>
            <GeoJSON
              key={`${chamber}-${districts.features.length}`}
              data={districts}
              style={(feature) => {
                if (mapLayer !== "income") return normalStyle;
                const name = getDistrictName(feature as Feature<Geometry>, chamber);
                const districtNumber = name.match(/\d+/)?.[0];
                const value = districtNumber ? incomeByDistrict[String(Number(districtNumber))] : undefined;
                return incomeStyle(value);
              }}
              onEachFeature={(feature, layer) => {
                const name = getDistrictName(
                  feature as Feature<Geometry>,
                  chamber
                );

                const path = layer as L.Path;
                districtLayers.current.add(path);
                const districtNumber = name.match(/\d+/)?.[0];
                const value = districtNumber ? incomeByDistrict[String(Number(districtNumber))] : undefined;
                baseStyles.current.set(path, mapLayer === "income" ? incomeStyle(value) : normalStyle);
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
