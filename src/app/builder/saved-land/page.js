"use client";

import { useEffect, useState, useCallback } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import LandCard from "@/components/property/LandCard";
import Skeleton from "@/components/ui/Skeleton";

function SavedLandContent() {
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/builder/saved-land", { cache: "no-store" });
      const data = await res.json();
      setRecords(data.saved || []);
    } catch (err) {
      setError("Unable to load saved land.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function unsave(landId) {
    try {
      await fetch(`/api/builder/saved-land/${landId}`, { method: "DELETE" });
      setRecords((r) => r.filter((x) => x.land?._id !== landId));
    } catch (err) {
      setError("Unable to remove. Please try again.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Saved Land</h2>
          <p className="text-sm text-muted">
            Land you&apos;ve saved to shortlist and revisit later.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : records && records.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((r) => (
            <div key={r.savedId} className="relative">
              <LandCard listing={r.land} />
              <button
                onClick={() => unsave(r.land._id)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow text-muted hover:text-danger"
                aria-label="Remove from saved"
                title="Remove from saved"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No saved land yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Save land listings you&apos;re interested in to shortlist them here.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SavedLandPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Saved Land">
        <SavedLandContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
