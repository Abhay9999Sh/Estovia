"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Trash2, AlertTriangle } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function RequirementDetail() {
  const { id } = useParams();
  const { status } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [lines, setLines] = useState([{ item: "", quantity: 1, unit: "", unitPrice: "" }]);
  const [leadTime, setLeadTime] = useState(7);
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/supplier/requirements/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setRequirement(d.requirement);
          const prefill = (d.requirement.lineItems || []).map((l) => ({
            item: l.item,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: "",
          }));
          if (prefill.length) setLines(prefill);
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

  const subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0);
  const gstAmount = subtotal * (Number(gstRate) || 0) / 100;
  const total = subtotal + gstAmount;

  async function submitQuote() {
    setSaving(true);
    setError("");
    const payload = {
      lineItems: lines.map((l) => ({
        item: l.item,
        quantity: Number(l.quantity) || 0,
        unit: l.unit,
        unitPrice: Number(l.unitPrice) || 0,
      })),
      gstRate: Number(gstRate) || 0,
      leadTimeDays: Number(leadTime) || 0,
      paymentTerms,
      notes,
      validUntil: validUntil || null,
      openConversation: true,
    };
    try {
      const res = await fetch(`/api/supplier/requirements/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Something went wrong.");
      setQuoteOpen(false);
      window.alert("Quotation submitted to the builder.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function updateLine(i, key, value) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  return (
    <>
        <Link href="/supplier/requirements" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
          <ArrowLeft className="h-4 w-4" /> Back to opportunities
        </Link>

        {loading || !requirement ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-foreground">{requirement.title}</h2>
                  <Badge tone={requirement.status === "Open" ? "success" : "muted"}>{requirement.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {requirement.projectId?.name || "Project"} · {requirement.builderId?.name || "Builder"}
                </p>
              </div>
              {requirement.status === "Open" && (
                <Button onClick={() => setQuoteOpen(true)}>
                  <FileText className="h-4 w-4" /> Submit Quotation
                </Button>
              )}
            </div>

            <p className="mt-4 text-sm text-foreground">{requirement.description}</p>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Required By</p>
                <p className="font-semibold text-foreground">{formatDate(requirement.requiredBy)}</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Delivery Location</p>
                <p className="font-semibold text-foreground">{requirement.deliveryLocation || "—"}</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Estimated Value</p>
                <p className="font-semibold text-foreground">{formatINR(requirement.estimatedValue)}</p>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-bold text-foreground">Line Items</h3>
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Specification</th>
                  </tr>
                </thead>
                <tbody>
                  {(requirement.lineItems || []).map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium text-foreground">{l.item || "—"}</td>
                      <td className="px-4 py-2">{l.quantity}</td>
                      <td className="px-4 py-2">{l.unit}</td>
                      <td className="px-4 py-2 text-muted">{l.specification || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {quoteOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setQuoteOpen(false)} />
            <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Submit Quotation</h3>
                {error && (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder="Item" value={l.item} onChange={(e) => updateLine(i, "item", e.target.value)} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                    <Input className="col-span-2" placeholder="Unit" value={l.unit} onChange={(e) => updateLine(i, "unit", e.target.value)} />
                    <Input className="col-span-2" type="number" placeholder="Rate ₹" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} />
                    <button
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="col-span-1 flex items-center justify-center text-muted hover:text-danger"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { item: "", quantity: 1, unit: "", unitPrice: "" }])}>
                  <Plus className="h-4 w-4" /> Add Line
                </Button>

                <div className="rounded-xl bg-secondary p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-semibold text-foreground">{formatINR(subtotal)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-muted">GST ({gstRate}%)</span>
                    <span className="font-semibold text-foreground">{formatINR(gstAmount)}</span>
                  </div>
                  <div className="mt-2 border-t border-border pt-2 flex justify-between font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="text-foreground">{formatINR(total)}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="GST %" type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
                  <Input label="Lead Time (days)" type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
                  <Input label="Valid Until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <Textarea label="Payment Terms" rows={2} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancel</Button>
                <Button onClick={submitQuote} loading={saving}>Submit Quotation</Button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default function SupplierRequirementDetailPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Requirement Details">
        <RequirementDetail />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
