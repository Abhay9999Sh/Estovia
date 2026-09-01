"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import Stepper from "@/components/ui/Stepper";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Personal", "Business", "Capabilities", "Coverage"];
const LABELS = ["Personal", "Business", "Capabilities", "Coverage"];

const DESIGNATIONS = ["Owner", "Director", "Partner", "Manager", "Authorized Representative", "Other"];
const BUSINESS_TYPES = ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Sole Trader", "Other"];
const CATEGORIES = ["Materials", "Equipment", "Labour", "Services", "Fittings & Finishes", "Other"];
const PRODUCT_CATEGORIES = [
  "Cement", "Steel & TMT", "Bricks & Blocks", "Aggregates & Sand", "Ready-Mix Concrete (RMC)",
  "Tiles & Flooring", "Sanitaryware", "Electricals", "Paints & Coatings", "Glass & Glazing",
  "Wood & Plywood", "Hardware", "Plumbing", "Doors & Windows", "Roofing", "Insulation",
];
const SERVICE_CATEGORIES = [
  "Excavation", "Structural Work", "Electrical Work", "Plumbing Work", "HVAC",
  "Painting & Finishing", "Civil Contractor", "Interior Work", "Facade Work",
  "Equipment Rental", "Labour Supply", "Architectural Services",
];
const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
const BRANDS = [
  "UltraTech", "ACC", "Ambuja", "JSW", "Tata Steel", "Jaquar", "Kohler", "Asian Paints",
  "Berger", "Saint-Gobain", "Century Ply", "Greenply", "Havells", "Legrand", "Finolex",
];

