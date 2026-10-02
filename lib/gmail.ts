// Gmail reader for LinkedIn job-alert emails.
//
// This replaces the old Python `agent.py --gmail` arm, which shelled out to a file
// that was never committed — so every ingest run reported a Gmail failure. The
// parser below is a port of archive/python-app/gmail_reader.py, whose regexes were
// tuned against real LinkedIn alert mail.
//
// Auth: gmail_token.json at the repo root holds a refresh token. Access tokens are
// short-lived and fetched per run rather than persisted. When the refresh token is
// dead (Google revokes them after 7 days while an OAuth app sits in "Testing"),
// this throws GmailAuthError and the caller tells you to re-run scripts/gmail_reauth.py.

import fs from "fs/promises";
import path from "path";
import { stripHtml } from "@/lib/html";

export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailAuthError";
  }
}

export type AlertJob = {
  roleTitle: string;
  company: string;
  location: string;
  linkedinId: string;
  url: string;
  needsReview: boolean;
};

type TokenFile = {
  refresh_token: string;
  client_id: string;
  client_secret: string;
};

const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH ?? path.resolve(process.cwd(), "gmail_token.json");
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function accessToken(): Promise<string> {
  let file: TokenFile;
  try {
    file = JSON.parse(await fs.readFile(TOKEN_PATH, "utf-8"));
  } catch {
    throw new GmailAuthError(
      "No gmail_token.json — run: python3 scripts/gmail_reauth.py",
    );
  }
  if (!file.refresh_token || !file.client_id || !file.client_secret) {
    throw new GmailAuthError("gmail_token.json is incomplete — run: python3 scripts/gmail_reauth.py");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: file.client_id,
      client_secret: file.client_secret,
      refresh_token: file.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    // invalid_grant is the expected death: the refresh token expired or was revoked.
    throw new GmailAuthError(
      /invalid_grant/.test(body)
        ? "Gmail authorization expired — run: python3 scripts/gmail_reauth.py"
        : `Gmail token refresh failed (${res.status})`,
    );
  }
  return (await res.json()).access_token as string;
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodePart(part: GmailPart): string {
  const data = part.body?.data;
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}


// Alert mail nests parts (multipart/alternative inside multipart/mixed), so the
// search has to recurse rather than look one level down as the Python did.
function bodyText(payload: GmailPart): string {
  const flat: GmailPart[] = [];
  const walk = (p: GmailPart) => {
    flat.push(p);
    (p.parts ?? []).forEach(walk);
  };
  walk(payload);

  for (const p of flat) {
    if (p.mimeType === "text/plain") {
      const t = decodePart(p);
      if (t.trim()) return t;
    }
  }
  for (const p of flat) {
    if (p.mimeType === "text/html") {
      const t = stripHtml(decodePart(p));
      if (t.trim()) return t;
    }
  }
  return decodePart(payload);
}

const NOISE_LINE =
  /^\d+\s+connection|actively hiring|apply now|promoted|^\s*-{3,}|be an early applicant|easy apply|^new$|reposted|fast.?growing|top applicant|just posted|results from/i;

const LOCATION_RE =
  /\b(United States|Canada|United Kingdom|Remote|Hybrid|On-site|New York|San Francisco|Seattle|Boston|Los Angeles|Chicago|California|Washington|Massachusetts|Texas)\b/i;

// Sanity check that a parsed "title" reads like a role rather than a company or city.
const TITLE_WORDS =
  /\b(designer|design|researcher|research|manager|engineer|director|lead|principal|staff|senior|associate|product|ux|ui|experience|interaction|creative|strategist|architect|consultant|specialist)\b/i;

const URL_RE = /https?:\/\/[^\s]*linkedin\.com\/[^\s]*\/(\d{7,12})[^\s]*/i;

/**
 * Parse job blocks out of a LinkedIn alert body. Each block looks like:
 *   Role Title / Company / City, State / [noise] / View job: <url> / ---
 * Company-level cards ("Meta is hiring") have no role title and are flagged
 * needsReview rather than dropped, so nothing silently disappears.
 */
export function parseAlertBody(body: string): AlertJob[] {
  const jobs: AlertJob[] = [];
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  lines.forEach((line, i) => {
    if (!line.toLowerCase().startsWith("view job")) return;
    const m = URL_RE.exec(line);
    if (!m) return;

    const linkedinId = m[1];

    let j = i - 1;
    while (j >= 0 && NOISE_LINE.test(lines[j])) j -= 1;

    const location = j >= 0 ? lines[j] : "";
    const company = j >= 1 ? lines[j - 1] : "";
    const title = j >= 2 ? lines[j - 2] : "";

    if (!company) return;
    if (title.startsWith("-") || title.includes("---")) return;

    const garbled =
      !title ||
      !TITLE_WORDS.test(title) ||
      (LOCATION_RE.test(title) && !TITLE_WORDS.test(title)) ||
      (LOCATION_RE.test(company) && !TITLE_WORDS.test(company));

    jobs.push({
      roleTitle: title || "Unknown role — check posting",
      company,
      location,
      linkedinId,
      url: `https://www.linkedin.com/jobs/view/${linkedinId}`,
      needsReview: garbled,
    });
  });

  return jobs;
}

/**
 * Read LinkedIn alert mail from the last `daysBack` days and return parsed jobs.
 * Primary query is the "Job Alerts" label so other job platforms can be filed
 * there too; falls back to any linkedin.com mail if the label isn't set up.
 */
export async function fetchLinkedInJobs(daysBack = 2): Promise<AlertJob[]> {
  const token = await accessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const list = async (q: string) => {
    const res = await fetch(
      `${GMAIL_API}/messages?q=${encodeURIComponent(q)}&maxResults=100`,
      { headers: auth },
    );
    if (!res.ok) throw new Error(`Gmail list failed (${res.status})`);
    return ((await res.json()).messages ?? []) as { id: string }[];
  };

  let refs = await list(`label:"Job Alerts" newer_than:${daysBack}d`);
  if (refs.length === 0) refs = await list(`from:linkedin.com newer_than:${daysBack}d`);
  if (refs.length === 0) return [];

  const jobs: AlertJob[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const res = await fetch(`${GMAIL_API}/messages/${ref.id}?format=full`, { headers: auth });
    if (!res.ok) continue;
    const msg = await res.json();
    const text = bodyText(msg.payload ?? {});
    if (!text) continue;

    for (const job of parseAlertBody(text)) {
      if (seen.has(job.linkedinId)) continue;
      seen.add(job.linkedinId);
      jobs.push(job);
    }
  }

  return jobs;
}
