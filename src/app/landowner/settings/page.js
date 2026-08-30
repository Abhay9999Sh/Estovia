"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

function SettingsContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      await logout();
      router.push("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
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
            <span className="font-medium text-foreground capitalize">
              {user?.roles?.join(", ")}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-2 text-lg font-bold text-foreground">Security</h3>
        <p className="mb-4 text-sm text-muted">
          Log out of your account on this device.
        </p>
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
      <DashboardShell title="Settings">
        <SettingsContent />
      </DashboardShell>
    </AuthShell>
  );
}
