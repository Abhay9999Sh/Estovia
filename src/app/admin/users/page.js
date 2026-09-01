"use client";

import { useState } from "react";
import Link from "next/link";
import { Users as UsersIcon, ExternalLink } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatDate, initials } from "@/lib/format";

const ROLE_OPTIONS = ["viewer", "landowner", "builder", "supplier", "buyer", "admin"].map((r) => ({
  value: r,
  label: r.charAt(0).toUpperCase() + r.slice(1),
}));
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deactivated", label: "Deactivated" },
  { value: "profile_pending", label: "Profile incomplete" },
  { value: "profile_completed", label: "Profile complete" },
];

function buildUrl(page, q, role, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (role && role !== "all") p.set("role", role);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/users${qs ? `?${qs}` : ""}`;
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/users");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, role, status));
  };
  const onRole = (v) => {
    setRole(v);
    setPage(1);
    setUrl(buildUrl(1, q, v, status));
  };
  const onStatus = (v) => {
    setStatus(v);
    setPage(1);
    setUrl(buildUrl(1, q, role, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, role, status));
  };

  const users = data?.users || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Users" subtitle={`${total} accounts on the platform`}>
      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search name, username or email…"
          roleValue={role}
          onRole={onRole}
          roleOptions={ROLE_OPTIONS}
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && users.length === 0 && (
          <AdminEmpty message="No users match these filters." icon={<UsersIcon className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && users.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Roles</th>
                  <th className="px-4 py-3 font-semibold">Profile</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={String(u._id)} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u._id}`} className="flex items-center gap-3 group">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                          {initials(u.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground group-hover:text-accent">
                            {u.name || u.username}
                          </span>
                          <span className="block truncate text-xs text-muted">{u.email || `@${u.username}`}</span>
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
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u._id}`} className="text-accent hover:text-accent-soft">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
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