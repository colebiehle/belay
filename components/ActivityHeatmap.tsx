"use client";

import { useEffect, useRef, useState } from "react";

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
  year: number | null;
  days: DayBucket[];
  streak: number;
  todayCounts: boolean;
  today: DayBucket;
  yearTotals: Totals;
};

// The grid fills its column: each week is a 1fr column and each day a square in it,
// so beside the table (lg and up) a cell is about 14px, and stacked at 1024 about 20px. A fixed 11px cell
// (GitHub's) left a third of the panel empty on a wide screen, and the panel read as
// a box with a chart in a corner. Below MIN_CELL the cells stop shrinking and the
// year wraps into stacked bands of weeks instead (two or three on a phone). It never
// scrolls sideways: it used to, on a phone and (with a stray 54th week) on wide
// screens too, and a chart you have to pan is a chart you only see part of.
// The legend keeps 11px squares: it is a key, not a row of days.
const MIN_CELL = 10;
const LEGEND_CELL = 11;
// Close enough that the cursor is rarely between cells, far enough that they still
// read as separate days at the larger sizes.
const GAP = 3;
// The day-label gutter: the first grid column, so month labels and cells share the
// grid's own columns rather than being offset to match them.
const GUTTER = 32;

// API date strings are local-calendar YYYY-MM-DD. `new Date("2026-05-19")` parses
// as UTC midnight, which renders as the previous day in any timezone west of UTC —
// so today's column shifts back by one. Build the Date from explicit local parts.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * One neutral ramp, by how much happened. Which half of the search it was is no
 * longer a hue: the grid used pink for applying, blue for people and violet for a day
 * of both, which made three colours carry one question ("how much?") and pushed a
 * second one ("which side?") onto a 11px square that cannot hold it. The day detail
 * under the grid answers the second question in words, by position.
 *
 * Steps are about 1.5-2.1:1 apart, so each one reads at 11px, and empty (heat-0) is
 * a step lighter than the card, so the grid has its shape before any activity.
 *
 * The total is weighted the way it always was: an application or an interview is
 * three triages' worth, a message two, a call three. Ten roles skimmed is a busy day
 * but not three times the day one application and one coffee chat make.
 */
// Written out rather than composed, because Tailwind scans for literal class
// strings and a `bg-heat-${n}` template never makes it into the stylesheet.
const HEAT = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

