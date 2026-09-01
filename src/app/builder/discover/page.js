"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Map as MapIcon, LayoutGrid, Filter, X } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import LandCard from "@/components/property/LandCard";
import DiscoveryMap from "@/components/maps/DiscoveryMap";
import Skeleton from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";

const PROPERTY_TYPES = [
  { value: "", label: "All property types" },
  { value: "land", label: "Land" },
  { value: "plot", label: "Plot" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "apartment", label: "Apartment" },
  { value: "project", label: "Project" },
];

const LAND_USES = [
  { value: "", label: "All land uses" },
  { value: "agricultural", label: "Agricultural" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "mixed", label: "Mixed" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "institutional", label: "Institutional" },
];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "area_asc", label: "Area: Low to High" },
  { value: "area_desc", label: "Area: High to Low" },
  { value: "views", label: "Most Viewed" },
];

const DESKTOP_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState("list");

  const [filters, setFilters] = useState({
    q: "",
    propertyType: "",
    landUse: "",
    state: "",
    city: "",
    district: "",
    verifiedOnly: false,
    minArea: "",
    maxArea: "",
    minPrice: "",
    maxPrice: "",
    sort: "newest",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters.q), 400);
    return () => clearTimeout(t);
  }, [filters.q]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (filters.propertyType) params.set("propertyType", filters.propertyType);
      if (filters.landUse) params.set("landUse", filters.landUse);
      if (filters.state) params.set("state", filters.state);
      if (filters.city) params.set("city", filters.city);
      if (filters.district) params.set("district", filters.district);
      if (filters.verifiedOnly) params.set("verifiedOnly", "true");
      if (filters.minArea) params.set("minArea", filters.minArea);
      if (filters.maxArea) params.set("maxArea", filters.maxArea);
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      params.set("sort", filters.sort);
      params.set("limit", "50");

      const res = await fetch(`/api/builder/land?${params.toString()}`, { cache: "no-store" });
      const d = await res.json();
      setData(d);
    } catch (err) {
      setData({ listings: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [debounced, filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const listings = data?.listings || [];

  function update(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  function clearFilters() {
    setFilters({
      q: "",
      propertyType: "",
      landUse: "",
      state: "",
      city: "",
      district: "",
      verifiedOnly: false,
      minArea: "",
      maxArea: "",
      minPrice: "",
      maxPrice: "",
      sort: "newest",
    });
  }

  const activeFilterCount = [
    filters.propertyType,
    filters.landUse,
    filters.state,
    filters.city,
    filters.district,
    filters.minArea,
    filters.maxArea,
    filters.minPrice,
    filters.maxPrice,
    filters.verifiedOnly,
  ].filter((v) => v && v !== false).length;

  return (
    <div>
      {/* Search bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="Search land by title, description..."
            className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.sort} onChange={(e) => update("sort", e.target.value)} className="w-44">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="flex items-center rounded-xl border border-border bg-white overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`flex h-11 w-11 items-center justify-center ${view === "list" ? "bg-accent text-white" : "text-muted hover:bg-secondary"}`}
              aria-label="List view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex h-11 w-11 items-center justify-center ${view === "map" ? "bg-accent text-white" : "text-muted hover:bg-secondary"}`}
              aria-label="Map view"
            >
              <MapIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible filters */}
      {showFilters && (
        <div className="mb-4 rounded-2xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Filter Land</p>
            <button onClick={clearFilters} className="text-xs font-semibold text-accent hover:text-accent-soft">
              Clear all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={filters.propertyType} onChange={(e) => update("propertyType", e.target.value)}>
              {PROPERTY_TYPES.map((p) => (
                <option key={p.value || "all"} value={p.value}>{p.label}</option>
              ))}
            </Select>
            <Select value={filters.landUse} onChange={(e) => update("landUse", e.target.value)}>
              {LAND_USES.map((l) => (
                <option key={l.value || "all"} value={l.value}>{l.label}</option>
              ))}
            </Select>
            <Select value={filters.state} onChange={(e) => update("state", e.target.value)}>
              <option value="">All states</option>
              {DESKTOP_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <input
              value={filters.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="City"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              value={filters.district}
              onChange={(e) => update("district", e.target.value)}
              placeholder="District"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              value={filters.minArea}
              onChange={(e) => update("minArea", e.target.value)}
              placeholder="Min area"
              type="number"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              value={filters.maxArea}
              onChange={(e) => update("maxArea", e.target.value)}
              placeholder="Max area"
              type="number"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              value={filters.minPrice}
              onChange={(e) => update("minPrice", e.target.value)}
              placeholder="Min price (₹)"
              type="number"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              value={filters.maxPrice}
              onChange={(e) => update("maxPrice", e.target.value)}
              placeholder="Max price (₹)"
              type="number"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={filters.verifiedOnly}
                onChange={(e) => update("verifiedOnly", e.target.checked)}
                className="h-4 w-4 rounded accent-teal-600"
              />
              Verified only
            </label>
          </div>
        </div>
      )}

      <div className="mb-4 text-sm text-muted">
        {loading ? "Searching..." : `${data?.total || 0} opportunities found`}
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : view === "map" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
            {listings.length === 0 ? (
              <EmptyState />
            ) : (
              listings.map((l) => <LandCard key={l._id} listing={l} />)
            )}
          </div>
          <DiscoveryMap listings={listings} onSelect={(id) => router.push(`/land/${id}`)} />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState />
            </div>
          ) : (
            listings.map((l) => <LandCard key={l._id} listing={l} />)
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
      <X className="mx-auto h-10 w-10 text-muted" />
      <h3 className="mt-4 text-lg font-bold text-foreground">No land found</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Adjust your filters or try a different search to find land opportunities.
      </p>
    </div>
  );
}

function DiscoverPageInner() {
  return (
    <BuilderDashboardShell title="Discover Land">
      <DiscoverContent />
    </BuilderDashboardShell>
  );
}

export default function DiscoverPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Discover Land"><div /></BuilderDashboardShell>}>
        <DiscoverPageInner />
      </Suspense>
    </AuthShell>
  );
}
