"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, XCircle, PlusSquare } from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/demoData";

const DOC_LABELS = {
  sale_deed: "Sale Deed / Title Deed",
  mutation: "Mutation Document",
  land_record: "Land Record / RoR",
  encumbrance: "Encumbrance Certificate",
  tax_receipt: "Latest Tax Receipt",
  survey_map: "Land Map / Survey Map",
  other: "Other Supporting Document",
};

function docStatusTone(status) {
  switch (status) {
    case "verified":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "info";
  }
}

function docStatusIcon(status) {
  if (status === "verified") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "rejected") return <XCircle className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

function DocumentsContent() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const landRes = await fetch("/api/landowner/land", { cache: "no-store" });
        const landData = await landRes.json();
        const listings = landData.listings || [];

        const all = [];
        for (const l of listings) {
          const res = await fetch(`/api/landowner/land/${l._id}`, { cache: "no-store" });
          const data = await res.json();
          const listDocs = (data.documents || []).map((d) => ({
            ...d,
            landTitle: l.title,
            landId: l._id,
          }));
          all.push(...listDocs);
        }
        setDocs(all);
      } catch (err) {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Documents</h2>
          <p className="text-sm text-muted">
            Ownership documents across all your listings.
          </p>
        </div>
        <Link
          href="/landowner/land/new"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-soft"
        >
          <PlusSquare className="h-4 w-4" /> Add Land
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : docs.length > 0 ? (
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-border bg-secondary px-5 py-3 text-xs font-semibold text-muted">
            <span>Document</span>
            <span>Listing</span>
            <span>Uploaded</span>
            <span>Status</span>
          </div>
          {docs.map((d) => (
            <div
              key={d._id}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 md:gap-4 border-b border-border px-5 py-4 md:items-center"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {DOC_LABELS[d.type] || d.type}
                  </p>
                  <p className="text-xs text-muted">{d.filename}</p>
                </div>
              </div>
              <p className="text-sm text-muted">{d.landTitle}</p>
              <p className="text-sm text-muted">{formatDate(d.createdAt)}</p>
              <div>
                <Badge tone={docStatusTone(d.status)}>
                  {docStatusIcon(d.status)}
                  {d.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No documents yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Upload documents when adding or editing a land listing.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <AuthShell>
      <DashboardShell title="Documents">
        <DocumentsContent />
      </DashboardShell>
    </AuthShell>
  );
}
