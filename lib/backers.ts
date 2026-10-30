/**
 * Who backs a company you don't track.
 *
 * The tier list holds the companies you named. Everything else arrives from the
 * company-blind arms, and among those a startup a top firm has funded is worth
 * more of your attention than one nobody has vetted (the owner's call, Oct 2026:
 * "random startups are less interesting than the ones people are hyped about").
 * Backing is a fact about the company, not the role, so like the tier it moves
 * where a role sorts and never touches the fit score (lib/fit-rubric).
 */

// The firms whose backing counts. A portfolio board names its own firm; the
// scoring read may only answer from this list, so a seed fund nobody has heard
// of never reads as a signal.
export const NOTABLE_BACKERS = [
  "YC",
  "a16z",
  "Sequoia",
  "Accel",
  "Benchmark",
  "Founders Fund",
  "Greylock",
  "Index",
  "Kleiner Perkins",
  "Lightspeed",
  "General Catalyst",
  "Thrive",
  "Khosla",
  "GV",
  "Felicis",
  "Bessemer",
  "First Round",
  "Redpoint",
  "IVP",
  "Spark",
] as const;

// Where a backed company sorts among untracked ones: level with C, above D and
// above any company nobody has vetted (lib/company-tier UNTRACKED_RANK).
export const BACKED_RANK = 4;

export function parseBackers(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Merge new names into a stored list, keeping only notable firms, in list order. */
export function mergeBackers(stored: string | null | undefined, add: string[]): string {
  const have = new Set([...parseBackers(stored), ...add].map((b) => b.toLowerCase()));
  return NOTABLE_BACKERS.filter((b) => have.has(b.toLowerCase())).join(", ");
}
