"use client";

import dynamic from "next/dynamic";

// Leaflet internals touch `window`, so load lazily to avoid SSR/prerender errors.
const DiscoveryMapCanvas = dynamic(() => import("./DiscoveryMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <span className="text-sm text-muted">Loading map...</span>
    </div>
  ),
});

export default function DiscoveryMap({ listings, onSelect, height = "h-[600px]" }) {
  const points = (listings || [])
    .filter(
      (l) =>
        l.location?.latitude != null &&
        l.location?.longitude != null
    )
    .map((l) => ({
      id: l._id,
      lat: l.location.latitude,
      lng: l.location.longitude,
      title: l.title,
      price: l.pricing?.amount || 0,
      address:
        l.location?.city || l.location?.district || l.location?.address || "",
      image: l.images?.[0] || "",
    }));

  return (
    <div className={`overflow-hidden rounded-2xl border border-border ${height}`}>
      <DiscoveryMapCanvas points={points} onSelect={onSelect} />
    </div>
  );
}
