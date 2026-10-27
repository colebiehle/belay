import { prisma } from "@/lib/prisma";
import { buildTierMap, tierFor } from "@/lib/company-tier";
import { isWatchedCompany } from "@/lib/watch-companies";
import { MAX_POSTING_AGE_DAYS_KNOWN, MAX_POSTING_AGE_DAYS_WATCHED } from "@/lib/search-config";

/**
 * Roles left in the queue more than a week after they were posted (or found, when
 * the posting has no date) are set aside, so the queue only holds roles you can
 * still apply to early, when applications get read. Roles at tier 1 and 2 companies
 * stay up to 45 days, and the watched AI startups up to 14 (lib/search-config).
 *
 * They become "Archived", the bulk-cleanup verdict, never "Pass": a pass teaches
 * the fit scoring what you don't want (lib/verdict-signal), and being too old says
 * nothing about that. Roles at tier 1 and 2 companies stay longer: late, a referral still
 * gets them read, and the queue card says so.
 *
 * Run whenever the queue is read; it is one query and a no-op most of the time.
 */
export const QUEUE_FRESH_DAYS = 7;
// Roles from companies off your list (and off the watch list) that scored at or
// below this once enriched are cleared too: they came in on a cheap pre-screen,
// and the full read is the one that counts.
export const UNLISTED_MIN_FIT = 5;
const KEEP_THROUGH_TIER = 2;

export async function expireStaleQueue(): Promise<number> {
  const cutoff = Date.now() - QUEUE_FRESH_DAYS * 86_400_000;
  const [pending, tiers] = await Promise.all([
    prisma.job.findMany({
      where: { verdict: null },
      select: { id: true, company: true, datePosted: true, dateFound: true, fitScore: true },
    }),
    buildTierMap(),
  ]);
  const stale = pending.filter((j) => {
    const at = (j.datePosted ?? j.dateFound)?.getTime();
    if (!at || at >= cutoff) return false;
    const tier = tierFor(j.company, tiers);
    // Tier 1 and 2 and the watched companies are scanned with longer age limits
    // (lib/search-config), so they stay until their own limit, not seven days.
    const limit =
      tier !== null && tier <= KEEP_THROUGH_TIER
        ? MAX_POSTING_AGE_DAYS_KNOWN
        : isWatchedCompany(j.company)
          ? MAX_POSTING_AGE_DAYS_WATCHED
          : null;
    if (limit === null) return true;
    return !!limit && at < Date.now() - limit * 86_400_000;
  });
  const weak = pending.filter((j) => {
    if (stale.includes(j)) return false;
    if (!j.fitScore || j.fitScore > UNLISTED_MIN_FIT) return false;
    return tierFor(j.company, tiers) === null && !isWatchedCompany(j.company);
  });
  if (weak.length) {
    await prisma.job.updateMany({
      where: { id: { in: weak.map((j) => j.id) }, verdict: null },
      data: { verdict: "Archived", verdictAt: new Date(), verdictNotes: "Expired: low fit at a company off your list" },
    });
  }
  if (!stale.length) return weak.length;
  const { count } = await prisma.job.updateMany({
    where: { id: { in: stale.map((j) => j.id) }, verdict: null },
    data: {
      verdict: "Archived",
      verdictAt: new Date(),
      verdictNotes: "Expired: no decision while the posting was fresh",
    },
  });
  return count + weak.length;
}
