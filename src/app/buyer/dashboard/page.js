"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  Bookmark,
  FileText,
  CalendarClock,
  ClipboardList,
  ArrowRight,
  Activity,
  Building2,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, tone = "accent", href }) {
  const inner = (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            tone === "accent"
              ? "bg-accent-light text-accent"
              : tone === "warning"
              ? "bg-amber-50 text-amber-600"
              : tone === "primary"
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="text-2xl font-extrabold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

const appTone = {
  Initiated: "muted",
  "Personal Details": "muted",
  "Document Upload": "info",
  "Verification/Review": "warning",
  "Offer Stage": "warning",
  Financing: "warning",
  Payment: "warning",
  "Awaiting Allotment": "info",
  Allotted: "info",
  Registered: "success",
  Closed: "muted",
  Cancelled: "danger",
  Rejected: "danger",
};

function DashboardOverview() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/buyer/dashboard", { cache: "no-store" });
        const d = await res.json();
        if (active) setData(d);
      } catch (err) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [status]);

  if (loading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const a = data.analytics || {};

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/buyer/projects" icon={Compass} label="Explore Projects" value="Discover" tone="accent" sub="Browse the marketplace" />
        <StatCard href="/buyer/saved" icon={Bookmark} label="Saved Items" value={a.savedCount || 0} tone="warning" />
        <StatCard href="/buyer/inquiries" icon={FileText} label="Inquiries" value={a.inquiryCount || 0} tone="primary" sub={`${a.openInquiries || 0} open`} />
        <StatCard href="/buyer/site-visits" icon={CalendarClock} label="Site Visits" value={a.siteVisitCount || 0} tone="accent" />
        <StatCard href="/buyer/applications" icon={ClipboardList} label="Applications" value={a.applicationCount || 0} tone="primary" />
      </div>

      {!data.profile ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">Complete your buyer profile</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Set up your preferences so we can surface the best properties for you.
          </p>
          <Link
            href="/buyer/onboarding"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
          >
            <Building2 className="h-4 w-4" /> Complete Onboarding
          </Link>
        </div>
      ) : (
        (a.savedCount === 0 && a.inquiryCount === 0 && a.applicationCount === 0) && (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Compass className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">Start exploring</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Explore projects, save what you like, send inquiries and book site visits.
            </p>
            <Link
              href="/buyer/projects"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
            >
              <Compass className="h-4 w-4" /> Explore Projects
            </Link>
          </div>
        )
      )}

      {(data.applications || []).length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Recent Applications</h2>
            <Link href="/buyer/applications" className="text-sm font-semibold text-accent hover:text-accent-soft">View all</Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            {data.applications.map((app) => (
              <Link key={app._id} href={`/buyer/applications/${app._id}`} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-secondary">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{app.applicationNumber}</p>
                  <p className="text-xs text-muted">{app.projectId?.name || "Project"} · {formatDate(app.createdAt)}</p>
                </div>
                <Badge tone={appTone[app.status] || "muted"}>{app.status}</Badge>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuyerDashboardPage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Dashboard" subtitle="Welcome to Estovia Marketplace">
        <DashboardOverview />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
