"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Eye,
  HelpCircle,
  XCircle,
  FileText,
  ExternalLink,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import StatusBadge from "./StatusBadge";
import { AdminLoading, AdminError } from "./AdminStates";
import { useAdminFetch } from "./useAdminFetch";
import { formatDate, timeAgo } from "@/lib/format";
import { REASON_REQUIRED_STATUSES, displayStatus, roleLabel } from "@/lib/verification";

/**
 * The action set, in the order an admin should read them. `pending` is absent
 * by design: only the user can reset a field, by re-submitting.
 */
const ACTIONS = [
  { status: "verified", label: "Verify", icon: ShieldCheck, variant: "primary" },
  { status: "under_review", label: "Under review", icon: Eye, variant: "outline" },
  { status: "needs_information", label: "Need info", icon: HelpCircle, variant: "gold" },
  { status: "rejected", label: "Reject", icon: XCircle, variant: "danger" },
];

/** One field's review row: evidence, the last decision, and the controls. */
function FieldReview({ field, decision, dirty, onStatus, onNote, onReset, disabled }) {
  const needsReason = REASON_REQUIRED_STATUSES.includes(decision.status);

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        dirty ? "border-accent bg-accent-light/40" : "border-border bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">{field.label}</h4>
            <StatusBadge status={field.status} />
            {dirty && (
              <span className="text-[11px] font-semibold text-accent">
                → {displayStatus(decision.status)}
              </span>
            )}
          </div>

          {/* Why this field is in the queue, so it can be triaged without
              opening the evidence. */}
          {(field.submittedAt || field.reviewedAt || field.note) && (
            <p className="mt-1 text-xs text-muted">
              {field.submittedAt && <>Submitted {timeAgo(field.submittedAt)} · </>}
              {field.reviewedAt && (
                <>
                  last reviewed {timeAgo(field.reviewedAt)}
                  {field.reviewedByName ? ` by ${field.reviewedByName}` : ""} ·{" "}
                </>
              )}
              {field.note ? `reason: ${field.note}` : "no reason recorded"}
            </p>
          )}
        </div>
      </div>

      {field.evidence?.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-xl bg-secondary/50 px-3 py-2.5 sm:grid-cols-2">
          {field.evidence.map((item, i) => (
            <div key={`${field.field}-${i}`} className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-xs font-medium text-muted">{item.label}</dt>
              <dd className="min-w-0 truncate text-right text-xs font-semibold text-foreground">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:text-accent-soft hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    {item.value}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map(({ status, label, icon: Icon, variant }) => (
          <Button
            key={status}
            size="sm"
            variant={decision.status === status ? variant : "ghost"}
            disabled={disabled}
            onClick={() => onStatus(status)}
            aria-pressed={decision.status === status}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
        {dirty && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {needsReason && (
        <div className="mt-3">
          <Textarea
            rows={2}
            value={decision.note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={
              decision.status === "rejected"
                ? "Required. What is wrong with this, and how can it be fixed?"
                : "Required. What exactly do you need from the user?"
            }
          />
          <p className="mt-1 text-[11px] text-muted">
            This reason is sent to the user in their notification.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Review one user's verification for one role.
 *
 * All changed fields go out as a single bulk PATCH, so reviewing four documents
 * is one request with one audit entry and one notification per field, rather
 * than four round trips an admin has to watch.
 *
 * Local edits are held in an `overrides` map rather than a full copy of the
 * packet, so "submit" only ever sends genuine changes and there is no need to
 * re-seed state when the packet reloads.
 *
 * @param userId   User id; the API resolves that user's profile for the role.
 * @param role     landowner | builder | supplier | buyer
 * @param open     controlled visibility
 * @param onClose  called after a successful save, or on dismiss
 * @param onSaved  called with the API response after a successful save
 */
export default function VerificationReviewModal({ userId, role, open, onClose, onSaved }) {
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);

  // Empty url keeps the hook idle while the modal is closed.
  const url = open && userId && role ? `/api/admin/verification/${userId}?role=${role}` : "";
  const { data: packet, loading, error } = useAdminFetch(url);

  const fields = useMemo(() => packet?.fields || [], [packet]);

  // The decision shown for a field: the pending edit if there is one,
  // otherwise the stored value.
  const decisionFor = (field) => {
    const o = overrides[field.field];
    if (o) return { status: o.status, note: o.note ?? field.note ?? "" };
    return { status: field.status, note: field.note || "" };
  };

  const changed = useMemo(
    () =>
      fields
        .map((f) => {
          const d = decisionFor(f);
          return d.status !== f.status || d.note !== (f.note || "") ? { field: f.field, ...d } : null;
        })
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, overrides]
  );

  // A rejection or info request without a reason is rejected server-side, so
  // block it here rather than round-tripping for a 400.
  const missingReason = changed.filter(
    (c) => REASON_REQUIRED_STATUSES.includes(c.status) && !(c.note || "").trim()
  );

  function setStatus(field, status) {
    setOverrides((prev) => {
      const current = decisionFor(field);
      const next = { ...current, status };
      // Switching away from a reason-bearing status keeps the text so an admin
      // can flip back without retyping.
      if (current.status === field.status && !next.note) next.note = field.note || "";
      return { ...prev, [field.field]: next };
    });
  }

  function setNote(field, note) {
    setOverrides((prev) => {
      const current = decisionFor(field);
      return { ...prev, [field.field]: { ...current, note } };
    });
  }

  function resetField(field) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[field.field];
      return next;
    });
  }

  async function save() {
    if (!changed.length || !userId || !role) return;
    setSaving(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/verification/${userId}?role=${role}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, items: changed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Failed to save." });
        return;
      }
      setOverrides({});
      onSaved?.(json.data || json);
      onClose?.();
    } catch {
      setFlash({ tone: "danger", message: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  // Editing a different user must not carry the previous user's pending edits.
  function handleClose() {
    setOverrides({});
    setFlash(null);
    onClose?.();
  }

  const title = packet?.identity?.name || "Review verification";

  return (
    <Modal open={open} onClose={handleClose} size="lg" title={title}>
      {loading && <AdminLoading rows={5} />}
      {error && <AdminError message={error} onRetry={handleClose} />}

      {!loading && !error && packet && (
        <div className="space-y-5">
          {flash && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {flash.message}
            </div>
          )}

          {/* Who is being reviewed, and under which role. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {packet.identity?.name || packet.identity?.username}
                <span className="ml-2 font-normal text-muted">({roleLabel(role)})</span>
              </p>
              <p className="truncate text-xs text-muted">
                {packet.identity?.email}
                {packet.identity?.phone ? ` · ${packet.identity.phone}` : ""}
                {packet.identity?.joinedAt ? ` · joined ${formatDate(packet.identity.joinedAt)}` : ""}
              </p>
              {packet.identity?.organisation && (
                <p className="truncate text-xs text-muted">{packet.identity.organisation}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={packet.overall} />
              {packet.identity?.accountStatus && (
                <StatusBadge status={packet.identity.accountStatus} />
              )}
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((f) => (
              <FieldReview
                key={f.field}
                field={f}
                decision={decisionFor(f)}
                dirty={changed.some((c) => c.field === f.field)}
                onStatus={(s) => setStatus(f, s)}
                onNote={(n) => setNote(f, n)}
                onReset={() => resetField(f)}
                disabled={saving}
              />
            ))}
          </div>

          {missingReason.length > 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              A reason is required to mark{" "}
              {missingReason.map((c) => c.field.replace(/_/g, " ")).join(", ")} as rejected or
              needing more information.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted">
              {changed.length
                ? `${changed.length} field${changed.length === 1 ? "" : "s"} will be updated.`
                : "No changes yet."}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={!changed.length || missingReason.length > 0}
                onClick={save}
              >
                <UserCheck className="h-4 w-4" />
                Save{changed.length ? ` ${changed.length} decision${changed.length === 1 ? "" : "s"}` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
