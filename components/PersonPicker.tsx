"use client";

import { useState } from "react";

export type PickerPerson = { id: string; name: string; subtitle?: string | null };

/**
 * Pick a person by typing, not by scrolling.
 *
 * A native select was fine at ten contacts and stops being fine well before a
 * hundred, which is where a working search ends up. It also auto-committed on
 * change, so the referral list was the one place in either panel where a thing got
 * saved without you saying so. This matches the shape every other add in the panels
 * uses: open it, fill it in, then Save or Cancel.
 */
export function PersonPicker({
  options,
  accent,
  placeholder = "Type a name…",
  // Standalone, picking is a two-step so a stray click cannot commit. Nested inside a
  // form that already has its own Save and Cancel, it is one step: two pairs of
  // Save/Cancel stacked on one panel is a question about which one you are answering.
  confirm = true,
  onSave,
  onCancel,
}: {
  options: PickerPerson[];
  accent: string;
  placeholder?: string;
  confirm?: boolean;
  onSave: (id: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PickerPerson | null>(null);

  const choose = (p: PickerPerson) => (confirm ? setPicked(p) : onSave(p.id));

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => `${o.name} ${o.subtitle ?? ""}`.toLowerCase().includes(q))
    : options;

  return (
    <div className="space-y-1.5">
      {picked ? (
        <div className="flex items-center justify-between gap-2 border rounded px-2 py-1" style={{ borderColor: accent }}>
          <p className="text-xs text-zinc-200 truncate">
            {picked.name}
            {picked.subtitle && <span className="text-zinc-600"> · {picked.subtitle}</span>}
          </p>
          <button
            onClick={() => setPicked(null)}
            className="text-xs text-zinc-600 hover:text-zinc-300 shrink-0"
            title="Pick someone else"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
              // Enter takes the only remaining match, which is the whole point of
              // typing three letters instead of opening a list.
              if (e.key === "Enter" && matches.length === 1) choose(matches[0]);
            }}
            placeholder={placeholder}
            autoFocus
            className="w-full text-xs bg-zinc-900 border rounded px-2 py-1 text-zinc-300 placeholder-zinc-700 focus:outline-none"
            style={{ borderColor: accent }}
          />
          <div className="max-h-36 overflow-y-auto space-y-0.5">
            {matches.length === 0 && <p className="text-xs text-zinc-700 px-1">Nobody matches that.</p>}
            {matches.slice(0, 20).map((o) => (
              <button
                key={o.id}
                onClick={() => choose(o)}
                className="w-full text-left text-xs px-2 py-1 rounded text-zinc-300 hover:bg-zinc-800 transition-colors duration-150 truncate"
              >
                {o.name}
                {o.subtitle && <span className="text-zinc-600"> · {o.subtitle}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {confirm ? (
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <button
            onClick={() => picked && onSave(picked.id)}
            disabled={!picked}
            className="text-xs font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity duration-150"
            style={{ color: accent }}
          >
            Save
          </button>
        </div>
      ) : (
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">
          Cancel
        </button>
      )}
    </div>
  );
}
