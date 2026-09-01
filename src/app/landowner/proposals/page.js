"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, ArrowRight, Handshake } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatINR, formatDate } from "@/lib/demoData";

const TABS = ["all", "submitted", "under_review", "countered", "accepted", "rejected", "withdrawn"];

function toneFor(s) {
  if (s === "accepted") return "success";
  if (s === "rejected" || s === "withdrawn") return "muted";
  return "info";
}

function ProposalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "all";
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals?scope=landowner", { cache: "no-store" });
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (err) {
      setError("Unable to load proposals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered = tab === "all" ? (proposals || []) : (proposals || []).filter((p) => p.status === tab);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Proposals from Builders</h2>
      <p className="mt-1 text-sm text-muted">
        Review, counter or accept proposals builders submit for your land.
      </p>

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.push(t === "all" ? "/landowner/proposals" : `/landowner/proposals?tab=${t}`)}
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
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((p) => (
            <button
              key={p._id}
              onClick={() => router.push(`/landowner/proposals/${p._id}`)}
              className="block w-full rounded-2xl border border-border bg-white p-5 text-left transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-foreground">{p.landId?.title || "Land"}</p>
                    <Badge tone={toneFor(p.status)}>{p.status}</Badge>
                    {p.activeVersion?.authorRole === "builder" && p.status === "countered" && (
                      <Badge tone="info">builder countered</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {p.landId?.location?.city}
                    {p.landId?.location?.state ? `, ${p.landId.location.state}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                    <span><span className="text-muted">Builder:</span> <span className="font-semibold">{p.counterpart?.name || "Builder"}</span></span>
                    {p.activeVersion?.offeredAmount && (
                      <span>Offered: <span className="font-semibold">{formatINR(p.activeVersion.offeredAmount)}</span></span>
                    )}
                    {p.activeVersion?.revenueShare != null && (
                      <span>Rev share: <span className="font-semibold">{p.activeVersion.revenueShare}%</span></span>
                    )}
                    <span>Updated: {formatDate(p.updatedAt)}</span>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 flex-shrink-0 text-muted" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No proposals yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            When a builder submits a proposal for your land after you accept their interest, it will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <DashboardShell title="Proposals">
      <ProposalsContent />
    </DashboardShell>
  );
}

export default function ProposalsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<DashboardShell title="Proposals"><div /></DashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
