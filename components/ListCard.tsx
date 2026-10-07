"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { listCard, revealLink } from "@/lib/ui";
import { dateAndAge } from "@/lib/dates";

/**
 * One card for both lists grouped by stage: Roles → Active and People → Network
 * (STYLE_GUIDE 5.7). They were 56px rows; as cards in a grid of three they show a
 * 40px logo you can actually read and a short stack of facts, without a wide row's
 * empty middle.
 *
 * - Row 1: the 40px logo, the primary name (`name` `fg-1`) with its link out shown on
 *   hover and focus, and the line under it (`meta` `fg-2`): the role title, or
 *   "Company · Role" for a person. The stage control sits at the top right and shows
 *   on hover and focus only, as it did on the row: the group heading names the stage.
 * - Then up to three facts in `meta`, one per line, each the caller's: when the thing
 *   at this stage happened ("Applied Oct 3 · 3d ago"), an interview on the calendar,
 *   who is referring you.
 *
 * The whole card opens the panel. The open control is a real button over the card
 * (its ::after covers it), and the link, the select and any inline action sit above
 * it, so nothing interactive is nested inside a button.
 */
export function ListCard({
  logo,
  name,
  sub,
  link,
  lines,
  stage,
  selected = false,
  flash = false,
  onOpen,
  openTitle,
}: {
  logo: ReactNode;
  name: string;
  sub: ReactNode;
  link?: { href: string; title: string; onClick?: () => void } | null;
  lines: ReactNode[];
  stage: ReactNode;
  selected?: boolean;
  flash?: boolean;
  onOpen: () => void;
  openTitle?: string;
}) {
  return (
    <div data-list-card className={listCard(selected, flash)} aria-current={selected || undefined}>
      {logo}
      <div className="min-w-0 flex-1">
        {/* The name row carries the stage control at its right end, so only the
            name gives up width to it; the line under it runs the card's full width. */}
        <div className="flex items-center gap-2 min-w-0">
          <p className="flex items-center gap-1.5 min-w-0 text-name text-fg-1">
            <button
              data-card-open
              onClick={onOpen}
              title={openTitle}
              // The card carries the focus ring (globals.css, [data-list-card]), so
              // the button's own is turned off there: two rings for one control.
              className="truncate text-left after:absolute after:inset-0 after:rounded-card"
            >
              {name}
            </button>
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  link.onClick?.();
                }}
                className={`${revealLink} z-[1]`}
                title={link.title}
                aria-label={link.title}
              >
                <ExternalLink size={14} strokeWidth={1.5} absoluteStrokeWidth />
              </a>
            )}
          </p>
          {/* Hidden at rest, shown on hover and while focus is inside it, and in the
              tab order throughout (4.7). Above the open button, so a click on it
              changes the stage rather than opening the panel. */}
          <div className="relative z-[1] ml-auto shrink-0 flex opacity-0 transition-opacity duration-90 ease-enter group-hover/row:opacity-100 focus-within:opacity-100">
            {stage}
          </div>
        </div>
        <p className="text-meta text-fg-2 truncate">{sub}</p>
        {lines.length > 0 && (
          <div className="mt-2 space-y-1 text-meta tabular-nums">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-1 min-w-0 h-4">
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// The date helpers live in lib/dates so server pages can use them too.
export { shortDate, dateAndAge } from "@/lib/dates";

/** One timing line: "Applied Oct 3 · 3d ago". Quiet by default (`fg-3`, the `·` in
 * `fg-4`); an overdue follow-up passes `text-rope` and puts its Clock before it. */
export function TimingLine({ verb, at, className = "text-fg-3", title }: { verb: string; at: Date; className?: string; title?: string }) {
  const { date, age } = dateAndAge(at);
  return (
    <span className={`truncate ${className}`} title={title}>
      {verb} {date}
      <span className="text-fg-4"> · </span>
      {age}
    </span>
  );
}
