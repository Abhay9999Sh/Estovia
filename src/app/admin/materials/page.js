"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "verified", label: "Verified" },
];

function buildUrl(page, q, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/materials${qs ? `?${qs}` : ""}`;
}

export default function AdminMaterialsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/materials");
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
    <AdminShell title="Materials" subtitle="Supplier product catalogue">
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search product, category, brand…"
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No products found." icon={<Boxes className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Price / unit</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Verified</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => (
                  <tr key={String(p._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted">{p.brand || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.supplier?.businessName || p.supplier?.ownerName || "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.category || "—"}{p.subcategory ? ` / ${p.subcategory}` : ""}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatINR(p.pricePerUnit)}{p.discountPercent ? ` (-${p.discountPercent}%)` : ""}
                    </td>
                    <td className="px-4 py-3">{p.availableQuantity ?? 0} {p.unit}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.isVerified ? "verified" : "pending"} /></td>
                    <td className="px-4 py-3"><StatusBadge status={p.isActive ? "active" : "inactive"} /></td>
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