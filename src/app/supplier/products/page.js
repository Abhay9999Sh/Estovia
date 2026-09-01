"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";

const EMPTY = {
  name: "",
  category: "",
  subcategory: "",
  description: "",
  unit: "unit",
  pricePerUnit: "",
  discountPercent: 0,
  brand: "",
  specifications: "",
  moq: 0,
  availableQuantity: 0,
  leadTimeDays: 0,
  isActive: true,
};

function ProductsManager() {
  const { status } = useAuth();
  const [products, setProducts] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/supplier/products", { cache: "no-store" });
      const d = await res.json();
      setProducts(d.products || []);
    } catch (err) {
      setProducts([]);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [status]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      description: p.description,
      unit: p.unit,
      pricePerUnit: p.pricePerUnit,
      discountPercent: p.discountPercent,
      brand: p.brand,
      specifications: p.specifications,
      moq: p.moq,
      availableQuantity: p.availableQuantity,
      leadTimeDays: p.leadTimeDays,
      isActive: p.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/supplier/products/${editing._id}` : "/api/supplier/products";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Something went wrong.");
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p) {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    const res = await fetch(`/api/supplier/products/${p._id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Manage the materials &amp; products you supply.</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
        </div>

        {!products ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Boxes className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No products yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add your first product so builders can see what you supply.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p._id} className="flex flex-col rounded-2xl border border-border bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}{p.brand ? ` · ${p.brand}` : ""}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-muted hover:bg-secondary" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted line-clamp-2">{p.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-foreground">
                    {formatINR(p.pricePerUnit)}
                    <span className="text-xs font-medium text-muted"> / {p.unit}</span>
                  </span>
                  {!p.isActive && <Badge tone="muted">Inactive</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  MOQ {p.moq} · qty {p.availableQuantity} · lead {p.leadTimeDays}d
                </p>
              </div>
            ))}
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "Add Product"} size="lg">
          <div className="space-y-4">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            <Input label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Cement" />
              <Input label="Subcategory" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
            </div>
            <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Price / Unit (₹)" type="number" value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} />
              <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {["unit", "bag", "ton", "kg", "sq.ft", "sq.m", "pack", "box", "roll", "no"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
              <Input label="Discount %" type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            </div>
            <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Textarea label="Specifications" rows={2} value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="MOQ" type="number" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
              <Input label="Available Quantity" type="number" value={form.availableQuantity} onChange={(e) => setForm({ ...form, availableQuantity: e.target.value })} />
              <Input label="Lead Time (days)" type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
            </div>
            <Button onClick={save} loading={saving} fullWidth>
              {editing ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </Modal>
    </>
  );
}

export default function SupplierProductsPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Products">
        <ProductsManager />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
