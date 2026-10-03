import { MANUAL_ONLY } from "@/lib/ats-boards";
import { stripHtmlKeepLinks } from "@/lib/html";

export type SiteScan = { scanStatus: "daily" | "manual"; scanNote: string };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// Addresses that point at a single posting rather than at navigation.
const POSTING_LINK = /\[[^\]]*(\/jobs?\/[^\]\s]+|\/companies\/[^\]\s]+\/jobs\/|\/positions?\/|\/careers\/[^\]\s]+|\/postings?\/)[^\]]*\]/gi;

/**
 * Whether the daily scan will be able to read a job site, decided when the site is
 * added. Readability is a property of how the site is built, so it rarely changes:
 * a page that serves its listings as HTML with a link per posting can be scanned,
 * and one that blocks scripts or draws its listings with JavaScript cannot. The
 * daily scan still rewrites the status, as a backstop for the rare site that does
 * change.
 */
export async function probeSite(name: string, url: string): Promise<SiteScan> {
  // Searched by its own arm and read from alert mail, whatever its page does.
  if (name.trim().toLowerCase() === "linkedin" || /(^|\.)linkedin\.com/.test(url)) {
    return { scanStatus: "daily", scanNote: "Searched directly every day, plus your LinkedIn alert emails" };
  }
  if (MANUAL_ONLY.has(name.trim().toLowerCase())) {
    return { scanStatus: "manual", scanNote: "Blocks automated reads" };
  }

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return { scanStatus: "manual", scanNote: "Blocks automated reads" };

  const text = stripHtmlKeepLinks(await res.text());
  const postings = new Set((text.match(POSTING_LINK) ?? []).map((m) => m.toLowerCase()));
  return postings.size >= 3
    ? { scanStatus: "daily", scanNote: "Read every day" }
    : { scanStatus: "manual", scanNote: "Loads its listings with JavaScript, so the scan sees none" };
}
