"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCircle2, Pencil, Building2, MapPin, BadgeCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { formatINR } from "@/lib/demoData";

function ProfileContent() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/builder/profile", { cache: "no-store" });
      const data = await res.json();
      setProfile(data.profile || null);
    } catch (err) {
      setError("Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <UserCircle2 className="mx-auto h-10 w-10 text-muted" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Profile not completed</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Complete your builder onboarding to set up your company profile.
        </p>
        <Button className="mt-5" onClick={() => router.push("/builder/onboarding")}>
          Complete Onboarding
        </Button>
      </div>
    );
  }

  const v = profile.verification || {};
  const verifiedCount = Object.values(v).filter((s) => s === "verified").length;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Header card */}
        <div className="flex-1 rounded-2xl border border-border bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-xl font-bold text-white">
                {(profile.companyName || profile.fullName || "B")
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div>
                <h2 className="text-xl font-bold text-foreground">{profile.companyName || profile.fullName}</h2>
                <p className="text-sm text-muted">{profile.designation || "Individual Developer"}</p>
                {profile.businessType && <p className="text-sm text-muted">{profile.businessType}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/builder/onboarding")}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Info label="Years of Experience" value={profile.yearsOfExperience ? `${profile.yearsOfExperience} yrs` : "—"} />
            <Info label="Projects Completed" value={profile.completedProjects ?? "—"} />
            <Info label="Ongoing Projects" value={profile.ongoingProjects ?? "—"} />
          </div>

          {profile.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{profile.bio}</p>}
        </div>

        {/* Side card */}
        <div className="w-full rounded-2xl border border-border bg-white p-6 lg:w-72">
          <h3 className="font-bold text-foreground">Verification</h3>
          <p className="mt-1 text-sm text-muted">
            {verifiedCount}/{Object.keys(v).length} items verified
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.keys(v).map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="capitalize text-muted">{k}</span>
                <Badge tone={v[k] === "verified" ? "success" : v[k] === "pending" ? "muted" : "info"}>
                  {v[k].replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Company details */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Building2 className="h-5 w-5 text-accent" /> Company Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="CIN" value={profile.cin || "—"} />
          <Info label="LLPIN" value={profile.llpin || "—"} />
          <Info label="PAN" value={profile.pan || "—"} />
          <Info label="GSTIN" value={profile.gstin || "—"} />
          <Info label="Website" value={profile.website || "—"} />
          <Info label="Year Established" value={profile.yearEstablished || "—"} />
          <Info label="Registered Address" value={profile.registeredAddress || "—"} />
          <Info label="Office Address" value={profile.officeAddress || "—"} />
        </div>
      </section>

      {/* Operating locations */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <MapPin className="h-5 w-5 text-accent" /> Operating Locations
        </h3>
        {profile.operatingLocations?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.operatingLocations.map((loc, i) => (
              <div key={i} className="rounded-xl border border-border bg-secondary p-4 text-sm">
                <p className="font-semibold text-foreground">
                  {[loc.city, loc.district, loc.state].filter(Boolean).join(", ")}
                </p>
                {loc.area && <p className="text-muted">{loc.area}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No operating locations added.</p>
        )}
      </section>

      {/* RERA */}
      <section className="mt-6 rounded-2xl border border-border bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <BadgeCheck className="h-5 w-5 text-accent" /> RERA Registrations
        </h3>
        {profile.reraRegistrations?.length ? (
          <ul className="space-y-2">
            {profile.reraRegistrations.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.projectName || r.registrationNumber}</p>
                  <p className="text-xs text-muted">{r.state} · {r.registrationNumber}</p>
                </div>
                <Badge tone={r.status === "verified" ? "success" : "info"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No RERA registrations added yet.</p>
        )}
      </section>
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

export default function ProfilePage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Profile">
        <ProfileContent />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
