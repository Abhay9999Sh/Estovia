"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bookmark, Building2, MapPin, Trash2, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function SavedContent() {
  const { status } = useAuth();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/buyer/saved", { cache: "no-store" });
      const d = await res.json();
      setItems(d.saved || []);
    } catch (e) {
      setError("Unable to load saved items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      await load();
    })();
  }, [status, load]);

  async function unsave(item) {
    setError("");
    try {
      const res = await fetch(`/api/buyer/saved?entityType=${item.entityType}&entityId=${item.entityId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function getLink(item) {
    if (item.entityType === "project") return `/buyer/projects/${item.entityId}`;
    if (item.entityType === "unit" && item.entity?.projectId) return `/buyer/projects/${item.entity.projectId}`;
    if (item.entityType === "unit") return `/buyer/projects`;
    if (item.entityType === "land") return `/land/${item.entityId}`;
    return "#";
  }

  function getItemTitle(item) {
    if (item.entity?.name) return item.entity.name;
    if (item.entity?.title) return item.entity.title;
    if (item.entity?.unitNumber) return `Unit ${item.entity.unitNumber}`;
    return "Saved item";
  }

  function getItemSub(item) {
    if (item.entity?.location?.city) return `${item.entity.location.city}, ${item.entity.location.state || ""}`;
    if (item.entityType === "unit") return item.entity.unitType || "";
    return "";
  }

  function getItemPrice(item) {
    if (item.entity?.pricing?.amount) return formatINR(item.entity.pricing.amount);
    if (item.entity?.price) return formatINR(item.entity.price);
    if (item.entity?.estimatedBudget) return formatINR(item.entity.estimatedBudget);
    return "";
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No saved items</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Save projects, units or land while browsing to compare them later.
          </p>
          <Link href="/buyer/projects" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft">
            Explore Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item._id} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground">{getItemTitle(item)}</p>
                  <Badge tone="info">{item.entityType}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">{getItemSub(item)}</p>
                {getItemPrice(item) && (
                  <p className="mt-1 text-sm font-semibold text-foreground">{getItemPrice(item)}</p>
                )}
                {item.note && <p className="mt-1 text-xs text-muted">Note: {item.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Link href={getLink(item)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary">
                  View
                </Link>
                <button
                  onClick={() => unsave(item)}
                  className="rounded-xl p-2 text-muted hover:bg-red-50 hover:text-danger"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuyerSavedPage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Saved & Compare" subtitle="Your saved projects, units and land">
        <SavedContent />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
