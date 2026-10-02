import { prisma } from "@/lib/prisma";

// system_journal Material — append-only log of every meaningful event the brain
// should know about: AI generation runs, user accepts/dismisses, reflections
// added, applications added, etc. Each entry is one Material row whose `content`
// is JSON. The journal is the raw input to the periodic distillation pass that
// produces the `understanding_*` summaries.

export type JournalEntryType =
  | "ai_run"           // a Claude call completed — what was generated
  | "decision"         // user accepted or dismissed something
  | "reflection"       // user wrote a reflection entry
  | "application"      // user added a new application
  | "contact"          // user added a contact
  | "manual_edit"      // user manually edited content (esp. taste signal)
  | "status_change";   // skill status moved (to_learn → learning → learned)

export type JournalEntry = {
  type: JournalEntryType;
  surface: string;          // which feature triggered this (e.g. "recommend-skills", "skill-card")
  summary: string;          // one-line human-readable description
  signal?: {                // optional taste signal — what shifted
    topic?: string;
    direction?: "for" | "against";
    weight?: number;        // 1=light, 3=strong
  };
  refs?: {                  // optional pointers
    materialId?: string;
    proposalId?: string;
    applicationId?: string;
    contactId?: string;
  };
  meta?: Record<string, unknown>;
};

// Write one journal entry. Cheap, fire-and-forget. Failures are swallowed so a
// journal write never breaks the calling flow. After every successful write,
// non-blockingly checks whether the brain should re-distill.
export async function logJournal(entry: JournalEntry): Promise<void> {
  try {
    await prisma.material.create({
      data: {
        kind: "system_journal",
        title: `${entry.type}: ${entry.surface}`,
        content: JSON.stringify({ ...entry, at: new Date().toISOString() }),
      },
    });
    // Lazy-import distill to avoid a circular import (distill writes to journal too).
    const { maybeAutoDistill } = await import("@/lib/distill");
    void maybeAutoDistill();
  } catch {
    /* journal write must not fail the parent operation */
  }
}

// Fetch the most recent N journal entries. Used by distillation + by prompts
// that want a "what's been happening lately" window.
export async function recentJournal(limit: number = 50): Promise<(JournalEntry & { at: string })[]> {
  const rows = await prisma.material.findMany({
    where: { kind: "system_journal" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.content ?? "") as JournalEntry & { at: string };
      } catch {
        return null;
      }
    })
    .filter((x): x is JournalEntry & { at: string } => x !== null);
}

// Compact-text rendering for prompt injection. Returns at most `maxChars` of
// chronological journal text so the model can see what's been happening.
export async function journalBlock(limit: number = 30, maxChars: number = 2500): Promise<string> {
  const entries = await recentJournal(limit);
  if (entries.length === 0) return "";
  // Oldest first so the prompt reads chronologically.
  entries.reverse();
  const lines = entries.map((e) => {
    const sig = e.signal
      ? ` [${e.signal.direction ?? ""} ${e.signal.topic ?? ""}${e.signal.weight ? ` w=${e.signal.weight}` : ""}]`
      : "";
    return `- ${e.at.slice(0, 10)} ${e.type} @ ${e.surface}: ${e.summary}${sig}`;
  });
  const joined = lines.join("\n");
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}
