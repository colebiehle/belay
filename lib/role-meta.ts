/**
 * The role's own facts, formatted once.
 *
 * Location, level and pay were written out three times on the applications page and a
 * fourth time in the role panel, straight off the raw columns — so the panel printed
 * an un-shortened location and the literal string "Not specified" where every card
 * deliberately printed nothing. Same role, two different sets of facts, depending on
 * whether you were looking at the list or the thing the list opens.
 */

import { calendarDays } from "@/lib/dates";

export function displayCompany(company: string): string {
  // Surface unparsed/placeholder company names cleanly
  if (!company || /^\(?unknown/i.test(company.trim())) return "[Unknown]";
  return company;
}

export function briefLocation(loc: string): string {
  return loc
    .replace(/\s*[·•]\s*(Hybrid|Remote|in-person|In-Person)/gi, "")
    .replace(/\s*\/\s*Remote/gi, "")
    .trim();
}

export function inferExpRange(
  roleTitle: string,
  expRange: string,
): { text: string; inferred: boolean } {
  if (expRange && expRange !== "Not specified") return { text: expRange, inferred: false };
  const t = roleTitle.toLowerCase();
  if (t.includes("principal") || t.includes("distinguished") || t.includes("fellow"))
    return { text: "10+ yrs", inferred: true };
  if (t.includes("staff")) return { text: "7+ yrs", inferred: true };
  // `\bsr\.?\b` matters more than it looks: a chunk of the queue is titled "Sr
  // Product Designer" rather than "Senior", and those rows showed no level at all —
  // which are exactly the rows where level decides the verdict.
  if (
    t.includes("senior") ||
    /\bsr\.?\b/.test(t) ||
    t.includes("lead") ||
    t.includes("manager") ||
    t.includes("director")
  )
    return { text: "5+ yrs", inferred: true };
  if (t.includes("junior") || t.includes("associate") || t.includes("entry") || t.includes("new grad"))
    return { text: "0-2 yrs", inferred: true };
  return { text: "", inferred: false };
}

/** Calendar days since the posting went up, or null without a readable date. */
function postedDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : calendarDays(d);
}

/** "Posted today", "Posted 6d ago". */
export function postedAge(days: number): string {
  return days === 0 ? "Posted today" : `Posted ${days}d ago`;
}

/** Days between `iso` and now, floored. null for a missing or unparseable date. */
export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

/**
 * Tint by how stale the posting is. The old 7-day threshold fired on roughly 90% of
 * the real queue, and twenty identical alarm badges per screen carry no information,
 * so the alarm only earns its colour at 30 days — where the req probably is dead.
 * Five of the fourteen roles passed with a written reason were a dead posting.
 * MetaLine adds the alert glyph to an alarm token, because alarm and rope are too
 * close in luminance to be told apart by hue alone.
 */
export function ageTone(days: number): string {
  return days >= 30 ? "text-alarm" : "text-fg-3";
}

export type MetaToken = {
  text: string;
  title?: string;
  tone?: string;
  // Marks a value the app guessed rather than read. Only that earns the dotted
  // underline — tying the mark to "has a tooltip" put one under the age on every
  // card, which turns a signal into texture.
  guessed?: boolean;
};

/**
 * Tokens rather than a joined string, so the level token can carry its own tooltip:
 * a guessed level used to render as a bare asterisk with no legend anywhere.
 */
export function metaTokens(job: {
  roleTitle: string;
  location?: string | null;
  compRange?: string | null;
  expRange?: string | null;
  datePosted?: string | null;
}): MetaToken[] {
  const out: MetaToken[] = [];
  // Age leads. It is a property of the posting, the same class of fact as location
  // and pay, and it was sitting in the bottom corner beside the fit score, which is
  // a judgement about you. Two tabular numbers eight pixels apart read as one
  // figure. Leading also gives it a fixed left edge, so "which of these are dead"
  // is a vertical scan rather than a hunt along nine ragged line ends, and it is the
  // one token a right-truncating line can never clip.
  // "Posted 6d ago": the posting's date in the shared date vocabulary (lib/dates),
  // counted in calendar days like every other age, and with its verb, so it cannot be
  // read as the age of anything else on the card. "6d old" was the one age in the app
  // said another way. Queue cards, passed rows and the role panel only: Active and
  // Network cards never show it (STYLE_GUIDE 5.6, 5.7).
  const age = postedDays(job.datePosted);
  if (age !== null)
    out.push({
      text: postedAge(age),
      title:
        age >= 30
          ? "Posted over a month ago. Plenty of these are already filled."
          : "How long the posting has been up.",
      tone: ageTone(age),
    });
  if (job.location) out.push({ text: briefLocation(job.location) });
  const exp = inferExpRange(job.roleTitle, job.expRange ?? "");
  if (exp.text)
    out.push({
      text: exp.text,
      title: exp.inferred
        ? "Guessed from the title. The posting does not state a range."
        : "Stated in the posting.",
      guessed: exp.inferred,
    });
  if (job.compRange && job.compRange !== "Not disclosed") out.push({ text: formatComp(job.compRange) });
  return out;
}

