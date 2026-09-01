"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";

const PROPOSAL_TYPES = ["Land Purchase", "Joint Development", "Development Agreement", "Lease", "Other"];

export default function ProposalForm({
  onSubmit,
  submitting,
  submitLabel = "Submit Proposal",
  note = "",
  initial = null,
}) {
  const [form, setForm] = useState({
    proposalType: initial?.proposalType || "Land Purchase",
    offeredAmount: initial?.offeredAmount || "",
    revenueShare: initial?.revenueShare != null ? initial.revenueShare : "",
    developmentShare: initial?.developmentShare != null ? initial.developmentShare : "",
    expectedDurationMonths: initial?.expectedDurationMonths || "",
    paymentStructure: initial?.paymentStructure || "",
    investmentEstimate: initial?.investmentEstimate || "",
    terms: initial?.terms || "",
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit() {
    const amount = Number(form.offeredAmount) || 0;
    const revShare = form.revenueShare !== "" ? Number(form.revenueShare) : null;
    if (amount <= 0 && revShare == null) {
      setError("Please provide an offered amount or a revenue share.");
      return;
    }
    setError("");
    onSubmit(form);
  }

  return (
    <div className="space-y-4">
      {note && (
        <p className="rounded-xl border border-accent-light bg-accent-light/30 px-4 py-3 text-sm text-muted">
          {note}
        </p>
      )}

      <Select label="Proposal Type" value={form.proposalType} onChange={(e) => update("proposalType", e.target.value)}>
        {PROPOSAL_TYPES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </Select>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Offered Amount (₹)"
          type="number"
          min="0"
          value={form.offeredAmount}
          onChange={(e) => update("offeredAmount", e.target.value)}
          placeholder="e.g. 50000000"
        />
        <Input
          label="Investment Estimate (₹)"
          type="number"
          min="0"
          value={form.investmentEstimate}
          onChange={(e) => update("investmentEstimate", e.target.value)}
          placeholder="e.g. 80000000"
        />
        <Input
          label="Revenue Share (%)"
          type="number"
          min="0"
          max="100"
          value={form.revenueShare}
          onChange={(e) => update("revenueShare", e.target.value)}
          placeholder="e.g. 30"
        />
        <Input
          label="Development Share (%)"
          type="number"
          min="0"
          max="100"
          value={form.developmentShare}
          onChange={(e) => update("developmentShare", e.target.value)}
          placeholder="e.g. 40"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Expected Duration (months)"
          type="number"
          min="0"
          value={form.expectedDurationMonths}
          onChange={(e) => update("expectedDurationMonths", e.target.value)}
        />
        <Input
          label="Payment Structure"
          value={form.paymentStructure}
          onChange={(e) => update("paymentStructure", e.target.value)}
          placeholder="e.g. 20% upfront, rest on registration"
        />
      </div>

      <Textarea
        label="Terms"
        rows={3}
        value={form.terms}
        onChange={(e) => update("terms", e.target.value)}
        placeholder="Key terms of this proposal..."
      />
      <Textarea
        label="Additional Notes"
        rows={3}
        value={form.notes}
        onChange={(e) => update("notes", e.target.value)}
        placeholder="Anything else the other party should know..."
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button fullWidth onClick={handleSubmit} loading={submitting}>
        {submitLabel}
      </Button>
    </div>
  );
}
