"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/demoData";

function StarRating({ rating, size = 16 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

function RatingsContent() {
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/supplier/dashboard", { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setRatings(d.ratings || []);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError("Unable to load ratings.");
          setLoading(false);
        }
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {ratings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Star className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No ratings yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Complete orders to start receiving ratings from builders.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((r) => (
            <div key={r._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.overallRating} />
                    <span className="text-sm font-bold text-foreground">{r.overallRating?.toFixed(1) || "—"}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">By {r.ratedBy?.name || "Builder"}</p>
                </div>
                <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
              </div>
              {r.review && (
                <p className="mt-3 text-sm text-foreground">{r.review}</p>
              )}
              {r.criteria && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(r.criteria).map(([key, val]) => (
                    <div key={key} className="rounded-lg bg-secondary px-3 py-2 text-center">
                      <p className="text-xs capitalize text-muted">{key}</p>
                      <p className="text-sm font-bold text-foreground">{val}/5</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupplierRatingsPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Ratings & Reviews">
        <RatingsContent />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
