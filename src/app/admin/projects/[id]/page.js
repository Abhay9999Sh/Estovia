"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, BadgeCheck } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card } from "@/components/admin/AdminStates";
import Button from "@/components/ui/Button";
import { formatINR, formatDate, timeAgo } from "@/lib/format";

export default function AdminProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminFetch(`/api/admin/projects/${id}`);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  async function markReraVerified() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markReraVerified" }),
      });
      const json = await res.json();
      setFlash(res.ok ? { tone: "success", message: json.message } : { tone: "danger", message: json.error || json.message });
      if (res.ok) refetch();
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const project = data?.project;
  const builder = data?.builder;
  const units = data?.units || [];
  const documents = data?.documents || [];

  return (
    <AdminShell title={project ? project.name : "Project"} subtitle="Project oversight">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}

      {!loading && !error && project && (
        <div className="space-y-6">
          {flash && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              {flash.message}
            </div>
          )}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{project.name}</h2>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[project.location?.address, project.location?.city, project.location?.state].filter(Boolean).join(", ") || "—"}
                  </span>
                  <span>{project.projectType}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Budget {formatINR(project.estimatedBudget)} • Created {formatDate(project.createdAt)} • Completion {formatDate(project.completionDate)}
                </p>
                {project.description && <p className="mt-3 text-sm text-foreground/80">{project.description}</p>}
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3">
                <p className="text-xs font-semibold text-muted">Builder</p>
                <p className="text-sm font-bold text-foreground">{builder?.name || builder?.username || "—"}</p>
                <p className="text-xs text-muted">{builder?.email || ""}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">RERA</h3>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={project.rera?.status || "pending"} />
              <span className="text-sm text-foreground">{project.rera?.registrationNumber || "No registration number"}</span>
              <Button size="sm" variant="outline" loading={busy} disabled={project.rera?.status === "verified"} onClick={markReraVerified}>
                <BadgeCheck className="h-4 w-4" /> Mark RERA verified
              </Button>
            </div>
            {project.rera?.state && <p className="mt-2 text-xs text-muted">State: {project.rera.state}</p>}
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Units ({units.length})</h3>
            <div className="space-y-2">
              {units.length === 0 && <p className="text-sm text-muted">No units added.</p>}
              {units.map((u) => (
                <div key={String(u._id)} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {[u.tower, u.unitNumber].filter(Boolean).join(" · ") || "Unit"} ({u.unitType || "—"}, {u.sizeSqFt || 0} sqft)
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="font-semibold text-foreground">{u.price ? formatINR(u.price) : "—"}</span>
                    <StatusBadge status={u.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Documents ({documents.length})</h3>
            <div className="space-y-2">
              {documents.length === 0 && <p className="text-sm text-muted">No project documents.</p>}
              {documents.map((d) => (
                <div key={String(d._id)} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{d.label || d.type || d.category || "Document"}</p>
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

          {(data.orders || []).length > 0 && (
            <Card>
              <h3 className="mb-3 text-sm font-bold text-foreground">Related orders ({data.orders.length})</h3>
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <div key={String(o._id)} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="truncate font-medium text-foreground">{o.orderNumber || String(o._id).slice(-6)}</span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="font-semibold text-foreground">{formatINR(o.totalAmount)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </AdminShell>
  );
}