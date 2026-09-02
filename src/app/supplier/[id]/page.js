"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Star,
  ShieldCheck,
  AlertTriangle,
  Package,
  Wrench,
  Star as StarIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";

function formatINR(num) {
  const value = Number(num);
  if (!value) return "₹0";
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function SupplierProfileContent() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/supplier/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.profile) setData(d);
        else if (active) setNotFound(true);
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const profile = data?.profile;

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
      ) : notFound || !profile ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
          <h3 className="mt-4 text-lg font-bold text-foreground">Supplier not found</h3>
          <p className="mt-1 text-sm text-muted">
            This supplier profile is unavailable.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            {profile.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.coverImage}
                alt={profile.businessName}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                {profile.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.logo}
                    alt={profile.businessName}
                    className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
                    {(profile.businessName || "S")
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-foreground">
                      {profile.businessName}
                    </h1>
                    {profile.verified && (
                      <Badge tone="success">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted">{profile.category || "Supplier"}</p>
                  {profile.bio && (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Years of Experience"
                  value={profile.yearsOfExperience ? `${profile.yearsOfExperience}` : "—"}
                  suffix={profile.yearsOfExperience ? " yrs" : ""}
                />
                <Stat
                  label="Rating"
                  value={
                    profile.rating > 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {profile.rating.toFixed(1)} ({profile.reviewCount})
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Stat
                  label="Orders Fulfilled"
                  value={profile.orderCount ?? "—"}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {profile.operatingLocations?.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.operatingLocations
                      .map((l) => [l.city, l.state].filter(Boolean).join(", "))
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {profile.serviceableStates?.length > 0 && (
                  <Badge tone="info">
                    Serviceable: {profile.serviceableStates.join(", ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left: catalogue */}
            <div className="space-y-6 lg:col-span-2">
              {profile.productCategories?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Package className="h-5 w-5 text-accent" /> Product Categories
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.productCategories.map((c) => (
                      <Badge key={c} tone="info">{c}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {profile.serviceCategories?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Wrench className="h-5 w-5 text-accent" /> Service Categories
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.serviceCategories.map((c) => (
                      <Badge key={c} tone="info">{c}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {data.products?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Package className="h-5 w-5 text-accent" /> Products
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.products.map((p) => (
                      <div key={String(p._id)} className="rounded-xl border border-border bg-secondary p-4">
                        <p className="font-semibold text-foreground">{p.name}</p>
                        {p.brand && (
                          <p className="text-xs text-muted">Brand: {p.brand}</p>
                        )}
                        {p.description && (
                          <p className="mt-1 text-sm text-muted line-clamp-2">{p.description}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-accent">
                            {formatINR(p.pricePerUnit)}{p.unit ? ` / ${p.unit}` : ""}
                          </span>
                          {p.moq > 0 && (
                            <span className="text-[11px] text-muted">MOQ {p.moq}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {data.services?.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                    <Wrench className="h-5 w-5 text-accent" /> Services
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.services.map((s) => (
                      <div key={String(s._id)} className="rounded-xl border border-border bg-secondary p-4">
                        <p className="font-semibold text-foreground">{s.name}</p>
                        {s.description && (
                          <p className="mt-1 text-sm text-muted line-clamp-2">{s.description}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-accent">
                            {s.price > 0 ? formatINR(s.price) : "Price on request"}
                            {s.pricingModel ? ` (${s.pricingModel})` : ""}
                          </span>
                          {s.turnaroundDays > 0 && (
                            <span className="text-[11px] text-muted">{s.turnaroundDays}d turnaround</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: verification + ratings */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-white p-6 h-fit">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-accent" /> Verification
                </h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-muted">Business</span>
                    <Badge tone={profile.verified ? "success" : "muted"}>
                      {profile.verified ? "Verified" : "Pending"}
                    </Badge>
                  </li>
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Only independently confirmed details are shown as verified.
                </p>
              </div>

              {data.ratings?.length > 0 && (
                <div className="rounded-2xl border border-border bg-white p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                    <StarIcon className="h-5 w-5 text-accent" /> Recent Reviews
                  </h2>
                  <div className="space-y-4">
                    {data.ratings.map((r) => (
                      <div key={String(r._id)} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted">
                              {(r.ratedBy?.name || "U")
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {r.ratedBy?.name || "User"}
                            </span>
                          </span>
                          <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {r.overallRating}
                          </span>
                        </div>
                        {r.review && (
                          <p className="mt-1.5 text-sm text-muted">{r.review}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
      <div className="text-2xl font-bold text-foreground">
        {value}
        {suffix}
      </div>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default function PublicSupplierProfilePage() {
  return (
    <AppShell>
      <SupplierProfileContent />
    </AppShell>
  );
}
