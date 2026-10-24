import { prisma } from "@/lib/prisma";
import { callClaudeDetailed, extractJson } from "@/lib/claude";
import { buildNote, firstName, openerFor, type NoteKind } from "@/lib/connect-template";
import { parseList } from "@/lib/people-merge";

/**
 * Batch drafting of connection notes: pick people on the Network page, and each
 * gets a note in their Drafted stage, ready to copy. The model writes only the
 * personal parts (who, focus, aside), eight people a call; lib/connect-template assembles the note in
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

type Ending = {
  id?: string;
  kind?: NoteKind;
  who?: string;
  path?: string | null;
  focus?: string | null;
  aside?: string | null;
  custom?: string | null;
  flag?: string | null;
};

async function draftBatch(ids: string[]): Promise<number> {
  const people = await prisma.contact.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, company: true, title: true, role: true, profileText: true,
      relationship: true, howMet: true, stage: true, stageHistory: true, notes: true, warmth: true,
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
        group: parseList(p.relationship),
        howMet: p.howMet || null,
        warmth: p.warmth || null,
        yourNote: p.notes?.slice(0, 200) || null,
      }),
    )
    .join("\n");

  const prompt = `For each person below, read their profile first, then supply the personal parts of their LinkedIn connection note. The rest of the note is fixed:
"Hey {first name}! {opener for their group} in this interesting era of AI. As I transition back to industry, I'd love to connect and hear how {who} is actually using AI, especially in your work on {focus} ({aside})!" (senior MHCI alumni instead: "...I'd love to connect and learn from your path from MHCI to {path}, especially how you're seeing AI change the work!")

- "who": their role at their company, at their real level, as a phrase that fits "hear how ___ is actually using AI": "a designer at Figma", "a PM at Google Health", "a design leader at Stripe", "Figma's head of design". Never undersell a senior person as "a designer".
- "focus": what they work on, in two to five words, fitting "especially in your work on ___": "onboarding", "creator and viewer experiences", "design systems", "AI agents for support teams". Only when their title or summary makes it clear; otherwise null. A vague or wrong focus is worse than none, so do not guess.
- "aside": a short parenthetical, four to eight words, about something real and specific they did or lead (a launch, a talk, an article, a project) when the summary names one: "the Make launch looked great". Otherwise null. Never claim to have seen something that is not in what is below.

Also give:
- "kind": "senior_alum" for MHCI alumni who are senior (director, head of, VP, principal, a manager or lead of a team) or graduated ten or more years ago; "design_recruiter" for recruiters who hire for design; "recruiter" for other recruiters and talent people; "engineer" for software engineers and engineering roles; otherwise "standard".
- "path": for "senior_alum" only, where their path led, fitting "learn from your path from MHCI to ___": "leading design at Stripe", "running research at Google". Otherwise null.

Then check the fixed note actually makes sense for this person, reading it as they would. It does not when, for example: they are someone the user already knows (a CMU colleague or professor, someone their notes or warmth say is close), so "I'm a recent CMU MHCI grad" would be odd; they are a student; their work has nothing to do with product or AI, so "how AI is actually showing up in your work" is a strange question; or they are senior enough that the ask should be different. When it does not make sense:
- "custom": a full note of your own, under 300 characters, adapted to this person but in the user's own words: start "Hey {first name}!", then their opener for this person's group exactly as written above (for an MHCI alum, "I'm a recent MHCI grad, currently teaching interaction design at CMU in this interesting era of AI."), then "As I transition back to industry," and an ask that fits this person. Never "Fellow X here", never drop the teaching line, no em dashes. Otherwise null.
- "flag": one short line for the user on why it needs a look ("Already a CMU colleague; wrote a personal note"). Also flag, without a custom note, anything else worth checking before sending: no clear focus ("No clear focus; add one if you know it"), an unclear current role, a title that looks out of date. Otherwise null.

People, one JSON object per line:
${list}

Return ONLY a JSON array, no preamble:
[{ "id": "...", "kind": "standard", "who": "...", "path": null, "focus": null, "aside": null, "custom": null, "flag": null }]`;

  const { text } = await callClaudeDetailed(prompt, 180_000);
  const out = extractJson<Ending[]>(text, "array") ?? [];
  const byId = new Map(people.map((p) => [p.id, p] as const));
  const now = new Date().toISOString();
  let wrote = 0;
  for (const e of out) {
    const p = e.id ? byId.get(e.id) : undefined;
    if (!p || typeof e.who !== "string" || !e.who.trim()) continue;
    const group = openerFor(parseList(p.relationship), `${p.title ?? ""} ${p.role ?? ""} ${p.howMet ?? ""} ${p.profileText ?? ""}`);
    const known: NoteKind[] = ["senior_alum", "engineer", "recruiter", "design_recruiter"];
    let kind: NoteKind = e.kind && known.includes(e.kind) ? e.kind : "standard";
    // The mentor note is for MHCI alumni, with a path to name.
    if (kind === "senior_alum" && (!["mhci", "ucsd_mhci"].includes(group) || !e.path?.trim())) kind = "standard";
    const custom = typeof e.custom === "string" && e.custom.trim() && e.custom.trim().length <= 300 ? e.custom.trim() : null;
    const note =
      custom ??
      buildNote({ firstName: firstName(p.name), group, kind, who: e.who, path: e.path, focus: e.focus, aside: e.aside, company: p.company });
    // The version, for comparing acceptance and reply rates (lib/note-stats).
    const variant = custom ? "custom" : `template:${group}${kind === "standard" ? "" : `:${kind}`}`;
    const flag =
      [kind === "senior_alum" ? "Senior alum: mentor version used" : "", typeof e.flag === "string" ? e.flag.trim() : ""]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200) || null;
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
        connectionNoteVariant: variant,
        connectionNoteFlag: flag,
        ...(moveToDrafted
          ? { stage: "Drafted", stageHistory: JSON.stringify([...(Array.isArray(history) ? history : []), { stage: "Drafted", at: now }]) }
          : {}),
      },
    });
    wrote++;
  }
  return wrote;
}
