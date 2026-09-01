"use client";

import { useEffect, useState } from "react";
import { Wrench, Plus, Pencil, Trash2 } from "lucide-react";
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
  description: "",
  pricingModel: "",
  price: "",
  turnaroundDays: 0,
  serviceableStates: [],
  equipmentDetails: "",
  isActive: true,
};

function ServicesManager() {
  const { status } = useAuth();
  const [services, setServices] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/supplier/services", { cache: "no-store" });
      const d = await res.json();
      setServices(d.services || []);
    } catch (err) {
      setServices([]);
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

  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      description: s.description,
      pricingModel: s.pricingModel,
      price: s.price,
      turnaroundDays: s.turnaroundDays,
      serviceableStates: s.serviceableStates,
      equipmentDetails: s.equipmentDetails,
      isActive: s.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/supplier/services/${editing._id}` : "/api/supplier/services";
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

  async function remove(s) {
    if (!confirm(`Delete service "${s.name}"?`)) return;
    const res = await fetch(`/api/supplier/services/${s._id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Manage the services you offer to builders.</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </div>

        {!services ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <Wrench className="mx-auto h-10 w-10 text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No services yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add your first service so builders know what you can do.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s._id} className="flex flex-col rounded-2xl border border-border bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">{s.name}</h3>
                    <p className="text-xs text-muted">{s.category}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-muted hover:bg-secondary" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted line-clamp-2">{s.description || "No description"}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-foreground">
                    {formatINR(s.price)}
                    {s.pricingModel ? <span className="text-xs font-medium text-muted"> / {s.pricingModel}</span> : null}
                  </span>
                  {!s.isActive && <Badge tone="muted">Inactive</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted">Turnaround ~{s.turnaroundDays} days</p>
              </div>
            ))}
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Service" : "Add Service"} size="lg">
          <div className="space-y-4">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            <Input label="Service Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Structural Work" />
            <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Pricing Model" value={form.pricingModel} onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}>
                <option value="">Select</option>
                {["Per Project", "Per Sq Ft", "Per Day", "Hourly", "Fixed", "Negotiable"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
              <Input label="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <Input label="Turnaround (days)" type="number" value={form.turnaroundDays} onChange={(e) => setForm({ ...form, turnaroundDays: e.target.value })} />
            </div>
            <Textarea label="Equipment Details" rows={2} value={form.equipmentDetails} onChange={(e) => setForm({ ...form, equipmentDetails: e.target.value })} />
            <Button onClick={save} loading={saving} fullWidth>
              {editing ? "Save Changes" : "Add Service"}
            </Button>
          </div>
        </Modal>
    </>
  );
}

export default function SupplierServicesPage() {
  return (
    <AuthShell>
      <SupplierDashboardShell title="Services">
        <ServicesManager />
      </SupplierDashboardShell>
    </AuthShell>
  );
}
