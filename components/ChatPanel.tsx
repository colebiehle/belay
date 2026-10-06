"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, MessageSquare, X } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { button, iconButton, textarea } from "@/lib/ui";

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
        // Surface failure as an assistant message instead of crashing the page. The
        // `err-` id is what marks it for the alarm treatment below, so the content
        // stays plain text rather than carrying a warning emoji.
        const errText = data.error || `Chat failed (HTTP ${res.status}). If the dev server was just updated, restart it.`;
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: errText,
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
        // The fetch itself failed, so the server is not answering. It is a local
        // tool: say where to look.
        content: `Can't reach Belay on this machine. Is npm run dev running? (${err instanceof Error ? err.message : String(err)})`,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m.filter((msg) => msg.id !== optimistic.id), optimistic, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  // The launcher is a quiet button in the page header, not a floating one: a
  // launcher fixed to the corner covered whatever scrolled under it (Home's Sites
  // "Add" among them), and there is no corner it is guaranteed not to cover. Quiet,
  // not rope: asking Claude is always available but never the page's next move.
  const launcher = (
    <button
      onClick={() => setOpen((o) => !o)}
      className={`${button("quiet")} ${open ? "bg-lift text-fg-1" : ""}`}
      aria-expanded={open}
      aria-label={open ? "Close chat" : "Open chat"}
    >
      <MessageSquare size={16} strokeWidth={1.5} absoluteStrokeWidth />
      Ask Claude
      {messages.length > 0 && <span className="text-meta tabular-nums text-fg-3">{messages.length}</span>}
    </button>
  );

  if (!open) return launcher;

  // A sheet docked to the bottom edge: raised like every other floating layer, the
  // panel radius on the top corners only because the bottom sits on the window edge.
  return (
    <>
    {launcher}
    <div className="fixed bottom-0 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-raised rounded-t-panel shadow-float flex flex-col">
      <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2 border-b border-line-2">
        <div className="min-w-0">
          <p className="text-name text-fg-1">{title}</p>
          <p className="text-meta text-fg-3 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onClear && messages.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("Clear this chat? Messages stay in the database for the brain, but disappear from view and from future prompts.")) return;
                await onClear();
                setMessages([]);
              }}
              className={button("quiet", "compact")}
            >
              Clear
            </button>
          )}
          <button onClick={() => setOpen(false)} className={iconButton("quiet", "compact")} aria-label="Collapse chat">
            <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
          </button>
        </div>
      </div>

      {/* Yours on a lift fill, Claude's on nothing: the fill says who spoke without a
          name on every message, and Claude's answers, the thing you came to read,
          get the full contrast step with no box around them. Errors are alarm with
          the glyph, never colour alone. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && (
          <p className="text-body text-fg-3">
            {emptyHint ?? "Ask Claude anything. Full context is loaded."}
          </p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <p
              key={m.id}
              className="text-body whitespace-pre-wrap text-fg-2 bg-lift rounded-card px-3 py-2"
            >
              {m.content}
            </p>
          ) : m.id.startsWith("err-") ? (
            <p key={m.id} className="flex items-start gap-2 text-body text-alarm">
              <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{m.content}</span>
            </p>
          ) : (
            <p key={m.id} className="text-body whitespace-pre-wrap text-fg-1">
              {m.content}
            </p>
          ),
        )}
        {sending && <p className="text-meta text-fg-3">Writing…</p>}
      </div>

      <div className="border-t border-line-2 p-3 flex items-end gap-2">
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
          rows={1}
          className={`${textarea()} flex-1 max-h-32`}
        />
        <button onClick={send} disabled={sending || !input.trim()} className={button("primary")}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
    </>
  );
}
