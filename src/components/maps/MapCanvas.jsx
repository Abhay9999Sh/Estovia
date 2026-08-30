"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const TILE_URL =
  process.env.NEXT_PUBLIC_OSM_TILE_URL ||
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function createIcon(selected) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${selected ? "#0f766e" : "#0f172a"};
      border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">
        <div style="width:10px;height:10px;border-radius:50%;background:#ffffff;transform:rotate(45deg)"></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords[0] != null && coords[1] != null) {
      map.flyTo(coords, Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [coords, map]);
  return null;
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
}

export default function MapCanvas({
  center,
  zoom,
  marker,
  onMapClick,
  onMarkerDrag,
  boundaryPoints,
  boundaryClosed,
  flyTo,
  draggable = true,
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={TILE_URL}
      />
      <ClickHandler onMapClick={onMapClick} />
      {flyTo && <FlyTo coords={flyTo} />}
      {marker && (
        <Marker
          position={marker}
          icon={createIcon(true)}
          draggable={draggable}
          eventHandlers={{ dragend: onMarkerDrag }}
        >
          <Popup>Selected location</Popup>
        </Marker>
      )}
      {boundaryPoints.length > 0 && (
        <Polygon
          positions={boundaryClosed}
          pathOptions={{ color: "#0f766e", weight: 3 }}
        />
      )}
    </MapContainer>
  );
}
