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

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // The window the response covers: the selected calendar year (1 Jan to 31 Dec,
  // exactly, so 2025 no longer runs into 1 Jan 2026 and draws a 54th week with a
  // stray "Jan" label past the grid's right edge), or the last N days.
  let windowStart: Date;
  let windowEnd: Date;
  if (isYear) {
    windowStart = new Date(yearParam, 0, 1);
    windowEnd = new Date(yearParam, 11, 31);
  } else {
    const n = Math.min(Math.max(daysParam, 14), 365);
    windowStart = new Date(todayStart);
    windowStart.setDate(windowStart.getDate() - (n - 1));
    windowEnd = new Date(todayStart);
  }

  // Buckets cover the window and the run-up to today, so the streak is always the
  // current streak whichever year is on screen, and one that crosses 1 Jan is not
  // cut off at the year boundary. 400 days is longer than any streak this can show.
  const streakFrom = new Date(todayStart);
  streakFrom.setDate(streakFrom.getDate() - 400);
  const start = windowStart < streakFrom ? windowStart : streakFrom;
  const end = windowEnd > todayStart ? windowEnd : todayStart;

  const buckets = new Map<string, DayBucket>();
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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

  const allDays = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  // The streak runs back from today across every bucket, not just the selected year.
  // If today has no activity yet, count through yesterday so a fresh day doesn't
  // zero the streak: today is in flight.
  const todayKey = dateKey(now)!;
  const todayIdx = allDays.findIndex((b) => b.date === todayKey);
  const todayBucket = allDays[todayIdx] ?? emptyBucket(todayKey);
  const todayCounts = todayBucket.total > 0;
  let streak = 0;
  for (let i = todayCounts ? todayIdx : todayIdx - 1; i >= 0; i--) {
    if (allDays[i].total > 0) streak += 1;
    else break;
  }

  const fromKey = dateKey(windowStart)!;
  const toKey = dateKey(windowEnd)!;
  const dayList = allDays.filter((b) => b.date >= fromKey && b.date <= toKey);

  // Every total is the sum of the days on screen. Triaged, applied and interviews
  // used to be all-time counts from separate queries (and applied counted archived
  // applications the grid leaves out), so picking 2025 showed 51 roles triaged and
  // 17 applications in a year with no activity at all.
  const yearTotals = {
    jobsReviewed: 0,
    applied: 0,
    interviewScheduled: 0,
    contactsAdded: 0,
    outreachSent: 0,
    coffeeChats: 0,
  };
  for (const b of dayList) {
    for (const k of Object.keys(yearTotals) as (keyof typeof yearTotals)[]) yearTotals[k] += b[k];
  }

  return NextResponse.json({
    year: isYear ? yearParam : null,
    days: dayList,
    streak,
    todayCounts,
    today: todayBucket,
    yearTotals,
  });
}
