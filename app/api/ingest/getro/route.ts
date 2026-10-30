import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { admitRoles } from "@/lib/role-prescreen";
import {
  canonicalCompany,
  isDesignRole,
  passesStatedRules,
  isExcludedCompany,
  isReachableLevel,
  isFreshPosting,
  isUsLocation,
} from "@/lib/role-filter";
import { mergeBackers } from "@/lib/backers";
import { CONSIDER_BOARDS, GETRO_NETWORKS } from "@/lib/portfolio-boards";
import { logJournal } from "@/lib/journal";

// VC portfolio job boards. They index portfolio companies' own openings, which is
// how a well-funded company gets found BEFORE it becomes a name designers trade
// on podcasts, and the firm that lists a role is a fact worth keeping: it goes on
// the role as a backer (lib/backers), which moves where it sorts.
//
// Two platforms carry nearly all of them:
//   Getro    — public, unauthenticated search API. The Accept header is mandatory
//              (omit it and the API answers 406).
//   Consider — the board page hands out a CSRF token and a session cookie, and the
//              search API takes both. It was written off as unreadable in Oct 2026
//              ("React apps that keep the job data off the URL"); the API behind
//              the page answered once given the token, on 2026-10-29.
// The boards overlap heavily, so results dedupe on URL and a role listed by two
// firms carries both.

const GETRO_SEARCH = (networkId: string) => `https://api.getro.com/api/v2/collections/${networkId}/search/jobs`;

const GETRO_PAGES = 3; // 50 per page
// The weekly gap check (?weekly) reads twice as deep on both platforms.
const WEEKLY_DEPTH = 2;

// The boards themselves are listed in lib/portfolio-boards, which Home reads too.
const CONSIDER_PAGE_SIZE = 100;
const CONSIDER_PAGES = 2;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// One shape for both platforms, so the gates below are written once.
type PortfolioJob = {
  title: string;
  url: string;
  company: string;
  location: string;
  posted?: Date;
  comp: string;
  // The board's own seniority says the role is out of band.
  offLevel: boolean;
};

// Seniority values above or below your band. The title filter catches most of
// this, but the field is cheaper and more reliable than parsing "Staff" out of a
// title that may not carry it.
const GETRO_SENIORITY_EXCLUDE = new Set(["vice_president", "director", "executive", "internship", "entry"]);
const CONSIDER_SENIORITY_EXCLUDE = new Set(["director", "executive", "vp", "intern", "internship", "entry", "junior"]);

function band(lo: number | null, hi: number | null): string {
  if (lo && hi) return `$${Math.round(lo / 1000)}K - $${Math.round(hi / 1000)}K`;
  if (lo) return `from $${Math.round(lo / 1000)}K`;
  return "Not disclosed";
}

// Startups are welcome in the queue, they were only unwelcome in the tier list.
// These boards are already quality-filtered by a top-tier VC having invested, and
// they reliably carry a pay band. The band goes to the pre-screen
// (lib/role-prescreen) as part of each role, which is where pay counts.

type GetroJob = {
  title?: string;
  url?: string;
  created_at?: number;
  seniority?: string;
  organization?: { name?: string };
  compensation_amount_min_cents?: number | null;
  compensation_amount_max_cents?: number | null;
};

