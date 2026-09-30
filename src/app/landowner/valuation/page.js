"use client";

import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ValuationTool from "@/components/valuation/ValuationTool";

/**
 * Landowner entry point.
 *
 * The only model we have covers built-up homes, not land, so this page is
 * explicitly for valuing a home a landowner is thinking of buying or building
 * on, and the land case returns a refusal rather than a number. The
 * `landowner_listing_form` context is recorded on every valuation saved from
 * here so the two flows can be told apart later.
 */
export default function LandownerValuationPage() {
  return (
    <AuthShell>
      <DashboardShell
        title="Valuation"
        subtitle="Check what a home in your area is likely to list for"
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This engine currently values built-up homes only (apartments, houses and
          villas). Land valuations are not supported yet, and asking for one returns a
          clear &quot;not supported&quot; result rather than a made-up figure.
        </div>
        <div className="mt-6">
          <ValuationTool requestContext="landowner_listing_form" />
        </div>
      </DashboardShell>
    </AuthShell>
  );
}
