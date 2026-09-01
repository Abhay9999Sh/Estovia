"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

function SettingsContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (err) {
      setLoggingOut(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">Account</h3>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-muted">Username</span>
            <span className="font-medium text-foreground">@{user?.username}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="text-muted">Email</span>
            <span className="font-medium text-foreground">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Roles</span>
            <span className="font-medium text-foreground capitalize">{user?.roles?.join(", ")}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-2 text-lg font-bold text-foreground">Security</h3>
        <p className="mb-4 text-sm text-muted">Log out of your account on this device.</p>
        <Button variant="danger" onClick={handleLogout} loading={loggingOut}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Settings">
        <SettingsContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
