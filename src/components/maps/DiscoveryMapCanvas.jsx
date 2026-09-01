"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const TILE_URL =
  process.env.NEXT_PUBLIC_OSM_TILE_URL ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

function createNumberedIcon(index, count) {
  const size = count > 9 ? 28 : 24;
  const fontSize = count > 9 ? 12 : 14;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#0f766e;color:#fff;font-weight:700;font-size:${fontSize}px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">
      ${index}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 13));
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function DiscoveryMapCanvas({ points = [], onSelect }) {
  const valid = useMemo(
    () =>
      points.filter(
        (p) =>
          p &&
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      ),
    [points]
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={TILE_URL}
      />
      <FitBounds points={valid} />
      {valid.map((p, i) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={createNumberedIcon(i + 1, valid.length)}
        >
          <Popup>
            <div style={{ minWidth: "140px" }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {valid.length > 1 ? `${i + 1}. ` : ""}
                {p.title}
              </p>
              <p style={{ margin: 0, fontSize: 12 }}>{p.address}</p>
              {onSelect && (
                <button
                  onClick={() => onSelect?.(p.id)}
                  style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "#0f766e" }}
                >
                  View listing
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
