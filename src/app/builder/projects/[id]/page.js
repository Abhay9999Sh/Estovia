"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  FileText,
  UploadCloud,
  Trash2,
  Loader2,
  AlertTriangle,
  Package,
  PlusCircle,
  Check,
  Clock,
  XCircle,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatINR } from "@/lib/demoData";

const STATUSES = [
  "Planning",
  "Land Acquisition",
  "Documentation",
  "Approvals",
  "Under Construction",
  "Completed",
  "On Hold",
  "Cancelled",
];
const MATERIAL_STATUSES = ["Open", "Quotation Received", "Shortlisted", "Awarded", "Closed"];

function typeTone(t) {
  return t === "Residential" ? "success" : t === "Commercial" ? "warning" : "info";
}

function docStatusBadge(s) {
  if (s === "verified")
    return <Badge tone="success"><Check className="h-3 w-3" /> Verified</Badge>;
  if (s === "rejected")
    return <Badge tone="danger"><XCircle className="h-3 w-3" /> Rejected</Badge>;
  return <Badge tone="info"><Clock className="h-3 w-3" /> Pending</Badge>;
}

const DOC_CATEGORIES = ["company", "identity", "gst", "mca", "rera", "project", "land", "legal", "other"];
const PDF_ACCEPT = "application/pdf,image/*";

function ProjectDetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [docCategory, setDocCategory] = useState("project");
  const [docType, setDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef(null);

  const [matOpen, setMatOpen] = useState(false);
  const [matForm, setMatForm] = useState({ material: "", category: "", quantity: "", unit: "", requiredBy: "", description: "" });
  const [matBusy, setMatBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/builder/projects/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProject(data.project);
      setDocuments(data.documents || []);
      setMaterials(data.materialRequirements || []);
    } catch (err) {
      setError(err.message || "Unable to load project.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function updateStatus(status) {
    setError("");
    try {
      const res = await fetch(`/api/builder/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update status.");
    }
  }

  async function uploadDocs(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const docsPayload = [];
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", file.type.startsWith("image/") ? "image" : "document");
        form.append("folder", "project-documents");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        docsPayload.push({
          type: docType || docCategory,
          label: docType || docCategory,
          filename: file.name,
          url: data.url,
          mediaType: file.type.startsWith("image/") ? "image" : "document",
          status: "uploaded",
        });
      }
      const res = await fetch(`/api/builder/projects/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: docCategory, documents: docsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments((p) => [...data.documents, ...p]);
    } catch (err) {
      setError(err.message || "Unable to upload documents.");
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function deleteDoc(docId) {
    setError("");
    try {
      const res = await fetch(`/api/builder/projects/${id}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments((p) => p.filter((d) => d._id !== docId));
    } catch (err) {
      setError(err.message || "Unable to remove document.");
    }
  }

  async function addMaterial() {
    if (!matForm.material.trim()) {
      setError("Please provide the material or service.");
      return;
    }
    setMatBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/builder/projects/${id}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material: matForm.material,
          category: matForm.category,
          quantity: Number(matForm.quantity) || 0,
          unit: matForm.unit,
          requiredBy: matForm.requiredBy || null,
          description: matForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterials((p) => [data.material, ...p]);
      setMatOpen(false);
      setMatForm({ material: "", category: "", quantity: "", unit: "", requiredBy: "", description: "" });
    } catch (err) {
      setError(err.message || "Unable to add requirement.");
    } finally {
      setMatBusy(false);
    }
  }

  async function setMatStatus(mid, status) {
    setError("");
    try {
      const res = await fetch(`/api/builder/projects/${id}/materials/${mid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterials((p) => p.map((m) => (m._id === mid ? { ...m, status } : m)));
    } catch (err) {
      setError(err.message || "Unable to update requirement.");
    }
  }

  async function deleteMat(mid) {
    setError("");
    try {
      const res = await fetch(`/api/builder/projects/${id}/materials/${mid}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterials((p) => p.filter((m) => m._id !== mid));
    } catch (err) {
      setError(err.message || "Unable to remove requirement.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Project not found</h3>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button variant="outline" className="mt-5" onClick={() => router.push("/builder/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/builder/projects")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Projects
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
        <Badge tone={typeTone(project.projectType)}>{project.projectType}</Badge>
        <Badge tone="info">{project.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {project.location?.city}
        {project.location?.state ? `, ${project.location.state}` : ""}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Overview */}
        <div className="rounded-2xl border border-border bg-white p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg font-bold text-foreground">Overview</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Estimated Budget" value={project.estimatedBudget ? formatINR(project.estimatedBudget) : "—"} />
            <Info label="Start Date" value={project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"} />
            <Info label="Target Completion" value={project.completionDate ? new Date(project.completionDate).toLocaleDateString() : "—"} />
            <Info label="RERA Status" value={project.rera?.status || "—"} />
          </div>
          {project.description && (
            <p className="mt-4 text-sm leading-relaxed text-muted">{project.description}</p>
          )}
          {project.landId && (
            <div className="mt-4 rounded-xl border border-border bg-secondary p-4 text-sm">
              <p className="text-xs text-muted">Associated land</p>
              <p className="mt-1 font-semibold text-foreground">{project.landId.title}</p>
              <p className="text-muted">
                {project.landId.location?.city}
                {project.landId.location?.state ? `, ${project.landId.location.state}` : ""}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push(`/land/${project.landId._id}`)}>
                View Land
              </Button>
            </div>
          )}
        </div>

        {/* Status management */}
        <div className="rounded-2xl border border-border bg-white p-6">
          <h3 className="text-lg font-bold text-foreground">Project Status</h3>
          <p className="mt-1 text-xs text-muted">Only allowed forward transitions are shown.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STATUSES.filter((s) => s !== project.status).map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => updateStatus(s)}>
                → {s}
              </Button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Please reference{" "}
            <a
              href="https://mahaera.maharashtra.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              RERA
            </a>{" "}
            before advancing to approvals/construction.
          </p>
        </div>
      </div>

      {/* Documents */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Documents</h3>
          <div className="flex items-center gap-2">
            <Select value={docCategory} onChange={(e) => setDocCategory(e.target.value)} className="w-36">
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <input
              ref={docInputRef}
              type="file"
              accept={PDF_ACCEPT}
              multiple
              hidden
              onChange={(e) => uploadDocs(e.target.files)}
            />
            <Button size="sm" onClick={() => docInputRef.current?.click()} loading={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Upload
            </Button>
          </div>
        </div>
        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {documents.map((d) => (
              <li key={d._id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-muted">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.label || d.filename}</p>
                    <p className="truncate text-xs text-muted">{d.filename}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge tone="muted">{d.category}</Badge>
                  {docStatusBadge(d.status)}
                  <button
                    onClick={() => deleteDoc(d._id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                    aria-label="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Materials */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Material / Service Requirements</h3>
          <Button size="sm" onClick={() => setMatOpen(true)}>
            <PlusCircle className="h-4 w-4" /> Add Requirement
          </Button>
        </div>
        {materials.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No material requirements yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {materials.map((m) => (
              <li key={m._id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{m.material}</p>
                    <p className="text-sm text-muted">
                      {m.category || "General"}
                      {m.quantity ? ` · ${m.quantity} ${m.unit || ""}` : ""}
                      {m.requiredBy ? ` · by ${new Date(m.requiredBy).toLocaleDateString()}` : ""}
                    </p>
                    {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.status === "Awarded" ? "success" : m.status === "Closed" ? "muted" : m.status === "Open" ? "info" : "warning"}>
                      {m.status}
                    </Badge>
                    <select
                      value={m.status}
                      onChange={(e) => setMatStatus(m._id, e.target.value)}
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-foreground"
                    >
                      {MATERIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      onClick={() => deleteMat(m._id)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                      aria-label="Delete requirement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("Delete this project and all its documents/requirements?")) return;
            try {
              const res = await fetch(`/api/builder/projects/${id}`, { method: "DELETE" });
              if (res.ok) router.push("/builder/projects");
            } catch (err) {
              setError("Unable to delete project.");
            }
          }}
        >
          Delete Project
        </Button>
      </div>

      <Modal open={matOpen} onClose={() => setMatOpen(false)} title="Add Material / Service Requirement">
        <div className="space-y-4">
          <Input label="Material / Service *" value={matForm.material} onChange={(e) => setMatForm((f) => ({ ...f, material: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Category" value={matForm.category} onChange={(e) => setMatForm((f) => ({ ...f, category: e.target.value }))} />
            <Input label="Quantity" type="number" min="0" value={matForm.quantity} onChange={(e) => setMatForm((f) => ({ ...f, quantity: e.target.value }))} />
            <Input label="Unit" value={matForm.unit} onChange={(e) => setMatForm((f) => ({ ...f, unit: e.target.value }))} />
          </div>
          <Input label="Required By Date" type="date" value={matForm.requiredBy} onChange={(e) => setMatForm((f) => ({ ...f, requiredBy: e.target.value }))} />
          <Textarea label="Description" rows={3} value={matForm.description} onChange={(e) => setMatForm((f) => ({ ...f, description: e.target.value }))} />
          <Button fullWidth onClick={addMaterial} loading={matBusy}>
            <Package className="h-4 w-4" /> Add Requirement
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="Project Details">
      <ProjectDetailContent />
    </BuilderDashboardShell>
  );
}

export default function ProjectDetailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="Project Details"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
