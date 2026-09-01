"use client";

import { useEffect, useState } from "react";
import { IndianRupee } from "lucide-react";
import { Select } from "@/components/ui/Select";

const UNITS = {
  thousand: { label: "Thousand", multiplier: 1e3 },
  lakh: { label: "Lakh", multiplier: 1e5 },
  crore: { label: "Crore", multiplier: 1e7 },
};

function guessUnit(rupees) {
  const n = Number(rupees) || 0;
  if (n >= 1e7) return "crore";
  if (n >= 1e5) return "lakh";
  if (n >= 1e3) return "thousand";
  return "lakh";
}

const fmt = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

/**
 * Money input that lets the user type an amount in Lakh / Crore / Thousand
 * and normalizes it to Indian Rupees. `value` is the rupee amount (number or
 * numeric string); `onChange(rupees)` is called with the rupee number.
 */
export default function MoneyInput({
  label,
  value = 0,
  onChange,
  unit,
  onUnitChange,
  error,
  hint,
  disabled = false,
  placeholder,
  className = "",
}) {
  const [unitState, setUnitState] = useState(() => (unit && UNITS[unit] ? unit : guessUnit(value)));
  const [input, setInput] = useState("");

  useEffect(() => {
    const u = unit && UNITS[unit] ? unit : unitState;
    const multiplier = UNITS[u]?.multiplier || 1;
    const rupees = Number(value) || 0;
    const shown = rupees === 0 ? "" : String(round(rupees / multiplier));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(shown);
  }, [value, unit, unitState]);

  function round(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  const multiplier = (unit && UNITS[unit] ? UNITS[unit] : UNITS[unitState])?.multiplier || 1;

  const currentUnit = unit && UNITS[unit] ? unit : unitState;

  function handleInput(v) {
    if (!/^[0-9]*\.?[0-9]*$/.test(v)) return;
    setInput(v);
    const parsed = Number(v) || 0;
    if (parsed >= 0 && onChange) onChange(round(parsed * multiplier));
  }

  function handleUnit(next) {
    const prev = currentUnit;
    const prevMultiplier = UNITS[prev]?.multiplier || 1;
    const nextMultiplier = UNITS[next]?.multiplier || 1;
    const rupeesNow = Number(value) || 0;
    const newInput = rupeesNow === 0 ? "" : String(round(rupeesNow / nextMultiplier));
    setUnitState(next);
    setInput(newInput);
    if (onUnitChange) onUnitChange(next);
    // Preserve the rupee value when unit changes.
    if (!isNaN(rupeesNow) && prevMultiplier !== nextMultiplier && onChange) {
      onChange(rupeesNow);
    }
  }

  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={placeholder || "e.g. 25"}
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
        </div>
        <div className="w-32 shrink-0">
          <Select
            aria-label="Unit"
            value={currentUnit}
            onChange={(e) => handleUnit(e.target.value)}
            disabled={disabled}
          >
            {Object.entries(UNITS).map(([k, u]) => (
              <option key={k} value={k}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        {Number(value) > 0 ? (
          <span className="text-muted">{fmt(value)}</span>
        ) : (
          <span className="text-muted/60">Enter the amount in {UNITS[currentUnit].label}s</span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}