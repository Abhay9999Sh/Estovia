"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ArrowRight, Search } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function RequirementsList() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/supplier/requirements?q=${encodeURIComponent(debounced)}`,
          { cache: "no-store" }
        );
        const d = await res.json();
        if (active) {
          setData(d);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, debounced]);

  if (loading || !data) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <>
        <div className="mb-5 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search requirements..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {!data.profile ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">Complete your profile first</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Set up your supplier profile to start quoting on requirements.
            </p>
            <Link
              href="/supplier/onboarding"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Complete Onboarding
            </Link>
          </div>
        ) : (data.requirements || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No open requirements</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Public requirements that match your profile will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {data.requirements.map((r) => {
              const quoteStatus = data.quotedMap?.[r._id];
              return (
                <Link
                  key={r._id}
                  href={`/supplier/requirements/${r._id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-white p-5 transition-colors hover:border-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{r.title}</p>
                      <Badge tone="info">{r.category || "General"}</Badge>
                      {r.visibility === "private" && <Badge tone="warning">Invited</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {r.projectId?.name || "Project"} · {r.projectId?.location?.city || "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Required by {formatDate(r.requiredBy)} · {r.lineItems?.length || 0} line items
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    {quoteStatus && <Badge tone={quoteStatus === "Submitted" ? "success" : "muted"}>{quoteStatus}</Badge>}
                    <ArrowRight className="h-5 w-5 text-muted" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </>
  );
}

export default function SupplierRequirementsPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Find Opportunities">
        <RequirementsList />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
