"use client";

import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import LandForm from "@/components/land/LandForm";

export default function AddLandPage() {
  return (
    <AuthShell>
      <DashboardShell title="Add Land">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Add New Land</h2>
          <p className="text-sm text-muted">
            Provide details about your land, select its location on the map and
            upload ownership documents.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <LandForm />
        </div>
      </DashboardShell>
    </AuthShell>
  );
}
