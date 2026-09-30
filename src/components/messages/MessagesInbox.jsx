"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Loader2, MessageSquarePlus, Flag, Search, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { timeAgo, initials, timeShort } from "@/lib/format";

const CONTEXT_LABELS = {
  landowner_builder: "Land enquiry",
  builder_supplier: "Materials inquiry",
  builder_buyer: "Project booking",
  landowner_buyer: "Land purchase",
  general: "Conversation",
};

const REPORT_CATEGORIES = [
  "Spam or advertising",
  "Harassment",
  "Scam or fraud attempt",
  "Off-platform payment request",
  "Offensive content",
  "Fake identity or profile",
  "Other",
];

export default function MessagesInbox() {
  const { user } = useAuth();
  const myId = String(user?._id || user?.id || "");

  const searchParams = useSearchParams();
  const presetConversationId = searchParams.get("conversation") || null;

  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);
  const [otherParticipant, setOtherParticipant] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const data = await res.json();
      setConversations(data.conversations || []);
      return data.conversations || [];
    } catch {
      setError("Unable to load conversations.");
      return [];
    }
  }, []);

  useEffect(() => {
    let activeFlag = true;
    async function init() {
      const list = await loadConversations();
      if (!activeFlag) return;
      if (presetConversationId) {
        const found = list.find((c) => String(c._id) === presetConversationId);
        if (found) setActive(found._id);
      } else if (list.length > 0) {
        setActive(list[0]._id);
      }
    }
    init();
    return () => {
      activeFlag = false;
    };
  }, [loadConversations, presetConversationId]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingMsgs(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load messages.");
      setMessages(data.messages || []);
      setOtherParticipant(data.otherParticipant || null);
    } catch (err) {
      setError(err.message || "Unable to load messages.");
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => loadMessages(active), 0);
    const interval = setInterval(() => loadMessages(active), 15000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [active, loadMessages]);

  // Refresh list periodically to keep unread badges current.
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => loadConversations(), 15000);
    return () => clearInterval(interval);
  }, [active, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!text.trim() || !active) return;
    setSending(true);
    setError("");
    const body = text;
    setText("");
    try {
      const res = await fetch(`/api/conversations/${active}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send.");
      setMessages((m) => [...(m || []), data.message]);
      loadConversations();
    } catch (err) {
      setError(err.message || "Unable to send.");
      setText(body);
    } finally {
      setSending(false);
    }
  }

  async function selectConversation(convId) {
    setActive(convId);
    await loadMessages(convId);
    loadConversations();
  }

  const activeConv = (conversations || []).find((c) => String(c._id) === active) || null;
  const other = otherParticipant || activeConv?.other || null;
  const otherName = other?.name || other?.username || "Party";

  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <div className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="font-bold text-foreground">Conversations</h3>
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-soft"
            >
              <MessageSquarePlus className="h-4 w-4" /> New message
            </button>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {conversations === null ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                No conversations yet.
                <span className="mt-1 block text-xs">
                  Start one by messaging a landowner, builder, supplier or buyer.
                </span>
              </p>
            ) : (
              conversations.map((c) => {
                const party = c.other || {};
                const partyName = party.name || party.username || "Party";
                return (
                  <button
                    key={String(c._id)}
                    onClick={() => selectConversation(c._id)}
                    className={`block w-full border-b border-border px-4 py-3 text-left transition-colors ${
                      active === c._id ? "bg-accent-light/40" : "hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                        {initials(partyName)}
                        {(c.unreadCount || 0) > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{partyName}</span>
                          <span className="shrink-0 text-[11px] text-muted">
                            {c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.lastMessage ? c.lastMessage.text : CONTEXT_LABELS[c.context] || "Conversation"}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      <div className="flex flex-col lg:col-span-4">
        <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {other ? initials(otherName) : "?"}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {active ? otherName : "Select a conversation"}
                </p>
                <p className="text-xs text-muted capitalize">
                  {active && other ? ((other.primaryRole || other.roles?.[0] || other.role || "")) : CONTEXT_LABELS[activeConv?.context] || ""}
                </p>
              </div>
            </div>
            {active && (
              <button
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-red-300 hover:bg-red-50 hover:text-danger"
              >
                <Flag className="h-3.5 w-3.5" /> Report
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4" style={{ minHeight: "300px", maxHeight: "50vh" }}>
            {loadingMsgs ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : !messages ? (
              <p className="py-10 text-center text-sm text-muted">Select a conversation to view messages.</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello!</p>
            ) : (
              messages.map((m) => {
                const mine = myId && String(m.senderId) === myId;
                return (
                  <div key={String(m._id)} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        mine ? "rounded-br-sm bg-accent text-white" : "rounded-bl-sm border border-border bg-white text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text || ""}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>{timeShort(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Type a message..."
              className="min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim() || !active}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white transition-colors hover:bg-accent-soft disabled:opacity-50"
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {newOpen && <NewMessageModal onClose={() => setNewOpen(false)} onStart={(convId) => { setNewOpen(false); selectConversation(convId); }} />}
      {reportOpen && activeConv && (
        <ReportMessageModal
          onClose={() => setReportOpen(false)}
          conversationId={String(activeConv._id)}
          otherName={otherName}
          lastMessage={activeConv.lastMessage?.text || ""}
        />
      )}
    </div>
  );
}

function NewMessageModal({ onClose, onStart }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/messaging/recipients?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to search.");
        setResults(data.recipients || []);
      } catch (err) {
        setError(err.message || "Unable to search.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function start(recipient) {
    if (starting) return;
    setStarting(String(recipient._id));
    setError("");
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to start conversation.");
      onStart(String(data.conversation._id));
    } catch (err) {
      setError(err.message || "Unable to start conversation.");
    } finally {
      setStarting("");
    }
  }

  return (
    <Modal open onClose={onClose} title="New message" size="md">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or username…"
            autoFocus
            className="h-11 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </div>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && results && results.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">No users found.</p>
        )}

        {!loading && results && results.length > 0 && (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <button
                key={String(r._id)}
                onClick={() => start(r)}
                disabled={Boolean(starting)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-left transition-colors hover:border-accent"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {initials(r.name || r.username)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{r.name || r.username}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.email || `@${r.username}`}
                    {r.primaryRole && r.primaryRole !== "viewer" ? ` • ${r.primaryRole}` : ""}
                  </span>
                </span>
                {starting === String(r._id) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                ) : (
                  <span className="text-xs font-semibold text-accent">Message</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReportMessageModal({ onClose, conversationId, otherName, lastMessage }) {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "message",
          subjectId: conversationId,
          category,
          description: description.trim(),
          priority: "MEDIUM",
          metadata: {
            conversationId,
            otherParticipantName: otherName,
            lastMessagePreview: String(lastMessage || "").slice(0, 500),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit report.");
      setDone(true);
    } catch (err) {
      setError(err.message || "Unable to submit report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Report conversation" subtitle="Our moderation team will review this privately.">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="font-semibold text-foreground">Report submitted</p>
          <p className="text-sm text-muted">Thank you for helping keep Estovia safe. Your report was sent and a moderator will review it.</p>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Reason</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-accent"
            >
              {REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Textarea
            rows={4}
            label="Details"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`What happened in your conversation with ${otherName}?`}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={submit}>
              <Flag className="h-4 w-4" /> Submit report
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}