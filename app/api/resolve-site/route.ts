import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/claude";
import { SITE_CATEGORIES } from "@/lib/site-categories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Turn a job-board URL into a tracked site.
 *
 * No model call: the page carries its own name in the title or og:site_name, and
 * the hostname is the domain. Reading the page is strictly better than asking a
 * model to recall what a site is called, and it fails honestly when the page will
 * not load rather than inventing a name.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw: string = (body.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ error: "That does not look like a URL." }, { status: 400 });
  }

  let title = "";
  let description = "";
  let status = 0;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    status = res.status;
    if (res.ok) {
      const html = await res.text();
      const m =
        html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i) ??
        html.match(/<title[^>]*>([^<]+)</i);
      const d =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ??
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i);
      if (d) description = d[1].slice(0, 300);
      if (m) {
        title =
          m[1]
            .replace(/&amp;/g, "&")
            .replace(/&#39;|&apos;/g, "'")
            // Titles are usually "Thing | Site" or "Thing - Site", and the
            // trailing segment is the site name more often than the leading one.
            .split(/\s[|–—-]\s/)
            .map((p) => p.trim())
            .filter(Boolean)
            .pop() ?? "";
        title = title.slice(0, 60);
      }
    }
  } catch {
    // Unreachable from here. A 403 or a timeout does not mean the link is bad —
    // plenty of boards refuse a script and open fine in a browser.
  }

  // Falls back to the domain's first label, which is right for wellfound.com,
  // hiring.cafe, workatastartup.com and most others.
  const fromHost = host.split(".")[0];
  const name = title || fromHost.charAt(0).toUpperCase() + fromHost.slice(1);

  // The category is a judgement about what the board is for, which is exactly the
  // kind of thing you should not have to answer when all you have is a link. One
  // short classification, with the page's own title and description as evidence, and
  // a null when the model will not commit — a wrong group is worse than Unsorted,
  // and a drag fixes it either way.
  let category: string | null = null;
  try {
    const answer = await callClaude(
      `Classify this job board into exactly one category.\n\n` +
        `URL: ${url}\nDomain: ${host}\nPage title: ${name}\n` +
        (description ? `Page description: ${description}\n` : "") +
        `\nCategories:\n` +
        SITE_CATEGORIES.map((c) => `- ${c.key}: ${c.hint}`).join("\n") +
        `\n\nReply with the single category name and nothing else. If none fits, reply NONE.`,
      25_000,
    );
    const pick = answer.trim().split(/\s/)[0].replace(/[^A-Za-z]/g, "");
    const hit = SITE_CATEGORIES.find((c) => c.key.toLowerCase() === pick.toLowerCase());
    category = hit?.key ?? null;
  } catch {
    // A classification that did not come back is not a reason to refuse the site.
  }

  return NextResponse.json({ name, url, domain: host, category, reachable: status === 200, status });
}