export default function SupplierOnboardingForm() {
  const { user, setUserData } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ownerName: user?.name || "",
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    designation: "",
    avatar: user?.avatar || "",

    businessName: "",
    businessType: "",
    category: "",
    subcategories: [],
    gstin: "",
    pan: "",
    udyam: "",
    registeredAddress: "",
    officeAddress: "",
    website: "",
    businessEmail: "",
    businessPhone: "",
    yearEstablished: "",

    yearsOfExperience: 0,
    deliveryCapability: "",
    productCategories: [],
    serviceCategories: [],
    brandsDealt: [],
    certifications: [],

    operatingLocations: [{ state: "", city: "", district: "", area: "" }],
    serviceableStates: [],
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function toggleArray(field, value) {
    setForm((f) => {
      const list = f[field] || [];
      const has = list.includes(value);
      return { ...f, [field]: has ? list.filter((v) => v !== value) : [...list, value] };
    });
  }

  function validateStep(s) {
    const e = {};
    if (s === 0) {
      if (!form.ownerName.trim()) e.ownerName = "Please provide the owner's name.";
      if (!form.phone.trim()) e.phone = "Please provide your phone number.";
      else if (form.phone.trim().length < 10) e.phone = "Please provide a valid phone number.";
      if (!form.designation) e.designation = "Please select your designation.";
    }
    if (s === 1) {
      if (!form.businessName.trim()) e.businessName = "Please provide your business name.";
      if (!form.businessType) e.businessType = "Please select a business type.";
      if (!form.category) e.category = "Please select a supply category.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setError("");
    setStep((st) => Math.min(st + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((st) => Math.max(st - 1, 0));
  }

  async function saveProfile(complete = false) {
    setSaving(true);
    setError("");
    const payload = {
      ownerName: form.ownerName,
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      designation: form.designation,
      avatar: form.avatar,

      businessName: form.businessName,
      businessType: form.businessType,
      category: form.category,
      subcategories: form.subcategories,
      gstin: form.gstin,
      pan: form.pan,
      udyam: form.udyam,
      registeredAddress: form.registeredAddress,
      officeAddress: form.officeAddress,
      website: form.website,
      businessEmail: form.businessEmail,
      businessPhone: form.businessPhone,
      yearEstablished: form.yearEstablished,

      yearsOfExperience: Number(form.yearsOfExperience) || 0,
      deliveryCapability: form.deliveryCapability,
      productCategories: form.productCategories,
      serviceCategories: form.serviceCategories,
      brandsDealt: form.brandsDealt,
      certifications: form.certifications,

      operatingLocations: form.operatingLocations.filter((l) => l.state || l.city),
      serviceableStates: form.serviceableStates,
    };
    try {
      const res = await fetch("/api/supplier/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const meData = await meRes.json();
      if (meData.user) setUserData(meData.user);

      if (complete) {
        const compRes = await fetch("/api/supplier/onboarding/complete", {
          method: "POST",
        });
        const compData = await compRes.json();
        if (!compRes.ok) throw new Error(compData.error || "Unable to complete onboarding.");
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function addOperatingLocation() {
    setForm((f) => ({
      ...f,
      operatingLocations: [...f.operatingLocations, { state: "", city: "", district: "", area: "" }],
    }));
  }

  function removeOperatingLocation(index) {
    setForm((f) => ({
      ...f,
      operatingLocations: f.operatingLocations.filter((_, i) => i !== index),
    }));
  }

  function updateOpLoc(index, key, value) {
    setForm((f) => ({
      ...f,
      operatingLocations: f.operatingLocations.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));
  }

  async function handleFinish() {
    const ok = await saveProfile(true);
    if (ok) {
      setDone(true);
      router.push("/supplier/dashboard");
      router.refresh();
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">Supplier profile completed</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Your supplier business is set up. Start discovering requirements and
          quoting on projects from your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Stepper steps={STEPS} labels={LABELS} current={step} />

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-8">
        {step === 0 && (
          <div className="space-y-5">
            <Input
              label="Owner / Contact Name"
              value={form.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              required
              error={errors.ownerName}
            />
            <Select
              label="Designation"
              value={form.designation}
              onChange={(e) => update("designation", e.target.value)}
              required
              error={errors.designation}
            >
              <option value="">Select designation</option>
              {DESIGNATIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="10-digit mobile number"
                required
                error={errors.phone}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
            <Input
              label="Profile Photo URL"
              value={form.avatar}
              onChange={(e) => update("avatar", e.target.value)}
              placeholder="https://..."
              hint="Optional. Add a URL to your profile photo."
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Business Name"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                required
                error={errors.businessName}
              />
              <Select
                label="Business Type"
                value={form.businessType}
                onChange={(e) => update("businessType", e.target.value)}
                required
                error={errors.businessType}
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </Select>
            </div>

            <Select
              label="Primary Supply Category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              required
              error={errors.category}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Input
              label="Subcategories (comma separated)"
              value={form.subcategories.join(", ")}
              onChange={(e) => update("subcategories", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="e.g. Cement, Steel, Tiles"
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="GSTIN"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                placeholder="22ABCDE1234F1Z5"
              />
              <Input
                label="PAN"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Udyam Registration (if MSME)"
                value={form.udyam}
                onChange={(e) => update("udyam", e.target.value.toUpperCase())}
                placeholder="UDYAM-XX-00-0000000"
              />
              <Input
                label="Year Established"
                value={form.yearEstablished}
                onChange={(e) => update("yearEstablished", e.target.value)}
                placeholder="e.g. 2012"
              />
            </div>

            <Input label="Registered Address" value={form.registeredAddress} onChange={(e) => update("registeredAddress", e.target.value)} />
            <Input label="Office / Billing Address" value={form.officeAddress} onChange={(e) => update("officeAddress", e.target.value)} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Website" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." />
              <Input label="Business Phone" type="tel" value={form.businessPhone} onChange={(e) => update("businessPhone", e.target.value)} />
            </div>
            <Input label="Business Email" type="email" value={form.businessEmail} onChange={(e) => update("businessEmail", e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Years of Experience"
                type="number"
                min="0"
                value={form.yearsOfExperience}
                onChange={(e) => update("yearsOfExperience", e.target.value)}
              />
              <Input
                label="Delivery Capability"
                value={form.deliveryCapability}
                onChange={(e) => update("deliveryCapability", e.target.value)}
                placeholder="e.g. 500 MT / week, nationwide dispatch"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Product Categories</p>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleArray("productCategories", c)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.productCategories.includes(c)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Service Categories</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleArray("serviceCategories", c)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.serviceCategories.includes(c)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Brands Dealt / Works With</p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleArray("brandsDealt", b)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.brandsDealt.includes(b)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Serviceable States</p>
              <div className="flex flex-wrap gap-2">
                {STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleArray("serviceableStates", s)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.serviceableStates.includes(s)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Operating Locations</p>
              <Button variant="outline" size="sm" onClick={addOperatingLocation}>
                <Plus className="h-4 w-4" /> Add Location
              </Button>
            </div>
            {form.operatingLocations.map((loc, i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Location {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeOperatingLocation(i)}
                    disabled={form.operatingLocations.length === 1}
                    className="text-muted hover:text-danger disabled:opacity-50"
                    aria-label="Remove location"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="State"
                    value={loc.state}
                    onChange={(e) => updateOpLoc(i, "state", e.target.value)}
                  >
                    <option value="">Select state</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                  <Input label="City" value={loc.city} onChange={(e) => updateOpLoc(i, "city", e.target.value)} placeholder="e.g. Pune" />
                  <Select
                    label="District"
                    value={loc.district}
                    onChange={(e) => updateOpLoc(i, "district", e.target.value)}
                  >
                    <option value="">Select district</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                  <Input label="Preferred Area" value={loc.area} onChange={(e) => updateOpLoc(i, "area", e.target.value)} placeholder="e.g. MIDC Area" />
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-accent-light bg-accent-light/30 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-bold text-foreground">Verification</h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                GST / PAN / Udyam / Business details you provide are queued for
                verification. We never mark registration numbers as verified
                without an authorized source.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step === STEPS.length - 1 ? (
          <Button onClick={handleFinish} loading={saving}>
            Complete &amp; Go to Dashboard
          </Button>
        ) : (
          <Button onClick={next} className="gap-1.5">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