/**
 * Keep the tag row to what the work actually is.
 *
 * The enrichment prompt already says tags are skills and subject areas, and lists
 * "AI is the product", "scope unstated" and "8+ yrs required" as exactly what they
 * must not be. Rows enriched before that rule landed carry them anyway, and a tag
 * like "no description" or "team unstated" spends a slot saying nothing — on a card
 * that only has five.
 *
 * So this enforces the contract on the way out rather than waiting for every row to
 * be re-enriched. Dropping a tag is better than truncating one: a tag clipped to
 * "Requires 3 years specifically in growth…" carries less than no tag at all.
 */
const TAG_NOISE = [
  /^no\b/i,
  /unstated|not stated|not mentioned|undescribed|not the focus/i,
  /^\d+\+?\s*(yrs?|years)\b/i,
  /\b(senior|staff|principal|lead)\s+title\b/i,
  /title\s*\/\s*level/i,
];

export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => t.length <= 28 && t.split(/\s+/).length <= 4)
    .filter((t) => !TAG_NOISE.some((re) => re.test(t)))
    .slice(0, 5);
}

/**
 * Pay, written one way everywhere: "$169–303k". One currency sign, an en dash, a
 * lowercase k, no thousands separators. The sources write the same range six ways
 * ("$153,000 to $170,000", "$136K - $187K", "$160-200k base"), and in a column of
 * cards the variety reads as noise rather than as different numbers.
 *
 * Only an amount with a currency mark is touched, so "3-5 yrs" and "15% bonus" pass
 * through. Anything after the figure ("base (US)", "+ equity") is kept as written,
 * and a string with no recognisable amount comes back unchanged.
 */
const CUR = String.raw`(?:[A-Z]{1,2}\$|[$£€]|(?:USD|CAD|EUR|GBP|AUD)\s?)`;
const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)`;
const AMOUNT = `(${CUR})?${NUM}\\s?([kK])?`;
const RANGE_RE = new RegExp(`${AMOUNT}\\s*(?:-|–|—|to)\\s*${AMOUNT}(?![\\d%])`, "g");
const SINGLE_RE = new RegExp(`(${CUR})${NUM}\\s?([kK])?(?![\\d,.%–-])`, "g");

function thousands(raw: string, k: boolean): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (k) return n;
  return n >= 1000 ? n / 1000 : null;
}

// Whole thousands: "$159.3k" is precision nobody negotiates on, and a decimal makes
// one card's figure wider than its neighbours'.
function kText(n: number): string {
  return String(Math.round(n));
}

export function formatComp(raw: string): string {
  const ranged = raw.replace(RANGE_RE, (whole, c1?: string, n1?: string, k1?: string, c2?: string, n2?: string, k2?: string) => {
    const cur = (c1 || c2 || "").trim();
    if (!cur || !n1 || !n2) return whole;
    // "$160-200k": the k on the high end covers the low end too.
    const lo = thousands(n1, !!k1 || (!!k2 && Number(n1.replace(/,/g, "")) < 1000));
    const hi = thousands(n2, !!k2);
    if (lo === null || hi === null || hi >= 10_000) return whole;
    const sep = /[A-Z]$/.test(cur) ? " " : "";
    return `${cur}${sep}${kText(lo)}–${kText(hi)}k`;
  });
  return ranged.replace(SINGLE_RE, (whole, c?: string, n?: string, k?: string) => {
    if (!c || !n) return whole;
    const v = thousands(n, !!k);
    if (v === null || v >= 10_000) return whole;
    const cur = c.trim();
    const sep = /[A-Z]$/.test(cur) ? " " : "";
    return `${cur}${sep}${kText(v)}k`;
  });
}

/**
 * Who is referring you on an application. Application.referrerId holds a JSON array
 * (a bare id from before it was a list still reads). Each entry is either a Contact's
 * id, when the referrer is someone in your network, or a name you noted, when they are
 * not (yet): the same two ways a mutual is recorded on a person. A cuid is told from a
 * name by its shape; a name has a space or a capital, a cuid never does.
 */
export function parseReferrers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
  } catch {
    return [raw];
  }
}

export const isContactId = (entry: string) => /^[a-z0-9_]{20,}$/.test(entry);

/** The names to show: a contact's name, a noted name as written, and nothing for an
 * id whose contact has since been removed. */
export function referrerNames(raw: string | null | undefined, contacts: { id: string; name: string }[]): string[] {
  return parseReferrers(raw)
    .map((e) => (isContactId(e) ? (contacts.find((c) => c.id === e)?.name ?? null) : e))
    .filter((n): n is string => !!n);
}

/** The soonest interview still to come in an application's interviewList, or null. */
export function nextInterview(raw: string | null | undefined): { label?: string; at: string } | null {
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as { label?: string; at?: string }[];
    const now = Date.now();
    const upcoming = (Array.isArray(list) ? list : [])
      .filter((iv): iv is { label?: string; at: string } => !!iv?.at && new Date(iv.at).getTime() >= now)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return upcoming[0] ?? null;
  } catch {
    return null;
  }
}
