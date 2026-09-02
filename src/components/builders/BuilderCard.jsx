"use client";

import Link from "next/link";
import {
  MapPin,
  ShieldCheck,
  BadgeCheck,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import Badge from "@/components/ui/Badge";

function getInitials(text, fallback = "B") {
  return (text || fallback)
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function BuilderCard({ builder }) {
  const locations = builder.operatingLocations || [];
  const areaLabel = locations
    .map((l) => [l.city, l.state].filter(Boolean).join(", "))
    .filter(Boolean)[0];

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl">
      <div className="flex items-start gap-3">
        {builder.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={builder.logo}
            alt={builder.companyName || builder.name}
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-light text-sm font-bold text-accent">
            {getInitials(builder.companyName || builder.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-foreground">
            {builder.companyName || builder.name}
          </h3>
          <p className="text-xs text-muted">
            {[builder.designation, builder.businessType]
              .filter(Boolean)
              .join(" · ") || "Builder"}
          </p>
        </div>
        {builder.businessVerified && (
          <Badge tone="success">
            <ShieldCheck className="h-3 w-3" /> Verified
          </Badge>
        )}
      </div>

      {builder.bio && (
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted line-clamp-3">
          {builder.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {builder.yearsOfExperience > 0 && (
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" />
            {builder.yearsOfExperience} yrs exp
          </span>
        )}
        {areaLabel && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {areaLabel}
          </span>
        )}
      </div>

      {builder.specializations?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {builder.specializations.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted"
            >
              {s}
            </span>
          ))}
          {builder.specializations.length > 3 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted">
              +{builder.specializations.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="flex items-center gap-1 text-xs text-muted">
          {builder.completedProjects > 0 &&
            `${builder.completedProjects} projects completed`}
          {builder.reraVerified && (
            <Badge tone="info">
              <BadgeCheck className="h-3 w-3" /> RERA
            </Badge>
          )}
        </span>
        <Link
          href={`/builder/${builder._id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-soft"
        >
          View Profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
