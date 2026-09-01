"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import LandCard from "@/components/property/LandCard";
import Skeleton from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "land", label: "Land" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
  { value: "project", label: "Project" },
];

function ExploreContent() {
  const searchParams = useSearchParams();
  const urlType = searchParams.get("type") || searchParams.get("propertyType") || "";
  const urlQ = searchParams.get("q") || "";
  const urlLocation = searchParams.get("location") || "";
  const urlVerified = searchParams.get("verifiedOnly") === "true";

  const [type, setType] = useState(urlType);
  const [q, setQ] = useState(urlQ);
  const [location, setLocation] = useState(urlLocation);
  const [verifiedOnly, setVerifiedOnly] = useState(urlVerified);
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Track the URL key so we can keep the filter state in sync when the URL
  // changes while the component stays mounted (adjust state during render).
  const urlKey = `${urlType}|${urlQ}|${urlLocation}|${urlVerified}`;
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);
  if (lastUrlKey !== urlKey) {
    setLastUrlKey(urlKey);
    setType(urlType);
    setQ(urlQ);
    setLocation(urlLocation);
    setVerifiedOnly(urlVerified);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (location) params.set("location", location);
    if (type) params.set("propertyType", type);
    if (verifiedOnly) params.set("verifiedOnly", "true");
    params.set("limit", "12");
    try {
      const res = await fetch(`/api/land?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.listings) setListings(data.listings);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [q, location, type, verifiedOnly]);

  // Fetch fresh results when the URL's search params change (e.g. clicking a
  // Navbar/Footer item like "Properties"/"Land"). The component stays mounted
  // across same-pathname query navigations, so without this it would stay stuck
  // on the previous filters until the user leaves and returns.
  useEffect(() => {
    const params = new URLSearchParams();
    if (urlQ) params.set("q", urlQ);
    if (urlLocation) params.set("location", urlLocation);
    if (urlType) params.set("propertyType", urlType);
    if (urlVerified) params.set("verifiedOnly", "true");
    params.set("limit", "12");
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/land?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (active && data.listings) setListings(data.listings);
      } catch (err) {
        if (active) setError("Something went wrong. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [urlType, urlQ, urlLocation, urlVerified]);

  function applyFilters(e) {
    e?.preventDefault();
    load();
  }

  function clearFilters() {
    setQ("");
    setLocation("");
    setType("");
    setVerifiedOnly(false);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Explore Land &amp; Property
      </h1>
      <p className="mt-2 text-muted">
        Discover verified opportunities from landowners across India.
      </p>

      {/* Filters */}
      <form onSubmit={applyFilters} className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title..."
            />
          </div>
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5">
              <MapPin className="h-4 w-4 text-muted" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-full bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>
          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none"
            >
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              <Search className="h-4 w-4" /> Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-3 text-muted hover:text-foreground"
              aria-label="Clear filters"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-sm text-foreground">Show verified only</span>
        </label>
      </form>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
              <Skeleton className="h-52 w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))
        ) : listings && listings.length > 0 ? (
          listings.map((l) => <LandCard key={l._id} listing={l} />)
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-white p-16 text-center">
            <Search className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No listings found</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Try adjusting your filters or searching a different location.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplorePageInner() {
  return (
    <AppShell>
      <ExploreContent />
    </AppShell>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ExplorePageInner />
    </Suspense>
  );
}
