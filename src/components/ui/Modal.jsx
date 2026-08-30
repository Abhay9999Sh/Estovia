"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
      overlayRef.current?.focus?.();
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
      ? "max-w-3xl"
      : "max-w-xl";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className={`relative z-10 w-full ${sizeClass} rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
