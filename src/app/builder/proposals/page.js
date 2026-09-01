"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Handshake,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { formatDate, formatINR } from "@/lib/demoData";

const TABS = ["all", "submitted", "under_review", "countered", "accepted", "rejected", "withdrawn"];
const VALID_TABS = ["all", "submitted", "under_review", "countered", "accepted", "rejected", "withdrawn"];

function toneFor(s) {
  if (s === "accepted") return "success";
  if (s === "rejected") return "danger";
  if (s === "withdrawn") return "muted";
  if (s === "countered") return "info";
  return "info";
}

function ProposalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = VALID_TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "all";
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals?scope=mine", { cache: "no-store" });
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => router.push(t === "all" ? "/builder/proposals" : `/builder/proposals?tab=${t}`)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Button onClick={() => router.push("/builder/proposals/new")}>
          <Handshake className="h-4 w-4" /> New Proposal
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((p) => (
            <button
              key={p._id}
              onClick={() => router.push(`/builder/proposals/${p._id}`)}
              className="block w-full rounded-2xl border border-border bg-white p-5 text-left transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-foreground">{p.landId?.title || "Land"}</p>
                    <Badge tone={toneFor(p.status)}>{p.status}</Badge>
                    {p.activeVersion?.authorRole !== "builder" && (
                      <Badge tone="warning">countered</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {p.landId?.location?.city}
                    {p.landId?.location?.state ? `, ${p.landId.location.state}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                    <span>
                      Offered:{" "}
                      <span className="font-semibold">
                        {p.activeVersion?.offeredAmount
                          ? formatINR(p.activeVersion.offeredAmount)
                          : "—"}
                      </span>
                    </span>
                    {p.activeVersion?.revenueShare != null && (
                      <span>Revenue share: <span className="font-semibold">{p.activeVersion.revenueShare}%</span></span>
                    )}
                    <span>
                      Updated: <span className="text-muted">{formatDate(p.updatedAt)}</span>
                    </span>
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
            After a landowner accepts your interest, you can submit a formal proposal.
          </p>
          <Button className="mt-5" onClick={() => router.push("/builder/proposals/new")}>
            <Handshake className="h-4 w-4" /> Create Proposal
          </Button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="Proposals">
      <ProposalsContent />
    </BuilderDashboardShell>
  );
}

export default function ProposalsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Proposals"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
