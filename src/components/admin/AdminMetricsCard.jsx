"use client";

export default function AdminMetricsCard({ label, value, hint, icon: Icon, tone = "accent" }) {
  const tones = {
    accent: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-50 text-green-700",
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{value ?? "—"}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
        </div>
        {Icon && (
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${tones[tone] || tones.accent}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}