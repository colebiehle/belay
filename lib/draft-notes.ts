import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { buildNote, firstName, openerFor, type NoteKind } from "@/lib/connect-template";
import { parseList } from "@/lib/people-merge";

/**
 * Batch drafting of connection notes: pick people on the Network page, and each
 * gets a note in their Drafted stage, ready to copy. The model writes only the
 * personal ending, eight people a call; lib/connect-template assembles the note in
 * the owner's words. Runs in the background; `draftStatus` reports progress.
 */

const BATCH = 8;
const waiting: string[] = [];
let state = { running: false, done: 0, total: 0, failed: 0 };

export function draftStatus() {
  return { ...state, waiting: waiting.length };
}

export function enqueueDrafts(ids: string[]): number {
  const fresh = ids.filter((id) => !waiting.includes(id));
  waiting.push(...fresh);
  if (!state.running) {
    state = { running: true, done: 0, total: waiting.length, failed: 0 };
    void drain();
  } else {
    state.total += fresh.length;
  }
  return fresh.length;
}

async function drain() {
  try {
    while (waiting.length) {
      const ids = waiting.splice(0, BATCH);
      try {
        const wrote = await draftBatch(ids);
        state.failed += ids.length - wrote;
      } catch {
        state.failed += ids.length;
      }
      state.done += ids.length;
    }
  } finally {
    state.running = false;
  }
}

type Ending = { id?: string; kind?: NoteKind; ending?: string; short?: string };

async function draftBatch(ids: string[]): Promise<number> {
  const people = await prisma.contact.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, company: true, title: true, role: true, profileText: true,
      relationship: true, howMet: true, stage: true, stageHistory: true,
    },
  });
  if (!people.length) return 0;

  const list = people
    .map((p) =>
      JSON.stringify({
        id: p.id,
        name: p.name,
        title: p.title || p.role || null,
        company: p.company || null,
        summary: p.profileText?.slice(0, 500) ?? null,
      }),
    )
    .join("\n");

  const prompt = `For each person below, write the personal ending of a LinkedIn connection note. The rest of the note is fixed:
"Hey {first name}! I'm a recent CMU MHCI grad, currently teaching design at CMU in this AI era (exciting time). As I explore industry roles, I would love to connect and learn how AI is actually showing up in your work as {ending}!"

The ending names their current role and company as a natural phrase, and adds one true detail beyond the title when the summary gives one (their path, team or a project). Examples:
- "a designer on Figma's onboarding team"
- "someone who went from research into design on Figma's onboarding team"
- "a PM on Google Health's AI team"
Keep it under 90 characters. Never invent a detail; with only a title and company, use those. Lowercase start, no final punctuation.

Also give:
- "short": the ending with just role and company, under 50 characters, used if the full one does not fit.
- "kind": "recruiter" for recruiters and talent people, "engineer" for software engineers and engineering roles, otherwise "standard".

People, one JSON object per line:
${list}

Return ONLY a JSON array, no preamble:
[{ "id": "...", "kind": "standard", "ending": "...", "short": "..." }]`;

  const { text } = await callClaudeDetailed(prompt, 180_000);
  const out = extractJson<Ending[]>(text, "array") ?? [];
  const byId = new Map(people.map((p) => [p.id, p] as const));
  const now = new Date().toISOString();
  let wrote = 0;
  for (const e of out) {
    const p = e.id ? byId.get(e.id) : undefined;
    if (!p || typeof e.ending !== "string" || !e.ending.trim()) continue;
    const kind: NoteKind = e.kind === "engineer" || e.kind === "recruiter" ? e.kind : "standard";
    const note = buildNote({
      firstName: firstName(p.name),
      group: openerFor(parseList(p.relationship), `${p.title ?? ""} ${p.role ?? ""} ${p.howMet ?? ""} ${p.profileText ?? ""}`),
      kind,
      ending: e.ending,
      short: e.short,
      company: p.company,
    });
    // Drafted, unless they are already further along (a note for someone you have
    // already sent to replaces the text, not the stage).
    const stage = p.stage ?? "Identified";
    const moveToDrafted = stage === "Identified";
    let history: unknown[] = [];
    try {
      history = JSON.parse(p.stageHistory ?? "[]");
    } catch {}
    await prisma.contact.update({
      where: { id: p.id },
      data: {
        connectionNote: note,
        ...(moveToDrafted
          ? { stage: "Drafted", stageHistory: JSON.stringify([...(Array.isArray(history) ? history : []), { stage: "Drafted", at: now }]) }
          : {}),
      },
    });
    wrote++;
  }
  return wrote;
}
