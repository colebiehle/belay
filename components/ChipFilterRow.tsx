"use client";
import { useState } from "react";
import { button, toggle } from "@/lib/ui";

/**
 * The company filter row. A filter toggle is a neutral control: on is a lift fill
 * and a brighter border, not a hue. It used to fill pink when on, which spent the
 * application side's colour on "this filter is set".
 */
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
        className={`flex flex-wrap gap-1 flex-1 ${
          collapsed ? "max-h-6 overflow-hidden" : ""
        }`}
      >
        {items.map((item) => {
          const active = selected.has(item);
          return (
            <button
              key={item}
              onClick={() => onToggle(item)}
              aria-pressed={active}
              className={toggle(active)}
            >
              {item}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            onClick={onClear}
            className={`${button("quiet", "compact")} h-6`}
          >
            Clear
          </button>
        )}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`${button("quiet", "compact")} h-6 shrink-0`}
      >
        {expanded || selected.size > 0 ? "Show less" : `See all (${items.length})`}
      </button>
    </div>
  );
}
