"use client";

import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Save,
  AlertTriangle,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";

function ProfileContent() {
  const { user, setUserData } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || "",
        avatar: user.avatar || "",
      });
      setLoading(false);
    }
  }, [user]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserData(data.user);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">Personal Information</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
          <Input
            label="Profile Photo URL"
            value={form.avatar}
            onChange={(e) => update("avatar", e.target.value)}
            placeholder="https://..."
          />
          <div className="sm:col-span-2">
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Your address"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">Account</h3>
        <div className="space-y-3 text-sm text-muted">
          <p className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-accent" /> @{user?.username}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" /> {user?.email}
          </p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Roles:{" "}
            <span className="flex flex-wrap gap-1.5">
              {user?.roles?.map((r) => (
                <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                  {r}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  return (
    <AuthShell>
      <DashboardShell title="My Profile">
        <ProfileContent />
      </DashboardShell>
    </AuthShell>
  );
}
