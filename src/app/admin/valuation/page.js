"use client";

import AuthShell from "@/components/auth/AuthShell";
import AdminShell from "@/components/admin/AdminShell";
import ValuationTool from "@/components/valuation/ValuationTool";

/**
 * Admin entry point. Same engine as every other role, recorded as `admin_tool`
 * so these valuations can be told apart from user-facing ones when checking
 * whether the model is behaving in production.
 */
export default function AdminValuationPage() {
  return (
    <AuthShell>
      <AdminShell
        title="Valuation engine"
        subtitle="Run the deployed model and inspect its measured accuracy"
      >
        <ValuationTool requestContext="admin_tool" />
      </AdminShell>
    </AuthShell>
  );
}
