"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, ArrowRight, CheckCircle, XCircle, Clock } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/demoData";

const TABS = ["all", "Requested", "Confirmed", "Completed", "Cancelled"];
const STATUS_TONES = {
  Requested: "warning",
  Confirmed: "success",
  Rescheduled: "info",
  Completed: "success",
  Cancelled: "danger",
  "No Show": "danger",
};

function SiteVisitsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const [visits, setVisits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/buyer/site-visits", { cache: "no-store" });
      const d = await res.json();
      setVisits(d.visits || []);
    } catch (e) {
      setError("Unable to load site visits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const filtered = tab === "all" ? (visits || []) : (visits || []).filter((v) => v.status === tab);

  async function cancelVisit(visit) {
    setCancellingId(visit._id);
    setError("");
    try {
      const res = await fetch(`/api/buyer/site-visits/${visit._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to cancel.");
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.push(t === "all" ? "/buyer/site-visits" : `/buyer/site-visits?tab=${t}`)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((v) => (
            <div key={v._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground">{v.projectId?.name || "Project"}</p>
                    <Badge tone={STATUS_TONES[v.status] || "muted"}>{v.status}</Badge>
                  </div>
                  {v.unitId && (
                    <p className="mt-0.5 text-sm text-muted">Unit {v.unitId.unitNumber || "—"}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
                    {v.requestedDate && (
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Requested: {formatDate(v.requestedDate)}</span>
                    )}
                    {v.scheduledDate && (
                      <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Scheduled: {formatDate(v.scheduledDate)}</span>
                    )}
                  </div>
                  {v.notes && <p className="mt-1 text-xs text-muted">Notes: {v.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/buyer/projects/${v.projectId?._id}`)}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    View Project
                  </button>
                  {["Requested", "Confirmed"].includes(v.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelVisit(v)}
                      disabled={cancellingId === v._id}
                    >
                      {cancellingId === v._id ? <span className="animate-spin h-4 w-4" /> : <XCircle className="h-4 w-4" />} Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No site visits</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Request a site visit from any project page to see it here.
          </p>
          <button
            onClick={() => router.push("/buyer/projects")}
            className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft"
          >
            Explore projects <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <BuyerDashboardShell title="Site Visits">
      <SiteVisitsContent />
    </BuyerDashboardShell>
  );
}

export default function BuyerSiteVisitsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuyerDashboardShell title="Site Visits"><div /></BuyerDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
