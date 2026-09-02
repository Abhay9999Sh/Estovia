"use client";

import Link from "next/link";
import { MapPin, Star, ShieldCheck, ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";

function getInitials(text, fallback = "S") {
  return (text || fallback)
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SupplierCard({ supplier }) {
  const locations = supplier.operatingLocations || [];
  const areaLabel = locations
    .map((l) => [l.city, l.state].filter(Boolean).join(", "))
    .filter(Boolean)[0];
  const categories = [
    ...(supplier.productCategories || []),
    ...(supplier.serviceCategories || []),
  ]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl">
      <div className="flex items-start gap-3">
        {supplier.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={supplier.logo}
            alt={supplier.businessName}
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent-light text-sm font-bold text-accent">
            {getInitials(supplier.businessName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-foreground">
            {supplier.businessName}
          </h3>
          <p className="text-xs text-muted">
            {supplier.category || "Supplier"}
            {supplier.yearsOfExperience > 0 && ` · ${supplier.yearsOfExperience}y exp`}
          </p>
        </div>
        {supplier.verified && (
          <Badge tone="success">
            <ShieldCheck className="h-3 w-3" /> Verified
          </Badge>
        )}
      </div>

      {supplier.bio && (
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted line-clamp-3">
          {supplier.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {supplier.rating > 0 && (
          <span className="flex items-center gap-0.5">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {supplier.rating.toFixed(1)} ({supplier.reviewCount})
          </span>
        )}
        {(areaLabel || supplier.businessAddress) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {areaLabel || supplier.businessAddress}
          </span>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {categories.map((c) => (
            <span
              key={c}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted">
          {supplier.orderCount > 0 && `${supplier.orderCount} orders`}
        </span>
        <Link
          href={`/supplier/${supplier._id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-soft"
        >
          View Profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
