"use client";

import { useEffect, useState } from "react";
import { User, Save, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import MoneyInput from "@/components/ui/MoneyInput";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";

const BUYER_TYPES = ["Individual", "Family", "Developer", "Investor", "NRI", "Other"];

function ProfileContent() {
  const { status } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({});

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/buyer/profile", { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setProfile(d.profile);
          setForm({
            fullName: d.profile?.fullName || "",
            phone: d.profile?.phone || "",
            email: d.profile?.email || "",
            buyerType: d.profile?.buyerType || "Individual",
            about: d.profile?.about || "",
            address: d.profile?.address || "",
            pan: d.profile?.pan || "",
            preferences: {
              propertyTypes: d.profile?.preferences?.propertyTypes?.join(", ") || "",
              budgetMin: d.profile?.preferences?.budgetRange?.min || "",
              budgetMax: d.profile?.preferences?.budgetRange?.max || "",
              locations: d.profile?.preferences?.locations?.join(", ") || "",
              possessionTimeline: d.profile?.preferences?.possessionTimeline || "",
            },
          });
        }
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [status]);

  async function save() {
    setSaving(true);
    setError("");
    setDone("");
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        buyerType: form.buyerType,
        about: form.about,
        address: form.address,
        pan: form.pan,
        preferences: {
          propertyTypes: form.preferences.propertyTypes ? form.preferences.propertyTypes.split(",").map((s) => s.trim()).filter(Boolean) : [],
          budgetRange: {
            min: Number(form.preferences.budgetMin) || 0,
            max: Number(form.preferences.budgetMax) || 0,
          },
          locations: form.preferences.locations ? form.preferences.locations.split(",").map((s) => s.trim()).filter(Boolean) : [],
          possessionTimeline: form.preferences.possessionTimeline,
        },
      };
      const res = await fetch("/api/buyer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save.");
      setDone("Profile saved successfully.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {done && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{done}</div>
      )}

      <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
        <h3 className="font-bold text-foreground">Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full Name" value={form.fullName || ""} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
        </div>
        <Input label="Email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Buyer Type" value={form.buyerType || "Individual"} onChange={(e) => setForm({ ...form, buyerType: e.target.value })}>
            {BUYER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Input label="PAN" value={form.pan || ""} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
        </div>
        <Textarea label="About" rows={2} value={form.about || ""} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        <Textarea label="Address" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6 space-y-5">
        <h3 className="font-bold text-foreground">Preferences</h3>
        <Input label="Property Types" value={form.preferences?.propertyTypes || ""} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, propertyTypes: e.target.value } })} placeholder="e.g. Apartment, Villa" hint="Comma-separated" />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput label="Min Budget" value={form.preferences?.budgetMin || 0} onChange={(v) => setForm({ ...form, preferences: { ...form.preferences, budgetMin: v } })} hint="" />
          <MoneyInput label="Max Budget" value={form.preferences?.budgetMax || 0} onChange={(v) => setForm({ ...form, preferences: { ...form.preferences, budgetMax: v } })} hint="" />
        </div>
        <Input label="Preferred Locations" value={form.preferences?.locations || ""} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, locations: e.target.value } })} placeholder="e.g. Mumbai, Pune" hint="Comma-separated" />
        <Input label="Possession Timeline" value={form.preferences?.possessionTimeline || ""} onChange={(e) => setForm({ ...form, preferences: { ...form.preferences, possessionTimeline: e.target.value } })} placeholder="e.g. Within 1 year" />

        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save Profile
        </Button>
      </div>
    </div>
  );
}

export default function BuyerProfilePage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Profile" subtitle="Manage your buyer profile and preferences">
        <ProfileContent />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
