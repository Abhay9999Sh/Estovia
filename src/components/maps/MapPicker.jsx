"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, LocateFixed, Trash2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

// The map internals touch `window`, so the Leaflet-based canvas is loaded
// lazily to avoid SSR/prerender errors.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <MapLoading />,
});

const NOMINATIM_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.openstreetmap.org";

function MapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="text-sm text-muted">Loading map...</span>
      </div>
    </div>
  );
}

export default function MapPicker({
  value,
  onChange,
  height = "h-80",
  draggable = true,
  enableBoundary = false,
  defaultCenter = [20.5937, 78.9629],
  defaultZoom = 5,
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  const [mapError, setMapError] = useState("");

  const current = value || {};

  const markerPos = useMemo(() => {
    if (current.latitude != null && current.longitude != null) {
      return [current.latitude, current.longitude];
    }
    return null;
  }, [current.latitude, current.longitude]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setMapError("");
    try {
      const url = new URL(`${NOMINATIM_URL}/search`);
      url.searchParams.set("q", search.trim());
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "6");
      url.searchParams.set("accept-language", "en");
      url.searchParams.set("addressdetails", "1");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("geocode");
      const data = await res.json();
      if (data.length === 0) {
        setMapError("No location found. Try a different search.");
        setResults([]);
      } else {
        setResults(data);
        setShowResults(true);
      }
    } catch (err) {
      setMapError("Unable to search location. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const address =
      r.display_name || `${r.name || ""} ${r.address?.city || ""} ${r.address?.state || ""}`.trim();
    setLocationFromLatLng(lat, lon, address, r.address);
    setShowResults(false);
    setFlyTo([lat, lon]);
    setSearch(r.display_name || address);
  }

  function reverseGeocode(lat, lon) {
    const url = new URL(`${NOMINATIM_URL}/reverse`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "json");
    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        if (data && data.display_name) {
          onChange?.({
            ...current,
            latitude: lat,
            longitude: lon,
            address: data.display_name,
            city: data.address?.city || data.address?.town || data.address?.village || "",
            state: data.address?.state || "",
            district: data.address?.county || "",
            pincode: data.address?.postcode || "",
          });
        }
      })
      .catch(() => {
        setLocationFromLatLng(lat, lon, `${lat}, ${lon}`);
      });
  }

  function setLocationFromLatLng(lat, lon, address, addressDetails) {
    onChange?.({
      ...current,
      latitude: lat,
      longitude: lon,
      address: address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      city:
        addressDetails?.city ||
        addressDetails?.town ||
        addressDetails?.village ||
        current.city ||
        "",
      state: addressDetails?.state || current.state || "",
      district: addressDetails?.county || current.district || "",
      pincode: addressDetails?.postcode || current.pincode || "",
    });
  }

  function handleMapClick(latlng) {
    setLocationFromLatLng(latlng.lat, latlng.lng);
    if (enableBoundary) {
      setBoundaryPoints((points) => [...points, [latlng.lat, latlng.lng]]);
    }
  }

  function handleMarkerDrag(e) {
    const { lat, lng } = e.target.getLatLng();
    reverseGeocode(lat, lng);
  }

  function undoBoundary() {
    setBoundaryPoints((points) => points.slice(0, -1));
  }

  function clearBoundary() {
    setBoundaryPoints([]);
  }

  const boundaryPositions = useMemo(() => {
    // Close polygon if enough points
    if (boundaryPoints.length >= 3) {
      return [...boundaryPoints, boundaryPoints[0]];
    }
    return boundaryPoints;
  }, [boundaryPoints]);

  function handleConfirm() {
    if (boundaryPoints.length >= 3) {
      const coords = [...boundaryPoints, boundaryPoints[0]].map(([lat, lng]) => [lng, lat]);
      onChange?.({
        ...current,
        latitude: current.latitude,
        longitude: current.longitude,
        address: current.address,
        boundary: {
          type: "Polygon",
          coordinates: [coords],
        },
      });
    }
  }

  return (
    <div className="w-full">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative mb-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
          <Search className="h-5 w-5 flex-shrink-0 text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowResults(true);
            }}
            placeholder="Search location, e.g. Greater Noida, UP"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            aria-label="Search location"
          />
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          ) : (
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Search
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white shadow-xl">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {mapError && (
        <p className="mb-2 text-sm text-danger">{mapError}</p>
      )}

      {/* Map */}
      <div className={`relative overflow-hidden rounded-2xl border border-border ${height}`}>
        <MapCanvas
          center={markerPos || defaultCenter}
          zoom={markerPos ? 13 : defaultZoom}
          marker={markerPos}
          onMapClick={handleMapClick}
          onMarkerDrag={handleMarkerDrag}
          boundaryPoints={boundaryPoints}
          boundaryClosed={boundaryPositions}
          flyTo={flyTo}
          draggable={draggable}
        />

        {!markerPos && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-primary/80 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
              Click on the map to drop a pin
            </span>
          </div>
        )}
      </div>

      {/* Coordinates row */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary px-4 py-3">
          <p className="text-xs font-medium text-muted">Latitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {current.latitude != null ? current.latitude.toFixed(5) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary px-4 py-3">
          <p className="text-xs font-medium text-muted">Longitude</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {current.longitude != null ? current.longitude.toFixed(5) : "—"}
          </p>
        </div>
      </div>

      {current.address && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-light bg-accent-light/40 px-4 py-3">
          <LocateFixed className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
          <p className="text-sm text-foreground">{current.address}</p>
        </div>
      )}

      {/* Boundary controls */}
      {enableBoundary && (
        <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Draw Land Boundary</h4>
              <p className="mt-1 text-xs text-muted">
                Click points around your property. {boundaryPoints.length} of 3+ points placed.
              </p>
            </div>
            <div className="flex gap-2">
              {boundaryPoints.length > 0 && (
                <Button variant="outline" size="sm" onClick={undoBoundary}>
                  Undo
                </Button>
              )}
              {boundaryPoints.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearBoundary}>
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              )}
              {boundaryPoints.length >= 3 && (
                <Button size="sm" onClick={handleConfirm}>
                  Confirm Boundary
                </Button>
              )}
            </div>
          </div>
          {current.boundary?.coordinates?.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <LocateFixed className="h-3.5 w-3.5" /> Boundary saved
            </p>
          )}
        </div>
      )}
    </div>
  );
}
