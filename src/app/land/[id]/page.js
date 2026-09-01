"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  AreaChart,
  IndianRupee,
  BadgeCheck,
  ShieldCheck,
  Home,
  ArrowLeft,
  AlertTriangle,
  Send,
  CheckCircle2,
  Lock,
  Compass,
} from "lucide-react";
import Logo from "@/components/Logo";
import AppShell from "@/components/AppShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import LiveMap from "@/components/maps/LiveMap";
import { formatArea, formatINR, formatDate } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function DetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestType, setInterestType] = useState("buyer");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [interestMsg, setInterestMsg] = useState("");
  const [interestSent, setInterestSent] = useState(false);
  const [interestTone, setInterestTone] = useState("info"); // info | success | danger

  useEffect(() => {
    let active = true;
    fetch(`/api/land/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.listing) setListing(d.listing);
        else if (active) setNotFound(true);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="py-10">
        <Skeleton className="h-96 w-full" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h2 className="mt-4 text-2xl font-extrabold text-foreground">
          Listing not found
        </h2>
        <p className="mt-2 text-muted">
          This listing may have been removed or is no longer active.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/explore")}>
          <Compass className="h-4 w-4" /> Browse Properties
        </Button>
      </div>
    );
  }

  async function submitInterest() {
    if (!isLoggedIn) {
      router.push("/login?next=" + encodeURIComponent(`/land/${id}`));
      return;
    }
    const needsProfile =
      interestType === "builder" ? !user?.roles?.includes("builder") : !user?.roles?.includes("buyer");
    if (needsProfile) {
      setInterestTone("warning");
      setInterestMsg(
        interestType === "builder"
          ? "Complete your builder profile before expressing interest so the landowner can review your credentials."
          : "Complete your buyer profile before expressing interest so the landowner can review your credentials."
      );
      return;
    }
    setSending(true);
    setInterestMsg("");
    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landId: id, type: interestType, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInterestTone("danger");
        setInterestMsg(data.error || "Something went wrong. Please try again.");
        setSending(false);
        return;
      }
      setInterestSent(true);
      setInterestTone("success");
      setInterestMsg("Interest sent successfully! The landowner will be notified.");
      setSending(false);
    } catch (err) {
      setInterestTone("danger");
      setInterestMsg(err.message || "Something went wrong. Please try again.");
      setSending(false);
    }
  }

  return (
    <div>
      <Link
        href="/explore"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Explore
      </Link>

      {/* Hero image */}
      <div className="relative h-80 overflow-hidden rounded-2xl">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary to-teal-800">
            <Home className="h-16 w-16 text-white/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 text-white">
          {listing.verificationStatus === "verified" && (
            <Badge tone="success" className="mb-2">
              <BadgeCheck className="h-3.5 w-3.5" /> Ownership Verified
            </Badge>
          )}
          <h1 className="text-3xl font-extrabold">{listing.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
            <MapPin className="h-4 w-4" />
            {listing.location?.address ||
              `${listing.location?.city}${listing.location?.state ? ", " + listing.location.state : ""}`}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-8 lg:col-span-2">
          {/* Key facts */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5">
              <AreaChart className="h-5 w-5 text-accent" />
              <p className="mt-2 text-xs text-muted">Area</p>
              <p className="text-lg font-bold text-foreground">
                {formatArea(listing.area)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <IndianRupee className="h-5 w-5 text-accent" />
              <p className="mt-2 text-xs text-muted">Price</p>
              <p className="text-lg font-bold text-foreground">
                {listing.pricing?.type === "negotiable"
                  ? "Negotiable"
                  : formatINR(listing.pricing?.amount)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5 sm:col-span-1 col-span-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <p className="mt-2 text-xs text-muted">Verification</p>
              <p className="text-lg font-bold capitalize text-foreground">
                {listing.verificationStatus}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-bold text-foreground">About this land</h2>
            <p className="mt-3 leading-relaxed text-muted">
              {listing.description || "No description provided."}
            </p>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">Property Details</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow label="Property Type" value={listing.propertyType} />
              <DetailRow label="Land Use" value={listing.landUse?.replace("_", " ")} />
              <DetailRow label="Survey Number" value={listing.surveyNumber || "—"} />
              <DetailRow label="Khasra Number" value={listing.khasraNumber || "—"} />
              <DetailRow label="District" value={listing.location?.district || "—"} />
              <DetailRow label="State" value={listing.location?.state || "—"} />
              <DetailRow label="Pincode" value={listing.location?.pincode || "—"} />
              <DetailRow label="Listed" value={formatDate(listing.createdAt)} />
            </dl>
          </div>

          {/* Map */}
          {listing.location?.latitude != null && (
            <div>
              <h2 className="mb-3 text-xl font-bold text-foreground">Location</h2>
              <LiveMap
                latitude={listing.location.latitude}
                longitude={listing.location.longitude}
                boundary={listing.boundary}
                height="h-80"
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                {listing.owner?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "E"}
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  {listing.owner?.name || "Estovia Listed"}
                </p>
                <p className="text-xs text-muted">
                  {listing.owner?.username ? `@${listing.owner.username}` : "Verified landowner"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="success">
                <BadgeCheck className="h-3 w-3" /> Identity
              </Badge>
              <Badge tone="success">
                <BadgeCheck className="h-3 w-3" /> Location
              </Badge>
              {listing.verificationStatus === "verified" && (
                <Badge tone="success">
                  <BadgeCheck className="h-3 w-3" /> Ownership
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <h3 className="text-lg font-bold text-foreground">
              Interested in this land?
            </h3>
            <p className="mt-1 text-sm text-muted">
              Express your interest and the landowner will be notified.
            </p>
            <div className="mt-4 space-y-2 text-xs text-muted">
              <p className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Your identity is kept private until the owner responds.
              </p>
            </div>
            {interestSent ? (
              <Button fullWidth className="mt-4" variant="secondary" disabled>
                <CheckCircle2 className="h-4 w-4" /> Interest Sent
              </Button>
            ) : (
              <Button fullWidth className="mt-4" onClick={() => setInterestOpen(true)}>
                <Send className="h-4 w-4" /> Express Interest
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Interest modal */}
      <Modal open={interestOpen} onClose={() => setInterestOpen(false)} title="Express Interest">
        <div className="space-y-4">
          <Select
            label="You are a"
            value={interestType}
            onChange={(e) => setInterestType(e.target.value)}
          >
            <option value="buyer">Buyer</option>
            <option value="builder">Builder / Developer</option>
          </Select>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Tell the landowner why you're interested..."
            />
          </div>
          <Button fullWidth loading={sending} onClick={submitInterest}>
            Send Interest
          </Button>
          {interestMsg &&
            (sending ? null : (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  interestTone === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : interestTone === "danger"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : interestTone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-border bg-muted/40 text-foreground"
                }`}
              >
                {interestMsg}
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium capitalize text-foreground">{value}</dd>
    </div>
  );
}

export default function LandDetailPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <DetailContent />
      </div>
    </AppShell>
  );
}
