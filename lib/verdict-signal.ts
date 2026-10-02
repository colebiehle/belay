import { prisma } from "@/lib/prisma";

/**
 * Your own accept and pass decisions, fed back into scoring.
 *
 * An earlier version of this proposed rewrites to the search criteria and waited for
 * you to review them. Nothing in the UI ever surfaced the proposals, so the criteria
 * sat untouched while decisions piled up behind them.
 *
 * This is the direct path: the decisions go into the scoring prompt as evidence, so a
 * verdict changes the next scoring pass rather than waiting on a review step that
 * never comes.
 *
 * Only Apply and Pass count. "Archived" is excluded deliberately, because those rows
 * carry text written by the intake filter rather than a judgement you made, and
 * feeding them in would only teach the scorer its own opinion back.
 */

const MAX_PER_SIDE = 25;

function line(j: { company: string; roleTitle: string; verdictNotes: string | null }): string {
  const note = j.verdictNotes?.trim();
  // The note is the signal. A bare accept says you liked something; a note says what,
  // and that is the part worth showing the model.
  return `  - ${j.company} — ${j.roleTitle}${note ? `\n      their note: ${note}` : ""}`;
}

export async function verdictSignalBlock(): Promise<string> {
  const [accepted, passed] = await Promise.all([
    prisma.job.findMany({
      where: { verdict: "Apply" },
      select: { company: true, roleTitle: true, verdictNotes: true },
      orderBy: { verdictAt: "desc" },
      take: MAX_PER_SIDE,
    }),
    prisma.job.findMany({
      where: { verdict: "Pass" },
      select: { company: true, roleTitle: true, verdictNotes: true },
      orderBy: { verdictAt: "desc" },
      take: MAX_PER_SIDE,
    }),
  ]);

  if (accepted.length === 0 && passed.length === 0) return "";

  const parts: string[] = [
    "their own decisions on earlier roles. These outrank the written criteria above: the criteria are what they said they want, these are what they actually chose. Where they disagree, follow these.",
  ];
  if (accepted.length > 0) {
    parts.push(`\nRoles they accepted (${accepted.length}):\n${accepted.map(line).join("\n")}`);
  }
  if (passed.length > 0) {
    parts.push(`\nRoles they passed on (${passed.length}):\n${passed.map(line).join("\n")}`);
  }
  return parts.join("\n");
}
