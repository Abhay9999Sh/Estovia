"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Building2,
  Bookmark,
  Search,
  MessageSquare,
  CalendarClock,
  FileText,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { label: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard },
  { label: "Explore Projects", href: "/buyer/projects", icon: Building2 },
  { label: "Marketplace", href: "/buyer/marketplace", icon: Search },
  { label: "Saved & Compare", href: "/buyer/saved", icon: Bookmark },
  { label: "My Inquiries", href: "/buyer/inquiries", icon: FileText },
  { label: "Site Visits", href: "/buyer/site-visits", icon: CalendarClock },
  { label: "My Applications", href: "/buyer/applications", icon: FileText },
  { label: "Messages", href: "/buyer/messages", icon: MessageSquare },
  { label: "Profile", href: "/buyer/profile", icon: User },
  { label: "Settings", href: "/buyer/settings", icon: Settings },
];

export default function BuyerDashboardShell({ children, title, subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState({ notifications: [], unread: 0 });
  const [bellLoading, setBellLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function loadNotifs() {
      try {
        const res = await fetch("/api/notifications?limit=20", { cache: "no-store" });
        const data = await res.json();
        if (active) setNotifications({ notifications: data.notifications || [], unread: data.unread || 0 });
      } catch (err) {
        // ignore
      }
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [status, pathname]);

  const markAllRead = async () => {
    setBellLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((p) => ({
        notifications: p.notifications.map((n) => ({ ...n, read: true })),
        unread: 0,
      }));
    } catch (err) {
      // ignore
    } finally {
      setBellLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/buyer/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {user?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "U"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="text-xs text-muted">@{user?.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-red-50 hover:text-danger"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-secondary">
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-white lg:block">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-secondary"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-secondary lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-foreground">{title || "Buyer Dashboard"}</h1>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>

          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative rounded-lg p-2 text-muted hover:bg-secondary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {notifications.unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {notifications.unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-bold text-foreground">Notifications</p>
                  {notifications.unread > 0 && (
                    <button
                      onClick={markAllRead}
                      disabled={bellLoading}
                      className="text-xs font-semibold text-accent hover:text-accent-soft disabled:opacity-60"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet</p>
                  ) : (
                    notifications.notifications.map((n) => (
                      <Link
                        key={n._id}
                        href={n.link || "/buyer/dashboard"}
                        className={`block border-b border-border px-4 py-3 transition-colors hover:bg-secondary ${
                          !n.read ? "bg-accent-light/30" : ""
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
