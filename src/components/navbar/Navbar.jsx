"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  User as UserIcon,
  Settings,
  LogOut,
  Map,
  Bookmark,
  Compass,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Explore", href: "/explore" },
  { label: "Properties", href: "/explore?type=residential" },
  { label: "Land", href: "/explore?type=land" },
  { label: "Builders", href: "#roles" },
  { label: "Suppliers", href: "#roles" },
  { label: "How It Works", href: "/#how-it-works" },
];

function getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserMenu({ user, onLogout, onClose }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isLandowner = user?.roles?.includes?.("landowner");
  const isBuilder = user?.roles?.includes?.("builder");
  const hasRole = isLandowner || isBuilder;

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = [
    isLandowner && {
      label: "Landowner Dashboard",
      href: "/landowner/dashboard",
      icon: LayoutDashboard,
    },
    isBuilder && {
      label: "Builder Dashboard",
      href: "/builder/dashboard",
      icon: LayoutDashboard,
    },
    !hasRole && {
      label: "Complete Profile",
      href: "/complete-profile",
      icon: Compass,
    },
    { label: "My Profile", href: "/account", icon: UserIcon },
    { label: "My Listings", href: "/account/listings", icon: Map },
    { label: "Saved", href: "/account/saved", icon: Bookmark },
    { label: "Settings", href: "/account/settings", icon: Settings },
  ].filter(Boolean);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-white/10 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            getInitials(user?.name)
          )}
        </span>
        <span className="hidden sm:block text-sm font-medium text-white">
          {user?.name?.split(" ")[0]}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-border bg-white p-1.5 shadow-xl">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {user?.name}
            </p>
            <p className="truncate text-xs text-muted">@{user?.username}</p>
          </div>
          <div className="py-1">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  onClose?.();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
              >
                <item.icon className="h-4 w-4 text-muted" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border pt-1">
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const overHero =
    pathname === "/" && !scrolled && !mobileOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  const linkStyles = scrolled || !overHero
    ? "text-muted hover:text-accent"
    : "text-white/85 hover:text-white";

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[950] transition-all duration-300 ${
        overHero
          ? "bg-transparent py-4"
          : "border-b border-border bg-white/90 backdrop-blur-md shadow-sm py-3"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className={`${overHero ? "" : ""}`}>
          <Logo dark={overHero && !scrolled} />
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-sm font-medium transition-colors ${linkStyles}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <UserMenu user={user} onLogout={handleLogout} onClose={() => setMobileOpen(false)} />
          ) : (
            <>
              <Link
                href="/login"
                className={`hidden sm:inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  overHero
                    ? "text-white hover:bg-white/10"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-soft"
              >
                Sign Up
              </Link>
            </>
          )}

          <button
            className={`ml-1 rounded-lg p-2 lg:hidden transition-colors ${
              overHero ? "text-white hover:bg-white/10" : "text-foreground hover:bg-secondary"
            }`}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-[64px] z-[949] bg-white">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-1 overflow-y-auto h-full">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-foreground hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}
            {!isLoggedIn && (
              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold text-foreground"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
