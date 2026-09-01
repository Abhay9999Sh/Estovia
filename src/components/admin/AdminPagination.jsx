"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AdminPagination({ page, pageCount, total, onPage }) {
  if (!total || pageCount <= 1) return null;
  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted">
        Page {page} of {pageCount} • {total} result{total === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          onClick={() => onPage(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}