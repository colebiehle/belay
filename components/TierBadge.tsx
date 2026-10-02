import { TIER_LABEL } from "@/lib/company-tier";

/**
 * The company's target-list tier.
 *
 * Not on the queue card: the queue is ordered tier-first by default, so the badge
 * restated the thing the ordering already says, one row at a time. It stays on the
 * passed list, where the rows are not tier-ordered and the tier is the context for
 * why a role was in the queue at all.
 *
 * S and A are filled so they read at a glance down a long scan. Untracked is
 * deliberately legible rather than hidden — those roles come from the
 * company-blind arms and are worth seeing, just never above a tracked one.
 */
const STYLES: Record<string, string> = {
  S: "bg-accent-pink text-black border-accent-pink",
  A: "bg-accent-pink/20 text-accent-pink-light border-accent-pink/50",
  B: "bg-transparent text-zinc-300 border-zinc-600",
  C: "bg-transparent text-zinc-500 border-zinc-700",
  D: "bg-transparent text-zinc-600 border-zinc-800",
};

const SHAPE =
  "inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 " +
  "text-xs font-bold rounded border leading-none";

export function TierBadge({ tier }: { tier: number | null | undefined }) {
  if (tier === null || tier === undefined) {
    return (
      <span
        className={`${SHAPE} border-dashed border-zinc-800 text-zinc-700 font-medium`}
        title="Not on your target list. Surfaced by the LinkedIn or VC-board scan, so it is worth a look, but it never outranks a tracked company."
      >
        ·
      </span>
    );
  }
  const label = TIER_LABEL[tier] ?? "?";
  return (
    <span
      className={`${SHAPE} ${STYLES[label] ?? STYLES.D}`}
      title={`${label} tier on your target list. The company, not the role.`}
    >
      {label}
    </span>
  );
}
