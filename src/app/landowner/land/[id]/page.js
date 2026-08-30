"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  AreaChart,
  IndianRupee,
  Pencil,
  Pause,
  Play,
  Eye,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import LiveMap from "@/components/maps/LiveMap";
import { formatArea, formatINR, formatDate } from "@/lib/demoData";

function toneFor(status) {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "info";
}

function ListingView() {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/landowner/land/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (active) {
          if (data.listing) {
            setListing(data.listing);
            setDocuments(data.documents || []);
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        if (active) setError("Something went wrong. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h2 className="mt-4 text-2xl font-extrabold text-foreground">Listing not found</h2>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/landowner/land")}>
          Back to My Land
        </Button>
      </div>
    );
  }

  async function togglePause() {
    setActing(true);
    setError("");
    const next = listing.status === "paused" ? "active" : "paused";
    try {
      const res = await fetch(`/api/landowner/land/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListing((l) => ({ ...l, status: next }));
    } catch (err) {
      setError(err.message || "Unable to update listing.");
    } finally {
      setActing(false);
    }
  }

  async function deleteListing() {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    setActing(true);
    setError("");
    try {
      const res = await fetch(`/api/landowner/land/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/landowner/land");
    } catch (err) {
      setError(err.message || "Unable to delete listing.");
      setActing(false);
    }
  }

  return (
    <div>
      <Link
        href="/landowner/land"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Land
      </Link>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="relative h-64 bg-primary">
          {listing.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-12 w-12 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white">
            <div>
              <h1 className="text-2xl font-extrabold">{listing.title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4" />
                {listing.location?.address || `${listing.location?.city}, ${listing.location?.state}`}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <Badge tone={toneFor(listing.status) || "muted"}>{listing.status}</Badge>
              <Badge tone={toneFor(listing.verificationStatus) || "info"}>
                {listing.verificationStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted">Area</p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatArea(listing.area)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Price</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {formatINR(listing.pricing?.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Created</p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatDate(listing.createdAt)}</p>
          </div>
        </div>
      </div>

      {listing.location?.latitude != null && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-foreground">Location Map</h2>
          <LiveMap
            latitude={listing.location.latitude}
            longitude={listing.location.longitude}
            boundary={listing.boundary}
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-bold text-foreground">Documents</h2>
        {documents.length > 0 ? (
          <div className="mt-4 space-y-2">
            {documents.map((d) => (
              <div key={d._id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <span className="text-sm text-foreground">{d.label || d.type}</span>
                <Badge tone={toneFor(d.status)}>{d.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No documents uploaded.</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
        <Link
          href={`/landowner/land/${id}/edit`}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-soft"
        >
          <Pencil className="h-4 w-4" /> Edit Listing
        </Link>
        <Button variant="outline" onClick={togglePause} loading={acting}>
          {listing.status === "paused" ? (
            <>
              <Play className="h-4 w-4" /> Activate
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" /> Pause
            </>
          )}
        </Button>
        <Link
          href={`/land/${id}`}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:border-accent hover:text-accent"
        >
          <Eye className="h-4 w-4" /> View Public
        </Link>
        <Button variant="danger" onClick={deleteListing} disabled={acting} className="ml-auto">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  return (
    <AuthShell>
      <DashboardShell title="Listing">
        <ListingView />
      </DashboardShell>
    </AuthShell>
  );
}