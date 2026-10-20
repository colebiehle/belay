import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { FIT_RUBRIC, withSchoolFloor } from "@/lib/people-import";
import { targetCompaniesLine } from "@/lib/target-list";

/**
 * Re-score every waiting queue card against the current FIT_RUBRIC, in batches, so
 * a change to what fit means reaches the cards already in the queue. Runs in the
 * background; `rescoreStatus` reports progress.
 */

const BATCH = 40;
let state: { running: boolean; done: number; total: number; failed: number } = { running: false, done: 0, total: 0, failed: 0 };

export function rescoreStatus() {
  return state;
}

export function startRescore(maxFit?: number): boolean {
  if (state.running) return false;
  void run(maxFit);
  return true;
}

async function run(maxFit?: number) {
  // maxFit: only cards at or below it, for a second pass over the low end.
  const cards = await prisma.personCandidate.findMany({
    where: { status: "pending", ...(maxFit ? { OR: [{ fit: null }, { fit: { lte: maxFit } }] } : {}) },
    select: { id: true, name: true, title: true, company: true, location: true, summary: true, source: true, mutuals: true, mutual: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  state = { running: true, done: 0, total: cards.length, failed: 0 };
  const targets = await targetCompaniesLine();
  try {
    for (let i = 0; i < cards.length; i += BATCH) {
      const batch = cards.slice(i, i + BATCH);
      const list = batch
        .map((c) =>
          JSON.stringify({
            id: c.id,
            name: c.name,
            headline: c.title,
            company: c.company,
            location: c.location,
            summary: c.summary?.slice(0, 240) ?? null,
            foundOn: c.source,
          }),
        )
        .join("\n");
      const prompt = `Score each person below for how worth they are to the user's professional network. The user is a recent CMU MHCI grad teaching design at CMU and looking for industry design roles; they are building their network for conversations and referrals.

${targets}

${FIT_RUBRIC}
"foundOn" says where they were found; a CMU or UCSD community page (an MHCI group, a CMU program's connections) counts as connected to CMU or UCSD.

People, one JSON object per line:
${list}

Return ONLY a JSON array, one entry per person, no preamble:
[{ "id": "...", "fit": 7, "fitReason": "..." }]`;
      const { text } = await callClaudeDetailed(prompt, 240_000, "haiku");
      const scored = extractJson<{ id?: string; fit?: number; fitReason?: string }[]>(text, "array") ?? [];
      const byId = new Map(batch.map((c) => [c.id, c] as const));
      let wrote = 0;
      for (const s of scored) {
        if (!s.id || !byId.has(s.id) || typeof s.fit !== "number") continue;
        const c = byId.get(s.id)!;
        const fit = withSchoolFloor(Math.max(1, Math.min(10, Math.round(s.fit))), c.title, c.company, c.summary) ?? 1;
        await prisma.personCandidate.update({
          where: { id: s.id },
          data: { fit, fitReason: typeof s.fitReason === "string" ? s.fitReason.slice(0, 120) : null },
        });
        wrote++;
      }
      state.done += batch.length;
      state.failed += batch.length - wrote;
    }
  } finally {
    state.running = false;
  }
}
