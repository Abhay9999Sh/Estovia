"use client";

import { useEffect, useState } from "react";
import { Hammer, Search, AlertTriangle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import SupplierCard from "@/components/suppliers/SupplierCard";

const CATEGORIES = [
  "Materials",
  "Equipment",
  "Labour",
  "Services",
  "Fittings & Finishes",
  "Other",
];

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
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
        if (category) params.set("category", category);
        const res = await fetch(`/api/suppliers?${params.toString()}`, {
          cache: "no-store",
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load suppliers.");
        if (active) setSuppliers(d.suppliers || []);
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
  }, [debounced, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
          <Hammer className="h-3.5 w-3.5" /> Suppliers
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Find materials & services
        </h1>
        <p className="mt-3 text-muted">
          Browse verified suppliers of construction materials, equipment and
          services.
        </p>
      </div>

      <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search suppliers or products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
              Could not load suppliers
            </h3>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Hammer className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">
              No suppliers found
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Try adjusting your search or browse different categories.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <SupplierCard key={s._id} supplier={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <AppShell>
      <SuppliersContent />
    </AppShell>
  );
}
