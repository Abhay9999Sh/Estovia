"use client";

import { BarChart3 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminMetricsCard from "@/components/admin/AdminMetricsCard";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { Card, CardHeader, AdminLoading, AdminError } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatINR, formatDate } from "@/lib/format";

function Bar({ items, labelKey = "_id", valueKey = "count", max }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  const m = max || Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div className="flex items-end gap-2">
      {items.map((i, idx) => (
        <div key={idx} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-foreground">{i[valueKey]}</span>
          <div className="w-full rounded-t-lg bg-accent/80" style={{ height: `${Math.max(4, Math.round((i[valueKey] / m) * 80))}px` }} />
          <span className="w-full truncate text-center text-[9px] text-muted">{String(i[labelKey]).slice(0, 10)}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPillGroup({ items, title }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="flex flex-wrap gap-2">
        {(!items || items.length === 0) && <p className="text-sm text-muted">No data yet.</p>}
        {items?.map((i, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <StatusBadge status={String(i._id)} />
            <span className="font-semibold text-foreground">{i.count}</span>
            {i.value ? <span className="text-xs text-muted">{formatINR(i.value)}</span> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const { data, loading, error, refetch } = useAdminFetch("/api/admin/analytics");

  const signups = data?.signupsByDay || [];
  const totalProjects = data?.totals || {};

  return (
    <AdminShell title="Analytics" subtitle="Real usage statistics from the database">
      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}
      {!loading && !error && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <AdminMetricsCard label="Users" value={totalProjects.users} />
            <AdminMetricsCard label="Listings" value={totalProjects.lands} />
            <AdminMetricsCard label="Projects" value={totalProjects.projects} />
            <AdminMetricsCard label="Orders" value={totalProjects.orders} />
            <AdminMetricsCard label="Quotations" value={totalProjects.quotations} />
            <AdminMetricsCard label="Applications" value={totalProjects.applications} />
          </div>

          <Card>
            <CardHeader title="Signups (last 60 days)" subtitle="Daily new accounts" />
            <Bar items={signups} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <StatusPillGroup items={data.usersByRole} title="Users by role" />
            <StatusPillGroup items={data.ordersByStatus} title="Orders by status" />
            <StatusPillGroup items={data.applicationsByStatus} title="Applications by status" />
            <StatusPillGroup items={data.bidsByStatus} title="Quotations by status" />
            <StatusPillGroup items={data.interestsByStatus} title="Land interests by status" />
            <StatusPillGroup items={data.proposalsByStatus} title="Proposals by status" />
            <StatusPillGroup items={data.visitsByStatus} title="Site visits by status" />
            <StatusPillGroup items={data.reqByStatus} title="Requirements by status" />
            <StatusPillGroup items={data.reportByStatus} title="Reports by status" />
          </div>

          <Card>
            <CardHeader title="Top material categories" subtitle="Most listed products" />
            <Bar items={data.topCategories} />
          </Card>

          <Card>
            <CardHeader title="Average listed land price" />
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-2xl font-bold text-foreground">{formatINR(data.avgLandPrice?.avg ?? 0)}</p>
              <p className="text-sm text-muted">Total listed value {formatINR(data.avgLandPrice?.sum ?? 0)}</p>
              <p className="text-xs text-muted">Trend data ends {formatDate(new Date().toISOString())}</p>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}