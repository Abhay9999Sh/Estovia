"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  User as UserIcon,
  Check,
  X,
  Loader2,
  MessageSquare,
  HardHat,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/demoData";

function InterestsContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "builder" ? "builder" : "buyer";
  const [interests, setInterests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interests?scope=owner", { cache: "no-store" });
      const data = await res.json();
      setInterests((data.interests || []).filter((i) => i.type === type));
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function respond(i, action) {
    setActionId(i._id);
    setError("");
    try {
      const res = await fetch(`/api/interests/${i._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err.message || "Unable to respond.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {type === "builder" ? "Builder Requests" : "Interested Buyers"}
        </h2>
        <p className="text-sm text-muted">
          Users who have expressed interest in your listings.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : interests && interests.length > 0 ? (
        <div className="space-y-3">
          {interests.map((i) => (
            <div
              key={i._id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 md:flex-row md:items-center"
            >
              <div className="flex flex-1 items-center gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {i.interestedUserRef?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "U"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-bold text-foreground">
                      {i.interestedUserRef?.name || "User"}
                    </p>
                    <Badge tone={i.type === "builder" ? "primary" : "info"}>
                      {i.type === "builder" ? (
                        <HardHat className="h-3 w-3" />
                      ) : (
                        <UserIcon className="h-3 w-3" />
                      )}
                      {i.type === "builder" ? "Builder" : "Buyer"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    Interested in{" "}
                    <span className="font-medium text-foreground">
                      {i.landId?.title || "your listing"}
                    </span>
                  </p>
                  {i.message && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {i.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">{formatDate(i.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:flex-shrink-0">
                {i.status === "pending" ? (
                  <>
                    <button
                      onClick={() => respond(i, "accept")}
                      disabled={actionId === i._id}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-soft disabled:opacity-60"
                    >
                      {actionId === i._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => respond(i, "reject")}
                      disabled={actionId === i._id}
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold text-muted hover:border-danger hover:text-danger disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </>
                ) : (
                  <Badge tone={i.status === "accepted" ? "success" : "muted"}>
                    {i.status === "accepted" ? "Accepted" : "Declined"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <UserIcon className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No {type}s yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            When {" "}{type}s express interest in your land, they&apos;ll appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function InterestsPageInner() {
  return (
    <DashboardShell title="Interested Users">
      <InterestsContent />
    </DashboardShell>
  );
}

export default function InterestsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Logo />}>
        <InterestsPageInner />
      </Suspense>
    </AuthShell>
  );
}
