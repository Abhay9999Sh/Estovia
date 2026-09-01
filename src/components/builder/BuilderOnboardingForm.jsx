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

const STEPS = ["Personal", "Company", "Experience", "Locations", "RERA"];
const LABELS = ["Personal", "Company", "Experience", "Locations", "RERA"];

const DESIGNATIONS = ["Founder", "Director", "Partner", "Promoter", "Authorized Representative", "Other"];
const BUSINESS_TYPES = ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Individual Developer", "Other"];
const PROPERTY_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Luxury Housing", "Affordable Housing", "Other"];
const SPECIALIZATIONS = [
  "Residential Development",
  "Commercial Projects",
  "Affordable Housing",
  "Luxury Housing",
  "Townships",
  "Plotted Development",
  "Industrial Parks",
  "Re-development",
];
const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export default function BuilderOnboardingForm() {
  const { user, setUserData } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    designation: "",
    avatar: user?.avatar || "",

    companyName: "",
    businessType: "",
    cin: "",
    llpin: "",
    pan: "",
    gstin: "",
    registeredAddress: "",
    officeAddress: "",
    website: "",
    businessEmail: "",
    businessPhone: "",
    yearEstablished: "",

    yearsOfExperience: 0,
    completedProjects: 0,
    ongoingProjects: 0,
    specializations: [],
    developmentAreas: [],
    propertyTypes: [],
    budgetMin: "",
    budgetMax: "",

    operatingLocations: [{ state: "", city: "", district: "", area: "" }],

    reraRegistrations: [{ state: "", registrationNumber: "", promoterName: "" }],
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
      if (!form.fullName.trim()) e.fullName = "Please provide your full name.";
      if (!form.phone.trim()) e.phone = "Please provide your phone number.";
      else if (form.phone.trim().length < 10) e.phone = "Please provide a valid phone number.";
      if (!form.designation) e.designation = "Please select your designation.";
    }
    if (s === 1) {
      if (!form.companyName.trim()) e.companyName = "Please provide your company / business name.";
      if (!form.businessType) e.businessType = "Please select a business type.";
    }
    if (s === 4) {
      const reras = form.reraRegistrations.filter((r) => r.state || r.registrationNumber);
      for (let i = 0; i < reras.length; i++) {
        if (!reras[i].state) e[`rera-${i}-state`] = "Select state.";
        if (!reras[i].registrationNumber.trim()) e[`rera-${i}-number`] = "Provide registration number.";
      }
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
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      designation: form.designation,
      avatar: form.avatar,

      companyName: form.companyName,
      businessType: form.businessType,
      cin: form.cin,
      llpin: form.llpin,
      pan: form.pan,
      gstin: form.gstin,
      registeredAddress: form.registeredAddress,
      officeAddress: form.officeAddress,
      website: form.website,
      businessEmail: form.businessEmail,
      businessPhone: form.businessPhone,
      yearEstablished: form.yearEstablished,

      yearsOfExperience: Number(form.yearsOfExperience) || 0,
      completedProjects: Number(form.completedProjects) || 0,
      ongoingProjects: Number(form.ongoingProjects) || 0,
      specializations: form.specializations,
      developmentAreas: form.developmentAreas,
      propertyTypes: form.propertyTypes,
      budgetRange: { min: Number(form.budgetMin) || 0, max: Number(form.budgetMax) || 0 },

      operatingLocations: form.operatingLocations.filter(
        (l) => l.state || l.city
      ),
    };
    try {
      const res = await fetch("/api/builder/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const meData = await meRes.json();
      if (meData.user) setUserData(meData.user);

      // Save RERA registrations separately (never auto-verified)
      const validReras = form.reraRegistrations.filter(
        (r) => r.state && r.registrationNumber
      );
      for (const rera of validReras) {
        try {
          await fetch("/api/builder/rera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: rera.state,
              registrationNumber: rera.registrationNumber,
              promoterName: rera.promoterName,
            }),
          });
        } catch (err) {
          // best-effort
        }
      }

      if (complete) {
        const compRes = await fetch("/api/builder/onboarding/complete", {
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

  function addRera() {
    setForm((f) => ({
      ...f,
      reraRegistrations: [...f.reraRegistrations, { state: "", registrationNumber: "", promoterName: "" }],
    }));
  }

  function removeRera(index) {
    setForm((f) => ({
      ...f,
      reraRegistrations: f.reraRegistrations.filter((_, i) => i !== index),
    }));
  }

  function updateRera(index, key, value) {
    setForm((f) => ({
      ...f,
      reraRegistrations: f.reraRegistrations.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    }));
  }

  async function handleFinish() {
    const ok = await saveProfile(true);
    if (ok) {
      setDone(true);
      router.push("/builder/dashboard");
      router.refresh();
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">
          Builder profile completed
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Your builder profile is set up. Start discovering land and managing
          projects from your dashboard.
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
              label="Full Name"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              required
              error={errors.fullName}
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
                label="Company / Business Name"
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
                error={errors.companyName}
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

            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="CIN (if applicable)"
                value={form.cin}
                onChange={(e) => update("cin", e.target.value)}
                placeholder="e.g. U70100MH2010PTC..."
              />
              <Input
                label="LLPIN (if applicable)"
                value={form.llpin}
                onChange={(e) => update("llpin", e.target.value)}
                placeholder="e.g. AAJ-0000..."
              />
              <Input
                label="Year Established"
                value={form.yearEstablished}
                onChange={(e) => update("yearEstablished", e.target.value)}
                placeholder="e.g. 2015"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="PAN"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
              <Input
                label="GSTIN"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                placeholder="22ABCDE1234F1Z5"
              />
            </div>

            <Input
              label="Registered Address"
              value={form.registeredAddress}
              onChange={(e) => update("registeredAddress", e.target.value)}
            />
            <Input
              label="Office Address"
              value={form.officeAddress}
              onChange={(e) => update("officeAddress", e.target.value)}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Website"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://..."
              />
              <Input
                label="Business Phone"
                type="tel"
                value={form.businessPhone}
                onChange={(e) => update("businessPhone", e.target.value)}
              />
            </div>
            <Input
              label="Business Email"
              type="email"
              value={form.businessEmail}
              onChange={(e) => update("businessEmail", e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="Years of Experience"
                type="number"
                min="0"
                value={form.yearsOfExperience}
                onChange={(e) => update("yearsOfExperience", e.target.value)}
              />
              <Input
                label="Completed Projects"
                type="number"
                min="0"
                value={form.completedProjects}
                onChange={(e) => update("completedProjects", e.target.value)}
              />
              <Input
                label="Ongoing Projects"
                type="number"
                min="0"
                value={form.ongoingProjects}
                onChange={(e) => update("ongoingProjects", e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Specializations</p>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleArray("specializations", s)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.specializations.includes(s)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Budget Range (Min ₹)"
                type="number"
                min="0"
                value={form.budgetMin}
                onChange={(e) => update("budgetMin", e.target.value)}
              />
              <Input
                label="Budget Range (Max ₹)"
                type="number"
                min="0"
                value={form.budgetMax}
                onChange={(e) => update("budgetMax", e.target.value)}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Property Types</p>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleArray("propertyTypes", p)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      form.propertyTypes.includes(p)
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-white text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
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
                  <Input
                    label="City"
                    value={loc.city}
                    onChange={(e) => updateOpLoc(i, "city", e.target.value)}
                    placeholder="e.g. Pune"
                  />
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
                  <Input
                    label="Preferred Area"
                    value={loc.area}
                    onChange={(e) => updateOpLoc(i, "area", e.target.value)}
                    placeholder="e.g. Hinjewadi"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-accent-light bg-accent-light/30 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-bold text-foreground">RERA Information</h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                RERA numbers you provide are queued for verification against the
                applicable authority. We never mark a registration as verified
                without an authorized data source.
              </p>
            </div>

            {form.reraRegistrations.map((rera, i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">RERA Registration {i + 1}</span>
                  {form.reraRegistrations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRera(i)}
                      className="text-muted hover:text-danger"
                      aria-label="Remove RERA"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="RERA State"
                    value={rera.state}
                    onChange={(e) => updateRera(i, "state", e.target.value)}
                    error={errors[`rera-${i}-state`]}
                  >
                    <option value="">Select state</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                  <Input
                    label="Registration Number"
                    value={rera.registrationNumber}
                    onChange={(e) => updateRera(i, "registrationNumber", e.target.value.toUpperCase())}
                    placeholder="e.g. P52100012345"
                    error={errors[`rera-${i}-number`]}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Promoter Name"
                      value={rera.promoterName}
                      onChange={(e) => updateRera(i, "promoterName", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRera}>
              <Plus className="h-4 w-4" /> Add Another RERA
            </Button>
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
