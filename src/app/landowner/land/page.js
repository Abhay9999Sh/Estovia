"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PlusSquare,
  Eye,
  Pencil,
  Pause,
  Play,
  Trash2,
  Map,
  Loader2,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatArea, formatINR, formatDate } from "@/lib/demoData";
import { useRouter } from "next/navigation";

function statusTone(status) {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "sold":
      return "primary";
    case "rejected":
      return "danger";
    default:
      return "muted";
  }
}

function verificationTone(status) {
  switch (status) {
    case "verified":
      return "success";
    case "partially_verified":
      return "info";
    case "rejected":
      return "danger";
    default:
      return "info";
  }
}

function MyLand() {
  const router = useRouter();
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/landowner/land", { cache: "no-store" });
      const data = await res.json();
      if (data.listings) setListings(data.listings);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function togglePause(l) {
    setActionId(l._id);
    setError("");
    const nextStatus = l.status === "paused" ? "active" : "paused";
    try {
      const res = await fetch(`/api/landowner/land/${l._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update listing.");
    } finally {
      setActionId(null);
    }
  }

  async function deleteListing(l) {
    if (!window.confirm(`Delete "${l.title}"? This cannot be undone.`)) return;
    setActionId(l._id);
    setError("");
    try {
      const res = await fetch(`/api/landowner/land/${l._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err.message || "Unable to delete listing.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Land</h2>
          <p className="text-sm text-muted">Manage your land listings.</p>
        </div>
        <Link
          href="/landowner/land/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-soft"
        >
          <PlusSquare className="h-4 w-4" /> Add Land
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : listings && listings.length > 0 ? (
        <div className="space-y-3">
          {listings.map((l) => (
            <div
              key={l._id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 lg:flex-row lg:items-center"
            >
              <div className="flex flex-1 items-center gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary">
                  {l.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Map className="h-6 w-6 text-white/50" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-foreground">{l.title}</h3>
                  <p className="truncate text-sm text-muted">
                    {l.location?.city || l.location?.address || "—"}
                    {l.area?.value ? ` · ${formatArea(l.area)}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                    <Badge tone={verificationTone(l.verificationStatus)}>
                      {l.verificationStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-foreground">
                  {l.pricing?.amount ? formatINR(l.pricing.amount) : "—"}
                </p>
                <p className="text-xs text-muted">{l.views || 0} views</p>
                <p className="text-xs text-muted">{formatDate(l.createdAt)}</p>
              </div>

              <div className="flex items-center gap-2 lg:flex-shrink-0">
                <Link
                  href={`/land/${l._id}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent"
                  title="View public"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <Link
                  href={`/landowner/land/${l._id}/edit`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => togglePause(l)}
                  disabled={actionId === l._id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent disabled:opacity-50"
                  title={l.status === "paused" ? "Activate" : "Pause"}
                >
                  {actionId === l._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : l.status === "paused" ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => deleteListing(l)}
                  disabled={actionId === l._id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:border-danger hover:text-danger disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Map className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No listings yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Add your first land listing to get discovered.
          </p>
          <Link
            href="/landowner/land/new"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
          >
            <PlusSquare className="h-4 w-4" /> Add Land
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LandPage() {
  return (
    <AuthShell>
      <DashboardShell title="My Land">
        <MyLand />
      </DashboardShell>
    </AuthShell>
  );
}
