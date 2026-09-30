"use client";

import { useState } from "react";
import Link from "next/link";
import { Users as UsersIcon, ExternalLink } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import VerificationChips from "@/components/admin/VerificationChips";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatDate, initials } from "@/lib/format";
import { VERIFIED_ROLES, roleLabel } from "@/lib/verification";

const ROLE_OPTIONS = ["viewer", ...VERIFIED_ROLES, "admin"].map((r) => ({
  value: r,
  label: roleLabel(r),
}));

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deactivated", label: "Deactivated" },
  { value: "profile_pending", label: "Profile incomplete" },
  { value: "profile_completed", label: "Profile complete" },
];

const VERIFICATION_OPTIONS = [
  { value: "needs_action", label: "Needs a decision" },
  { value: "needs_info", label: "Needs info / rejected" },
  { value: "submitted", label: "Any field submitted" },
  { value: "under_review", label: "Any field under review" },
  { value: "needs_information", label: "Any field needs info" },
  { value: "verified", label: "Any field verified" },
  { value: "rejected", label: "Any field rejected" },
  { value: "pending", label: "Any field pending" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
];

function buildUrl(page, q, role, status, verification, sort) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (role && role !== "all") p.set("role", role);
  if (status && status !== "all") p.set("status", status);
  if (verification && verification !== "all") p.set("verification", verification);
  if (sort && sort !== "newest") p.set("sort", sort);
  const qs = p.toString();
  return `/api/admin/users${qs ? `?${qs}` : ""}`;
}

const INITIAL = { page: 1, q: "", role: "all", status: "all", verification: "all", sort: "newest" };

export default function AdminUsersPage() {
  const [filters, setFilters] = useState(INITIAL);
  const [url, setUrl] = useState(buildUrl(INITIAL.page, "", "all", "all", "all", "newest"));
  const { data, loading, error, refetch } = useAdminFetch(url);

  function apply(patch) {
    const next = { ...filters, page: 1, ...patch };
    setFilters(next);
    setUrl(buildUrl(next.page, next.q, next.role, next.status, next.verification, next.sort));
  }

  function goPage(page) {
    const next = { ...filters, page };
    setFilters(next);
    setUrl(buildUrl(next.page, next.q, next.role, next.status, next.verification, next.sort));
  }

  const users = data?.users || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Users" subtitle={`${total} accounts on the platform`}>
      <div className="space-y-4">
        <AdminFilters
          search={filters.q}
          onSearch={(v) => apply({ q: v })}
          searchPlaceholder="Search name, username, email or phone…"
          roleValue={filters.role}
          onRole={(v) => apply({ role: v })}
          roleOptions={ROLE_OPTIONS}
          statusValue={filters.status}
          onStatus={(v) => apply({ status: v })}
          statusOptions={STATUS_OPTIONS}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.verification}
                onChange={(e) => apply({ verification: e.target.value })}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="all">Any verification</option>
                {VERIFICATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.sort}
                onChange={(e) => apply({ sort: e.target.value })}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Sort: {o.label}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && users.length === 0 && (
          <AdminEmpty
            message="No users match these filters."
            icon={<UsersIcon className="h-6 w-6 text-muted" />}
          />
        )}

        {!loading && !error && users.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Roles</th>
                  <th className="px-4 py-3 font-semibold">Profile</th>
                  <th className="px-4 py-3 font-semibold">Verification</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr
                    key={String(u._id)}
                    className="transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u._id}`} className="group flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                          {initials(u.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground group-hover:text-accent">
                            {u.name || u.username}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {u.email || `@${u.username}`}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(u.roles) ? u.roles : [u.roles]).filter(Boolean).map((r) => (
                          <StatusBadge key={r} status={r} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={u.profileCompleted ? "Completed" : "Incomplete"}
                        className={
                          u.profileCompleted
                            ? "!bg-green-50 !text-green-700"
                            : "!bg-amber-50 !text-amber-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      {(u.verificationByRole || []).length === 0 ? (
                        <span className="text-xs text-muted">No role profile</span>
                      ) : (
                        <div className="space-y-1.5">
                          {u.verificationByRole.map((v) => (
                            <div key={v.role} className="flex items-start gap-2">
                              <span className="w-16 flex-shrink-0 pt-0.5 text-[11px] font-semibold text-muted">
                                {roleLabel(v.role)}
                              </span>
                              <VerificationChips
                                fields={v.statuses}
                                meta={v.reasons}
                                only={Object.keys(v.statuses)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge
                          status={u.accountStatus || "active"}
                          className={
                            u.accountStatus === "suspended"
                              ? "!bg-red-50 !text-red-700"
                              : u.accountStatus === "deactivated"
                              ? "!bg-slate-100 !text-slate-600"
                              : "!bg-green-50 !text-green-700"
                          }
                        />
                        {u.needsAction && (
                          <span className="text-[11px] font-medium text-amber-700">
                            needs a decision
                          </span>
                        )}
                        {u.needsInfo && !u.needsAction && (
                          <span className="text-[11px] font-medium text-red-700">
                            needs info
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${u._id}`}
                        className="text-accent hover:text-accent-soft"
                        aria-label="Open user"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination page={filters.page} pageCount={pageCount} total={total} onPage={goPage} />
      </div>
    </AdminShell>
  );
}
