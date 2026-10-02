import { NextRequest, NextResponse } from "next/server";
import { callClaude, extractJson } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Turn a company name into a tracked company, from the name alone.
 *
 * The risk with asking a model for a careers URL is that it will produce a
 * plausible one that 404s, and a dead link on the dashboard is worse than a link
 * you typed yourself. So the model is only asked for things that can be checked —
 * the domain and the likely ATS slug — and every candidate board is probed before
 * it is offered. What comes back either resolved or is reported as unresolved; it
 * is never a guess presented as a fact.
 *
 * The tier suggestion is explicitly a suggestion. Tiering is your judgement and
 * has been revised repeatedly; the value here is saving the typing, not making the
 * call.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Resolved = {
  name: string;
  domain: string;
  careersUrl: string;
  tier: number;
  note: string;
  board: string | null;
  verified: boolean;
};

async function head(url: string, init?: RequestInit): Promise<number> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json,text/html" },
      signal: AbortSignal.timeout(12_000),
      ...init,
    });
    return res.status;
  } catch {
    return 0;
  }
}

/** Probes the three board APIs we can actually read. Returns the first that answers. */
async function findBoard(slugs: string[]): Promise<{ provider: string; token: string; url: string } | null> {
  for (const token of slugs) {
    if (!token) continue;
    if ((await head(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`)) === 200) {
      return { provider: "greenhouse", token, url: `https://job-boards.greenhouse.io/${token}` };
    }
    if ((await head(`https://api.ashbyhq.com/posting-api/job-board/${token}`)) === 200) {
      return { provider: "ashby", token, url: `https://jobs.ashbyhq.com/${token}` };
    }
    if ((await head(`https://api.lever.co/v0/postings/${token}?mode=json`)) === 200) {
      return { provider: "lever", token, url: `https://jobs.lever.co/${token}` };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input: string = (body.name ?? body.url ?? "").trim();
  if (!input) return NextResponse.json({ error: "a LinkedIn company URL or a name" }, { status: 400 });

  // A LinkedIn company URL is the input you actually have to hand — you are looking
  // at the company page when you decides to track it. LinkedIn blocks server-side
  // fetches, so the page is never loaded; the slug in the path is enough to
  // identify the company, and everything after that is verified the same way a
  // typed name would be.
  const linkedinSlug = (() => {
    const m = input.match(/linkedin\.com\/(?:company|school)\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]).replace(/-/g, " ") : null;
  })();
  const query = linkedinSlug ?? input;

  const prompt = `Identify this company for a designer's job-search tracker.

${linkedinSlug ? `This came from a LinkedIn company page whose URL slug is "${linkedinSlug}". The slug is usually the company name with hyphens, but it can be an old name, an abbreviation, or have a suffix — work out the real company.` : `The input is: "${query}"`}

Return ONLY valid JSON, no preamble, no code fences:

{
  "name": "the company's normal short name, as a person would say it",
  "domain": "primary domain, no protocol, no www",
  "slugs": ["likely applicant-tracking-system slugs, lowercase, no spaces — usually the name compressed; include 2-4 plausible variants"],
  "careersUrl": "the careers or jobs page URL if you are confident, otherwise empty string",
  "tier": <1-5: 1 if a designer would leave almost any job for it (Apple, Figma, OpenAI, Anthropic, Google, Netflix, Stripe, Linear are 1), 2 if another designer would be impressed, 3 a good job whose name does not do the work, 4 worth knowing about, 5 a fallback only>,
  "note": "one sentence on this company's standing among product designers. Plain, specific, no marketing language, no em-dashes."
}

If the name is ambiguous or you do not recognise it, say so in note and set tier 3.`;

  const raw = await callClaude(prompt, 60_000);
  const parsed = extractJson<{
    name?: string;
    domain?: string;
    slugs?: string[];
    careersUrl?: string;
    tier?: number;
    note?: string;
  }>(raw, "object");

  if (!parsed?.domain) {
    return NextResponse.json({ error: `Could not identify "${query}".` }, { status: 422 });
  }

  const domain = parsed.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const slugs = [
    ...(parsed.slugs ?? []),
    query.toLowerCase().replace(/[^a-z0-9]/g, ""),
    domain.split(".")[0],
  ].filter((s, i, a) => s && a.indexOf(s) === i);

  const board = await findBoard(slugs);

  // A verified board URL beats the model's careers page, because it is the thing
  // the ingest can actually read. Fall back to the suggested careers page only if
  // it answers, then to the domain, which at least always resolves.
  let careersUrl = board?.url ?? "";
  let verified = Boolean(board);
  if (!careersUrl && parsed.careersUrl) {
    const status = await head(parsed.careersUrl);
    // 403 is a bot block, not a dead link — those pages open fine in a browser.
    if (status === 200 || status === 403 || status === 202) {
      careersUrl = parsed.careersUrl;
      verified = true;
    }
  }
  if (!careersUrl) careersUrl = `https://${domain}/careers`;

  const resolved: Resolved = {
    name: parsed.name?.trim() || query,
    domain,
    careersUrl,
    tier: Math.min(5, Math.max(1, Number(parsed.tier) || 3)),
    note: (parsed.note ?? "").trim(),
    board: board ? `${board.provider}:${board.token}` : null,
    verified,
  };

  return NextResponse.json(resolved);
}
