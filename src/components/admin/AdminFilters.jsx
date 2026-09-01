"use client";

import { Search } from "lucide-react";

export default function AdminFilters({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  statusValue,
  onStatus,
  statusOptions = [],
  roleValue,
  onRole,
  roleOptions = [],
  right,
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent sm:w-64"
          />
        </div>
        {onStatus && (
          <select
            value={statusValue || ""}
            onChange={(e) => onStatus(e.target.value)}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {onRole && (
          <select
            value={roleValue || ""}
            onChange={(e) => onRole(e.target.value)}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
          >
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {right}
    </div>
  );
}