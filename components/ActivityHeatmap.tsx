"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type DayBucket = {
  date: string;
  jobsReviewed: number;
  applied: number;
  interviewScheduled: number;
  contactsAdded: number;
  outreachSent: number;
  coffeeChats: number;
  total: number;
  weighted: number;
};

type Totals = {
  jobsReviewed: number;
  applied: number;
  interviewScheduled: number;
  contactsAdded: number;
  outreachSent: number;
  coffeeChats: number;
};

type ActivityResponse = {
  days: DayBucket[];
  streak: number;
  todayCounts: boolean;
  today: DayBucket;
  yearTotals: Totals;
};

// Sized to fill the block's width with a calendar year in it. GitHub's own 11px
// works because GitHub gives the grid a full page; here it shared a row with the
// recap panel and came out unreadably small. The recap now sits below instead, so a
// year of 53 columns at 18px pitch fits the container at about 980px.
// No fixed cell size. Columns flex to fill whatever width the block has and cells
// are square, so a year always spans the container instead of being whatever
// 53 × a guessed pixel width happens to come to.
// 2px rather than 3: close enough that the cursor is rarely between cells, far
// enough that they still read as separate days.
const GAP = 2;
// The day-label gutter. Month labels offset by exactly this so a label sits over its
// own column rather than near it.
const GUTTER = 32;

// API date strings are local-calendar YYYY-MM-DD. `new Date("2026-05-19")` parses
// as UTC midnight, which renders as the previous day in any timezone west of UTC —
// so today's column shifts back by one. Build the Date from explicit local parts.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Intensity is total effort; hue is where the effort went. A day with any networking
// in it at all leans blue, because networking is the rarer act and the thing worth
// seeing on a wall of application days — a day that was mostly triage and one message
// is still a day you reached out, and that is the fact worth surfacing.
//
// This replaces fill-plus-underline. The underline was a second channel saying what
// the hue can say on its own, and it also lit up for "a contact was added", which is
// not progress and had no row in the recap to explain itself.
//
// Empty is a step lighter than the panel: bg-zinc-900 was the panel's own background,
// so empty days used to be invisible and the grid had no shape before activity.
/**
 * Fill is how much, hue is which half of the search it was.
 *
 * The ramp starts at 45% rather than 25%: these accents are pastels, and a quarter
 * of a pastel over a near-black ground is mostly ground, so the quietest days came
 * out grey-mauve and grey-teal instead of a dull pink and a dull blue. Four steps
 * between 45 and 100 keep the hue legible the whole way down.
 *
 * Three hues, not two. The old version asked `netWeight > 0` and painted the whole
 * cell blue on that alone, so a day of nine roles triaged and one message sent
 * reported itself as a networking day. That is backwards, and it hid the days that
 * actually matter most: the ones where both halves happened. Those get their own
 * colour now, sitting between the two accents, because a day you applied *and*
 * reached out is not a louder version of either one.
 */
// Written out rather than composed, because Tailwind scans for literal class
// strings and a `bg-${hue}/25` template never makes it into the stylesheet.
const RAMP: Record<"app" | "net" | "both", [string, string, string, string]> = {
  app: ["bg-accent-pink/45", "bg-accent-pink/65", "bg-accent-pink/85", "bg-accent-pink"],
  net: ["bg-accent-blue/45", "bg-accent-blue/65", "bg-accent-blue/85", "bg-accent-blue"],
  both: ["bg-accent-both/45", "bg-accent-both/65", "bg-accent-both/85", "bg-accent-both"],
};

function intensityClass(appWeight: number, netWeight: number): string {
  const total = appWeight + netWeight;
  if (total === 0) return "bg-zinc-800";
  const ramp = RAMP[appWeight > 0 && netWeight > 0 ? "both" : netWeight > 0 ? "net" : "app"];
  if (total < 2) return ramp[0];
  if (total < 5) return ramp[1];
  if (total < 10) return ramp[2];
  return ramp[3];
}

