import { prisma } from "@/lib/prisma";
import { OPEN_STATUSES } from "@/lib/statuses";
import { buildTierMap, tierFor } from "@/lib/company-tier";
import { canonicalCompany } from "@/lib/role-filter";
import {
  DEFAULT_STAGE,
  FOLLOW_UP_STAGES,
  NUDGE_AFTER_DAYS,
  TO_MESSAGE_STAGES,
  TO_SCHEDULE_STAGES,
  WARMTH_LEVELS,
  orderTags,
} from "@/lib/contact-stages";

/**
 * Insights: what is working, and how things look, across the whole search.
 *
 * Computed in one place so the /api/insights route, the /insights page and the
 * home page's signals read the same numbers. The page calls this directly rather than fetching its own API,
 * because a server component fetching its own origin is a round trip through the
 * network stack to reach a function in the same process.
 *
 * Everything here is read-only. Nothing on Insights edits a row.
 */

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * The fewest sent applications a group needs before it shows a rate.
 *
 * One response from two applications is "50%", and that number would be read as a
 * finding. It is not one: it is a coin landing. Below this, a group shows its raw
 * outcomes (one pip per application) and says plainly that it is too early. Five is
 * still a thin sample, but it is the point where a 0% stops being a single unlucky
 * application, and the user will look at this after two or three weeks of applying,
 * when most groups will have somewhere between three and fifteen.
 */
export const MIN_SAMPLE = 5;

/**
 * Applications younger than this have not had a fair chance to hear back. They still
 * count in the rate (excluding them would make the denominator jump around week to
 * week), but the page says how many there are, so a low rate in a week of heavy
 * applying reads as "too soon" rather than "not working".
 */
export const FRESH_DAYS = 14;

// ---------------------------------------------------------------------------
// Stage reach
// ---------------------------------------------------------------------------

// What "got a response" means here: a person at the company moved it forward, to a
// screen or beyond. A rejection is also a reply, but counting it as a response would
// make a company that auto-rejects within an hour look like one that is working.
// Rejections are reported beside the funnel instead, as "heard back at all".
const RESPONSE_STAGES = ["Screen", "Interviewing", "Final round", "Offer"];
const INTERVIEW_STAGES = ["Interviewing", "Final round", "Offer"];
const OFFER_STAGES = ["Offer"];
// Any of these anywhere in the history means the form actually went in. Withdrawn is
// absent on purpose: you can withdraw from a role you never sent.
const SENT_STAGES = ["Applied", "Screen", "Interviewing", "Final round", "Offer", "Rejected"];

type HistoryEntry = { status?: string; at?: string };

function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    // One malformed row should not take down the page.
    return [];
  }
}

// The forward path, in order. Reaching a stage implies every stage before it.
const ORDER = ["Applied", "Screen", "Interviewing", "Final round", "Offer"];

/**
 * How far an application got.
 *
 * For a live application the current status is the truth and everything before it
 * is implied. History is not read for live rows because it holds hand corrections:
 * the Google Ads row's history runs Applied → Rejected → Offer → Accepted → Final
 * round, and reading the furthest point in it would report an offer that is not one.
 *
 * For a closed application (Rejected, Withdrawn) the current status says nothing
 * about how far it got, so the furthest forward stage in its history is used. That is
 * what lets a rejection after a final round count as a response rather than being
 * filed with the ones that were ignored. "Accepted" only counts as the current status,
 * for the same reason as above.
 */
function stagesReached(status: string, history: HistoryEntry[]): Set<string> {
  let furthest = -1;
  if (status === "Accepted") furthest = ORDER.length - 1;
  else if (ORDER.includes(status)) furthest = ORDER.indexOf(status);
  else if (status === "Rejected" || status === "Withdrawn") {
    for (const h of history) furthest = Math.max(furthest, ORDER.indexOf(h.status ?? ""));
  }
  const reached = new Set(ORDER.slice(0, furthest + 1));
  reached.add(status);
  return reached;
}

