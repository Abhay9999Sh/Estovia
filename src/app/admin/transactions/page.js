"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty, Card } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR, timeAgo } from "@/lib/format";

const STATUS_OPTIONS = ["Pending", "Manual Review", "Initiated", "Partial", "Partially Paid", "Completed", "Not Required"].map((s) => ({ value: s, label: s }));
const KIND_OPTIONS = [
  { value: "order", label: "Procurement" },
  { value: "application", label: "Bookings" },
];

function buildUrl(page, q, status, kind) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  if (kind && kind !== "all") p.set("kind", kind);
  const qs = p.toString();
  return `/api/admin/transactions${qs ? `?${qs}` : ""}`;
}

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [url, setUrl] = useState("/api/admin/transactions");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, status, kind));
  };
  const onStatus = (v) => {
    setStatus(v);
    setPage(1);
    setUrl(buildUrl(1, q, v, kind));
  };
  const onKind = (v) => {
    setKind(v);
    setPage(1);
    setUrl(buildUrl(1, q, status, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, status, kind));
  };

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;
  const totals = data?.totals || {};

  return (
    <AdminShell title="Transactions" subtitle="Synthesised from order + booking payments">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><p className="text-xs font-semibold text-muted">Pending value</p><p className="mt-1 text-xl font-bold text-foreground">{formatINR(totals.pending ?? 0)}</p></Card>
          <Card><p className="text-xs font-semibold text-muted">Completed value</p><p className="mt-1 text-xl font-bold text-foreground">{formatINR(totals.completed ?? 0)}</p></Card>
          <Card><p className="text-xs font-semibold text-muted">Procurement volume</p><p className="mt-1 text-xl font-bold text-foreground">{formatINR(totals.orders ?? 0)}</p></Card>
          <Card><p className="text-xs font-semibold text-muted">Booking volume</p><p className="mt-1 text-xl font-bold text-foreground">{formatINR(totals.applications ?? 0)}</p></Card>
        </div>

        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search reference number…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
          roleValue={kind}
          onRole={onKind}
          roleOptions={KIND_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No transactions found." icon={<Banknote className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">From → To</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((t) => (
                  <tr key={`${t.source}-${t.id}`} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 font-semibold text-foreground">{t.reference}</td>
                    <td className="px-4 py-3 text-muted">
                      <span className="text-foreground">{t.from}</span> → {t.to}
                    </td>
                    <td className="px-4 py-3 text-muted">{t.kind}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatINR(t.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(t.updatedAt)}</td>
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