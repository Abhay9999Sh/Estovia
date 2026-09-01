"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import {
  Tags,
  PlusCircle,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatDate, formatINR } from "@/lib/demoData";

const STATUS_TONES = {
  Draft: "muted",
  Open: "success",
  Shortlisted: "info",
  "Order Placed": "success",
  Fulfilled: "success",
  Cancelled: "danger",
  Closed: "muted",
};

const EMPTY_LINE = { item: "", quantity: "", unit: "", specification: "" };
const EMPTY_FORM = {
  projectId: "",
  title: "",
  category: "",
  description: "",
  estimatedValue: "",
  deliveryLocation: "",
  requiredBy: "",
  validUntil: "",
  visibility: "public",
  lineItems: [],
};

function RequirementsContent() {
  const [requirements, setRequirements] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, projectRes] = await Promise.all([
        fetch("/api/builder/requirements", { cache: "no-store" }),
        fetch("/api/builder/projects", { cache: "no-store" }),
      ]);
      const reqData = await reqRes.json();
      const projectData = await projectRes.json();
      setRequirements(reqData.requirements || []);
      setProjects(projectData.projects || []);
    } catch (e) {
      setError("Unable to load requirements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateLine(i, key, value) {
    setForm((f) => {
      const lineItems = f.lineItems.map((l, idx) => (idx === i ? { ...l, [key]: value } : l));
      return { ...f, lineItems };
    });
  }

  async function publish() {
    if (!form.projectId) {
      setError("Select a project for this requirement.");
      return;
    }
    if (!form.title.trim()) {
      setError("Requirement title is required.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/builder/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId,
          title: form.title,
          category: form.category,
          description: form.description,
          estimatedValue: Number(form.estimatedValue) || 0,
          deliveryLocation: form.deliveryLocation,
          requiredBy: form.requiredBy || null,
          validUntil: form.validUntil || null,
          visibility: form.visibility,
          lineItems: form.lineItems.filter((l) => l.item.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish.");
      setPublishOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRequirement(req) {
    if (req.status === "Order Placed" || req.status === "Fulfilled") {
      setError("This requirement has an active order and cannot be deleted.");
      return;
    }
    if (!confirm(`Delete requirement "${req.title}"?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/builder/requirements/${req._id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to delete.");
      }
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          Publish requirements to suppliers and track quotations and orders.
        </p>
        <Button onClick={() => setPublishOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Publish Requirement
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Tags className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No published requirements</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Publish a requirement for materials or services, and suppliers will send you quotations.
          </p>
          <Button className="mt-5" onClick={() => setPublishOpen(true)}>
            <PlusCircle className="h-4 w-4" /> Publish your first requirement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((r) => (
            <div key={r._id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-foreground">{r.title}</p>
                    <Badge tone={STATUS_TONES[r.status] || "muted"}>{r.status}</Badge>
                    <Badge tone={r.visibility === "private" ? "warning" : "muted"}>
                      {r.visibility === "private" ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {r.visibility}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {r.projectId?.name}
                    {r.category ? ` · ${r.category}` : ""}
                    {r.deliveryLocation ? ` · ${r.deliveryLocation}` : ""}
                  </p>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    {r.estimatedValue > 0 && (
                      <span className="font-extrabold text-foreground">{formatINR(r.estimatedValue)}</span>
                    )}
                    {r.requiredBy && <span className="text-muted">Required by {formatDate(r.requiredBy)}</span>}
                    {r.validUntil && <span className="text-muted">Quotes valid till {formatDate(r.validUntil)}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Link href={`/builder/quotations?requirementId=${r._id}`}>
                    <Button size="sm" variant="outline">
                      View Quotations <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {["Draft", "Open", "Shortlisted"].includes(r.status) && (
                    <button
                      onClick={() => removeRequirement(r)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                      aria-label="Delete requirement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish Requirement" size="lg">
        <div className="space-y-4">
          <Select label="Project *" value={form.projectId} onChange={(e) => setField("projectId", e.target.value)}>
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </Select>
          <Input label="Title *" value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Grade A-1 cement (OPC 53)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Category" value={form.category} onChange={(e) => setField("category", e.target.value)} placeholder="e.g. Cement / Steel / Plumbing" />
            <Input label="Estimated Value (₹)" type="number" min="0" value={form.estimatedValue} onChange={(e) => setField("estimatedValue", e.target.value)} />
          </div>
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setField("description", e.target.value)} />
          <Input label="Delivery Location" value={form.deliveryLocation} onChange={(e) => setField("deliveryLocation", e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Required By" type="date" value={form.requiredBy} onChange={(e) => setField("requiredBy", e.target.value)} />
            <Input label="Quotes Valid Until" type="date" value={form.validUntil} onChange={(e) => setField("validUntil", e.target.value)} />
          </div>
          <Select label="Visibility" value={form.visibility} onChange={(e) => setField("visibility", e.target.value)}>
            <option value="public">Public — visible to all suppliers</option>
            <option value="private">Private — invite specific suppliers after publishing</option>
          </Select>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Line Items</p>
              <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }))}>
                <PlusCircle className="h-4 w-4" /> Add item
              </Button>
            </div>
            {form.lineItems.length === 0 ? (
              <p className="text-xs text-muted">Optional. Add individual materials/services and quantities.</p>
            ) : (
              <div className="space-y-3">
                {form.lineItems.map((l, i) => (
                  <div key={i} className="rounded-xl border border-border bg-secondary p-3">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Item *" value={l.item} onChange={(e) => updateLine(i, "item", e.target.value)} />
                      <Input placeholder="Qty" type="number" min="0" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                      <Input placeholder="Unit" value={l.unit} onChange={(e) => updateLine(i, "unit", e.target.value)} />
                      <button
                        onClick={() => setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }))}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                        aria-label="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input className="mt-2" placeholder="Specification (optional)" value={l.specification} onChange={(e) => updateLine(i, "specification", e.target.value)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={publish} loading={busy}>Publish Requirement</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function BuilderRequirementsPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Requirements" subtitle="Publish material and service requirements">
        <RequirementsContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}