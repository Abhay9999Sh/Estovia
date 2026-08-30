"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import OnboardingForm from "@/components/landowner/OnboardingForm";
import { useAuth } from "@/context/AuthContext";

function Onboarding() {
  const { status, hasRole } = useAuth();
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
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Become a Landowner
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Complete your landowner profile to list land and connect with serious
            buyers and builders.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-10">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthShell>
      <Onboarding />
    </AuthShell>
  );
}
