"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toggle } from "@/lib/ui";
import { RELATIONSHIP_TAGS, orderTags } from "@/lib/contact-stages";

/**
 * The relationship tags as toggles: every tag in use (the starters, then yours),
 * click to set or clear, and "+ tag" to make a new one. One picker for the person
 * panel and the Add people form, so a tag made in one is offered in the other.
 */
export function TagPicker({
  value,
  onChange,
  known = [],
}: {
  value: string[];
  onChange: (next: string[]) => void;
  // Tags already in use elsewhere, offered alongside the starters.
  known?: string[];
}) {
  // The inline "+ tag" field, null while closed.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const t = (draft ?? "").trim().toLowerCase().slice(0, 28);
    if (t) onChange(orderTags([...value, t]));
    setDraft(null);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {orderTags([...RELATIONSHIP_TAGS, ...known, ...value]).map((t) => {
        const on = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== t) : orderTags([...value, t]))}
            aria-pressed={on}
            className={toggle(on)}
          >
            {t}
          </button>
        );
      })}
      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-control border border-dashed border-line-2 text-chip t-chip text-fg-3 hover:border-line-3 hover:text-fg-1 transition-colors duration-90"
        >
          <Plus size={12} strokeWidth={1.5} absoluteStrokeWidth /> tag
        </button>
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the tag rather than submitting the form around it, and
            // Escape closes only this field, not the form or the panel.
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              commit();
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
            }
          }}
          onBlur={commit}
          autoFocus
          maxLength={28}
          placeholder="new tag"
          aria-label="New tag"
          className="text-chip t-chip w-28 h-6 px-2 rounded-control border border-line-input bg-canvas text-fg-1 placeholder:text-fg-3 focus:border-rope"
        />
      )}
    </div>
  );
}
