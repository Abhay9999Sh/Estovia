"use client";

import Link from "next/link";
import { MapPin, AreaChart, IndianRupee, BadgeCheck, ShieldCheck, ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatINR, formatArea, formatDate } from "@/lib/demoData";

function verificationTone(status) {
  switch (status) {
    case "verified":
      return "success";
    case "partially_verified":
      return "warning";
    case "under_review":
    case "submitted":
      return "info";
    case "rejected":
      return "danger";
    default:
      return "muted";
  }
}

function verificationLabel(status) {
  const map = {
    verified: "Verified",
    partially_verified: "Partially Verified",
    under_review: "Under Review",
    submitted: "Submitted",
    rejected: "Rejected",
    draft: "Draft",
  };
  return map[status] || "Draft";
}

export default function LandCard({ listing, href }) {
  const image = listing.image || listing.images?.[0] || "";
  const unitLabel =
    listing.pricing?.type === "per_acre"
      ? " / acre"
      : listing.pricing?.type === "per_sqft"
      ? " / sq.ft"
      : "";

  const link = href || `/land/${listing._id}`;

  return (
    <Link
      href={link}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div className="relative h-52 overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-teal-900">
            <MapPin className="h-10 w-10 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          {listing.verificationStatus === "verified" && (
            <Badge tone="success">
              <BadgeCheck className="h-3.5 w-3.5" /> Ownership Verified
            </Badge>
          )}
          {listing.verificationStatus === "partially_verified" && (
            <Badge tone="warning">
              <ShieldCheck className="h-3.5 w-3.5" /> Partially Verified
            </Badge>
          )}
        </div>
        <div className="absolute bottom-3 left-3 text-white">
          <p className="flex items-center gap-1 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            {listing.location?.city || listing.location?.address || "—"}
            {listing.location?.state ? `, ${listing.location.state}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-foreground line-clamp-2">
          {listing.title}
        </h3>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
          {listing.area?.value != null && (
            <span className="flex items-center gap-1.5">
              <AreaChart className="h-4 w-4" />
              {formatArea(listing.area)}
            </span>
          )}
          {listing.pricing?.amount > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <IndianRupee className="h-4 w-4" />
              {formatINR(listing.pricing.amount)}
              {unitLabel}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            {listing.owner?.name ? (
              <span className="text-xs font-medium text-muted">
                {listing.owner.name}
              </span>
            ) : listing.ownerName ? (
              <span className="text-xs font-medium text-muted">
                {listing.ownerName}
              </span>
            ) : (
              <span className="text-xs text-muted">Estovia Listed</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition-all group-hover:gap-2">
            View Details
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
