"use client";
import { useState } from "react";

export function ChipFilterRow({
  items,
  selected,
  onToggle,
  onClear,
}: {
  items: string[];
  selected: Set<string>;
  onToggle: (item: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length <= 1) return null;

  const collapsed = !expanded && selected.size === 0;

  return (
    <div className="flex items-start gap-2">
      <div
        className={`flex flex-wrap gap-1.5 flex-1 ${
          collapsed ? "max-h-7 overflow-hidden" : ""
        }`}
      >
        {items.map((item) => {
          const active = selected.has(item);
          return (
            <button
              key={item}
              onClick={() => onToggle(item)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 ${
                active
                  ? "bg-accent-pink border-accent-pink text-black"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:border-accent-pink hover:text-accent-pink"
              }`}
            >
              {item}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            onClick={onClear}
            className="text-xs px-2.5 py-1 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
          >
            Clear
          </button>
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="shrink-0 text-xs px-2.5 py-1 rounded-full text-accent-pink-light font-semibold hover:opacity-80 transition-opacity duration-150"
      >
        {expanded || selected.size > 0 ? "Show less" : `See all (${items.length})`}
      </button>
    </div>
  );
}
