"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LandPlot,
  HardHat,
  ShoppingCart,
  Hammer,
  ArrowLeft,
  Building2,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  {
    id: "landowner",
    icon: LandPlot,
    title: "Landowner",
    desc: "List land and connect with buyers & builders.",
    cta: "Start as a Landowner",
  },
  {
    id: "builder",
    icon: HardHat,
    title: "Builder",
    desc: "Discover land and manage projects.",
    cta: "Start as a Builder",
  },
  {
    id: "buyer",
    icon: ShoppingCart,
    title: "Buyer",
    desc: "Discover verified properties.",
    cta: "Start as a Buyer",
  },
  {
    id: "supplier",
    icon: Hammer,
    title: "Supplier",
    desc: "Showcase materials & services.",
    cta: "Start as a Supplier",
  },
];

function CompleteProfile() {
  const { isLoggedIn, status, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Logo />
      </div>
    );
  }

  function handleSelect(role) {
    if (role.id === "landowner") {
      router.push("/landowner/onboarding");
    } else if (role.id === "builder") {
      router.push("/builder/onboarding");
    } else if (role.id === "buyer") {
      router.push("/buyer/onboarding");
    } else if (role.id === "supplier") {
      router.push("/supplier/onboarding");
    } else {
      router.push("/account?role=" + role.id);
    }
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/")}
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-sm">
            <Building2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            What best describes you?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Hi {user?.name?.split(" ")[0]}, you registered as a viewer. Choose a
            role to unlock role-specific tools and features.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelect(role)}
              className="group relative flex flex-col items-start rounded-2xl border border-border bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-accent transition-transform group-hover:scale-110">
                <role.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-foreground">
                {role.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted">{role.desc}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                {role.cta}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted">
            Not sure yet?{" "}
            <button
              onClick={() => router.push("/")}
              className="font-semibold text-accent hover:text-accent-soft"
            >
              Continue browsing as a viewer
            </button>
          </p>
          <div className="mt-4">
            <button
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="text-xs text-muted underline hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <AuthShell>
      <CompleteProfile />
    </AuthShell>
  );
}
