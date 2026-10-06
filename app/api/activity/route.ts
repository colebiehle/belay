import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DayBucket = {
  date: string;
  jobsReviewed: number;
  applied: number;
  interviewScheduled: number;
  coffeeChats: number;
  contactsAdded: number;
  outreachSent: number;
  total: number;
  weighted: number;
};

// Weights set the fill intensity and decide what counts as an active day for the
// streak. Submitting and interviewing move the search, so they count for more than
// triaging a queue.
//
// contactsAdded counts at the same weight as triaging a role: finding the right people
// is the networking side's first step, as triage is the applications side's. It was
// left out once because it had no row in the recap and its days drew as empty cells;
// it now has a row ("People identified") and feeds the cell colour, so the grid, the
// streak and the recap agree again.
const WEIGHTS: Record<string, number> = {
  jobsReviewed: 1,
  contactsAdded: 1,
  applied: 3,
  interviewScheduled: 3,
  outreachSent: 2,
  coffeeChats: 3,
};

function dateKey(d: Date | string | null): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyBucket(date: string): DayBucket {
  return {
    date,
    jobsReviewed: 0,
    applied: 0,
    interviewScheduled: 0,
    coffeeChats: 0,
    contactsAdded: 0,
    outreachSent: 0,
    total: 0,
    weighted: 0,
  };
}

