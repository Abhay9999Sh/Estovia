"use client";

import { useState } from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty, Card } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";

const ROLE_OPTIONS = ["landowner", "builder", "supplier", "buyer"].map((r) => ({ value: r, label: r }));
const STATUS_OPTIONS = ["submitted", "under_review", "manual_review"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }));

function buildUrl(page, q, role, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (role && role !== "all") p.set("role", role);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/verification${qs ? `?${qs}` : ""}`;
}

export default function AdminVerificationPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/verification");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const [reviewItem, setReviewItem] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, role, status));
  };
  const onRole = (v) => {
    setRole(v);
    setPage(1);
    setUrl(buildUrl(1, q, v, status));
  };
  const onStatus = (v) => {
    setStatus(v);
    setPage(1);
    setUrl(buildUrl(1, q, role, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, role, status));
  };

  async function submitReview(result) {
    if (!reviewItem) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(
        `/api/admin/verification/${reviewItem.userId}?role=${reviewItem.role}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: reviewItem.field, status: result, note }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Failed." });
      } else {
        setFlash({ tone: "success", message: json.message || "Updated." });
        setReviewItem(null);
        setNote("");
        refetch();
      }
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Verification" subtitle="Profile identity, PAN, GST and business checks">
      {flash && (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {flash.message}
        </div>
      )}

      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search user name, email…"
          roleValue={role}
          onRole={onRole}
          roleOptions={ROLE_OPTIONS}
          statusValue={status}
          onStatus={onStatus}
          statusOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="Nothing to review right now." icon={<ShieldCheck className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={`${item.role}-${item.userId}-${item.field}`} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted">{item.email}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.role} className="!bg-slate-100 !text-slate-700" /></td>
                    <td className="px-4 py-3 capitalize">{item.field.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{timeAgo(item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => { setReviewItem(item); setNote(""); }}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination page={page} pageCount={pageCount} total={total} onPage={onPage} />
      </div>

      {reviewItem && (
        <Modal open onClose={() => setReviewItem(null)} title={`Review ${reviewItem.field.replace(/_/g, " ")}`} subtitle={`${reviewItem.name} • ${reviewItem.role}`} size="md">
          <div className="space-y-4">
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes for this decision (required when rejecting)."
            />
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" loading={busy} onClick={() => submitReview("under_review")}>
                Mark under review
              </Button>
              <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => submitReview("rejected")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button variant="primary" loading={busy} onClick={() => submitReview("verified")}>
                <Check className="h-4 w-4" /> Verify
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}