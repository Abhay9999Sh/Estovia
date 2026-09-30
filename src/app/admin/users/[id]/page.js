"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, RotateCcw, UserX, ShieldCheck, Mail, AtSign, Phone } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card } from "@/components/admin/AdminStates";
import VerificationReviewModal from "@/components/admin/VerificationReviewModal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { formatDate, initials, truncate } from "@/lib/format";
import { VERIFIED_ROLES, roleLabel } from "@/lib/verification";

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error, refetch } = useAdminFetch(`/api/admin/users/${id}`);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  // Which role profile the review modal is open for.
  const [review, setReview] = useState(null);

  const user = data?.user;
  const profiles = data?.profiles || {};
  const verification = useMemo(() => data?.verificationByRole || [], [data]);

  const needsAttention = useMemo(
    () => verification.filter((r) => r.needsReview || r.awaitingUser).length,
    [verification]
  );

  async function runAction(action) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: note }),
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-foreground">Verification</h3>
                {needsAttention > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    {needsAttention} needing attention
                  </span>
                )}
              </div>

              {verification.length === 0 && (
                <p className="text-sm text-muted">No role profile to verify yet.</p>
              )}

              <div className="space-y-3">
                {verification.map((r) => (
                  <div key={r.role} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          {roleLabel(r.role)}
                        </h4>
                        <StatusBadge status={r.overall} />
                        {r.awaitingUser && (
                          <span className="text-[11px] font-medium text-amber-700">
                            waiting on user
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={r.needsReview ? "primary" : "outline"}
                        onClick={() => setReview({ userId: id, role: r.role })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {r.fields.map((f) => (
                        <div
                          key={f.field}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-foreground">
                              {f.label}
                            </span>
                            {f.note && (
                              <p className="text-[11px] text-muted">{f.note}</p>
                            )}
                            {f.reviewedAt && (
                              <p className="text-[11px] text-muted">
                                Reviewed {formatDate(f.reviewedAt)}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={f.status} />
                        </div>
                      ))}
                    </div>

                    {r.reviewNotes && (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Review notes: {r.reviewNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-bold text-foreground">Role profiles</h3>
              <div className="space-y-3">
                {VERIFIED_ROLES.map((roleName) => {
                  const p = profiles[roleName];
                  return (
                    <div key={roleName} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {roleLabel(roleName)}
                        </p>
                        {p ? (
                          <StatusBadge status={p.onboardingComplete ? "Completed" : "In Progress"} />
                        ) : (
                          <StatusBadge status="Not Created" />
                        )}
                      </div>
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
              <Button
                variant="outline"
                loading={busy}
                onClick={() => runAction("mark_profile_incomplete")}
              >
                <UserX className="h-4 w-4" /> Mark profile incomplete
              </Button>
            </div>
            <div className="mt-4">
              <Textarea
                rows={1}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (recorded in the audit trail and sent to the user)."
              />
              <p className="mt-1 text-xs text-muted">
                Verification itself is reviewed per field, from the cards above.
              </p>
            </div>
          </Card>
        </div>
      )}

      <VerificationReviewModal
        open={Boolean(review)}
        userId={review?.userId}
        role={review?.role}
        onClose={() => setReview(null)}
        onSaved={(res) => {
          setFlash({ tone: "success", message: res?.message || "Review saved." });
          refetch();
        }}
      />
    </AdminShell>
  );
}