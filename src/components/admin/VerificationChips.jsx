import StatusBadge from "./StatusBadge";
import { FIELD_LABELS, fieldAttentionRank } from "@/lib/verification";

/**
 * Statuses worth drawing an admin's eye: the user is waiting on a decision, or
 * something is wrong. `rejected` is included even though it is not a
 * "reviewable" status, because a rejected field is the most urgent thing on
 * the row.
 */
const ATTENTION = ["rejected", "needs_information", "under_review", "submitted"];

/**
 * Compact per-field verification summary.
 *
 * Leads with whatever needs attention rather than with what is already
 * verified, and surfaces the recorded reason for a rejected or
 * needs-information field inline, because "RERA document rejected" on its own
 * does not tell an admin or a user what to fix.
 *
 * @param fields   status map, e.g. `{ pan: "verified", gst: "rejected" }`
 * @param meta     optional `verificationMeta` map for reasons/timestamps
 * @param override optional status overrides, e.g. a builder's RERA status
 * @param exclude  field names to leave out
 * @param only     when given, restrict to these field names, in this order
 * @param onSelect optional click handler, called with the field name
 */
export default function VerificationChips({
  fields,
  meta,
  exclude = [],
  override = {},
  only,
  onSelect,
}) {
  const source = fields || {};

  // `override` can add a field that is not part of the profile verification
  // block - a builder's RERA state, for example - so its keys belong in the
  // set to render, not just as replacements for existing statuses.
  const keys = only || [...new Set([...Object.keys(source), ...Object.keys(override)])];

  const entries = keys
    .filter((key) => !exclude.includes(key))
    .map((key) => [key, override[key] || source[key] || "pending"])
    // Worst first, so the field needing attention is never scrolled off.
    .sort((a, b) => fieldAttentionRank(a[1]) - fieldAttentionRank(b[1]));

  if (!entries.length) return <span className="text-xs text-muted">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => {
        const note = meta?.[key]?.note;
        const showNote = note && (value === "rejected" || value === "needs_information");
        const label = FIELD_LABELS[key] || key.replace(/_/g, " ");
        const attention = ATTENTION.includes(value);

        const chip = (
          <span
            className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium ${
              attention
                ? value === "rejected"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50"
            }`}
            title={showNote ? `${label}: ${value} — ${note}` : `${label}: ${value}`}
          >
            <span className="text-slate-600">{label}</span>
            <StatusBadge status={value} />
            {showNote && (
              <span className="truncate text-red-700" aria-label="Reason">
                — {note}
              </span>
            )}
          </span>
        );

        if (!onSelect) return <span key={key}>{chip}</span>;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="max-w-full text-left"
            title={`Review ${label}`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
