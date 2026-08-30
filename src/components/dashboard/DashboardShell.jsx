"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Map,
  PlusSquare,
  Users,
  HardHat,
  MessageSquare,
  FileText,
  ShieldCheck,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { label: "Dashboard", href: "/landowner/dashboard", icon: LayoutDashboard },
  { label: "My Profile", href: "/landowner/profile", icon: User },
  { label: "My Land", href: "/landowner/land", icon: Map },
  { label: "Add Land", href: "/landowner/land/new", icon: PlusSquare },
  { label: "Interested Buyers", href: "/landowner/interests?type=buyer", icon: Users },
  { label: "Builder Requests", href: "/landowner/interests?type=builder", icon: HardHat },
  { label: "Messages", href: "/landowner/messages", icon: MessageSquare },
  { label: "Documents", href: "/landowner/documents", icon: FileText },
  { label: "Verification", href: "/landowner/verification", icon: ShieldCheck },
  { label: "Settings", href: "/landowner/settings", icon: Settings },
];

export default function DashboardShell({ children, title, subtitle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

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
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/landowner/dashboard" &&
              pathname.startsWith(item.href.replace("/landowner/interests", "/landowner/interests")));
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
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-white lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setSidebarOpen(false)}
          />
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

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-secondary lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">
              {title || "Landowner Dashboard"}
            </h1>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
