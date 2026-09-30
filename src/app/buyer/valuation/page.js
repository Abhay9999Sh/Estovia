"use client";

import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import ValuationTool from "@/components/valuation/ValuationTool";

/**
 * Buyer entry point. The default context is `standalone_estimate`, which is also
 * what the shared /valuation page records, so buyer estimates stay in one bucket
 * unless they come from a specific property page.
 */
export default function BuyerValuationPage() {
  return (
    <AuthShell>
      <BuyerDashboardShell
        title="Check a property's value"
        subtitle="See what similar homes are asking for, and how accurate that estimate is"
      >
        <ValuationTool requestContext="standalone_estimate" />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
