"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_OPTIONS = ["Draft", "Open", "Responses Received", "Shortlisted", "Quotation Selected", "Order Placed", "Fulfilled", "Cancelled", "Closed"].map((s) => ({ value: s, label: s }));

function buildUrl(page, q, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/requirements${qs ? `?${qs}` : ""}`;
}

export default function AdminRequirementsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/requirements");
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
    <AdminShell title="Requirements" subtitle="Procurement requests by builders">
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search title, category, location…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No requirements yet." icon={<ClipboardList className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Builder</th>
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Est. value</th>
                  <th className="px-4 py-3 font-semibold">Bids</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r) => (
                  <tr key={String(r._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{r.title}</p>
                      <p className="text-xs text-muted">{r.category || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{r.builder?.name || r.builder?.username || "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.project?.name || "—"}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatINR(r.estimatedValue)}</td>
                    <td className="px-4 py-3">{r.quotationCount ?? 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(r.requiredBy)}</td>
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