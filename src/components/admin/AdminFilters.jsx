"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * Toolbar shared by the Admin list and review screens.
 *
 * The search box keeps its own draft value and reports upstream on a debounce,
 * so typing does not fire a request per keystroke. It re-syncs when the caller
 * changes `search` from outside (back/forward navigation, a "clear" button),
 * which is why the effect compares against the debounced value rather than
 * always assigning.
 */
export default function AdminFilters({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  debounceMs = 350,
  statusValue,
  onStatus,
  statusOptions = [],
  roleValue,
  onRole,
  roleOptions = [],
  right,
}) {
  const [draft, setDraft] = useState(search || "");
  const lastSent = useRef(search || "");

  // Adopt an externally driven change (navigation, reset) without clobbering
  // what the user is currently typing.
  useEffect(() => {
    if (search !== lastSent.current) {
      setDraft(search || "");
      lastSent.current = search || "";
    }
  }, [search]);

  useEffect(() => {
    if (draft === lastSent.current) return undefined;
    const timer = setTimeout(() => {
      lastSent.current = draft;
      onSearch?.(draft);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [draft, debounceMs, onSearch]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
