"use client";

const tones = {
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-teal-50 text-teal-700 border-teal-200",
  muted: "bg-slate-50 text-slate-600 border-slate-200",
  primary: "bg-slate-900 text-white border-slate-900",
  accent: "bg-teal-50 text-teal-800 border-teal-200",
};

export default function Badge({
  children,
  tone = "muted",
  className = "",
  icon,
}) {
  const hasDot = ["success", "warning", "danger"].includes(tone);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        tones[tone] || tones.muted
      } ${className}`}
    >
      {hasDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "success"
              ? "bg-green-500"
              : tone === "warning"
              ? "bg-amber-500"
              : "bg-red-500"
          }`}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
