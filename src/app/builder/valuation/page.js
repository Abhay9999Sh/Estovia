"use client";

import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import ValuationTool from "@/components/valuation/ValuationTool";

/**
 * Builder entry point: sanity-check a unit before pricing it in a project.
 * Saved as `builder_unit` so it can be compared against later project records.
 */
export default function BuilderValuationPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell
        title="Unit valuation"
        subtitle="Estimate the market asking price for a unit in your project"
      >
        <ValuationTool requestContext="builder_unit" />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
