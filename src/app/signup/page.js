"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/context/AuthContext";

const PASSWORD_REQS = [
  { regex: /.{8,}/, label: "At least 8 characters" },
  { regex: /[A-Za-z]/, label: "Contains a letter" },
  { regex: /\d/, label: "Contains a number" },
];

function SignupForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Please provide your full name.";
    if (!form.username.trim()) e.username = "Please provide a username.";
    else if (form.username.trim().length < 3)
      e.username = "Username must be at least 3 characters.";
    else if (!/^[a-zA-Z0-9_.]+$/.test(form.username.trim()))
      e.username = "Use letters, numbers, dots or underscores only.";
    if (!form.email.trim()) e.email = "Please provide an email.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      e.email = "Please provide a valid email address.";
    if (!form.password) e.password = "Please provide a password.";
    else if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (form.confirmPassword !== form.password)
      e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const passwordValid = (req) => req.regex.test(form.password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      router.push("/complete-profile");
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
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      <div className="mb-6 lg:hidden">
        <Logo />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Create your account
      </h1>
      <p className="mt-2 text-muted">
        Join Estovia and start exploring the real-estate ecosystem.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          id="name"
          label="Full Name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Arjun Mehta"
          error={errors.name}
          required
        />
        <Input
          id="username"
          label="Username"
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          placeholder="e.g. arjun.mehta"
          error={errors.username}
          hint="Used to log in and display on your profile."
          required
        />
        <Input
          id="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="you@example.com"
          error={errors.email}
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="Create a strong password"
          error={errors.password}
          required
        />
        <div className="mt-1 space-y-1.5">
          {PASSWORD_REQS.map((req) => (
            <p
              key={req.label}
              className={`flex items-center gap-1.5 text-xs ${
                passwordValid(req) ? "text-success" : "text-muted"
              }`}
            >
              <Check
                className={`h-3.5 w-3.5 ${
                  passwordValid(req) ? "text-success" : "text-border"
                }`}
              />
              {req.label}
            </p>
          ))}
        </div>
        <Input
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          placeholder="Re-enter your password"
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
          Create Account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-accent hover:text-accent-soft"
        >
          Log In
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <AuthShell>
      <div className="flex min-h-screen">
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
                Your next real-estate
                <br />
                opportunity starts here.
              </h2>
              <p className="mt-4 max-w-sm text-white/80">
                Create a free account to browse verified land, list your own
                property and connect with buyers, builders and suppliers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-secondary px-4 py-12 sm:px-8 lg:w-1/2">
          <SignupForm />
        </div>
      </div>
    </AuthShell>
  );
}
