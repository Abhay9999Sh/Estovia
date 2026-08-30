"use client";

import { Check } from "lucide-react";

export default function Stepper({ steps, current, labels, onStepClick }) {
  return (
    <ol className="flex items-center gap-0 sm:gap-2 overflow-x-auto">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(index)}
              className="flex items-center gap-2 group"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  active
                    ? "bg-accent text-white ring-4 ring-accent-light"
                    : done
                    ? "bg-accent-light text-accent"
                    : "bg-secondary text-muted"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`hidden sm:inline text-sm font-medium ${
                  active ? "text-foreground" : done ? "text-accent" : "text-muted"
                }`}
              >
                {labels?.[index] || step}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={`h-0.5 w-6 sm:w-10 rounded ${
                  index < current ? "bg-accent" : "bg-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