function intensityClass(weight: number): string {
  if (weight === 0) return HEAT[0];
  if (weight < 2) return HEAT[1];
  if (weight < 5) return HEAT[2];
  if (weight < 10) return HEAT[3];
  return HEAT[4];
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

// Labels the column that actually contains the 1st of a month, placed in that
// column of the same grid as the cells. Each label is zero-width and overflows to the
// right, so a three-letter month never widens its one-week column. In a wrapped band
// (a phone), a band that starts mid-month names that month on its first column, and
// a 1st in a band's last two columns is left to the next band's first column, so no
// label overruns the band's right edge.
function MonthLabels({ columns, band }: { columns: (DayBucket | null)[][]; band: number }) {
  const labels: { month: string; idx: number }[] = [];
  columns.forEach((col, idx) => {
    if (idx >= columns.length - 2) return;
    for (const cell of col) {
      if (!cell) continue;
      const d = parseLocalDate(cell.date);
      if (d.getDate() === 1) {
        labels.push({ month: d.toLocaleString(undefined, { month: "short" }), idx });
        break;
      }
    }
  });
  if (band > 0 && !(labels[0]?.idx < 3)) {
    const first = columns[0]?.find((c) => c !== null);
    if (first) labels.unshift({ month: parseLocalDate(first.date).toLocaleString(undefined, { month: "short" }), idx: 0 });
  }
  return (
    <>
      {labels.map((l) => (
        <span
          key={`${l.month}-${l.idx}`}
          className="w-0 text-meta text-fg-3 whitespace-nowrap"
          style={{ gridRow: 1, gridColumn: l.idx + 2 }}
        >
          {l.month}
        </span>
      ))}
    </>
  );
}

type RecapRow = { label: string; day: number; year: number };

function RecapPanel({
  day,
  dayLabel,
  year,
  yearTotals,
}: {
  // The hovered day, else today when today is in the shown year, else null.
  day: DayBucket | null;
  // The day column's heading: "Today" or the hovered date.
  dayLabel: string;
  year: number;
  yearTotals: Totals;
}) {
  // One table: the day and the year are the columns, the counts are the rows, so
  // each heading appears once. The two halves are labelled (v1.6): "Roles" heads the
  // first column of the header row, beside Today and the year, and "People" is a
  // label row of its own over the second half, with no second Today or year. The
  // verbs alone (triage, identify) did not say which rows went together.
  const roles: RecapRow[] = [
    { label: "Triaged", day: day?.jobsReviewed ?? 0, year: yearTotals.jobsReviewed },
    { label: "Applied", day: day?.applied ?? 0, year: yearTotals.applied },
    { label: "Interviewed", day: day?.interviewScheduled ?? 0, year: yearTotals.interviewScheduled },
  ];
  const people: RecapRow[] = [
    { label: "Identified", day: day?.contactsAdded ?? 0, year: yearTotals.contactsAdded },
    { label: "Messaged", day: day?.outreachSent ?? 0, year: yearTotals.outreachSent },
    { label: "Chatted", day: day?.coffeeChats ?? 0, year: yearTotals.coffeeChats },
  ];
  // Fixed column widths in tabular figures: hovering changes the day column's
  // numbers and heading, and nothing beside them moves. Every row, the two label
  // rows included, is 28px.
  const cols = "grid grid-cols-[6.5rem_4.5rem_3.5rem] items-baseline h-7";
  const row = (r: RecapRow) => (
    <div key={r.label} role="row" className={cols}>
      <span role="rowheader" className="text-body text-fg-2">
        {r.label}
      </span>
      <span role="cell" className={`text-body tabular-nums text-right ${day && r.day > 0 ? "text-fg-1" : "text-fg-3"}`}>
        {day ? r.day : "–"}
      </span>
      <span role="cell" className={`text-body tabular-nums text-right ${r.year > 0 ? "text-fg-1" : "text-fg-3"}`}>
        {r.year}
      </span>
    </div>
  );

  // Group names in the guide's group style (t-group: 12px semibold fg-3), the same
  // as the tiers and stages; the column headings beside "Roles" stay meta fg-3.
  return (
    <div role="table" aria-label="Activity">
      <div role="row" className={cols}>
        <span role="columnheader" className="t-group">
          Roles
        </span>
        <span role="columnheader" className="text-meta text-fg-3 text-right tabular-nums truncate">
          {dayLabel}
        </span>
        <span role="columnheader" className="text-meta text-fg-3 text-right tabular-nums">
          {year}
        </span>
      </div>
      {roles.map(row)}
      <div role="row" className={`${cols} mt-1.5 border-t border-line-2 pt-1.5 box-content`}>
        <span role="rowheader" className="t-group col-span-3">
          People
        </span>
      </div>
      {people.map(row)}
    </div>
  );
}

/** "Sep 29": the hovered day, short, so it fits the column heading. */
function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const THIS_YEAR = new Date().getFullYear();

/** How many stacked bands the year needs so a cell stays at MIN_CELL or more. */
function bandsFor(width: number, weeks: number): number {
  if (width <= 0 || weeks === 0) return 1;
  const perBand = Math.max(1, Math.floor((width - GUTTER + GAP) / (MIN_CELL + GAP)));
  return Math.ceil(weeks / perBand);
}

export function ActivityHeatmap() {
  const [year, setYear] = useState(THIS_YEAR);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayBucket | null>(null);
  // The grid's width, so the year can wrap into bands rather than scroll.
  const gridHostRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    // A full calendar year, like GitHub's. A response for a year you have since
    // moved off is dropped, so a slow 2025 cannot land on top of 2026.
    let live = true;
    const load = () =>
      fetch(`/api/activity?year=${year}`)
        .then((r) => r.json())
        .then((d: ActivityResponse) => {
          if (live) setData(d);
        });
    load();
    // Refetch when the tab regains focus so activity logged today updates today's cell
    // without a full reload.
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [year]);

  const loaded = data !== null;
  useEffect(() => {
    const el = gridHostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  if (!data) {
    // A still placeholder at about the loaded height, not a pulse: nothing on first
    // paint animates, and a shimmering block is louder than the grid it stands for.
    // The heading renders straight away so the sections below do not move up and
    // back down when the data lands.
    return (
      <section>
        <h2 className="t-section mb-3">Progress</h2>
        <div className="bg-surface rounded-card h-96" aria-hidden />
      </section>
    );
  }

  // Until the response for the picked year lands, the numbers on screen are the old
  // year's; label them with the year they belong to, not the one in the select.
  const shownYear = data.year ?? year;
  const columns = buildGrid(data.days);
  const bandCount = bandsFor(gridWidth, columns.length);
  const perBand = Math.ceil(columns.length / bandCount);
  const bands = Array.from({ length: bandCount }, (_, i) => columns.slice(i * perBand, (i + 1) * perBand));
  const dayRowLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  // The day column: the hovered day, else today when the shown year has it.
  const todayInYear = data.days.some((d) => d.date === data.today.date);
  const displayDay = hoveredDay ?? (todayInYear ? data.today : null);
  const todayDate = data.today.date;

  // The select, shared by the panel header. Same frame as every other select (canvas
  // fill, line-input border, rope on focus). Changing it drops the hovered day, so
  // the detail falls back to the new year's resting day.
  const yearSelect = (
    <select
      value={year}
      onChange={(e) => {
        setHoveredDay(null);
        setYear(Number(e.target.value));
      }}
      aria-label="Year"
      className="h-7 bg-canvas border border-line-input rounded-control px-2 text-body tabular-nums text-fg-1 hover:border-fg-3 focus:border-rope transition-colors duration-90 ease-enter"
    >
      {[THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );

  return (
    <section>
      <h2 className="t-section mb-3">Progress</h2>

      {/* Three parts on one grid. From lg up the table is the left column, the full
          height of the panel, and the right column is the panel's header (the streak,
          the key, the year) over the squares: the numbers are what you read, so they
          come first, and the chart beside them is the texture behind them. Below lg
          they stack in reading order: header, squares, table. The DOM is in that
          stacked order, so Tab meets the year before the table at every width. */}
      <div className="bg-surface rounded-card p-4 grid gap-4 lg:gap-x-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        {/* The header: the streak on the left, then the key and the year on the
            right. The streak is always the current one, whichever year is on
            screen. On a phone it wraps under the key rather than squeezing it. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0 lg:col-start-2 lg:row-start-1">
          <p className="flex items-center gap-2 text-meta mr-auto">
            <span className="text-fg-2">{data.streak === 0 ? "No streak" : `${data.streak}-day streak`}</span>
            {/* The hint is a next move, so it is rope (v1.6); the streak itself is a
                record and stays neutral. Shown only while today has nothing in it. */}
            {data.streak > 0 && !data.todayCounts && <span className="text-rope">save it today</span>}
          </p>
          {/* The key: with one neutral ramp the five steps are close enough that
              "Less" and "More" are worth the words. Fixed 11px squares: it is a key,
              not a row of days. */}
          <div className="flex items-center gap-0.5 text-meta text-fg-3" aria-hidden>
            <span className="mr-1">Less</span>
            {HEAT.map((c) => (
              <span key={c} className={`rounded-[2px] ${c}`} style={{ width: LEGEND_CELL, height: LEGEND_CELL }} />
            ))}
            <span className="ml-1">More</span>
          </div>
          {yearSelect}
        </div>

        {/* onMouseLeave lives here, not on each cell. Clearing per cell meant the
            gaps between them reset the recap, so sweeping across a week flickered
            between the hovered day and the resting day on every gap. */}
        <div onMouseLeave={() => setHoveredDay(null)} className="min-w-0 lg:col-start-2 lg:row-start-2">
          {/* min-w-0 and overflow clip: nothing in here may widen the page. Bands
              keep each cell at MIN_CELL or more, and a month label is never placed
              where it could overrun the right edge, so the clip is a backstop. The
              grid measures its own width, so its cells fit whatever the column is. */}
          <div ref={gridHostRef} className="min-w-0 overflow-x-clip space-y-3">
            {bands.map((band, bi) => (
              <div
                key={bi}
                className="grid"
                style={{
                  // Every band has the same column count (the last is padded), so a
                  // cell is the same size in every band.
                  gridTemplateColumns: `${GUTTER}px repeat(${perBand}, minmax(0, 1fr))`,
                  gridTemplateRows: "16px",
                  gridAutoRows: "auto",
                  gap: GAP,
                }}
              >
                <MonthLabels columns={band} band={bi} />
                {dayRowLabels.map((l, i) => (
                  <div
                    key={`d${i}`}
                    className="flex items-center text-meta leading-none text-fg-3 select-none"
                    style={{ gridRow: i + 2, gridColumn: 1 }}
                  >
                    {l}
                  </div>
                ))}
                {band.map((col, ci) =>
                  col.map((b, ri) => {
                    const place = { gridRow: ri + 2, gridColumn: ci + 2 };
                    if (b === null) return <div key={`${ci}-${ri}`} className="aspect-square" style={place} />;
                    const isHovered = hoveredDay?.date === b.date;
                    const isToday = b.date === todayDate;
                    // contactsAdded counts on the people side at triage weight; it has
                    // its own recap row, so a day of finding people reports it.
                    const weight =
                      b.jobsReviewed * 1 + b.applied * 3 + b.interviewScheduled * 3 +
                      b.contactsAdded * 1 + b.outreachSent * 2 + b.coffeeChats * 3;
                    // Rings are inset and 1.5px so they sit inside the cell and never
                    // push into the gap. Today is rope, because rope is "where you are";
                    // the day you are pointing at is fg-1 and takes over for as long as
                    // the cursor is there, since the detail below is then about that day.
                    // With the cursor off the grid the detail shows the year, so no
                    // cell is singled out but today.
                    const ring = isHovered
                      ? "ring-[1.5px] ring-inset ring-fg-1"
                      : isToday
                        ? "ring-[1.5px] ring-inset ring-rope"
                        : "";
                    // A dated event (an interview or a call) is a small canvas dot in
                    // the middle of the cell; the detail below says what it was.
                    const hasEvent = b.interviewScheduled > 0 || b.coffeeChats > 0;
                    return (
                      <div
                        key={`${ci}-${ri}`}
                        onMouseEnter={() => setHoveredDay(b)}
                        style={place}
                        className={`aspect-square rounded-[2px] flex items-center justify-center ${intensityClass(weight)} ${ring}`}
                      >
                        {hasEvent && <span className="w-1 h-1 rounded-full bg-canvas" />}
                      </div>
                    );
                  }),
                )}
              </div>
            ))}
          </div>
        </div>

        {/* The table: left of everything from lg, its hairline the full height of
            the panel; under the squares below lg. */}
        <div className="border-t border-line-1 pt-4 lg:border-t-0 lg:pt-0 lg:border-r lg:pr-6 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <RecapPanel
            day={displayDay}
            dayLabel={
              hoveredDay
                ? hoveredDay.date === todayDate
                  ? "Today"
                  : shortDate(hoveredDay.date)
                : todayInYear
                  ? "Today"
                  : "Day"
            }
            year={shownYear}
            yearTotals={data.yearTotals}
          />
        </div>
      </div>
    </section>
  );
}
