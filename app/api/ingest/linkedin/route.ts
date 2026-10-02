import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTierMap, isTrackedEmployer } from "@/lib/company-tier";
import {
  canonicalCompany,
  isDesignRole,
  passesStatedRules,
  isExcludedCompany,
  isReachableLevel,
  isUsLocation,
  extractMinYoe,
  MAX_YOE,
  isFreshPosting,
} from "@/lib/role-filter";
import { logJournal } from "@/lib/journal";

// LinkedIn's guest job endpoints answer without a session. That matters a lot
// here: until now LinkedIn reached the queue only through alert emails, which
// carry a title, a company and a link and nothing else — so seven companies
// with no readable board produced cards with no description to judge.
//
// These endpoints return the full posting, so LinkedIn becomes a first-class
// source instead of a thin one. It also searches by title across every
// employer, which is the only path that surfaces roles at companies not on the
// target list.
//
// Deliberately conservative: a handful of queries, a few pages each, and a
// detail fetch only for postings that already survived every filter.
const SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DETAIL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// The two buckets you asked for. Everything narrower is already covered by the
// title filter, and a wider query just spends pages on roles that get dropped.
const QUERIES = ["product designer", "ux designer"];
const PAGES_PER_QUERY = 4; // 10 cards per page
const MAX_DETAIL_FETCHES = 25;

type Card = {
  title: string;
  company: string;
  location: string;
  url: string;
  posted: Date | null;
};

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// The search response is a bare list of <li> cards rather than a JSON payload,
// so each card is sliced out first and its fields read within that slice.
// Parsing the whole document field-by-field would pair the third title with the
// seventh company the moment one card is missing a field.
function parseCards(html: string): Card[] {
  const out: Card[] = [];
  const chunks = html.split(/<li[\s>]/).slice(1);
  for (const chunk of chunks) {
    const title = chunk.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/)?.[1];
    const company = chunk.match(/base-search-card__subtitle[^>]*>[\s\S]*?>([\s\S]*?)<\/a>/)?.[1];
    const location = chunk.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/)?.[1];
    const url = chunk.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/)?.[1];
    const dt = chunk.match(/datetime="([0-9-]+)"/)?.[1];
    if (!title || !company || !url) continue;
    const posted = dt ? new Date(dt) : null;
    out.push({
      title: decode(title),
      company: canonicalCompany(decode(company)),
      location: decode(location ?? ""),
      url,
      posted: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    });
  }
  return out;
}

function jobIdFrom(url: string): string | null {
  return url.match(/(\d{8,})/)?.[1] ?? null;
}

// The detail endpoint returns the posting body plus the criteria block, which is
// where the real seniority lives. A title can say "Product Designer" while the
// posting asks for eight years.
function parseDetail(html: string): { description: string; criteria: string[] } {
  const criteria = [
    ...html.matchAll(/description__job-criteria-text[^>]*>([\s\S]*?)<\/span>/g),
  ].map((m) => decode(m[1]));
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return { description: decode(body).slice(0, 6000), criteria };
}

export async function POST() {
  const seen = new Map<string, Card>();
  let scanned = 0;

  for (const q of QUERIES) {
    for (let page = 0; page < PAGES_PER_QUERY; page++) {
      const url =
        `${SEARCH}?keywords=${encodeURIComponent(q)}` +
        `&location=${encodeURIComponent("United States")}` +
        `&f_TPR=r604800&start=${page * 10}`;
      const html = await get(url);
      if (!html) break;
      const cards = parseCards(html);
      scanned += cards.length;
      for (const c of cards) if (!seen.has(c.url)) seen.set(c.url, c);
      if (cards.length === 0) break;
    }
  }

  // Company-blind source: the queue only takes roles from companies on the
  // target list. See isTrackedEmployer for why, and why manual URL adds bypass
  // it. This gate is what lets the arm keep its reach (Google, Apple, Microsoft
  // and Meta have no fetchable feed) without its noise.
  const tierMap = await buildTierMap();

  // Same gates as every other intake path, cheapest first.
  const beforeTrackedGate = [...seen.values()]
    .filter((c) => isDesignRole(c.title))
    .filter((c) => isReachableLevel(c.title))
    .filter((c) => isUsLocation(c.location))
    // Only the company-blind paths need this. The first live run returned a
    // defense consultancy, a law firm, a hotel group and a paint manufacturer —
    // all with impeccable design titles.
    .filter((c) => !isExcludedCompany(c.company))
    .filter((c) => passesStatedRules(c.title, c.company))
    .filter((c) => isFreshPosting(c.posted));

  const candidates = beforeTrackedGate.filter((c) => isTrackedEmployer(c.company, tierMap));
  const untracked = beforeTrackedGate.length - candidates.length;

  let added = 0;
  let detailFetches = 0;
  const addedRows: { company: string; roleTitle: string }[] = [];

  for (const c of candidates) {
    const existing = await prisma.job.findFirst({
      where: {
        OR: [
          { jobUrl: c.url },
          { AND: [{ company: c.company }, { roleTitle: c.title }] },
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    // Only now is it worth a second request.
    let description = "";
    let expRange = "";
    if (detailFetches < MAX_DETAIL_FETCHES) {
      const id = jobIdFrom(c.url);
      if (id) {
        detailFetches += 1;
        const html = await get(`${DETAIL}/${id}`);
        if (html) {
          const d = parseDetail(html);
          description = d.description;
          const yoe = extractMinYoe(d.description);
          // The years figure is the one gate that reflects what the team will
          // actually screen on, so it is applied once the body is in hand.
          if (yoe !== null && yoe > MAX_YOE) continue;
          if (yoe !== null) expRange = `${yoe}+ yrs`;
        }
      }
    }

    await prisma.job.create({
      data: {
        company: c.company,
        roleTitle: c.title,
        jobUrl: c.url,
        location: c.location,
        compRange: "Not disclosed",
        expRange,
        description,
        fitScore: 0,
        fitRationale: description
          ? "Surfaced from a LinkedIn title search."
          : "Surfaced from a LinkedIn title search; the posting body could not be read.",
        priority: "MONITOR",
        ...(c.posted ? { datePosted: c.posted } : {}),
      },
    });
    added += 1;
    addedRows.push({ company: c.company, roleTitle: c.title });
  }

  const summary = `LinkedIn: scanned ${scanned} listings, ${candidates.length} passed filters, ${untracked} skipped as untracked employers, ${added} new.`;
  if (added > 0) {
    await logJournal({
      // No "ingest" type exists; a scan is a machine-run event, which is what
      // ai_run covers elsewhere (jobs/enrich logs the same way).
      type: "ai_run",
      surface: "ingest/linkedin",
      summary,
      meta: { added, scanned },
    });
  }

  return NextResponse.json({ ok: true, summary, added, scanned, rows: addedRows });
}
