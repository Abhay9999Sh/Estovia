"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, RotateCcw, UserX, ShieldCheck, Mail, AtSign, Phone } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card } from "@/components/admin/AdminStates";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { formatDate, initials, truncate } from "@/lib/format";

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminFetch(`/api/admin/users/${id}`);

  const [note, setNote] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const user = data?.user;
  const profiles = data?.profiles || {};

  async function runAction(action) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: note, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Action failed." });
      } else {
        setFlash({ tone: "success", message: json.message || "Done." });
        setNote("");
        refetch();
      }
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title={user ? user.name || user.username : "User"} subtitle={user?.email || "Account details"}>
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading && <AdminLoading rows={8} />}
      {error && <AdminError message={error} onRetry={refetch} />}

      {!loading && !error && user && (
        <div className="space-y-6">
          {flash && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              {flash.message}
            </div>
          )}

          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                  {initials(user.name)}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{user.name || user.username}</h2>
                    <StatusBadge
                      status={user.accountStatus || "active"}
                      className={
                        user.accountStatus === "suspended"
                          ? "!bg-red-50 !text-red-700"
                          : user.accountStatus === "deactivated"
                          ? "!bg-slate-100 !text-slate-600"
                          : "!bg-green-50 !text-green-700"
                      }
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><AtSign className="h-3.5 w-3.5" /> {user.username}</span>
                    <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {user.phone || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(user.roles) ? user.roles : [user.roles]).filter(Boolean).map((r) => (
                  <StatusBadge key={r} status={`${r}`} className="!bg-slate-100 !text-slate-700" />
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Joined {formatDate(user.createdAt)}</p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-bold text-foreground">Verification</h3>
              <div className="space-y-2">
                {Object.keys(user.verification || {}).length === 0 && <p className="text-sm text-muted">No verification data yet.</p>}
                {Object.entries(user.verification || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <span className="text-xs font-medium capitalize text-muted">{k.replace(/_/g, " ")}</span>
                    <StatusBadge status={v} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-foreground">Role profiles</h3>
              <div className="space-y-3">
                {["landowner", "builder", "supplier", "buyer"].map((roleName) => {
                  const p = profiles[roleName];
                  return (
                    <div key={roleName} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold capitalize text-foreground">{roleName}</p>
                        {p ? <StatusBadge status={p.onboardingComplete ? "Completed" : "In Progress"} /> : <StatusBadge status="Not Created" />}
                      </div>
                      {p && p.verification && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(p.verification).slice(0, 5).map(([k, v]) => (
                            <StatusBadge key={k} status={`${k}: ${v}`} className="!bg-secondary/60 !text-slate-600" />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {(data.listings || []).length > 0 && (
            <Card>
              <h3 className="mb-3 text-sm font-bold text-foreground">Listings ({data.listings.length})</h3>
              <div className="space-y-2">
                {data.listings.map((l) => (
                  <div key={String(l._id)} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">{l.title}</span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <StatusBadge status={l.verificationStatus} />
                      <StatusBadge status={l.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(data.reports || []).length > 0 && (
            <Card>
              <h3 className="mb-3 text-sm font-bold text-foreground">Reports raised ({data.reports.length})</h3>
              <div className="space-y-2">
                {data.reports.map((r) => (
                  <div key={String(r._id)} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted">{truncate(r.description, 70)}</span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-bold text-foreground">Take action</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="danger" loading={busy} onClick={() => runAction("suspend")}>
                <Ban className="h-4 w-4" /> Suspend
              </Button>
              <Button variant="secondary" loading={busy} onClick={() => runAction("reactivate")}>
                <RotateCcw className="h-4 w-4" /> Reactivate
              </Button>
              <Button variant="outline" loading={busy} onClick={() => runAction("deactivate")}>
                <UserX className="h-4 w-4" /> Deactivate
              </Button>
              <Button variant="primary" loading={busy} disabled={!role} onClick={() => runAction("verify_profile")}>
                <ShieldCheck className="h-4 w-4" /> Verify profile ({role || "choose role"})
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="">Profile to verify…</option>
                {["landowner", "builder", "supplier", "buyer"].map((r) => (
                  <option key={r} value={r}>
                    Verify {r} profile
                  </option>
                ))}
              </select>
              <Textarea
                rows={1}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (recorded in the audit trail and sent to the user)."
              />
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}