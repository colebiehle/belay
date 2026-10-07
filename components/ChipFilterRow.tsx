"use client";
import { useEffect, useRef, useState } from "react";
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
  // Whether the chips run past one row. "See all (15)" sat beside a row that already
  // showed all fifteen, and pressing it did nothing you could see; the toggle now
  // shows only when there is something hidden to see.
  const rowRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    // The first chip's top is the first row's; anything lower has wrapped.
    const measure = () => {
      const kids = [...el.children] as HTMLElement[];
      const top = kids[0]?.offsetTop ?? 0;
      setOverflows(kids.some((k) => k.offsetTop > top));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length, selected.size]);

  if (items.length <= 1) return null;

  const collapsed = !expanded && selected.size === 0;

  return (
    <div className="flex items-start gap-2">
      <div
        ref={rowRef}
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
      {/* No toggle while a chip is on: the row stays open so the lit chip is in view,
          and "Show less" there could not close it. */}
      {overflows && selected.size === 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={!collapsed}
          className={`${button("quiet", "compact")} h-6 shrink-0`}
        >
          {expanded ? "Show less" : `See all (${items.length})`}
        </button>
      )}
    </div>
  );
}
