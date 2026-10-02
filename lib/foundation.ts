import { prisma } from "@/lib/prisma";

// Foundation Material kinds — your profile context. Every prompt that needs
// to know "who you are" reads from these via foundationBlock().
export const FOUNDATION_KINDS = [
  "positioning",
  "personality",
  "career_arc",
  "voice",
  "anti_patterns",
] as const;

// Search-criteria Material kinds — what you are looking for.
export const SEARCH_KINDS = [
  "search_target_roles",
  "search_target_problems",
  "search_target_companies",
  "search_skills_to_learn",
  "search_work_environment",
  "search_positive_signals",
  "search_negative_signals",
  "search_hard_skips",
] as const;

// Research output kinds that meaningfully inform downstream prompts. Note:
// `research_best_practices_*` are intentionally excluded — they're generated
// for the studio UI but don't feed back into skill/library recs.
export const RESEARCH_FEEDBACK_KINDS = [
  "research_market_trends",
  "research_career_insights",
  "research_corpus_patterns",
] as const;

// Distilled understanding kinds the brain produces. These compress the journal
// into reusable judgments that all downstream prompts read.
export const UNDERSTANDING_KINDS = [
  "understanding_taste",        // what they like/dislikes and why, across topics
  "understanding_strengths",    // proven capabilities backed by accept/reject signals
  "understanding_gaps",         // skill/knowledge gaps they have named or implied
  "understanding_themes",       // recurring themes from reflections + decisions
] as const;

type Kind =
  | (typeof FOUNDATION_KINDS)[number]
  | (typeof SEARCH_KINDS)[number]
  | (typeof RESEARCH_FEEDBACK_KINDS)[number]
  | (typeof UNDERSTANDING_KINDS)[number];

type BlockOptions = {
  include?: Kind[];     // override which kinds to fetch
  maxCharsPerKind?: number;
  labelPrefix?: string;
};

// Returns a Claude-ready prompt fragment for the requested kinds. Replaces the
// ad-hoc `CONTEXT_KINDS` arrays scattered across route handlers.
//
// Default behavior fetches foundation + search + understanding. Pass `include`
// to narrow (e.g. resume tailoring wants foundation but not market research).
export async function contextBlock(opts: BlockOptions = {}): Promise<string> {
  const kinds: Kind[] = opts.include ?? [
    ...FOUNDATION_KINDS,
    ...SEARCH_KINDS,
    ...UNDERSTANDING_KINDS,
  ];
  const maxChars = opts.maxCharsPerKind ?? 1500;
  const rows = await prisma.material.findMany({
    where: { kind: { in: kinds as string[] } },
  });
  if (rows.length === 0) return "";
  return rows
    .map((m) => `[${opts.labelPrefix ?? ""}${m.kind}]\n${(m.content ?? "").slice(0, maxChars)}`)
    .join("\n\n");
}

// Like contextBlock() but only the distilled brain — much smaller and used by
// prompts that want fast taste signals without the full foundation.
export async function understandingBlock(maxCharsPerKind: number = 1200): Promise<string> {
  return contextBlock({ include: [...UNDERSTANDING_KINDS], maxCharsPerKind });
}
