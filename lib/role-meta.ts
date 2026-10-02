/**
 * The role's own facts, formatted once.
 *
 * Location, level and pay were written out three times on the applications page and a
 * fourth time in the role panel, straight off the raw columns — so the panel printed
 * an un-shortened location and the literal string "Not specified" where every card
 * deliberately printed nothing. Same role, two different sets of facts, depending on
 * whether you were looking at the list or the thing the list opens.
 */

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
 */
export function ageTone(days: number): string {
  return days >= 30 ? "text-alarm" : "text-zinc-600";
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
  const age = daysAgo(job.datePosted);
  if (age !== null)
    out.push({
      text: age === 0 ? "posted today" : `${age}d old`,
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
  if (job.compRange && job.compRange !== "Not disclosed") out.push({ text: job.compRange });
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
