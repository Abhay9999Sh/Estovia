"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  BadgeCheck,
  MapPin,
  FileText,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Stepper from "@/components/ui/Stepper";
import MoneyInput from "@/components/ui/MoneyInput";
import MapPicker from "@/components/maps/MapPicker";
import LiveMap from "@/components/maps/LiveMap";
import DocumentUploader from "@/components/verification/DocumentUploader";
import ImageUploader from "@/components/ui/ImageUploader";
import { formatArea, formatINR } from "@/lib/demoData";

const PROPERTY_TYPES = [
  { value: "land", label: "Land" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
  { value: "project", label: "Project" },
];

const LAND_USES = [
  { value: "agricultural", label: "Agricultural" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "mixed", label: "Mixed Use" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "institutional", label: "Institutional" },
];

const AREA_UNITS = [
  { value: "sqft", label: "Square Feet (sq.ft)" },
  { value: "sqm", label: "Square Meters (sq.m)" },
  { value: "acre", label: "Acres" },
  { value: "hectare", label: "Hectares" },
  { value: "gunta", label: "Guntas" },
  { value: "bigha", label: "Bigha" },
  { value: "marla", label: "Marla" },
];

const PRICE_TYPES = [
  { value: "total", label: "Total Price" },
  { value: "per_sqft", label: "Price per sq.ft" },
  { value: "per_acre", label: "Price per acre" },
  { value: "negotiable", label: "Negotiable" },
];

const STEPS = ["Basic", "Location", "Pricing", "Documents", "Preview"];
const STEP_LABELS = ["Basic Details", "Location", "Pricing", "Documents", "Preview"];
const MAX_IMAGES = 10;

const emptyForm = {
  title: "",
  description: "",
  propertyType: "land",
  landUse: "agricultural",
  area: { value: "", unit: "sqft" },
  location: {
    address: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    tehsil: "",
    village: "",
    latitude: null,
    longitude: null,
    boundary: null,
  },
  pricing: { amount: "", type: "total", negotiable: false },
  surveyNumber: "",
  khasraNumber: "",
  images: [],
};

export default function LandForm({ initialData, listingId, editing = false }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialData || emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pendingDocs, setPendingDocs] = useState([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialData) setForm(initialData);
  }, [initialData]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function updateLocation(patch) {
    setForm((f) => ({ ...f, location: { ...f.location, ...patch } }));
  }

  function updateArea(patch) {
    setForm((f) => ({ ...f, area: { ...f.area, ...patch } }));
  }

  function updatePricing(patch) {
    setForm((f) => ({ ...f, pricing: { ...f.pricing, ...patch } }));
  }

  function validateStep(s) {
    const e = {};
    if (s === 0) {
      if (!form.title.trim()) e.title = "Please provide a title.";
      if (!form.area.value || Number(form.area.value) <= 0)
        e.area = "Please provide a valid area.";
    }
    if (s === 1) {
      if (form.location.latitude == null || form.location.longitude == null)
        e.location = "Please select the location on the map.";
      if (!form.location.address) e.location = "Please select the location on the map.";
      if (!form.location.city) e.city = "Please provide the city.";
      if (!form.location.state) e.state = "Please provide the state.";
    }
    if (s === 2) {
      if (form.pricing.type === "total" || form.pricing.type === "per_sqft" || form.pricing.type === "per_acre") {
        if (!form.pricing.amount || Number(form.pricing.amount) <= 0)
          e.amount = "Please provide a valid expected price.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    setSubmitError("");
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
    setSubmitError("");
  }

  async function submitForReview() {
    setSaving(true);
    setSubmitError("");
    // validate all steps
    for (let s = 0; s < 3; s++) {
      if (!validateStep(s)) {
        setStep(s);
        setSaving(false);
        return;
      }
    }

    const payload = normalizePayload();
    if (documentCount === 0) {
      setSubmitError("Please upload at least one ownership document before submitting.");
      setStep(3);
      setSaving(false);
      return;
    }
    payload.submit = true;

    try {
      await saveListing(payload);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Unable to save land listing.");
      setSaving(false);
    }
  }

  async function saveDraft() {
    setSavingDraft(true);
    setSubmitError("");
    const payload = normalizePayload();
    payload.submit = false;
    try {
      await saveListing(payload);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Unable to save land listing.");
      setSavingDraft(false);
    }
  }

  async function saveListing(payload) {
    const isNew = !(editing && listingId);
    const url = isNew
      ? "/api/landowner/land"
      : `/api/landowner/land/${listingId}`;
    const method = isNew ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");

    // For brand-new listings, staged documents must be persisted after the
    // listing record exists.
    if (isNew && pendingDocs.length > 0) {
      const newListingId = data.listing?._id;
      if (newListingId) {
        await attachPendingDocs(newListingId);
      }
    }
    return data;
  }

  async function attachPendingDocs(listingId) {
    const byType = {};
    for (const d of pendingDocs) {
      const t = d.type || "other";
      (byType[t] = byType[t] || []).push(d);
    }
    for (const [t, docs] of Object.entries(byType)) {
      const res = await fetch(`/api/landowner/land/${listingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: t, documents: docs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save documents.");
    }
    setPendingDocs([]);
  }

  function normalizePayload() {
    return {
      title: form.title,
      description: form.description,
      propertyType: form.propertyType,
      landUse: form.landUse,
      area: {
        value: Number(form.area.value) || 0,
        unit: form.area.unit,
      },
      location: {
        address: form.location.address,
        city: form.location.city,
        district: form.location.district,
        state: form.location.state,
        pincode: form.location.pincode,
        tehsil: form.location.tehsil,
        village: form.location.village,
        latitude: form.location.latitude,
        longitude: form.location.longitude,
      },
      boundary: form.location.boundary || { type: "Polygon", coordinates: [] },
      pricing: {
        amount: Number(form.pricing.amount) || 0,
        type: form.pricing.type,
        negotiable: !!form.pricing.negotiable,
      },
      surveyNumber: form.surveyNumber,
      khasraNumber: form.khasraNumber,
      images: form.images,
    };
  }

  const documentCount = form._documentCount || 0;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
        <h2 className="mt-5 text-2xl font-extrabold text-foreground">
          {editing ? "Listing updated successfully" : "Land submitted successfully"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Your listing has been {editing ? "updated" : "created"} and is now{" "}
          {!editing && "pending verification. Our team will review your documents."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => router.push("/landowner/dashboard")}>
            Go to Dashboard
          </Button>
          <Button variant="outline" onClick={() => router.push("/landowner/land")}>
            View My Land
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Stepper steps={STEPS} labels={STEP_LABELS} current={step} />

      {submitError && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      <div className="mt-8">
        {/* STEP 0 - Basic */}
        {step === 0 && (
          <div className="space-y-5">
            <Input
              label="Land Title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Premium Development Land"
              required
              error={errors.title}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the land, its features, access, development potential..."
                rows={4}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Property Type"
                value={form.propertyType}
                onChange={(e) => update("propertyType", e.target.value)}
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </Select>
              <Select
                label="Land Use"
                value={form.landUse}
                onChange={(e) => update("landUse", e.target.value)}
              >
                {LAND_USES.map((lu) => (
                  <option key={lu.value} value={lu.value}>{lu.label}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
              <Input
                label="Area"
                type="number"
                min="0"
                value={form.area.value}
                onChange={(e) => updateArea({ value: e.target.value })}
                placeholder="e.g. 12000"
                required
                error={errors.area}
              />
              <div className="sm:w-56">
                <Select
                  label="Area Unit"
                  value={form.area.unit}
                  onChange={(e) => updateArea({ unit: e.target.value })}
                >
                  {AREA_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Survey Number"
                value={form.surveyNumber}
                onChange={(e) => update("surveyNumber", e.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Khasra Number"
                value={form.khasraNumber}
                onChange={(e) => update("khasraNumber", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        )}

        {/* STEP 1 - Location */}
        {step === 1 && (
          <div>
            {errors.location && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {errors.location}
              </div>
            )}
            <MapPicker
              value={form.location}
              onChange={updateLocation}
              enableBoundary
            />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input
                label="City"
                value={form.location.city}
                onChange={(e) => updateLocation({ city: e.target.value })}
                required
                error={errors.city}
              />
              <Input
                label="State"
                value={form.location.state}
                onChange={(e) => updateLocation({ state: e.target.value })}
                required
                error={errors.state}
              />
              <Input
                label="District"
                value={form.location.district}
                onChange={(e) => updateLocation({ district: e.target.value })}
              />
              <Input
                label="Pincode"
                value={form.location.pincode}
                onChange={(e) => updateLocation({ pincode: e.target.value })}
                maxLength={6}
              />
              <Input
                label="Tehsil"
                value={form.location.tehsil}
                onChange={(e) => updateLocation({ tehsil: e.target.value })}
              />
              <Input
                label="Village"
                value={form.location.village}
                onChange={(e) => updateLocation({ village: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* STEP 2 - Pricing */}
        {step === 2 && (
          <div className="max-w-xl space-y-5">
            <Select
              label="Price Type"
              value={form.pricing.type}
              onChange={(e) => updatePricing({ type: e.target.value })}
            >
              {PRICE_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </Select>

            {form.pricing.type !== "negotiable" && (
              <MoneyInput
                label="Expected Price"
                value={form.pricing.amount}
                onChange={(rupees) => updatePricing({ amount: rupees })}
                error={errors.amount}
                hint={
                  form.pricing.amount > 0
                    ? `Displayed as ${formatINR(Number(form.pricing.amount))}${
                        form.pricing.type === "per_sqft"
                          ? " / sq.ft"
                          : form.pricing.type === "per_acre"
                          ? " / acre"
                          : ""
                      }`
                    : undefined
                }
              />
            )}

            {form.pricing.type === "negotiable" && (
              <p className="rounded-xl border border-accent-light bg-accent-light/40 px-4 py-3 text-sm text-foreground">
                Price is marked as negotiable. Buyers and builders will be able
                to reach out to discuss.
              </p>
            )}

            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={!!form.pricing.negotiable}
                onChange={(e) => updatePricing({ negotiable: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-foreground">Price is negotiable</span>
            </label>

            {form.pricing.amount > 0 && (
              <div className="rounded-xl bg-secondary px-4 py-3">
                <p className="text-sm text-muted">
                  Displayed as <span className="font-semibold text-foreground">{formatINR(Number(form.pricing.amount))}</span>
                  {form.pricing.type === "per_sqft" ? " per sq.ft" : ""}
                  {form.pricing.type === "per_acre" ? " per acre" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 - Documents */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-foreground">Listing Photos</h3>
              <p className="mt-1 text-sm text-muted">
                Add up to {MAX_IMAGES} photos of the land. These will be shown on
                your listing.
              </p>
              <div className="mt-4">
                <ImageUploader
                  value={form.images || []}
                  onChange={(images) => update("images", images)}
                  folder="listings"
                  max={MAX_IMAGES}
                  label="Land Photos"
                />
              </div>
            </div>

            <div>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-foreground">Ownership Documents</h3>
                <p className="mt-1 text-sm text-muted">
                  Upload supporting documents, photos or short videos to verify
                  ownership. You can upload several files at once — videos up to
                  30 MB and images/documents up to 10 MB each. Documents are
                  reviewed by our team — uploading them does not automatically
                  mark your land as verified.
                </p>
              </div>
              <DocumentUploader
                landId={listingId}
                onCountChange={(count) => update("_documentCount", count)}
                onPendingDocs={setPendingDocs}
              />
            </div>
          </div>
        )}

        {/* STEP 4 - Preview */}
        {step === 4 && (
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="relative h-56 bg-primary">
              {form.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.images[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-12 w-12 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <h3 className="text-2xl font-extrabold">{form.title || "Untitled Land"}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <MapPin className="h-4 w-4" />
                  {form.location.address ||
                    `${form.location.city}${form.location.state ? ", " + form.location.state : ""}` ||
                    "Location not set"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted">Area</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {form.area.value ? `${form.area.value} ${form.area.unit}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Price</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {form.pricing.type === "negotiable"
                    ? "Negotiable"
                    : formatINR(Number(form.pricing.amount) || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Property Type</p>
                <p className="mt-1 text-lg font-bold capitalize text-foreground">
                  {form.propertyType} · {form.landUse.replace("_", " ")}
                </p>
              </div>
            </div>

            {form.description && (
              <div className="border-t border-border p-6">
                <p className="text-sm text-foreground">{form.description}</p>
              </div>
            )}

            {(form.location.latitude != null || form.location.boundary?.coordinates?.length) && (
              <div className="border-t border-border p-6">
                <p className="mb-3 text-sm font-semibold text-foreground">Location Map</p>
                <LiveMap
                  latitude={form.location.latitude}
                  longitude={form.location.longitude}
                  boundary={form.location.boundary}
                />
              </div>
            )}

            <div className="grid gap-6 border-t border-border p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted">Survey Number</p>
                <p className="mt-1 text-sm text-foreground">{form.surveyNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Khasra Number</p>
                <p className="mt-1 text-sm text-foreground">{form.khasraNumber || "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary px-6 py-4">
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <FileText className="h-4 w-4" />
                {documentCount} document{documentCount === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-warning">
                <BadgeCheck className="h-4 w-4" />
                Verification: Pending Review
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <Button
          variant="ghost"
          onClick={back}
          disabled={step === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 0 ? "Back" : "Previous"}
        </Button>

        <div className="flex gap-3">
          {step === 4 ? (
            <>
              <Button
                variant="outline"
                onClick={saveDraft}
                loading={savingDraft}
                disabled={saving}
              >
                Save Draft
              </Button>
              <Button onClick={submitForReview} loading={saving} disabled={savingDraft}>
                Submit for Verification
              </Button>
            </>
          ) : (
            <Button onClick={next} className="gap-1.5">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
