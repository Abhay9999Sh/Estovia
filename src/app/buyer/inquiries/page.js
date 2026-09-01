"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, ArrowRight, MessageSquare, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/demoData";

const TABS = ["all", "New", "Open", "Responded", "Closed", "Converted"];

function toneFor(status) {
  const s = status?.toLowerCase();
  if (s === "new") return "info";
  if (s === "responded") return "success";
  if (s === "converted") return "success";
  if (s === "closed") return "muted";
  return "warning";
}

function InquiriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const [inquiries, setInquiries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/buyer/inquiries", { cache: "no-store" });
      const d = await res.json();
      setInquiries(d.inquiries || []);
    } catch (e) {
      setError("Unable to load inquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const filtered = tab === "all" ? (inquiries || []) : (inquiries || []).filter((i) => i.status === tab);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => router.push(t === "all" ? "/buyer/inquiries" : `/buyer/inquiries?tab=${t}`)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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
                    <p className="text-base font-bold text-foreground">{i.projectId?.name || "Project"}</p>
                    <Badge tone={toneFor(i.status)}>{i.status}</Badge>
                  </div>
                  {i.unitId && (
                    <p className="mt-0.5 text-sm text-muted">Unit {i.unitId.unitNumber || "—"}</p>
                  )}
                  <p className="mt-1 text-sm text-muted">{i.message || "No message"}</p>
                  <p className="mt-2 text-xs text-muted">{formatDate(i.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/buyer/projects/${i.projectId?._id}`)}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    View Project
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No {tab.toLowerCase()} inquiries</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Send inquiries from project pages to get in touch with builders.
          </p>
          <button
            onClick={() => router.push("/buyer/projects")}
            className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft"
          >
            Explore projects <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <BuyerDashboardShell title="My Inquiries">
      <InquiriesContent />
    </BuyerDashboardShell>
  );
}

export default function BuyerInquiriesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuyerDashboardShell title="My Inquiries"><div /></BuyerDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
