"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card } from "@/components/admin/AdminStates";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { timeAgo } from "@/lib/format";

const WORKFLOW = ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "RESOLVED", "CLOSED"];

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminFetch(`/api/admin/reports/${id}`);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  async function runAction(body) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Failed." });
      } else {
        setFlash({ tone: "success", message: json.message || "Updated." });
        setNote("");
        refetch();
      }
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const report = data?.report;
  const reporter = data?.reporter;
  const assignee = data?.assignee;

  const history = (report?.history || []).slice().reverse();

  return (
    <AdminShell title="Report" subtitle={report ? `#${String(report._id).slice(-6)}` : "Dispute"}>
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}

      {!loading && !error && report && (
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
                  <h2 className="text-lg font-bold capitalize text-foreground">{report.subjectType} report</h2>
                  <StatusBadge status={report.status} />
                  <StatusBadge status={report.priority} className="!bg-slate-100 !text-slate-700" />
                </div>
                <p className="mt-1 text-sm text-foreground/80">{report.description}</p>
                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>Reporter: <span className="font-medium text-foreground">{reporter?.name || reporter?.username || "—"} ({reporter?.email || "—"})</span></p>
                  <p>Subject: {report.category || "—"} {report.subjectId ? `• ${report.subjectId}` : ""}</p>
                  {assignee && <p>Assigned to: <span className="font-medium text-foreground">{assignee.name}</span></p>}
                  <p>Raised {timeAgo(report.createdAt)}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3">
                <p className="text-xs font-semibold text-muted">Resolution note</p>
                <p className="max-w-xs text-sm font-medium text-foreground">{report.resolutionNote || "—"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Timeline</h3>
            <div className="space-y-3">
              {history.length === 0 && <p className="text-sm text-muted">No history entries yet.</p>}
              {history.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Flag className="h-3 w-3" />
                    </span>
                    {i < history.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-muted">{timeAgo(h.at)}</span>
                    </div>
                    {h.note && <p className="mt-1 text-sm text-muted">{h.note}</p>}
                    {h.byRole && <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted/70">{h.byRole === "admin" ? "Admin" : "Reporter"}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Update status</h3>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for this update (required for waiting-for-information)."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              {WORKFLOW.filter((s) => s !== "OPEN" && s !== report.status).map((s) => (
                <Button
                  key={s}
                  variant={s === "RESOLVED" ? "primary" : s === "CLOSED" ? "danger" : "outline"}
                  size="sm"
                  loading={busy}
                  onClick={() => runAction({ action: "update_status", status: s, note })}
                >
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Marking RESOLVED closes the loop with the reporter. CLOSED is final.</p>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}