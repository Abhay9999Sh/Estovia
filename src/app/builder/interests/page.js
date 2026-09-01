"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Loader2,
  MessageSquare,
  ArrowRight,
  Handshake,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { formatDate, formatINR } from "@/lib/demoData";

const TABS = ["all", "pending", "accepted", "rejected", "withdrawn"];

function toneFor(status) {
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  if (status === "withdrawn") return "muted";
  return "info";
}

function InterestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "all";
  const [interests, setInterests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interests?scope=mine", { cache: "no-store" });
      const data = await res.json();
      setInterests(data.interests || []);
    } catch (err) {
      setError("Unable to load your interests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered =
    tab === "all" ? (interests || []) : (interests || []).filter((i) => i.status === tab);

  async function withdraw(i) {
    setActionId(i._id);
    setError("");
    try {
      const res = await fetch(`/api/interests/${i._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err.message || "Unable to withdraw.");
    } finally {
      setActionId(null);
    }
  }

  function startConversation(i) {
    // Open the message thread with this landowner for this land
    router.push(`/builder/messages?land=${i.landId?._id}&owner=${i.landId?.ownerId}`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.push(t === "all" ? "/builder/interests" : `/builder/interests?tab=${t}`)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((i) => (
            <div key={i._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-foreground">{i.landId?.title || "Land listing"}</p>
                    <Badge tone={toneFor(i.status)}>{i.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {i.landId?.location?.city}
                    {i.landId?.location?.state ? `, ${i.landId.location.state}` : ""}
                  </p>

                  {i.purpose && (
                    <p className="mt-2 text-sm text-foreground">
                      Purpose: <span className="font-medium">{i.purpose}</span>
                    </p>
                  )}
                  {i.budget ? (
                    <p className="text-sm text-foreground">Budget: <span className="font-medium">{formatINR(i.budget)}</span></p>
                  ) : null}
                  {i.timeline && (
                    <p className="text-sm text-foreground">Timeline: <span className="font-medium">{i.timeline}</span></p>
                  )}
                  {i.message && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {i.message}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">{formatDate(i.createdAt)}</p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/land/${i.landId?._id}`)}>
                    View Land
                  </Button>
                  {i.status === "accepted" && (
                    <Button size="sm" onClick={() => startConversation(i)}>
                      <Handshake className="h-4 w-4" /> Message
                    </Button>
                  )}
                  {i.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => withdraw(i)}
                      disabled={actionId === i._id}
                    >
                      {actionId === i._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Withdraw"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No {tab} interests</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Express interest in land you like and track it here.
          </p>
          <button
            onClick={() => router.push("/builder/discover")}
            className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft"
          >
            Discover land <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function InterestsPageInner() {
  return (
    <BuilderDashboardShell title="My Interests">
      <InterestsContent />
    </BuilderDashboardShell>
  );
}

export default function InterestsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="My Interests"><div /></BuilderDashboardShell>}>
        <InterestsPageInner />
      </Suspense>
    </AuthShell>
  );
}
