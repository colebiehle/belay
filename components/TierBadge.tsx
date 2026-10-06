import { TIER_LABEL } from "@/lib/company-tier";

/**
 * The company's target-list tier.
 *
 * Not on the queue card: the queue is ordered tier-first by default, so the badge
 * restated the thing the ordering already says, one row at a time. It stays on the
 * passed list, where the rows are not tier-ordered and the tier is the context for
 * why a role was in the queue at all.
 *
 * Graded by fill and outline, not hue: S is a chalk fill so it reads at a glance
 * down a long scan, A a chalk outline, then each step dimmer. The pink that S and A
 * used to wear only said "applications side", which the page already says.
 * Untracked is deliberately legible rather than hidden — those roles come from the
 * company-blind arms and are worth seeing, just never above a tracked one.
 */
const STYLES: Record<string, string> = {
  S: "bg-fg-1 text-canvas border-fg-1",
  A: "text-fg-1 border-fg-2",
  B: "text-fg-2 border-line-input",
  C: "text-fg-3 border-line-2",
  D: "text-fg-3 border-line-2",
};

const SHAPE =
  "inline-flex items-center justify-center w-5 h-5 shrink-0 " +
  "font-mono text-data font-medium rounded-control border leading-none";

export function TierBadge({ tier }: { tier: number | null | undefined }) {
  if (tier === null || tier === undefined) {
    return (
      <span
        className={`${SHAPE} border-dashed border-line-2 text-fg-3`}
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
