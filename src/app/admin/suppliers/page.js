"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "verified", label: "Verified" },
  { value: "complete", label: "Completed profile" },
  { value: "pending", label: "In progress profile" },
];

function buildUrl(page, q, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/suppliers${qs ? `?${qs}` : ""}`;
}

export default function AdminSuppliersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/suppliers");
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
    <AdminShell title="Suppliers" subtitle={`${total} supplier businesses on the platform`}>
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search business, owner, GST/PAN…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No supplier profiles match." icon={<Users className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                  <th className="px-4 py-3 font-semibold">Orders</th>
                  <th className="px-4 py-3 font-semibold">Revenue</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((s) => (
                  <tr key={String(s._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{s.businessName || "—"}</p>
                      <p className="text-xs text-muted">{s.gstin || s.pan || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.user ? (
                        <Link href={`/admin/users/${s.userId}`} className="text-foreground hover:text-accent">
                          {s.user.name || s.user.username}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{s.category || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.verificationStatus} /></td>
                    <td className="px-4 py-3">{s.stats?.orders ?? 0}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatINR(s.stats?.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(s.createdAt)}</td>
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