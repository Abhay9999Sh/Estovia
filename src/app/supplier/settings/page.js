"use client";

import Link from "next/link";
import { Settings, ShieldCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";

function SettingsContent() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="font-bold text-foreground">Account</h3>
        <p className="mt-1 text-sm text-muted">Manage your account settings and preferences.</p>
        <div className="mt-4 space-y-2">
          <Link href="/supplier/profile" className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-secondary transition-colors">
            <span className="text-sm font-medium text-foreground">Edit Profile</span>
            <span className="text-xs text-muted">→</span>
          </Link>
          <Link href="/supplier/verification" className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-secondary transition-colors">
            <span className="text-sm font-medium text-foreground">Verification</span>
            <span className="text-xs text-muted">→</span>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="font-bold text-foreground">Notifications</h3>
        <p className="mt-1 text-sm text-muted">Notification preferences are managed in your browser.</p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <h3 className="font-bold text-foreground">Privacy & Security</h3>
        <p className="mt-1 text-sm text-muted">Your data is protected and never shared without your consent.</p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-foreground">Business Verification</p>
              <p className="text-xs text-muted">Upload business documents to build trust with builders.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierSettingsPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Settings">
        <SettingsContent />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
