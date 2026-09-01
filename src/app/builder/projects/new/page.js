"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, FolderKanban } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import MoneyInput from "@/components/ui/MoneyInput";
import Skeleton from "@/components/ui/Skeleton";

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Mixed Use", "Plotted Development", "Township", "Other"];
const PROJECT_STATUSES = ["Planning", "Land Acquisition", "Documentation", "Approvals", "Under Construction", "Completed", "On Hold", "Cancelled"];

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [interests, setInterests] = useState(null);
  const [loadingLand, setLoadingLand] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    projectType: "Residential",
    landId: searchParams.get("land") || "",
    estimatedBudget: "",
    startDate: "",
    completionDate: "",
    status: "Planning",
    reraState: "",
    reraNumber: "",
    reraPromoter: "",
    reraProjectName: "",
    reraRegDate: "",
    reraCompletion: "",
    address: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/interests?scope=mine", { cache: "no-store" });
        const data = await res.json();
        if (active) setInterests((data.interests || []).filter((i) => i.status === "accepted"));
      } catch (err) {
        // ignore
      } finally {
        if (active) setLoadingLand(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Please provide a project name.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/builder/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          projectType: form.projectType,
          landId: form.landId || null,
          location: form.landId
            ? undefined
            : {
                address: form.address,
                city: form.city,
                district: form.district,
                state: form.state,
                pincode: form.pincode,
              },
          estimatedBudget: Number(form.estimatedBudget) || 0,
          startDate: form.startDate || null,
          completionDate: form.completionDate || null,
          status: form.status,
          rera: {
            state: form.reraState,
            registrationNumber: form.reraNumber,
            promoterName: form.reraPromoter,
            projectName: form.reraProjectName,
            registrationDate: form.reraRegDate || null,
            completionDate: form.reraCompletion || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create project.");
      router.push(`/builder/projects/${data.project._id}`);
    } catch (err) {
      setError(err.message || "Unable to create project.");
      setSubmitting(false);
    }
  }

  const linked = !!form.landId;

  return (
    <div>
      <button
        onClick={() => router.push("/builder/projects")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Projects
      </button>

      <h2 className="text-xl font-bold text-foreground">New Project</h2>
      <p className="mt-1 text-sm text-muted">
        Create a development project. You may link it to land where a landowner has accepted your interest.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">Project basics</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Project Name *" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Green Valley Residency" />
            <Select label="Project Type" value={form.projectType} onChange={(e) => update("projectType", e.target.value)}>
              {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="mt-4">
            <Textarea label="Description" rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Short description of the project..." />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MoneyInput label="Estimated Budget" value={form.estimatedBudget} onChange={(v) => update("estimatedBudget", v)} />
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            <Input label="Target Completion" type="date" value={form.completionDate} onChange={(e) => update("completionDate", e.target.value)} />
          </div>
          <div className="mt-4">
            <Select label="Current Status" value={form.status} onChange={(e) => update("status", e.target.value)}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">Land association (optional)</h3>
          {loadingLand ? (
            <Skeleton className="h-12" />
          ) : (
            <>
              <Select
                value={form.landId}
                onChange={(e) => update("landId", e.target.value)}
                hint="Only land with an accepted interest is shown."
              >
                <option value="">No land (enter location manually)</option>
                {(interests || []).map((i) => (
                  <option key={i._id} value={i.landId?._id}>
                    {i.landId?.title} — {i.landId?.location?.city || ""}
                  </option>
                ))}
              </Select>
              {!linked && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} />
                  <Input label="City" value={form.city} onChange={(e) => update("city", e.target.value)} />
                  <Input label="District" value={form.district} onChange={(e) => update("district", e.target.value)} />
                  <Input label="State" value={form.state} onChange={(e) => update("state", e.target.value)} />
                  <Input label="Pincode" value={form.pincode} onChange={(e) => update("pincode", e.target.value)} />
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">RERA information (optional)</h3>
          <p className="mb-4 text-sm text-muted">
            If provided, this will be queued for verification. No RERA claim is auto-verified.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="State" value={form.reraState} onChange={(e) => update("reraState", e.target.value)} />
            <Input label="Registration Number" value={form.reraNumber} onChange={(e) => update("reraNumber", e.target.value)} />
            <Input label="Promoter Name" value={form.reraPromoter} onChange={(e) => update("reraPromoter", e.target.value)} />
            <Input label="RERA Project Name" value={form.reraProjectName} onChange={(e) => update("reraProjectName", e.target.value)} />
            <Input label="Registration Date" type="date" value={form.reraRegDate} onChange={(e) => update("reraRegDate", e.target.value)} />
            <Input label="Planned Completion" type="date" value={form.reraCompletion} onChange={(e) => update("reraCompletion", e.target.value)} />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            <FolderKanban className="h-4 w-4" /> Create Project
          </Button>
        </div>
      </form>
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="New Project">
      <NewProjectContent />
    </BuilderDashboardShell>
  );
}

export default function NewProjectPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="New Project"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
