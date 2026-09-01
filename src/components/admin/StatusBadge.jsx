import Badge from "@/components/ui/Badge";
import { statusTone } from "@/lib/format";

export default function StatusBadge({ status, className = "", icon }) {
  return (
    <Badge tone={statusTone(status)} icon={icon} className={className}>
      {status || "—"}
    </Badge>
  );
}