import { prisma } from "@/lib/prisma";

/**
 * Your own add and pass decisions on the people queue, fed back into the next
 * import's fit ranking. The people twin of verdict-signal.ts.
 *
 * The pass reasons are the point. "Recruiter, not a designer" or "too senior to
 * answer a cold note" is the judgement the ranking cannot get from the criteria
 * alone, and it is typed once, on the card, at the moment it is fresh. A bare
 * pass with no note still counts, as the headline it was made on.
 *
 * Adds are included too, headline only: a short list of who you said yes to is
 * the other half of the same signal, and without it a run of passes teaches the
 * ranking only what to push down.
 */

const MAX_PASSED = 20;
const MAX_ADDED = 15;

type Row = { name: string; title: string | null; company: string | null; decisionNote: string | null };

function line(r: Row): string {
  const who = [r.title, r.company && !(r.title ?? "").includes(r.company) ? r.company : null]
    .filter(Boolean)
    .join(", ");
  const note = r.decisionNote?.trim();
  return `  - ${who || r.name}${note ? `\n      their note: ${note}` : ""}`;
}

export async function peopleSignalBlock(): Promise<string> {
  const select = { name: true, title: true, company: true, decisionNote: true } as const;
  // Passes with a reason first, newest first, then silent ones to fill the window:
  // twenty bulk skips from one "Skip all" would otherwise push every typed reason out.
  const [reasoned, silent, added] = await Promise.all([
    prisma.personCandidate.findMany({
      where: { status: "skipped", decisionNote: { not: null } },
      select,
      orderBy: { decidedAt: "desc" },
      take: MAX_PASSED,
    }),
    prisma.personCandidate.findMany({
      where: { status: "skipped", decisionNote: null },
      select,
      orderBy: { decidedAt: "desc" },
      take: MAX_PASSED,
    }),
    prisma.personCandidate.findMany({
      where: { status: "added" },
      select,
      orderBy: { decidedAt: "desc" },
      take: MAX_ADDED,
    }),
  ]);
  const passed = [...reasoned.filter((r) => r.decisionNote?.trim()), ...silent].slice(0, MAX_PASSED);
  if (passed.length === 0 && added.length === 0) return "";

  const parts: string[] = [
    "Their own decisions on people from earlier pastes. These outrank the written criteria: the criteria are what they said they want, these are who they actually added and passed on. Where they disagree, follow these.",
  ];
  if (passed.length) parts.push(`\nWhat they pass on (${passed.length}):\n${passed.map(line).join("\n")}`);
  if (added.length) parts.push(`\nWho they added (${added.length}):\n${added.map(line).join("\n")}`);
  return parts.join("\n");
}
