"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  MapPin,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";

function BuilderProfileContent() {
  const { id } = useParams();
  const router = useRouter();
  const [builder, setBuilder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/builder/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.builder) setBuilder(d.builder);
        else if (active) setNotFound(true);
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-12 sm:px-6">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : notFound || !builder ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
          <h3 className="mt-4 text-lg font-bold text-foreground">Builder not found</h3>
          <p className="mt-1 text-sm text-muted">This builder profile is unavailable.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="rounded-2xl border border-border bg-white p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
                {(builder.companyName || builder.name || "B")
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-foreground">
                    {builder.companyName || builder.name}
                  </h1>
                  {builder.verified && (
                    <Badge tone="success">
                      <BadgeCheck className="h-3 w-3" /> Registered Builder
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-muted">
                  {[builder.designation, builder.businessType].filter(Boolean).join(" · ") || "Builder"}
                </p>
                {builder.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{builder.bio}</p>}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Stat label="Years of Experience" value={builder.yearsOfExperience ? `${builder.yearsOfExperience}` : "—"} suffix=" yrs" />
              <Stat label="Projects Completed" value={builder.completedProjects ?? "—"} />
              <Stat label="Ongoing Projects" value={builder.ongoingProjects ?? "—"} />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left: details */}
            <div className="space-y-6 lg:col-span-2">
              {builder.specializations?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Briefcase className="h-5 w-5 text-accent" /> Specializations
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {builder.specializations.map((s) => (
                      <Badge key={s} tone="info">{s}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {builder.propertyTypes?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Building2 className="h-5 w-5 text-accent" /> Property Types
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {builder.propertyTypes.map((p) => (
                      <Badge key={p} tone="info">{p}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {builder.operatingLocations?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <MapPin className="h-5 w-5 text-accent" /> Operating Locations
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {builder.operatingLocations.map((loc, i) => (
                      <div key={i} className="rounded-xl border border-border bg-secondary p-4 text-sm">
                        <p className="font-semibold text-foreground">
                          {[loc.city, loc.district, loc.state].filter(Boolean).join(", ")}
                        </p>
                        {loc.area && <p className="text-muted">{loc.area}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {builder.developmentAreas?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 text-lg font-bold text-foreground">Development Areas</h2>
                  <div className="flex flex-wrap gap-2">
                    {builder.developmentAreas.map((a) => (
                      <Badge key={a} tone="muted">{a}</Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: verification */}
            <div className="rounded-2xl border border-border bg-white p-6 h-fit">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                <ShieldCheck className="h-5 w-5 text-accent" /> Verification
              </h2>
              <ul className="space-y-3 text-sm">
                <VerificationRow label="Business" verified={builder.businessVerified} />
                <VerificationRow label="PAN" verified={builder.panVerified} />
                <VerificationRow label="GST" verified={builder.gstVerified} />
                <VerificationRow label="RERA" verified={builder.reraVerified} />
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Only independently confirmed items are shown as verified.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, suffix = "" }) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-4 text-center">
      <p className="text-2xl font-bold text-foreground">
        {value}
        {suffix}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function VerificationRow({ label, verified }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <Badge tone={verified ? "success" : "muted"}>
        {verified ? "Verified" : "Pending"}
      </Badge>
    </li>
  );
}

export default function PublicBuilderProfilePage() {
  return (
    <AppShell>
      <BuilderProfileContent />
    </AppShell>
  );
}
