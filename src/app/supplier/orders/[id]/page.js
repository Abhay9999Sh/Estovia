"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

const toneMap = {
  Pending: "warning",
  Confirmed: "info",
  "In Production": "info",
  "In Transit": "info",
  Delivered: "accent",
  "Partially Delivered": "accent",
  Completed: "success",
  Cancelled: "danger",
  Disputed: "danger",
};

const ACTIONS = {
  Pending: [{ value: "Confirmed", label: "Confirm Order" }, { value: "Cancelled", label: "Decline Order" }],
  Confirmed: [{ value: "In Production", label: "Start Production" }, { value: "Cancelled", label: "Cancel" }],
  "In Production": [{ value: "In Transit", label: "Mark Shipped" }, { value: "Delivered", label: "Mark Delivered" }],
  "In Transit": [{ value: "Delivered", label: "Mark Delivered" }],
  Delivered: [{ value: "Completed", label: "Mark Completed" }],
};

function OrderDetail() {
  const { id } = useParams();
  const { status } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/supplier/orders/${id}`, { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setOrder(d.order);
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

  async function runAction() {
    setSaving(true);
    setError("");
    const payload = { action, reason };
    try {
      const res = await fetch(`/api/supplier/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Something went wrong.");
      setOrder(d.order);
      setAction("");
      setReason("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const available = ACTIONS[order?.status] || [];
  const canDispute = ["Confirmed", "In Production", "In Transit", "Partially Delivered"].includes(order?.status);

  return (
    <>
        <Link href="/supplier/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>

        {loading || !order ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-foreground">{order.orderNumber}</h2>
                  <Badge tone={toneMap[order.status] || "muted"}>{order.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {order.projectId?.name || "Project"} · {order.builderId?.name || "Builder"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Order Value</p>
                <p className="text-2xl font-extrabold text-foreground">{formatINR(order.totalAmount)}</p>
                <Badge tone="warning">Payment: {order.payment?.status || "Pending Verification"}</Badge>
              </div>
            </div>

            {order.cancellationReason && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="font-semibold">Cancellation reason:</span> {order.cancellationReason}
              </div>
            )}
            {order.disputeNote && (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <span className="font-semibold">Dispute note:</span> {order.disputeNote}
              </div>
            )}

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
                  {(order.lines || []).map((l, i) => (
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

            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Delivery Address</p>
                <p className="font-semibold text-foreground">{order.deliveryAddress || "—"}</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Expected Delivery</p>
                <p className="font-semibold text-foreground">{formatDate(order.expectedDelivery)}</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-muted">Placed On</p>
                <p className="font-semibold text-foreground">{formatDate(order.createdAt)}</p>
              </div>
            </div>

            {(available.length > 0 || canDispute) && (
              <div className="mt-6 rounded-xl border border-border p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Truck className="h-4 w-4" /> Update Order
                </p>
                {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                <div className="flex flex-wrap items-end gap-3">
                  <Select className="max-w-xs" label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
                    <option value="">Select action</option>
                    {available.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                    {canDispute && <option value="dispute">Mark Disputed</option>}
                  </Select>
                  <Button onClick={runAction} disabled={!action} loading={saving}>
                    Apply
                  </Button>
                </div>
                {action === "Cancelled" && (
                  <Textarea className="mt-3" label="Reason (required for cancel)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                )}
                {action === "dispute" && (
                  <Textarea className="mt-3" label="Dispute note" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                )}
              </div>
            )}
          </div>
        )}
    </>
  );
}

export default function SupplierOrderDetailPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Order Details">
        <OrderDetail />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
