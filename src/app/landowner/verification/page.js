"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  FileCheck2,
  BadgeCheck,
  Clock,
  UserCheck,
  XCircle,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";

function VerificationContent() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/landowner/land", { cache: "no-store" });
        const data = await res.json();
        setListings(data.listings || []);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toneFor(status) {
    if (status === "verified") return "success";
    if (status === "rejected") return "danger";
    if (status === "partially_verified") return "info";
    return "info";
  }

  function iconFor(status) {
    if (status === "verified") return <BadgeCheck className="h-3 w-3" />;
    if (status === "rejected") return <XCircle className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  }

  const verifications = [
    {
      label: "Identity",
      status: user?.verification?.identity || "pending",
      description:
        "Your identity document is reviewed by our team before verification.",
    },
    {
      label: "Address",
      status: user?.verification?.address || "pending",
      description: "Your address details are verified as part of onboarding.",
    },
    {
      label: "Phone",
      status: user?.verification?.phone || "pending",
      description: "Your contact number is verified when transacting.",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Verification</h2>
        <p className="text-sm text-muted">
          Track the status of your identity, ownership and listing verifications.
        </p>
      </div>

      {/* User verification statuses */}
      <div className="mb-6 rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-bold text-foreground">Your Verification</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {verifications.map((v) => (
            <div key={v.label} className="rounded-xl border border-border bg-secondary p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{v.label} Verification</p>
                <Badge tone={toneFor(v.status)}>{iconFor(v.status)}{v.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">{v.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Listing verification statuses */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-bold text-foreground">Listing Ownership</h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : listings.length > 0 ? (
          <div className="space-y-3">
            {listings.map((l) => (
              <div
                key={l._id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{l.title}</p>
                  <p className="text-xs text-muted">
                    Ownership verification tracks your documents ({l.surveyNumber || "no survey no."})
                  </p>
                </div>
                <Badge tone={toneFor(l.verificationStatus)}>
                  {iconFor(l.verificationStatus)}
                  {l.verificationStatus}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Add a land listing to start the ownership verification process.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-accent-light bg-accent-light/30 p-4">
        <FileCheck2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
        <p className="text-xs text-muted">
          Uploading a document does not automatically verify ownership. Our team
          reviews each document before updating the verification status. We do not
          perform government Aadhaar authentication.
        </p>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <AuthShell>
      <DashboardShell title="Verification">
        <VerificationContent />
      </DashboardShell>
    </AuthShell>
  );
}
