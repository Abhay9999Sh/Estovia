"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileCheck2,
  Map,
  Building2,
  Boxes,
  Package,
  ClipboardList,
  Gavel,
  ShoppingCart,
  Banknote,
  Flag,
  BarChart3,
  Bell,
  ScrollText,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { initials } from "@/lib/format";
import Logo from "@/components/Logo";

const NAV = [
  { section: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }] },
  {
    section: "Platform",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Verification", href: "/admin/verification", icon: ShieldCheck },
      { label: "Documents", href: "/admin/documents", icon: FileCheck2 },
      { label: "Reports & Disputes", href: "/admin/reports", icon: Flag },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
  {
    section: "Marketplace",
    items: [
      { label: "Land Listings", href: "/admin/land", icon: Map },
      { label: "Projects", href: "/admin/projects", icon: Building2 },
      { label: "Properties", href: "/admin/properties", icon: Building2 },
    ],
  },
  {
    section: "Procurement",
    items: [
      { label: "Suppliers", href: "/admin/suppliers", icon: Users },
      { label: "Materials", href: "/admin/materials", icon: Boxes },
      { label: "Requirements", href: "/admin/requirements", icon: ClipboardList },
      { label: "Bids (Quotations)", href: "/admin/bids", icon: Gavel },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
    ],
  },
  {
    section: "Insights",
    items: [
      { label: "Transactions", href: "/admin/transactions", icon: Banknote },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Audit Logs", href: "/admin/logs", icon: ScrollText },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export default function AdminShell({ children, title = "Admin", subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !(Array.isArray(user?.roles) && user.roles.includes("admin"))) {
      router.replace("/");
    }
  }, [status, user, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user?.name || "Admin"}</p>
            <p className="text-xs text-muted">@{user?.username || "admin"}</p>
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
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-xl">
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
            <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          <Link
            href="/"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-secondary hover:text-foreground sm:block"
          >
            View site
          </Link>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}