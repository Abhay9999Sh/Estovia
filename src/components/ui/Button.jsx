"use client";

import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-accent text-white hover:bg-accent-soft focus-visible:outline-accent shadow-sm",
  secondary:
    "bg-primary text-white hover:bg-primary-light focus-visible:outline-primary",
  outline:
    "border border-border bg-white text-foreground hover:border-accent hover:text-accent focus-visible:outline-accent",
  ghost:
    "text-muted hover:bg-secondary hover:text-foreground focus-visible:outline-accent",
  danger:
    "bg-danger text-white hover:bg-red-700 focus-visible:outline-danger",
  gold:
    "bg-warning text-white hover:bg-amber-600 focus-visible:outline-warning",
  light:
    "bg-white text-primary hover:bg-gray-100 focus-visible:outline-white",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
  icon: "h-10 w-10",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  fullWidth = false,
  ...props
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
