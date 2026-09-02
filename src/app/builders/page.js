"use client";

import { useEffect, useState } from "react";
import { HardHat, Search, AlertTriangle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import BuilderCard from "@/components/builders/BuilderCard";

function BuildersContent() {
  const [builders, setBuilders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (debounced) params.set("q", debounced);
        const res = await fetch(`/api/builders?${params.toString()}`, {
          cache: "no-store",
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load builders.");
        if (active) setBuilders(d.builders || []);
      } catch (e) {
        if (active) setError(e.message || "Something went wrong.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [debounced]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
          <HardHat className="h-3.5 w-3.5" /> Builders
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Find trusted builders
        </h1>
        <p className="mt-3 text-muted">
          Discover land developers, construction firms and registered builders
          working across the region.
        </p>
      </div>

      <div className="relative mt-8 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search builders by name or specialization..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
            <h3 className="mt-4 text-lg font-bold text-foreground">
              Could not load builders
            </h3>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        ) : builders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <HardHat className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">
              No builders found
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Try adjusting your search to discover more builders.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {builders.map((b) => (
              <BuilderCard key={b._id} builder={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuildersPage() {
  return (
    <AppShell>
      <BuildersContent />
    </AppShell>
  );
}
