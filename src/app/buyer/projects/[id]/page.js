"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  CalendarClock,
  Send,
  ClipboardList,
} from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import BuyerDashboardShell from "@/components/buyer/BuyerDashboardShell";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import MoneyInput from "@/components/ui/MoneyInput";
import { formatDate, formatINR } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import { isValidIndianPhone, PHONE_ERROR } from "@/lib/phone";

function ProjectDetail() {
  const { id } = useParams();
  const { status } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'inquiry' | 'visit' | 'apply'
  const [selectedUnit, setSelectedUnit] = useState("");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  async function load() {
    try {
      const res = await fetch(`/api/buyer/projects/${id}`, { cache: "no-store" });
      const d = await res.json();
      setData(d);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [status, id]);

  async function toggleSave() {
    if (data.saved) {
      await fetch(`/api/buyer/saved/${id}`, { method: "DELETE" });
    } else {
      await fetch("/api/buyer/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "project", entityId: id }),
      });
    }
    setData((d) => ({ ...d, saved: !d.saved }));
  }

  function openInquiry(unit) {
    setSelectedUnit(unit || "");
    setError("");
    setDone(null);
    setAction("inquiry");
  }
  function openVisit(unit) {
    setSelectedUnit(unit || "");
    setError("");
    setDone(null);
    setAction("visit");
  }
  function openApply(unit) {
    setSelectedUnit(unit || "");
    setError("");
    setDone(null);
    setAction("apply");
  }

  async function submitInquiry() {
    setSaving(true);
    setError("");
    if (form.phone && !isValidIndianPhone(form.phone)) {
      setError(PHONE_ERROR);
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/buyer/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builderId: data.project.builderId,
          projectId: id,
          unitId: selectedUnit || null,
          type: form.type || "Project Inquiry",
          message: form.message || "",
          contact: { name: form.name, phone: form.phone, email: form.email },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to send inquiry.");
      setDone("Your inquiry was sent to the builder.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitVisit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/buyer/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          unitId: selectedUnit || null,
          requestedDate: form.date,
          requestedTimeSlot: form.timeSlot,
          notes: form.notes || "",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to request site visit.");
      setDone("Site visit requested. The builder will confirm.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitApply() {
    setSaving(true);
    setError("");
    if (!selectedUnit) {
      setError("Please select a unit to apply for.");
      setSaving(false);
      return;
    }
    if (form.phone && !isValidIndianPhone(form.phone)) {
      setError(PHONE_ERROR);
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/buyer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          unitId: selectedUnit,
          buyerDetails: {
            name: form.name,
            pan: form.pan,
            email: form.email,
            phone: form.phone,
            address: form.address,
          },
          financing: { required: form.finance === "yes", mode: form.mode, loanAmount: form.loanAmount },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to submit application.");
      setDone(`Application ${d.application.applicationNumber} submitted. Unit reserved. You can track it in My Applications.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return <Skeleton className="h-96" />;
  }

  const p = data.project;

  return (
    <>
      <Link href="/buyer/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-soft">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="relative h-56 bg-gradient-to-br from-accent-soft to-primary">
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Building2 className="h-14 w-14 text-white/70" />
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-foreground">{p.name}</h1>
                    <Badge tone="warning">{p.status}</Badge>
                    {p.builder?.reraVerified && (
                      <Badge tone="success"><ShieldCheck className="mr-1 h-3 w-3" /> RERA Verified</Badge>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="h-4 w-4" /> {p.location?.address}, {p.location?.city}, {p.location?.state} {p.location?.pincode}
                  </p>
                </div>
                <button
                  onClick={toggleSave}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  {data.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
                  {data.saved ? "Saved" : "Save"}
                </button>
              </div>
              <p className="mt-3 text-sm text-muted">{p.builder?.companyName || "Builder"}</p>
              <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{p.description}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">Available Units</h2>
            {data.units.length === 0 ? (
              <p className="text-sm text-muted">No units currently available in this project.</p>
            ) : (
              <div className="space-y-3">
                {data.units.map((u) => (
                  <div key={u._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                    <div>
                      <p className="font-bold text-foreground">Unit {u.unitNumber}</p>
                      <p className="text-xs text-muted">
                        Type {u.unitType} · {u.sizeSqFt} sq.ft · Floor {u.floor || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-foreground">{formatINR(u.price)}</span>
                      <Button variant="outline" size="sm" onClick={() => openInquiry(u._id)}>
                        <Send className="mr-1 h-3 w-3" /> Inquire
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openVisit(u._id)}>
                        <CalendarClock className="mr-1 h-3 w-3" /> Site Visit
                      </Button>
                      <Button size="sm" onClick={() => openApply(u._id)}>
                        <ClipboardList className="mr-1 h-3 w-3" /> Apply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h3 className="font-bold text-foreground">Quick actions</h3>
            <div className="mt-4 space-y-2">
              <Button variant="outline" fullWidth onClick={() => openInquiry("")}>
                <MessageSquare className="mr-2 h-4 w-4" /> Send an inquiry
              </Button>
              <Button fullWidth onClick={() => openVisit("")}>
                <CalendarClock className="mr-2 h-4 w-4" /> Request a site visit
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5">
            <h3 className="font-bold text-foreground">Project details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Type</dt><dd className="font-semibold text-foreground">{p.projectType}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="font-semibold text-foreground">{p.status}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Completion</dt><dd className="font-semibold text-foreground">{formatDate(p.completionDate)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {done && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
          <p className="font-semibold">{done}</p>
        </div>
      )}

      <Modal open={action === "inquiry"} onClose={() => setAction(null)} title="Send an inquiry" size="md">
        <div className="space-y-3">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Select label="Inquiry type" value={form.type || "Project Inquiry"} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {["Project Inquiry", "Unit Inquiry", "General", "Finance", "Site Visit", "Other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Textarea label="Message" rows={3} value={form.message || ""} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Your name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
          </div>
          <Input label="Email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Button onClick={submitInquiry} loading={saving} fullWidth>Send inquiry</Button>
        </div>
      </Modal>

      <Modal open={action === "visit"} onClose={() => setAction(null)} title="Request a site visit" size="md">
        <div className="space-y-3">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Input label="Preferred date" type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Preferred time slot" placeholder="e.g. Morning (10 AM - 1 PM)" value={form.timeSlot || ""} onChange={(e) => setForm({ ...form, timeSlot: e.target.value })} />
          <Textarea label="Notes" rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={submitVisit} loading={saving} fullWidth>Request site visit</Button>
        </div>
      </Modal>

      <Modal open={action === "apply"} onClose={() => setAction(null)} title="Apply for a unit" size="md">
        <div className="space-y-3">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Select label="Select unit" value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
            <option value="">Select a unit</option>
            {data.units.map((u) => (
              <option key={u._id} value={u._id}>Unit {u.unitNumber} — {formatINR(u.price)}</option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Full name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="PAN" value={form.pan || ""} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
          </div>
          <Textarea label="Address" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Select label="Financing" value={form.finance || "no"} onChange={(e) => setForm({ ...form, finance: e.target.value })}>
            <option value="no">Self-funded / full payment</option>
            <option value="yes">Need a home loan</option>
          </Select>
          {form.finance === "yes" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput label="Loan amount" value={form.loanAmount || 0} onChange={(v) => setForm({ ...form, loanAmount: v })} hint="" />
              <Input label="Lender / mode" value={form.mode || ""} onChange={(e) => setForm({ ...form, mode: e.target.value })} placeholder="e.g. Bank, HFC" />
            </div>
          )}
          <p className="text-xs text-muted">
            Submitting reserves the unit for you and opens an application that the builder will review.
          </p>
          <Button onClick={submitApply} loading={saving} fullWidth>Submit application</Button>
        </div>
      </Modal>
    </>
  );
}

export default function BuyerProjectDetailPage() {
  return (
    <AuthShell>
      <BuyerDashboardShell title="Project Details">
        <ProjectDetail />
      </BuyerDashboardShell>
    </AuthShell>
  );
}
