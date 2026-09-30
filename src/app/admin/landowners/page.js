"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin as LandIcon, ExternalLink } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import VerificationChips from "@/components/admin/VerificationChips";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatDate, initials } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "verified", label: "Fully verified" },
  { value: "partial", label: "Partially verified" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review / needs info" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended account" },
];
const FIELD_OPTIONS = ["identity", "address", "phone"].map((f) => ({
  value: f,
  label: f.charAt(0).toUpperCase() + f.slice(1),
}));

function buildUrl(page, q, status, field, fieldStat, sort) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  if (field && field !== "all") p.set("field", field);
  if (fieldStat && fieldStat !== "all") p.set("fieldStat", fieldStat);
  if (sort && sort !== "newest") p.set("sort", sort);
  const qs = p.toString();
  return `/api/admin/landowners${qs ? `?${qs}` : ""}`;
}

export default function AdminLandownersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [field, setField] = useState("all");
  const [fieldStat, setFieldStat] = useState("all");
  const [sort, setSort] = useState("newest");
  const [url, setUrl] = useState("/api/admin/landowners");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const go = (pg, qq, st, f, fs, srt) => setUrl(buildUrl(pg, qq, st, f, fs, srt));

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Landowners" subtitle={`${total} landowners`}>
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
            go(1, v, status, field, fieldStat, sort);
          }}
          searchPlaceholder="Search name, email or PAN…"
          statusValue={status}
          onStatus={(v) => {
            setStatus(v);
            setPage(1);
            go(1, q, v, field, fieldStat, sort);
          }}
          statusOptions={STATUS_OPTIONS}
          right={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setPage(1);
                  go(1, q, status, e.target.value, fieldStat, sort);
                }}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="all">All categories</option>
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              {field !== "all" && (
                <select
                  value={fieldStat}
                  onChange={(e) => {
                    setFieldStat(e.target.value);
                    setPage(1);
                    go(1, q, status, field, e.target.value, sort);
                  }}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="all">Any status</option>
                  {["verified", "submitted", "under_review", "needs_information", "rejected", "pending"].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                  go(1, q, status, field, fieldStat, e.target.value);
                }}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="verification">By verification</option>
              </select>
            </div>
          }
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No landowners match these filters." icon={<LandIcon className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Landowner</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                  <th className="px-4 py-3 font-semibold">Overall</th>
                  <th className="px-4 py-3 font-semibold">Land listings</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((o) => (
                  <tr key={String(o.userId)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${o.userId}`} className="group flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                          {initials(o.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground group-hover:text-accent">
                            {o.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            @{o.username}
                            {o.ownershipType ? ` • ${o.ownershipType}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 text-xs text-muted">{o.email || "—"}</td>
                    <td className="px-4 py-3">
                      <VerificationChips fields={o.verification} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.overall} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="font-semibold text-foreground">{o.listings?.count || 0}</span>
                        <span>listings</span>
                        <span className="text-xs">
                          <span className="font-medium text-green-600">✓ {o.listings?.verified || 0}</span>
                          <span className="mx-0.5">/</span>
                          <span className="font-medium text-amber-600">{o.listings?.pending || 0} pending</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${o.userId}`} className="text-accent hover:text-accent-soft">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination page={page} pageCount={pageCount} total={total} onPage={(p) => {
          setPage(p);
          go(p, q, status, field, fieldStat, sort);
        }} />
      </div>
    </AdminShell>
  );
}