"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste } from "lucide-react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { button, textarea } from "@/lib/ui";

/**
 * One box for whatever arrives: a LinkedIn profile, call notes, a recruiter email, a
 * thread. Typing those into six separate fields is the step that never happens, so
 * the paste goes in whole and Claude reads it.
 *
 * Nothing is written on read. The route only proposes, and the proposal is shown as
 * a list of changes, field by field, with what is there now beside what would
 * replace it. A model that misreads a date or invents a title would otherwise be
 * silently overwriting the record, and the record is what every draft is built on.
 * Each row can be struck out before Apply, so one bad guess does not cost the rest.
 *
 * The panel owns the meaning: it turns the route's updates into rows (so the labels
 * and the "before" values are its own) and does the writing in onApplied, through
 * the same PATCH and note list it already uses.
 *
 * No company colour: it used to take the panel's brand accent for its border and
 * its verbs, which is exactly the chrome the style guide keeps neutral.
 */

export type PasteNote = { title: string; body: string };
export type PasteProposal = { updates: Record<string, unknown>; note: PasteNote | null };
// One line of the preview. `key` is what onApplied receives back if the row is kept.
export type PasteRow = { key: string; label: string; from: string | null; to: string };

function clip(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

export function PasteAnything({
  endpoint,
  label = "Paste anything",
  placeholder = "Paste anything: a profile, call notes, an email thread.",
  describe,
  onApplied,
}: {
  endpoint: string;
  // The panel names what to paste. "Paste anything" said what the box accepts,
  // not what to put in it, so it read as a feature in search of a use.
  label?: string;
  placeholder?: string;
  // Turns the route's updates into preview rows, with the current value for each.
  describe: (updates: Record<string, unknown>) => PasteRow[];
  // Called on Apply with only the rows left ticked, and the note if it was kept.
  onApplied: (proposal: PasteProposal, kept: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PasteProposal | null>(null);
  // Keys struck out of the preview. "note" is the summary note.
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const boxRef = useRef<HTMLDivElement>(null);

  // The review can be taller than the textarea it replaces, and in the role panel it
  // sits near the bottom, so bring it into view (Apply included) when it arrives.
  useEffect(() => {
    if (proposal) boxRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [proposal]);

  const reset = () => {
    setOpen(false);
    setText("");
    setError(null);
    setProposal(null);
    setDropped(new Set());
  };

  const read = async () => {
    if (!text.trim() || reading) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `Could not read that (HTTP ${res.status})`);
      setProposal({ updates: d.updates ?? {}, note: d.note ?? null });
      setDropped(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const toggle = (key: string) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${button("quiet", "compact")} -ml-2.5`}
        title="Paste a profile, notes or an email, and review what it would change"
      >
        <ClipboardPaste size={14} strokeWidth={1.5} absoluteStrokeWidth /> {label}
      </button>
    );
  }

  const rows = proposal ? describe(proposal.updates) : [];
  const note = proposal?.note ?? null;
  const kept = new Set(rows.map((r) => r.key).filter((k) => !dropped.has(k)));
  const keepNote = !!note && !dropped.has("note");
  const nothing = proposal && rows.length === 0 && !note;

  return (
    // Escape backs out of the paste (or the review) from anywhere inside it, and stops
    // here: the panels close on a window-level Escape, which would otherwise take the
    // whole panel, and the paste with it.
    <div
      ref={boxRef}
      className="space-y-1.5"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          reset();
        }
      }}
    >
      {!proposal ? (
        <>
          <AutoResizeTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) read();
            }}
            autoFocus
            disabled={reading}
            placeholder={placeholder}
            aria-label={label}
            className={`${textarea()} max-h-48`}
          />
          {error && (
            <p className="flex items-center gap-1 text-meta text-alarm">
              <AlertTriangle size={14} strokeWidth={1.5} absoluteStrokeWidth className="shrink-0" /> {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            {reading ? (
              <span className="text-meta text-fg-3">Reading…</span>
            ) : (
              <>
                <button onClick={reset} className={button("quiet", "compact")}>
                  Cancel
                </button>
                <button
                  onClick={read}
                  disabled={!text.trim()}
                  title="Read it (⌘↵)"
                  className={button("primary", "compact")}
                >
                  Read it
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        // The review. Click a row to strike it out; nothing is saved until Apply.
        <div className="bg-surface rounded-card px-3 py-2 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-group">Would change</p>
            {!nothing && <p className="text-meta text-fg-3">Click a line to leave it out</p>}
          </div>
          {nothing && <p className="text-body text-fg-3">Nothing in that to add.</p>}
          {rows.map((r) => {
            const off = dropped.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => toggle(r.key)}
                className={`w-full text-left flex items-baseline gap-2 text-body -mx-1 px-1 py-0.5 rounded-control hover:bg-lift transition-[opacity,background-color] duration-90 ease-enter ${
                  off ? "opacity-35 line-through" : ""
                }`}
                title={off ? "Keep this change" : "Leave this out"}
              >
                <span className="text-fg-3 shrink-0 w-24">{r.label}</span>
                <span className="min-w-0 flex-1">
                  {/* The old value is cut short: it is there to say what is being
                      replaced, not to be read again. */}
                  {r.from && <span className="text-fg-3">{clip(r.from, 60)} → </span>}
                  <span className="text-fg-1">{clip(r.to, 240)}</span>
                </span>
              </button>
            );
          })}
          {note && (
            <button
              onClick={() => toggle("note")}
              className={`w-full text-left flex items-baseline gap-2 text-body -mx-1 px-1 py-0.5 rounded-control hover:bg-lift transition-[opacity,background-color] duration-90 ease-enter ${
                dropped.has("note") ? "opacity-35 line-through" : ""
              }`}
              title={dropped.has("note") ? "Keep this note" : "Leave this out"}
            >
              <span className="text-fg-3 shrink-0 w-24">New note</span>
              <span className="min-w-0 flex-1 border-l-2 border-line-3 pl-2">
                <span className="block text-fg-1">{note.title}</span>
                <span className="block text-fg-2 whitespace-pre-wrap">{note.body}</span>
              </span>
            </button>
          )}
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button onClick={reset} className={button("quiet", "compact")}>
              Discard
            </button>
            {!nothing && (
              <button
                onClick={() => {
                  onApplied({ updates: proposal.updates, note: keepNote ? note : null }, kept);
                  reset();
                }}
                disabled={kept.size === 0 && !keepNote}
                className={button("primary", "compact")}
              >
                Apply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