function sentAt(dateApplied: Date | null, history: HistoryEntry[]): Date | null {
  if (dateApplied) return dateApplied;
  const first = history.find((h) => h.status && SENT_STAGES.includes(h.status) && h.at);
  if (!first?.at) return null;
  const d = new Date(first.at);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export type SourceKey = "linkedin" | "company" | "wellfound" | "yc" | "vc" | "board" | "unknown";

export const SOURCE_LABEL: Record<SourceKey, string> = {
  linkedin: "LinkedIn",
  company: "Company careers site",
  wellfound: "Wellfound",
  yc: "Y Combinator",
  vc: "VC portfolio boards",
  board: "Other job boards",
  unknown: "Unknown",
};

const OTHER_BOARDS = ["builtin", "simplify.jobs", "hiring.cafe", "welcometothejungle.com", "joinhandshake.com", "indeed.com"];

/**
 * Where a role came from.
 *
 * The URL host is the main signal, but not the only one. The portfolio-board scan
 * stores the underlying ATS link (a Greenhouse URL, an IBM careers page), so a VC
 * role looks exactly like a company-board role by host; its fitRationale is the only
 * place that says "Surfaced from the Accel portfolio board". That line is overwritten
 * when a role is enriched, so it is checked first but cannot be relied on, and
 * enriched VC roles fall through to "Company careers site".
 *
 * Some company links carry the click's origin in the query string
 * (Microsoft's `src=LinkedIn`), which is the truer answer for where it was found.
 *
 * A role added by pasting a URL is not marked anywhere, so a hand-added role is
 * filed by its host like any other. There is no "manual add" bucket because there is
 * nothing to put in it honestly.
 */
export function sourceOf(jobUrl: string, fitRationale: string): SourceKey {
  const why = (fitRationale || "").toLowerCase();
  if (why.includes("portfolio board")) return "vc";
  if (why.includes("linkedin title search")) return "linkedin";
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return "unknown";
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host.endsWith("wellfound.com") || host.endsWith("angel.co")) return "wellfound";
  if (host.endsWith("ycombinator.com") || host.endsWith("workatastartup.com")) return "yc";
  if (host.endsWith("getro.com") || host.includes("jobs.a16z") || host.includes("portfolio")) return "vc";
  if (OTHER_BOARDS.some((b) => host.includes(b))) return "board";
  const via = `${url.searchParams.get("src") ?? ""} ${url.searchParams.get("utm_source") ?? ""}`.toLowerCase();
  if (via.includes("linkedin")) return "linkedin";
  // Greenhouse, Ashby, Lever, Workday, and every company's own careers domain.
  return "company";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppRef = { id: string; company: string; roleTitle: string };

export type FunnelStep = {
  key: "sent" | "response" | "interviewing" | "offer";
  label: string;
  count: number;
  // Share of the previous step that made it here. null on the first step.
  fromPrevious: number | null;
  apps: AppRef[];
};

export type BreakdownRow = {
  key: string;
  label: string;
  sent: number;
  responded: number;
  // null when sent < MIN_SAMPLE, so no caller can render a misleading percentage.
  rate: number | null;
  // One entry per sent application, true where it got a response. Drawn as pips
  // when the group is too small for a rate.
  outcomes: boolean[];
  companies: string[];
};

export type CompanyRow = {
  company: string;
  tier: number | null;
  queue: number;
  pipeline: number;
  passed: number;
  closed: number;
  jobUrl: string;
  domain: string | null;
  logo: string | null;
  contacts: number;
};

export type DueContact = { id: string; name: string; company: string; stage: string; days: number };

// The next dated thing on a list, with enough to say what and where under a number.
export type NextInterview = { appId: string; company: string; label: string; at: string };
export type NextCall = { contactId: string; name: string; company: string; label: string; at: string };
/** One dated thing ahead: an interview (a role) or a call (a person), for Home's Upcoming. */
export type UpcomingItem = {
  kind: "interview" | "call";
  href: string;
  title: string;
  label: string;
  at: string;
  // For the row's logo (CompanyLogo's inputs): the company, a URL to read its
  // domain from, and the domain and logo the role's enrichment found, if any.
  company: string;
  logoUrl: string;
  domain: string | null;
  logo: string | null;
};

// CompanyLogo's domainFromEnrichment and logoFromEnrichment, readable on the server
// (that module is a client component).
function logoOf(raw: string | null): { domain: string | null; logo: string | null } {
  let e: { companyDomain?: unknown; companyLogo?: unknown } = {};
  try {
    e = raw ? (JSON.parse(raw) ?? {}) : {};
  } catch {}
  return {
    domain: typeof e.companyDomain === "string" && e.companyDomain.includes(".") ? e.companyDomain : null,
    logo: typeof e.companyLogo === "string" && e.companyLogo.startsWith("https://") ? e.companyLogo : null,
  };
}

export type CountRow = { key: string; label: string; count: number };

export type Insights = {
  generatedAt: string;
  minSample: number;
  // Interviews and calls together, soonest first, the next five.
  upcoming: UpcomingItem[];
  applications: {
    sent: number;
    responded: number;
    responseRate: number | null;
    heardBack: number;
    rejected: number;
    withdrawn: number;
    waiting: number;
    freshSent: number;
    freshDays: number;
    notYetSent: number;
    sentThisWeek: number;
    sentLastWeek: number;
    queued: number;
    // Open and not archived: accepted-not-sent plus sent-and-undecided. The same
    // OPEN_STATUSES rule as the Pipeline tab's badge, so Home and the tab agree.
    activePipeline: number;
    upcomingInterviews: number;
    nextInterview: NextInterview | null;
    funnel: FunnelStep[];
    byTier: BreakdownRow[];
    bySource: BreakdownRow[];
    companies: CompanyRow[];
  };
  network: {
    total: number;
    inConversation: number;
    due: DueContact[];
    nudgeAfterDays: number;
    pipelineCompanies: string[];
    knownPipelineCompanies: { company: string; contacts: number }[];
    otherKnownCompanies: { company: string; contacts: number }[];
    upcomingCalls: number;
    nextCall: NextCall | null;
    // Home's networking funnel, the twin of queue → pipeline → interviews: people
    // found but not yet messaged, and people connected but with no call booked.
    toMessage: number;
    toSchedule: number;
    // The user's own categories. Tags are whatever is in use, in orderTags order;
    // untagged counts the people with none, so the empty state can be honest.
    byTag: CountRow[];
    untagged: number;
    byWarmth: CountRow[];
    // Every company someone in the network works at, most people first. inPipeline
    // marks the ones with an open application, the overlap that makes a referral.
    byCompany: { company: string; contacts: number; inPipeline: boolean }[];
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function companyKey(name: string): string {
  return canonicalCompany(name || "").toLowerCase().trim();
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
  } catch {
    return [];
  }
}

type Dated = { id?: string; label?: string; at?: string };

/**
 * The dated entries on a JSON list (interviewList, eventList) that fall today or
 * later. "Today" is from local midnight, not now: an interview at 9am is still
 * today's interview at 11am, and dropping it off Home the moment it starts would
 * hide the one thing on the calendar.
 */
function upcomingOf(raw: string | null, from: Date): (Dated & { at: string; time: number })[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return (list as Dated[])
    .filter((e): e is Dated & { at: string } => !!e && typeof e.at === "string")
    .map((e) => ({ ...e, time: new Date(e.at).getTime() }))
    .filter((e) => !isNaN(e.time) && e.time >= from.getTime());
}

function readEnrichment(raw: string | null): { companyDomain?: unknown; companyLogo?: unknown } {
  if (!raw) return {};
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

function rate(n: number, d: number): number | null {
  return d >= MIN_SAMPLE ? n / d : null;
}

/** Monday 00:00 local of the week containing `d`. */
function weekStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

// ---------------------------------------------------------------------------
// The computation
// ---------------------------------------------------------------------------

export async function computeInsights(): Promise<Insights> {
  const now = new Date();
  const [jobs, contacts, tierMap] = await Promise.all([
    prisma.job.findMany({
      select: {
        id: true,
        company: true,
        roleTitle: true,
        jobUrl: true,
        fitRationale: true,
        verdict: true,
        queueEnrichment: true,
        application: {
          select: {
            id: true,
            status: true,
            dateApplied: true,
            statusHistory: true,
            archivedAt: true,
            interviewList: true,
          },
        },
      },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        name: true,
        company: true,
        linkedinUrl: true,
        stage: true,
        stageHistory: true,
        eventList: true,
        relationship: true,
        warmth: true,
      },
    }),
    buildTierMap(),
  ]);

  // ---- Applications ------------------------------------------------------

  type Sent = AppRef & {
    reached: Set<string>;
    status: string;
    at: Date | null;
    archived: boolean;
    tier: number | null;
    source: SourceKey;
  };
  const sent: Sent[] = [];
  let notYetSent = 0;

  for (const j of jobs) {
    const a = j.application;
    if (!a) continue;
    const history = parseHistory(a.statusHistory);
    const reached = stagesReached(a.status, history);
    const wasSent = !!a.dateApplied || SENT_STAGES.some((s) => reached.has(s));
    if (!wasSent) {
      // Accepted into the pipeline but the form has not gone in. Archived ones were
      // closed before they were ever sent, so they are not "not yet", they are never.
      if (!a.archivedAt && a.status === "Applying") notYetSent += 1;
      continue;
    }
    // Archived applications that were sent still count. Archiving is how a closed
    // posting leaves the list, and an application that went in and then the posting
    // closed is still an application that did or did not get a reply.
    sent.push({
      id: a.id,
      company: j.company,
      roleTitle: j.roleTitle,
      reached,
      status: a.status,
      at: sentAt(a.dateApplied, history),
      archived: !!a.archivedAt,
      tier: tierFor(j.company, tierMap),
      source: sourceOf(j.jobUrl, j.fitRationale),
    });
  }

  const ref = (s: Sent): AppRef => ({ id: s.id, company: s.company, roleTitle: s.roleTitle });
  const hit = (s: Sent, stages: string[]) => stages.some((st) => s.reached.has(st));
  const responded = sent.filter((s) => hit(s, RESPONSE_STAGES));
  const interviewing = sent.filter((s) => hit(s, INTERVIEW_STAGES));
  const offered = sent.filter((s) => hit(s, OFFER_STAGES));
  const rejected = sent.filter((s) => s.status === "Rejected");
  const withdrawn = sent.filter((s) => s.status === "Withdrawn");
  // Sent, not closed, and nothing back yet: the applications still in the air.
  const waiting = sent.filter((s) => s.status === "Applied" && !s.archived);
  const heardBack = sent.filter((s) => hit(s, RESPONSE_STAGES) || s.status === "Rejected");
  const freshCutoff = now.getTime() - FRESH_DAYS * 86_400_000;
  // Only the ones still waiting. A rejection inside the window has been read, so
  // counting it as "may not have been read yet" would excuse an answer.
  const freshSent = waiting.filter((s) => s.at && s.at.getTime() >= freshCutoff);

  const steps: [FunnelStep["key"], string, Sent[]][] = [
    ["sent", "Applied", sent],
    ["response", "Got a response", responded],
    ["interviewing", "Interviewing", interviewing],
    ["offer", "Offer", offered],
  ];
  const funnel: FunnelStep[] = steps.map(([key, label, list], i) => {
    const prev = i > 0 ? steps[i - 1][2].length : 0;
    return {
      key,
      label,
      count: list.length,
      // Conversion between steps shows from the first application on: these are
      // the user's own counts, not a rate claimed about a group, so "1 of 2" is fair
      // to say. The page prints it as a fraction under MIN_SAMPLE.
      fromPrevious: i === 0 || prev === 0 ? null : list.length / prev,
      apps: list.map(ref),
    };
  });

  const breakdown = (groups: { key: string; label: string; match: (s: Sent) => boolean }[]): BreakdownRow[] =>
    groups
      .map((g) => {
        const members = sent.filter(g.match);
        const outcomes = members.map((s) => hit(s, RESPONSE_STAGES));
        const r = outcomes.filter(Boolean).length;
        return {
          key: g.key,
          label: g.label,
          sent: members.length,
          responded: r,
          rate: rate(r, members.length),
          outcomes,
          companies: [...new Set(members.map((s) => s.company))],
        };
      })
      // An empty group is noise. A group with one application stays, as pips.
      .filter((row) => row.sent > 0);

  const byTier = breakdown([
    { key: "sa", label: "S and A tier", match: (s) => s.tier !== null && s.tier <= 2 },
    { key: "b", label: "B tier and below", match: (s) => s.tier !== null && s.tier > 2 },
    // Untracked is mostly startups and the company-blind scans' finds.
    { key: "untracked", label: "Not on your list", match: (s) => s.tier === null },
  ]);

  const bySource = breakdown(
    (Object.keys(SOURCE_LABEL) as SourceKey[]).map((k) => ({
      key: k,
      label: SOURCE_LABEL[k],
      match: (s: Sent) => s.source === k,
    })),
  ).sort((a, b) => b.sent - a.sent);

  // ---- Roles per company -------------------------------------------------

  const contactsByCompany = new Map<string, number>();
  for (const c of contacts) {
    const k = companyKey(c.company);
    if (k) contactsByCompany.set(k, (contactsByCompany.get(k) ?? 0) + 1);
  }

  // Keyed on the raw Job.company, because that is what the applications page's
  // company chips filter on, and ?company= has to land on a chip that exists.
  const byCompany = new Map<string, CompanyRow>();
  for (const j of jobs) {
    let row = byCompany.get(j.company);
    if (!row) {
      const e = readEnrichment(j.queueEnrichment);
      row = {
        company: j.company,
        tier: tierFor(j.company, tierMap),
        queue: 0,
        pipeline: 0,
        passed: 0,
        closed: 0,
        jobUrl: j.jobUrl,
        domain: typeof e.companyDomain === "string" && e.companyDomain.includes(".") ? e.companyDomain : null,
        logo: typeof e.companyLogo === "string" && e.companyLogo.startsWith("https://") ? e.companyLogo : null,
        contacts: contactsByCompany.get(companyKey(j.company)) ?? 0,
      };
      byCompany.set(j.company, row);
    }
    const a = j.application;
    if (a && !a.archivedAt && OPEN_STATUSES.includes(a.status)) row.pipeline += 1;
    else if (a && (a.status === "Rejected" || a.status === "Withdrawn")) row.closed += 1;
    else if (j.verdict === null) row.queue += 1;
    else if (j.verdict === "Pass") row.passed += 1;
    // "Archived" verdicts are bulk cleanups, not decisions, so they are not activity.
  }
  const companies = [...byCompany.values()]
    .filter((r) => r.queue + r.pipeline + r.passed + r.closed > 0)
    .sort(
      (a, b) =>
        b.pipeline - a.pipeline ||
        b.queue - a.queue ||
        b.closed - a.closed ||
        b.passed - a.passed ||
        a.company.localeCompare(b.company),
    );

  // ---- This week --------------------------------------------------------

  // Calendar weeks from Monday, not a rolling seven days: "this week" on the home
  // page is a plan the user makes on Monday, and a rolling window would quietly
  // count last Tuesday's applications toward it. Last week is returned beside it so
  // a Monday-morning zero reads as a fresh week rather than a stall.
  const thisWeek = weekStart(now);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const sentThisWeek = sent.filter((s) => s.at && s.at >= thisWeek).length;
  const sentLastWeek = sent.filter((s) => s.at && s.at >= lastWeek && s.at < thisWeek).length;

  // Every role without a verdict, the same count the home tile and the queue tab
  // badge have always used, so the three agree.
  const queued = jobs.filter((j) => j.verdict === null).length;

  // ---- What is on the plate ----------------------------------------------

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const live = jobs.filter((j) => j.application && !j.application.archivedAt && OPEN_STATUSES.includes(j.application.status));
  const activePipeline = live.length;

  // Interviews only count on live applications: one still listed on a rejected or
  // archived row is not going to happen, whatever its date says.
  const interviews = live
    .flatMap((j) =>
      upcomingOf(j.application!.interviewList, today).map((iv) => ({
        appId: j.application!.id,
        company: j.company,
        jobUrl: j.jobUrl,
        enrichment: j.queueEnrichment,
        label: iv.label ?? "",
        at: iv.at,
        time: iv.time,
      })),
    )
    .sort((a, b) => a.time - b.time);
  const nextInterview: NextInterview | null = interviews[0]
    ? { appId: interviews[0].appId, company: interviews[0].company, label: interviews[0].label, at: interviews[0].at }
    : null;

  // ---- Network -----------------------------------------------------------

  const calls = contacts
    .flatMap((c) =>
      upcomingOf(c.eventList, today).map((e) => ({
        contactId: c.id,
        name: c.name,
        company: c.company,
        linkedinUrl: c.linkedinUrl,
        label: e.label ?? "",
        at: e.at,
        time: e.time,
      })),
    )
    .sort((a, b) => a.time - b.time);
  const nextCall: NextCall | null = calls[0]
    ? { contactId: calls[0].contactId, name: calls[0].name, company: calls[0].company, label: calls[0].label, at: calls[0].at }
    : null;

  const upcoming: UpcomingItem[] = [
    ...interviews.map((iv) => ({
      kind: "interview" as const,
      href: `/applications?app=${iv.appId}`,
      title: iv.company,
      label: iv.label || "Interview",
      at: iv.at,
      company: iv.company,
      logoUrl: iv.jobUrl,
      ...logoOf(iv.enrichment),
      time: iv.time,
    })),
    ...calls.map((c) => ({
      kind: "call" as const,
      href: `/networking?contact=${c.contactId}`,
      title: c.company ? `${c.name}, ${c.company}` : c.name,
      label: c.label || "Call",
      at: c.at,
      company: c.company,
      logoUrl: c.linkedinUrl ?? "",
      domain: null,
      logo: null,
      time: c.time,
    })),
  ]
    .sort((a, b) => a.time - b.time)
    .slice(0, 5)
    .map(({ time, ...item }) => (void time, item));

  // Tags are counted per person, so someone tagged "mentor" twice by a stray edit
  // is still one mentor. orderTags lowercases, so "Mentor" and "mentor" are one row.
  const tagCounts = new Map<string, number>();
  let untagged = 0;
  for (const c of contacts) {
    const tags = orderTags(parseStringArray(c.relationship));
    if (tags.length === 0) untagged += 1;
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const byTag: CountRow[] = orderTags(tagCounts.keys()).map((t) => ({ key: t, label: t, count: tagCounts.get(t) ?? 0 }));

  // All four rows always, including the zeros: warmth is a fixed three-step scale,
  // and a missing "close" row would hide that nobody is close yet.
  const byWarmth: CountRow[] = [
    ...WARMTH_LEVELS.map((w) => ({
      key: w,
      label: w,
      count: contacts.filter((c) => (c.warmth ?? "").toLowerCase() === w).length,
    })),
    {
      key: "unset",
      label: "not set",
      count: contacts.filter((c) => !(WARMTH_LEVELS as readonly string[]).includes((c.warmth ?? "").toLowerCase())).length,
    },
  ];

  // The steps that move someone down the funnel. "To message" is found but not yet
  // contacted; "to schedule" has accepted or replied and has no call booked.
  const stageOf = (c: { stage: string | null }) => c.stage ?? DEFAULT_STAGE;
  const toMessage = contacts.filter((c) => TO_MESSAGE_STAGES.includes(stageOf(c))).length;
  const toSchedule = contacts.filter((c) => TO_SCHEDULE_STAGES.includes(stageOf(c))).length;
  // A call counts as upcoming if it is on the calendar, or if the person is at
  // Scheduled without the call logged yet: moving the stage is the usual record.
  const withCall = new Set(calls.map((c) => c.contactId));
  const scheduledUnlogged = contacts.filter((c) => stageOf(c) === "Scheduled" && !withCall.has(c.id)).length;

  // "In conversation" is someone who has written back: a reply, a booked call, or a
  // call that happened. Connected is not it; accepting a request is not talking.
  const CONVERSATION_STAGES = ["Replied", "Scheduled", "Chatted"];
  let inConversation = 0;
  const due: DueContact[] = [];

  for (const c of contacts) {
    const stage = c.stage ?? DEFAULT_STAGE;
    if (CONVERSATION_STAGES.includes(stage)) inConversation += 1;

    if (FOLLOW_UP_STAGES.includes(stage)) {
      const history = parseHistory(c.stageHistory) as { at?: string }[];
      const last = history.length ? history[history.length - 1].at : null;
      const lastAt = last ? new Date(last) : null;
      if (lastAt && !isNaN(lastAt.getTime())) {
        const days = Math.floor((now.getTime() - lastAt.getTime()) / 86_400_000);
        if (days >= NUDGE_AFTER_DAYS) due.push({ id: c.id, name: c.name, company: c.company, stage, days });
      }
    }
  }
  due.sort((a, b) => b.days - a.days);

  // Pipeline companies are the open applications, sent or not, because "who do I
  // know at the place I am about to apply to" is the question a referral answers.
  const pipelineNames = new Map<string, string>();
  for (const j of jobs) {
    const a = j.application;
    if (a && !a.archivedAt && OPEN_STATUSES.includes(a.status)) {
      const k = companyKey(j.company);
      if (!pipelineNames.has(k)) pipelineNames.set(k, j.company);
    }
  }
  const knownPipelineCompanies: { company: string; contacts: number }[] = [];
  for (const [k, name] of pipelineNames) {
    const n = contactsByCompany.get(k) ?? 0;
    if (n > 0) knownPipelineCompanies.push({ company: name, contacts: n });
  }
  knownPipelineCompanies.sort((a, b) => b.contacts - a.contacts);

  // Display names for contact companies, first spelling wins.
  const contactCompanyName = new Map<string, string>();
  for (const c of contacts) {
    const k = companyKey(c.company);
    if (k && !contactCompanyName.has(k)) contactCompanyName.set(k, c.company);
  }
  const otherKnownCompanies = [...contactsByCompany.entries()]
    .filter(([k]) => !pipelineNames.has(k))
    .map(([k, n]) => ({ company: contactCompanyName.get(k) ?? k, contacts: n }))
    .sort((a, b) => b.contacts - a.contacts || a.company.localeCompare(b.company));

  const peopleByCompany = [
    ...knownPipelineCompanies.map((c) => ({ ...c, inPipeline: true })),
    ...otherKnownCompanies.map((c) => ({ ...c, inPipeline: false })),
  ].sort((a, b) => b.contacts - a.contacts || a.company.localeCompare(b.company));

  return {
    generatedAt: now.toISOString(),
    upcoming,
    minSample: MIN_SAMPLE,
    applications: {
      sent: sent.length,
      responded: responded.length,
      responseRate: rate(responded.length, sent.length),
      heardBack: heardBack.length,
      rejected: rejected.length,
      withdrawn: withdrawn.length,
      waiting: waiting.length,
      freshSent: freshSent.length,
      freshDays: FRESH_DAYS,
      notYetSent,
      sentThisWeek,
      sentLastWeek,
      queued,
      activePipeline,
      upcomingInterviews: interviews.length,
      nextInterview,
      funnel,
      byTier,
      bySource,
      companies,
    },
    network: {
      total: contacts.length,
      inConversation,
      due,
      nudgeAfterDays: NUDGE_AFTER_DAYS,
      pipelineCompanies: [...pipelineNames.values()],
      knownPipelineCompanies,
      otherKnownCompanies,
      upcomingCalls: calls.length + scheduledUnlogged,
      nextCall,
      toMessage,
      toSchedule,
      byTag,
      untagged,
      byWarmth,
      byCompany: peopleByCompany,
    },
  };
}
