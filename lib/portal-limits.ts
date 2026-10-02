// Application limits and cooldowns, per company.
//
// Surfaced in the queue BEFORE time is spent on a form, because the expensive
// mistake is filling out a long application only to find the slot was capped or
// a cooldown was still running.
//
// Researched against official careers pages and ATS vendor docs.
// Candidate reports (Blind, Reddit, Glassdoor) could not be sampled, so
// `confidence` is honest about what is documented versus widely repeated.

export type PortalLimit = {
  company: string;
  limit?: string;      // hard cap on concurrent or periodic applications
  cooldown?: string;   // wait before reapplying after a rejection
  note?: string;
  confidence: "official" | "likely" | "unverified";
};

export const PORTAL_LIMITS: PortalLimit[] = [
  {
    company: "Netflix",
    limit: "2 applications at a time",
    confidence: "likely",
    note: "Their careers platform config exposes max_applications_apply: 2. Spend both slots deliberately.",
  },
  {
    company: "Anthropic",
    cooldown: "12 months after a rejection",
    confidence: "official",
    note: "Stated in their careers FAQ, and softened: sooner is fine if your experience materially changes.",
  },
  {
    company: "Google",
    limit: "3 per 30 days, widely repeated but NOT documented",
    confidence: "unverified",
    note: "A full read of Google's careers help centre found no such policy. Widely repeated but not documented anywhere official.",
  },
  {
    company: "Apple",
    limit: "unknown, reports vary between 5 active and no limit",
    confidence: "unverified",
    note: "Their FAQ is behind an Apple ID sign-in wall. Two minutes signed in at jobs.apple.com settles it. Matters because their loops run 2-3 months.",
  },
  {
    company: "TikTok",
    limit: "2 roles, early-career applicants only",
    confidence: "official",
    note: "Does not apply to you: the cap is scoped to their early-career track.",
  },
  {
    company: "Microsoft",
    confidence: "official",
    note: "No limit, and they explicitly encourage reapplying after a rejection.",
  },
  {
    company: "Amazon",
    limit: "possibly 3 active at a time, unverified",
    cooldown: "6 months before reapplying to the same role, widely repeated but unverified",
    confidence: "unverified",
    note:
      "Two separate claims, neither confirmed. A 3-active-application cap is " +
      "widely repeated for some Amazon portals; the 6 months is about reapplying " +
      "to a role you were rejected for, not a cap on how many you may hold open. " +
      "amazon.jobs renders FAQ answers client-side (the " +
      "page returns category links only) and hiring.amazon.com returns 403, so " +
      "neither could be read. Settle it by signing in at amazon.jobs.",
  },
  {
    company: "Meta",
    cooldown: "12 months, widely repeated but unverified",
    confidence: "unverified",
  },
];

export function limitFor(company: string): PortalLimit | undefined {
  const c = company.trim().toLowerCase();
  return PORTAL_LIMITS.find((p) => p.company.toLowerCase() === c);
}

// One line for the queue card.
export function restrictionLine(company: string): string | null {
  const l = limitFor(company);
  if (!l || (!l.limit && !l.cooldown)) return null;
  const parts = [l.limit, l.cooldown].filter(Boolean).join(" · ");
  // Several limit strings already say they are unverified in their own words, so
  // appending the tag produced "widely repeated but NOT documented (unverified)".
  // Only tag what does not already carry the caveat.
  const alreadyHedged = /unverified|not documented|vary|unknown/i.test(parts);
  const tag =
    alreadyHedged || l.confidence === "official" ? "" :
    l.confidence === "likely" ? " (likely)" : " (unverified)";
  return `${parts}${tag}`;
}
