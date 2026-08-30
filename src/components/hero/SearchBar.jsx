"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "land", label: "Land" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
  { value: "project", label: "Project" },
];

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("location", location.trim());
    if (type) params.set("type", type);
    router.push(`/explore?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/95 p-2 shadow-2xl backdrop-blur "
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 md:border-r md:border-border">
          <Search className="h-5 w-5 flex-shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            aria-label="Search query"
          />
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 md:border-r md:border-border">
          <MapPin className="h-5 w-5 flex-shrink-0 text-muted" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (city/state)"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            aria-label="Search location"
          />
        </div>
        <div className="px-1 py-1 md:py-0">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none md:w-40"
            aria-label="Property type"
          >
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-soft"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>
    </form>
  );
}
