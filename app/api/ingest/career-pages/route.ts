import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { understandingBlock } from "@/lib/foundation";
import { logJournal } from "@/lib/journal";
import {
  isDesignRole,
  isReachableLevel,
  isUsLocation,
  extractMinYoe,
  MAX_YOE,
  isFreshPosting,
  passesStatedRules,
  canonicalCompany,
} from "@/lib/role-filter";
import { ATS_BOARDS, MANUAL_ONLY } from "@/lib/ats-boards";
import { stripHtml, stripHtmlKeepLinks } from "@/lib/html";
import { identityLine } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ExtractedListing = {
  // `company` is required for HuntSites (multi-employer), optional for TargetCompanies
  // (single-employer, attributed by the source).
  company?: string;
  roleTitle: string;
  jobUrl: string;
  location?: string;
  compRange?: string;
  expRange?: string;
  descriptionSnippet?: string;
  // Only the ATS fast path can supply this. Careers pages rarely render a
  // reliable posting date; job sites usually say "11 days ago" instead, which the
  // extractor returns as postedDaysAgo.
  datePosted?: Date;
  postedDaysAgo?: number | null;
  // When the board last touched the listing. Greenhouse exposes updated_at;
  // Ashby's posting API does not, so Ashby-sourced rows carry only datePosted.
  dateUpdated?: Date;
};

const SEARCH_CONTEXT_KINDS = [
  "search_target_roles",
  "search_target_problems",
  "search_positive_signals",
  "search_negative_signals",
  "search_hard_skips",
];

const FETCH_TIMEOUT_MS = 20_000;
// Board APIs return every open role with full descriptions — OpenAI's is several
// megabytes. A 20s budget silently dropped the largest (and most relevant) boards
// to the HTML fallback, which then failed as "JS-rendered".
const ATS_FETCH_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Belay/1.0)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


