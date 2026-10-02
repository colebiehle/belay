import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTierMap, isTrackedEmployer } from "@/lib/company-tier";
import {
  canonicalCompany,
  isDesignRole,
  passesStatedRules,
  isExcludedCompany,
  isReachableLevel,
  MAX_POSTING_AGE_DAYS,
} from "@/lib/role-filter";
import { COMP_FLOOR_USD } from "@/lib/search-config";
import { logJournal } from "@/lib/journal";

// Most VC portfolio job boards run on Getro, whose search API is public and
// unauthenticated. That matters because it indexes portfolio companies' own
// openings, which is how a well-funded company gets found BEFORE it becomes a
// name designers trade on podcasts. Every other intake path here either scans a
// company already on the target list or searches by title.
//
// Two quirks worth keeping: the Accept header is mandatory (omit it and the API
// answers 406), and the networks overlap heavily, so results dedupe on URL.
const SEARCH = (networkId: string) =>
  `https://api.getro.com/api/v2/collections/${networkId}/search/jobs`;

// The four largest design+US networks. A live count showed these cover most of
// the union; adding more networks mostly returns duplicates.
const NETWORKS: { id: string; name: string }[] = [
  { id: "8672", name: "Accel" },
  { id: "222", name: "General Catalyst" },
  { id: "2105", name: "Thrive" },
  { id: "257", name: "Khosla" },
];

const PAGES_PER_NETWORK = 3; // 50 per page

type GetroJob = {
  title?: string;
  url?: string;
  created_at?: number;
  seniority?: string;
  organization?: { name?: string };
  compensation_amount_min_cents?: number | null;
  compensation_amount_max_cents?: number | null;
};

// Seniority values above or below your band. The title filter catches most of
// this, but the field is cheaper and more reliable than parsing "Staff" out of a
// title that may not carry it.
const SENIORITY_EXCLUDE = new Set([
  "vice_president",
  "director",
  "executive",
  "internship",
  "entry",
]);

function money(cents?: number | null): number | null {
  if (!cents || cents <= 0) return null;
  return Math.round(cents / 100);
}

// Startups are welcome in the queue, they were only unwelcome in the tier list.
// So the portfolio-board arm gates on pay rather than on the target list: these
// boards are already quality-filtered by a top-tier VC having invested, and this
// is the one arm that reliably carries a band, which makes "pays well" checkable
// rather than a guess.
//
// The floor is checked against the TOP of a stated band, so a range clears it if its
// upper bound does. Zero by default, meaning no floor: see SEARCH_COMP_FLOOR_USD
// in lib/search-config.ts. An undisclosed band never qualifies when a floor is set,
// not as a judgement about the company but because there is nothing to check.

function compTop(j: GetroJob): number | null {
  return money(j.compensation_amount_max_cents) ?? money(j.compensation_amount_min_cents);
}

function paysWell(j: GetroJob): boolean {
  const top = compTop(j);
  return top !== null && top >= COMP_FLOOR_USD;
}

function compRange(j: GetroJob): string {
  const lo = money(j.compensation_amount_min_cents);
  const hi = money(j.compensation_amount_max_cents);
  if (lo && hi) return `$${Math.round(lo / 1000)}K - $${Math.round(hi / 1000)}K`;
  if (lo) return `from $${Math.round(lo / 1000)}K`;
  return "Not disclosed";
}

async function fetchNetwork(id: string, page: number): Promise<GetroJob[]> {
  try {
    const res = await fetch(SEARCH(id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // required; without it the API answers 406
      },
      body: JSON.stringify({
        hitsPerPage: 50,
        page,
        filters: {
          job_functions: ["Design"],
          searchable_locations: ["United States"],
        },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results?.jobs ?? []) as GetroJob[];
  } catch {
    return [];
  }
}

export async function POST() {
  const seen = new Map<string, { job: GetroJob; network: string }>();
  let scanned = 0;

  for (const net of NETWORKS) {
    for (let page = 0; page < PAGES_PER_NETWORK; page++) {
      const jobs = await fetchNetwork(net.id, page);
      if (jobs.length === 0) break;
      scanned += jobs.length;
      for (const j of jobs) {
        if (j.url && !seen.has(j.url)) seen.set(j.url, { job: j, network: net.name });
      }
    }
  }

  const candidates = [...seen.values()].filter(({ job }) => {
    const title = job.title ?? "";
    const company = canonicalCompany(job.organization?.name ?? "");
    if (!title || !company || !job.url) return false;
    if (job.seniority && SENIORITY_EXCLUDE.has(job.seniority)) return false;
    if (!isDesignRole(title)) return false;
    if (!passesStatedRules(title, company)) return false;
    if (!isReachableLevel(title)) return false;
    if (isExcludedCompany(company)) return false;
    // created_at is unix seconds. Undated postings are kept, as everywhere else.
    if (job.created_at) {
      const ageDays = (Date.now() / 1000 - job.created_at) / 86_400;
      if (ageDays > MAX_POSTING_AGE_DAYS) return false;
    }
    return true;
  });

  let added = 0;
  const addedRows: { company: string; roleTitle: string }[] = [];
  // Company-blind source: gate on the target list. See isTrackedEmployer.
  const tierMap = await buildTierMap();
  let untracked = 0;

  for (const { job, network } of candidates) {
    const company = canonicalCompany(job.organization!.name!);
    // Either on the target list, or paying above the floor. See COMP_FLOOR_USD.
    if (!isTrackedEmployer(company, tierMap) && !paysWell(job)) { untracked += 1; continue; }
    const roleTitle = job.title!;
    const existing = await prisma.job.findFirst({
      where: { OR: [{ jobUrl: job.url! }, { AND: [{ company }, { roleTitle }] }] },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.job.create({
      data: {
        company,
        roleTitle,
        jobUrl: job.url!,
        location: "United States",
        // The one intake path that reliably carries comp, because these boards
        // publish the band rather than burying it in the posting body.
        compRange: compRange(job),
        expRange: "",
        description: "",
        fitScore: 0,
        fitRationale: `Surfaced from the ${network} portfolio board.`,
        priority: "MONITOR",
        ...(job.created_at ? { datePosted: new Date(job.created_at * 1000) } : {}),
      },
    });
    added += 1;
    addedRows.push({ company, roleTitle });
  }

  const summary = `Portfolio boards: scanned ${scanned} listings across ${NETWORKS.length} networks, ${candidates.length} passed filters, ${untracked} skipped as untracked and below the comp floor, ${added} new.`;
  if (added > 0) {
    await logJournal({ type: "ai_run", surface: "ingest/getro", summary, meta: { added, scanned, untracked } });
  }

  return NextResponse.json({ ok: true, summary, added, scanned, rows: addedRows });
}
