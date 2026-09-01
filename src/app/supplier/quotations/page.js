"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

const toneMap = {
  Submitted: "info",
  Received: "info",
  "Under Review": "warning",
  Negotiation: "warning",
  Accepted: "success",
  Declined: "danger",
  Withdrawn: "muted",
  Expired: "muted",
  Pending: "muted",
};

function QuotationsList() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/supplier/quotations", { cache: "no-store" });
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
  }, [status]);

  if (loading || !data) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <>
        {(data.quotations || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No quotations yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Browse open requirements and submit a quotation to get started.
            </p>
            <Link
              href="/supplier/requirements"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Find Opportunities
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {data.quotations.map((q) => (
              <Link
                key={q._id}
                href={`/supplier/quotations/${q._id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-white p-5 transition-colors hover:border-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {q.requirementId?.title || "Quotation"}
                    </p>
                    <Badge tone={toneMap[q.status] || "muted"}>{q.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {q.requirementId?.projectId?.name || "Project"} · {formatDate(q.createdAt)}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="font-extrabold text-foreground">{formatINR(q.totalAmount)}</span>
                  <ArrowRight className="h-5 w-5 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
    </>
  );
}

export default function SupplierQuotationsPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="My Quotations">
        <QuotationsList />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
