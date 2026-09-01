"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty, Card } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { timeAgo } from "@/lib/format";

const ROLE_OPTIONS = ["admin", "viewer", "landowner", "builder", "supplier", "buyer"].map((r) => ({ value: r, label: r }));

function buildUrl(page, q, role) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (role && role !== "all") p.set("role", role);
  return `/api/admin/logs${p.toString() ? `?${p}` : ""}`;
}

export default function AdminLogsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [url, setUrl] = useState("/api/admin/logs");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, role));
  };
  const onRole = (v) => {
    setRole(v);
    setPage(1);
    setUrl(buildUrl(1, q, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, role));
  };

  const logs = data?.logs || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;
  const byAction = data?.byAction || [];

  return (
    <AdminShell title="Audit Logs" subtitle={`${total} immutable audit entries`}>
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-1">
            <h3 className="mb-3 text-sm font-bold text-foreground">Top actions</h3>
            <div className="space-y-2">
              {byAction.map((a) => (
                <div key={a._id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted">{a._id}</span>
                  <span className="font-semibold text-foreground">{a.count}</span>
                </div>
              ))}
              {byAction.length === 0 && <p className="text-sm text-muted">No logs yet.</p>}
            </div>
          </Card>

          <div className="lg:col-span-3">
            <AdminFilters search={q} onSearch={onSearch} searchPlaceholder="Search action, entity, reason…" roleValue={role} onRole={onRole} roleOptions={ROLE_OPTIONS} />

            {loading && <div className="mt-4"><AdminLoading rows={8} /></div>}
            {error && <div className="mt-4"><AdminError message={error} onRetry={refetch} /></div>}
            {!loading && !error && logs.length === 0 && (
              <div className="mt-4"><AdminEmpty message="No audit entries found." icon={<ScrollText className="h-6 w-6 text-muted" />} /></div>
            )}
            {!loading && !error && logs.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Entity</th>
                      <th className="px-4 py-3 font-semibold">Actor</th>
                      <th className="px-4 py-3 font-semibold">Transition</th>
                      <th className="px-4 py-3 font-semibold">Reason</th>
                      <th className="px-4 py-3 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((l) => (
                      <tr key={String(l._id)} className="align-top transition-colors hover:bg-secondary/40">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{l.action}</td>
                        <td className="px-4 py-3">
                          <span className="text-muted">{l.entity}</span>
                          {l.entityId && <span className="block font-mono text-[11px] text-muted/70">{l.entityId}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-muted">{l.actorRole || "—"}</span>
                          {l.actorId && <span className="block font-mono text-[11px] text-muted/70">{l.actorId}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {l.previousStatus ? <StatusBadge status={l.previousStatus} /> : <span className="text-muted">—</span>}
                            <span className="text-muted">→</span>
                            {l.newStatus ? <StatusBadge status={l.newStatus} /> : <span className="text-muted">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="truncate text-xs text-muted" title={l.reason}>{l.reason || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{timeAgo(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4">
              <AdminPagination page={page} pageCount={pageCount} total={total} onPage={onPage} />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}