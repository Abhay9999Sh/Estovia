"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Check,
  X,
  HelpCircle,
  Eye,
  Paperclip,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty, Card } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import VerificationReviewModal from "@/components/admin/VerificationReviewModal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { timeAgo } from "@/lib/format";
import {
  REVIEWABLE_STATUSES,
  VERIFIED_ROLES,
  VERIFICATION_STATUSES,
  FIELD_LABELS,
  displayStatus,
  roleLabel,
} from "@/lib/verification";

const STATUS_OPTIONS = [...REVIEWABLE_STATUSES, ...VERIFICATION_STATUSES]
  .filter((v, i, a) => a.indexOf(v) === i)
  .map((s) => ({ value: s, label: displayStatus(s) }));

const ROLE_OPTIONS = VERIFIED_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

const SORT_OPTIONS = [
  { value: "newest", label: "Newest activity" },
  { value: "oldest", label: "Oldest activity" },
  { value: "status", label: "Urgency" },
  { value: "role", label: "Role" },
  { value: "name", label: "Name" },
];

const ACCOUNT_OPTIONS = ["active", "suspended", "blocked", "deactivated"].map((s) => ({
  value: s,
  label: displayStatus(s),
}));

/** The API caps one review request at 12 fields. */
const MAX_PER_REQUEST = 12;

function buildUrl(f) {
  const p = new URLSearchParams();
  if (f.page > 1) p.set("page", f.page);
  if (f.q) p.set("search", f.q);
  if (f.role !== "all") p.set("role", f.role);
  if (f.status !== "all") p.set("status", f.status);
  if (f.field !== "all") p.set("field", f.field);
  if (f.accountStatus !== "all") p.set("accountStatus", f.accountStatus);
  if (f.withEvidence) p.set("withEvidence", "true");
  if (f.sort !== "newest") p.set("sort", f.sort);
  const qs = p.toString();
  return `/api/admin/verification${qs ? `?${qs}` : ""}`;
}

const INITIAL = {
  page: 1,
  q: "",
  role: "all",
  status: "all",
  field: "all",
  accountStatus: "all",
  withEvidence: false,
  sort: "newest",
};

