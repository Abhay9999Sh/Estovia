"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Map,
  Activity,
  Eye,
  Users,
  ShieldCheck,
  ArrowRight,
  PlusSquare,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthShell from "@/components/auth/AuthShell";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, tone = "accent" }) {
  return (
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
}

function DashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [landRes] = await Promise.all([
          fetch("/api/landowner/land", { cache: "no-store" }),
        ]);
        const landData = await landRes.json();
        if (active) setListings(landData.listings || []);
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
  }, []);

  useEffect(() => {
    if (!listings) return;
    const total = listings.length;
    const active = listings.filter((l) => l.status === "active").length;
    const views = listings.reduce((s, l) => s + (l.views || 0), 0);
    const interested = listings.reduce((s, l) => s + (l.interestedUsers || 0), 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats({
      total,
      active,
      views,
      interested,
      verified: listings.filter((l) => l.verificationStatus === "verified").length,
    });
  }, [listings]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!stats ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))
        ) : (
          <>
            <StatCard
              icon={Map}
              label="Total Listings"
              value={stats.total}
              tone="accent"
            />
            <StatCard
              icon={Activity}
              label="Active"
              value={stats.active}
              tone="primary"
            />
            <StatCard
              icon={Eye}
              label="Total Views"
              value={stats.views}
              tone="warning"
            />
            <StatCard
              icon={Users}
              label="Interested Users"
              value={stats.interested}
              tone="accent"
            />
            <StatCard
              icon={ShieldCheck}
              label="Verified"
              value={stats.verified}
              tone="primary"
            />
            <StatCard
              icon={Eye}
              label="Pending Review"
              value={listings?.filter((l) =>
                ["draft", "submitted", "under_review"].includes(l.verificationStatus)
              ).length || 0}
              tone="warning"
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Recent Listings</h2>
            <Link
              href="/landowner/land"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-soft"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {listings && listings.length > 0 ? (
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-secondary px-5 py-3 text-xs font-semibold text-muted">
                <span>Title</span>
                <span>Status</span>
                <span>Verification</span>
                <span>Views</span>
                <span></span>
              </div>
              {listings.slice(0, 5).map((l) => (
                <Link
                  key={l._id}
                  href={`/landowner/land/${l._id}`}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 border-b border-border px-5 py-4 hover:bg-secondary transition-colors md:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {l.title}
                    </p>
                    <p className="text-xs text-muted">
                      {l.location?.city || l.location?.address || "—"}
                    </p>
                  </div>
                  <div>
                    <Badge
                      tone={
                        l.status === "active"
                          ? "success"
                          : l.status === "paused"
                          ? "warning"
                          : "muted"
                      }
                    >
                      {l.status}
                    </Badge>
                  </div>
                  <div>
                    <Badge
                      tone={
                        l.verificationStatus === "verified"
                          ? "success"
                          : l.verificationStatus === "rejected"
                          ? "danger"
                          : "info"
                      }
                    >
                      {l.verificationStatus}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium text-foreground">{l.views || 0}</div>
                  <div className="hidden md:block text-muted">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
              <PlusSquare className="mx-auto h-10 w-10 text-muted" />
              <h3 className="mt-4 text-lg font-bold text-foreground">
                No listings yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Start by adding your first land listing to get discovered by
                buyers and builders.
              </p>
              <Link
                href="/landowner/land/new"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-soft"
              >
                <PlusSquare className="h-4 w-4" /> Add Your First Land
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthShell>
      <DashboardShell title="Dashboard">
        <DashboardOverview />
      </DashboardShell>
    </AuthShell>
  );
}
