"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, History } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

const toneMap = {
  Submitted: "info",
  Received: "info",
  "Under Review": "warning",
  Negotiation: "warning",
  Accepted: "success",
  Declined: "danger",
  Withdrawn: "muted",
  Expired: "muted",
  Pending: "muted",
};

function QuotationDetail() {
  const { id } = useParams();
  const { status } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // 'counter' | 'withdraw'
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/supplier/quotations/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setQuotation(d.quotation);
          setLines((d.quotation.lineItems || []).map((l) => ({ ...l })));
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, id]);

  async function doWithdraw() {
    if (!confirm("Withdraw this quotation?")) return;
    setSaving(true);
    const res = await fetch(`/api/supplier/quotations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Something went wrong.");
      setSaving(false);
      return;
    }
    setQuotation(d.quotation);
    setSaving(false);
    setMode(null);
  }

  async function doCounter() {
    setSaving(true);
    setError("");
    const payload = {
      action: "counter",
      lineItems: lines.map((l) => ({
        item: l.item,
        quantity: Number(l.quantity) || 0,
        unit: l.unit,
        unitPrice: Number(l.unitPrice) || 0,
      })),
      note,
    };
    try {
      const res = await fetch(`/api/supplier/quotations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Something went wrong.");
      setQuotation(d.quotation);
      setLines((d.quotation.lineItems || []).map((l) => ({ ...l })));
      setMode(null);
      setNote("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function updateLine(i, key, value) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  const subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0);

  return (
    <>
        <Link href="/supplier/quotations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
          <ArrowLeft className="h-4 w-4" /> Back to quotations
        </Link>

        {loading || !quotation ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-foreground">
                    {quotation.requirementId?.title || "Quotation"}
                  </h2>
                  <Badge tone={toneMap[quotation.status] || "muted"}>{quotation.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  Revision #{quotation.revision} · {formatDate(quotation.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {["Pending", "Received", "Under Review", "Negotiation"].includes(quotation.status) && (
                  <Button variant="outline" onClick={() => setMode(mode === "counter" ? null : "counter")}>
                    Send Counter Offer
                  </Button>
                )}
                {["Pending", "Received", "Under Review", "Negotiation", "Submitted"].includes(quotation.status) && (
                  <Button variant="danger" onClick={() => setMode("withdraw")}>
                    Withdraw
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Rate</th>
                    <th className="px-4 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(quotation.lineItems || []).map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium text-foreground">{l.item}</td>
                      <td className="px-4 py-2">{l.quantity} {l.unit}</td>
                      <td className="px-4 py-2">{formatINR(l.unitPrice)}</td>
                      <td className="px-4 py-2">{formatINR(l.lineTotal || l.quantity * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total Amount</span>
                  <span className="font-extrabold text-foreground">{formatINR(quotation.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted">
                  <span>Valid until</span><span>{formatDate(quotation.validUntil)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted">
                  <span>Lead time</span><span>{quotation.leadTimeDays} days</span>
                </div>
              </div>
            </div>

            {quotation.paymentTerms && (
              <div className="mt-4 rounded-xl bg-secondary p-4 text-sm">
                <p className="text-xs font-semibold text-muted">Payment Terms</p>
                <p className="mt-1 text-foreground">{quotation.paymentTerms}</p>
              </div>
            )}

            {(quotation.revisionHistory || []).length > 0 && (
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <History className="h-4 w-4" /> Revision History
                </p>
                <div className="space-y-2">
                  {quotation.revisionHistory.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-border px-4 py-2 text-sm">
                      <span className="text-muted">
                        #{r.revision} · proposed by {r.from} · {formatDate(r.createdAt)}
                      </span>
                      <span className="font-semibold text-foreground">{formatINR(r.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "withdraw" && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMode(null)} />
            <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Withdraw quotation?
              </h3>
              <p className="mt-2 text-sm text-muted">
                The builder will be notified. This cannot be undone unless you re-submit.
              </p>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
                <Button variant="danger" onClick={doWithdraw} loading={saving}>Withdraw</Button>
              </div>
            </div>
          </div>
        )}

        {mode === "counter" && quotation && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMode(null)} />
            <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6">
              <h3 className="text-lg font-bold text-foreground">Send Counter Offer</h3>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="mt-4 space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" value={l.item} onChange={(e) => updateLine(i, "item", e.target.value)} />
                    <Input className="col-span-2" type="number" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                    <Input className="col-span-2" value={l.unit} onChange={(e) => updateLine(i, "unit", e.target.value)} />
                    <Input className="col-span-3" type="number" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end text-sm font-bold text-foreground">
                Subtotal: {formatINR(subtotal)}
              </div>
              <Textarea className="mt-4" label="Note to builder" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
                <Button onClick={doCounter} loading={saving}>Send Counter Offer</Button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default function SupplierQuotationDetailPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Quotation Details">
        <QuotationDetail />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
