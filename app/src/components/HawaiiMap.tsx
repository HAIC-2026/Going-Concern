
"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="background:#1456a0;border:3px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 2px 8px #0005"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function HawaiiMap() {
  return (
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

      <Marker position={[21.3099, -157.8581]} icon={markerIcon}>
        <Popup>
          Honolulu, Oʻahu
          <br />
          District intelligence data coming soon.
        </Popup>
      </Marker>
    </MapContainer>
  );
}
