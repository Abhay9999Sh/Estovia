"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Wrench,
  FileText,
  Package,
  ClipboardList,
  Star,
  ArrowRight,
  Activity,
  ShieldCheck,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, tone = "accent", href }) {
  const inner = (
    <div className="rounded-2xl border border-border bg-white p-5 h-full">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            tone === "accent"
              ? "bg-accent-light text-accent"
              : tone === "warning"
              ? "bg-amber-50 text-amber-600"
              : tone === "primary"
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="text-2xl font-extrabold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function Dashboard() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/supplier/dashboard", { cache: "no-store" });
        const d = await res.json();
        if (active) setData(d);
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
  }, [status]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Complete your supplier profile</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Set up your business details to start finding requirements and quoting.
        </p>
        <Link
          href="/supplier/onboarding"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
        >
          Complete Onboarding
        </Link>
      </div>
    );
  }

  const a = data.analytics || {};

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/supplier/products" icon={Boxes} label="Products Listed" value={a.productCount} tone="accent" />
        <StatCard href="/supplier/services" icon={Wrench} label="Services Listed" value={a.serviceCount} tone="warning" />
        <StatCard href="/supplier/quotations" icon={FileText} label="Open Quotations" value={a.openQuotations} tone="primary" />
        <StatCard href="/supplier/orders" icon={Package} label="Active Orders" value={a.activeOrders} tone="muted" sub={`${a.completedOrders} completed`} />
        <StatCard href="/supplier/ratings" icon={Star} label="Rating" value={a.rating ? a.rating.toFixed(1) : "—"} tone="warning" sub={`${a.reviewCount} reviews`} />
        <StatCard
          icon={Activity}
          label="Total Revenue"
          value={formatINR(a.totalRevenue?.amount)}
          tone="muted"
          sub="Pending Verification"
        />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Open requirements you can quote on</h2>
          <Link href="/supplier/requirements" className="text-sm font-semibold text-accent hover:text-accent-soft">
            View all
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-white overflow-hidden">
          {(data.openRequirements || []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No open requirements right now</p>
          ) : (
            (data.openRequirements || []).map((r) => (
              <Link
                key={r._id}
                href={`/supplier/requirements/${r._id}`}
                className="flex items-center gap-4 border-b border-border px-5 py-4 hover:bg-secondary transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted">
                    {r.projectId?.name || "No project"} · by {r.builderId?.name || "Builder"}
                  </p>
                </div>
                <Badge tone="info">{r.category || "General"}</Badge>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg font-bold text-foreground">Recent Quotations</h2>
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            {(data.recentQuotations || []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No quotations yet</p>
            ) : (
              (data.recentQuotations || []).map((q) => (
                <Link
                  key={q._id}
                  href={`/supplier/quotations/${q._id}`}
                  className="block border-b border-border px-5 py-4 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{q.requirementId?.title || "Quotation"}</p>
                    <Badge tone={q.status === "Accepted" ? "success" : q.status === "Declined" ? "danger" : "muted"}>
                      {q.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatDate(q.createdAt)} · {formatINR(q.totalAmount)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-lg font-bold text-foreground">Recent Orders</h2>
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            {(data.recentOrders || []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No orders yet</p>
            ) : (
              (data.recentOrders || []).map((o) => (
                <Link
                  key={o._id}
                  href={`/supplier/orders/${o._id}`}
                  className="block border-b border-border px-5 py-4 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{o.orderNumber}</p>
                    <Badge tone={o.status === "Completed" ? "success" : o.status === "Cancelled" ? "danger" : "info"}>
                      {o.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{o.projectId?.name || "No project"} · {formatINR(o.totalAmount)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierDashboardPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Dashboard">
        <Dashboard />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
