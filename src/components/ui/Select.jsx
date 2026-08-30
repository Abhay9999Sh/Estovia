"use client";

import { forwardRef } from "react";

export const Select = forwardRef(function Select(
  { label, error, hint, className = "", required, id, children, ...props },
  ref
) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
          error ? "border-danger focus:border-danger" : "border-border focus:border-accent"
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export default Select;
