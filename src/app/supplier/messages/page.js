"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import SupplierDashboardShell from "@/components/supplier/SupplierDashboardShell";
import Skeleton from "@/components/ui/Skeleton";

function MessagesContent() {
  const searchParams = useSearchParams();
  const presetConversationId = searchParams.get("conversation") || null;
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const data = await res.json();
      setConversations(data.conversations || []);
      return data.conversations || [];
    } catch (err) {
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
        const found = list.find((c) => c._id === presetConversationId);
        if (found) setActive(found._id);
      } else if (list.length > 0) {
        setActive(list[0]._id);
      }
    }
    init();
    return () => { activeFlag = false; };
  }, [loadConversations, presetConversationId]);

  const loadMessages = useCallback(async (convId) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, { cache: "no-store" });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError("Unable to load messages.");
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => loadMessages(active), 0);
    const interval = setInterval(() => loadMessages(active), 15000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [active, loadMessages]);

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
      setConversations((prev) =>
        prev.map((c) => (c._id === active ? { ...c, lastMessageAt: data.sentAt } : c)).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0))
      );
    } catch (err) {
      setError(err.message || "Unable to send.");
      setText(body);
    } finally {
      setSending(false);
    }
  }

  const activeConv = (conversations || []).find((c) => c._id === active);
  const otherParty = activeConv
    ? (activeConv.builderId?.name ? activeConv.builderId : activeConv.supplierId) || {}
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-bold text-foreground">Conversations</h3>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {conversations === null ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No conversations yet.</p>
            ) : (
              conversations.map((c) => {
                const party = c.builderId?.name ? c.builderId : c.supplierId;
                return (
                  <button
                    key={c._id}
                    onClick={() => setActive(c._id)}
                    className={`block w-full border-b border-border px-4 py-3 text-left transition-colors ${
                      active === c._id ? "bg-accent-light/40" : "hover:bg-secondary"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{party?.name || "Party"}</p>
                    <p className="truncate text-xs text-muted">{c.context || "Conversation"}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : "No messages yet"}
                    </p>
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
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {otherParty?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{otherParty?.name || "Select a conversation"}</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 p-4" style={{ minHeight: "320px", maxHeight: "50vh" }}>
            {loadingMsgs ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : !messages ? (
              <p className="py-10 text-center text-sm text-muted">Select a conversation to view messages.</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello!</p>
            ) : (
              messages.map((m) => (
                <div key={m._id} className={`flex ${m.senderRole === "supplier" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      m.senderRole === "supplier"
                        ? "rounded-br-sm bg-accent text-white"
                        : "rounded-bl-sm bg-white border border-border text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`mt-1 text-[10px] ${m.senderRole === "supplier" ? "text-white/70" : "text-muted"}`}>
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
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
    </div>
  );
}

function Inner() {
  return (
    <SupplierDashboardShell title="Messages">
      <MessagesContent />
    </SupplierDashboardShell>
  );
}

export default function SupplierMessagesPage() {
  return (
    <AuthShell>
      <Suspense fallback={<SupplierDashboardShell title="Messages"><div /></SupplierDashboardShell>}>
        <Inner />
      </Suspense>
    </AuthShell>
  );
}
