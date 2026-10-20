import { prisma } from "@/lib/prisma";

/**
 * How connection notes are landing, overall and by version: of the notes marked
 * sent, how many people accepted (Connected or further) and how many replied
 * (Replied or further). Stages are moved by you as LinkedIn tells you, so the
 * numbers are as current as the stages.
 */
const ACCEPTED = new Set(["Connected", "Replied", "Scheduled", "Chatted"]);
const REPLIED = new Set(["Replied", "Scheduled", "Chatted"]);

export type NoteStats = { sent: number; accepted: number; replied: number };

export async function noteStats(): Promise<{ all: NoteStats; byVariant: Record<string, NoteStats> }> {
  const sent = await prisma.contact.findMany({
    where: { connectionNoteSentAt: { not: null } },
    select: { stage: true, connectionNoteVariant: true },
  });
  const all: NoteStats = { sent: 0, accepted: 0, replied: 0 };
  const byVariant: Record<string, NoteStats> = {};
  for (const c of sent) {
    const v = c.connectionNoteVariant ?? "unrecorded";
    const row = (byVariant[v] ??= { sent: 0, accepted: 0, replied: 0 });
    for (const r of [all, row]) {
      r.sent++;
      if (ACCEPTED.has(c.stage ?? "")) r.accepted++;
      if (REPLIED.has(c.stage ?? "")) r.replied++;
    }
  }
  return { all, byVariant };
}
