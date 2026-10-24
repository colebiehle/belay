/**
 * The connection note, in the owner's words (settled Oct 23 2026 after a long
 * back-and-forth and two premortems). Code assembles it; the model only supplies
 * who they are, their focus and an optional aside, so the wording cannot drift and
 * the length is counted exactly.
 *
 * Shape: hi, the shared tie, what I'm doing now (teaching interaction design in
 * this interesting era of AI), the transition (back to industry), and why them
 * (how a {role} at {company} is actually using AI, especially in your work on {focus}).
 *
 *   MHCI alumni:          "I'm a recent MHCI grad, currently teaching interaction design at CMU"
 *   MHCI and UCSD both:   "I also went to UCSD and recently graduated from MHCI! I'm currently teaching interaction design at CMU"
 *   Other CMU people:     "I'm a recent CMU MHCI grad, currently teaching interaction design at CMU"
 *   UCSD (tag ucsd):      "I'm a UCSD Cog Sci alum ('22), now teaching interaction design at Carnegie Mellon"
 *   Mercersburg (mburg):  "I'm a Mercersburg alum ('18), now teaching interaction design at Carnegie Mellon"
 *   No shared tie:        "I'm a recent CMU MHCI grad, currently teaching interaction design at Carnegie Mellon"
 * CMU for insiders, Carnegie Mellon spelled out for everyone else.
 *
 * Kinds: senior MHCI alumni (director and up, or ten or more years out) get the
 * mentor note, learning from their path; engineers get a question about using AI
 * with designers; recruiters get a different note.
 */

export const NOTE_LIMIT = 300;

export type NoteKind = "standard" | "senior_alum" | "engineer" | "recruiter" | "design_recruiter";
export type NoteGroup = "mhci" | "ucsd_mhci" | "cmu" | "ucsd" | "mburg" | "none";

const CMU = /\b(cmu|carnegie mellon)\b/i;
const MHCI = /\bmhci\b|master of human-computer interaction/i;
const UCSD = /\bucsd\b|uc san diego|university of california,? san diego/i;

export function openerFor(tags: string[], profile: string): NoteGroup {
  const t = new Set(tags.map((x) => x.toLowerCase()));
  const mhci = t.has("mhci") || MHCI.test(profile);
  const ucsd = t.has("ucsd") || UCSD.test(profile);
  if (mhci && ucsd) return "ucsd_mhci";
  if (mhci) return "mhci";
  if (t.has("cmu") || CMU.test(profile)) return "cmu";
  if (ucsd) return "ucsd";
  if (t.has("mburg") || t.has("mercersburg")) return "mburg";
  return "none";
}

const OPENERS: Record<NoteGroup, string> = {
  mhci: "I'm a recent MHCI grad, currently teaching interaction design at CMU",
  ucsd_mhci: "I also went to UCSD and recently graduated from MHCI! I'm currently teaching interaction design at CMU",
  cmu: "I'm a recent CMU MHCI grad, currently teaching interaction design at CMU",
  ucsd: "I'm a UCSD Cog Sci alum ('22), now teaching interaction design at Carnegie Mellon",
  mburg: "I'm a Mercersburg alum ('18), now teaching interaction design at Carnegie Mellon",
  none: "I'm a recent CMU MHCI grad, currently teaching interaction design at Carnegie Mellon",
};

/**
 * The note for one person.
 *   who:   their role at their company, at their real level ("a designer at Figma",
 *          "a design leader at Stripe", "Figma's head of design")
 *   path:  for the mentor note, where their path led ("leading design at Stripe")
 *   focus: what they work on, only when known with confidence ("onboarding",
 *          "creator and viewer experiences"); left out otherwise rather than guessed
 *   aside: a short parenthetical about something real they did ("the Make launch
 *          looked great"); optional
 * Cuts, in order, until it fits: the aside, then the focus.
 */
export function buildNote(p: {
  firstName: string;
  group: NoteGroup;
  kind: NoteKind;
  who: string;
  path?: string | null;
  // Whether their profile shows they did MHCI; "your path from MHCI to" only then.
  mhciConfirmed?: boolean;
  focus?: string | null;
  aside?: string | null;
  company?: string;
}): string {
  const clean = (s?: string | null) => (s || "").trim().replace(/[.!]+$/, "");
  if (p.kind === "recruiter" || p.kind === "design_recruiter") {
    // Recruiters are the one audience where saying you are looking is the point.
    // "for design" only when they actually recruit for design.
    const what = p.kind === "design_recruiter" ? "recruit for design" : "recruit";
    return `Hey ${p.firstName}! ${OPENERS[p.group]}, and I'm exploring product design roles, especially in AI tools. I saw you ${what}${p.company ? ` at ${p.company}` : ""} and would love to connect and be on your radar if anything fits. Happy to share my portfolio!`;
  }
  const lead = `Hey ${p.firstName}! ${OPENERS[p.group]} in this interesting era of AI. As I transition back to industry,`;
  if (p.kind === "senior_alum" && clean(p.path)) {
    // Senior alumni: learning from their path, the AI angle second.
    const from = p.mhciConfirmed ? "from MHCI " : "";
    const full = `${lead} I'd love to connect and learn from your path ${from}to ${clean(p.path)}, especially how you're seeing AI change the work!`;
    if (full.length <= NOTE_LIMIT) return full;
    return `${lead} I'd love to connect and learn from your path ${from}to ${clean(p.path)}!`;
  }
  const using = p.kind === "engineer" ? "is actually using AI alongside designers" : "is actually using AI";
  const tries: [boolean, boolean][] = [
    [true, true],
    [false, true],
    [false, false],
  ];
  let note = "";
  for (const [withAside, withFocus] of tries) {
    const focus = withFocus && clean(p.focus) ? `, especially in your work on ${clean(p.focus)}` : "";
    const aside = withAside && clean(p.aside) ? ` (${clean(p.aside)})` : "";
    note = `${lead} I'd love to connect and hear how ${clean(p.who)} ${using}${focus}${aside}!`;
    if (note.length <= NOTE_LIMIT) return note;
  }
  return note;
}

export function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || name;
}
