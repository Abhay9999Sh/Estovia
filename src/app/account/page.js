"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  LayoutDashboard,
  Map,
  Bookmark,
  Compass,
  Settings,
  ShieldCheck,
  Save,
  AlertTriangle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { isValidIndianPhone, PHONE_ERROR } from "@/lib/phone";

function AccountContent() {
  const { user, status, setUserData } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isLandowner = user?.roles?.includes("landowner");
  const isAdmin = user?.roles?.includes("admin");
  const hasRole =
    isLandowner ||
    user?.roles?.includes("builder") ||
    user?.roles?.includes("supplier") ||
    user?.roles?.includes("buyer");

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || "",
        avatar: user.avatar || "",
      });
    }
  }, [user]);

  if (status === "loading" || !form) {
    return (
      <div className="px-4 pt-24 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const phone = (form.phone || "").replace(/[\s\-()]/g, "");
    if (phone && !isValidIndianPhone(phone)) {
      setError(PHONE_ERROR);
      setSaving(false);
      return;
    }
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

  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            My Account
          </h1>
          <p className="mt-1 text-muted">
            Manage your profile and preferences as a viewer.
          </p>
        </div>
        {isLandowner && (
          <Link
            href="/landowner/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-soft"
          >
            <LayoutDashboard className="h-4 w-4" /> Landowner Dashboard
          </Link>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <QuickLink href="/account/listings" icon={Map} label="My Listings" />
        <QuickLink href="/account/saved" icon={Bookmark} label="Saved" />
        {isAdmin ? (
          <QuickLink href="/admin" icon={LayoutDashboard} label="Admin Dashboard" />
        ) : (
          !hasRole && (
            <QuickLink href="/complete-profile" icon={Compass} label="Complete Profile" />
          )
        )}
        <QuickLink href="/account/settings" icon={Settings} label="Settings" />
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
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
          <h2 className="mb-4 text-lg font-bold text-foreground">Profile Information</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full Name">
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="Profile Photo URL">
              <input
                value={form.avatar}
                onChange={(e) => update("avatar", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Badge tone="info">@{user?.username}</Badge>
            <Badge tone="muted">
              <ShieldCheck className="h-3 w-3" /> {user?.email}
            </Badge>
            <Badge tone="accent">Viewer</Badge>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-5 text-center transition-all hover:-translate-y-1 hover:border-accent hover:shadow-md"
    >
      <Icon className="h-6 w-6 text-accent" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}

export default function AccountPage() {
  return (
    <AppShell>
      <AccountContent />
    </AppShell>
  );
}
