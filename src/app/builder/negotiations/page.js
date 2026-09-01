"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ArrowRight, Scale } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { formatINR, formatDate } from "@/lib/demoData";

const ACTIVE_STATUSES = ["submitted", "under_review", "countered"];

function NegotiationsContent() {
  const router = useRouter();
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals?scope=mine", { cache: "no-store" });
      const data = await res.json();
      setProposals((data.proposals || []).filter((p) => ACTIVE_STATUSES.includes(p.status)));
    } catch (err) {
      setError("Unable to load negotiations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Active Negotiations</h2>
      <p className="mt-1 text-sm text-muted">
        Proposals currently being negotiated with landowners. Send counters or review their counters here.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-28" />)
        ) : proposals && proposals.length > 0 ? (
          proposals.map((p) => {
            const v = p.activeVersion || {};
            return (
              <div key={p._id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">{p.landId?.title || "Land"}</p>
                    <p className="text-sm text-muted">
                      {p.landId?.location?.city}
                      {p.landId?.location?.state ? `, ${p.landId.location.state}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                      {v.offeredAmount && <span>Offered: <span className="font-semibold">{formatINR(v.offeredAmount)}</span></span>}
                      {v.revenueShare != null && <span>Rev share: <span className="font-semibold">{v.revenueShare}%</span></span>}
                      <span>Updated: <span className="text-muted">{formatDate(p.updatedAt)}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge tone="info">{p.status}</Badge>
                    {p.activeVersion?.authorRole === "landowner" && <Badge tone="warning">countered</Badge>}
                    <Button size="sm" onClick={() => router.push(`/builder/proposals/${p._id}`)}>
                      Negotiate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/builder/messages`)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Scale className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No active negotiations</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              When a landowner counters your proposal or negotiations are ongoing, they&apos;ll appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="Negotiations">
      <NegotiationsContent />
    </BuilderDashboardShell>
  );
}

export default function NegotiationsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Negotiations"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
