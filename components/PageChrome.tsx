"use client";

import type { ReactNode } from "react";

/**
 * The top of a two-sided page, shared by Applications and Network so the two read
 * as one system: the same title block, the same next-action line, the same tab bar
 * in the side's accent, the same key hints. They were two hand-copied versions of
 * one layout, and every pass drifted them a few pixels apart (a ring on one primary
 * button and not the other, items-start against items-center).
 */

export type Tone = "pink" | "blue";

/** One part of a next-action line: "3 to triage". Zero parts are dropped. */
export type ActionPart = { n: number; label: string };

/**
 * The line under the title. It used to be the date on one page and a head count on
 * the other: one told you nothing you did not know, the other counted the directory
 * rather than the work. Now both say what to do next, from the same numbers as
 * Home's funnel, and say nothing loud when there is nothing to do.
 *
 * `parts` is null while the numbers load, which keeps the line's height without
 * flashing "All caught up" at someone with a full queue.
 */
export function NextActionLine({ parts }: { parts: ActionPart[] | null }) {
  if (parts === null) return <p className="text-sm text-zinc-500 mt-1">&nbsp;</p>;
  const live = parts.filter((p) => p.n > 0);
  return (
    <p className="text-sm text-zinc-500 mt-1">
      {live.length === 0
        ? "All caught up"
        : live.map((p, i) => (
            <span key={p.label}>
              {i > 0 && <span className="text-zinc-700"> · </span>}
              <span className="text-zinc-300 tabular-nums">{p.n}</span> {p.label}
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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        <NextActionLine parts={parts} />
      </div>
      <div className="flex items-center gap-3 shrink-0">{actions}</div>
    </div>
  );
}

/** The header's two button weights, in either accent. */
export function headerButton(kind: "primary" | "secondary", tone: Tone): string {
  const base = "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150";
  if (kind === "primary") {
    return tone === "pink"
      ? `${base} bg-accent-pink text-black hover:opacity-90 ring-1 ring-accent-pink/30 hover:ring-accent-pink/50`
      : `${base} bg-accent-blue text-black hover:opacity-90 ring-1 ring-accent-blue/30 hover:ring-accent-blue/50`;
  }
  return `${base} border border-zinc-700 bg-zinc-900 text-zinc-200 disabled:opacity-50 ${
    tone === "pink" ? "hover:border-accent-pink/50 hover:text-accent-pink" : "hover:border-accent-blue/50 hover:text-accent-blue"
  }`;
}

export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
  tone,
}: {
  tabs: { key: K; label: string; count: number }[];
  active: K | null;
  onChange: (k: K) => void;
  tone: Tone;
}) {
  const badge =
    tone === "pink" ? "border-accent-pink text-accent-pink" : "border-accent-blue text-accent-blue";
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-md transition-all duration-150 ${
            active === t.key ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {t.label}
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border bg-transparent tabular-nums ${badge}`}>
            {t.count}
          </span>
        </button>
      ))}
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
