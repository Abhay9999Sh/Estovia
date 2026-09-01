"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import Stepper from "@/components/ui/Stepper";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Personal", "Preferences"];
const LABELS = ["Personal", "Preferences"];

const BUYER_TYPES = ["Individual", "Family", "Developer", "Investor", "NRI", "Other"];
const PROPERTY_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Penthouse", "Studio", "Villa", "Plot", "Commercial", "Office"];
const STATES = [
  "Andhra Pradesh", "Bihar", "Delhi", "Gujarat", "Haryana", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
const TIMELINES = ["Immediate", "Within 3 months", "Within 6 months", "Within 1 year", "1-3 years"];

export default function BuyerOnboardingForm() {
  const { user, setUserData } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    avatar: user?.avatar || "",

    buyerType: "",
    nationality: "",
    address: "",
    pan: "",

    propertyTypes: [],
    budgetMin: "",
    budgetMax: "",
    preferredState: "",
    preferredCity: "",
    possessionTimeline: "",
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

  async function handleFinish() {
    setSaving(true);
    setError("");
    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      avatar: form.avatar,
      buyerType: form.buyerType,
      nationality: form.nationality,
      address: form.address,
      pan: form.pan,
      preferences: {
        propertyTypes: form.propertyTypes,
        budgetRange: { min: Number(form.budgetMin) || 0, max: Number(form.budgetMax) || 0 },
        locations: [],
        preferredState: form.preferredState,
        preferredCity: form.preferredCity,
        possessionTimeline: form.possessionTimeline,
      },
    };
    try {
      const res = await fetch("/api/buyer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const meData = await meRes.json();
      if (meData.user) setUserData(meData.user);

      const compRes = await fetch("/api/buyer/onboarding/complete", { method: "POST" });
      const compData = await compRes.json();
      if (!compRes.ok) throw new Error(compData.error || "Unable to complete onboarding.");
      setDone(true);
      setSaving(false);
      router.push("/buyer/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">Buyer profile completed</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Start exploring verified projects, comparing units and applying for
          properties from your dashboard.
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
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="I am a"
                value={form.buyerType}
                onChange={(e) => update("buyerType", e.target.value)}
              >
                <option value="">Select type</option>
                {BUYER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
              <Input
                label="Nationality"
                value={form.nationality}
                onChange={(e) => update("nationality", e.target.value)}
                placeholder="e.g. Indian"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="PAN (optional)"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
              <Input
                label="Profile Photo URL"
                value={form.avatar}
                onChange={(e) => update("avatar", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Input
              label="Residential Address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />

            <div className="rounded-xl border border-accent-light bg-accent-light/30 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-bold text-foreground">Verification</h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Your identity and address are verified through the platform.
                You can upload documents later from your dashboard.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Interested Property Types</p>
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

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Budget (Min ₹)"
                type="number"
                min="0"
                value={form.budgetMin}
                onChange={(e) => update("budgetMin", e.target.value)}
              />
              <Input
                label="Budget (Max ₹)"
                type="number"
                min="0"
                value={form.budgetMax}
                onChange={(e) => update("budgetMax", e.target.value)}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Preferred State"
                value={form.preferredState}
                onChange={(e) => update("preferredState", e.target.value)}
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Input
                label="Preferred City"
                value={form.preferredCity}
                onChange={(e) => update("preferredCity", e.target.value)}
                placeholder="e.g. Pune"
              />
            </div>

            <Select
              label="Possession Timeline"
              value={form.possessionTimeline}
              onChange={(e) => update("possessionTimeline", e.target.value)}
            >
              <option value="">Select timeline</option>
              {TIMELINES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
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