async function fetchGetro(id: string, page: number): Promise<PortfolioJob[]> {
  try {
    const res = await fetch(GETRO_SEARCH(id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // required; without it the API answers 406
      },
      body: JSON.stringify({
        hitsPerPage: 50,
        page,
        filters: { job_functions: ["Design"], searchable_locations: ["United States"] },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cents = (c?: number | null) => (c && c > 0 ? Math.round(c / 100) : null);
    return ((data?.results?.jobs ?? []) as GetroJob[]).map((j) => ({
      title: j.title ?? "",
      url: j.url ?? "",
      company: j.organization?.name ?? "",
      location: "United States",
      // created_at is unix seconds.
      posted: j.created_at ? new Date(j.created_at * 1000) : undefined,
      comp: band(cents(j.compensation_amount_min_cents), cents(j.compensation_amount_max_cents)),
      offLevel: !!j.seniority && GETRO_SENIORITY_EXCLUDE.has(j.seniority),
    }));
  } catch {
    return [];
  }
}

type ConsiderJob = {
  title?: string;
  url?: string;
  applyUrl?: string;
  companyName?: string;
  locations?: string[];
  timeStamp?: string;
  salary?: { minValue?: number; maxValue?: number; currency?: { value?: string }; period?: { value?: string } } | null;
  jobSeniorities?: { id?: string }[];
};

// The page sets the session cookie and embeds the CSRF token; the search call
// needs both, from the same visit.
async function considerSession(host: string): Promise<{ cookie: string; token: string } | null> {
  try {
    const res = await fetch(`https://${host}/jobs`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) return null;
    const html = await res.text();
    const token = html.match(/"csrfToken":"([^"]+)"/)?.[1];
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return token && cookie ? { cookie, token } : null;
  } catch {
    return null;
  }
}

async function fetchConsider(host: string, board: string, pages: number): Promise<PortfolioJob[]> {
  const session = await considerSession(host);
  if (!session) return [];
  const out: PortfolioJob[] = [];
  let sequence: string | undefined;
  for (let page = 0; page < pages; page++) {
    try {
      const res = await fetch(`https://${host}/api-boards/search-jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": UA,
          Cookie: session.cookie,
          "x-csrf-token": session.token,
        },
        body: JSON.stringify({
          meta: { size: CONSIDER_PAGE_SIZE, ...(sequence ? { sequence } : {}) },
          board: { id: board, isParent: true },
          query: { jobFunctions: ["Design"], locations: ["United States"] },
          grouped: false,
        }),
      });
      if (!res.ok) break;
      const data = await res.json();
      const jobs = (data?.jobs ?? []) as ConsiderJob[];
      for (const j of jobs) {
        const s = j.salary;
        const yearlyUsd = s && (s.currency?.value ?? "USD") === "USD" && (s.period?.value ?? "year") === "year";
        const levels = (j.jobSeniorities ?? []).map((x) => x.id ?? "").filter(Boolean);
        out.push({
          title: j.title ?? "",
          url: j.url ?? j.applyUrl ?? "",
          company: j.companyName ?? "",
          location: (j.locations ?? []).join(", ") || "United States",
          posted: j.timeStamp ? new Date(j.timeStamp) : undefined,
          comp: yearlyUsd ? band(s.minValue ?? null, s.maxValue ?? null) : "Not disclosed",
          offLevel: levels.length > 0 && levels.every((l) => CONSIDER_SENIORITY_EXCLUDE.has(l)),
        });
      }
      sequence = data?.meta?.sequence;
      if (jobs.length < CONSIDER_PAGE_SIZE || !sequence) break;
    } catch {
      break;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const depth = new URL(req.url).searchParams.has("weekly") ? WEEKLY_DEPTH : 1;
  const seen = new Map<string, { job: PortfolioJob; backers: string[] }>();
  let scanned = 0;
  const take = (jobs: PortfolioJob[], firm: string) => {
    scanned += jobs.length;
    for (const j of jobs) {
      if (!j.url) continue;
      const hit = seen.get(j.url);
      if (hit) {
        if (!hit.backers.includes(firm)) hit.backers.push(firm);
      } else {
        seen.set(j.url, { job: j, backers: [firm] });
      }
    }
  };

  for (const net of GETRO_NETWORKS) {
    for (let page = 0; page < GETRO_PAGES * depth; page++) {
      const jobs = await fetchGetro(net.id, page);
      if (jobs.length === 0) break;
      take(jobs, net.name);
    }
  }
  const consider = await Promise.all(CONSIDER_BOARDS.map((b) => fetchConsider(b.host, b.board, CONSIDER_PAGES * depth)));
  CONSIDER_BOARDS.forEach((b, i) => take(consider[i], b.name));
  const unreadable = CONSIDER_BOARDS.filter((_, i) => consider[i].length === 0).map((b) => b.name);

  const candidates = [...seen.values()].filter(({ job }) => {
    const company = canonicalCompany(job.company);
    if (!job.title || !company) return false;
    if (job.offLevel) return false;
    if (!isDesignRole(job.title)) return false;
    if (!passesStatedRules(job.title, company)) return false;
    if (!isReachableLevel(job.title)) return false;
    if (isExcludedCompany(company)) return false;
    // Both platforms are asked for US roles, but a role open in several countries
    // matches that filter on its US office and may name only the others.
    if (!isUsLocation(job.location)) return false;
    // Undated postings are kept, as everywhere else.
    if (job.posted && !isFreshPosting(job.posted)) return false;
    return true;
  });

  let added = 0;
  const addedRows: { company: string; roleTitle: string }[] = [];
  // Company-blind source: tracked and founding roles pass, and the rest get the
  // cheap pre-screen against your criteria, pay and backers included
  // (lib/role-prescreen).
  const { admitted, turnedAway: untracked } = await admitRoles(candidates, ({ job, backers }) => ({
    company: canonicalCompany(job.company),
    title: job.title,
    comp: job.comp,
    backers,
  }));

  for (const { job, backers } of admitted) {
    const company = canonicalCompany(job.company);
    const roleTitle = job.title;
    const existing = await prisma.job.findFirst({
      where: { OR: [{ jobUrl: job.url }, { AND: [{ company }, { roleTitle }] }] },
      select: { id: true, backers: true },
    });
    if (existing) {
      // Found earlier by another arm: keep it, but record who backs it.
      const merged = mergeBackers(existing.backers, backers);
      if (merged !== existing.backers) await prisma.job.update({ where: { id: existing.id }, data: { backers: merged } });
      continue;
    }

    await prisma.job.create({
      data: {
        company,
        roleTitle,
        jobUrl: job.url,
        location: job.location,
        // These boards publish the band rather than burying it in the posting body.
        compRange: job.comp,
        expRange: "",
        description: "",
        fitScore: 0,
        fitRationale: `Surfaced from the ${backers.join(" and ")} portfolio board${backers.length > 1 ? "s" : ""}.`,
        priority: "MONITOR",
        backers: mergeBackers("", backers),
        ...(job.posted ? { datePosted: job.posted } : {}),
      },
    });
    added += 1;
    addedRows.push({ company, roleTitle });
  }

  const boards = GETRO_NETWORKS.length + CONSIDER_BOARDS.length - unreadable.length;
  const summary =
    `Portfolio boards: scanned ${scanned} listings across ${boards} boards, ${candidates.length} passed filters, ` +
    `${untracked} turned away by the pre-screen, ${added} new.` +
    (unreadable.length ? ` Unreadable this run: ${unreadable.join(", ")}.` : "");
  if (added > 0) {
    await logJournal({ type: "ai_run", surface: "ingest/getro", summary, meta: { added, scanned, untracked } });
  }

  return NextResponse.json({ ok: true, summary, added, scanned, rows: addedRows });
}
