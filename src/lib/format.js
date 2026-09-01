export function formatINR(num, opts = {}) {
  const value = Number(num);
  if (Number.isNaN(value)) return "₹0";
  const formatted = value.toLocaleString("en-IN", {
    maximumFractionDigits: opts.maxFraction ?? 0,
  });
  return opts.noSymbol ? formatted : `₹${formatted}`;
}

export function formatDate(input, opts = {}) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function timeAgo(input) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

const TONE_MAP = {
  success: ["verified", "active", "approved", "approved ", "completed", "accepted", "available", "ordered", "open", "sold", "registered", "allotted", "fulfilled", "delivered", "on hold"],
  danger: ["rejected", "rejected ", "cancelled", "closed", "expired", "withdrawn", "noshow", "blocked", "suspended", "deactivated", "disputed", "problem", "manual review", "resolved?"],
  warning: ["pending", "paused", "submitted", "under_review", "under review", "under maintenance", "on hold ", "in transit", "partial", "partially delivered", "initiated", "waiting_for_information"],
  info: ["booked", "reserved", "negotiation", "responses received", "shortlisted", "quotation selected", "in production", "under verification", "draft", "rfi", "waiting", "sent"],
};

export function statusTone(status) {
  const s = String(status || "").toLowerCase().trim();
  for (const [tone, words] of Object.entries(TONE_MAP)) {
    if (words.includes(s) || words.some((w) => s.startsWith(w))) return tone;
  }
  return "muted";
}

export function initials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function truncate(str, len = 80) {
  if (!str) return "";
  return str.length > len ? `${str.slice(0, len)}…` : str;
}