"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, Clock, EyeOff, AlertTriangle, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";

function statusRow(status) {
  if (status === "verified")
    return { tone: "success", icon: CheckCircle2, text: "Independently verified via an authorized source." };
  if (status === "manual_review")
    return { tone: "warning", icon: EyeOff, text: "Queued for manual review by our team." };
  if (status === "rejected" || status === "mismatch" || status === "not_found" || status === "inactive")
    return { tone: "danger", icon: AlertTriangle, text: "Could not be confirmed. Please re-submit." };
  return { tone: "info", icon: Clock, text: "Submitted. Verification pending." };
}

function VerificationContent() {
  const router = useRouter();
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/builder/verification", { cache: "no-store" });
      const data = await res.json();
      setVerification(data.verification || {});
    } catch (err) {
      // ignore; empty state shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Verification Status</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Estovia does not fake government verification. Every item below shows its true,
        current verification state.
      </p>

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : verification && Object.keys(verification).length ? (
        <div className="mt-6 space-y-3">
          {Object.keys(verification).map((k) => {
            const item = verification[k];
            const cfg = statusRow(item.status);
            const Icon = cfg.icon;
            return (
              <div key={k} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold capitalize text-foreground">
                    {item.label || k.replace("_", " ")}
                  </p>
                  <Badge tone={cfg.tone}>{item.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <Icon className="h-4 w-4" /> {cfg.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No verification data</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Complete onboarding so we can track your verification status.
          </p>
          <Button className="mt-5" onClick={() => router.push("/builder/onboarding")}>
            Complete Onboarding <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Verification">
        <VerificationContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
