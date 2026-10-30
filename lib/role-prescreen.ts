import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { contextBlock, SEARCH_KINDS } from "@/lib/foundation";
import { buildTierMap, isTrackedEmployer } from "@/lib/company-tier";
import { isFoundingRole } from "@/lib/role-filter";

/**
 * The gate for company-blind sources (LinkedIn search, portfolio boards): which of
 * their roles reach the queue.
 *
 * It used to be the target list alone, which turned away 60-70 design roles a day
 * from LinkedIn search because the company was not on it. The owner wants good
 * roles from anywhere ("if it hits my criteria — location, focus, salary, prestige —
 * I want to see it"), but a full enrichment per role is a model call each. So roles
 * at tracked companies, and founding roles, pass as before, and the rest
 * get one cheap Haiku read in a batch: title, company, location and pay against the
 * owner's own criteria, 1-10. PRESCREEN_MIN and up go in and are scored properly
 * like any other role; low scorers that slip through are cleared by
 * lib/expire-queue once enrichment has scored them.
 */

// 5, not 6: at 6 it turned away 47-69 roles a run, and the owner would rather
// filter a longer queue than wonder where the roles are. 5 is "plausible".
export const PRESCREEN_MIN = 5;
const BATCH = 40;

// backers: the notable firms behind the company, when the source knows them
// (a portfolio board knows its own firm). A backed startup is a vetted one.
export type ScreenRole = {
  company: string;
  title: string;
  location?: string | null;
  comp?: string | null;
  backers?: string[];
};

export async function admitRoles<T>(
  items: T[],
  view: (t: T) => ScreenRole,
): Promise<{ admitted: T[]; screened: number; turnedAway: number }> {
  const tiers = await buildTierMap();
  const direct: T[] = [];
  const unknown: T[] = [];
  for (const it of items) {
    const r = view(it);
    if (isTrackedEmployer(r.company, tiers) || isFoundingRole(r.title)) direct.push(it);
    else unknown.push(it);
  }
  if (!unknown.length) return { admitted: direct, screened: 0, turnedAway: 0 };

  const criteria = await contextBlock({ include: [...SEARCH_KINDS], maxCharsPerKind: 500 });
  const admitted = [...direct];
  for (let i = 0; i < unknown.length; i += BATCH) {
    const batch = unknown.slice(i, i + BATCH);
    const lines = batch
      .map((it, k) => {
        const r = view(it);
        return JSON.stringify({
          k,
          company: r.company,
          title: r.title,
          location: r.location ?? null,
          pay: r.comp ?? null,
          ...(r.backers?.length ? { backedBy: r.backers } : {}),
        });
      })
      .join("\n");
    const prompt = `Rate each design role below for how worth it is to someone with these job-search criteria, from the title, company, location and pay alone. 1 to 10: 8-10 a strong match (the kind of role and company they want; AI products, design tools, well-known or fast-growing tech companies; pay at or above their bar when stated), 5-7 plausible, 1-4 a poor match (agencies doing marketing work, unrelated industries, roles their criteria rule out). Be generous with well-known tech companies, AI product companies, and startups backed by a top firm ("backedBy", when given: those have been vetted by an investor whose name carries weight); strict with staffing agencies and unrelated industries.

Their criteria:
${criteria}

Roles, one JSON object per line ("k" is its index):
${lines}

Return ONLY a JSON array, no preamble: [{ "k": 0, "score": 7 }]`;
    const { text } = await callClaudeDetailed(prompt, 180_000, "haiku");
    const scored = extractJson<{ k?: number; score?: number }[]>(text, "array");
    if (!scored) {
      // A failed read lets the batch through rather than losing it; enrichment and
      // the low-fit clearance catch the weak ones.
      admitted.push(...batch);
      continue;
    }
    for (const s of scored) {
      if (typeof s.k === "number" && typeof s.score === "number" && s.score >= PRESCREEN_MIN && batch[s.k]) {
        admitted.push(batch[s.k]);
      }
    }
  }
  return { admitted, screened: unknown.length, turnedAway: items.length - admitted.length };
}
