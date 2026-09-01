import { AlertTriangle } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

export function AdminLoading({ rows = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function AdminEmpty({ message = "No records found.", icon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white px-4 py-12 text-center">
      {icon}
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function AdminError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-4 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-secondary"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-5 shadow-xs ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}