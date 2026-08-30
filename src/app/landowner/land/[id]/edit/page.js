"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LandForm from "@/components/land/LandForm";
import Skeleton from "@/components/ui/Skeleton";

function mapListingToForm(listing) {
  return {
    title: listing.title || "",
    description: listing.description || "",
    propertyType: listing.propertyType || "land",
    landUse: listing.landUse || "agricultural",
    area: {
      value: listing.area?.value ?? "",
      unit: listing.area?.unit || "sqft",
    },
    location: {
      address: listing.location?.address || "",
      city: listing.location?.city || "",
      district: listing.location?.district || "",
      state: listing.location?.state || "",
      pincode: listing.location?.pincode || "",
      tehsil: listing.location?.tehsil || "",
      village: listing.location?.village || "",
      latitude: listing.location?.latitude ?? null,
      longitude: listing.location?.longitude ?? null,
      boundary: listing.boundary || null,
    },
    pricing: {
      amount: listing.pricing?.amount ?? "",
      type: listing.pricing?.type || "total",
      negotiable: !!listing.pricing?.negotiable,
    },
    surveyNumber: listing.surveyNumber || "",
    khasraNumber: listing.khasraNumber || "",
    images: listing.images || [],
  };
}

function EditLand() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/landowner/land/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.listing) {
          setData(mapListingToForm(d.listing));
        } else if (active) {
          setError(d.error || "Listing not found.");
        }
      })
      .catch(() => {
        if (active) setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div>
      <Link
        href="/landowner/land"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Land
      </Link>
      <h2 className="text-xl font-bold text-foreground">Edit Land Listing</h2>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
          <Skeleton className="h-10" />
        </div>
      ) : error ? (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <LandForm initialData={data} listingId={id} editing />
        </div>
      )}
    </div>
  );
}

export default function EditLandPage() {
  return (
    <AuthShell>
      <DashboardShell title="Edit Land">
        <EditLand />
      </DashboardShell>
    </AuthShell>
  );
}
