"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";
import { roleDestination } from "@/lib/navigation";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(identifier, password);
      router.push(roleDestination(user));
      router.refresh();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      <div className="mb-8 lg:hidden">
        <Logo />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Welcome Back
      </h1>
      <p className="mt-2 text-muted">
        Log in to continue to your Estovia account.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Input
          id="identifier"
          label="Email or Username"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com or username"
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
        />

        <Button type="submit" fullWidth loading={loading} size="lg">
          Log In
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-accent hover:text-accent-soft"
        >
          Sign Up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
        {/* Left panel - visual */}
        <div className="relative hidden w-1/2 lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url(/home_img.jpg)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-teal-900/80" />
          <div className="relative z-10 flex h-full flex-col justify-between p-12">
            <Logo dark />
            <div>
              <h2 className="text-3xl font-extrabold leading-tight text-white">
                Welcome back to
                <br />
                your real-estate journey.
              </h2>
              <p className="mt-4 max-w-sm text-white/80">
                Manage your listings, connect with buyers and builders, and track
                verification all in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex w-full items-center justify-center bg-secondary px-4 py-12 sm:px-8 lg:w-1/2 lg:overflow-y-auto lg:py-8">
          <LoginForm />
        </div>
      </div>
    </AuthShell>
  );
}
