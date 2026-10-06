import type React from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * The stage chip, one component for both sides of the app.
 *
 * It replaces two colour maps: a pink ramp for pipeline statuses and its blue twin
 * for contact stages. Each said "how far along" by how saturated the chip was, and
 * each also said "which side of the app", which the page already says. One neutral
 * ramp keeps the first job and drops the second, so company colour can be the only
 * hue in a row or a panel. How full the chip is shows how far along it is; every
 * text colour on every fill was computed to clear 4.5:1 (STYLE_GUIDE 5.5).
 *
 * Two encodings carry meaning without colour: Drafted is dashed, because it is
 * written but not sent (the state the search kept dying in), and Accepted adds a
 * check, because the search ended and it ended well.
 */

type Step = 0 | 1 | 2 | 3 | 4 | 5 | "end";

const STEPS: Record<string, Step> = {
  // Applications
  Applying: 0,
  Applied: 1,
  Screen: 2,
  Interviewing: 3,
  "Final round": 4,
  Offer: 5,
  Accepted: 5,
  Rejected: "end",
  Withdrawn: "end",
  // Network
  Identified: 0,
  Drafted: 0,
  Sent: 1,
  Connected: 2,
  Replied: 3,
  Scheduled: 4,
  Chatted: 5,
  "No response": "end",
};

// Rises in weight at every step (STYLE_GUIDE 5.5). Step 0 was a line-input outline
// with fg-2 text, which made "not started" louder than step 1's faint fill; it is now
// the faintest outline, and Drafted, between Identified and Sent, a brighter dashed one.
const FILL: Record<string, string> = {
  0: "border border-line-2 text-fg-3",
  1: "bg-stage-1 text-fg-1",
  2: "bg-stage-2 text-fg-1",
  3: "bg-stage-3 text-canvas",
  4: "bg-stage-4 text-canvas",
  5: "bg-stage-5 text-canvas",
  // Over, not failed: no fill, no border, the dimmest readable text.
  end: "text-fg-3",
};

/** The chip's fill and text classes for a stage, without the box. */
export function stageClasses(stage: string, onWash = false): string {
  if (stage === "Drafted") return "border border-dashed border-line-3 text-fg-2";
  const step = STEPS[stage] ?? 0;
  const cls = FILL[String(step)];
  // fg-3 is not allowed on the brand wash (STYLE_GUIDE 2.6): step 0 and End step up.
  return onWash ? cls.replace("text-fg-3", "text-fg-2") : cls;
}

const BOX = "inline-flex items-center justify-center gap-1 h-5 px-1.5 rounded-control text-chip t-chip whitespace-nowrap";

/** A read-only stage chip. */
export function StageChip({ stage, className = "" }: { stage: string; className?: string }) {
  return (
    <span className={`${BOX} ${stageClasses(stage)} ${className}`}>
      {stage === "Accepted" && <Check size={12} strokeWidth={1.5} absoluteStrokeWidth />}
      {stage}
    </span>
  );
}

/**
 * A stage chip that is also the stage control. Same look, plus a 12px chevron in
 * the chip's own text colour so it reads as something you can change. A native
 * select underneath keeps the keyboard and the OS picker.
 */
export function StageSelect({
  value,
  options,
  onChange,
  className = "",
  title,
  onWash = false,
}: {
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  className?: string;
  title?: string;
  /** In a slide-over header, on the brand wash, where fg-3 is not allowed. */
  onWash?: boolean;
}) {
  const accepted = value === "Accepted";
  return (
    <span className={`relative inline-flex h-5 ${stageClasses(value, onWash)} rounded-control ${className}`}>
      {accepted && (
        <Check size={12} strokeWidth={1.5} absoluteStrokeWidth className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}
      <select
        value={value}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-transparent h-full w-full ${accepted ? "pl-5" : "pl-1.5"} pr-5 min-w-[6.5rem] text-chip t-chip cursor-pointer text-center rounded-control`}
      >
        {options.map((st) => (
          <option key={st} value={st} className="bg-raised text-fg-1">
            {st}
          </option>
        ))}
      </select>
      <ChevronDown size={12} strokeWidth={1.5} absoluteStrokeWidth className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </span>
  );
}

/**
 * The last slot of a row in a list grouped by stage. The group header already names
 * the stage, so at rest the slot shows the row's day count (or nothing) and the stage
 * control appears in its place on row hover and whenever focus is inside it: thirty
 * identical chips down a column said nothing the header had not. Both sit in the same
 * grid cell, so the swap moves nothing, and the select stays in the tab order while
 * hidden, so Tab reaches it and focusing it shows it. The row needs `group/row`.
 */
export function RowStage({ rest, control }: { rest: React.ReactNode; control: React.ReactNode }) {
  return (
    <span className="grid justify-items-end items-center min-w-[6.5rem] group/stage">
      <span className="[grid-area:1/1] transition-opacity duration-90 ease-enter group-hover/row:opacity-0 group-focus-within/stage:opacity-0">
        {rest}
      </span>
      <span className="[grid-area:1/1] opacity-0 transition-opacity duration-90 ease-enter group-hover/row:opacity-100 focus-within:opacity-100">
        {control}
      </span>
    </span>
  );
}
