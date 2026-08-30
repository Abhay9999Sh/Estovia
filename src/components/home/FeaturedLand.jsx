"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LandCard from "@/components/property/LandCard";
import Skeleton from "@/components/ui/Skeleton";
import Reveal from "@/components/ui/Reveal";

export default function FeaturedLand() {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/land?limit=3")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.listings) setListings(data.listings);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Featured
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Featured Land &amp; Property
            </h2>
            <p className="mt-3 text-muted">
              Hand-picked opportunities from verified landowners across India.
            </p>
          </div>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent sm:self-auto"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {!listings && !error
            ? [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-border bg-white"
                >
                  <Skeleton className="h-52 w-full rounded-none" />
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              ))
            : listings?.map((listing) => (
                <LandCard key={listing._id} listing={listing} />
              ))}
        </div>

        {error && (
          <p className="mt-8 text-center text-sm text-muted">
            Something went wrong while loading listings. Please try again.
          </p>
        )}
      </div>
    </section>
  );
}
