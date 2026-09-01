"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Boxes, Wrench, MapPin, ArrowRight, ShoppingCart } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

function MarketplaceContent() {
  const { status } = useAuth();
  const [activeTab, setActiveTab] = useState("products");
  const [products, setProducts] = useState(null);
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category) params.set("category", category);
        const res = await fetch(`/api/supplier/products?${params.toString()}`, { cache: "no-store" });
        const d = await res.json();
        if (active) setProducts(d.products || []);
      } catch (e) {
        if (active) setProducts([]);
      }
      try {
        const res2 = await fetch(`/api/supplier/services?${q || category ? "?" + params.toString() : ""}`, { cache: "no-store" });
        const d2 = await res2.json();
        if (active) setServices(d2.services || []);
      } catch (e) {
        if (active) setServices([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [status, q, category]);

  const items = activeTab === "products" ? (products || []) : (services || []);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Search products or services..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === "products" ? "bg-accent text-white" : "border border-border bg-white text-muted"
            }`}
          >
            <Boxes className="mr-1 inline h-4 w-4" /> Products
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === "services" ? "bg-accent text-white" : "border border-border bg-white text-muted"
            }`}
          >
            <Wrench className="mr-1 inline h-4 w-4" /> Services
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No {activeTab} found</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Try adjusting your search or browse different categories.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item._id} className="flex flex-col rounded-2xl border border-border bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{item.name}</h3>
                  <p className="text-xs text-muted">{item.category}{item.brand ? ` · ${item.brand}` : ""}</p>
                </div>
                <Badge tone={item.isActive !== false ? "success" : "muted"}>{item.isActive !== false ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted line-clamp-2">{item.description || "No description"}</p>
              {activeTab === "products" ? (
                <div className="mt-4">
                  <p className="text-lg font-extrabold text-foreground">{formatINR(item.pricePerUnit)}<span className="text-xs font-medium text-muted"> / {item.unit}</span></p>
                  <p className="mt-1 text-xs text-muted">MOQ {item.moq || 1} · Lead {item.leadTimeDays || 0}d</p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-lg font-extrabold text-foreground">{formatINR(item.price)}</p>
                  <p className="mt-1 text-xs text-muted">{item.pricingModel} · {item.turnaroundDays || 0}d turnaround</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function BuyerMarketplacePage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Marketplace" subtitle="Browse products and services from verified suppliers">
        <MarketplaceContent />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
