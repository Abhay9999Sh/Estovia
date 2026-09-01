"use client";

import { useState } from "react";
import { Bell, Send } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import AdminFilters from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import { AdminLoading, AdminError, AdminEmpty, Card } from "@/components/admin/AdminStates";
import StatusBadge from "@/components/admin/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";
import { timeAgo } from "@/lib/format";

function buildUrl(page, q) {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", page);
  if (q) p.set("q", q);
  return `/api/admin/notifications${p.toString() ? `?${p}` : ""}`;
}

export default function AdminNotificationsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("/api/admin/notifications");
  const { data, loading, error, refetch } = useAdminFetch(url);

  const [mode, setMode] = useState("all");
  const [role, setRole] = useState("landowner");
  const [userIds, setUserIds] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);

  const onSearch = (v) => {
    setQ(v);
    setPage(1);
    setUrl(buildUrl(1, v));
  };
  const onPage = (p) => {
    setPage(p);
    setUrl(buildUrl(p, q));
  };

  async function sendBroadcast() {
    setBusy(true);
    setFlash(null);
    try {
      const payload = {
        mode,
        role: mode === "role" ? role : "",
        userIds: mode === "specific" ? userIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        title,
        message,
        link,
        type: "project_update",
      };
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFlash({ tone: "danger", message: json.error || json.message || "Failed." });
      } else {
        setFlash({ tone: "success", message: json.message });
        setTitle("");
        setMessage("");
        refetch();
      }
    } catch (err) {
      setFlash({ tone: "danger", message: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];
  const pageCount = data?.pageCount || 1;
  const total = data?.total || 0;

  return (
    <AdminShell title="Notifications" subtitle={`${total} notifications sent`}>
      <div className="space-y-6">
        {flash && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${flash.tone === "danger" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
            {flash.message}
          </div>
        )}

        <Card>
          <h3 className="mb-3 text-sm font-bold text-foreground">Broadcast</h3>
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <Button variant={mode === "all" ? "primary" : "outline"} size="sm" onClick={() => setMode("all")}>
              All users
            </Button>
            <Button variant={mode === "role" ? "primary" : "outline"} size="sm" onClick={() => setMode("role")}>
              By role
            </Button>
            <Button variant={mode === "specific" ? "primary" : "outline"} size="sm" onClick={() => setMode("specific")}>
              Specific users
            </Button>
          </div>

          {mode === "role" && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mb-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent sm:w-64"
            >
              {["viewer", "landowner", "builder", "supplier", "buyer"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          {mode === "specific" && (
            <Input
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
              className="mb-3"
              placeholder="Comma-separated user IDs…"
            />
          )}

          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" maxLength={120} />
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notification message" maxLength={2000} />
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Optional link (e.g. /account)" />
            <Button variant="primary" loading={busy} disabled={!title.trim() || !message.trim()} onClick={sendBroadcast}>
              <Send className="h-4 w-4" /> Send broadcast
            </Button>
          </div>
        </Card>

        <div>
          <AdminFilters search={q} onSearch={onSearch} searchPlaceholder="Search notification…" />
          {loading && <div className="mt-4"><AdminLoading rows={6} /></div>}
          {error && <div className="mt-4"><AdminError message={error} onRetry={refetch} /></div>}
          {!loading && !error && items.length === 0 && (
            <div className="mt-4"><AdminEmpty message="No notifications yet." icon={<Bell className="h-6 w-6 text-muted" />} /></div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Read</th>
                    <th className="px-4 py-3 font-semibold">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((n) => (
                    <tr key={String(n._id)} className="transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{n.title}</p>
                        <p className="max-w-[280px] truncate text-xs text-muted">{n.message}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{n.recipient?.name || n.recipient?.username || String(n.userId).slice(-6)}</td>
                      <td className="px-4 py-3"><StatusBadge status={n.type} className="!bg-slate-100 !text-slate-700" /></td>
                      <td className="px-4 py-3"><StatusBadge status={n.read ? "read" : "unread"} /></td>
                      <td className="px-4 py-3 text-xs text-muted">{timeAgo(n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <AdminPagination page={page} pageCount={pageCount} total={total} onPage={onPage} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}