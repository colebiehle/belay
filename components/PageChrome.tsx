"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { button, emptyBox, iconButton } from "@/lib/ui";

/**
 * The top of a two-sided page, shared by Applications and Network so the two read
 * as one system: the same title block, the same next-action line, the same tab bar,
 * the same key hints. They were two hand-copied versions of one layout, and every
 * pass drifted them a few pixels apart (a ring on one primary button and not the
 * other, items-start against items-center). The side-of-the-app tone (pink or blue)
 * is gone: the title already says which side you are on.
 */

/** One part of a next-action line: "3 to triage". Zero parts are dropped. */
export type ActionPart = { n: number; label: string };

/**
 * The line under the title. It used to be the date on one page and a head count on
 * the other: one told you nothing you did not know, the other counted the directory
 * rather than the work. Now both say what to do next, from the same numbers as
 * Home's funnel, and say nothing loud when there is nothing to do. Numbers are the
 * bright step and the words the dim one, so the eye lands on the counts.
 *
 * `parts` is null while the numbers load, which keeps the line's height without
 * flashing "Nothing waiting" at someone with a full queue.
 */
export function NextActionLine({ parts }: { parts: ActionPart[] | null }) {
  if (parts === null) return <p className="text-body text-fg-3 mt-1">&nbsp;</p>;
  const live = parts.filter((p) => p.n > 0);
  return (
    <p className="text-body text-fg-3 mt-1 max-w-[72ch]">
      {live.length === 0
        ? "Nothing waiting"
        : live.map((p, i) => (
            <span key={p.label}>
              {i > 0 && <span className="text-fg-4 mx-1.5">·</span>}
              <span className="text-fg-1 tabular-nums">{p.n}</span> {p.label}
            </span>
          ))}
    </p>
  );
}

export function PageHeader({
  title,
  parts,
  actions,
}: {
  title: string;
  parts: ActionPart[] | null;
  actions: ReactNode;
}) {
  return (
    // On a phone the actions go under the title rather than beside it: side by side,
    // the next-action line was squeezed into a 100px column and broke after every
    // second word ("7 to / review · 33 to / message").
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-h1 text-fg-1">{title}</h1>
        <NextActionLine parts={parts} />
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </div>
  );
}

/**
 * The frame every header-triggered form opens in: Add role, Add people and Find
 * people. They were three hand-built boxes (two in a card, one bare; titles, hints and
 * footers each placed their own way), so opening Find after Add people felt like a
 * different app. One frame now: a surface card with 16px padding; the title in
 * `t-section` with the close X at the top right; one hint line in `meta` `fg-3`; the
 * fields; then a footer row with any quiet way sideways on the left and the form's
 * verb (a secondary button: the header's button is the page's one rope fill) on the
 * right; anything the verb says back (an error, a result) sits under the footer. The
 * fields are canvas, so a dashed paste field still reads as the target
 * inside it (STYLE_GUIDE 5.9).
 */
export function FormFrame({
  title,
  hint,
  onClose,
  closeDisabled = false,
  footerStart,
  footerEnd,
  status,
  children,
}: {
  title: string;
  hint?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  /** What the verb said back: an error (alarm, with its glyph) or a result line. */
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Escape closes it from any field inside, as it does in the panels' inline edits.
    <section
      className="bg-surface rounded-card p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !closeDisabled) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 h-7">
        <h2 className="t-section text-fg-1">{title}</h2>
        <button
          onClick={onClose}
          disabled={closeDisabled}
          className={`${iconButton("quiet", "compact")} -mr-1.5`}
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
        </button>
      </div>
      {hint && <p className="text-meta text-fg-3 mt-1 max-w-[72ch]">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
      {(footerStart || footerEnd) && (
        <div className="mt-3 flex items-center justify-between gap-3 min-h-8">
          <div className="flex items-center gap-3 min-w-0">{footerStart}</div>
          <div className="flex items-center gap-2 shrink-0">{footerEnd}</div>
        </div>
      )}
      {status && <div className="mt-2">{status}</div>}
    </section>
  );
}

/** The quiet way sideways inside a form frame ("Add someone manually", "Paste what
 * you found"): a meta-sized underlined text link, so it never competes with the verb. */
export const formLink =
  "inline-block py-1 -my-1 text-meta text-fg-3 underline decoration-line-2 underline-offset-4 hover:text-fg-1 hover:decoration-fg-3 transition-colors duration-90 ease-enter disabled:text-fg-4";

/**
 * The empty state when filters meet at nothing (5.10): what happened, then the one way
 * back. Every list had its own: Roles printed `Nothing matches ""` when only company
 * chips were set, People said "Nobody matches" with a Clear all, the people queue had
 * no way back at all. One line now, quoting the search only when the search is the
 * only filter, and always the same Clear all.
 */
export function NoMatch({ query, onlyQuery, onClear }: { query: string; onlyQuery: boolean; onClear: () => void }) {
  const q = query.trim();
  return (
    <div className={emptyBox}>
      {q && onlyQuery ? <>Nothing matches &ldquo;{q}&rdquo;.</> : "Nothing matches these filters."}{" "}
      <button onClick={onClear} className={inlineLink}>
        Clear all
      </button>
    </div>
  );
}

/** A quiet text action inside a sentence (an empty state's way out): fg-1, underlined
 * in a hairline that brightens on hover, padded to a 24px target without moving the
 * line. */
export const inlineLink =
  "inline-block py-0.5 -my-0.5 text-fg-1 underline decoration-line-3 underline-offset-4 hover:decoration-fg-1 transition-colors duration-90 ease-enter";

/** The header's two button weights: at most one primary (rope) per header. */
export function headerButton(kind: "primary" | "secondary"): string {
  return button(kind);
}

/**
 * The tab bar. Counts are mono numerals, not pill badges. A tab flagged `urgent`
 * (the Queue, while something in it is undecided) shows its count in rope: that is
 * the "needs you" signal. Directory counts (Pipeline, People) stay neutral, since a
 * bigger list is not a reason to look.
 */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string; count: number; urgent?: boolean }[];
  active: K | null;
  onChange: (k: K) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-surface rounded-card p-0.5 w-fit">
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            aria-pressed={on}
            className={`flex items-center gap-1.5 h-7 px-3 text-button rounded-control transition-colors duration-140 ease-enter ${
              on ? "bg-lift text-fg-1" : "text-fg-3 hover:text-fg-2"
            }`}
          >
            {t.label}
            <span
              className={`text-meta tabular-nums ${
                t.urgent && t.count > 0 ? "text-rope" : on ? "text-fg-2" : "text-fg-3"
              }`}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Open a link in a background tab, so a card click keeps you in the queue.
 * window.open then blur does not work: Chrome focuses the new tab regardless.
 * Synthesising a cmd/ctrl-click does, because the browser handles "open in a
 * background tab" itself rather than being asked to un-focus after the fact.
 */
export function openInBackgroundTab(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.dispatchEvent(new MouseEvent("click", { ctrlKey: true, metaKey: true, bubbles: false, cancelable: true }));
}
