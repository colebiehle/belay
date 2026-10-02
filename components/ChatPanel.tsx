"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export function ChatPanel({
  storageKey,
  title,
  subtitle,
  fetchUrl,
  postUrl,
  emptyHint,
  onClear,
}: {
  storageKey: string;
  title: string;
  subtitle: string;
  fetchUrl: string;
  postUrl: string;
  emptyHint?: string;
  // Optional clear handler — renders a Clear link in the header. The caller
  // owns the server call; this component just empties local state on success.
  onClear?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "open") setOpen(true);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, open ? "open" : "closed");
  }, [open, storageKey]);

  useEffect(() => {
    // Resilient fetch: a 500 / empty body from the chat endpoint should not crash
    // the whole page. We surface nothing visually and keep the panel usable so
    // the user can still send a message (which surfaces real errors via send()).
    fetch(fetchUrl)
      .then(async (r) => {
        if (!r.ok) return [];
        const text = await r.text();
        if (!text.trim()) return [];
        try { return JSON.parse(text); } catch { return []; }
      })
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [fetchUrl]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const userText = input.trim();
    setInput("");
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: userText,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userText }),
      });
      const text = await res.text();
      let data: { user?: ChatMessage; assistant?: ChatMessage; error?: string } = {};
      if (text.trim()) {
        try { data = JSON.parse(text); } catch { data = {}; }
      }
      if (!res.ok || data.error) {
        // Surface failure as an assistant message instead of crashing the page.
        const errText = data.error || `Chat failed (HTTP ${res.status}). If the dev server was just updated, restart it.`;
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${errText}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((m) => [...m.filter((msg) => msg.id !== optimistic.id), optimistic, errorMsg]);
      } else if (data.user && data.assistant) {
        setMessages((m) => {
          const without = m.filter((msg) => msg.id !== optimistic.id);
          return [...without, data.user!, data.assistant!];
        });
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Network error: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m.filter((msg) => msg.id !== optimistic.id), optimistic, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-accent-pink text-black font-semibold text-sm rounded-full shadow-lg hover:opacity-90 transition-opacity duration-150"
        aria-label="Open chat"
      >
        <MessageSquare size={16} />
        Chat with Claude
        {messages.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border border-black/40 bg-transparent">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{title}</p>
          <p className="text-sm text-zinc-200 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onClear && messages.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("Clear this chat? Messages stay in the database for the brain, but disappear from view and from future prompts.")) return;
                await onClear();
                setMessages([]);
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-200 transition-colors duration-150"
            aria-label="Collapse chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && (
          <p className="text-sm text-zinc-500">
            {emptyHint ?? "Ask Claude anything. Full context is loaded."}
          </p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <p
              key={m.id}
              className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-200 border-l-2 border-zinc-700 pl-3"
            >
              {m.content}
            </p>
          ) : (
            <p key={m.id} className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-400">
              {m.content}
            </p>
          ),
        )}
        {sending && <p className="text-sm text-zinc-500 italic">Claude is thinking…</p>}
      </div>

      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <AutoResizeTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask Claude…"
          className="flex-1 text-sm border border-zinc-700 rounded-md px-3 py-2 bg-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent-pink focus:ring-1 focus:ring-accent-pink/30 resize-none transition-all duration-150 max-h-32"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="self-stretch text-sm font-medium px-4 bg-accent-pink text-black rounded-md hover:opacity-90 disabled:opacity-40 transition-all duration-150"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
