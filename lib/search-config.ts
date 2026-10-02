/**
 * The numbers and word lists that decide what reaches your queue.
 *
 * These used to be constants in `role-filter.ts` with one person's career written
 * into them: a compensation floor derived from one specific offer, a years ceiling
 * tuned to one person's experience, a discipline exclusion quoting their own pass
 * notes. Anyone forking the repo inherited all of it, and anyone reading the repo
 * learned roughly what they earned.
 *
 * So the defaults here are deliberately open. Nothing is filtered out on money,
 * nothing on seniority, and the only titles excluded are ones that are not design
 * roles at any company. A fresh install shows you everything and lets you narrow it,
 * which is the right direction: a filter you chose is useful, a filter you inherited
 * is a mystery.
 *
 * Set them in `.env` to make them yours. They are read at module load, so a change
 * needs a server restart.
 */

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw.replace(/[_,$]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function list(key: string, fallback: string[]): string[] {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Minimum pay for a role to enter the queue, checked against the TOP of a stated
 * band. 0 means no floor, which is the default: most postings do not state a band at
 * all, so a floor silently drops the majority of them.
 */
export const COMP_FLOOR_USD = num("SEARCH_COMP_FLOOR_USD", 0);

/**
 * A posting asking for more years than this is a different job rather than a stretch.
 * The default is high enough to be effectively off.
 */
export const MAX_YOE = num("SEARCH_MAX_YOE", 99);

/**
 * How old a posting can be at scan time. Applied at ingest only: once a role is in
 * the queue it stays there and never ages out. 0 means no limit.
 */
export const MAX_POSTING_AGE_DAYS = num("SEARCH_MAX_POSTING_AGE_DAYS", 0);

/**
 * Whether a posting is recent enough to ingest. Undated postings pass: no date is
 * not evidence of age. Every arm goes through this so that 0 means no limit
 * everywhere; comparing against 0 directly dropped every dated posting.
 */
export function isFreshPosting(posted: Date | null | undefined): boolean {
  if (!MAX_POSTING_AGE_DAYS || !posted) return true;
  return (Date.now() - posted.getTime()) / 86_400_000 <= MAX_POSTING_AGE_DAYS;
}

/**
 * Seniority words that put a role out of reach. Empty by default, because which
 * rungs are yours is the most personal judgement in the whole filter: the same
 * "Senior" title is a stretch at one company and a step down at another.
 */
export const LEVEL_EXCLUDE = list("SEARCH_LEVEL_EXCLUDE", []);

/**
 * Titles to drop regardless of anything else. Empty by default. The place for
 * "I am not cleared for an engineer role" is here, in your own config.
 */
export const TITLE_EXCLUDE_EXTRA = list("SEARCH_TITLE_EXCLUDE", []);

/** Countries and regions to drop. Empty by default: not everyone is searching in one. */
export const LOCATION_EXCLUDE = list("SEARCH_LOCATION_EXCLUDE", []);

/**
 * Companies where senior-and-above titles are out of reach for you specifically.
 * Empty by default. This exists for the case where you know exactly which rung you
 * are on at one company's ladder and not at others.
 */
export const COMPANY_LEVEL_EXCLUDE = list("SEARCH_COMPANY_LEVEL_EXCLUDE", []);