function formatDateLong(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  // Use short weekday + short month — keeps the header width stable across days
  // ("Mon, May 17, 2026" is always ~16 chars vs "Wednesday, September 17, 2026" being ~30)
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildGrid(days: DayBucket[]): (DayBucket | null)[][] {
  const rowOrder = [1, 2, 3, 4, 5, 6, 0];
  if (days.length === 0) return [];
  const columns: (DayBucket | null)[][] = [];
  let currentCol: (DayBucket | null)[] = Array(7).fill(null);
  const firstDate = parseLocalDate(days[0].date);
  const firstRow = rowOrder.indexOf(firstDate.getDay());
  for (let r = 0; r < firstRow; r++) currentCol[r] = null;
  for (const b of days) {
    const d = parseLocalDate(b.date);
    const row = rowOrder.indexOf(d.getDay());
    currentCol[row] = b;
    if (row === 6) {
      columns.push(currentCol);
      currentCol = Array(7).fill(null);
    }
  }
  if (currentCol.some((c) => c !== null)) columns.push(currentCol);
  return columns;
}

// Labels the column that actually contains the 1st of a month, positioned
// absolutely at that column's offset. The old version labelled whichever column
// happened to hold the month's earliest *Monday*, so a month starting on a Friday
// was labelled a column early, and it laid labels out in a flex row of
// fixed-width divs that did not match the grid's own column pitch.
function MonthLabels({ columns }: { columns: (DayBucket | null)[][] }) {
  const labels: { month: string; idx: number }[] = [];
  columns.forEach((col, idx) => {
    for (const cell of col) {
      if (!cell) continue;
      const d = parseLocalDate(cell.date);
      if (d.getDate() === 1) {
        labels.push({ month: d.toLocaleString(undefined, { month: "short" }), idx });
        break;
      }
    }
  });
  return (
    <div className="relative h-4 mb-1.5" style={{ marginLeft: GUTTER }}>
      {labels.map((l) => (
        <span
          key={`${l.month}-${l.idx}`}
          className="absolute text-[11px] text-zinc-500 whitespace-nowrap"
          style={{ left: `${(l.idx / columns.length) * 100}%` }}
        >
          {l.month}
        </span>
      ))}
    </div>
  );
}


function RecapPanel({
  day,
  isToday,
  yearTotals,
}: {
  day: DayBucket;
  isToday: boolean;
  yearTotals: Totals;
}) {
  // A horizontal strip rather than a tall four-column table. Under a full-width
  // grid the table shape left most of the row empty, and five rows of
  // label-number-number-number is a lot of repeated structure for fifteen numbers.
  const rows: { label: string; day: number; all: number; tone: "app" | "net" }[] = [
    { label: "Roles triaged", day: day.jobsReviewed, all: yearTotals.jobsReviewed, tone: "app" },
    { label: "Applications submitted", day: day.applied, all: yearTotals.applied, tone: "app" },
    { label: "Interviews", day: day.interviewScheduled, all: yearTotals.interviewScheduled, tone: "app" },
    { label: "People messaged", day: day.outreachSent, all: yearTotals.outreachSent, tone: "net" },
    { label: "Coffee chats", day: day.coffeeChats, all: yearTotals.coffeeChats, tone: "net" },
  ];

  return (
    <div>
      {/* Always rendered. When this appeared only on hover the block changed height
          as the cursor crossed the grid, which made the whole panel jump. */}
      <p className="text-xs text-zinc-500 mb-3">
        {isToday ? "Today" : formatDateLong(day.date)}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {rows.map((r) => {
          const tone = r.tone === "app" ? "text-accent-pink" : "text-accent-blue";
          return (
            <div key={r.label} className="border border-zinc-800 rounded-lg px-3 py-2.5">
              <p className="text-xs text-zinc-400 leading-snug min-h-[2rem]">{r.label}</p>
              <div className="mt-1.5 flex items-end gap-4">
                {/* Day is the number they are here to read; year is reference behind it.
                    Same size at the same weight made them compete. */}
                <div>
                  <p className={`text-2xl font-bold tabular-nums leading-none ${r.day > 0 ? tone : "text-zinc-700"}`}>
                    {r.day}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">day</p>
                </div>
                <div className="opacity-50">
                  <p className={`text-lg font-bold tabular-nums leading-none ${r.all > 0 ? tone : "text-zinc-700"}`}>
                    {r.all}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">year</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const THIS_YEAR = new Date().getFullYear();

export function ActivityHeatmap() {
  const [year, setYear] = useState(THIS_YEAR);
  // The grid is a year wide, so the current week can sit off the right edge. Scroll
  // to it on load rather than making you find today yourself.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayBucket | null>(null);

  useEffect(() => {
    // A full calendar year, like GitHub's. 91 days showed a quarter of a search
    // that has been running longer than that, and left the grid mostly empty with
    // no sense of the shape of the whole thing.
    const load = () =>
      fetch(`/api/activity?year=${year}`).then((r) => r.json()).then(setData);
    load();
    // Refetch when the tab regains focus so activity logged today updates today's cell
    // without a full reload.
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [year]);

  // Park the view on the current week once the year's data is in.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !data) return;
    el.scrollLeft = el.scrollWidth;
  }, [data]);

  if (!data) {
    return <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 h-56 animate-pulse" />;
  }

  const columns = buildGrid(data.days);
  const dayRowLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  const displayDay = hoveredDay ?? data.today;
  const todayDate = data.today.date;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Progress</h2>
        {/* The year picker, not a streak. The streak moved inside the block below:
            out here, right-aligned on its own, it read as a button. */}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="text-xs bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-zinc-400 focus:outline-none focus:border-zinc-700"
        >
          {[THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6">
        {/* Heatmap */}
        {/* onMouseLeave lives here, not on each cell. Clearing per cell meant the
            3px gaps between them reset the recap to today, so sweeping across a week
            flickered between the hovered day and today on every gap. */}
        <div ref={scrollerRef} onMouseLeave={() => setHoveredDay(null)}>
          <MonthLabels columns={columns} />
          <div className="flex" style={{ gap: GAP }}>
            <div
              className="flex flex-col text-[11px] text-zinc-500 select-none shrink-0"
              style={{ gap: GAP, width: GUTTER }}
            >
              {dayRowLabels.map((l, i) => (
                <div key={i} className="flex-1 flex items-center">
                  {l}
                </div>
              ))}
            </div>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col flex-1 min-w-0" style={{ gap: GAP }}>
                {col.map((b, ri) => {
                  if (b === null) return <div key={ri} className="w-full aspect-square" />;
                  const isHovered = hoveredDay?.date === b.date;
                  const isToday = b.date === todayDate;
                  // Today is a white outline sitting outside the cell.
                  const todayRing = isToday
                    ? "ring-2 ring-zinc-100 ring-offset-1 ring-offset-zinc-900"
                    : "";
                  // Fill intensity is effort, fill hue is where it went, and a dot in
                  // the middle means a dated event happened: an interview, or a call.
                  //
                  // It used to be an inset ring, which put three different meanings on
                  // the same device — today, hover and event were all rings — so they
                  // had to take turns, and an interview on a hovered day simply
                  // vanished. A dot sits inside the cell and never competes. Not an X:
                  // at this size it is fiddly, and a cross reads as cancelled, which is
                  // the wrong note for the two best things that happen in a search.
                  //
                  // A plain coloured dot did not work: an interview already makes its
                  // day pink, so a pink dot on it vanished. The dot is dark for contrast
                  // against any fill, and the colour moved out to the cell edge where it
                  // has room to read.
                  //
                  // contactsAdded is deliberately absent: adding a name to a list is
                  // not progress, it has no row in the recap, and when it drove the old
                  // blue underline those cells looked active and then reported nothing.
                  const appWeight = b.jobsReviewed * 1 + b.applied * 3 + b.interviewScheduled * 3;
                  const netWeight = b.outreachSent * 2 + b.coffeeChats * 3;
                  // Two marks doing two jobs: a dark dot that says something was on the
                  // calendar, and a coloured outline on the whole cell that says which.
                  //
                  // Splitting them is what makes the outline safe to lose. Today's ring
                  // sits outside the cell so the two coexist, and hover replaces the
                  // outline for as long as the cursor is there — but the dot stays put,
                  // so the day never stops announcing itself.
                  const hasEvent = b.interviewScheduled > 0 || b.coffeeChats > 0;
                  const eventRing = b.interviewScheduled
                    ? "ring-2 ring-inset ring-accent-pink"
                    : b.coffeeChats
                      ? "ring-2 ring-inset ring-accent-blue"
                      : "";
                  return (
                    <div
                      key={ri}
                      onMouseEnter={() => setHoveredDay(b)}
                      className={`relative w-full aspect-square rounded-sm flex items-center justify-center ${intensityClass(
                        appWeight,
                        netWeight,
                      )} ${
                        isHovered
                          ? "ring-2 ring-inset ring-zinc-100"
                          : `${eventRing} ${todayRing}`
                      }`}
                    >
                      {hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950/80" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* The Less/More key is gone: the scale is obvious from the grid, and it
              was five squares explaining five squares. The streak sits here instead,
              inside the block, where it reads as a stat rather than a control. */}
          <p className="mt-5 text-xs flex items-center gap-1.5">
            <span
              className={
                data.streak === 0
                  ? "text-zinc-600"
                  : data.todayCounts
                    ? "text-accent-pink font-semibold"
                    : "text-zinc-500 font-semibold"
              }
            >
              {data.streak === 0 ? "No streak" : `${data.streak}-day streak`}
            </span>
            {data.streak > 0 && !data.todayCounts && (
              <span className="text-[10px] text-zinc-600 italic">save it today</span>
            )}
          </p>
        </div>

        {/* Recap below the grid, not beside it. Side by side, the grid got half
            the width and a year of 11px cells was not readable. */}
        <div className="border-t border-zinc-800 pt-5">
          <RecapPanel
            day={displayDay}
            isToday={displayDay.date === todayDate}
            yearTotals={data.yearTotals}
          />
        </div>
      </div>
    </div>
  );
}
