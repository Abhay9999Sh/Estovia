"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span className="text-sm text-muted">Loading map...</span>
    </div>
  ),
});

function convertBoundary(boundary) {
  if (!boundary?.coordinates?.length) return [];
  return boundary.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

export default function LiveMap({
  latitude,
  longitude,
  boundary,
  height = "h-64",
}) {
  const position =
    latitude != null && longitude != null ? [latitude, longitude] : null;
  const poly = convertBoundary(boundary);

  return (
    <div className={`overflow-hidden rounded-xl border border-border ${height}`}>
      <MapCanvas
        center={position || [20.5937, 78.9629]}
        zoom={position ? 14 : 5}
        marker={position}
        boundaryPoints={poly}
        boundaryClosed={poly.length > 0 ? [...poly, poly[0]] : []}
        draggable={false}
      />
    </div>
  );
}
