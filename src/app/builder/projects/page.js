"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, ArrowRight, PlusCircle, Building2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
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

function toneFor(projType) {
  const t = projType === "Residential" ? "success"
    : projType === "Commercial" ? "warning" : "info";
  return t;
}

function ProjectsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "all";
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/builder/projects${qs}`, { cache: "no-store" });
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError("Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/builder/projects")}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              status === "all" ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => router.push(`/builder/projects?status=${encodeURIComponent(s)}`)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                status === s ? "bg-accent text-white" : "border border-border bg-white text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button onClick={() => router.push("/builder/projects/new")}>
          <PlusCircle className="h-4 w-4" /> New Project
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <button
              key={p._id}
              onClick={() => router.push(`/builder/projects/${p._id}`)}
              className="group overflow-hidden rounded-2xl border border-border bg-white text-left transition-colors hover:border-accent"
            >
              {p.images && p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt={p.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-secondary">
                  <Building2 className="h-10 w-10 text-muted" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-foreground">{p.name}</p>
                  <Badge tone={toneFor(p.projectType)}>{p.projectType}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {p.location?.city}
                  {p.location?.state ? `, ${p.location.state}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    {p.estimatedBudget ? (
                      <>Budget: <span className="font-semibold">{formatINR(p.estimatedBudget)}</span></>
                    ) : (
                      "Budget: —"
                    )}
                  </span>
                  <Badge tone="info">{p.status}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                  <span>Updated {new Date(p.updatedAt).toLocaleDateString()}</span>
                  <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No projects yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Create a project once you have an accepted interest or proposal with a landowner.
          </p>
          <Button className="mt-5" onClick={() => router.push("/builder/projects/new")}>
            <FolderKanban className="h-4 w-4" /> Create Project
          </Button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  return (
    <BuilderDashboardShell title="My Projects">
      <ProjectsContent />
    </BuilderDashboardShell>
  );
}

export default function ProjectsPage() {
  return (
    <AuthShell>
      <Suspense fallback={<BuilderDashboardShell title="My Projects"><div /></BuilderDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
