"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";
import AppShell from "@/components/AppShell";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}

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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="mt-2 text-muted">Manage your account settings.</p>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-bold text-foreground">Account</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">Name</span>
            <span className="font-medium text-foreground">{user?.name || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">Username</span>
            <span className="font-medium text-foreground">@{user?.username || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">Email</span>
            <span className="font-medium text-foreground">{user?.email || "—"}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-bold text-foreground">Security</h2>
        <p className="mt-1 text-sm text-muted">Log out of your account on this device.</p>
        <Button variant="danger" className="mt-4" onClick={handleLogout} loading={loggingOut}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );
}
