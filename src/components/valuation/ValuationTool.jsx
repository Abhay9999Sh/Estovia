"use client";

/**
 * The valuation tool.
 *
 * Shared by every role's page. Three presentation rules this component follows
 * without exception, because they are the difference between an honest estimate
 * and a convincing one:
 *
 *  1. The band is always shown, never hidden behind a tooltip. It is wide
 *     because the model's measured error is wide, and a single number without it
 *     would misrepresent what we know.
 *  2. Wherever a number appears we can also show the model's own measured
 *     accuracy, so the user can judge the number rather than trust it.
 *  3. The target is described as an asking price, and the user's own asking
 *     price is shown as a separate thing to compare against, never merged in.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Database,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { formatINR, formatDate } from "@/lib/format";

const CATEGORIES = [
  { value: "apartment", label: "Apartment / Flat" },
  { value: "independent_house", label: "Independent House" },
  { value: "villa", label: "Villa" },
  { value: "land_residential", label: "Residential Land (not supported yet)" },
  { value: "land_agricultural", label: "Agricultural Land (not supported yet)" },
  { value: "land_commercial", label: "Commercial Land (not supported yet)" },
  { value: "commercial_unit", label: "Commercial Unit (not supported yet)" },
];

const AREA_UNITS = [
  { value: "sqft", label: "sq ft" },
  { value: "sqm", label: "sq m" },
  { value: "sqyd", label: "sq yd" },
  { value: "acre", label: "acre" },
  { value: "hectare", label: "hectare" },
  { value: "marla", label: "marla" },
  { value: "bigha_haryana", label: "bigha (Haryana)" },
  { value: "bigha_up", label: "bigha (Uttar Pradesh)" },
  { value: "biswa_haryana", label: "biswa (Haryana)" },
  { value: "biswa_up", label: "biswa (Uttar Pradesh)" },
  { value: "guntha", label: "guntha" },
];

const FACING = [
  { value: "north", label: "North" },
  { value: "north_east", label: "North East" },
  { value: "east", label: "East" },
  { value: "south_east", label: "South East" },
  { value: "south", label: "South" },
  { value: "south_west", label: "South West" },
  { value: "west", label: "West" },
  { value: "north_west", label: "North West" },
];

const FURNISHING = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
];

const TRANSACTION = [
  { value: "new_property", label: "New construction" },
  { value: "resale", label: "Resale" },
];

const OWNERSHIP = [
  { value: "freehold", label: "Freehold" },
  { value: "leasehold", label: "Leasehold" },
  { value: "society", label: "Society-owned" },
];

const EMPTY = {
  propertyCategory: "apartment",
  city: "",
  locality: "",
  areaSqFt: "",
  areaUnit: "sqft",
  bedrooms: "",
  bathrooms: "",
  balconies: "",
  floorNumber: "",
  totalFloors: "",
  propertyAgeYears: "",
  liftAvailable: "",
  parkingCount: "",
  furnishing: "",
  facing: "",
  ownership: "",
  transactionType: "",
  areaDefinition: "built_up",
  askingPriceInr: "",
};

const COVERAGE_TONE = {
  sufficient: "success",
  limited: "warning",
  low: "danger",
  out_of_distribution: "danger",
  unsupported: "muted",
};

const STATUS_TONE = {
  ok: "success",
  unsupported_location: "warning",
  unsupported_category: "warning",
  no_model_for_segment: "danger",
  insufficient_data: "warning",
  out_of_distribution: "warning",
  invalid_input: "danger",
};

function DirectionIcon({ direction }) {
  if (direction === "increase") return <TrendingUp className="h-3.5 w-3.5" />;
  if (direction === "decrease") return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

export default function ValuationTool({ requestContext = "standalone_estimate" }) {
  const [form, setForm] = useState(EMPTY);
  const [model, setModel] = useState(null);
  const [localities, setLocalities] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingModel, setLoadingModel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const aboutRef = useRef(null);

  /**
   * Opens the technical section and brings it into view. A plain #anchor link
   * would scroll to a collapsed <details> and show nothing, which reads as a
   * broken link.
   */
  const openAbout = useCallback(() => {
    const el = aboutRef.current;
    if (!el) return;
    if (el.open === false) el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cities = useMemo(
    () => (model ? model.supportedCities || [] : []),
    [model]
  );

  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/valuation/model", { cache: "no-store" });
        if (!res.ok) throw new Error("model");
        const data = await res.json();
        if (!active) return;
        setModel(data.model);
        // Default to a city the model actually covers instead of an empty select.
        const firstCity = (data.model.supportedCities || [])[0] || "";
        setForm((prev) => (prev.city ? prev : { ...prev, city: firstCity }));
      } catch {
        if (active) setError("The valuation model could not be loaded.");
      } finally {
        if (active) setLoadingModel(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Changing city invalidates the locality: it belongs to the old city, and the
  // autocomplete list is per-city. Resetting here rather than inside the effect
  // keeps the effect purely about fetching.
  const setCity = useCallback((value) => {
    setForm((prev) => ({ ...prev, city: value, locality: "" }));
    setLocalities([]);
  }, []);

  // Locality spellings come from the comparable index, which uses the exact
  // strings the model was trained on. Picking from this list is what makes the
  // locality price level hit instead of silently falling back to the city median.
  useEffect(() => {
    if (!form.city) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch(
          `/api/valuation/localities?city=${encodeURIComponent(form.city)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (active) setLocalities(data.localities || []);
      } catch {
        if (active) setLocalities([]);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [form.city]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/valuation/history?limit=5", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setHistory(data.valuations || []);
      } catch {
        if (active) setHistory([]);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/valuation/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestContext,
          askingPriceInr: form.askingPriceInr || null,
          askingPriceType: form.askingPriceInr ? "asking_price" : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "The valuation could not be completed.");
        return;
      }
      setResult(data.valuation);
      // Refresh the recent list so a new estimate shows up immediately.
      try {
        const res = await fetch("/api/valuation/history?limit=5", { cache: "no-store" });
        if (res.ok) {
          const data2 = await res.json();
          setHistory(data2.valuations || []);
        }
      } catch {
        /* the estimate is already shown; history is secondary */
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingModel) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const v = result;
  const unsupported = v && v.status !== "ok";

  return (
    <div className="space-y-6">
      <WhatThisDoes />

      <form onSubmit={onSubmit} className="space-y-6">
        <Panel title="Property details" subtitle="Only the address fields and area are required.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              id="propertyCategory"
              label="Property type"
              required
              value={form.propertyCategory}
              onChange={(e) => set("propertyCategory", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>

            <Select
              id="city"
              label="City"
              required
              value={form.city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Select a city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <div className="w-full">
              <label htmlFor="locality" className="mb-1.5 block text-sm font-medium text-foreground">
                Locality
              </label>
              <input
                id="locality"
                list="valuation-localities"
                value={form.locality}
                onChange={(e) => set("locality", e.target.value)}
                placeholder="Start typing, then pick from the list"
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <datalist id="valuation-localities">
                {localities.map((l) => (
                  <option key={l.locality} value={l.locality}>
                    {l.n} listings
                  </option>
                ))}
              </datalist>
              <p className="mt-1.5 text-xs text-muted">
                {localities.length
                  ? `${localities.length} localities with real listings in ${form.city}.`
                  : "Pick a city to see the localities the model has data for."}
              </p>
            </div>

            <Input
              id="areaSqFt"
              label="Area"
              required
              type="number"
              min="1"
              step="any"
              value={form.areaSqFt}
              onChange={(e) => set("areaSqFt", e.target.value)}
              placeholder="e.g. 1450"
            />

            <Select
              id="areaUnit"
              label="Area unit"
              value={form.areaUnit}
              onChange={(e) => set("areaUnit", e.target.value)}
            >
              {AREA_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>

            <Select
              id="areaDefinition"
              label="Area means"
              value={form.areaDefinition}
              onChange={(e) => set("areaDefinition", e.target.value)}
              hint="Which area the number represents"
            >
              <option value="built_up">Built-up area</option>
              <option value="carpet">Carpet area</option>
              <option value="plot">Plot area</option>
              <option value="total">Total area</option>
            </Select>

            <Input
              id="bedrooms"
              label="Bedrooms"
              type="number"
              min="0"
              max="20"
              value={form.bedrooms}
              onChange={(e) => set("bedrooms", e.target.value)}
            />
            <Input
              id="bathrooms"
              label="Bathrooms"
              type="number"
              min="0"
              max="20"
              value={form.bathrooms}
              onChange={(e) => set("bathrooms", e.target.value)}
            />
            <Input
              id="balconies"
              label="Balconies"
              type="number"
              min="0"
              max="10"
              value={form.balconies}
              onChange={(e) => set("balconies", e.target.value)}
            />
            <Input
              id="floorNumber"
              label="Floor"
              type="number"
              value={form.floorNumber}
              onChange={(e) => set("floorNumber", e.target.value)}
            />
            <Input
              id="totalFloors"
              label="Total floors"
              type="number"
              min="1"
              value={form.totalFloors}
              onChange={(e) => set("totalFloors", e.target.value)}
            />
            <Input
              id="propertyAgeYears"
              label="Property age (years)"
              type="number"
              min="0"
              step="any"
              value={form.propertyAgeYears}
              onChange={(e) => set("propertyAgeYears", e.target.value)}
            />
            <Select
              id="liftAvailable"
              label="Lift"
              value={form.liftAvailable}
              onChange={(e) => set("liftAvailable", e.target.value)}
            >
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
            <Input
              id="parkingCount"
              label="Parking spaces"
              type="number"
              min="0"
              value={form.parkingCount}
              onChange={(e) => set("parkingCount", e.target.value)}
            />
            <Select
              id="furnishing"
              label="Furnishing"
              value={form.furnishing}
              onChange={(e) => set("furnishing", e.target.value)}
            >
              <option value="">Not sure</option>
              {FURNISHING.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <Select
              id="facing"
              label="Facing"
              value={form.facing}
              onChange={(e) => set("facing", e.target.value)}
            >
              <option value="">Not sure</option>
              {FACING.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <Select
              id="transactionType"
              label="New or resale"
              value={form.transactionType}
              onChange={(e) => set("transactionType", e.target.value)}
            >
              <option value="">Not sure</option>
              {TRANSACTION.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <Select
              id="ownership"
              label="Ownership"
              value={form.ownership}
              onChange={(e) => set("ownership", e.target.value)}
            >
              <option value="">Not sure</option>
              {OWNERSHIP.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </Panel>

        <Panel
          title="Compare against your own price"
          subtitle="Optional. Kept separate from the estimate so the two are never confused."
        >
          <div className="max-w-xs">
            <Input
              id="askingPriceInr"
              label="Your asking price (INR)"
              type="number"
              min="0"
              value={form.askingPriceInr}
              onChange={(e) => set("askingPriceInr", e.target.value)}
              placeholder="e.g. 9500000"
            />
          </div>
        </Panel>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" loading={submitting} fullWidth>
          {submitting ? "Valuing" : "Value this property"}
        </Button>
      </form>

      {v && unsupported && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={STATUS_TONE[v.status] || "muted"}>{v.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-sm text-amber-900">{v.message}</p>
        </div>
      )}

      {v && v.status === "ok" && <Result valuation={v} onOpenAbout={openAbout} />}

      {history.length > 0 && <HistoryPanel items={history} onPick={(row) => setForm((p) => ({ ...p, city: row.city, locality: row.locality, areaSqFt: String(row.areaSqFt ?? ""), areaUnit: "sqft", propertyCategory: row.propertyCategory || p.propertyCategory }))} />}

      <AboutModel model={model} detailsRef={aboutRef} />
    </div>
  );
}

/**
 * The two sentences a normal user needs before they read any number.
 *
 * Deliberately free of ML vocabulary. The full technical picture lives in
 * <AboutModel> at the bottom of the page.
 */
function WhatThisDoes() {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">What this does</h2>
      <div className="mt-2 space-y-1.5 text-sm text-muted">
        <p>
          We compare your property&apos;s details with thousands of real property listings and
          use a trained machine-learning model to estimate what a similar property is
          currently being advertised for.
        </p>
        <p>
          This is an estimated <strong className="text-foreground">asking price</strong>, not
          the actual selling price. Listings rarely sell for the number they are advertised
          at.
        </p>
      </div>
    </section>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const COVERAGE_SENTENCE = {
  sufficient:
    "We found a lot of real listings very similar to yours, so this estimate is well supported.",
  limited:
    "We found some similar listings, but not a lot. Treat this as a starting point, not a valuation.",
  low:
    "We found very few listings like yours, so the single number is weak here. Trust the range and the listings more than the figure.",
  out_of_distribution:
    "Your property looks quite different from anything in our training data, so this estimate is unreliable.",
};

const TIER_SENTENCE = {
  locality: "in the same locality",
  city: "in the same city, other localities",
  none: "in the same city",
};

function tierSentence(tier) {
  return TIER_SENTENCE[tier] || "in the same city";
}

/**
 * Technical transparency, kept available but out of the way.
 *
 * Every row states the plain-language meaning first and puts the raw metric in
 * brackets, so a reader who only wants to know "can I rely on this?" never has to
 * decode a percentage, while someone auditing the model still gets the exact
 * verified number.
 */
function AboutModel({ model, detailsRef }) {
  if (!model) return null;
  const m = model.metrics || {};
  const split = model.split || {};
  const obs = model.observations || {};
  const interval = model.interval || {};
  const temporal = split.temporal_validation || {};
  const pct = (v, dp = 1) => (v == null ? "-" : `${Number(v).toFixed(dp)}%`);
  const inr = (v) => (v == null ? "-" : formatINR(v));

  return (
    <section
      id="valuation-about-model"
      className="scroll-mt-24 rounded-2xl border border-border bg-white shadow-sm"
    >
      <details ref={detailsRef} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-muted" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                How accurate is the model?
              </h2>
              <p className="text-xs text-muted">
                Test results, training data, and what this model cannot do
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-6 border-t border-border px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              {model.metricsProvenance === "verified-replay-of-exported-artefact"
                ? "Verified by replaying the saved model"
                : model.metricsProvenance}
            </Badge>
            <span className="text-xs text-muted">
              {model.modelId} &middot; trained {formatDate(model.trainedAt)} &middot;{" "}
              {model.featureNames.length} inputs
            </span>
          </div>

          <div>
            <SectionHead icon={Target} title="Accuracy on listings it had never seen" />
            <div className="space-y-2">
              <AboutRow
                label="How many properties was it tested on"
                plain="These listings were deliberately held back during training, and the model had never seen them before."
                value={`${m.n?.toLocaleString("en-IN") ?? "-"} listings`}
                hint="Faridabad and Greater Noida only"
              />
              <AboutRow
                label="Typical mistake it makes"
                plain="Half of the test properties were estimated with an error smaller than this."
                value={pct(m.median_ape_pct)}
                hint={`median absolute percentage error (MAPE) = ${m.mape_pct?.toFixed(1)}%`}
              />
              <AboutRow
                label="Average mistake it makes"
                plain="On average, its error is about this share of the property's price."
                value={pct(m.wape_pct)}
                hint={`WAPE = ${m.wape_pct?.toFixed(2)}%`}
              />
              <AboutRow
                label="Average amount it gets wrong"
                plain="The average gap between its estimate and the real asking price, in rupees."
                value={inr(m.mae)}
                hint={`MAE = ${formatINR(m.mae)}; RMSE = ${formatINR(m.rmse)}`}
              />
              <AboutRow
                label="How close its estimate is overall"
                plain="How much of the variation in real prices the model explains. 1 would be perfect; 0 would be no better than a flat average."
                value={m.r2?.toFixed(2) ?? "-"}
                hint={`R² = ${m.r2}`}
              />
              <AboutRow
                label="How often the real price landed inside the range"
                plain="When we drew a range around each test estimate, this is how often the real asking price fell inside it. Higher is better."
                value={pct(m.interval_coverage_pct)}
                hint={`against a ${((1 - (interval.alpha ?? 0.1)) * 100).toFixed(0)}% target band`}
              />
            </div>
          </div>

          <div>
            <SectionHead icon={Database} title="Training data" />
            <div className="space-y-2">
              <AboutRow
                label="How much data it learned from"
                plain="The listings used to train the model, split into a learning set, a set used to size the range, and a final set kept back for testing."
                value={`${obs.total?.toLocaleString("en-IN") ?? "-"} listings`}
                hint={`learned on ${obs.train?.toLocaleString("en-IN")}, sized the range on ${obs.calibration?.toLocaleString("en-IN")}, tested on ${obs.test?.toLocaleString("en-IN")}`}
              />
              <AboutRow
                label="Where the properties are"
                plain="The model only knows these cities and their localities. Anything outside them is refused rather than guessed."
                value={(model.geography?.cities || []).join(", ")}
                hint={model.geography?.note}
              />
              <AboutRow
                label="What it can price"
                plain="Built-up homes only. It has no model for land or commercial property."
                value={(model.supportedCategories || []).join(", ")}
                hint={`not covered: ${(model.categoriesNotCovered || []).join(", ")}`}
              />
            </div>
          </div>

          <div>
            <SectionHead icon={Info} title="What the numbers mean and what they don't" />
            <ul className="space-y-2.5">
              <PlainLi>
                <strong className="text-foreground">It predicts asking price, not sale price.</strong>{" "}
                {model.targetSemantics}
              </PlainLi>
              <PlainLi>
                <strong className="text-foreground">The range is wide because the model&apos;s real error is wide.</strong>{" "}
                It is sized from {interval.nCalibration?.toLocaleString("en-IN")} held-out listings so
                that roughly {((1 - (interval.alpha ?? 0.1)) * 100).toFixed(0)}% of similar properties
                fall inside it. The measured rate on the test set was{" "}
                {pct(m.interval_coverage_pct)}.
              </PlainLi>
              <PlainLi>
                <strong className="text-foreground">No geospatial data was used.</strong> Distance to
                a metro station, hospital, school or park is not part of this estimate, because none of
                the listings this model learned from had usable location data attached to them.
              </PlainLi>
              <PlainLi>
                <strong className="text-foreground">It cannot tell you whether now is a good time to buy.</strong>{" "}
                It has no view on market timing, future price movement, or negotiation.
              </PlainLi>
              <PlainLi>
                <strong className="text-foreground">There is no time-based test.</strong>{" "}
                {temporal.status === "unavailable"
                  ? temporal.reason
                  : `${split.test_description || "See the split description below"}.`}
              </PlainLi>
              <PlainLi>
                <strong className="text-foreground">Land and commercial property are not supported.</strong>{" "}
                Segments seen in the data but never trained on:{" "}
                {(model.segmentsNotTrained || []).join(", ") || "none"}.
              </PlainLi>
            </ul>
          </div>

          <div>
            <SectionHead icon={Info} title="How it was tested" />
            <div className="space-y-2">
              <AboutRow
                label="How the data was split"
                plain="Whole cities were held back entirely, so the test measures how the model behaves somewhere it has genuinely never been."
                value={split.kind || "-"}
                hint={split.test_description}
              />
              <AboutRow
                label="What it beat"
                plain="A much simpler method: multiply the area by the average price per sq ft in that locality. The model had to earn its complexity."
                value={model.beatsBaseline ? "Yes, on every metric" : "No"}
                hint={`baseline median error ${pct(model.baselineMetrics?.median_ape_pct)} vs model ${pct(m.median_ape_pct)}`}
              />
            </div>
            {split.train_description && (
              <p className="mt-2 text-xs text-muted">
                Learning set: {split.train_description}
              </p>
            )}
          </div>

          {model.importance?.length > 0 && (
            <div>
              <SectionHead icon={Info} title="What the model leans on most" />
              <p className="mb-2 text-xs text-muted">
                How often each input was used to split the data during training. Higher means the
                model relied on it more.
              </p>
              <div className="space-y-1.5">
                {model.importance.map((row) => (
                  <div key={row.key} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-xs text-foreground">
                      {row.label}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-accent/60"
                        style={{ width: `${Math.min(100, (row.splitPct / 25) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs text-muted">
                      {row.splitPct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function SectionHead({ icon: Icon, title }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted" /> : null}
      {title}
    </h3>
  );
}

/** Plain sentence first, raw metric in brackets. */
function AboutRow({ label, plain, value, hint }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{plain}</p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">({hint})</p>}
    </div>
  );
}

function PlainLi({ children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function Result({ valuation: v, onOpenAbout }) {
  const r = v.result;
  const c = v.coverage;
  const a = v.askComparison;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <p className="text-sm text-muted">Estimated asking price</p>
        <p className="mt-1 text-4xl font-bold text-foreground">{formatINR(r.valueInr)}</p>
        <p className="mt-1 text-sm text-muted">
          About {formatINR(r.pricePerSqFt, { maxFraction: 0 })} per sq ft
        </p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Reasonable estimated range:{" "}
            <strong className="text-foreground">
              {formatINR(r.lowInr)} &ndash; {formatINR(r.highInr)}
            </strong>
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Similar properties are normally priced somewhere in this range. It is wide because
            the model&apos;s real error is wide, so the range is more useful than the single
            number above.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
          <p className="text-sm text-foreground">
            Based on{" "}
            <strong>
              {c.comparableCount} real listings {tierSentence(v.explainability.comparablesTier)}
            </strong>
          </p>
          {c.localityObservations > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              The model also learned the general price level of this locality from{" "}
              {c.localityObservations} listings in its training data.
            </p>
          )}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={COVERAGE_TONE[c.coverageLevel] || "muted"}>
              {c.coverageLevel === "sufficient" || c.coverageLevel === "limited" || c.coverageLevel === "low"
                ? `${c.coverageLabel}`
                : c.coverageLabel}
            </Badge>
            <p className="text-sm text-muted">
              {COVERAGE_SENTENCE[c.coverageLevel] ||
                "How much we can back this estimate up with real listings."}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAbout}
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <BookOpen className="h-3 w-3" />
            How accurate is the model? See its measured test results
          </button>
        </div>

        {a.askingPriceInr != null && a.differenceInr != null && (
          <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
            <p className="text-sm text-foreground">
              Your asking price of {formatINR(a.askingPriceInr)} is{" "}
              <strong>
                {a.differencePct > 0 ? `${a.differencePct}% above` : `${Math.abs(a.differencePct)}% below`}
              </strong>{" "}
              this estimate ({formatINR(Math.abs(a.differenceInr))}).
            </p>
            <p className="mt-1 text-xs text-muted">
              {a.comparisonBasis}. A gap is a prompt to check the details, not proof that
              either number is right.
            </p>
          </div>
        )}
      </div>

      {c.coverageReasons?.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">
            Why to be careful with this number
          </h3>
          <ul className="mt-3 space-y-2">
            {c.coverageReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.explainability.factors?.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">
            What moved this estimate
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Each row shows what happens to the estimate if that input is moved to the
            training-average value. These do not add up to the total, and they are not
            causal effects.
          </p>
          <div className="mt-4 space-y-2">
            {v.explainability.factors.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span
                    className={
                      f.direction === "increase"
                        ? "text-green-600"
                        : f.direction === "decrease"
                          ? "text-red-600"
                          : "text-muted"
                    }
                  >
                    <DirectionIcon direction={f.direction} />
                  </span>
                  {f.label}
                </span>
                <span className="text-xs text-muted">
                  {f.display} &middot;{" "}
                  <span
                    className={
                      f.direction === "increase"
                        ? "text-green-600"
                        : f.direction === "decrease"
                          ? "text-red-600"
                          : ""
                    }
                  >
                    {f.contributionPct > 0 ? "+" : ""}
                    {f.contributionPct}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.explainability.comparables?.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Real listings it compared against
            </h3>
            <Badge tone="muted">
              {v.explainability.comparablesTier === "locality"
                ? "Same locality"
                : v.explainability.comparablesTier === "city"
                  ? "Same city, other locality"
                  : "City level"}
            </Badge>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-medium">Locality</th>
                  <th className="py-2 pr-4 font-medium">Area</th>
                  <th className="py-2 pr-4 font-medium">Beds</th>
                  <th className="py-2 pr-4 font-medium">Asking price</th>
                  <th className="py-2 font-medium">Per sq ft</th>
                </tr>
              </thead>
              <tbody>
                {v.explainability.comparables.map((s, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted" />
                        {s.locality}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted">{s.areaSqFt} sq ft</td>
                    <td className="py-2 pr-4 text-muted">{s.bedrooms ?? "-"}</td>
                    <td className="py-2 pr-4 text-foreground">{formatINR(s.priceInr)}</td>
                    <td className="py-2 text-muted">{formatINR(s.pricePerSqFt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            All of these are advertised asking prices from public listing datasets, not
            registered sales. Sources are named per row in the saved record.
          </p>
        </div>
      )}
    </section>
  );
}

function HistoryPanel({ items, onPick }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">Your recent valuations</h3>
      <div className="mt-3 space-y-2">
        {items.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onPick(row)}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-left transition-colors hover:bg-border/40"
          >
            <span className="text-sm text-foreground">
              {row.locality || row.city} &middot; {row.areaSqFt} sq ft
              {row.bedrooms ? ` · ${row.bedrooms} BHK` : ""}
            </span>
            <span className="flex items-center gap-2 text-sm text-muted">
              <RefreshCw className="h-3 w-3" />
              {row.valueInr != null ? formatINR(row.valueInr) : "no estimate"}
              <span className="text-xs">{formatDate(row.valuationDate)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
