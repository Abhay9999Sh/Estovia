"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Handshake,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import ProposalForm from "@/components/builder/ProposalForm";
import { formatDate, formatINR } from "@/lib/demoData";

function toneFor(s) {
  if (s === "accepted") return "success";
  if (s === "rejected" || s === "withdrawn") return "danger";
  if (s === "countered") return "info";
  return "info";
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TimelineItem({ title, date, last }) {
  if (!date) return null;
  return (
    <li className="relative">
      <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ${last ? "bg-accent" : "bg-muted"}`} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted">{formatDate(date)}</p>
    </li>
  );
}

function summarizeVersion(v) {
  const parts = [];
  if (v.offeredAmount) parts.push(formatINR(v.offeredAmount));
  if (v.revenueShare != null) parts.push(`${v.revenueShare}% rev share`);
  return parts.join(", ") || "sent a counter offer";
}

function DetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/proposals/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.proposal) {
          setProposal(d.proposal);
          // mark as viewed when the landowner opens it
          if (d.proposal.myRole === "landowner") {
            fetch(`/api/proposals/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_viewed", role: "landowner" }),
            }).catch(() => {});
          }
        } else if (active) setError("Proposal not found.");
      })
      .catch(() => active && setError("Unable to load proposal."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const history = proposal?.history || [];
  const activeIndex = proposal?.activeIndex || 0;
  const activeVersion = history[activeIndex] || history[0] || {};

  async function refresh() {
    const fresh = await fetch(`/api/proposals/${id}`, { cache: "no-store" }).then((r) => r.json());
    if (fresh.proposal) setProposal(fresh.proposal);
  }

  async function act(action) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      await refresh();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCounter(form) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proposals/${id}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeredAmount: Number(form.offeredAmount) || 0,
          revenueShare: form.revenueShare !== "" ? Number(form.revenueShare) : null,
          developmentShare: form.developmentShare !== "" ? Number(form.developmentShare) : null,
          expectedDurationMonths: form.expectedDurationMonths ? Number(form.expectedDurationMonths) : null,
          paymentStructure: form.paymentStructure,
          investmentEstimate: Number(form.investmentEstimate) || 0,
          terms: form.terms,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send counter offer.");
      setCounterOpen(false);
      await refresh();
    } catch (err) {
      setError(err.message || "Unable to send counter offer.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Proposal not found</h3>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button variant="outline" className="mt-5" onClick={() => router.push("/landowner/proposals")}>
          Back to Proposals
        </Button>
      </div>
    );
  }

  const relationshipEstablished = proposal.status === "accepted";

  return (
    <div>
      <button
        onClick={() => router.push("/landowner/proposals")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Proposals
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">{proposal.landId?.title || "Proposal"}</h2>
        <Badge tone={toneFor(proposal.status)}>{proposal.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {proposal.landId?.location?.city}
        {proposal.landId?.location?.state ? `, ${proposal.landId.location.state}` : ""}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                Version {activeVersion.version || 1}
                {activeVersion.authorRole === "builder" && proposal.status === "countered" && (
                  <span className="ml-2 text-xs font-medium text-muted">(builder counter)</span>
                )}
                {activeVersion.authorRole === "builder" && (
                  <span className="ml-2 text-xs font-medium text-muted">(from {proposal.builderId?.name || "builder"})</span>
                )}
              </h3>
              <Badge tone="info">{activeVersion.proposalType}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Offered Amount" value={activeVersion.offeredAmount ? formatINR(activeVersion.offeredAmount) : "—"} />
              <Info label="Investment Estimate" value={activeVersion.investmentEstimate ? formatINR(activeVersion.investmentEstimate) : "—"} />
              <Info label="Revenue Share" value={activeVersion.revenueShare != null ? `${activeVersion.revenueShare}%` : "—"} />
              <Info label="Development Share" value={activeVersion.developmentShare != null ? `${activeVersion.developmentShare}%` : "—"} />
              <Info label="Duration" value={activeVersion.expectedDurationMonths ? `${activeVersion.expectedDurationMonths} months` : activeVersion.expectedDuration || "—"} />
              <Info label="Payment Structure" value={activeVersion.paymentStructure || "—"} />
            </div>
            {activeVersion.terms && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">Terms</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{activeVersion.terms}</p>
              </div>
            )}
            {activeVersion.notes && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{activeVersion.notes}</p>
              </div>
            )}
          </div>

          {["submitted", "under_review", "countered"].includes(proposal.status) && (
            <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-white p-5">
              <Button variant="outline" onClick={() => setCounterOpen(true)}>
                Send Counter Offer
              </Button>
              <Button onClick={() => act("accept")} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" /> Accept
              </Button>
              <Button variant="danger" onClick={() => act("reject")} disabled={busy}>
                <XCircle className="h-4 w-4" /> Decline
              </Button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="mb-4 text-lg font-bold text-foreground">Negotiation Timeline</h3>
            <ol className="relative space-y-4 border-l border-border pl-6">
              <TimelineItem
                title={`Proposal received from ${proposal.builderId?.name || "builder"}`}
                date={proposal.createdAt}
                last
              />
              {proposal.history?.map((v, i) => (
                <TimelineItem
                  key={i}
                  title={`${v.authorRole === "landowner" ? "You" : "Builder"} ${summarizeVersion(v)}`}
                  date={v.createdAt}
                />
              ))}
              {proposal.status === "accepted" && (
                <TimelineItem title="Agreement reached — proposal accepted" date={proposal.updatedAt} />
              )}
              {proposal.status === "rejected" && (
                <TimelineItem title="Proposal declined" date={proposal.updatedAt} />
              )}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="text-lg font-bold text-foreground">Builder</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                {proposal.builderId?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "B"}
              </span>
              <div>
                <p className="font-semibold text-foreground">{proposal.builderId?.name || "Builder"}</p>
                <p className="text-xs text-muted">@{proposal.builderId?.username || "builder"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="text-lg font-bold text-foreground">Next steps</h3>
            <ol className="mt-4 space-y-3 text-sm text-muted">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Interest accepted</li>
              <li className="flex items-center gap-2"><Loader2 className="h-4 w-4" /> Proposal negotiation</li>
              {relationshipEstablished ? (
                <li className="flex items-center gap-2 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Agreement reached
                </li>
              ) : (
                <li className="flex items-center gap-2"><Loader2 className="h-4 w-4" /> Awaiting agreement</li>
              )}
            </ol>
            {relationshipEstablished && (
              <div className="mt-4 rounded-xl border border-border bg-secondary p-3 text-sm text-muted">
                <p>Once agreed, the builder can create a project against this land from their dashboard.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={counterOpen} onClose={() => setCounterOpen(false)} title="Send Counter Offer">
        <ProposalForm
          onSubmit={submitCounter}
          submitting={busy}
          submitLabel="Submit Counter Offer"
          note="This creates a new version in the negotiation history. The previous version is never overwritten."
          initial={activeVersion}
        />
      </Modal>
    </div>
  );
}

function Inner() {
  return (
    <DashboardShell title="Proposal Details">
      <DetailContent />
    </DashboardShell>
  );
}

export default function ProposalDetailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<DashboardShell title="Proposal Details"><div /></DashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