function absolutize(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

// ATS fast path — board tokens and coverage live in lib/ats-boards.ts so the
// dashboard grid can mark which logos still need a manual check.

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// amazon.jobs exposes search.json: a plain GET returning jobs[] with the full
// description and qualifications, which is everything the level gates need.
async function fetchAmazonListings(
  company: string,
  query: string,
  allowResearch: boolean,
): Promise<ExtractedListing[] | null> {
  try {
    const res = await fetch(
      `https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(query)}&result_limit=100&sort=recent`,
      { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const jobs: Record<string, unknown>[] = data.jobs ?? [];
    return jobs
      .map((j) => {
        const body = [j.description, j.basic_qualifications, j.preferred_qualifications]
          .map((x) => String(x ?? ""))
          .join(" ");
        const posted = new Date(String(j.posted_date ?? ""));
        return {
          title: String(j.title ?? "").trim(),
          url: j.job_path ? `https://www.amazon.jobs${String(j.job_path)}` : "",
          location: String(j.normalized_location ?? j.location ?? ""),
          posted: Number.isNaN(posted.getTime()) ? undefined : posted,
          body,
        };
      })
      .filter((j) => j.title && j.url)
      // Freshness gate at ingest. A posting older than this has already been
      // screened down, so it is a poor use of an application slot. Undated
      // postings are kept: no date is not evidence of age.
      .filter((j) => isFreshPosting(j.posted))
      .filter((j) => isDesignRole(j.title, allowResearch))
      .filter((j) => isReachableLevel(j.title))
      .filter((j) => isUsLocation(j.location))
      .map((j) => ({ ...j, yoe: extractMinYoe(j.body) }))
      .filter((j) => j.yoe === null || j.yoe <= MAX_YOE)
      .map((j) => ({
        company,
        roleTitle: j.title,
        jobUrl: j.url,
        location: j.location,
        datePosted: j.posted,
        expRange: j.yoe !== null ? `${j.yoe}+ yrs` : "",
        descriptionSnippet: j.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
      }));
  } catch {
    return null;
  }
}

// Workday's cxs endpoint takes a POST and returns jobPostings[] with a relative
// externalPath. Token format: "<host-prefix>|<tenant>|<board>", for example
// "adobe.wd5|adobe|external_experienced".
// "Posted Today" | "Posted Yesterday" | "Posted 5 Days Ago" | "Posted 30+ Days Ago"
function parseWorkdayPostedOn(text: string): Date | undefined {
  const t = text.toLowerCase();
  if (!t) return undefined;
  if (t.includes("today")) return new Date();
  if (t.includes("yesterday")) return new Date(Date.now() - 86_400_000);
  const m = t.match(/(\d+)\+?\s*days?\s*ago/);
  if (m) return new Date(Date.now() - Number(m[1]) * 86_400_000);
  return undefined;
}

async function fetchWorkdayListings(
  company: string,
  token: string,
  allowResearch: boolean,
): Promise<ExtractedListing[] | null> {
  const [hostPrefix, tenant, board] = token.split("|");
  if (!hostPrefix || !tenant || !board) return null;
  const base = `https://${hostPrefix}.myworkdayjobs.com`;
  try {
    const res = await fetch(`${base}/wday/cxs/${tenant}/${board}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": BROWSER_UA },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "product designer" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const posts: Record<string, unknown>[] = data.jobPostings ?? [];
    return posts
      .map((j) => ({
        title: String(j.title ?? "").trim(),
        // externalPath is relative to the board, not the cxs endpoint.
        url: j.externalPath ? `${base}/en-US/${board}${String(j.externalPath)}` : "",
        location: String(j.locationsText ?? ""),
        // "Posted 30+ Days Ago" is the only date Workday gives; too coarse to gate on.
        // Workday gives "Posted Today" / "Posted 5 Days Ago" / "Posted 30+ Days
        // Ago" rather than a timestamp. Coarse, but enough to hold Adobe to the
        // same freshness rule as every other source.
        posted: parseWorkdayPostedOn(String(j.postedOn ?? "")),
        body: "",
      }))
      .filter((j) => j.title && j.url)
      // Freshness gate at ingest. A posting older than this has already been
      // screened down, so it is a poor use of an application slot. Undated
      // postings are kept: no date is not evidence of age.
      .filter((j) => isFreshPosting(j.posted))
      .filter((j) => isDesignRole(j.title, allowResearch))
      .filter((j) => isReachableLevel(j.title))
      .filter((j) => isUsLocation(j.location))
      .map((j) => ({
        company,
        roleTitle: j.title,
        jobUrl: j.url,
        location: j.location,
        datePosted: j.posted,
        expRange: "",
        descriptionSnippet: "",
      }));
  } catch {
    return null;
  }
}

// Eightfold powers a number of large careers sites, Netflix among them. The
// search endpoint is public and unauthenticated; the catch is that the listing
// response carries an empty job_description, so the body has to be fetched per
// posting. Gate on title, level, location and age first, then pull bodies only
// for what survives — that keeps a 35-result search to a handful of detail
// requests rather than 35.
// Token format: "<careers-host>|<domain>", e.g. "explore.jobs.netflix.net|netflix.com".
async function fetchEightfoldListings(
  company: string,
  token: string,
  allowResearch: boolean,
): Promise<ExtractedListing[] | null> {
  const [host, domain] = token.split("|");
  if (!host || !domain) return null;
  const headers = { "User-Agent": BROWSER_UA, Accept: "application/json" };
  try {
    const res = await fetch(
      `https://${host}/api/apply/v2/jobs?domain=${encodeURIComponent(domain)}` +
        `&query=${encodeURIComponent("product designer")}&location=United%20States&start=0&num=50`,
      { headers },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const positions: Record<string, unknown>[] = data.positions ?? [];

    const survivors = positions
      .map((p) => ({
        id: String(p.id ?? ""),
        title: String(p.name ?? "").trim(),
        url: String(p.canonicalPositionUrl ?? ""),
        location: String(p.location ?? ""),
        // t_create is epoch *seconds*, not milliseconds.
        posted: p.t_create ? new Date(Number(p.t_create) * 1000) : undefined,
      }))
      .filter((j) => j.id && j.title && j.url)
      .filter((j) => isFreshPosting(j.posted))
      .filter((j) => isDesignRole(j.title, allowResearch))
      .filter((j) => isReachableLevel(j.title))
      .filter((j) => isUsLocation(j.location));

    const out: ExtractedListing[] = [];
    for (const j of survivors) {
      let body = "";
      try {
        const d = await fetch(`https://${host}/api/apply/v2/jobs/${j.id}?domain=${encodeURIComponent(domain)}`, { headers });
        if (d.ok) body = String((await d.json())?.job_description ?? "");
      } catch {
        // A missing body only costs the years gate below, not the listing.
      }
      const yoe = extractMinYoe(body);
      if (yoe !== null && yoe > MAX_YOE) continue;
      out.push({
        company,
        roleTitle: j.title,
        jobUrl: j.url,
        location: j.location,
        datePosted: j.posted,
        expRange: yoe !== null ? `${yoe}+ yrs` : "",
        descriptionSnippet: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
      });
    }
    return out;
  } catch {
    return null;
  }
}

// A job is "already seen" if we hold the same normalised URL, or the same role
// title at the same company. The second test matters: the same Apple role was
// ingested twice under two URLs, and `jobUrl @unique` cannot catch that.
// A COMPARISON KEY, not a storable URL. It drops the query string, which is
// where Stripe and Nintendo put the job id — so storing the result gives you a
// link to the careers search page instead of the posting. Store the original and
// compare with this.
function normalizeJobUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, "")}`;
  } catch {
    return u;
  }
}

async function alreadyHave(company: string, roleTitle: string, url: string): Promise<boolean> {
  // The URL leg used to be `{ jobUrl: url }` with a normalised url passed in and
  // the un-normalised original stored, so it could only ever match rows whose URL
  // happened to need no normalising — 10 of 157 stored URLs carry a query string,
  // a hash or a trailing slash, and for every one of those the leg silently never
  // fired and only company+title was doing any work.
  //
  // Compared in application code rather than SQL because normalisation is a URL
  // parse, not something the database can express.
  const candidates = await prisma.job.findMany({
    where: { OR: [{ AND: [{ company }, { roleTitle }] }, { jobUrl: { contains: hostOf(url) } }] },
    select: { id: true, jobUrl: true, company: true, roleTitle: true },
  });
  return candidates.some(
    (j) =>
      normalizeJobUrl(j.jobUrl) === url ||
      (j.company === company && j.roleTitle === roleTitle),
  );
}

/** Host only, as a cheap SQL prefilter before the normalised comparison. */
function hostOf(u: string): string {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return u;
  }
}

async function fetchAtsListings(
  company: string,
  board: { provider: string; token: string },
  allowResearch: boolean,
): Promise<ExtractedListing[] | null> {
  // Amazon and Workday are POST/query APIs rather than static board dumps, so
  // they get their own fetchers and return early.
  if (board.provider === "amazon") return fetchAmazonListings(company, board.token, allowResearch);
  if (board.provider === "workday") return fetchWorkdayListings(company, board.token, allowResearch);
  if (board.provider === "eightfold") return fetchEightfoldListings(company, board.token, allowResearch);

  const url =
    board.provider === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`
      : board.provider === "ashby"
        ? `https://api.ashbyhq.com/posting-api/job-board/${board.token}`
        : `https://api.lever.co/v0/postings/${board.token}?mode=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATS_FETCH_TIMEOUT_MS);
  try {
    // Ashby 403s requests with a default runtime user agent. Greenhouse and Lever
    // don't care, so send a browser UA for all three rather than special-casing.
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Each provider names the posting date differently, and Lever gives epoch ms
    // rather than ISO. Invalid or absent dates become undefined so the column
    // stays null instead of storing an Invalid Date.
    const toDate = (v: unknown): Date | undefined => {
      if (v === null || v === undefined) return undefined;
      const d = typeof v === "number" ? new Date(v) : new Date(String(v));
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    const raw: { title: string; url: string; location: string; posted?: Date; updated?: Date; body: string }[] =
      board.provider === "greenhouse"
        ? (data.jobs ?? []).map((j: Record<string, unknown>) => ({
            title: String(j.title ?? ""),
            url: String(j.absolute_url ?? ""),
            location: String((j.location as { name?: string })?.name ?? ""),
            posted: toDate(j.first_published ?? j.updated_at),
            updated: toDate(j.updated_at),
            body: String(j.content ?? ""),
          }))
        : board.provider === "ashby"
          ? (data.jobs ?? []).map((j: Record<string, unknown>) => ({
              title: String(j.title ?? ""),
              url: String(j.jobUrl ?? j.applyUrl ?? ""),
              location: String(j.location ?? ""),
              // Ashby's posting API returns publishedAt and nothing else
              // date-shaped — there is no updated field to read, so Ashby rows
              // (OpenAI, Notion, Cursor) carry a single date by design.
              posted: toDate(j.publishedAt),
              body: String(j.descriptionPlain ?? j.descriptionHtml ?? ""),
            }))
          : (Array.isArray(data) ? data : []).map((j: Record<string, unknown>) => ({
              title: String(j.text ?? ""),
              url: String(j.hostedUrl ?? ""),
              location: String((j.categories as { location?: string })?.location ?? ""),
              posted: toDate(j.createdAt),
              // Read opportunistically. Not falling back to createdAt on
              // purpose: that would render a "refreshed" date identical to
              // "opened", which says nothing but looks like it does.
              updated: toDate(j.updatedAt),
              body: String(j.descriptionPlain ?? j.description ?? ""),
            }));

    // Five gates, cheapest first. Posting age, title relevance, level, location,
    // then the years figure from the posting body — which is the only one of the
    // gates that reflects what the team will actually screen on.
    return raw
      .filter((j) => j.title && j.url)
      // Freshness gate at ingest. A posting older than this has already been
      // screened down, so it is a poor use of an application slot. Undated
      // postings are kept: no date is not evidence of age.
      .filter((j) => isFreshPosting(j.posted))
      .filter((j) => isDesignRole(j.title, allowResearch))
      .filter((j) => isReachableLevel(j.title))
      .filter((j) => isUsLocation(j.location))
      .map((j) => ({ ...j, yoe: extractMinYoe(j.body) }))
      .filter((j) => j.yoe === null || j.yoe <= MAX_YOE)
      .map((j) => ({
        company,
        roleTitle: j.title,
        jobUrl: j.url,
        location: j.location,
        datePosted: j.posted,
        dateUpdated: j.updated,
        expRange: j.yoe !== null ? `${j.yoe}+ yrs` : "",
        descriptionSnippet: j.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000),
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Unified source: TargetCompany + HuntSite are both scraped via the same Claude
// extraction pipeline. The only differences are the company-name attribution
// (HuntSite listings have no associated company — extract from the listing),
// the base URL for resolving relative links, and the company display in the
// per-source result row.
type ScanSource = {
  kind: "company" | "site";
  displayName: string;       // for result rows + journal
  baseUrl: string;
  attributedCompany: string | null; // null for HuntSites — extractor must infer
  domain: string;
  tier: number;              // 1 = top target; relaxes the research-title gate
};

// How deep the scan goes by default: every tracked company. The daily run and
// the button used to differ here, so one word meant two scans. Pass `maxTier` to
// narrow: 2 is S and A only, 3 adds B.
const DEFAULT_MAX_TIER = 99;

export async function POST(req?: NextRequest) {
  // Body is optional so the launchd job and the dashboard button can both POST
  // bare. An unparseable body means "use the default", not a 400.
  let maxTier = DEFAULT_MAX_TIER;
  try {
    const body = await req?.json();
    if (body?.maxTier === "all") maxTier = 99;
    else if (typeof body?.maxTier === "number") maxTier = body.maxTier;
  } catch {
    // no body
  }

  const [companies, sites] = await Promise.all([
    prisma.targetCompany.findMany({
      where: { tier: { lte: maxTier } },
      orderBy: [{ tier: "asc" }, { position: "asc" }],
    }),
    prisma.huntSite.findMany({ orderBy: { position: "asc" } }),
  ]);

  const sources: ScanSource[] = [
    ...companies
      .filter((c) => c.careersUrl)
      .map((c): ScanSource => ({
        kind: "company",
        displayName: c.name,
        baseUrl: c.careersUrl,
        attributedCompany: c.name,
        domain: c.domain,
        tier: c.tier,
      })),
    ...sites
      .filter((s) => s.url)
      .map((s): ScanSource => ({
        kind: "site",
        displayName: s.name,
        baseUrl: s.url,
        attributedCompany: null,
        domain: s.domain,
        tier: 2,
      })),
  ];

  if (sources.length === 0) {
    return NextResponse.json({ ok: true, summary: "No companies or sites configured.", added: 0, results: [] });
  }

  // Brain-aware: criteria + understanding go into the extraction prompt so the
  // model filters at scrape time, not just at later enrich time.
  const [criteria, understanding] = await Promise.all([
    prisma.material.findMany({ where: { kind: { in: SEARCH_CONTEXT_KINDS } } }),
    understandingBlock(1200),
  ]);
  const criteriaBlock = criteria.map((m) => `[${m.kind}]\n${(m.content ?? "").slice(0, 800)}`).join("\n\n");
  const understandingPrompt = understanding
    ? `\n\nTheir accumulated taste signals (durable preferences from past decisions — apply these too):\n${understanding}`
    : "";

  const results: { source: string; kind: string; status: string; added: number }[] = [];
  let totalAdded = 0;

  for (const src of sources) {
    // ATS fast path: structured JSON, no Claude call, no HTML parsing.
    const board = src.attributedCompany ? ATS_BOARDS[src.displayName.toLowerCase()] : undefined;
    if (board) {
      const listings = await fetchAtsListings(src.attributedCompany!, board, src.tier <= 1);
      if (listings) {
        let added = 0;
        for (const listing of listings) {
          if (!passesStatedRules(listing.roleTitle, listing.company!)) continue;
          if (await alreadyHave(canonicalCompany(listing.company!), listing.roleTitle, normalizeJobUrl(listing.jobUrl))) continue;
          const url = listing.jobUrl;
          await prisma.job.create({
            data: {
              company: canonicalCompany(listing.company!),
              roleTitle: listing.roleTitle,
              jobUrl: url,
              location: listing.location ?? "",
              datePosted: listing.datePosted ?? null,
              dateUpdated: listing.dateUpdated ?? null,
              compRange: "Not disclosed",
              expRange: listing.expRange ?? "",
              description: listing.descriptionSnippet ?? "",
              fitScore: 0,
              fitRationale: [
                `Surfaced from ${src.displayName} via ${board.provider} API`,
                listing.expRange ? ` (${listing.expRange})` : "",
                ".",
              ].join(""),
              priority: "MONITOR",
            },
          });
          added += 1;
          totalAdded += 1;
        }
        results.push({
          source: src.displayName,
          kind: src.kind,
          status: `${board.provider} API: ${listings.length} design role${listings.length === 1 ? "" : "s"} live, ${added} new`,
          added,
        });
        continue;
      }
      // API failed — fall through to the Claude path rather than skipping the company.
    }

    if (MANUAL_ONLY.has(src.displayName.toLowerCase())) {
      results.push({
        source: src.displayName,
        kind: src.kind,
        status: "CHECK MANUALLY — no readable feed; use a LinkedIn alert",
        added: 0,
      });
      continue;
    }

    const html = await fetchWithTimeout(src.baseUrl);
    if (!html) {
      results.push({ source: src.displayName, kind: src.kind, status: "CHECK MANUALLY — page blocked the fetch", added: 0 });
      continue;
    }

    // Multi-employer sites keep their link addresses, so each role arrives with
    // its own URL; their pages are longer for it, hence the larger slice.
    const text =
      src.kind === "site" ? stripHtmlKeepLinks(html).slice(0, 40_000) : stripHtml(html).slice(0, 25_000);
    if (text.length < 200) {
      results.push({ source: src.displayName, kind: src.kind, status: "CHECK MANUALLY — JS-rendered, nothing readable", added: 0 });
      continue;
    }

    // The extraction prompt branches on source kind only in one place — what to
    // tell the model about company attribution. HuntSites aggregate listings
    // from many employers, so we ask the model to extract the employer name too.
    const companyGuidance = src.attributedCompany
      ? `All listings on this page are from ${src.attributedCompany}.`
      : `This page (${src.displayName}) aggregates listings from MANY companies. For each listing, extract the actual employer company name into the "company" field. If you can't determine the employer for a given listing, skip that listing.`;

    const who = await identityLine();
    const prompt = `You are extracting product-design-adjacent job listings from ${src.displayName} for ${who}.

${companyGuidance}

their criteria — only return listings that plausibly fit. Skip the ones that clearly do not (engineering-only, sales, ops, finance, or anything the criteria rule out):

${criteriaBlock}${understandingPrompt}

Page text (HTML-stripped, may be truncated):

${text}

TASK:
Extract product design / UX / interaction design / design research listings that fit their profile. For each, return the role title, the employer company, the job URL (absolute if possible — base URL: ${src.baseUrl}), location, and a 1-2 sentence description if visible. Skip listings that are clearly out of scope.

Links appear in the page text as "link text [address]". Use the address next to each role's title as its jobUrl. If the page shows how long ago a role was posted ("11 days ago", "7 months ago", "1 day ago"), return that as postedDaysAgo, a whole number of days; otherwise null.

Return ONLY a valid JSON array. No preamble. If you can't find any plausible listings, return [].

Format:
[
  {
    "company": "Name of the employer",
    "roleTitle": "Product Designer, AI",
    "jobUrl": "https://${src.domain}/careers/...",
    "location": "San Francisco / Remote",
    "expRange": "3-5 yrs",
    "descriptionSnippet": "What the role is in 1-2 sentences",
    "postedDaysAgo": 11
  }
]`;

    const { text: raw, timedOut } = await callClaudeDetailed(prompt, 90_000);
    if (timedOut) {
      // Distinct from "found nothing": a killed run returns empty stdout, and
      // reporting that as "no listings" hides a broken source indefinitely.
      results.push({ source: src.displayName, kind: src.kind, status: "extraction timed out", added: 0 });
      continue;
    }
    const extracted = extractJson<ExtractedListing[]>(raw, "array") ?? [];
    if (extracted.length === 0) {
      results.push({ source: src.displayName, kind: src.kind, status: "no relevant listings found", added: 0 });
      continue;
    }

    let added = 0;
    // A page with no per-role links still has headings on it, and the extractor
    // will dutifully return them. Riot's client-rendered jobs index produced a
    // plausible role this way, and Valve's produced "Visual & User Experience
    // Design", which is a discipline heading rather than a req. Both landed with
    // the index URL and no date, so they were unopenable and the freshness gate
    // could never retire them. If the extractor couldn't find a link distinct
    // from the page it read, it didn't find a posting.
    const pageUrl = normalizeJobUrl(src.baseUrl);
    let indexEchoes = 0;
    for (const listing of extracted) {
      if (!listing.roleTitle || !listing.jobUrl) continue;
      const absUrl = absolutize(listing.jobUrl, src.baseUrl);
      if (normalizeJobUrl(absUrl) === pageUrl) { indexEchoes += 1; continue; }
      const employer = src.attributedCompany ?? listing.company ?? src.displayName;
      // The ATS path applies five gates; this one applied none, which is how a
      // out-of-region and out-of-band reqs reached the queue. Same gates, same order.
      if (!isDesignRole(listing.roleTitle, src.tier <= 1)) continue;
      if (!isReachableLevel(listing.roleTitle)) continue;
      if (!passesStatedRules(listing.roleTitle, employer)) continue;
      if (!isUsLocation(listing.location ?? "")) continue;
      // Sites show age as "11 days ago", which the extractor returns as a number.
      const posted =
        typeof listing.postedDaysAgo === "number" && listing.postedDaysAgo >= 0
          ? new Date(Date.now() - listing.postedDaysAgo * 86_400_000)
          : undefined;
      if (!isFreshPosting(posted)) continue;
      if (await alreadyHave(canonicalCompany(employer), listing.roleTitle, normalizeJobUrl(absUrl))) continue;
      await prisma.job.create({
        data: {
          company: canonicalCompany(employer),
          roleTitle: listing.roleTitle,
          jobUrl: absUrl,
          location: listing.location ?? "",
          compRange: listing.compRange ?? "Not disclosed",
          expRange: listing.expRange ?? "",
          description: listing.descriptionSnippet ?? "",
          ...(posted ? { datePosted: posted } : {}),
          fitScore: 0,
          fitRationale: `Surfaced from ${src.displayName} during broad ingest.`,
          priority: "MONITOR",
        },
      });
      added += 1;
      totalAdded += 1;
    }
    results.push({
      source: src.displayName,
      kind: src.kind,
      status:
        added > 0
          ? `${added} new`
          : indexEchoes > 0
            // Say which it was. "No new" on a page that has roles on it reads as
            // a quiet success and hides a source worth opening by hand.
            ? `CHECK MANUALLY — ${indexEchoes} role${indexEchoes === 1 ? "" : "s"} visible but no per-posting links`
            : "no new (all already seen)",
      added,
    });
  }

  await logJournal({
    type: "ai_run",
    surface: "ingest/career-pages",
    summary: `Broad scan: ${sources.length} sources (${companies.length} companies + ${sites.length} sites), ${totalAdded} new roles.`,
    meta: { totalAdded, sourcesScanned: sources.length },
  });

  return NextResponse.json({
    ok: true,
    summary: `Scanned ${sources.length} sources (${companies.length} ${maxTier >= 99 ? "companies, all tiers" : `companies up to tier ${maxTier}`} + ${sites.length} job sites), ${totalAdded} new role${totalAdded === 1 ? "" : "s"} added.`,
    added: totalAdded,
    results,
  });
}
