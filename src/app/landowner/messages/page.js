"use client";

import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  return (
    <AuthShell>
      <DashboardShell title="Messages">
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">Messages</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Direct messaging with buyers, builders and suppliers will be available
            soon. For now, respond to interest requests from your dashboard.
          </p>
        </div>
      </DashboardShell>
    </AuthShell>
  );
}
