import { stripHtml } from "@/lib/html";

// The full text of a posting, fetched from its URL.
//
// Several intake paths store a role with no body: alert mail carries a title and a
// link, LinkedIn search skips the detail request once its budget is spent, and the
// Workday listing response has no description at all. The scorer reads the body
// for the headline and tags, so those roles reached the queue blank. The
// enrichment pass calls this to fill the gap first.
//
// The common boards render client-side, so their posting pages are empty shells.
// Each has a public endpoint that returns the body; the generic page fetch is the
// last resort.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const MAX_CHARS = 12_000;

async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...init.headers },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Greenhouse returns its content HTML-escaped, so the entities have to be decoded
// before the tags can be stripped.
function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function linkedin(url: URL): Promise<string | null> {
  const id = url.pathname.match(/(\d{8,})/)?.[1] ?? url.searchParams.get("currentJobId");
  if (!id) return null;
  const res = await get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  if (!res) return null;
  const html = await res.text();
  // The body sits in the "show more" block; the rest of the fragment is chrome.
  const body = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/)?.[1];
  return stripHtml(body ?? html);
}

async function greenhouse(url: URL): Promise<string | null> {
  // boards.greenhouse.io/<token>/jobs/<id>, job-boards.greenhouse.io/<token>/jobs/<id>,
  // or a company careers page carrying ?gh_jid=<id> (token unknown, so skipped).
  const m = url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const res = await get(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`);
  if (!res) return null;
  const data = await res.json();
  return data?.content ? stripHtml(unescapeHtml(String(data.content))) : null;
}

async function ashby(url: URL): Promise<string | null> {
  const [org, jobId] = url.pathname.split("/").filter(Boolean);
  if (!org || !jobId) return null;
  const res = await get(`https://api.ashbyhq.com/posting-api/job-board/${org}`);
  if (!res) return null;
  const data = await res.json();
  const job = (data?.jobs ?? []).find((j: { id?: string }) => j.id === jobId);
  if (!job) return null;
  return job.descriptionPlain ? String(job.descriptionPlain) : stripHtml(String(job.descriptionHtml ?? ""));
}

async function workday(url: URL): Promise<string | null> {
  // <tenant>.wdN.myworkdayjobs.com/[locale/]<board>/job/... maps to the cxs API at
  // /wday/cxs/<tenant>/<board>/job/...
  const tenant = url.hostname.split(".")[0];
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] && /^[a-z]{2}-[A-Z]{2}$/.test(parts[0])) parts.shift();
  const [board, ...rest] = parts;
  if (!tenant || !board || rest[0] !== "job") return null;
  const res = await get(`https://${url.hostname}/wday/cxs/${tenant}/${board}/${rest.join("/")}`, {
    headers: { Accept: "application/json" },
  });
  if (!res) return null;
  const data = await res.json();
  const body = data?.jobPostingInfo?.jobDescription;
  return body ? stripHtml(String(body)) : null;
}

// A whole page carries the site's own header and menus ahead of the posting. The
// role title appears once in the page title and again where the posting starts,
// so when it reappears near the top, everything before that is chrome.
function fromPostingStart(text: string, roleTitle?: string): string {
  if (!roleTitle) return text;
  const at = text.indexOf(roleTitle, roleTitle.length + 1);
  return at > 0 && at < 3000 ? text.slice(at) : text;
}

async function page(url: URL, roleTitle?: string): Promise<string | null> {
  const res = await get(url.toString());
  return res ? fromPostingStart(stripHtml(await res.text()), roleTitle) : null;
}

/**
 * The employer's own domain for a role listed on YC's board, whose posting pages
 * link the company site ahead of any other external link. Wellfound's pages carry
 * links from inside the posting body instead, so they are not read this way.
 */
export async function fetchCompanyDomain(jobUrl: string): Promise<string | null> {
  let host: string;
  try {
    host = new URL(jobUrl).hostname;
  } catch {
    return null;
  }
  if (!/(^|\.)ycombinator\.com$/.test(host)) return null;
  const res = await get(jobUrl);
  if (!res) return null;
  const html = await res.text();
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    let link: string;
    try {
      link = new URL(m[1]).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!/ycombinator|workatastartup|google|gstatic|linkedin|twitter|x\.com|facebook|instagram|youtube|github|crunchbase|bookface|startupschool/.test(link)) {
      return link;
    }
  }
  return null;
}

export async function fetchPostingText(jobUrl: string, roleTitle?: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(jobUrl);
  } catch {
    return null;
  }
  const host = url.hostname;
  const specific = /(^|\.)linkedin\.com$/.test(host)
    ? linkedin
    : /greenhouse\.io$/.test(host)
      ? greenhouse
      : host === "jobs.ashbyhq.com"
        ? ashby
        : /myworkdayjobs\.com$/.test(host)
          ? workday
          : null;

  const text = (specific && (await specific(url).catch(() => null))) || (await page(url, roleTitle).catch(() => null));
  return text?.trim() ? text.trim().slice(0, MAX_CHARS) : null;
}
