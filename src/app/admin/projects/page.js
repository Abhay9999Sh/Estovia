"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_OPTIONS = ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"].map((s) => ({ value: s, label: s }));

function buildUrl(page, q, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/projects${qs ? `?${qs}` : ""}`;
}

export default function AdminProjectsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/projects");
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
    <AdminShell title="Projects" subtitle="Read-only oversight — builders manage these, you audit them.">
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search project name or city…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No projects yet." icon={<Building2 className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Builder</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Budget</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => (
                  <tr key={String(p._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/projects/${p._id}`} className="font-semibold text-foreground hover:text-accent">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted">{[p.location?.city, p.location?.state].filter(Boolean).join(", ") || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${p.builderId}`} className="text-foreground hover:text-accent">
                        {p.builder?.name || p.builder?.username || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.projectType || "Residential"}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.estimatedBudget ? formatINR(p.estimatedBudget) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(p.createdAt)}</td>
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