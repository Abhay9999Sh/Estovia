import Link from "next/link";
import { Globe, Send, MessageCircle, Share2, Mail, MapPin } from "lucide-react";
import Logo from "@/components/Logo";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "About", href: "/about" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Properties", href: "/explore?type=residential" },
      { label: "Land", href: "/explore?type=land" },
      { label: "Builders", href: "#roles" },
      { label: "Suppliers", href: "#roles" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "#" },
      { label: "Verification", href: "#" },
      { label: "RERA Information", href: "#" },
      { label: "FAQs", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Disclaimer", href: "#" },
    ],
  },
];

const socials = [
  { icon: Globe, label: "Website", href: "#" },
  { icon: Send, label: "Telegram", href: "#" },
  { icon: MessageCircle, label: "Chat", href: "#" },
  { icon: Share2, label: "Share", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-5">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Find land, build opportunities and connect with trusted
              real-estate professionals across India.
            </p>
            <div className="mt-5 space-y-2 text-sm text-muted">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> hello@estovia.example
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> India
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-foreground">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Estovia. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            © OpenStreetMap contributors · Not a government-certified platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
