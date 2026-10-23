/**
 * The connection note, in the owner's words (settled Oct 2026 over a long
 * back-and-forth, then revised after a premortem on Oct 23). Code assembles it;
 * the model only writes the personal ending, so the wording cannot drift and the
 * length is counted exactly.
 *
 * The throughline: I have been on the academic side of this AI shift; now I am
 * moving into industry; so I want to hear how it actually shows up in your work.
 * "Moving into industry" rather than "exploring roles" (a transition, not a job
 * hunt), and "hear" rather than "learn" (curiosity, not a lesson owed).
 *
 * Opener by the person's group, from their tags (and their headline for CMU):
 *   CMU and anyone else: "I'm a recent CMU MHCI grad, teaching design at CMU"
 *                        (MHCI alumni: "I'm a recent CMU MHCI grad too, ...")
 *   UCSD (tag ucsd):     "I'm a UCSD Cog Sci alum ('22), now a recent CMU MHCI grad teaching design at CMU"
 *   High school (mburg): "I'm a Mercersburg alum ('18), now a recent CMU MHCI grad teaching design at CMU"
 * Engineers get a question about working with designers; recruiters get a
 * different note.
 */

export const NOTE_LIMIT = 300;

export type NoteKind = "standard" | "engineer" | "recruiter" | "design_recruiter";
export type NoteGroup = "cmu" | "mhci" | "ucsd" | "mburg";

const CMU = /\b(cmu|carnegie mellon|mhci)\b/i;
const MHCI = /\bmhci\b|master of human-computer interaction/i;

export function openerFor(tags: string[], profile: string): NoteGroup {
  const t = new Set(tags.map((x) => x.toLowerCase()));
  // Fellow MHCI alumni get "too": the shared program is a bond, not a credential.
  if (t.has("mhci") || MHCI.test(profile)) return "mhci";
  if (t.has("cmu") || CMU.test(profile)) return "cmu";
  if (t.has("ucsd")) return "ucsd";
  if (t.has("mburg") || t.has("mercersburg")) return "mburg";
  return "cmu";
}

const OPENERS: Record<NoteGroup, string> = {
  cmu: "I'm a recent CMU MHCI grad, teaching design at CMU",
  mhci: "I'm a recent CMU MHCI grad too, teaching design at CMU",
  ucsd: "I'm a UCSD Cog Sci alum ('22), now a recent CMU MHCI grad teaching design at CMU",
  mburg: "I'm a Mercersburg alum ('18), now a recent CMU MHCI grad teaching design at CMU",
};

/**
 * The note for one person. `ending` is the personal part, a phrase that follows
 * "your work" ("on Figma's onboarding team", "as a PM on Google Health's AI team",
 * "since moving from research into design at Figma"); `short` is a shorter
 * fallback (role and company only) used when the full one does not fit. Cuts, in
 * order, until it fits: "(exciting time)", then the short ending.
 */
export function buildNote(p: {
  firstName: string;
  group: NoteGroup;
  kind: NoteKind;
  ending: string;
  short?: string;
  company?: string;
}): string {
  if (p.kind === "recruiter" || p.kind === "design_recruiter") {
    // Recruiters are the one audience where saying you are looking is the point.
    const opener = OPENERS[p.group === "mhci" ? "cmu" : p.group];
    // "for design" only when they actually recruit for design; a business recruiter
    // at Figma recruits at Figma.
    const what = p.kind === "design_recruiter" ? "recruit for design" : "recruit";
    return `Hey ${p.firstName}! ${opener}, and I'm exploring product design roles, especially in AI tools. I saw you ${what}${p.company ? ` at ${p.company}` : ""} and would love to connect and be on your radar if anything fits. Happy to share my portfolio!`;
  }
  const ask =
    p.kind === "engineer"
      ? "I'd love to connect and hear how AI is changing the way you work with designers"
      : "I'd love to connect and hear how AI is actually showing up in your work";
  const tries: [boolean, string][] = [
    [true, p.ending],
    [false, p.ending],
    [false, p.short || p.ending],
  ];
  let note = "";
  for (const [aside, ending] of tries) {
    note = `Hey ${p.firstName}! ${OPENERS[p.group]} through this AI era${aside ? " (exciting time)" : ""}. Now that I'm moving into industry, ${ask} ${ending.trim().replace(/[.!]+$/, "")}!`;
    if (note.length <= NOTE_LIMIT) return note;
  }
  return note;
}

export function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || name;
}
