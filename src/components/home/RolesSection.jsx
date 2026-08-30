"use client";

import Link from "next/link";
import {
  LandPlot,
  HardHat,
  ShoppingCart,
  Hammer,
  ArrowRight,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { useAuth } from "@/context/AuthContext";
import { listLandTarget } from "@/lib/navigation";

const ROLES = [
  {
    icon: LandPlot,
    title: "Landowners",
    desc: "List land and connect with potential buyers and builders ready to transact.",
    cta: "List Your Land",
    href: "/complete-profile",
    dynamic: true,
    color: "from-teal-500 to-emerald-600",
    accent: "text-accent bg-accent-light",
  },
  {
    icon: HardHat,
    title: "Builders",
    desc: "Discover land, manage projects and connect with trusted suppliers.",
    cta: "Become a Builder",
    href: "/signup",
    color: "from-blue-500 to-indigo-600",
    accent: "text-blue-600 bg-blue-50",
  },
  {
    icon: ShoppingCart,
    title: "Buyers",
    desc: "Discover verified properties and opportunities that match your needs.",
    cta: "Browse Properties",
    href: "/explore",
    color: "from-amber-500 to-orange-600",
    accent: "text-amber-600 bg-amber-50",
  },
  {
    icon: Hammer,
    title: "Suppliers",
    desc: "Showcase construction materials and services to builders and users.",
    cta: "Become a Supplier",
    href: "/signup",
    color: "from-slate-600 to-slate-800",
    accent: "text-slate-700 bg-slate-100",
  },
];

export default function RolesSection() {
  const { isLoggedIn, user } = useAuth();
  const listHref = listLandTarget({ isLoggedIn, user });

  return (
    <section id="roles" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            Who It&apos;s For
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            One Platform. Every Real-Estate Role.
          </h2>
          <p className="mt-4 text-muted">
            Whether you own land, build homes, buy property or supply materials —
            Estovia brings the entire ecosystem together.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role, i) => (
            <Reveal key={role.title} delay={i * 100}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                <div
                  className={`h-2 w-full bg-gradient-to-r ${role.color}`}
                />
                <div className="flex flex-1 flex-col p-6">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${role.accent} transition-transform group-hover:scale-110`}
                  >
                    <role.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">
                    {role.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {role.desc}
                  </p>
                  <Link
                    href={role.dynamic ? listHref : role.href}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors group-hover:gap-2.5 group-hover:text-accent-soft"
                  >
                    {role.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
