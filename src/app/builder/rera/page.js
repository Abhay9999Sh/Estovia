"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  RefreshCw,
  EyeOff,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/demoData";

function statusBadge(s) {
  switch (s) {
    case "verified":
      return <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
    case "not_found":
    case "inactive":
    case "mismatch":
      return <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> {s.replace("_", " ")}</Badge>;
    case "manual_review":
      return <Badge tone="warning"><EyeOff className="h-3 w-3" /> Manual review</Badge>;
    default:
      return <Badge tone="info"><Clock className="h-3 w-3" /> Pending</Badge>;
  }
}

function ReraContent() {
  const [registrations, setRegistrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ state: "", registrationNumber: "", promoterName: "", projectName: "", projectAddress: "", registrationDate: "", completionDate: "" });
  const [busy, setBusy] = useState(false);
  const [reverifyId, setReverifyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/builder/rera", { cache: "no-store" });
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (err) {
      setError("Unable to load RERA registrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addRegistration() {
    if (!form.state.trim() || !form.registrationNumber.trim()) {
      setError("Please provide state and registration number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/builder/rera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to add registration.");
      setAddOpen(false);
      setForm({ state: "", registrationNumber: "", promoterName: "", projectName: "", projectAddress: "", registrationDate: "", completionDate: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to add registration.");
    } finally {
      setBusy(false);
    }
  }

  async function reverify(id) {
    setReverifyId(id);
    setError("");
    try {
      const res = await fetch(`/api/builder/rera/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to re-verify.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to re-verify.");
    } finally {
      setReverifyId(null);
    }
  }

  async function remove(id) {
    setError("");
    try {
      const res = await fetch(`/api/builder/rera/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to remove.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to remove.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">RERA & Verification</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            We never claim government verification without an authorized source. If we
            cannot independently verify a registration, it stays pending or in manual review.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <ShieldCheck className="h-4 w-4" /> Add Registration
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-28" />)
        ) : registrations && registrations.length > 0 ? (
          registrations.map((r) => (
            <div key={r._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-foreground">{r.projectName || r.registrationNumber}</p>
                    {statusBadge(r.status)}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {r.state} · {r.registrationNumber}
                  </p>
                  {r.promoterName && <p className="text-sm text-muted">Promoter: {r.promoterName}</p>}
                  {r.registrationDate && (
                    <p className="text-sm text-muted">Registered: {formatDate(r.registrationDate)}</p>
                  )}
                  {r.lastVerifiedAt && (
                    <p className="text-xs text-muted">Last checked: {formatDate(r.lastVerifiedAt)}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => reverify(r._id)} disabled={reverifyId === r._id}>
                    {reverifyId === r._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Re-check
                  </Button>
                  <button
                    onClick={() => remove(r._id)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No RERA registrations</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add your RERA registration to begin the verification process.
            </p>
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add RERA Registration">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="State *" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="e.g. Maharashtra" />
            <Input label="Registration Number *" value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} placeholder="e.g. P52100041234" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Promoter Name" value={form.promoterName} onChange={(e) => setForm((f) => ({ ...f, promoterName: e.target.value }))} />
            <Input label="Project Name" value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} />
          </div>
          <Input label="Project Address" value={form.projectAddress} onChange={(e) => setForm((f) => ({ ...f, projectAddress: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Registration Date" type="date" value={form.registrationDate} onChange={(e) => setForm((f) => ({ ...f, registrationDate: e.target.value }))} />
            <Input label="Completion Date" type="date" value={form.completionDate} onChange={(e) => setForm((f) => ({ ...f, completionDate: e.target.value }))} />
          </div>
          <p className="rounded-xl border border-accent-light bg-accent-light/30 px-4 py-3 text-sm text-muted">
            On submission, we attempt verification. Without a live RERA API, the status
            will be <span className="font-medium">pending</span> or{" "}
            <span className="font-medium">manual review</span> — never falsely verified.
          </p>
          <Button fullWidth onClick={addRegistration} loading={busy}>
            <ShieldCheck className="h-4 w-4" /> Submit for Review
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ReraPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="RERA & Verification">
        <ReraContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
