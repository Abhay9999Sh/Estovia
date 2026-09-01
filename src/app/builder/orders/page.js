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
  "Pending Supplier Confirmation": "warning",
  Confirmed: "info",
  Processing: "info",
  Scheduled: "info",
  Dispatched: "warning",
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
        const res = await fetch("/api/builder/quotations?status=Accepted", { cache: "no-store" });
        const d = await res.json();
        if (active) setOrders(d.quotations || []);
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
            Accepted quotations will appear here as orders. Create requirements for your projects to get started.
          </p>
          <Link href="/builder/projects" className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
            Go to Projects <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((q) => (
            <div key={q._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground">{q.requirementId?.title || "Order"}</p>
                    <Badge tone="success">Accepted</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">from {q.supplierProfileId?.businessName || "Supplier"}</p>
                  {q.projectId && (
                    <p className="mt-1 text-xs text-muted">Project: {q.projectId.name}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <span className="font-extrabold text-foreground">{formatINR(q.totalAmount)}</span>
                    {q.leadTimeDays > 0 && <span className="text-muted">{q.leadTimeDays} days delivery</span>}
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
      <BuilderDashboardShell title="Orders" subtitle="Track your orders from suppliers">
        <OrdersContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
