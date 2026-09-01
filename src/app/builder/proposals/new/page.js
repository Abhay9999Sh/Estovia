"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import ProposalForm from "@/components/builder/ProposalForm";
import Skeleton from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { formatINR } from "@/lib/demoData";

function NewProposalContent() {
  const router = useRouter();
  const [interests, setInterests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/interests?scope=mine", { cache: "no-store" });
        const data = await res.json();
        const accepted = (data.interests || []).filter((i) => i.status === "accepted");
        if (active) {
          setInterests(accepted);
          if (accepted.length > 0) setSelected(accepted[0].landId?._id || "");
        }
      } catch (err) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedInterest = (interests || []).find((i) => i.landId?._id === selected);

  async function handleSubmit(form) {
    if (!selected) {
      setError("Select a land to create a proposal for.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landId: selected,
          proposalType: form.proposalType,
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
      if (!res.ok) throw new Error(data.error || "Unable to create proposal.");
      router.push(`/builder/proposals/${data.proposal._id}`);
    } catch (err) {
      setError(err.message || "Unable to create proposal.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push("/builder/proposals")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Proposals
      </button>

      <h2 className="text-xl font-bold text-foreground">New Proposal</h2>
      <p className="mt-1 text-sm text-muted">
        Create a formal proposal for land where the landowner has accepted your interest.
      </p>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-64" />
        </div>
      ) : (interests || []).length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <h3 className="text-lg font-bold text-foreground">No eligible land yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            You can create a proposal after a landowner accepts your interest in a
            land listing.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="mb-4 text-lg font-bold text-foreground">Select Land</h3>
            <Select value={selected} onChange={(e) => setSelected(e.target.value)} label="Accepted land">
              {(interests || []).map((i) => (
                <option key={i._id} value={i.landId?._id}>
                  {i.landId?.title} — {i.landId?.location?.city || ""}
                </option>
              ))}
            </Select>
            {selectedInterest && (
              <div className="mt-4 rounded-xl border border-border bg-secondary p-4 text-sm">
                <p className="font-semibold text-foreground">{selectedInterest.landId?.title}</p>
                <p className="mt-1 text-muted">
                  {selectedInterest.landId?.location?.address ||
                    selectedInterest.landId?.location?.city ||
                    "No address"}
                </p>
                {selectedInterest.budget && (
                  <p className="mt-1 text-muted">Your indicated budget: {formatINR(selectedInterest.budget)}</p>
                )}
              </div>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="mb-4 text-lg font-bold text-foreground">Proposal Details</h3>
            <ProposalForm
              onSubmit={handleSubmit}
              submitting={submitting}
              submitLabel="Submit Proposal"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="New Proposal">
      <NewProposalContent />
    </BuilderDashboardShell>
  );
}

export default function NewProposalPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="New Proposal"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
