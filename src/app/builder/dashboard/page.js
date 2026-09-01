"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  Bookmark,
  Users,
  Handshake,
  FolderKanban,
  Hammer,
  ArrowRight,
  Activity,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuilderDashboardShell from "@/components/builder/BuilderDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, tone = "accent", href }) {
  const inner = (
    <div className="rounded-2xl border border-border bg-white p-5 h-full">
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

function DashboardOverview() {
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/builder/dashboard", { cache: "no-store" });
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
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const s = data.stats || {};

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/builder/discover" icon={Compass} label="Land Opportunities" value={s.savedLand + s.interests.total} tone="accent" sub="Discover & engaged" />
        <StatCard href="/builder/saved-land" icon={Bookmark} label="Saved Land" value={s.savedLand} tone="warning" />
        <StatCard href="/builder/interests" icon={Users} label="Active Interests" value={s.interests.pending} tone="primary" sub={`${s.interests.total} total`} />
        <StatCard href="/builder/interests" icon={Users} label="Pending Responses" value={s.interests.pending} tone="warning" />
        <StatCard href="/builder/negotiations" icon={Handshake} label="Active Negotiations" value={s.proposals.active} tone="accent" sub={`${s.proposals.total} proposals`} />
        <StatCard href="/builder/projects" icon={FolderKanban} label="Projects" value={s.projects.total} tone="primary" sub={`${s.projects.active} active`} />
        <StatCard href="/builder/suppliers" icon={Hammer} label="Supplier Requests" value={s.materialRequirements} tone="muted" />
        <StatCard href="/builder/projects" icon={FolderKanban} label="Proposal Conversion" value={`${s.proposals.conversion}%`} tone="muted" />
      </div>

      {!data.hasActivity ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No activity yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Discover land, save what you like and express interest to start
            building relationships.
          </p>
          <Link
            href="/builder/discover"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
          >
            <Compass className="h-4 w-4" /> Discover Land
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-foreground">Recent Activity</h2>
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            {(data.activity || []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No activity yet</p>
            ) : (
              (data.activity || []).map((a) => (
                <Link
                  key={a.id}
                  href={a.link}
                  className="flex items-center gap-4 border-b border-border px-5 py-4 hover:bg-secondary transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="text-xs text-muted">{formatDate(a.time)}</p>
                  </div>
                  <Badge tone="info">{a.status}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuilderDashboardPage() {
  return (
    <AuthShell>
      <BuilderDashboardShell title="Dashboard">
        <DashboardOverview />
      </BuilderDashboardShell>
    </AuthShell>
  );
}
