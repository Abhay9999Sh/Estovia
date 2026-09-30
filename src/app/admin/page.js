"use client";

import Link from "next/link";
import {
  Users,
  Map,
  Building2,
  ShoppingCart,
  ShieldCheck,
  FileCheck2,
  Flag,
  Gavel,
  Banknote,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminMetricsCard from "@/components/admin/AdminMetricsCard";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { Card, AdminLoading, AdminError } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatINR, timeAgo, initials } from "@/lib/format";
import { roleLabel, displayStatus } from "@/lib/verification";

const VERIFICATION_COLORS = {
  verified: "#10b981",
  partial: "#14b8a6",
  under_review: "#f59e0b",
  needs_information: "#b45309",
  pending: "#94a3b8",
  rejected: "#ef4444",
};

function RoleVerificationChart({ data }) {
  // Only the five states `deriveOverall` can return. `needs_information` is a
  // per-field status, not an overall one, so it is surfaced as its own tile.
  const states = ["verified", "partial", "under_review", "pending", "rejected"];

  const rows = Object.entries(data || {}).map(([role, counts]) => {
    const total = counts?.total || 0;
    const segments = states
      .map((s) => ({ state: s, value: counts?.[s] || 0 }))
      .filter((s) => s.value > 0);
    return { role, total, counts, segments };
  });

  return (
    <div className="space-y-4">
      {rows.length === 0 && <p className="text-sm text-muted">No verification data yet.</p>}
      {rows.map(({ role, total, segments }) => (
        <div key={role}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">{roleLabel(role)}</span>
            <span className="text-xs text-muted">
              {total === 0
                ? "no profiles"
                : `${total} profile${total === 1 ? "" : "s"}`}
            </span>
          </div>
          {total > 0 && (
            <>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                {segments.map((s) => (
                  <div
                    key={s.state}
                    style={{ width: `${(s.value / total) * 100}%`, background: VERIFICATION_COLORS[s.state] }}
                    title={`${displayStatus(s.state)}: ${s.value}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {segments.map((s) => (
                  <span key={s.state} className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: VERIFICATION_COLORS[s.state] }} />
                    {displayStatus(s.state)} {s.value}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivityChart({ points }) {
  const series = points || [];
  if (!series.length) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted">No verification activity recorded yet.</p>
      </div>
    );
  }
  const W = 560;
  const H = 160;
  const padX = 8;
  const padY = 16;
  const max = Math.max(1, ...series.map((p) => p.count));
  const stepX = (W - padX * 2) / Math.max(1, series.length - 1);
  const pts = series.map((p, i) => ({
    x: padX + i * stepX,
    y: H - padY - (p.count / max) * (H - padY * 2),
    count: p.count,
    label: p.date.slice(5),
  }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${padX},${H - padY} ${line} ${pts.length ? pts[pts.length - 1].x.toFixed(1) : padX},${H - padY}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Verification activity over last 14 days">
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#e2e8f0" strokeWidth="1" />
        <polygon points={area} fill="rgba(20,184,166,0.08)" />
        <polyline points={line} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="3" fill="#14b8a6">
            <title>{`${p.label}: ${p.count} action${p.count === 1 ? "" : "s"}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, loading, error, refetch } = useAdminFetch("/api/admin/dashboard");

  const stats = data?.stats || {};
  const recent = data?.recent || {};

  const quickLinks = [
    { label: "Verification queue", href: "/admin/verification", value: stats.pendingVerifications ?? "—", icon: ShieldCheck, tone: "amber" },
    { label: "Documents to review", href: "/admin/documents", value: stats.pendingDocuments ?? "—", icon: FileCheck2, tone: "blue" },
    { label: "Land pending approval", href: "/admin/land", value: stats.pendingLands ?? "—", icon: Map, tone: "amber" },
    { label: "Open reports", href: "/admin/reports", value: stats.openReports ?? "—", icon: Flag, tone: "red" },
    { label: "Procurement orders", href: "/admin/orders", value: stats.orders ?? "—", icon: ShoppingCart, tone: "green" },
    { label: "Awaiting info", href: "/admin/verification", value: stats.needsInfo ?? "—", icon: FileCheck2, tone: "amber" },
  ];

  return (
    <AdminShell title="Admin Dashboard" subtitle="Platform health at a glance">
      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}
      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <AdminMetricsCard label="Users" value={stats.users} icon={Users} tone="accent" hint="All registered accounts" />
            <AdminMetricsCard label="Land listings" value={stats.lands} icon={Map} tone="green" hint={`${stats.pendingLands ?? 0} awaiting approval`} />
            <AdminMetricsCard label="Projects" value={stats.projects} icon={Building2} tone="blue" hint={`${stats.pendingProjects ?? 0} in active phases`} />
            <AdminMetricsCard label="Orders" value={stats.orders} icon={ShoppingCart} tone="amber" hint="Procurement engagements" />
            <AdminMetricsCard label="Applications" value={stats.applications} icon={FileCheck2} tone="green" />
            <AdminMetricsCard label="Bids submitted" value={stats.quotations} icon={Gavel} tone="blue" />
            <AdminMetricsCard label="Reports" value={stats.reports} icon={Flag} tone="red" hint={`${stats.openReports ?? 0} open`} />
            <AdminMetricsCard label="Transactions" value={stats.orders + stats.applications} icon={Banknote} tone="slate" hint="Orders + bookings" />
          </div>

          <div className="grid lg:w-full lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Quick actions</h3>
                <Link href="/admin/verification" className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-soft">
                  Open queue <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {quickLinks.map((q) => (
                  <Link
                    key={q.label}
                    href={q.href}
                    className="rounded-xl border border-border bg-secondary/40 p-3 transition-colors hover:border-accent"
                  >
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${q.tone === "red" ? "bg-red-50 text-red-600" : q.tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-700"}`}>
                      <q.icon className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-xs font-medium text-muted">{q.label}</p>
                    <p className="text-lg font-bold text-foreground">{q.value}</p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 text-sm font-bold text-foreground">Recent signups</h3>
              <div className="space-y-3">
                {(recent.signups || []).slice(0, 6).map((u) => (
                  <Link key={String(u._id)} href={`/admin/users/${u._id}`} className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-secondary">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{u.name || u.username}</p>
                      <p className="truncate text-xs text-muted">
                        {(Array.isArray(u.roles) ? u.roles : [u.roles]).filter(Boolean).join(", ") || "viewer"}
                      </p>
                    </div>
                    <span className="text-xs text-muted">{timeAgo(u.createdAt)}</span>
                  </Link>
                ))}
                {(recent.signups || []).length === 0 && <p className="text-sm text-muted">No signups yet.</p>}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <h3 className="mb-4 text-sm font-bold text-foreground">Verification by role</h3>
              <RoleVerificationChart data={data.breakdown?.verificationByRole} />
            </Card>
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Verification activity</h3>
                <div className="flex flex-wrap gap-2">
                  {(data.breakdown?.verificationActions || []).map((a) => (
                    <span key={a.action} className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-medium text-muted">
                      {a.action.replace(/_/g, " ")} · {a.count}
                    </span>
                  ))}
                </div>
              </div>
              <ActivityChart points={data.activity?.verification} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-sm font-bold text-foreground">Recent listings</h3>
              <div className="space-y-3">
                {(recent.listings || []).map((l) => (
                  <div key={String(l._id)} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/land/${l._id}`} className="block truncate text-sm font-semibold text-foreground hover:text-accent">
                        {l.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span>{l.location?.city || l.location?.state || "—"}</span>
                        <span>•</span>
                        <StatusBadge status={l.verificationStatus} />
                        <StatusBadge status={l.status} />
                      </div>
                    </div>
                    <span className="text-xs text-muted">{timeAgo(l.createdAt)}</span>
                  </div>
                ))}
                {(recent.listings || []).length === 0 && <p className="text-sm text-muted">No listings yet.</p>}
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 text-sm font-bold text-foreground">Recent orders</h3>
              <div className="space-y-3">
                {(recent.orders || []).map((o) => (
                  <div key={String(o._id)} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{o.orderNumber || String(o._id).slice(-6)}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span>{formatINR(o.totalAmount)}</span>
                        <span>•</span>
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                    <span className="text-xs text-muted">{timeAgo(o.createdAt)}</span>
                  </div>
                ))}
                {(recent.orders || []).length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}