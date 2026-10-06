import { NextResponse } from "next/server";

/**
 * Name and company from a LinkedIn profile URL, for the Network page's Add form.
 *
 * The form used to guess the name from the URL slug, which is wrong whenever the
 * slug is a handle ("jdoe-design") or carries a suffix the regex does not strip.
 * LinkedIn's public profile page, fetched logged out, still puts the real name in
 * its <title>: "Name - Company | LinkedIn", or "Name | LinkedIn" when no current
 * company is shown. The job title is masked for logged-out visitors, so it is not
 * attempted; the form leaves that field to the user.
 *
 * This is best-effort by design. LinkedIn often answers server requests with a 999
 * or an auth wall, so every failure returns { name: null, company: null } with a
 * 200: the form keeps its slug guess and never waits on, or errors over, this.
 * One request per lookup and no retries, so a paste never turns into a burst of
 * traffic at LinkedIn.
 */

type Lookup = { name: string | null; company: string | null };

const EMPTY: Lookup = { name: null, company: null };

// A current desktop Chrome. LinkedIn serves the auth wall to obvious bots at once;
// a normal browser UA is what gets the public profile page when it is available.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

const TIMEOUT_MS = 10_000;

/** The canonical profile URL, or null when this is not a linkedin.com/in/ link. */
function profileUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  // Any linkedin.com host (www., uk., mobile), and only that: this route fetches
  // whatever it is given, so the host check is what keeps it from fetching anything else.
  const host = u.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const m = u.pathname.match(/^\/in\/([^/]+)\/?/);
  if (!m) return null;
  return `https://www.linkedin.com/in/${m[1]}/`;
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}

/**
 * "Name - Company | LinkedIn" → { name, company }. Split on the FIRST " - ": a
 * spaced hyphen inside a person's name is all but unheard of, while a company name
 * can carry one ("Acme - Design Studio"). A hyphen without spaces (Mary-Jane) is
 * not a split point. Anything else (the auth wall's "Sign Up | LinkedIn", "LinkedIn"
 * alone) is treated as no answer.
 *
 * Not exported: a route file may only export route handlers and config.
 */
function parseTitle(html: string): Lookup {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return EMPTY;
  const title = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  const head = title.match(/^(.*?)\s*\|\s*LinkedIn$/i)?.[1]?.trim();
  if (!head) return EMPTY;
  if (/^(sign up|log ?in|sign in|join linkedin|linkedin)$/i.test(head)) return EMPTY;
  const cut = head.indexOf(" - ");
  const name = (cut > 0 ? head.slice(0, cut) : head).trim();
  const company = cut > 0 ? head.slice(cut + 3).trim() : "";
  if (!name) return EMPTY;
  return { name, company: company || null };
}

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(EMPTY);
  }
  const url = profileUrl(body.url);
  // Not a profile link: the same quiet empty answer as a failed fetch, so the form
  // has one shape to handle. Nothing is fetched.
  if (!url) return NextResponse.json(EMPTY);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // 999 is LinkedIn's "we think you are a bot". A redirect to /authwall or
    // /login lands on a 200 page whose title is the wall's, which parseTitle rejects.
    if (!res.ok) return NextResponse.json(EMPTY);
    if (/\/(authwall|login|signup|checkpoint)/.test(new URL(res.url).pathname)) return NextResponse.json(EMPTY);
    const html = await res.text();
    return NextResponse.json(parseTitle(html));
  } catch {
    return NextResponse.json(EMPTY);
  }
}
