import { prisma } from "@/lib/prisma";
import { canonicalCompany } from "@/lib/role-filter";

/**
 * Attaching the target-list tier to an ingested role.
 *
 * The tier list is the curated judgement about which companies are worth
 * pursuing, and until now it did no work anywhere except the dashboard grid. The
 * queue sorted on fit score alone, which put an OpenAI role level with one from
 * a company that had been explicitly excluded from the list. Score measures how
 * well a posting matches the role you want; tier measures whether the employer
 * is worth the application. They are different questions and the queue needs
 * both.
 *
 * Matching is on the canonical name, because ingest writes whatever the source
 * called the employer — "Amazon Web Services (AWS)", "Google LLC" — and the
 * target list stores one clean name per company.
 */

/** Tier 1-5 maps to S/A/B/C/D. `null` means the employer is not on the list. */
export type CompanyTier = number | null;

export const TIER_LABEL: Record<number, string> = {
  1: "S",
  2: "A",
  3: "B",
  4: "C",
  5: "D",
};

/**
 * Sorts untracked employers *below* D rather than treating them as unknown and
 * floating them to the top. A role from a company that isn't on the list is
 * still worth seeing — the company-blind arms exist to surface exactly those —
 * but it should never outrank a tracked one.
 */
export const UNTRACKED_RANK = 99;

export function tierRank(tier: CompanyTier): number {
  return tier ?? UNTRACKED_RANK;
}

/**
 * One query, then an in-memory lookup. Called per request rather than cached
 * because the list changes by hand and a stale tier is worse than a fast one.
 */
export async function buildTierMap(): Promise<Map<string, number>> {
  const companies = await prisma.targetCompany.findMany({
    select: { name: true, tier: true },
  });
  const map = new Map<string, number>();
  for (const c of companies) {
    // Key on both the stored name and its canonical form. They are usually
    // identical, but keying on only one of them silently misses whichever way
    // the alias table happens to normalise.
    map.set(c.name.toLowerCase(), c.tier);
    map.set(canonicalCompany(c.name).toLowerCase(), c.tier);
  }
  return map;
}

export function tierFor(company: string, map: Map<string, number>): CompanyTier {
  const raw = (company || "").toLowerCase().trim();
  return map.get(raw) ?? map.get(canonicalCompany(company).toLowerCase()) ?? null;
}

/**
 * Whether a role from a company-blind source may enter the queue.
 *
 * The title search and the VC portfolio boards scan by title across every employer
 * they can see, which is what lets them reach the large companies whose own boards
 * cannot be fetched. The cost is that they also deliver staffing firms, agencies and
 * unknowns at volume: more than half of a typical pending queue arrived from
 * companies that were never on the target list and were never going to be applied to.
 *
 * So the rule is that the queue holds roles from companies on your list, or roles you
 * add by URL yourself. The company-blind arms keep their reach and lose their noise:
 * they serve the tracked companies that have no fetchable feed, which was always the
 * reason they earned their place.
 *
 * Manual additions via /api/jobs/from-url deliberately bypass this. If you paste a
 * link, that is the decision.
 */
export function isTrackedEmployer(company: string, map: Map<string, number>): boolean {
  return tierFor(company, map) !== null;
}
