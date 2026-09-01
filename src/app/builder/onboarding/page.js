"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import BuilderOnboardingForm from "@/components/builder/BuilderOnboardingForm";
import { useAuth } from "@/context/AuthContext";

function Onboarding() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Logo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Become a Builder
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Set up your professional builder profile to discover land, negotiate
            with landowners and manage your projects.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-white p-6 sm:p-10">
          <BuilderOnboardingForm />
        </div>
      </div>
    </div>
  );
}

export default function BuilderOnboardingPage() {
  return (
    <AuthShell>
      <Onboarding />
    </AuthShell>
  );
}
