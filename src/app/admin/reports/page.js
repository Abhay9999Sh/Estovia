"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { timeAgo, truncate } from "@/lib/format";

const STATUS_OPTIONS = ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION", "RESOLVED", "CLOSED"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }));

function buildUrl(page, q, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/reports${qs ? `?${qs}` : ""}`;
}

export default function AdminReportsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/reports");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, status));
  };
  const onStatus = (v) => {
    setStatus(v);
    setPage(1);
    setUrl(buildUrl(1, q, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, status));
  };

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Reports & Disputes" subtitle={`${total} reports raised`}>
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search subject, description…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No reports yet." icon={<Flag className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Reporter</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Raised</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r) => (
                  <tr key={String(r._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/reports/${r._id}`} className="font-mono text-xs font-semibold text-accent hover:text-accent-soft">
                        #{String(r._id).slice(-6)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.category || r.subjectType}</p>
                      <p className="max-w-[280px] truncate text-xs text-muted">{truncate(r.description, 70)}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{r.reporter?.name || r.reporter?.username || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination page={page} pageCount={pageCount} total={total} onPage={onPage} />
      </div>
    </AdminShell>
  );
}