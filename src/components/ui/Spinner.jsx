import { Loader2 } from "lucide-react";

export default function Spinner({ className = "", label }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
      {label && <span className="text-sm text-muted">{label}</span>}
    </div>
  );
}
