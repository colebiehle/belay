import { prisma } from "@/lib/prisma";
import { buildTierMap, tierFor } from "@/lib/company-tier";

/**
 * Roles left in the queue more than a week after they were posted (or found, when
 * the posting has no date) are set aside, so the queue only holds roles you can
 * still apply to early, when applications get read.
 *
 * They become "Archived", the bulk-cleanup verdict, never "Pass": a pass teaches
 * the fit scoring what you don't want (lib/verdict-signal), and being too old says
 * nothing about that. Roles at tier 1 and 2 companies stay: late, a referral still
 * gets them read, and the queue card says so.
 *
 * Run whenever the queue is read; it is one query and a no-op most of the time.
 */
export const QUEUE_FRESH_DAYS = 7;
const KEEP_THROUGH_TIER = 2;

export async function expireStaleQueue(): Promise<number> {
  const cutoff = Date.now() - QUEUE_FRESH_DAYS * 86_400_000;
  const [pending, tiers] = await Promise.all([
    prisma.job.findMany({
      where: { verdict: null },
      select: { id: true, company: true, datePosted: true, dateFound: true },
    }),
    buildTierMap(),
  ]);
  const stale = pending.filter((j) => {
    const at = (j.datePosted ?? j.dateFound)?.getTime();
    if (!at || at >= cutoff) return false;
    const tier = tierFor(j.company, tiers);
    return !(tier !== null && tier <= KEEP_THROUGH_TIER);
  });
  if (!stale.length) return 0;
  const { count } = await prisma.job.updateMany({
    where: { id: { in: stale.map((j) => j.id) }, verdict: null },
    data: {
      verdict: "Archived",
      verdictAt: new Date(),
      verdictNotes: `Expired: no decision within ${QUEUE_FRESH_DAYS} days of posting`,
    },
  });
  return count;
}
