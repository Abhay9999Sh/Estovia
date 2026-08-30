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
import LandForm from "@/components/land/LandForm";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Personal", "Identity", "Landowner", "Land"];
const LABELS = ["Personal Information", "Identity", "Landowner Details", "Add Land"];

const OWNERSHIP_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "joint", label: "Joint Ownership" },
  { value: "company", label: "Company" },
  { value: "trust", label: "Trust / Other" },
];

export default function OnboardingForm() {
  const { user, setUserData } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    dob: "",
    address: user?.address || "",
    avatar: user?.avatar || "",
    pan: "",
    identityDocument: {},
    ownershipType: "individual",
    coOwners: [],
    landAdded: false,
  });
  const [errors, setErrors] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateStep(s) {
    const e = {};
    if (s === 0) {
      if (!form.fullName.trim()) e.fullName = "Please provide your full name.";
      if (!form.phone.trim()) e.phone = "Please provide your phone number.";
      else if (form.phone.trim().length < 10) e.phone = "Please provide a valid phone number.";
      if (!form.email.trim()) e.email = "Please provide your email.";
      else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Please provide a valid email.";
    }
    if (s === 1) {
      if (!form.pan.trim()) e.pan = "Please provide your PAN.";
      else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.trim().toUpperCase()))
        e.pan = "Please provide a valid PAN (e.g. ABCDE1234F).";
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

  // Save profile when moving from step 1 or 2
  async function saveProfile() {
    setProfileLoading(true);
    setError("");
    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      dob: form.dob || null,
      address: form.address,
      avatar: form.avatar,
      pan: form.pan.toUpperCase(),
      ownershipType: form.ownershipType,
      coOwners: form.coOwners,
      becomeLandowner: true,
    };
    try {
      const res = await fetch("/api/landowner/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      // Refresh user roles
      const meRes = await fetch("/api/users/me", { cache: "no-store" });
      const meData = await meRes.json();
      if (meData.user) setUserData(meData.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setProfileLoading(false);
    }
  }

  function addCoOwner() {
    setForm((f) => ({
      ...f,
      coOwners: [...f.coOwners, { name: "", relationship: "", ownershipPercentage: "" }],
    }));
  }

  function removeCoOwner(index) {
    setForm((f) => ({
      ...f,
      coOwners: f.coOwners.filter((_, i) => i !== index),
    }));
  }

  function updateCoOwner(index, key, value) {
    setForm((f) => ({
      ...f,
      coOwners: f.coOwners.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    }));
  }

  async function handleNextFromPersonal() {
    if (!validateStep(0)) return;
    setError("");
    setStep(1);
  }

  async function handleNextFromIdentity() {
    if (!validateStep(1)) return;
    const ok = await saveProfile();
    if (ok) setStep(2);
  }

  async function handleFinish() {
    setDone(true);
    router.push("/landowner/dashboard");
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">
          Landowner profile completed
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Your landowner profile is set up. You can now add land and manage
          listings from your dashboard.
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
                error={errors.email}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Date of Birth"
                type="date"
                value={form.dob}
                onChange={(e) => update("dob", e.target.value)}
              />
              <Input
                label="Profile Photo URL"
                value={form.avatar}
                onChange={(e) => update("avatar", e.target.value)}
                placeholder="https://..."
                hint="Optional. Add a URL to your profile photo."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Address</label>
              <Input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Your current address"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Input
              label="PAN (Permanent Account Number)"
              value={form.pan}
              onChange={(e) => update("pan", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              required
              error={errors.pan}
              maxLength={10}
            />
            <div className="rounded-xl border border-accent-light bg-accent-light/30 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-bold text-foreground">Identity Verification</h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                We will verify your identity document through our review process
                before you can transact with confidence.
              </p>
              <BadgePill label="Status" value="Pending" />
            </div>
            <p className="text-xs text-muted">
              Note: We do not perform government Aadhaar authentication. Identity
              verification is handled through our document review process.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Select
              label="Ownership Type"
              value={form.ownershipType}
              onChange={(e) => update("ownershipType", e.target.value)}
            >
              {OWNERSHIP_TYPES.map((ot) => (
                <option key={ot.value} value={ot.value}>{ot.label}</option>
              ))}
            </Select>

            {form.ownershipType === "joint" && (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">Co-owners</h4>
                  <Button variant="outline" size="sm" onClick={addCoOwner}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                {form.coOwners.length === 0 && (
                  <p className="mt-2 text-sm text-muted">
                    No co-owners added. Add joint owners and their ownership share.
                  </p>
                )}
                <div className="mt-4 space-y-4">
                  {form.coOwners.map((co, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-white p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-foreground">
                          Co-owner {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCoOwner(i)}
                          className="text-muted hover:text-danger"
                          aria-label="Remove co-owner"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          label="Name"
                          value={co.name}
                          onChange={(e) => updateCoOwner(i, "name", e.target.value)}
                          placeholder="Full name"
                        />
                        <Input
                          label="Relationship"
                          value={co.relationship}
                          onChange={(e) => updateCoOwner(i, "relationship", e.target.value)}
                          placeholder="e.g. Brother"
                        />
                        <Input
                          label="Ownership %"
                          type="number"
                          min="0"
                          max="100"
                          value={co.ownershipPercentage}
                          onChange={(e) => updateCoOwner(i, "ownershipPercentage", e.target.value)}
                          placeholder="e.g. 50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.ownershipType === "company" && (
              <div className="rounded-xl border border-border bg-secondary p-5">
                <p className="text-sm text-muted">
                  Ownership registered under a company. Please provide the company
                  details during verification.
                </p>
              </div>
            )}

            {form.ownershipType === "trust" && (
              <div className="rounded-xl border border-border bg-secondary p-5">
                <p className="text-sm text-muted">
                  Ownership registered under a trust or similar entity. Please
                  provide the relevant registration details during verification.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <LandForm />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <Button variant="ghost" onClick={back} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step === 3 ? (
          <Button onClick={handleFinish}>Go to Dashboard</Button>
        ) : step === 0 ? (
          <Button onClick={handleNextFromPersonal} className="gap-1.5">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : step === 1 ? (
          <Button onClick={handleNextFromIdentity} loading={profileLoading} className="gap-1.5">
            Save &amp; Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => setStep(3)} className="gap-1.5">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BadgePill({ label, value }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-xs text-muted">{label}:</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        {value}
      </span>
    </div>
  );
}
