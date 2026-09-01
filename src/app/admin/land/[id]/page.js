"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Check, X, Pause, Play, Eye } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card } from "@/components/admin/AdminStates";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { formatINR, formatDate, timeAgo } from "@/lib/format";

export default function AdminLandDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminFetch(`/api/admin/land/${id}`);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  async function runAction(action) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/land/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Failed." });
      } else {
        setFlash({ tone: "success", message: json.message || "Done." });
        setNote("");
        refetch();
      }
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const listing = data?.listing;
  const owner = data?.owner;
  const documents = data?.documents || [];
  const interests = data?.interests || [];

  return (
    <AdminShell title={listing ? listing.title : "Listing"} subtitle="Land listing moderation">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}

      {!loading && !error && listing && (
        <div className="space-y-6">
          {flash && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              {flash.message}
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{listing.title}</h2>
                  <StatusBadge status={listing.verificationStatus} />
                  <StatusBadge status={listing.status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[listing.location?.address, listing.location?.city, listing.location?.state].filter(Boolean).join(", ") || "—"}
                  </span>
                  <span>{listing.propertyType} • {listing.landUse}</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Submitted {formatDate(listing.createdAt)} • {listing.views} views • {listing.interestedUsers} interested
                </p>
                {listing.description && <p className="mt-3 text-sm text-foreground/80">{listing.description}</p>}
                {listing.reviewNotes && (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Review notes: {listing.reviewNotes}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 px-5 py-3">
                <p className="text-xs font-semibold capitalize text-muted">
                  {listing.pricing?.type?.replace(/_/g, " ") || "price"}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {listing.pricing?.amount ? formatINR(listing.pricing.amount) : "—"}
                </p>
              </div>
            </div>
          </Card>

          {owner && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-foreground">Owner</h3>
              <p className="text-sm font-semibold text-foreground">{owner.name || owner.username}</p>
              <p className="text-xs text-muted">{owner.email}</p>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Documents ({documents.length})</h3>
            <div className="space-y-2">
              {documents.length === 0 && <p className="text-sm text-muted">No documents uploaded.</p>}
              {documents.map((d) => (
                <div key={String(d._id)} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.label || d.filename || d.type || "Document"}</p>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:text-accent-soft">
                        Open file
                      </a>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Interested parties ({interests.length})</h3>
            <div className="space-y-2">
              {interests.length === 0 && <p className="text-sm text-muted">No interested parties yet.</p>}
              {interests.map((i) => (
                <div key={String(i._id)} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="truncate font-medium text-foreground">{i.name || i.message || String(i._id)}</span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge status={i.status} />
                    <span className="text-xs text-muted">{timeAgo(i.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Moderation</h3>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Moderation note (required when rejecting)."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="primary" loading={busy} onClick={() => runAction("approve")}>
                <Check className="h-4 w-4" /> Approve & activate
              </Button>
              <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => runAction("reject")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button variant="gold" loading={busy} onClick={() => runAction("pause")}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button variant="outline" loading={busy} onClick={() => runAction("activate")}>
                <Play className="h-4 w-4" /> Activate
              </Button>
              <Button variant="ghost" loading={busy} onClick={() => runAction("under_review")}>
                <Eye className="h-4 w-4" /> Mark under review
              </Button>
            </div>
            {listing.verificationStatus === "rejected" && (
              <button
                onClick={() => router.push(`/land/${listing._id}`)}
                className="mt-4 text-sm font-semibold text-accent hover:text-accent-soft"
              >
                View public listing →
              </button>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}