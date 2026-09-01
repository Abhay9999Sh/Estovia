"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
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

function OrdersList() {
  const { status } = useAuth();
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/supplier/orders", { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setOrders(d.orders || []);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status]);

  if (loading || !orders) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <>
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No orders yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Orders appear here when a builder accepts your quotation.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((o) => (
              <Link
                key={o._id}
                href={`/supplier/orders/${o._id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-white p-5 transition-colors hover:border-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{o.orderNumber}</p>
                    <Badge tone={toneMap[o.status] || "muted"}>{o.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {o.projectId?.name || "Project"} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="font-extrabold text-foreground">{formatINR(o.totalAmount)}</span>
                  <ArrowRight className="h-5 w-5 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
    </>
  );
}

export default function SupplierOrdersPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Orders">
        <OrdersList />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
