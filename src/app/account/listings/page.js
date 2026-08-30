"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map, PlusSquare } from "lucide-react";
import AppShell from "@/components/AppShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatINR } from "@/lib/demoData";

export default function MyListingsPage() {
  return (
    <AppShell>
      <MyListingsContent />
    </AppShell>
  );
}

function MyListingsContent() {
  const { isLoggedIn } = useAuth();
  const [listings, setListings] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/landowner/land", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.listings) setListings(d.listings);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My Listings</h1>
        <p className="mt-2 text-muted">Land listings you have created on Estovia.</p>

        {!isLoggedIn ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <p className="text-muted">Please log in to view your listings.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              Log In
            </Link>
          </div>
        ) : listings === null ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : listings.length > 0 ? (
          <div className="mt-8 space-y-3">
            {listings.map((l) => (
              <div
                key={l._id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-bold text-foreground">{l.title}</p>
                  <p className="text-sm text-muted">
                    {l.location?.city || "—"} · {l.area?.value} {l.area?.unit}
                  </p>
                  <p className="text-xs text-muted">{formatDate(l.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {l.pricing?.amount ? formatINR(l.pricing.amount) : "—"}
                  </span>
                  <Badge tone={l.status === "active" ? "success" : "muted"}>{l.status}</Badge>
                </div>
                <Link
                  href={`/land/${l._id}`}
                  className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Map className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No listings yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Become a landowner to start listing your land.
            </p>
            <Link
              href="/complete-profile"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              <PlusSquare className="h-4 w-4" /> Become a Landowner
            </Link>
          </div>
        )}
      </div>
  );
}
