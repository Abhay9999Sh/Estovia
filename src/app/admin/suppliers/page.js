"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import VerificationChips from "@/components/admin/VerificationChips";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "verified", label: "Fully verified" },
  { value: "partial", label: "Partially verified" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review / needs info" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended account" },
];
const PROFILE_OPTIONS = [
  { value: "complete", label: "Profile completed" },
  { value: "incomplete", label: "Profile in progress" },
];
const FIELD_OPTIONS = ["phone", "business", "gst", "pan", "udyam", "address"].map((f) => ({
  value: f,
  label: f.charAt(0).toUpperCase() + f.slice(1),
}));

function buildUrl(page, q, status, profile, field, fieldStat, sort) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (status && status !== "all") p.set("status", status);
  if (profile && profile !== "all") p.set("profile", profile);
  if (field && field !== "all") p.set("field", field);
  if (fieldStat && fieldStat !== "all") p.set("fieldStat", fieldStat);
  if (sort && sort !== "newest") p.set("sort", sort);
  const qs = p.toString();
  return `/api/admin/suppliers${qs ? `?${qs}` : ""}`;
}

export default function AdminSuppliersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [profile, setProfile] = useState("all");
  const [field, setField] = useState("all");
  const [fieldStat, setFieldStat] = useState("all");
  const [sort, setSort] = useState("newest");
  const [url, setUrl] = useState("/api/admin/suppliers");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const go = (pg, qq, st, pr, f, fs, srt) => setUrl(buildUrl(pg, qq, st, pr, f, fs, srt));

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Suppliers" subtitle={`${total} supplier businesses on the platform`}>
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={(v) => {
            setQ(v);
            setPage(1);
            go(1, v, status, profile, field, fieldStat, sort);
          }}
          searchPlaceholder="Search business, owner, GST/PAN…"
          statusValue={status}
          onStatus={(v) => {
            setStatus(v);
            setPage(1);
            go(1, q, v, profile, field, fieldStat, sort);
          }}
          statusOptions={STATUS_OPTIONS}
          right={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={profile}
                onChange={(e) => {
                  setProfile(e.target.value);
                  setPage(1);
                  go(1, q, status, e.target.value, field, fieldStat, sort);
                }}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="all">Any profile state</option>
                {PROFILE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setFieldStat("all");
                  setPage(1);
                  go(1, q, status, profile, e.target.value, "all", sort);
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
                    go(1, q, status, profile, field, e.target.value, sort);
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
                  go(1, q, status, profile, field, fieldStat, e.target.value);
                }}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="verification">By verification</option>
                <option value="name">By name</option>
              </select>
            </div>
          }
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No supplier profiles match these filters." icon={<Building2 className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                  <th className="px-4 py-3 font-semibold">Overall</th>
                  <th className="px-4 py-3 font-semibold">Orders</th>
                  <th className="px-4 py-3 font-semibold">Revenue</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((s) => (
                  <tr key={String(s.userId)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{s.businessName || "—"}</p>
                      <p className="text-xs text-muted">{s.gstin || s.pan || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.user ? (
                        <Link href={`/admin/users/${s.userId}`} className="text-foreground hover:text-accent">
                          {s.user.name || s.user.username}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{s.category || "—"}</td>
                    <td className="px-4 py-3">
                      <VerificationChips fields={s.verification} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.overall} />
                    </td>
                    <td className="px-4 py-3">{s.stats?.orders ?? 0}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatINR(s.stats?.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${s.userId}`} className="text-accent hover:text-accent-soft">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          page={page}
          pageCount={pageCount}
          total={total}
          onPage={(p) => {
            setPage(p);
            go(p, q, status, profile, field, fieldStat, sort);
          }}
        />
      </div>
    </AdminShell>
  );
}
