"use client";

import { useEffect, useState } from "react";
import { Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate, formatINR } from "@/lib/demoData";

const STATUS_TONES = {
  Pending: "warning",
  Confirmed: "info",
  "In Production": "info",
  "In Transit": "warning",
  "Partially Delivered": "info",
  Delivered: "success",
  Completed: "success",
  Cancelled: "danger",
  Disputed: "danger",
};

function OrdersContent() {
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/builder/orders", { cache: "no-store" });
        const d = await res.json();
        if (active) setOrders(d.orders || []);
      } catch (e) {
        if (active) setError("Unable to load orders.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No orders yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            When a supplier&apos;s quotation is accepted, it becomes an order that the
            supplier confirms and fulfils.
          </p>
          <Link href="/builder/requirements" className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
            Create a requirement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-foreground">{o.orderNumber || "Order"}</p>
                    <Badge tone={STATUS_TONES[o.status] || "muted"}>{o.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {o.supplierProfileId?.businessName || "Supplier"}
                    {o.projectId?.name ? ` · ${o.projectId.name}` : ""}
                  </p>
                  {o.lines?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {o.lines.slice(0, 4).map((l, i) => (
                        <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
                          {l.item || "Line item"} × {l.quantity || 0}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="font-extrabold text-foreground">{formatINR(o.totalAmount)}</span>
                    {o.expectedDelivery && (
                      <span className="text-muted">Expected delivery {formatDate(o.expectedDelivery)}</span>
                    )}
                    {o.payment?.status && (
                      <span className="text-muted">Payment: {o.payment.status}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BuilderOrdersPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Orders" subtitle="Track orders from suppliers">
        <OrdersContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}