"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Search, MapPin, ArrowRight, ShieldCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function ProjectsList() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (debounced) params.set("q", debounced);
        if (city) params.set("city", city);
        if (type) params.set("type", type);
        const res = await fetch(`/api/buyer/projects?${params.toString()}`, { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setData(d);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, debounced, city, type]);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search projects or city..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
          <option value="Mixed-Use">Mixed-Use</option>
        </Select>
      </div>

      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : (data.projects || []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No projects found</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((p) => (
            <Link
              key={p._id}
              href={`/buyer/projects/${p._id}`}
              className="group overflow-hidden rounded-2xl border border-border bg-white transition-shadow hover:shadow-lg"
            >
              <div className="relative h-40 bg-gradient-to-br from-accent-soft to-primary">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Building2 className="h-10 w-10 text-white/70" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex gap-2">
                  <Badge tone="warning">{p.status}</Badge>
                  {p.reraVerified && (
                    <Badge tone="success">
                      <ShieldCheck className="mr-1 h-3 w-3" /> RERA
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-foreground group-hover:text-accent">{p.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3 w-3" />
                  {p.location?.city}, {p.location?.state}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">{p.unitSummary?.count || 0} units available</p>
                    {p.unitSummary?.minPrice ? (
                      <p className="font-extrabold text-foreground">
                        {formatINR(p.unitSummary.minPrice)}
                        <span className="text-xs text-muted"> on</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted">Pricing on request</p>
                    )}
                  </div>
                  <p className="text-sm text-muted">{p.builderName || "Builder"}</p>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted">
                  <span>{p.unitSummary.avgSqft ? `${p.unitSummary.avgSqft} sq.ft avg` : "—"}</span>
                  <span className="flex items-center gap-1 font-semibold text-accent">
                    View <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function BuyerProjectsPage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Explore Projects" subtitle="Browse real-estate projects from verified builders">
        <ProjectsList />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
