import { stripHtmlKeepLinks } from "@/lib/html";

/**
 * Helpers for the Network page's people import, shared by the paste box (client)
 * and /api/people/import (server). Pure, so both sides can use them.
 */

/** The most of a paste the extractor reads. Past this the tail is dropped, and the box says so. */
export const IMPORT_MAX_CHARS = 60_000;

/**
 * A LinkedIn profile link in the one shape dedupe can compare:
 * https://www.linkedin.com/in/<slug>/, lowercased slug, no query or locale suffix.
 * LinkedIn links the same person as /in/jane-doe, /in/jane-doe/?miniProfileUrn=…,
 * http://uk.linkedin.com/in/Jane-Doe/en and relative /in/jane-doe/, and all four
 * have to be one person or a re-paste offers them twice. Null for anything that
 * is not a profile.
 *
 * Some pages link the opaque member id (/in/ACoAAB…) instead of the vanity slug.
 * Those are kept, case and all, because they are case-sensitive and still open the
 * profile; they just will not match the same person's vanity link.
 */
export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/(?:^|linkedin\.com)\/in\/([^/?#\s\]]+)/i);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {}
  slug = slug.trim();
  if (!slug) return null;
  if (!/^ACoA/.test(slug)) slug = slug.toLowerCase();
  return `https://www.linkedin.com/in/${slug}/`;
}

/**
 * The page as text the extractor can read cheaply: the clipboard's HTML through
 * stripHtmlKeepLinks, then every link that is not a profile dropped and every
 * profile link shortened to its canonical form.
 *
 * A LinkedIn page is mostly chrome by byte count: each card's profile href carries
 * a long tracking query, and every nav item, company and hashtag is a link too.
 * Without this a ten-person search page is ~40k characters and a scrolled
 * connections page blows straight through the limit; with it the same page is a few
 * thousand, and the only addresses left are the ones worth storing.
 */
export function compactPaste(input: { html?: string | null; text?: string | null }): string {
  const base = input.html ? stripHtmlKeepLinks(input.html) : (input.text ?? "");
  return base
    // Only bracketed addresses (stripHtmlKeepLinks' "[href]"), not "[Edited]".
    .replace(/\[((?:https?:)?\/[^\]\s]*)\]/g, (_whole, href: string) => {
      const url = normalizeLinkedInUrl(href);
      return url ? `[${url}]` : "";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** How many distinct profile links a compacted paste holds: the box's "found N links" hint. */
export function countProfileLinks(text: string): number {
  return new Set(text.match(/https:\/\/www\.linkedin\.com\/in\/[^/\s\]]+\//g) ?? []).size;
}

/** Name plus company, the fallback identity when there is no profile link to match on. */
export function personKey(name: string | null | undefined, company: string | null | undefined): string {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(name)}|${norm(company)}`;
}
