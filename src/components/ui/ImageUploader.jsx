"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, AlertTriangle } from "lucide-react";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

export default function ImageUploader({
  value = [],
  onChange,
  folder = "uploads",
  max = 10,
  label = "Images",
  hint = "Upload photos. Max 10 MB each.",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadFiles(files) {
    const imageFiles = Array.from(files);
    if (imageFiles.length === 0) return;
    const remaining = max - value.length;
    if (remaining <= 0) {
      setError(`You can upload up to ${max} images.`);
      return;
    }
    setUploading(true);
    setError("");

    const results = [];
    for (const file of imageFiles.slice(0, remaining)) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "image");
      form.append("folder", folder);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed.");
        }
        results.push(data.url);
      } catch (err) {
        setError(err.message || "One or more images failed to upload.");
        break;
      }
    }

    if (results.length > 0) {
      onChange([...value, ...results]);
    }
    setUploading(false);
  }

  function remove(url) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div
            key={url}
            className="group relative h-28 w-28 overflow-hidden rounded-xl border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
            <span className="text-xs font-medium">
              {uploading ? "Uploading..." : "Add"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        hidden
        onChange={(e) => {
          uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {(error || hint) && (
        <div className="mt-2 flex items-start gap-1.5">
          {error && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />}
          <p className={`text-xs ${error ? "text-danger" : "text-muted"}`}>
            {error || hint}
          </p>
        </div>
      )}
    </div>
  );
}