export async function GET(req: NextRequest) {
  // ?year=2026 gives a calendar year, which is what the grid shows now. ?days= is
  // kept so anything still calling it keeps working.
  const qs = new URL(req.url).searchParams;
  const yearParam = Number(qs.get("year"));
  const isYear = Number.isInteger(yearParam) && yearParam > 2000;
  const daysParam = Number(qs.get("days") ?? 91);
  const days = isYear ? 366 : Math.min(Math.max(daysParam, 14), 365);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  if (isYear) {
    start.setFullYear(yearParam, 0, 1);
  } else {
    start.setDate(start.getDate() - (days - 1));
  }
  start.setHours(0, 0, 0, 0);

  const buckets = new Map<string, DayBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = dateKey(d)!;
    buckets.set(key, emptyBucket(key));
  }

  const bump = (key: string | null, field: keyof DayBucket, n: number = 1) => {
    if (!key) return;
    const b = buckets.get(key);
    if (!b) return;
    (b[field] as number) += n;
  };

  const [jobs, applications, contacts] = await Promise.all([
    // Only real verdicts count as review activity. Roles cleared in a bulk
    // cleanup carry a verdictAt too, which would otherwise report 21 reviews on
    // a day nothing was actually reviewed.
    prisma.job.findMany({
      where: { verdict: { in: ["Apply", "Pass"] } },
      select: { verdictAt: true },
    }),
    prisma.application.findMany({
      where: { archivedAt: null },
      select: {
        statusHistory: true,
        interviewList: true,
        recruiterMessageSentAt: true,
        connectionMessageSentAt: true,
      },
    }),
    prisma.contact.findMany({ select: { dateAdded: true, lastChat: true, stageHistory: true } }),
  ]);

  for (const j of jobs) {
    if (j.verdictAt) bump(dateKey(j.verdictAt), "jobsReviewed");
  }

  for (const a of applications) {
    if (a.recruiterMessageSentAt) bump(dateKey(a.recruiterMessageSentAt), "outreachSent");
    if (a.connectionMessageSentAt) bump(dateKey(a.connectionMessageSentAt), "outreachSent");

    // Interviews used to be counted off `h.status === "Interview Scheduled"`, a
    // status renamed out of existence, so this read 0 with an application sitting
    // at final round. It now counts the dates you actually schedules.
    if (a.interviewList) {
      try {
        const ivs = JSON.parse(a.interviewList);
        if (Array.isArray(ivs)) {
          for (const iv of ivs) {
            if (iv?.at) bump(dateKey(new Date(iv.at)), "interviewScheduled");
          }
        }
      } catch {
        /* skip a malformed row rather than failing the whole recap */
      }
    }

    if (!a.statusHistory) continue;
    let history: { status: string; at: string }[] = [];
    try { history = JSON.parse(a.statusHistory); } catch { /* skip */ }
    for (let i = 1; i < history.length; i++) {
      const h = history[i];
      const k = dateKey(h.at);
      if (h.status === "Applied") bump(k, "applied");
    }
  }

  for (const c of contacts) {
    bump(dateKey(c.dateAdded), "contactsAdded");
    // Moving someone to "Sent" is the networking equivalent of submitting an
    // application, and it was not counted anywhere: outreachSent read only the two
    // message fields on Application, which the networking surface never writes. So a
    // week of nothing but outreach drew an empty row of cells.
    if (c.stageHistory) {
      try {
        const hist = JSON.parse(c.stageHistory);
        if (Array.isArray(hist)) {
          for (const h of hist) {
            if (h?.stage === "Sent" && h?.at) bump(dateKey(new Date(h.at)), "outreachSent");
          }
        }
      } catch {
        /* a malformed row should not take down the recap */
      }
    }
    // A conversation that actually happened, which is the networking equivalent of
    // submitting rather than identifying. Nothing writes lastChat yet; the
    // networking surface is next, and this is ready for it.
    if (c.lastChat) bump(dateKey(c.lastChat), "coffeeChats");
  }

  for (const b of buckets.values()) {
    let total = 0;
    let weighted = 0;
    for (const [field, weight] of Object.entries(WEIGHTS)) {
      const v = (b[field as keyof DayBucket] as number) || 0;
      total += v;
      weighted += v * weight;
    }
    b.total = total;
    b.weighted = weighted;
  }

  const dayList = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Today by key, not by position. With a calendar-year window the last element is
  // 31 December, so this counted the streak backwards from an empty future day and
  // always returned 0.
  const todayIdx = dayList.findIndex((b) => b.date === dateKey(new Date()));
  const todayBucket = todayIdx >= 0 ? dayList[todayIdx] : undefined;
  const todayHasActivity = !!todayBucket && todayBucket.total > 0;
  // If today has no activity yet, count the streak through yesterday so a fresh
  // day doesn't immediately zero out the user's streak. Today is "in-flight".
  const anchor = todayIdx >= 0 ? todayIdx : dayList.length - 1;
  const startIdx = todayHasActivity ? anchor : anchor - 1;
  let streak = 0;
  for (let i = startIdx; i >= 0; i--) {
    if (dayList[i].total > 0) streak += 1;
    else break;
  }
  const todayCounts = todayHasActivity;

  const todayKey = dateKey(new Date())!;
  const today_b = buckets.get(todayKey) ?? emptyBucket(todayKey);

  // Totals for the selected year. The counts that come from a Prisma count()
  // rather than the day buckets are all-time, which is the same thing here: nothing
  // in the database predates this year's search.
  const [allReviewed, allApps] = await Promise.all([
    // Matches the day buckets, which count only real verdicts. This used to be
    // `verdictAt: { not: null }`, which includes every bulk-archived row — 127
    // against 20 actual decisions, two definitions of one metric side by side.
    prisma.job.count({ where: { verdict: { in: ["Apply", "Pass"] } } }),
    prisma.application.findMany({ select: { statusHistory: true, interviewList: true } }),
  ]);
  let allApplied = 0;
  let allInterview = 0;
  for (const a of allApps) {
    if (!a.statusHistory) continue;
    let history: { status: string }[] = [];
    try { history = JSON.parse(a.statusHistory); } catch { /* skip */ }
    for (let i = 1; i < history.length; i++) {
      if (history[i].status === "Applied") allApplied += 1;
    }
  }
  // Interviews all-time, from the scheduled dates rather than a renamed status.
  for (const a of allApps) {
    if (!a.interviewList) continue;
    try {
      const ivs = JSON.parse(a.interviewList);
      if (Array.isArray(ivs)) allInterview += ivs.filter((iv) => iv?.at).length;
    } catch {
      /* skip */
    }
  }
  // yearTotals, not allTime: the column sits beside a year-scoped grid and a year
  // picker, so "all time" was the one number on screen that meant something else.
  let allCoffee = 0;
  let yearAdded = 0;
  let yearSent = 0;
  for (const b of dayList) {
    allCoffee += b.coffeeChats;
    yearAdded += b.contactsAdded;
    yearSent += b.outreachSent;
  }
  const yearTotals = {
    jobsReviewed: allReviewed,
    applied: allApplied,
    interviewScheduled: allInterview,
    // From the day buckets, like coffee chats. The old counts left out everyone
    // moved to Sent on the Network page, so the year read lower than its own days.
    contactsAdded: yearAdded,
    outreachSent: yearSent,
    coffeeChats: allCoffee,
  };

  return NextResponse.json({ days: dayList, streak, todayCounts, today: today_b, yearTotals });
}
