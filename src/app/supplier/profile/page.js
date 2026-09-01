"use client";

import { useEffect, useState } from "react";
import { User, Save } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Skeleton from "@/components/ui/Skeleton";

const BUSINESS_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Retailer", "Service Provider", "Contractor", "Other"];
const CATEGORIES = ["Cement", "Steel", "Bricks", "Sand", "Aggregates", "Electrical", "Plumbing", "Paint", "Tiles", "Sanitary", "Hardware", "Glass", "Wood", "Aluminium", "Doors & Windows", "HVAC", "Construction Machinery", "Interior Materials", "Construction Services", "Architecture", "Engineering", "Civil Work", "Interior Design", "Equipment Rental", "Other"];

function ProfileContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/supplier/profile", { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setProfile(d.profile);
          setForm({
            ownerName: d.profile?.ownerName || "",
            fullName: d.profile?.fullName || "",
            phone: d.profile?.phone || "",
            email: d.profile?.email || "",
            designation: d.profile?.designation || "",
            businessName: d.profile?.businessName || "",
            businessType: d.profile?.businessType || "",
            gstin: d.profile?.gstin || "",
            pan: d.profile?.pan || "",
            udyam: d.profile?.udyam || "",
            registeredAddress: d.profile?.registeredAddress || "",
            officeAddress: d.profile?.officeAddress || "",
            website: d.profile?.website || "",
            businessEmail: d.profile?.businessEmail || "",
            businessPhone: d.profile?.businessPhone || "",
            yearEstablished: d.profile?.yearEstablished || "",
            productCategories: d.profile?.productCategories?.join(", ") || "",
            serviceCategories: d.profile?.serviceCategories?.join(", ") || "",
            yearsOfExperience: d.profile?.yearsOfExperience || "",
            bio: d.profile?.bio || "",
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
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setDone("");
    try {
      const body = {
        ownerName: form.ownerName,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        designation: form.designation,
        businessName: form.businessName,
        businessType: form.businessType,
        gstin: form.gstin,
        pan: form.pan,
        udyam: form.udyam,
        registeredAddress: form.registeredAddress,
        officeAddress: form.officeAddress,
        website: form.website,
        businessEmail: form.businessEmail,
        businessPhone: form.businessPhone,
        yearEstablished: form.yearEstablished,
        productCategories: form.productCategories ? form.productCategories.split(",").map((s) => s.trim()).filter(Boolean) : [],
        serviceCategories: form.serviceCategories ? form.serviceCategories.split(",").map((s) => s.trim()).filter(Boolean) : [],
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
        bio: form.bio,
      };
      const res = await fetch("/api/supplier/profile", {
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

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="max-w-2xl">
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {done && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{done}</div>}

      <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
        <h3 className="font-bold text-foreground">Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Owner Name" value={form.ownerName || ""} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          <Input label="Full Name" value={form.fullName || ""} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <Select label="Designation" value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
          <option value="">Select</option>
          {["Owner", "Director", "Manager", "Sales Executive", "Procurement Head", "Other"].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6 space-y-5">
        <h3 className="font-bold text-foreground">Business Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Business Name" value={form.businessName || ""} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <Select label="Business Type" value={form.businessType || ""} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
            <option value="">Select</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="GSTIN" value={form.gstin || ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          <Input label="PAN" value={form.pan || ""} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
          <Input label="Udyam" value={form.udyam || ""} onChange={(e) => setForm({ ...form, udyam: e.target.value })} />
        </div>
        <Input label="Registered Address" value={form.registeredAddress || ""} onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })} />
        <Input label="Office Address" value={form.officeAddress || ""} onChange={(e) => setForm({ ...form, officeAddress: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Website" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <Input label="Business Email" type="email" value={form.businessEmail || ""} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
          <Input label="Business Phone" value={form.businessPhone || ""} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Year Established" type="number" value={form.yearEstablished || ""} onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })} />
          <Input label="Years of Experience" type="number" value={form.yearsOfExperience || ""} onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-white p-6 space-y-5">
        <h3 className="font-bold text-foreground">Categories & Expertise</h3>
        <Input label="Product Categories" value={form.productCategories || ""} onChange={(e) => setForm({ ...form, productCategories: e.target.value })} placeholder="e.g. Cement, Steel, Bricks" hint="Comma-separated" />
        <Input label="Service Categories" value={form.serviceCategories || ""} onChange={(e) => setForm({ ...form, serviceCategories: e.target.value })} placeholder="e.g. Construction Services, Architecture" hint="Comma-separated" />
        <Textarea label="Bio / About" rows={3} value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />

        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save Profile
        </Button>
      </div>
    </div>
  );
}

export default function SupplierProfilePage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Profile" subtitle="Manage your supplier profile">
        <ProfileContent />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
