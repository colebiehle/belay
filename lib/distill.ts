import { prisma } from "@/lib/prisma";
import { callClaude, extractJson } from "@/lib/claude";
import { contextBlock, FOUNDATION_KINDS, UNDERSTANDING_KINDS } from "@/lib/foundation";
import { journalBlock, logJournal } from "@/lib/journal";
import { identityPossessive } from "@/lib/identity";

// Threshold for auto-distillation: how many meaningful events (decisions,
// reflections, status changes) must accumulate before the brain re-distills.
// AI-run journal entries don't count — they don't add user taste signal.
const AUTO_DISTILL_TRIGGER_EVENTS = 10;
const AUTO_DISTILL_MEANINGFUL_TYPES = ["decision", "reflection", "status_change"];

type Distilled = {
  understanding_taste: string;
  understanding_strengths: string;
  understanding_gaps: string;
  understanding_themes: string;
};

async function upsertUnderstanding(kind: string, title: string, content: string) {
  const existing = await prisma.material.findFirst({ where: { kind } });
  if (existing) {
    await prisma.material.update({ where: { id: existing.id }, data: { content } });
  } else {
    await prisma.material.create({ data: { kind, title, content } });
  }
}

// Run the full distillation pass — read foundation + prior understanding + journal,
// produce updated understanding_* Materials. Idempotent; safe to re-run.
export async function runDistillation(): Promise<{ ok: boolean; reason?: string; updated?: string[] }> {
  const [foundationCtx, priorUnderstanding, journal] = await Promise.all([
    contextBlock({ include: [...FOUNDATION_KINDS], maxCharsPerKind: 1500 }),
    contextBlock({ include: [...UNDERSTANDING_KINDS], maxCharsPerKind: 2500 }),
    journalBlock(80, 4000),
  ]);

  if (!journal && !priorUnderstanding) {
    return { ok: false, reason: "no journal entries or prior understanding yet" };
  }

  const whose = await identityPossessive();
  const prompt = `You are the distillation pass for ${whose} job-search brain. Your job is to compress a journal of recent events plus the existing understanding into four updated summaries that downstream prompts will read.

The point of these summaries is that they COMPOUND. Each pass should preserve durable insights from the prior understanding while folding in what's new. If a signal in the journal contradicts the prior understanding, prefer the newer signal but say so explicitly.

their foundation (who they are — relatively stable):
${foundationCtx || "(no foundation yet)"}

Existing understanding (what previous distillations concluded — preserve durable insights):
${priorUnderstanding || "(no prior understanding — this is the first distillation)"}

Recent journal (chronological — what's happened lately):
${journal || "(no journal entries)"}

TASK:
Produce FOUR updated summaries. Each should be 200-400 words. Direct, no clichés, no em-dashes. Cite specific evidence ("they accepted X then dismissed Y, suggesting Z") — vague generalities are useless.

1. understanding_taste — What they prefer, dislikes, and why. Cover topics (ai vs design vs product), content style (direct vs aspirational), framing (applied vs theoretical), specific people/orgs they leans toward or away from. Update if recent signals contradict prior taste.

2. understanding_strengths — Capabilities they have demonstrated. Backed by specific evidence: skills they's accepted into "learning" or "learned", library they's consumed, applications they's submitted, projects they's logged. Not aspirational — only what's evidenced.

3. understanding_gaps — Skill / knowledge / experience gaps they have named, implied by their target roles, or revealed by what they's chosen to start learning. Useful for prioritizing what to recommend next.

4. understanding_themes — Recurring themes from reflections + decisions + applications. What patterns is their job search showing? E.g. "consistently drawn to AI-first product orgs", "rejects roles emphasizing legacy enterprise design systems", "underestimates time to build LLM eval intuition".

Return ONLY a JSON object with these four keys, each a string. No preamble, no code fences.`;

  const raw = await callClaude(prompt, 240_000);
  const parsed = extractJson<Distilled>(raw, "object");
  if (!parsed) {
    return { ok: false, reason: "Claude returned no JSON" };
  }

  await Promise.all([
    upsertUnderstanding("understanding_taste", "Taste: what they like and why", parsed.understanding_taste ?? ""),
    upsertUnderstanding("understanding_strengths", "Strengths: evidenced capabilities", parsed.understanding_strengths ?? ""),
    upsertUnderstanding("understanding_gaps", "Gaps: skills / knowledge to close", parsed.understanding_gaps ?? ""),
    upsertUnderstanding("understanding_themes", "Themes: recurring patterns", parsed.understanding_themes ?? ""),
  ]);

  await logJournal({
    type: "ai_run",
    surface: "brain/distill",
    summary: "Re-distilled the four understanding summaries from journal + prior understanding.",
  });

  return { ok: true, updated: Object.keys(parsed) };
}

// Decide if enough meaningful events have piled up since the last distillation
// to warrant a fresh pass. If so, fire it in the background (no await).
// Called from logJournal() — must be cheap and non-blocking.
export async function maybeAutoDistill(): Promise<void> {
  try {
    const lastDistill = await prisma.material.findFirst({
      where: { kind: "system_journal", title: "ai_run: brain/distill" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const since = lastDistill?.createdAt ?? new Date(0);

    // Count meaningful events since the last distillation. Filtering by title
    // prefix avoids loading + parsing every journal entry.
    const meaningfulTitlePrefixes = AUTO_DISTILL_MEANINGFUL_TYPES.map((t) => `${t}:`);
    const candidates = await prisma.material.findMany({
      where: {
        kind: "system_journal",
        createdAt: { gt: since },
        OR: meaningfulTitlePrefixes.map((p) => ({ title: { startsWith: p } })),
      },
      select: { id: true },
    });
    if (candidates.length < AUTO_DISTILL_TRIGGER_EVENTS) return;

    // Threshold hit — fire distillation in the background. This is a local-only
    // app (Next.js dev server), so node keeps the process alive long enough for
    // the ~30s Claude call to complete after the response goes out.
    void runDistillation().catch(() => { /* swallow */ });
  } catch {
    /* auto-distill is best-effort; never let it break the calling flow */
  }
}