export default function AdminVerificationPage() {
  const [filters, setFilters] = useState(INITIAL);
  const [url, setUrl] = useState(buildUrl(INITIAL));
  const { data, loading, error, refetch } = useAdminFetch(url);

  // Row -> review modal (all fields of that user + role at once).
  const [review, setReview] = useState(null);
  // Bulk selection of individual queue rows.
  const [selected, setSelected] = useState({});
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const items = data?.items || [];
  const counts = data?.counts || { total: 0, byRole: {}, byStatus: {} };
  const pageCount = data?.pageCount || 1;
  const fieldsByRole = useMemo(() => data?.options?.fieldsByRole || {}, [data]);

  // A field filter is only meaningful for the selected role; with "all roles"
  // the options are the union of every role's fields.
  const fieldOptions = useMemo(() => {
    const roles = filters.role === "all" ? VERIFIED_ROLES : [filters.role];
    const names = [...new Set(roles.flatMap((r) => fieldsByRole[r] || []))];
    return names.map((f) => ({ value: f, label: FIELD_LABELS[f] || f }));
  }, [filters.role, fieldsByRole]);

  const fieldAllowed = (field, role) => {
    if (field === "all") return true;
    const roles = role === "all" ? VERIFIED_ROLES : [role];
    return roles.some((r) => (fieldsByRole[r] || []).includes(field));
  };

  /**
   * Apply a filter change. The URL is rebuilt here rather than in an effect, so
   * a filter change and its request are one state transition.
   *
   * A field filter is dropped when the newly selected role has no such field —
   * e.g. switching to "buyer" while "rera" is selected — because the server
   * would return an empty queue for a combination that cannot exist.
   */
  function apply(patch) {
    const next = { ...filters, page: 1, ...patch };
    if (!fieldAllowed(next.field, next.role)) next.field = "all";
    setFilters(next);
    setUrl(buildUrl(next));
  }

  function goPage(page) {
    const next = { ...filters, page };
    setFilters(next);
    setUrl(buildUrl(next));
  }

  const selectedRows = items.filter((i) => selected[`${i.role}-${i.userId}-${i.field}`]);
  const allSelected = items.length > 0 && selectedRows.length === items.length;

  function toggleRow(item) {
    const key = `${item.role}-${item.userId}-${item.field}`;
    setSelected((s) => {
      const next = { ...s };
      if (next[key]) delete next[key];
      else next[key] = item;
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => {
      if (selectedRows.length === items.length) return {};
      const next = {};
      for (const i of items) next[`${i.role}-${i.userId}-${i.field}`] = i;
      return next;
    });
  }

  /**
   * Apply one decision to every selected row.
   *
   * Rows are grouped by user + role first, so a user who submitted two fields
   * is updated in a single request with both items, and requests are chunked to
   * the server's per-request cap. A failure part-way through is reported with
   * the rows that did not save, rather than silently dropping them.
   */
  async function runBulk() {
    if (!bulkStatus || !selectedRows.length) return;
    if (["rejected", "needs_information"].includes(bulkStatus) && !bulkNote.trim()) {
      setFlash({ tone: "danger", message: "A reason is required for this action." });
      return;
    }

    setBulkBusy(true);
    setFlash(null);
    const groups = new Map();
    for (const row of selectedRows) {
      const key = `${row.userId}|${row.role}`;
      if (!groups.has(key)) groups.set(key, { userId: row.userId, role: row.role, items: [] });
      groups.get(key).items.push({ field: row.field, status: bulkStatus, note: bulkNote.trim() });
    }

    const batches = [];
    for (const g of groups.values()) {
      for (let i = 0; i < g.items.length; i += MAX_PER_REQUEST) {
        batches.push({ ...g, items: g.items.slice(i, i + MAX_PER_REQUEST) });
      }
    }

    const failed = [];
    let saved = 0;
    for (const batch of batches) {
      try {
        const res = await fetch(`/api/admin/verification/${batch.userId}?role=${batch.role}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: batch.role, items: batch.items }),
        });
        const json = await res.json();
        if (!res.ok) {
          failed.push(...batch.items.map((it) => it.field));
        } else {
          saved += batch.items.length;
        }
        if (!res.ok) {
          setFlash({ tone: "danger", message: json.error || json.message || "Failed." });
        }
      } catch {
        failed.push(...batch.items.map((it) => it.field));
      }
    }

    setBulkBusy(false);
    if (!failed.length) {
      setSelected({});
      setBulkStatus("");
      setBulkNote("");
      setBulkOpen(false);
      setFlash({
        tone: "success",
        message: `${saved} field${saved === 1 ? "" : "s"} marked ${displayStatus(bulkStatus)}.`,
      });
    } else {
      setFlash({
        tone: "danger",
        message: `Saved ${saved}, but these failed: ${failed.join(", ")}.`,
      });
    }
    refetch();
  }

  return (
    <AdminShell
      title="Verification"
      subtitle="Identity, PAN, GST and business document reviews"
    >
      {flash && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            flash.tone === "danger"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {flash.message}
        </div>
      )}

      <div className="space-y-4">
        {/* Queue summary, straight from the same aggregate that produced the
            rows, so the numbers cannot disagree with the table. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Awaiting review
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{counts.total || 0}</p>
          </Card>
          {REVIEWABLE_STATUSES.map((s) => (
            <Card key={s} className="!p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {displayStatus(s)}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {counts.byStatus?.[s] || 0}
              </p>
            </Card>
          ))}
        </div>

        <Card className="!p-4">
          <AdminFilters
            search={filters.q}
            onSearch={(v) => apply({ q: v })}
            searchPlaceholder="Search name, email, PAN, GST…"
            roleValue={filters.role}
            onRole={(v) => apply({ role: v })}
            roleOptions={ROLE_OPTIONS}
            statusValue={filters.status}
            onStatus={(v) => apply({ status: v })}
            statusOptions={STATUS_OPTIONS}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filters.field}
                  onChange={(e) => apply({ field: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="all">All fields</option>
                  {fieldOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.accountStatus}
                  onChange={(e) => apply({ accountStatus: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="all">Any account</option>
                  {ACCOUNT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.sort}
                  onChange={(e) => apply({ sort: e.target.value })}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      Sort: {o.label}
                    </option>
                  ))}
                </select>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={filters.withEvidence}
                    onChange={(e) => apply({ withEvidence: e.target.checked })}
                    className="h-4 w-4 accent-[#0f766e]"
                  />
                  Evidence only
                </label>
              </div>
            }
          />
        </Card>

        {/* Bulk bar, shown only when at least one row is selected. */}
        {selectedRows.length > 0 && !bulkOpen && (
          <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent bg-accent-light px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {selectedRows.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
                Clear
              </Button>
              <Button size="sm" variant="primary" onClick={() => setBulkOpen(true)}>
                Review selected
              </Button>
            </div>
          </div>
        )}

        {bulkOpen && selectedRows.length > 0 && (
          <Card className="!border-accent !p-4">
            <p className="text-sm font-bold text-foreground">
              Apply one decision to {selectedRows.length} field
              {selectedRows.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs text-muted">
              {selectedRows.map((r) => (
                <li key={`${r.role}-${r.userId}-${r.field}`}>
                  {r.name} · {roleLabel(r.role)} · {FIELD_LABELS[r.field] || r.field}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { status: "verified", label: "Verify", icon: Check, variant: "primary" },
                { status: "under_review", label: "Under review", icon: Eye, variant: "outline" },
                {
                  status: "needs_information",
                  label: "Need info",
                  icon: HelpCircle,
                  variant: "gold",
                },
                { status: "rejected", label: "Reject", icon: X, variant: "danger" },
              ].map(({ status, label, icon: Icon, variant }) => (
                <Button
                  key={status}
                  size="sm"
                  variant={bulkStatus === status ? variant : "ghost"}
                  onClick={() => setBulkStatus(status)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
            {["rejected", "needs_information"].includes(bulkStatus) && (
              <div className="mt-3">
                <Textarea
                  rows={2}
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  placeholder="Required. This reason is sent to every affected user."
                />
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={bulkBusy}
                disabled={
                  !bulkStatus ||
                  (["rejected", "needs_information"].includes(bulkStatus) && !bulkNote.trim())
                }
                onClick={runBulk}
              >
                Apply to {selectedRows.length}
              </Button>
            </div>
          </Card>
        )}

        {loading && <AdminLoading rows={8} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty
            message="Nothing to review right now."
            icon={<ShieldCheck className="h-6 w-6 text-muted" />}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                      className="h-4 w-4 accent-[#0f766e]"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const key = `${item.role}-${item.userId}-${item.field}`;
                  return (
                    <tr
                      key={key}
                      className={`transition-colors hover:bg-secondary/40 ${
                        selected[key] ? "bg-accent-light/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[key])}
                          onChange={() => toggleRow(item)}
                          aria-label={`Select ${item.name} ${item.label}`}
                          className="h-4 w-4 accent-[#0f766e]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted">{item.email}</p>
                        {item.accountStatus !== "active" && (
                          <StatusBadge status={item.accountStatus} className="mt-1" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.role} className="!bg-slate-100 !text-slate-700" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {item.label || FIELD_LABELS[item.field] || item.field}
                        </span>
                        {item.hasEvidence && (
                          <Paperclip
                            className="ml-1.5 inline h-3.5 w-3.5 text-muted"
                            aria-label="Has evidence"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-xs text-muted">
                        <span className="line-clamp-2">{item.note || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {item.submittedAt && (
                          <p>Submitted {timeAgo(item.submittedAt)}</p>
                        )}
                        <p>Updated {timeAgo(item.updatedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReview({ userId: item.userId, role: item.role, name: item.name })
                          }
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <AdminPagination
            page={filters.page}
            pageCount={pageCount}
            total={data?.total || 0}
            onPage={goPage}
          />
        )}
      </div>

      <VerificationReviewModal
        open={Boolean(review)}
        userId={review?.userId}
        role={review?.role}
        onClose={() => setReview(null)}
        onSaved={(res) => {
          setFlash({ tone: "success", message: res?.message || "Review saved." });
          setSelected({});
          refetch();
        }}
      />
    </AdminShell>
  );
}
