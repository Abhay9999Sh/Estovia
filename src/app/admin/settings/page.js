"use client";

import { ShieldCheck, KeyRound, Info } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { AdminLoading, AdminError, Card, CardHeader } from "@/components/admin/AdminStates";

export default function AdminSettingsPage() {
  const { data, loading, error, refetch } = useAdminFetch("/api/admin/dashboard");

  return (
    <AdminShell title="Settings" subtitle="Admin console preferences & info">
      <div className="space-y-6">
        {loading && <AdminLoading rows={4} />}
        {error && <AdminError message={error} onRetry={refetch} />}

        <Card>
          <CardHeader
            title="Access control"
            subtitle="How the admin role works"
            action={<ShieldCheck className="h-5 w-5 text-accent" />}
          />
          <ul className="space-y-2 text-sm text-muted">
            <li>• Every <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">/api/admin/*</code> route requires an <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">admin</code> login server-side.</li>
            <li>• The admin console is reachable at <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">/admin</code> and hides itself from non-admin users.</li>
            <li>• Admin signup is disabled by default — an admin account must be seeded with the CLI script.</li>
            <li>• All sensitive actions (approve/reject, suspend, broadcast) are written to the immutable audit log.</li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Seed an admin account" action={<KeyRound className="h-5 w-5 text-accent" />} />
          <p className="text-sm text-muted">From the <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">estovia/</code> directory run:</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-secondary/60 p-4 text-xs text-foreground">
            {`node scripts/create-admin.mjs --email admin@estovia.in --password admin123 --name "Admin" --username admin`}
          </pre>
          <p className="mt-3 text-xs text-muted">The script is idempotent — re-running it only updates the seed user rather than creating duplicates.</p>
        </Card>

        <Card>
          <CardHeader title="Platform info" action={<Info className="h-5 w-5 text-accent" />} />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-muted">Registered users</span>
              <StatusBadge status={data?.stats?.users ?? "—"} className="!bg-slate-100 !text-slate-800" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-muted">Land listings</span>
              <StatusBadge status={data?.stats?.lands ?? "—"} className="!bg-slate-100 !text-slate-800" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-muted">Pending verification</span>
              <StatusBadge status={data?.stats?.pendingVerifications ?? "—"} className="!bg-slate-100 !text-slate-800" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <span className="text-muted">Open reports</span>
              <StatusBadge status={data?.stats?.openReports ?? "—"} className="!bg-slate-100 !text-slate-800" />
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}