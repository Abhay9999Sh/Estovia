"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, CheckCircle2, Clock, EyeOff, XCircle, ArrowRight } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/demoData";

function docBadge(status) {
  if (status === "verified")
    return <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
  if (status === "rejected" || status === "not_found" || status === "mismatch" || status === "inactive")
    return <Badge tone="danger"><XCircle className="h-3 w-3" /> {status.replace("_", " ")}</Badge>;
  if (status === "manual_review")
    return <Badge tone="warning"><EyeOff className="h-3 w-3" /> Manual review</Badge>;
  return <Badge tone="info"><Clock className="h-3 w-3" /> Pending</Badge>;
}

function DocumentsContent() {
  const router = useRouter();
  const [verification, setVerification] = useState(null);
  const [rera, setRera] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/builder/verification", { cache: "no-store" });
      const data = await res.json();
      setVerification(data.verification || {});
      setRera(data.reraRegistrations || []);
    } catch (err) {
      setError("Unable to load verification status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const items = verification ? Object.keys(verification).map((k) => verification[k]) : [];

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Business Documents & Verification</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        A document being present never implies government verification. Status shown reflects
        what has been independently confirmed (or, absent a live source, queued for manual review).
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{item.label}</p>
                {docBadge(item.status)}
              </div>
              <p className="mt-2 text-xs text-muted">
                {item.status === "verified"
                  ? "Confirmed via an authorized source."
                  : "Not yet independently verified."}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">RERA Registrations</h3>
          <Button variant="outline" size="sm" onClick={() => router.push("/builder/rera")}>
            Manage <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {rera.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No RERA registrations added yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rera.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.projectName || r.registrationNumber}</p>
                  <p className="text-xs text-muted">{r.state} · {r.registrationNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  {docBadge(r.status)}
                  <span className="text-xs text-muted">{r.lastVerifiedAt ? formatDate(r.lastVerifiedAt) : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => router.push("/builder/profile")}>
          <FileCheck2 className="h-4 w-4" /> Edit Company Details
        </Button>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Documents">
        <DocumentsContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
