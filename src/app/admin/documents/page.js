"use client";

import { useState } from "react";
import { FileCheck2, Check, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { timeAgo, truncate } from "@/lib/format";

const KIND_OPTIONS = [
  { value: "land", label: "Land docs" },
  { value: "project", label: "Project docs" },
  { value: "application", label: "Application docs" },
  { value: "landowner_identity", label: "Landowner identity" },
];
const STATUS_OPTIONS = ["pending", "submitted", "uploaded", "under_review"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }));

function buildUrl(page, q, kind, status) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("search", q);
  if (kind && kind !== "all") p.set("role", kind);
  if (status && status !== "all") p.set("status", status);
  const qs = p.toString();
  return `/api/admin/documents${qs ? `?${qs}` : ""}`;
}

export default function AdminDocumentsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [url, setUrl] = useState("/api/admin/documents");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const [reviewItem, setReviewItem] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v, kind, status));
  };
  const onKind = (v) => {
    setKind(v);
    setPage(1);
    setUrl(buildUrl(1, q, v, status));
  };
  const onStatus = (v) => {
    setStatus(v);
    setPage(1);
    setUrl(buildUrl(1, q, kind, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q, kind, status));
  };

  async function submitReview(result) {
    if (!reviewItem) return;
    setBusy(true);
    setFlash(null);
    try {
      const params = new URLSearchParams({ kind: reviewItem.kind });
      const bodyPayload = { status: result, note };
      if (reviewItem.kind === "application") bodyPayload.docIndex = reviewItem.docIndex;
      const res = await fetch(`/api/admin/documents/${reviewItem.id}?${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
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
    <AdminShell title="Documents" subtitle="Review uploaded land, project and application documents">
      {flash && (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {flash.message}
        </div>
      )}

      <div className="space-y-4">
        <AdminFilters
          search={q}
          onSearch={onSearch}
          searchPlaceholder="Search document or owner…"
          statusValue={kind}
          onStatus={onKind}
          statusOptions={KIND_OPTIONS}
          roleValue={status}
          onRole={onStatus}
          roleOptions={STATUS_OPTIONS}
        />

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="No documents awaiting review." icon={<FileCheck2 className="h-6 w-6 text-muted" />} />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Document</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={`${item.kind}-${item.id}-${idx}`} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted">{truncate(item.label, 40)}</p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:text-accent-soft">
                          Open file
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{item.ownerName}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.kind.replace(/_/g, " ")} className="!bg-slate-100 !text-slate-700" /></td>
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
        <Modal open onClose={() => setReviewItem(null)} title={`Review document`} subtitle={`${reviewItem.title} — ${reviewItem.ownerName}`} size="md">
          <div className="space-y-4">
            {reviewItem.url && (
              <a href={reviewItem.url} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-accent bg-teal-50 px-4 py-2 text-sm font-semibold text-accent hover:bg-teal-100">
                Open document in new tab
              </a>
            )}
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Review note (required when rejecting)."
            />
            <div className="flex items-center justify-end gap-3">
              <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => submitReview("rejected")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button variant="primary" loading={busy} onClick={() => submitReview("verified")}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}