"use client";

import {
  UserCheck,
  FileCheck2,
  ScrollText,
  ShieldCheck,
  Lock,
  Landmark,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const TRUST_ITEMS = [
  {
    icon: UserCheck,
    title: "Identity Verified",
    desc: "Users complete identity verification before they can transact with confidence.",
  },
  {
    icon: FileCheck2,
    title: "Documents Verified",
    desc: "Ownership documents are reviewed by our verification team before listing is approved.",
  },
  {
    icon: ScrollText,
    title: "RERA Registration",
    desc: "Builders can be checked against the relevant State/UT RERA authority.",
  },
  {
    icon: Landmark,
    title: "Business Verified",
    desc: "Businesses complete verification to unlock trust badges on the platform.",
  },
];

export default function TrustSection() {
  return (
    <section className="bg-secondary py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            Trust &amp; Verification
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Built on trust. Verified for confidence.
          </h2>
          <p className="mt-4 text-muted">
            Every listing and professional goes through a verification process so
            you can deal with confidence.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 100}>
              <div className="group flex h-full flex-col rounded-2xl border border-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent-light hover:shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent transition-transform group-hover:scale-110">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 flex items-start justify-center gap-2 text-xs text-muted">
          <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p className="max-w-2xl">
            Verification statuses reflect our review process. A badge means the
            relevant checks have been completed — it does not constitute a
            government certification.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
