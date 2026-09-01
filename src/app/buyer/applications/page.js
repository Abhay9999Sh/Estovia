"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate, formatINR } from "@/lib/demoData";

const TABS = ["all", "Submitted", "Under Review", "Approved", "Rejected", "Booked", "Cancelled"];
const STATUS_TONES = {
  Draft: "muted",
  Submitted: "info",
  "Under Review": "warning",
  Approved: "success",
  Rejected: "danger",
  Booked: "success",
  Cancelled: "danger",
};

function ApplicationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/buyer/applications", { cache: "no-store" });
      const d = await res.json();
      setApplications(d.applications || []);
    } catch (e) {
      setError("Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const filtered = tab === "all" ? (applications || []) : (applications || []).filter((a) => a.status === tab);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.push(t === "all" ? "/buyer/applications" : `/buyer/applications?tab=${t}`)}
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
          {filtered.map((a) => (
            <div key={a._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground">{a.applicationNumber}</p>
                    <Badge tone={STATUS_TONES[a.status] || "muted"}>{a.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{a.projectId?.name || "Project"}</p>
                  {a.unitDetails && (
                    <p className="mt-1 text-sm text-muted">
                      Unit {a.unitDetails.unitNumber || "—"} · {a.unitDetails.unitType || ""} · {a.unitDetails.sizeSqFt ? `${a.unitDetails.sizeSqFt} sq.ft` : ""}
                    </p>
                  )}
                  {a.unitDetails?.price && (
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatINR(a.unitDetails.price)}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">Applied {formatDate(a.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/buyer/projects/${a.projectId?._id}`)}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    View Project
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No applications</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Apply for a unit from any project page to start the booking process.
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
    <BuyerDashboardShell title="My Applications">
      <ApplicationsContent />
    </BuyerDashboardShell>
  );
}

export default function BuyerApplicationsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuyerDashboardShell title="My Applications"><div /></BuyerDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
