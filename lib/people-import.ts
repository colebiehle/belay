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

/**
 * The source label a card added from one profile link carries. The queue sorts these
 * first: you picked the person yourself, which outranks any fit score.
 */
export const PROFILE_LINK_SOURCE = "Profile link";

/**
 * The one profile a paste names, when the paste is nothing but that profile's link,
 * normalised; null for a page of people or anything else. A link copied from the
 * address bar can arrive as its HTML flavour, which compactPaste turns into the
 * visible URL followed by "[canonical URL]", so every token is checked and all of
 * them must be the same person. A bare "linkedin.com/in/…" without a scheme counts.
 */
export function loneProfileUrl(text: string): string | null {
  const tokens = text
    .replace(/[[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length || tokens.length > 4) return null;
  const urls = tokens.map((t) => (/^(?:https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\/in\//i.test(t) ? normalizeLinkedInUrl(t) : null));
  if (urls.some((u) => !u)) return null;
  return new Set(urls).size === 1 ? urls[0] : null;
}

/**
 * A usable name from a profile slug, for when LinkedIn will not say: "jane-doe-4a1b2c3d"
 * is "Jane Doe". The trailing id LinkedIn appends to common names is dropped. Null
 * for an opaque member id (/in/ACoAAB…), which spells no name at all.
 */
export function nameFromProfileUrl(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {}
  if (/^ACoA/.test(slug)) return null;
  const name = slug
    .replace(/-[a-z0-9]*\d[a-z0-9]*$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return name || null;
}
