"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";

function toneFor(status) {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "submitted") return "info";
  return "warning";
}

function VerificationPanel() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/supplier/verification", { cache: "no-store" });
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

  const list = data?.verification ? Object.values(data.verification) : [];

  return (
    <>
        <div className="rounded-2xl border border-accent-light bg-accent-light/30 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h4 className="text-sm font-bold text-foreground">Honest verification status</h4>
          </div>
          <p className="mt-2 text-sm text-muted">
            Registration numbers you provide are queued for verification against
            authorized sources. Nothing is marked verified without confirmation.
            Your profile completion and document submissions are reflected here.
          </p>
        </div>

        {loading || !data ? (
          <div className="mt-6 grid gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
            {list.map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0">
                <div>
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted">
                    {item.status === "verified"
                      ? "Verified through an authorized source."
                      : item.status === "submitted"
                      ? "Details submitted, pending verification."
                      : item.status === "rejected"
                      ? "Submission was not accepted."
                      : "Not yet submitted."}
                  </p>
                </div>
                <Badge tone={toneFor(item.status)}>{item.status}</Badge>
              </div>
            ))}
          </div>
        )}
    </>
  );
}

export default function SupplierVerificationPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Verification">
        <VerificationPanel />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
