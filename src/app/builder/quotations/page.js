"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, ArrowRight, CheckCircle, XCircle, Loader2, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { formatDate, formatINR } from "@/lib/demoData";

const TABS = ["all", "Pending", "Received", "Under Review", "Negotiation", "Accepted", "Declined"];
const STATUS_TONES = {
  Pending: "info",
  Received: "warning",
  "Under Review": "warning",
  Negotiation: "info",
  Accepted: "success",
  Declined: "danger",
  Withdrawn: "muted",
  Expired: "muted",
};

function QuotationsContent() {
  const searchParams = useSearchParams();
  const requirementId = searchParams.get("requirementId") || "";
  const [quotations, setQuotations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [acceptModal, setAcceptModal] = useState(null);
  const [acceptNote, setAcceptNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (requirementId) params.set("requirementId", requirementId);
      const res = await fetch(`/api/builder/quotations?${params.toString()}`, { cache: "no-store" });
      const d = await res.json();
      setQuotations(d.quotations || []);
    } catch (e) {
      setError("Unable to load quotations.");
    } finally {
      setLoading(false);
    }
  }, [tab, requirementId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  function toggleCompare(id) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  async function acceptQuotation(q) {
    setActionId(q._id);
    setError("");
    try {
      const res = await fetch(`/api/builder/requirements/${q.requirementId?._id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: q._id, note: acceptNote }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to accept.");
      }
      setAcceptModal(null);
      setAcceptNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  }

  async function rejectQuotation(q) {
    if (!confirm("Reject this quotation?")) return;
    setActionId(q._id);
    setError("");
    try {
      const res = await fetch(`/api/supplier/quotations/${q._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "counter", status: "Declined", note: "Rejected by builder" }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  }

  const filtered = tab === "all" ? (quotations || []) : (quotations || []).filter((q) => q.status === tab);
  const compareQuotations = (quotations || []).filter((q) => compareIds.includes(q._id));

  return (
    <div>
      {requirementId && (
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
            Filtered by this requirement
          </span>
          <Link href="/builder/quotations" className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-muted transition-colors hover:bg-white hover:text-foreground" aria-label="Clear filter">
            <X className="h-4 w-4" />
          </Link>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {compareIds.length >= 2 && (
          <Button onClick={() => setCompareOpen(true)}>
            Compare ({compareIds.length})
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No quotations</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Quotations from suppliers will appear here once they respond to your requirements.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div key={q._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground">{q.requirementId?.title || "Requirement"}</p>
                    <Badge tone={STATUS_TONES[q.status] || "muted"}>{q.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">by {q.supplierProfileId?.businessName || "Supplier"}</p>
                  {q.projectId && (
                    <p className="mt-1 text-xs text-muted">Project: {q.projectId.name}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="font-extrabold text-foreground">{formatINR(q.totalAmount)}</span>
                    {q.leadTimeDays > 0 && <span className="text-muted">{q.leadTimeDays} days delivery</span>}
                    {q.validUntil && <span className="text-muted">Valid till {formatDate(q.validUntil)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(q._id)}
                      onChange={() => toggleCompare(q._id)}
                      className="rounded border-border"
                    />
                    Compare
                  </label>
                  {["Pending", "Received", "Under Review", "Negotiation"].includes(q.status) && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setAcceptModal(q)}
                        disabled={actionId === q._id}
                      >
                        <CheckCircle className="h-4 w-4" /> Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rejectQuotation(q)}
                        disabled={actionId === q._id}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compare Modal */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare Quotations" size="lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted font-medium">Supplier</th>
                {compareQuotations.map((q) => (
                  <th key={q._id} className="px-3 py-2 text-left font-medium text-foreground">{q.supplierProfileId?.businessName || "Supplier"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted">Total</td>
                {compareQuotations.map((q) => (
                  <td key={q._id} className="px-3 py-2 font-bold">{formatINR(q.totalAmount)}</td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted">Delivery</td>
                {compareQuotations.map((q) => (
                  <td key={q._id} className="px-3 py-2">{q.leadTimeDays || "—"} days</td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted">Valid Until</td>
                {compareQuotations.map((q) => (
                  <td key={q._id} className="px-3 py-2">{formatDate(q.validUntil)}</td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted">Status</td>
                {compareQuotations.map((q) => (
                  <td key={q._id} className="px-3 py-2"><Badge tone={STATUS_TONES[q.status] || "muted"}>{q.status}</Badge></td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2 text-muted">Notes</td>
                {compareQuotations.map((q) => (
                  <td key={q._id} className="px-3 py-2 text-xs">{q.notes || "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Accept Modal */}
      <Modal open={!!acceptModal} onClose={() => { setAcceptModal(null); setAcceptNote(""); }} title="Accept Quotation">
        <div className="space-y-3">
          {acceptModal && (
            <p className="text-sm text-muted">
              Accept quotation of <span className="font-bold text-foreground">{formatINR(acceptModal.totalAmount)}</span> from <span className="font-bold text-foreground">{acceptModal.supplierProfileId?.businessName || "Supplier"}</span>?
            </p>
          )}
          <Textarea label="Note (optional)" rows={2} value={acceptNote} onChange={(e) => setAcceptNote(e.target.value)} />
          <Button onClick={() => acceptQuotation(acceptModal)} loading={actionId === acceptModal?._id} fullWidth>
            Accept & Award Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function QuotationsPageInner() {
  return (
    <BuilderDashboardShell title="Quotations" subtitle="Review and compare supplier quotations">
      <QuotationsContent />
    </BuilderDashboardShell>
  );
}

export default function BuilderQuotationsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Quotations" subtitle="Review and compare supplier quotations"><div /></BuilderDashboardShell>}>
        <QuotationsPageInner />
      </Suspense>
    </AuthShell>
  );
}
