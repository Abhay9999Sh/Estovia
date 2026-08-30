"use client";

import {
  UserPlus,
  ShieldCheck,
  Search,
  Handshake,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const STEPS = [
  {
    num: "01",
    icon: UserPlus,
    title: "Create Account",
    desc: "Sign up in under a minute. Your account starts as a viewer so you can explore freely.",
  },
  {
    num: "02",
    icon: ShieldCheck,
    title: "Complete Your Profile",
    desc: "Choose your role and complete verification to unlock the right tools for you.",
  },
  {
    num: "03",
    icon: Search,
    title: "Discover / List",
    desc: "Browse verified land and properties or list your own with location and documents.",
  },
  {
    num: "04",
    icon: Handshake,
    title: "Connect & Transact",
    desc: "Receive and respond to interest, message other parties and transact with confidence.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-secondary py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">
            How It Works
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            From discovery to transaction in four steps
          </h2>
          <p className="mt-4 text-muted">
            A simple, guided journey tailored to each role on the platform.
          </p>
        </Reveal>

        <div className="relative mt-14 grid gap-6 md:grid-cols-4">
          <div className="absolute top-8 left-[12%] right-[12%] hidden h-0.5 bg-border md:block" />
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={i * 120}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-accent shadow-md ring-1 ring-border">
                  <step.icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                  {step.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
