/**
 * The connection note, in the owner's words (settled Oct 2026 over a long
 * back-and-forth). Code assembles it; the model only writes the personal ending,
 * so the wording cannot drift and the length is counted exactly.
 *
 * Opener by the person's group, from their tags (and their headline for CMU):
 *   CMU and MHCI, and anyone else: "I'm a recent CMU MHCI grad, currently teaching design at CMU"
 *   UCSD (tag ucsd):               "I'm a UCSD Cog Sci alum ('22), now a recent CMU MHCI grad teaching design at CMU"
 *   High school (tag mburg):       "I'm a Mercersburg alum ('18), now a recent CMU MHCI grad teaching design at CMU"
 * Engineers get an ask about working with designers; recruiters get a different note.
 */

export const NOTE_LIMIT = 300;

export type NoteKind = "standard" | "engineer" | "recruiter" | "design_recruiter";

const CMU = /\b(cmu|carnegie mellon|mhci)\b/i;

export function openerFor(tags: string[], profile: string): "cmu" | "ucsd" | "mburg" {
  const t = new Set(tags.map((x) => x.toLowerCase()));
  if (t.has("mhci") || t.has("cmu") || CMU.test(profile)) return "cmu";
  if (t.has("ucsd")) return "ucsd";
  if (t.has("mburg") || t.has("mercersburg")) return "mburg";
  return "cmu";
}

const OPENERS = {
  cmu: (currently: boolean) => `I'm a recent CMU MHCI grad, ${currently ? "currently " : ""}teaching design at CMU`,
  ucsd: () => "I'm a UCSD Cog Sci alum ('22), now a recent CMU MHCI grad teaching design at CMU",
  mburg: () => "I'm a Mercersburg alum ('18), now a recent CMU MHCI grad teaching design at CMU",
};

/**
 * The note for one person. `ending` is the personal part ("a designer on Figma's
 * onboarding team"); `short` is a shorter fallback ending (role and company only)
 * used when the full one does not fit. Cuts, in order, until it fits: "currently",
 * "(exciting time)", then the short ending.
 */
export function buildNote(p: {
  firstName: string;
  group: "cmu" | "ucsd" | "mburg";
  kind: NoteKind;
  ending: string;
  short?: string;
  company?: string;
}): string {
  if (p.kind === "recruiter" || p.kind === "design_recruiter") {
    const opener = p.group === "cmu" ? OPENERS.cmu(true) : OPENERS[p.group]();
    // "for design" only when they actually recruit for design; a business recruiter
    // at Figma recruits at Figma.
    const what = p.kind === "design_recruiter" ? "recruit for design" : "recruit";
    return `Hey ${p.firstName}! ${opener}, and I'm exploring product design roles, especially in AI tools. I saw you ${what}${p.company ? ` at ${p.company}` : ""} and would love to connect and be on your radar if anything fits. Happy to share my portfolio!`;
  }
  const ask =
    p.kind === "engineer"
      ? "I would love to connect and learn how AI is changing the way you work with designers as"
      : "I would love to connect and learn how AI is actually showing up in your work as";
  const tries: [boolean, boolean, string][] = [
    [true, true, p.ending],
    [false, true, p.ending],
    [false, false, p.ending],
    [false, false, p.short || p.ending],
  ];
  let note = "";
  for (const [currently, aside, ending] of tries) {
    const opener = p.group === "cmu" ? OPENERS.cmu(currently) : OPENERS[p.group]();
    note = `Hey ${p.firstName}! ${opener} in this AI era${aside ? " (exciting time)" : ""}. As I explore industry roles, ${ask} ${ending.trim().replace(/[.!]+$/, "")}!`;
    if (note.length <= NOTE_LIMIT) return note;
  }
  return note;
}

export function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || name;
}
