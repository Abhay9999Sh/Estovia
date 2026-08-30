"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  ImageIcon,
  Video,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";

const DOC_TYPES = [
  { value: "sale_deed", label: "Sale Deed / Title Deed" },
  { value: "mutation", label: "Mutation Document" },
  { value: "land_record", label: "Land Record / RoR" },
  { value: "encumbrance", label: "Encumbrance Certificate" },
  { value: "tax_receipt", label: "Latest Tax Receipt" },
  { value: "survey_map", label: "Land Map / Survey Map" },
  { value: "other", label: "Other Supporting Document" },
];

const VIDEO_MAX = 30 * 1024 * 1024; // 30 MB
const IMAGE_MAX = 10 * 1024 * 1024; // 10 MB

// Accept images + PDFs/Office docs + videos so landowners can attach photos
// or short videos alongside ownership documents.
const ACCEPT =
  "image/*,application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,video/*";

function resolveMediaType(file) {
  const type = (file?.type || "").toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  return "document";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function MediaIcon({ mediaType }) {
  if (mediaType === "video") return <Video className="h-5 w-5" />;
  if (mediaType === "image") return <ImageIcon className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function statusBadge(status) {
  switch (status) {
    case "submitted":
    case "under_review":
    case "pending":
      return (
        <Badge tone="info">
          <Clock className="h-3 w-3" /> Pending Verification
        </Badge>
      );
    case "verified":
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" /> Verified
        </Badge>
      );
    case "rejected":
      return (
        <Badge tone="danger">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge tone="muted">
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
  }
}

export default function DocumentUploader({ landId, onCountChange, onPendingDocs }) {
  const [selectedType, setSelectedType] = useState("sale_deed");
  const [docs, setDocs] = useState([]); // persisted docs (existing listing)
  const [pending, setPending] = useState([]); // staged docs awaiting listing (new listing)
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Load existing documents if landId is provided (editing)
  useEffect(() => {
    if (landId) {
      fetch(`/api/landowner/land/${landId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.documents) {
            setDocs(data.documents);
          }
        })
        .catch(() => {});
    }
  }, [landId]);

  const total = docs.length + pending.length;

  useEffect(() => {
    onCountChange?.(total);
    onPendingDocs?.(pending);
  }, [total, pending, onCountChange, onPendingDocs]);

  function removePending(index) {
    setPending((p) => p.filter((_, i) => i !== index));
  }

  async function uploadFiles(files) {
    const fileList = Array.from(files || []);
    if (fileList.length === 0) return;

    if (landId) {
      await uploadAndPersist(fileList);
    } else {
      await uploadAndStage(fileList);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAndPersist(fileList) {
    setUploading(true);
    setError("");
    const newDocs = [];
    try {
      for (const file of fileList) {
        const mediaType = resolveMediaType(file);
        if (mediaType === "video" && file.size > VIDEO_MAX) {
          setError("Video is too large. Maximum size is 30 MB.");
          continue;
        }
        if (mediaType !== "video" && file.size > IMAGE_MAX) {
          setError("File is too large. Maximum size is 10 MB.");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("kind", mediaType);
        form.append("folder", "documents");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        newDocs.push({
          label: selectedType,
          filename: file.name,
          url: data.url,
          type: selectedType,
          mediaType,
          status: "submitted",
        });
      }

      if (newDocs.length > 0) {
        const res = await fetch(`/api/landowner/land/${landId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: selectedType, documents: newDocs }),
        });
        const apiData = await res.json();
        if (!res.ok) throw new Error(apiData.error);
        setDocs((prev) => [...apiData.documents, ...prev]);
      }
    } catch (err) {
      setError(err.message || "Unable to upload documents.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadAndStage(fileList) {
    setUploading(true);
    setError("");
    const stagedNew = [];
    try {
      for (const file of fileList) {
        const mediaType = resolveMediaType(file);
        if (mediaType === "video" && file.size > VIDEO_MAX) {
          setError("Video is too large. Maximum size is 30 MB.");
          continue;
        }
        if (mediaType !== "video" && file.size > IMAGE_MAX) {
          setError("File is too large. Maximum size is 10 MB.");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("kind", mediaType);
        form.append("folder", "documents");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        stagedNew.push({
          type: selectedType,
          label: selectedType,
          filename: file.name,
          url: data.url,
          mediaType,
          size: file.size,
          status: "submitted",
        });
      }
      setPending((prev) => [...stagedNew, ...prev]);
    } catch (err) {
      setError(err.message || "Unable to upload documents.");
    } finally {
      setUploading(false);
    }
  }

  const items =
    landId
      ? docs.map((d) => ({ ...d, _pending: false }))
      : [
          ...pending.map((p) => ({ ...p, _pending: true })),
          ...docs.map((d) => ({ ...d, _pending: false })),
        ];

  return (
    <div>
      <div className="rounded-2xl border border-dashed border-border bg-secondary p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Document Type
            </label>
            <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {DOC_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
            {uploading ? "Uploading..." : "Upload Documents"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <p className="mt-3 text-xs text-muted">
          Upload multiple ownership documents, photos or short videos. Images and
          documents up to 10 MB each; videos up to 30 MB each.
        </p>
        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((doc, idx) => (
            <li
              key={doc._id || `${doc.type}-${doc.filename}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted">
                  <MediaIcon mediaType={doc.mediaType} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {DOC_TYPES.find((t) => t.value === doc.type)?.label || doc.label || doc.type}
                    {doc.mediaType === "video" && (
                      <span className="ml-2 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">
                        video
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {doc.filename || "Uploaded document"}
                    {doc.size ? ` · ${formatBytes(doc.size)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc._pending ? (
                  <>
                    <Badge tone="info">
                      <Clock className="h-3 w-3" /> Ready
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removePending(idx)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-danger"
                      aria-label="Remove document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  statusBadge(doc.status || "pending")
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          No documents uploaded yet. Uploading a document does not automatically
          verify your ownership.
        </p>
      )}
    </div>
  );
}
