"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, ShieldCheck } from "lucide-react";
import SearchBar from "@/components/hero/SearchBar";
import { useAuth } from "@/context/AuthContext";
import { listLandTarget } from "@/lib/navigation";

export default function Hero() {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const { isLoggedIn, user } = useAuth();
  const listHref = listLandTarget({ isLoggedIn, user });
  const isLandowner = Array.isArray(user?.roles) && user.roles.includes("landowner");

  useEffect(() => {
    const img = new Image();
    img.src = "/home_img.jpg";
    img.onload = () => setLoaded(true);
  }, []);

  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
        style={{
          backgroundImage: loaded
            ? "url(/home_img.jpg)"
            : "linear-gradient(135deg, #0f172a 0%, #0b3b36 60%, #0f766e 100%)",
          opacity: loaded ? 1 : 1,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/85" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-24 pb-20 text-center sm:px-6">
        <div
          className={`transition-all duration-700 ease-out ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            India&apos;s trusted real-estate marketplace
          </span>
        </div>

        <h1
          className={`mt-6 transition-all duration-700 delay-100 ease-out ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <span className="block font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
            Build Your Next
          </span>
          <span className="block bg-gradient-to-r from-teal-300 to-emerald-200 bg-clip-text font-display text-4xl font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            Real-Estate Opportunity
          </span>
        </h1>

        <p
          className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/80 transition-all delay-200 duration-700 sm:text-lg ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          Discover land, properties and trusted real-estate professionals in
          one platform. List your land, connect with serious buyers and
          builders, and build with confidence.
        </p>

        <div
          className={`mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row transition-all delay-300 duration-700 ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <Link
            href="/explore"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-7 text-base font-semibold text-white shadow-lg shadow-teal-900/30 transition-colors hover:bg-accent-soft sm:w-auto"
          >
            Explore Properties
          </Link>
          <Link
            href={listHref}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/15 sm:w-auto"
          >
            {isLandowner ? "Add Land" : "List Your Land"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div
          className={`mt-12 transition-all delay-500 duration-700 ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <SearchBar />
        </div>

        <div
          className={`mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/70 transition-all delay-600 duration-700 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> 10k+ Listings
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> All across India
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Verified professionals
          </span>
        </div>
      </div>
    </section>
  );
}
