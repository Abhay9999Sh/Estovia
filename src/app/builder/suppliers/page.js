"use client";

import { useEffect, useState, useCallback } from "react";
import { Hammer, Search, Star, MapPin, ShieldCheck, ArrowRight, Loader2, MessageSquare } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatINR } from "@/lib/demoData";

const CATEGORIES = ["Cement", "Steel", "Bricks", "Sand", "Aggregates", "Electrical", "Plumbing", "Paint", "Tiles", "Sanitary", "Hardware", "Glass", "Wood", "Aluminium", "Doors & Windows", "HVAC", "Construction Machinery", "Interior Materials", "Construction Services", "Architecture", "Engineering", "Civil Work", "Interior Design", "Equipment Rental", "Other"];

function SuppliersContent() {
  const [suppliers, setSuppliers] = useState(null);
  const [loading, setLoading] = useState(true);
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
      try {
        const params = new URLSearchParams();
        if (debounced) params.set("q", debounced);
        if (category) params.set("category", category);
        const res = await fetch(`/api/builder/suppliers?${params.toString()}`, { cache: "no-store" });
        const d = await res.json();
        if (active) setSuppliers(d.suppliers || []);
      } catch (e) {
        if (active) setSuppliers([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [debounced, category]);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search suppliers..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Hammer className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No suppliers found</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Try adjusting your search or browse different categories.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <div key={s._id} className="flex flex-col rounded-2xl border border-border bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent font-bold text-sm">
                  {s.businessName?.slice(0, 2).toUpperCase() || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-foreground truncate">{s.businessName}</h3>
                  <p className="text-xs text-muted">{s.category || "General"}{s.yearsOfExperience ? ` · ${s.yearsOfExperience}y exp` : ""}</p>
                </div>
                {s.verification?.business === "verified" && (
                  <Badge tone="success"><ShieldCheck className="h-3 w-3" /></Badge>
                )}
              </div>
              <p className="mt-2 flex-1 text-sm text-muted line-clamp-2">{s.bio || "No description"}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                {s.rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {s.rating.toFixed(1)} ({s.reviewCount})
                  </span>
                )}
                {s.operatingLocations?.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {s.operatingLocations.slice(0, 2).join(", ")}
                  </span>
                )}
              </div>
              {(s.products?.length > 0 || s.services?.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(s.products || []).slice(0, 3).map((p) => (
                    <span key={p._id} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">{p.name}</span>
                  ))}
                  {(s.services || []).slice(0, 3).map((sv) => (
                    <span key={sv._id} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">{sv.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function BuilderSuppliersPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Suppliers" subtitle="Find verified suppliers for your projects">
        <SuppliersContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
