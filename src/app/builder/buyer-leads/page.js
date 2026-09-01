"use client";

import { ShoppingCart, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";

export default function BuyerLeadsPage() {
  const router = useRouter();
  return (
    <AuthShell>
      <BuilderDashboardShell title="Buyer Leads">
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">Buyer Leads</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Buyer leads for your projects will appear here once the buyer module goes live.
          </p>
          <button
            onClick={() => router.push("/builder/projects")}
            className="mx-auto mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft"
          >
            Manage Projects <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </BuilderDashboardShell>
    </AuthShell>
  );
}
