"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { useAuth } from "@/context/AuthContext";
import { listLandTarget } from "@/lib/navigation";

export default function CTASection() {
  const { isLoggedIn, user } = useAuth();
  const listHref = listLandTarget({ isLoggedIn, user });

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-16">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-500/20 blur-2xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/10 blur-2xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Have land to sell, lease or develop?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/80">
                List your land and connect with serious opportunities. Start
                your landowner journey today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={listHref}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-8 text-base font-semibold text-white transition-colors hover:bg-accent-soft sm:w-auto"
                >
                  List Your Land
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/15 sm:w-auto"
                >
                  Explore Properties
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
