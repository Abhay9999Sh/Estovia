"use client";

import { forwardRef } from "react";

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = "", required, id, rows = 4, ...props },
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
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
          error ? "border-danger focus:border-danger" : "border-border focus:border-accent"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
